import json
import joblib
import numpy as np
import pandas as pd

from datetime import datetime, timezone
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

MODEL_PATH = "data/models/best_model.pkl"
METRICS_PATH = "ai/model_metrics.json"
FEATURE_IMPORTANCE_PATH = "ai/feature_importance.json"
METADATA_PATH = "ai/model_metadata.json"
MODEL_VERSION = "v2.1.0"
THRESHOLD_CANDIDATES = np.arange(0.3, 0.7, 0.05)


def extract_feature_importance(model, feature_names):
    scores = None

    if hasattr(model, "feature_importances_"):
        scores = model.feature_importances_
    elif hasattr(model, "named_steps"):
        logistic_model = model.named_steps.get("logisticregression")
        if logistic_model is not None and hasattr(logistic_model, "coef_"):
            scores = np.abs(logistic_model.coef_[0])
    elif hasattr(model, "coef_"):
        scores = np.abs(model.coef_[0])

    if scores is None:
        return {}

    pairs = [
        (feature, round(float(score), 6))
        for feature, score in zip(feature_names, scores)
    ]
    pairs.sort(key=lambda item: item[1], reverse=True)
    return dict(pairs)

# Load dataset
df = pd.read_csv("data/processed/clean_dataset.csv")

# Features / Target
X = df.drop(columns=["label"])
y = df["label"]
feature_names = X.columns.tolist()
dataset_size = int(len(df))
fake_samples = int((y == 1).sum())
real_samples = int((y == 0).sum())

# Split
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y
)

# Models
models = {
    "RandomForest": RandomForestClassifier(
        n_estimators=500,
        max_depth=12,
        class_weight="balanced",
        random_state=42
    ),
    "GradientBoosting": GradientBoostingClassifier(
        n_estimators=200,
        learning_rate=0.05,
        max_depth=3,
        random_state=42
    ),
    "LogisticRegression": make_pipeline(
        StandardScaler(),
        LogisticRegression(
            max_iter=2000,
            class_weight="balanced",
            random_state=42
        )
    ),
}

best_model = None
best_name = None
best_score = 0.0
best_threshold = 0.5
best_metrics = {}
best_feature_importance = {}

for name, model in models.items():
    print(f"\n===== {name} =====")

    model.fit(X_train, y_train)

    probs = model.predict_proba(X_test)[:, 1]
    selected_threshold = 0.5
    preds = model.predict(X_test)

    if name == "RandomForest":
        threshold_score = 0.0

        for candidate in THRESHOLD_CANDIDATES:
            preds_t = (probs >= candidate).astype(int)
            fake_f1 = f1_score(y_test, preds_t, pos_label=1)

            if fake_f1 > threshold_score:
                threshold_score = fake_f1
                selected_threshold = float(candidate)

        print("Best Threshold:", selected_threshold)
        preds = (probs >= selected_threshold).astype(int)

    acc = accuracy_score(y_test, preds)
    precision = precision_score(y_test, preds, pos_label=1, zero_division=0)
    recall = recall_score(y_test, preds, pos_label=1, zero_division=0)
    fake_f1 = f1_score(y_test, preds, pos_label=1)
    cv_scores = cross_val_score(
        model,
        X,
        y,
        cv=5,
        scoring="f1"
    )
    roc_auc = roc_auc_score(y_test, probs)
    fpr, tpr, _ = roc_curve(y_test, probs)
    importance_data = extract_feature_importance(model, feature_names)

    print("Accuracy:", round(acc * 100, 2), "%")
    print("Precision:", round(precision, 4))
    print("Recall:", round(recall, 4))
    print("Fake Account F1:", round(fake_f1, 4))
    print("Cross Validation F1:", round(cv_scores.mean(), 4))
    print("ROC AUC:", round(roc_auc, 4))
    print("\nClassification Report:")
    print(classification_report(y_test, preds))
    print("Confusion Matrix:")
    print(confusion_matrix(y_test, preds))

    if fake_f1 > best_score:
        best_score = fake_f1
        best_model = model
        best_name = name
        best_threshold = selected_threshold
        best_metrics = {
            "accuracy": round(acc, 4),
            "precision": round(float(precision), 4),
            "recall": round(float(recall), 4),
            "f1_score": round(fake_f1, 4),
            "cv_f1": round(float(cv_scores.mean()), 4),
            "roc_auc": round(float(roc_auc), 4),
            "threshold": round(float(selected_threshold), 4),
            "model_name": name,
            "model_version": MODEL_VERSION,
            "roc_curve": [
                {
                    "fpr": round(float(x), 6),
                    "tpr": round(float(y), 6)
                }
                for x, y in zip(fpr, tpr)
            ]
        }
        best_feature_importance = importance_data

joblib.dump(
    {
        "model": best_model,
        "threshold": best_threshold,
        "features": feature_names,
        "model_name": best_name,
        "model_version": MODEL_VERSION,
        "metrics": best_metrics,
        "feature_importance": best_feature_importance,
    },
    MODEL_PATH
)

trained_at = datetime.now(timezone.utc).isoformat()
model_metadata = [
    {
        "trained_at": trained_at,
        "dataset_size": dataset_size,
        "fake_samples": fake_samples,
        "real_samples": real_samples,
        "features": feature_names,
        "feature_count": len(feature_names),
        "model_name": best_name,
        "model_version": MODEL_VERSION,
        "threshold": round(float(best_threshold), 4)
    }
]

with open(METRICS_PATH, "w", encoding="utf-8") as metrics_file:
    json.dump(best_metrics, metrics_file, indent=2)

with open(FEATURE_IMPORTANCE_PATH, "w", encoding="utf-8") as importance_file:
    json.dump(best_feature_importance, importance_file, indent=2)

with open(METADATA_PATH, "w", encoding="utf-8") as metadata_file:
    json.dump(model_metadata, metadata_file, indent=2)

print(feature_names)
print("\n==========================")
print("Best Model:", best_name)
print("Best Threshold:", best_threshold)
print("Best Fake F1:", round(best_score, 4))
print("Saved to", MODEL_PATH)
print("Metadata saved to", METADATA_PATH)
