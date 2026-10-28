from app.services.fall_service import detect_fall
from app.services.confirmation_service import confirm_fall
from app.services.severity_service import calculate_severity
from app.services.notification_service import create_notification


async def process_fall_event(
    sensor,
    inactivity_seconds: float = 0,
    user_response: str | None = None,
) -> dict:
    detection_result = detect_fall(
        acc_x=sensor.adxl_acc_x,
        acc_y=sensor.adxl_acc_y,
        acc_z=sensor.adxl_acc_z,
        gyro_x=sensor.itg_gyro_x,
        gyro_y=sensor.itg_gyro_y,
        gyro_z=sensor.itg_gyro_z,
    )

    confirmation_result = confirm_fall(
        fall_probability=detection_result["fall_probability"],
        inactivity_seconds=inactivity_seconds,
        user_response=user_response,
    )

    severity_result = calculate_severity(
        fall_probability=detection_result["fall_probability"],
        acceleration_magnitude=detection_result[
            "acceleration_magnitude"
        ],
        inactivity_seconds=inactivity_seconds,
        heart_rate=sensor.heart_rate,
        spo2=sensor.spo2,
        latitude=sensor.latitude,
        longitude=sensor.longitude,
    )

    notification_result = None

    if confirmation_result["confirmed"]:
        message = (
            f"Confirmed {severity_result['severity']}-risk fall detected "
            f"for user {sensor.user_id}. "
            f"Risk score: {severity_result['risk_score']}."
        )

        notification_result = await create_notification(
            user_id=sensor.user_id,
            notification_type="emergency_alert",
            recipient="caregiver",
            message=message,
            severity=severity_result["severity"],
            risk_score=severity_result["risk_score"],
            latitude=sensor.latitude,
            longitude=sensor.longitude,
        )

    return {
        "user_id": sensor.user_id,
        "detection": detection_result,
        "confirmation": confirmation_result,
        "severity": severity_result,
        "notification": notification_result,
    }
