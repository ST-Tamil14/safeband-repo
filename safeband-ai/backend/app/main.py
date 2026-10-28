import atexit
import os
import subprocess
import sys
from datetime import datetime, timezone
from fastapi.middleware.cors import CORSMiddleware

from fastapi import FastAPI
from fastapi import HTTPException

from pydantic import BaseModel
from typing import Optional

# ── Simulator subprocess tracker ────────────────────────────────────────────
_simulator_process: subprocess.Popen | None = None

# ── Latest ML result cache (written by /fall/ml-process, read by /fall/latest)
_last_ml_result: dict | None = None

def _kill_simulator():
    """Kill the simulator subprocess if it is still running."""
    global _simulator_process
    if _simulator_process and _simulator_process.poll() is None:
        _simulator_process.terminate()
        try:
            _simulator_process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            _simulator_process.kill()
        _simulator_process = None

atexit.register(_kill_simulator)

from app.database import supabase
from app.schemas.schemas import ( SensorData, FallConfirmationRequest, NotificationRequest, FallProcessRequest,
)
from app.notification_history import (
    get_user_notifications,
    get_emergency_notifications,
    acknowledge_notification,
    resolve_notification,
)
from app.services.fall_service import detect_fall
from app.services.confirmation_service import confirm_fall
from app.services.severity_service import calculate_severity
from app.services.notification_service import create_notification
from app.fall_processor import process_fall_event
from app.fall_ml_detector import predict_fall
from app.services.activity_service import classify_activity


app = FastAPI(
    title="SafeBand AI Backend",
    description="AI-based fall detection and notification system",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://localhost:3000",
        ).split(",")
        if origin.strip()
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ActivityRequest(BaseModel):
    user_id: str

    adxl_acc_x: float
    adxl_acc_y: float
    adxl_acc_z: float

    itg_gyro_x: float
    itg_gyro_y: float
    itg_gyro_z: float

@app.get("/")
def root():
    return {
        "message": "SafeBand AI backend is running",
        "status": "success",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
    }


@app.get("/database-test")
def database_test():
    response = (
        supabase
        .table("sensor_readings")
        .select("*")
        .limit(5)
        .execute()
    )

    return {
        "status": "success",
        "records": response.data,
    }


@app.post("/sensor/data")
def receive_sensor_data(sensor: SensorData):
    sensor_data = sensor.model_dump()

    # Convert datetime to a JSON-compatible ISO string
    if sensor_data["recorded_at"] is None:
        sensor_data["recorded_at"] = datetime.now(
            timezone.utc
        ).isoformat()
    else:
        sensor_data["recorded_at"] = (
            sensor_data["recorded_at"].isoformat()
        )

    response = (
        supabase
        .table("sensor_readings")
        .insert(sensor_data)
        .execute()
    )

    return {
        "status": "success",
        "message": "Sensor data saved successfully",
        "record": response.data,
    }

@app.post("/fall/detect")
def detect_fall_from_sensor(sensor: SensorData):
    result = detect_fall(
        acc_x=sensor.adxl_acc_x,
        acc_y=sensor.adxl_acc_y,
        acc_z=sensor.adxl_acc_z,
        gyro_x=sensor.itg_gyro_x,
        gyro_y=sensor.itg_gyro_y,
        gyro_z=sensor.itg_gyro_z,
    )

    return {
        "status": "success",
        "sensor_data": sensor.model_dump(mode="json"),
        "fall_analysis": result,
    }

@app.post("/fall/confirm")
def confirm_possible_fall(request: FallConfirmationRequest):
    detection_result = detect_fall(
        acc_x=request.sensor.adxl_acc_x,
        acc_y=request.sensor.adxl_acc_y,
        acc_z=request.sensor.adxl_acc_z,
        gyro_x=request.sensor.itg_gyro_x,
        gyro_y=request.sensor.itg_gyro_y,
        gyro_z=request.sensor.itg_gyro_z,
    )

    confirmation_result = confirm_fall(
        fall_probability=detection_result["fall_probability"],
        inactivity_seconds=request.inactivity_seconds,
        user_response=request.user_response,
    )

    return {
        "status": "success",
        "detection": detection_result,
        "confirmation": confirmation_result,
        "sensor_data": request.sensor.model_dump(mode="json"),
    }

@app.post("/fall/severity")
def calculate_fall_severity(request: FallConfirmationRequest):
    detection_result = detect_fall(
        acc_x=request.sensor.adxl_acc_x,
        acc_y=request.sensor.adxl_acc_y,
        acc_z=request.sensor.adxl_acc_z,
        gyro_x=request.sensor.itg_gyro_x,
        gyro_y=request.sensor.itg_gyro_y,
        gyro_z=request.sensor.itg_gyro_z,
    )

    confirmation_result = confirm_fall(
        fall_probability=detection_result["fall_probability"],
        inactivity_seconds=request.inactivity_seconds,
        user_response=request.user_response,
    )

    severity_result = calculate_severity(
        fall_probability=detection_result["fall_probability"],
        acceleration_magnitude=detection_result[
            "acceleration_magnitude"
        ],
        inactivity_seconds=request.inactivity_seconds,
        heart_rate=request.sensor.heart_rate,
        spo2=request.sensor.spo2,
        latitude=request.sensor.latitude,
        longitude=request.sensor.longitude,
    )

    return {
        "status": "success",
        "detection": detection_result,
        "confirmation": confirmation_result,
        "severity": severity_result,
        "sensor_data": request.sensor.model_dump(mode="json"),
    }

@app.post("/notifications/send")
async def send_notification(request: NotificationRequest):
    return await create_notification(
        user_id=request.user_id,
        notification_type=request.notification_type,
        recipient=request.recipient,
        message=request.message,
        severity=request.severity,
        risk_score=request.risk_score,
        latitude=request.latitude,
        longitude=request.longitude,
    )

@app.post("/fall/process")
async def process_fall(request: FallProcessRequest):
    return await process_fall_event(
        sensor=request.sensor,
        inactivity_seconds=request.inactivity_seconds,
        user_response=request.user_response,
    )

@app.post("/fall/ml-detect")
def ml_fall_detection(sensor: SensorData):
    try:
        # The schema accepts both ADXL345 names and common acc_* aliases.
        adxl_acc_x = sensor.adxl_acc_x
        adxl_acc_y = sensor.adxl_acc_y
        adxl_acc_z = sensor.adxl_acc_z

        # Use MMA8451Q values when available.
        # Otherwise, reuse the ADXL345/common accelerometer values.
        mma_acc_x = (
            sensor.mma_acc_x
            if sensor.mma_acc_x is not None
            else adxl_acc_x
        )

        mma_acc_y = (
            sensor.mma_acc_y
            if sensor.mma_acc_y is not None
            else adxl_acc_y
        )

        mma_acc_z = (
            sensor.mma_acc_z
            if sensor.mma_acc_z is not None
            else adxl_acc_z
        )

        result = predict_fall(
    adxl_acc_x=adxl_acc_x,
    adxl_acc_y=adxl_acc_y,
    adxl_acc_z=adxl_acc_z,
    gyro_x=sensor.itg_gyro_x,
    gyro_y=sensor.itg_gyro_y,
    gyro_z=sensor.itg_gyro_z,
    mma_acc_x=mma_acc_x,
    mma_acc_y=mma_acc_y,
    mma_acc_z=mma_acc_z,
)

        return {
            "user_id": sensor.user_id,
            "ml_result": result,
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"ML prediction failed: {str(error)}",
        )

@app.post("/fall/ml-process")
async def ml_fall_process(request: FallProcessRequest):
    sensor = request.sensor

    try:
        # The schema accepts both ADXL345 names and common acc_* aliases.
        adxl_acc_x = sensor.adxl_acc_x
        adxl_acc_y = sensor.adxl_acc_y
        adxl_acc_z = sensor.adxl_acc_z

        # MMA8451Q accelerometer fallback
        mma_acc_x = (
            sensor.mma_acc_x
            if sensor.mma_acc_x is not None
            else adxl_acc_x
        )

        mma_acc_y = (
            sensor.mma_acc_y
            if sensor.mma_acc_y is not None
            else adxl_acc_y
        )

        mma_acc_z = (
            sensor.mma_acc_z
            if sensor.mma_acc_z is not None
            else adxl_acc_z
        )

        # 1. Activity recognition
        activity_result = classify_activity(
    acc_x=adxl_acc_x,
    acc_y=adxl_acc_y,
    acc_z=adxl_acc_z,
    gyro_x=sensor.itg_gyro_x,
    gyro_y=sensor.itg_gyro_y,
    gyro_z=sensor.itg_gyro_z,
)

        # 2. ML fall detection
        ml_result = predict_fall(
    adxl_acc_x=adxl_acc_x,
    adxl_acc_y=adxl_acc_y,
    adxl_acc_z=adxl_acc_z,
    gyro_x=sensor.itg_gyro_x,
    gyro_y=sensor.itg_gyro_y,
    gyro_z=sensor.itg_gyro_z,
    mma_acc_x=mma_acc_x,
    mma_acc_y=mma_acc_y,
    mma_acc_z=mma_acc_z,
)

        # 3. Fall confirmation
        confirmation_result = confirm_fall(
            fall_probability=ml_result["fall_probability"],
            inactivity_seconds=request.inactivity_seconds,
            user_response=request.user_response,
        )

        # 4. Acceleration magnitude
        acceleration_magnitude = (
            adxl_acc_x**2
            + adxl_acc_y**2
            + adxl_acc_z**2
        ) ** 0.5

        # 5. Fall severity
        severity_result = calculate_severity(
            fall_probability=ml_result["fall_probability"],
            acceleration_magnitude=acceleration_magnitude,
            inactivity_seconds=request.inactivity_seconds,
            heart_rate=sensor.heart_rate,
            spo2=sensor.spo2,
            latitude=sensor.latitude,
            longitude=sensor.longitude,
        )

        # 6. Emergency notification
        notification_result = None

        if (
            ml_result["model_detected_fall"]
            and confirmation_result["confirmed"]
        ):
            message = (
                f"Confirmed {severity_result['severity']}-risk fall "
                f"detected for user {sensor.user_id}. "
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

        result = {
            "success": True,
            "user_id": sensor.user_id,
            "activity": activity_result,
            "ml_detection": ml_result,
            "confirmation": confirmation_result,
            "severity": severity_result,
            "notification": notification_result,
            # Echo sensor values so the frontend can display raw readings
            "sensor": {
                "adxl_acc_x": adxl_acc_x, "adxl_acc_y": adxl_acc_y, "adxl_acc_z": adxl_acc_z,
                "itg_gyro_x": sensor.itg_gyro_x, "itg_gyro_y": sensor.itg_gyro_y, "itg_gyro_z": sensor.itg_gyro_z,
                "mma_acc_x": mma_acc_x, "mma_acc_y": mma_acc_y, "mma_acc_z": mma_acc_z,
                "heart_rate": sensor.heart_rate, "spo2": sensor.spo2,
                "sugar_level": getattr(sensor, 'sugar_level', None),
                "latitude": sensor.latitude, "longitude": sensor.longitude,
            },
        }

        # Cache the result so GET /fall/latest can serve it
        global _last_ml_result
        _last_ml_result = result

        return result

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"ML fall processing failed: {str(error)}",
        )


@app.get("/fall/latest")
def get_latest_result():
    """Return the most recent result from /fall/ml-process.

    The frontend polls this endpoint to display live data without
    triggering the ML pipeline itself — only simulator.py should do that.
    Returns 204 No Content when no data has been processed yet.
    """
    if _last_ml_result is None:
        from fastapi.responses import Response
        return Response(status_code=204)
    return _last_ml_result

@app.get("/notifications/{user_id}/emergency")
def emergency_notification_history(user_id: str):
    try:
        notifications = get_emergency_notifications(user_id)

        return {
            "success": True,
            "user_id": user_id,
            "count": len(notifications),
            "notifications": notifications,
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to retrieve emergency notifications: {str(error)}",
        )

@app.patch("/notifications/{notification_id}/acknowledge")
def acknowledge_alert(notification_id: int):
    try:
        notifications = acknowledge_notification(notification_id)

        if not notifications:
            raise HTTPException(
                status_code=404,
                detail="Notification not found",
            )

        return {
            "success": True,
            "message": "Notification acknowledged successfully",
            "notification": notifications[0],
        }

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to acknowledge notification: {str(error)}",
        )

@app.patch("/notifications/{notification_id}/resolve")
def resolve_alert(notification_id: int):
    try:
        notifications = resolve_notification(notification_id)

        if not notifications:
            raise HTTPException(
                status_code=404,
                detail="Notification not found",
            )

        return {
            "success": True,
            "message": "Notification resolved successfully",
            "notification": notifications[0],
        }

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to resolve notification: {str(error)}",
        )

@app.post("/activity/classify")
def classify_user_activity(data: ActivityRequest):
    try:
        result = classify_activity(
            acc_x=data.adxl_acc_x,
            acc_y=data.adxl_acc_y,
            acc_z=data.adxl_acc_z,
            gyro_x=data.itg_gyro_x,
            gyro_y=data.itg_gyro_y,
            gyro_z=data.itg_gyro_z,
        )

        return {
            "success": True,
            "user_id": data.user_id,
            "activity_result": result,
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Activity classification failed: {str(error)}",
        )


# ── Simulator control endpoints ──────────────────────────────────────────────

@app.post("/simulator/start")
def simulator_start():
    """Launch simulator.py as a background subprocess."""
    global _simulator_process

    # Already running — return current status.
    if _simulator_process and _simulator_process.poll() is None:
        return {
            "success": True,
            "running": True,
            "message": "Simulator is already running",
            "pid": _simulator_process.pid,
        }

    # Locate simulator.py relative to this file's parent directory.
    # main.py lives at  <project>/app/main.py
    # simulator.py lives at  <project>/simulator.py
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    simulator_path = os.path.join(project_root, "simulator.py")

    if not os.path.isfile(simulator_path):
        raise HTTPException(
            status_code=500,
            detail=f"simulator.py not found at {simulator_path}",
        )

    try:
        _simulator_process = subprocess.Popen(
            [sys.executable, simulator_path],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return {
            "success": True,
            "running": True,
            "message": "Simulator started",
            "pid": _simulator_process.pid,
        }
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start simulator: {str(error)}",
        )


@app.post("/simulator/stop")
def simulator_stop():
    """Terminate the running simulator subprocess."""
    global _simulator_process

    if not _simulator_process or _simulator_process.poll() is not None:
        _simulator_process = None
        return {
            "success": True,
            "running": False,
            "message": "Simulator is not running",
        }

    pid = _simulator_process.pid
    _kill_simulator()

    return {
        "success": True,
        "running": False,
        "message": f"Simulator stopped (was PID {pid})",
    }


@app.get("/simulator/status")
def simulator_status():
    """Return whether the simulator subprocess is currently running."""
    global _simulator_process
    running = bool(_simulator_process and _simulator_process.poll() is None)
    return {
        "success": True,
        "running": running,
        "pid": _simulator_process.pid if running else None,
    }
