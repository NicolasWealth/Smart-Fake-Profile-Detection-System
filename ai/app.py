import joblib
import json
import math
import os
import pandas as pd
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Request as FastAPIRequest
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
from urllib import error, parse, request
import logging

try:
    from slowapi import Limiter
    from slowapi.errors import RateLimitExceeded
    from slowapi.util import get_remote_address
    from slowapi import _rate_limit_exceeded_handler
except ImportError:
    RateLimitExceeded = None

    def get_remote_address(_request):
        return "local"

    class Limiter:
        def __init__(self, key_func):
            self.key_func = key_func

        def limit(self, _limit_value):
            def decorator(func):
                return func
            return decorator

DEFAULT_MODEL_FEATURES = [
    "followers_count",
    "following_count",
    "follower_following_ratio",
    "account_age_days",
    "statuses_count",
    "posts_per_day",
    "content_density",
    "tweets_per_day",
    "engagement_proxy",
    "followers_log",
    "following_log",
    "ratio_log",
    "activity_score",
    "growth_signal",
    "has_profile_image",
    "verified",
    "bio_length",
    "username_randomness_score",
    "username_length",
]

THREAT_LABELS = {
    "HIGH": "Automated Threat",
    "MEDIUM": "Suspicious Behavior",
    "LOW": "Low Risk",
    "UNCERTAIN": "Insufficient Evidence",
    "REAL": "Authentic Profile",
}

THREAT_CODES_BY_LABEL = {
    label.upper(): code
    for code, label in THREAT_LABELS.items()
}

CONFIDENCE_BANDS = [
    (0.95, "Critical Confidence"),
    (0.80, "Strong Confidence"),
    (0.60, "Moderate Confidence"),
    (0.00, "Low Confidence"),
]

FEATURE_BOUNDS = {
    "followers_count": (0, 1000000000),
    "following_count": (0, 1000000),
    "follower_following_ratio": (0, 1000),
    "posts_per_day": (0, 500),
    "content_density": (0, 500),
    "tweets_per_day": (0, 500),
    "engagement_proxy": (0, 100000000),
    "activity_score": (0, 500),
    "growth_signal": (0, 1000000),
}
MISSING_NUMERIC_SENTINEL = -1

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DEFAULT_ALLOWED_ORIGINS = [
    "chrome-extension://oeagfaaaaigiihdcdombadijdcfppljk",
    "https://ai-fake-twitter-profile-detection.vercel.app",
    "https://smart-fake-profile-detection-system.vercel.app",
]
DEFAULT_ALLOWED_ORIGIN_REGEX = r"chrome-extension://[a-p]{32}"


def get_allowed_origins():
    extra_origins = [
        origin.strip()
        for origin in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",")
        if origin.strip()
    ]
    return [*DEFAULT_ALLOWED_ORIGINS, *extra_origins]


limiter = Limiter(key_func=get_remote_address)


app = FastAPI(
    title="Fake Profile Detection AI",
    version="1.0.0"
)

app.state.limiter = limiter
if RateLimitExceeded is not None:
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_origin_regex=os.getenv(
        "CORS_ALLOWED_ORIGIN_REGEX",
        DEFAULT_ALLOWED_ORIGIN_REGEX
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "..", "data", "models", "best_model.pkl")
MODEL_METRICS_PATH = os.path.join(BASE_DIR, "model_metrics.json")
MODEL_METADATA_PATH = os.path.join(BASE_DIR, "model_metadata.json")
FEATURE_IMPORTANCE_PATH = os.path.join(BASE_DIR, "feature_importance.json")
bundle = joblib.load(MODEL_PATH)
model = bundle["model"]
threshold = float(bundle.get("threshold", 0.5))
MODEL_FEATURES = bundle.get("features", DEFAULT_MODEL_FEATURES)
MODEL_VERSION = bundle.get("model_version", "v2.1.0")
MODEL_NAME = bundle.get("model_name", type(model).__name__)
DEFAULT_MODEL_METRICS = bundle.get("metrics", {})
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_TABLE = os.getenv("SUPABASE_TABLE", "scans")
SUPABASE_MAX_SCHEMA_RETRIES = 12


def clamp(value, lower, upper):
    return min(max(value, lower), upper)


def to_number(value):
    try:
        number = float(value)
        return number if math.isfinite(number) else 0.0
    except (TypeError, ValueError):
        return 0.0


def non_negative(value):
    return max(0.0, to_number(value))


def bounded_number(value, field):
    lower, upper = FEATURE_BOUNDS[field]
    return clamp(to_number(value), lower, upper)


def missing_aware_bounded_number(value, field):
    if value is None:
        return MISSING_NUMERIC_SENTINEL

    return bounded_number(value, field)


def round_feature(value):
    return round(value, 4) if math.isfinite(value) else 0.0


def extract_feature_importance(model_instance, feature_names):
    scores = None

    if hasattr(model_instance, "feature_importances_"):
        scores = model_instance.feature_importances_
    elif hasattr(model_instance, "named_steps"):
        logistic_model = model_instance.named_steps.get("logisticregression")
        if logistic_model is not None and hasattr(logistic_model, "coef_"):
            scores = [abs(score) for score in logistic_model.coef_[0]]
    elif hasattr(model_instance, "coef_"):
        scores = [abs(score) for score in model_instance.coef_[0]]

    if scores is None:
        return {}

    pairs = [
        (feature, round(float(abs(score)), 6))
        for feature, score in zip(feature_names, scores)
    ]
    pairs.sort(key=lambda item: item[1], reverse=True)
    return dict(pairs)


DEFAULT_FEATURE_IMPORTANCE = (
    bundle.get("feature_importance") or
    extract_feature_importance(model, MODEL_FEATURES)
)
DEFAULT_MODEL_METADATA = [
    {
        "trained_at": None,
        "dataset_size": None,
        "fake_samples": None,
        "real_samples": None,
        "features": MODEL_FEATURES,
        "feature_count": len(MODEL_FEATURES),
        "model_name": MODEL_NAME,
        "model_version": MODEL_VERSION,
        "threshold": threshold
    }
]


def load_json_file(path, fallback):
    try:
        with open(path, encoding="utf-8") as file:
            return json.load(file)
    except FileNotFoundError:
        logger.warning("JSON file not found: %s", path)
    except json.JSONDecodeError:
        logger.warning("Invalid JSON file: %s", path)

    return fallback


def build_feature_row(data):
    followers = missing_aware_bounded_number(data.followers_count, "followers_count")
    following = missing_aware_bounded_number(data.following_count, "following_count")
    followers_known = followers != MISSING_NUMERIC_SENTINEL
    following_known = following != MISSING_NUMERIC_SENTINEL

    # fillna(-1): null means the feature was not extractable from the page.
    # -1 is the sentinel the model was trained to recognise as "unknown".
    account_age_days_raw = data.account_age_days
    account_age_days = non_negative(account_age_days_raw) if account_age_days_raw is not None else -1

    bio_length_raw = data.bio_length
    bio_length = non_negative(bio_length_raw) if bio_length_raw is not None else -1

    # Use account_age_days only in denominators when it is a real value (>= 0)
    age_denominator = account_age_days if account_age_days >= 0 else 0

    statuses_count = non_negative(data.statuses_count)

    posts_per_day = round_feature(clamp(
        statuses_count / (age_denominator + 1),
        *FEATURE_BOUNDS["posts_per_day"]
    ))
    content_density = round_feature(clamp(
        statuses_count / max(age_denominator, 1),
        *FEATURE_BOUNDS["content_density"]
    ))
    tweets_per_day = round_feature(clamp(
        statuses_count / (age_denominator + 1),
        *FEATURE_BOUNDS["tweets_per_day"]
    ))
    engagement_proxy = (
        round_feature(clamp(
            followers * tweets_per_day,
            *FEATURE_BOUNDS["engagement_proxy"]
        ))
        if followers_known else MISSING_NUMERIC_SENTINEL
    )
    followers_log = (
        round_feature(math.log1p(followers))
        if followers_known else MISSING_NUMERIC_SENTINEL
    )
    following_log = (
        round_feature(math.log1p(following))
        if following_known else MISSING_NUMERIC_SENTINEL
    )
    ratio_log = (
        round_feature(followers_log / (following_log + 1))
        if followers_known and following_known else MISSING_NUMERIC_SENTINEL
    )
    activity_score = round_feature(clamp(
        statuses_count / (age_denominator + 1),
        *FEATURE_BOUNDS["activity_score"]
    ))
    growth_signal = (
        round_feature(clamp(
            followers / (age_denominator + 1),
            *FEATURE_BOUNDS["growth_signal"]
        ))
        if followers_known else MISSING_NUMERIC_SENTINEL
    )

    # follower_following_ratio: log10 scale matching the JS normalizer
    if followers_known and following_known:
        raw_ratio = math.log10((followers + 1) / (following + 1))
        follower_following_ratio = round_feature(clamp(
            raw_ratio,
            *FEATURE_BOUNDS["follower_following_ratio"]
        ))
    else:
        follower_following_ratio = MISSING_NUMERIC_SENTINEL

    logger.info(
        "[FPD:preprocess] account_age_days=%s (fillna→%s), bio_length=%s (fillna→%s)",
        account_age_days_raw, account_age_days,
        bio_length_raw, bio_length
    )

    return {
        "followers_count": followers,
        "following_count": following,
        "follower_following_ratio": follower_following_ratio,
        "account_age_days": account_age_days,
        "content_count": statuses_count,
        "statuses_count": statuses_count,
        "posts_per_day": posts_per_day,
        "content_density": content_density,
        "tweets_per_day": tweets_per_day,
        "engagement_proxy": engagement_proxy,
        "followers_log": followers_log,
        "following_log": following_log,
        "ratio_log": ratio_log,
        "activity_score": activity_score,
        "growth_signal": growth_signal,
        "has_profile_image": int(clamp(to_number(data.has_profile_image), 0, 1)),
        "verified": int(clamp(to_number(data.verified), 0, 1)),
        "bio_length": bio_length,
        "username_randomness_score": clamp(
            to_number(data.username_randomness_score),
            0,
            1
        ),
        "username_length": non_negative(data.username_length),
    }


def build_feature_frame(data):
    row = build_feature_row(data)
    return pd.DataFrame(
        [[row.get(feature, 0) for feature in MODEL_FEATURES]],
        columns=MODEL_FEATURES
    )


def build_risk_code(probability, confidence):
    if confidence < 0.6:
        return "UNCERTAIN"

    score = probability * 100

    if score >= 70:
        return "HIGH"

    if score >= 50:
        return "MEDIUM"

    if score >= 30:
        return "LOW"

    return "REAL"


def build_confidence_band(confidence):
    for lower_bound, label in CONFIDENCE_BANDS:
        if confidence >= lower_bound:
            return label

    return "Low Confidence"


def build_threat_label(risk_code):
    return THREAT_LABELS.get(risk_code, THREAT_LABELS["UNCERTAIN"])


def normalize_risk_code(value):
    normalized = str(value or "").upper()
    if normalized in THREAT_LABELS:
        return normalized
    return THREAT_CODES_BY_LABEL.get(normalized, "UNCERTAIN")


def build_explanation(row, probability):
    reasons = []

    if row["follower_following_ratio"] >= 1000:
        reasons.append(
            "Follower-to-following ratio is extreme enough to indicate "
            "non-organic audience acquisition patterns"
        )

    if row["username_randomness_score"] > 0.4:
        reasons.append(
            "Username structure contains randomness signals commonly seen in "
            "automated or disposable accounts"
        )

    if row["has_profile_image"] == 0:
        reasons.append(
            "Profile metadata lacks normal authenticity indicators, including "
            "a recognizable profile image"
        )

    if row["bio_length"] < 10:
        reasons.append(
            "Profile biography is too sparse to provide normal identity or "
            "context signals"
        )

    if row["content_density"] > 50:
        reasons.append(
            "Posting density significantly exceeds normal human activity "
            "baseline for the account age"
        )

    if row["tweets_per_day"] > 50 or row["activity_score"] > 50:
        reasons.append(
            "Daily posting frequency significantly exceeds normal human "
            "activity baseline"
        )

    if row["growth_signal"] < 0.5 and row["account_age_days"] > 180:
        reasons.append(
            "Follower growth is unusually weak relative to account age, which "
            "reduces account authenticity confidence"
        )

    if row["engagement_proxy"] > 1000000 and row["verified"] == 0:
        reasons.append(
            "Reach proxy is unusually large for an unverified account, creating "
            "a credibility mismatch"
        )

    if row["ratio_log"] > 2.5 and row["following_count"] < 20:
        reasons.append(
            "Follower graph is highly asymmetric, which can indicate artificial "
            "audience shaping"
        )

    if row["verified"] == 0 and row["followers_count"] > 1000000:
        reasons.append(
            "Large audience size without verification increases impersonation "
            "and automation risk"
        )

    if not reasons and probability >= 0.5:
        reasons.append(
            "Multiple account signals deviate from the baseline profile of a "
            "typical authentic account"
        )

    return reasons


def get_missing_schema_column(error_text):
    try:
        parsed = json.loads(error_text)
        message = parsed.get("message", "")
        marker = "Could not find the '"
        if marker not in message:
            return None

        start = message.index(marker) + len(marker)
        end = message.find("' column", start)
        return message[start:end] if end > start else None
    except (json.JSONDecodeError, TypeError, ValueError):
        return None


def insert_supabase_scan(row):
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return {
            "ok": False,
            "skipped": True,
            "reason": "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY on server"
        }

    body = dict(row)
    endpoint = f"{SUPABASE_URL}/rest/v1/{SUPABASE_TABLE}"
    headers = {
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"
    }

    for _ in range(SUPABASE_MAX_SCHEMA_RETRIES + 1):
        payload = json.dumps(body).encode("utf-8")
        req = request.Request(endpoint, data=payload, headers=headers, method="POST")

        try:
            with request.urlopen(req) as response:
                status = getattr(response, "status", 200)
                if 200 <= status < 300:
                    return {
                        "ok": True,
                        "saved_row": body
                    }
        except error.HTTPError as exc:
            error_text = exc.read().decode("utf-8", errors="replace")
            missing_column = get_missing_schema_column(error_text)

            if (
                exc.code == 400 and
                missing_column and
                missing_column in body
            ):
                del body[missing_column]
                continue

            return {
                "ok": False,
                "status": exc.code,
                "error": error_text
            }
        except error.URLError as exc:
            return {
                "ok": False,
                "error": str(exc.reason)
            }

    return {
        "ok": False,
        "error": "Supabase schema retry limit reached"
    }


def fetch_supabase_scan(scan_id):
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(
            status_code=503,
            detail="Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY on server"
        )

    encoded_scan_id = parse.quote(scan_id, safe="")
    endpoint = (
        f"{SUPABASE_URL}/rest/v1/{SUPABASE_TABLE}"
        f"?scan_id=eq.{encoded_scan_id}&select=*&order=created_at.desc&limit=1"
    )
    headers = {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}"
    }
    req = request.Request(endpoint, headers=headers, method="GET")

    try:
        with request.urlopen(req) as response:
            rows = json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        error_text = exc.read().decode("utf-8", errors="replace")
        raise HTTPException(status_code=exc.code, detail=error_text) from exc
    except error.URLError as exc:
        raise HTTPException(status_code=502, detail=str(exc.reason)) from exc

    if not rows:
        raise HTTPException(status_code=404, detail="Scan report not found")

    return rows[0]


def build_scan_report(row):
    features = {
        feature: row.get(feature, 0)
        for feature in MODEL_FEATURES
    }
    features["content_count"] = row.get(
        "content_count",
        row.get("statuses_count", 0)
    )
    confidence = to_number(row.get("confidence"))
    risk_code = normalize_risk_code(row.get("risk_code") or row.get("risk_level"))
    threat_label = row.get("threat_label") or build_threat_label(risk_code)

    return {
        "scan_id": row.get("scan_id", ""),
        "username": row.get("username", ""),
        "platform": row.get("platform", "twitter"),
        "prediction": row.get("prediction"),
        "label": row.get("label", ""),
        "risk_code": risk_code,
        "risk_level": threat_label,
        "threat_label": threat_label,
        "confidence": confidence,
        "confidence_band": (
            row.get("confidence_band") or build_confidence_band(confidence)
        ),
        "explanation": row.get("explanation") or [],
        "timestamp": row.get("created_at"),
        "features": features,
        "model_name": MODEL_NAME,
        "model_version": MODEL_VERSION,
    }


class ScanInput(BaseModel):
    followers_count: Optional[int] = None
    following_count: Optional[int] = None
    # None = feature not extractable from page; backend fills with -1 (fillna sentinel)
    account_age_days: Optional[int] = None
    content_count: int = 0
    statuses_count: int
    has_profile_image: int
    verified: int
    # None = bio not extractable; backend fills with -1
    bio_length: Optional[int] = None
    username_randomness_score: float
    username_length: int
    follower_following_ratio: float = 0.0
    posts_per_day: float = 0.0
    content_density: float = 0.0
    tweets_per_day: float = 0.0
    engagement_proxy: float = 0.0
    followers_log: float = 0.0
    following_log: float = 0.0
    ratio_log: float = 0.0
    activity_score: float = 0.0
    growth_signal: float = 0.0
    username: str = ""
    platform: str = "twitter"
    scan_id: str = ""
    data_complete: Optional[bool] = None
    followers_known: Optional[bool] = None
    following_known: Optional[bool] = None
    raw_metrics: dict[str, object] = Field(default_factory=dict)


@app.get("/")
def health():
    return {
        "status": "online",
        "service": "Fake Profile Detection AI",
        "model": MODEL_NAME,
        "model_name": MODEL_NAME,
        "model_version": MODEL_VERSION,
        "feature_count": len(MODEL_FEATURES)
    }

@app.get("/metrics")
def metrics():
    return load_json_file(MODEL_METRICS_PATH, DEFAULT_MODEL_METRICS)


@app.get("/model-info")
def model_info():
    return load_json_file(MODEL_METADATA_PATH, DEFAULT_MODEL_METADATA)


@app.get("/feature-importance")
def feature_importance():
    return load_json_file(FEATURE_IMPORTANCE_PATH, DEFAULT_FEATURE_IMPORTANCE)


@app.get("/scan-report/{scan_id}")
def scan_report(scan_id: str):
    return build_scan_report(fetch_supabase_scan(scan_id))


@app.post("/predict")
@limiter.limit("30/minute")
def predict(request: FastAPIRequest, data: ScanInput):
    feature_row = build_feature_row(data)
    df = pd.DataFrame(
        [[feature_row.get(feature, 0) for feature in MODEL_FEATURES]],
        columns=MODEL_FEATURES
    )
    proba = round(float(model.predict_proba(df)[0][1]), 4)
    prediction = int(proba >= threshold)
    confidence = round(proba if prediction == 1 else 1 - proba, 4)
    risk_code = build_risk_code(proba, confidence)
    threat_label = build_threat_label(risk_code)
    confidence_band = build_confidence_band(confidence)
    explanation = build_explanation(feature_row, proba)
    supabase_row = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "platform": data.platform or "twitter",
        "scan_id": data.scan_id or "",
        "username": data.username or "",
        "data_complete": data.data_complete,
        "followers_known": data.followers_known,
        "following_known": data.following_known,
        "raw_metrics": data.raw_metrics,
        **feature_row,
        "content_count": feature_row["statuses_count"],
        "prediction": prediction,
        "label": "fake" if prediction == 1 else "real",
        "fake_probability": proba,
        "confidence": confidence,
        "risk_code": risk_code,
        "risk_level": threat_label,
        "threat_label": threat_label,
        "confidence_band": confidence_band,
        "explanation": explanation
    }
    supabase_result = insert_supabase_scan(supabase_row)
    logger.info(json.dumps({
        "event": "scan_prediction",
        "scan_id": data.scan_id or "",
        "platform": data.platform or "twitter",
        "username": data.username or "",
        "prediction": prediction,
        "label": "fake" if prediction == 1 else "real",
        "confidence": confidence,
        "confidence_band": confidence_band,
        "risk_code": risk_code,
        "risk_level": threat_label,
        "supabase_saved": bool(supabase_result.get("ok"))
    }))

    return {
        "prediction": prediction,
        "label": "fake" if prediction == 1 else "real",
        "fake_probability": proba,
        "probability": proba,
        "threshold": threshold,
        "model_name": MODEL_NAME,
        "model_version": MODEL_VERSION,
        "confidence": confidence,
        "confidence_band": confidence_band,
        "risk_code": risk_code,
        "risk_level": threat_label,
        "threat_label": threat_label,
        "explanation": explanation,
        "features": feature_row,
        "supabase": supabase_result
    }
