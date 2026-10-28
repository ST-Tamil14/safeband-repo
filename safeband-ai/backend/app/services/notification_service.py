from datetime import datetime, timezone

from app.database import supabase
from app.services.email_service import send_emergency_email


async def create_notification(
    user_id: str,
    notification_type: str,
    message: str,
    recipient: str | None = None,
    severity: str | None = None,
    risk_score: int | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
) -> dict:
    notification_data = {
        "user_id": user_id,
        "notification_type": notification_type,
        "recipient": recipient,
        "message": message,
        "severity": severity,
        "risk_score": risk_score,
        "latitude": latitude,
        "longitude": longitude,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    database_response = (
        supabase
        .table("notifications")
        .insert(notification_data)
        .execute()
    )

    try:
        email_result = await send_emergency_email(
            user_id=user_id,
            message=message,
            severity=severity or "unknown",
            risk_score=risk_score or 0,
            latitude=latitude,
            longitude=longitude,
        )
    except Exception as error:
        # Keep the recorded alert even if the optional SMTP service is down.
        email_result = {
            "success": False,
            "status": "email_failed",
            "error": type(error).__name__,
        }

    return {
        "success": True,
        "status": "alert_recorded",
        "message": message,
        "notification": database_response.data,
        "email": email_result,
    }
