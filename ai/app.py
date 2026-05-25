import joblib
import json
import math
import os
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from urllib import error, request
import logging

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

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DEFAULT_ALLOWED_ORIGINS = [
    "chrome-extension://oeagfaaaaigiihdcdombadijdcfppljk",
    "https://ai-fake-twitter-profile-detection.vercel.app/",
]


def get_allowed_origins():
    extra_origins = [
        origin.strip()
        for origin in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",")
        if origin.strip()
    ]
    return [*DEFAULT_ALLOWED_ORIGINS, *extra_origins]


app = FastAPI(
    title="Fake Profile Detection AI",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
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
    followers = bounded_number(data.followers_count, "followers_count")
    following = bounded_number(data.following_count, "following_count")
    account_age_days = non_negative(data.account_age_days)
    statuses_count = non_negative(data.statuses_count)

    posts_per_day = round_feature(clamp(
        statuses_count / (account_age_days + 1),
        *FEATURE_BOUNDS["posts_per_day"]
    ))
    content_density = round_feature(clamp(
        statuses_count / max(account_age_days, 1),
        *FEATURE_BOUNDS["content_density"]
    ))
    tweets_per_day = round_feature(clamp(
        statuses_count / (account_age_days + 1),
        *FEATURE_BOUNDS["tweets_per_day"]
    ))
    engagement_proxy = round_feature(clamp(
        followers * tweets_per_day,
        *FEATURE_BOUNDS["engagement_proxy"]
    ))
    followers_log = round_feature(math.log1p(followers))
    following_log = round_feature(math.log1p(following))
    ratio_log = round_feature(followers_log / (following_log + 1))
    activity_score = round_feature(clamp(
        statuses_count / (account_age_days + 1),
        *FEATURE_BOUNDS["activity_score"]
    ))
    growth_signal = round_feature(clamp(
        followers / (account_age_days + 1),
        *FEATURE_BOUNDS["growth_signal"]
    ))

    return {
        "followers_count": followers,
        "following_count": following,
        "follower_following_ratio": round_feature(clamp(
            followers / (following + 1),
            *FEATURE_BOUNDS["follower_following_ratio"]
        )),
        "account_age_days": account_age_days,
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
        "bio_length": non_negative(data.bio_length),
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


def build_risk_level(probability):
    score = probability * 100

    if score >= 70:
        return "HIGH"

    if score >= 50:
        return "MEDIUM"

    if score >= 30:
        return "LOW"

    return "REAL"


def build_explanation(row, probability):
    reasons = []

    if row["follower_following_ratio"] >= 1000:
        reasons.append("Extremely high follower ratio")

    if row["username_randomness_score"] > 0.4:
        reasons.append("Username randomness detected")

    if row["has_profile_image"] == 0:
        reasons.append("Missing profile image")

    if row["bio_length"] < 10:
        reasons.append("Very short biography")

    if row["content_density"] > 50:
        reasons.append("Abnormal posting activity")

    if row["tweets_per_day"] > 50 or row["activity_score"] > 50:
        reasons.append("Very high daily posting volume")

    if row["growth_signal"] < 0.5 and row["account_age_days"] > 180:
        reasons.append("Weak follower growth for account age")

    if row["engagement_proxy"] > 1000000 and row["verified"] == 0:
        reasons.append("Large reach proxy without verification")

    if row["ratio_log"] > 2.5 and row["following_count"] < 20:
        reasons.append("Highly lopsided follower pattern")

    if row["verified"] == 0 and row["followers_count"] > 1000000:
        reasons.append("Large audience without verification")

    if not reasons and probability >= 0.5:
        reasons.append(
            "Several account signals differ from typical real profiles"
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


class ScanInput(BaseModel):
    followers_count: int
    following_count: int
    account_age_days: int
    statuses_count: int
    has_profile_image: int
    verified: int
    bio_length: int
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


@app.post("/predict")
def predict(data: ScanInput):
    feature_row = build_feature_row(data)
    df = pd.DataFrame(
        [[feature_row.get(feature, 0) for feature in MODEL_FEATURES]],
        columns=MODEL_FEATURES
    )
    proba = round(float(model.predict_proba(df)[0][1]), 4)
    prediction = int(proba >= threshold)
    confidence = round(proba if prediction == 1 else 1 - proba, 4)
    risk_level = build_risk_level(proba)
    explanation = build_explanation(feature_row, proba)
    supabase_row = {
        "platform": data.platform or "twitter",
        "scan_id": data.scan_id or "",
        "username": data.username or "",
        "raw_metrics": data.raw_metrics,
        **feature_row,
        "prediction": prediction,
        "label": "fake" if prediction == 1 else "real",
        "fake_probability": proba,
        "confidence": confidence,
        "risk_level": risk_level,
        "explanation": explanation
    }
    supabase_result = insert_supabase_scan(supabase_row)
    logger.info(
        "Prediction=%s Confidence=%.2f Risk=%s ScanId=%s User=%s Platform=%s",
        prediction,
        confidence,
        risk_level,
        data.scan_id or "-",
        data.username or "-",
        data.platform or "twitter"
    )

    return {
        "prediction": prediction,
        "label": "fake" if prediction == 1 else "real",
        "fake_probability": proba,
        "probability": proba,
        "threshold": threshold,
        "model_name": MODEL_NAME,
        "model_version": MODEL_VERSION,
        "confidence": confidence,
        "risk_level": risk_level,
        "explanation": explanation,
        "features": feature_row,
        "supabase": supabase_result
    }
