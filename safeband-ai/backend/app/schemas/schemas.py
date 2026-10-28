from datetime import datetime
from typing import Optional

from pydantic import AliasChoices, BaseModel, Field


class SensorData(BaseModel):
    user_id: str

    adxl_acc_x: float = Field(
        validation_alias=AliasChoices("adxl_acc_x", "acc_x")
    )
    adxl_acc_y: float = Field(
        validation_alias=AliasChoices("adxl_acc_y", "acc_y")
    )
    adxl_acc_z: float = Field(
        validation_alias=AliasChoices("adxl_acc_z", "acc_z")
    )

    itg_gyro_x: float = Field(
        validation_alias=AliasChoices("itg_gyro_x", "gyro_x")
    )
    itg_gyro_y: float = Field(
        validation_alias=AliasChoices("itg_gyro_y", "gyro_y")
    )
    itg_gyro_z: float = Field(
        validation_alias=AliasChoices("itg_gyro_z", "gyro_z")
    )

    mma_acc_x: float | None = None
    mma_acc_y: float | None = None
    mma_acc_z: float | None = None

    heart_rate: float | None = None
    spo2: float | None = None
    sugar_level: float | None = None

    latitude: float | None = None
    longitude: float | None = None

    recorded_at: datetime | None = None

class FallConfirmationRequest(BaseModel):
    sensor: SensorData

    inactivity_seconds: float = Field(
        default=0,
        ge=0,
        description="Duration without movement after possible fall",
    )

    user_response: Optional[str] = Field(
        default=None,
        description="confirmed, cancelled, or no_response",
    )

class NotificationRequest(BaseModel):
    user_id: str
    notification_type: str = "emergency_alert"
    recipient: str | None = None

    message: str

    severity: str | None = None
    risk_score: int | None = None

    latitude: float | None = None
    longitude: float | None = None

class FallProcessRequest(BaseModel):
    sensor: SensorData

    inactivity_seconds: float = Field(
        default=0,
        ge=0,
    )

    user_response: Optional[str] = None
