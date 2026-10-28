"""SafeBand fall prediction using artifacts produced by training/train_fall_model.py."""

from functools import lru_cache
from pathlib import Path

import joblib
import pandas as pd


BACKEND_DIR = Path(__file__).resolve().parents[1]
MODEL_PATH = BACKEND_DIR / "models" / "fall_detection_model.joblib"
ENCODER_PATH = BACKEND_DIR / "models" / "fall_label_encoder.joblib"
# Match RandomForest's default binary decision boundary used by evaluation.
FALL_CONFIDENCE_THRESHOLD = 0.5

FEATURE_COLUMNS = [
    "ADXL345_Acc_X", "ADXL345_Acc_Y", "ADXL345_Acc_Z",
    "ITG3200_Gyro_X", "ITG3200_Gyro_Y", "ITG3200_Gyro_Z",
    "MMA8451Q_Acc_X", "MMA8451Q_Acc_Y", "MMA8451Q_Acc_Z",
]


@lru_cache(maxsize=1)
def _load_artifacts():
    missing = [str(path) for path in (MODEL_PATH, ENCODER_PATH) if not path.is_file()]
    if missing:
        raise RuntimeError(
            "Fall model artifacts are missing. Train the model first with: "
            "python training/train_fall_model.py"
        )
    model = joblib.load(MODEL_PATH)
    # Prediction is only one sensor sample at a time, so parallel worker
    # startup adds overhead and can fail in restricted Windows environments.
    model.set_params(n_jobs=1)
    return model, joblib.load(ENCODER_PATH)


def is_fall_label(label: str) -> bool:
    return str(label).strip().lower() in {"1", "fall", "fallen", "true", "yes"}


def predict_fall(
    adxl_acc_x: float,
    adxl_acc_y: float,
    adxl_acc_z: float,
    gyro_x: float,
    gyro_y: float,
    gyro_z: float,
    mma_acc_x: float,
    mma_acc_y: float,
    mma_acc_z: float,
) -> dict:
    model, label_encoder = _load_artifacts()
    input_data = pd.DataFrame(
        [[adxl_acc_x, adxl_acc_y, adxl_acc_z, gyro_x, gyro_y, gyro_z,
          mma_acc_x, mma_acc_y, mma_acc_z]],
        columns=FEATURE_COLUMNS,
    )
    prediction_id = model.predict(input_data)[0]
    predicted_label = str(label_encoder.inverse_transform([prediction_id])[0])
    probabilities = model.predict_proba(input_data)[0]
    predicted_confidence = float(max(probabilities))
    fall_index = next(
        (index for index, label in enumerate(label_encoder.classes_) if is_fall_label(label)),
        None,
    )
    fall_probability = float(probabilities[fall_index]) if fall_index is not None else 0.0
    model_detected_fall = is_fall_label(predicted_label)
    fall_detected = fall_probability >= FALL_CONFIDENCE_THRESHOLD

    return {
        "prediction": predicted_label,
        "confidence": round(predicted_confidence, 4),
        "fall_probability": round(fall_probability, 4),
        "fall_detected": fall_detected,
        "model_detected_fall": model_detected_fall,
        "confidence_threshold": FALL_CONFIDENCE_THRESHOLD,
        "status": "fall_detected" if fall_detected else "possible_fall_or_normal_activity",
    }
