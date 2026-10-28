"""Train and evaluate the SafeBand fall detector using subject-held-out data."""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.preprocessing import LabelEncoder


BACKEND_DIR = Path(__file__).resolve().parents[1]
DATASET_DIR = BACKEND_DIR / "datasets"
MODEL_DIR = BACKEND_DIR / "models"
MODEL_PATH = MODEL_DIR / "fall_detection_model.joblib"
LABEL_ENCODER_PATH = MODEL_DIR / "fall_label_encoder.joblib"
REPORT_PATH = MODEL_DIR / "fall_model_evaluation.json"

FEATURE_COLUMNS = [
    "ADXL345_Acc_X", "ADXL345_Acc_Y", "ADXL345_Acc_Z",
    "ITG3200_Gyro_X", "ITG3200_Gyro_Y", "ITG3200_Gyro_Z",
    "MMA8451Q_Acc_X", "MMA8451Q_Acc_Y", "MMA8451Q_Acc_Z",
]
TARGET_COLUMN = "FallCheck"
REQUIRED_COLUMNS = FEATURE_COLUMNS + [TARGET_COLUMN]
RANDOM_SEED = 42


def load_dataset() -> pd.DataFrame:
    csv_files = sorted(DATASET_DIR.glob("*.csv"))
    if not csv_files:
        raise FileNotFoundError(f"No CSV datasets found in {DATASET_DIR}")

    frames: list[pd.DataFrame] = []
    for file_path in csv_files:
        frame = pd.read_csv(file_path)
        missing = sorted(set(REQUIRED_COLUMNS) - set(frame.columns))
        if missing:
            print(f"Skipping {file_path.name}; missing columns: {missing}")
            continue
        frame = frame[REQUIRED_COLUMNS].copy()
        for column in FEATURE_COLUMNS + [TARGET_COLUMN]:
            frame[column] = pd.to_numeric(frame[column], errors="coerce")
        frame = frame.dropna(subset=REQUIRED_COLUMNS)
        if frame.empty:
            print(f"Skipping {file_path.name}; no valid rows")
            continue
        # Dataset filenames begin with participant IDs (for example, D01/F08).
        frame["_subject"] = file_path.stem.split("_")[0]
        frames.append(frame)

    if not frames:
        raise ValueError(f"No CSVs in {DATASET_DIR} have the required sensor columns")

    dataset = pd.concat(frames, ignore_index=True)
    labels = sorted(dataset[TARGET_COLUMN].unique().tolist())
    if len(labels) != 2:
        raise ValueError(f"Expected two FallCheck labels, found {labels}")
    if dataset["_subject"].nunique() < 5:
        raise ValueError("At least five distinct participant groups are required")
    return dataset


def make_model() -> RandomForestClassifier:
    return RandomForestClassifier(
        n_estimators=200,
        max_depth=18,
        min_samples_leaf=2,
        class_weight="balanced_subsample",
        random_state=RANDOM_SEED,
        n_jobs=-1,
    )


def main() -> None:
    dataset = load_dataset()
    X = dataset[FEATURE_COLUMNS]
    encoder = LabelEncoder()
    y = encoder.fit_transform(dataset[TARGET_COLUMN].astype(str))
    groups = dataset["_subject"]

    splitter = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=RANDOM_SEED)
    train_indices, test_indices = next(splitter.split(X, y, groups))
    X_train, X_test = X.iloc[train_indices], X.iloc[test_indices]
    y_train, y_test = y[train_indices], y[test_indices]
    train_subjects = sorted(groups.iloc[train_indices].unique().tolist())
    test_subjects = sorted(groups.iloc[test_indices].unique().tolist())
    if set(train_subjects) & set(test_subjects):
        raise RuntimeError("Participant leakage detected between train and test sets")

    print(f"CSV files used: {dataset['_subject'].nunique()} participants")
    print(f"Rows: {len(dataset):,} total; {len(X_train):,} train; {len(X_test):,} held-out test")
    print(f"Training participants: {', '.join(train_subjects)}")
    print(f"Held-out participants: {', '.join(test_subjects)}")
    print("Label counts:", dataset[TARGET_COLUMN].value_counts().sort_index().to_dict())

    evaluation_model = make_model()
    print("Training evaluation model...")
    evaluation_model.fit(X_train, y_train)
    predictions = evaluation_model.predict(X_test)

    report = classification_report(
        y_test, predictions, labels=list(range(len(encoder.classes_)),),
        target_names=encoder.classes_.tolist(), output_dict=True, zero_division=0,
    )
    metrics = {
        "accuracy": float(accuracy_score(y_test, predictions)),
        "balanced_accuracy": float(balanced_accuracy_score(y_test, predictions)),
        "fall_precision": float(precision_score(y_test, predictions, pos_label=1, zero_division=0)),
        "fall_recall": float(recall_score(y_test, predictions, pos_label=1, zero_division=0)),
        "fall_f1": float(f1_score(y_test, predictions, pos_label=1, zero_division=0)),
        "confusion_matrix": confusion_matrix(y_test, predictions).tolist(),
    }
    print("Held-out metrics:", json.dumps(metrics, indent=2))
    print("Per-class report:", json.dumps(report, indent=2))

    # The test split above is kept untouched for evaluation. Refit a deployment
    # model on all labeled rows only after recording held-out performance.
    deployment_model = make_model()
    print("Refitting deployment model on all available rows...")
    deployment_model.fit(X, y)
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(deployment_model, MODEL_PATH)
    joblib.dump(encoder, LABEL_ENCODER_PATH)
    evaluation = {
        "dataset_directory": str(DATASET_DIR.relative_to(BACKEND_DIR)),
        "participants": int(dataset["_subject"].nunique()),
        "rows_total": int(len(dataset)),
        "rows_train": int(len(X_train)),
        "rows_test": int(len(X_test)),
        "train_participants": train_subjects,
        "test_participants": test_subjects,
        "features": FEATURE_COLUMNS,
        "classes": encoder.classes_.tolist(),
        "metrics": metrics,
        "classification_report": report,
        "model": "RandomForestClassifier",
        "prediction_threshold": 0.5,
        "model_parameters": deployment_model.get_params(),
        "artifacts": {
            "model": str(MODEL_PATH.relative_to(BACKEND_DIR)),
            "label_encoder": str(LABEL_ENCODER_PATH.relative_to(BACKEND_DIR)),
        },
    }
    REPORT_PATH.write_text(json.dumps(evaluation, indent=2), encoding="utf-8")
    print(f"Saved model: {MODEL_PATH}")
    print(f"Saved label encoder: {LABEL_ENCODER_PATH}")
    print(f"Saved evaluation report: {REPORT_PATH}")


if __name__ == "__main__":
    main()
