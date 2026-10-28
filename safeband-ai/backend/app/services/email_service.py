"""Optional caregiver email delivery; credentials are never logged."""

import os
from email.message import EmailMessage
from pathlib import Path

import aiosmtplib
from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BACKEND_DIR / ".env")

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
CAREGIVER_EMAIL = os.getenv("CAREGIVER_EMAIL")


async def send_emergency_email(
    user_id: str,
    message: str,
    severity: str,
    risk_score: int,
    latitude: float | None = None,
    longitude: float | None = None,
) -> dict:
    if not all((SMTP_USERNAME, SMTP_PASSWORD, CAREGIVER_EMAIL)):
        return {"success": False, "status": "email_not_configured", "recipient": None}

    email = EmailMessage()
    email["From"] = SMTP_USERNAME
    email["To"] = CAREGIVER_EMAIL
    email["Subject"] = f"SafeBand AI Emergency Alert - {severity.upper()} Risk"
    location_text = "Unavailable"
    if latitude is not None and longitude is not None:
        location_text = f"Latitude: {latitude}\nLongitude: {longitude}"
    email.set_content(
        f"SafeBand AI Emergency Alert\n\nUser ID: {user_id}\nSeverity: {severity}\n"
        f"Risk Score: {risk_score}/100\n\nMessage:\n{message}\n\n"
        f"Location:\n{location_text}\n\nThis is an automated prototype notification.\n"
    )

    await aiosmtplib.send(
        email,
        hostname=SMTP_HOST,
        port=SMTP_PORT,
        start_tls=True,
        username=SMTP_USERNAME,
        password=SMTP_PASSWORD,
    )
    return {"success": True, "status": "email_sent", "recipient": CAREGIVER_EMAIL}
