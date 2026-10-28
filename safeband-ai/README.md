# SafeBand AI

SafeBand AI is a prototype fall detection app with a React dashboard, FastAPI backend, a participant-held-out fall classification model, sensor simulator, and Supabase storage for readings and alerts.

## Windows setup

Open PowerShell in `safeband-ai`.

### Backend

```powershell
cd .\backend
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirement.txt
Copy-Item .env.example .env
```

Edit `backend/.env` and set `SUPABASE_URL` and `SUPABASE_SECRET_KEY`. Use a server-side `sb_secret_...` key; never put it in the frontend. Set `CORS_ORIGINS` to the comma-separated frontend origins (keep the localhost defaults for local development). Run `backend/sql/schema.sql` once in Supabase Dashboard > SQL Editor to create the tables.

Train and evaluate the fall model, then start the API:

```powershell
python training/train_fall_model.py
python -m uvicorn app.main:app --reload
```

The training script reads `backend/datasets/*.csv`, holds out entire participant IDs for evaluation, saves the deployment model and label encoder under `backend/models`, and writes `backend/models/fall_model_evaluation.json`.

### Frontend

In another PowerShell window, from `safeband-ai`:

```powershell
cd .\frontend
npm ci
npm run dev
```

The frontend uses `http://localhost:8000` by default. Set `VITE_API_BASE_URL` in `frontend/.env` only if the API runs elsewhere. Never put the Supabase secret key in the frontend.

## Optional email alerts

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, and `CAREGIVER_EMAIL` in the backend `.env`. If SMTP is not configured, the alert is still recorded in Supabase and the API reports `email_not_configured`.

## Useful commands

```powershell
# Backend API docs
Start-Process http://localhost:8000/docs

# Frontend production build and lint
cd .\frontend
npm run build
npm run lint
```

The model evaluation uses one participant-grouped fold and is a project-level estimate, not clinical validation. The current app is a prototype and should not be relied on as a medical emergency system.
