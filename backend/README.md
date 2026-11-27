# Data Analyzer Backend

FastAPI backend for scientific data inspection, account-isolated datasets, scientific problem records, quantum-method candidate metadata, literature metadata search and PDF export.

## Local setup

Python 3.11+:

```bash
cd backend
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Open `http://localhost:8000/docs`. Local development defaults to SQLite. Set `DATABASE_URL` to PostgreSQL to test the production database path.

## Authentication and API usage

1. Register: `POST /api/v1/auth/register` with JSON `{"email":"you@example.org","password":"at-least-10-characters"}`.
2. Login: `POST /api/v1/auth/token` using form fields `username` (the email) and `password`.
3. Send `Authorization: Bearer <access_token>` on private endpoints.

Passwords are hashed with Argon2. Access tokens are signed JWTs and expire after 60 minutes. Dataset, problem and comparison records are isolated by account. The original uploaded file is discarded after processing; its analysis result and metadata are stored in PostgreSQL.

## Endpoints

- `GET /health` — checks database connectivity.
- `POST /api/v1/auth/register`, `POST /api/v1/auth/token`.
- `POST /api/v1/files/analyze` — authenticated multipart upload: CSV, TSV, XLSX, XLS, JSON.
- `GET /api/v1/datasets`, `GET /api/v1/datasets/{id}`.
- `POST /api/v1/problems`, `GET /api/v1/problems`, `GET /api/v1/problems/{id}`.
- `GET /api/v1/quantum/algorithms`, `POST /api/v1/quantum/recommend`.
- `POST /api/v1/research/search`.
- `POST /api/v1/comparisons`, `GET /api/v1/comparisons`, `GET /api/v1/comparisons/{id}`.
- `POST /api/v1/reports/pdf`.

## Security controls

- Argon2 password hashing; signed, expiring JWT access tokens.
- Authenticated, account-scoped access to user datasets, problems, comparisons, research and report generation.
- Per-IP rate limits for registration, login, uploads and literature search.
- Strict CORS origin allowlist and TrustedHost validation.
- Upload extension allowlist, 25 MB default cap, row/column limits and server-generated dataset IDs.
- Response security headers and no-store for API responses.
- No API secret is embedded in the browser frontend.

Rate limits currently use in-process memory storage. For multiple API instances, replace this with a shared Redis-compatible limiter store. Add email verification, password reset, audit logs and a formal retention policy before opening registration to a broad public audience.

## Persistent database

Set `DATABASE_URL` to a PostgreSQL connection string. The app normalizes standard PostgreSQL URLs to psycopg 3. Tables are created on service startup for this initial schema. Use a versioned Alembic migration workflow before changing deployed schemas.

A free Supabase project can provide managed PostgreSQL for a prototype (500 MB on the current published Free pricing; projects can pause after a week of inactivity and backups are not included). Export database backups regularly. Do not use Render's free PostgreSQL for long-lived records: Render documents that its free databases expire after 30 days.

## Render deployment

1. Create a Supabase project and copy its PostgreSQL connection string (use the provider's recommended connection/pooler URI; keep the password private).
2. In Render, choose **New → Blueprint**, connect this repository and select branch `architecture/modular-refactor`. Blueprint file: `backend/render.yaml`.
3. Confirm the service is named `data-analyzer-api`. In its environment, set `DATABASE_URL` to the Supabase PostgreSQL URI. Render generates `JWT_SECRET_KEY`; keep it private.
4. Deploy. Render provides a public `onrender.com` URL. Verify `/health` returns `{"status":"ok","database":"connected",...}` and open `/docs`.
5. If you use a different frontend domain, update `FRONTEND_ORIGINS` to that exact origin.

Free Render web services sleep after 15 minutes without traffic and may take about a minute to wake. This is a prototype hosting path, not an uptime guarantee. Never commit database URLs, JWT secrets or credentials.

## Current scientific limitations

The quantum registry is descriptive and preliminary matching is heuristic. No Qiskit circuits are run, no quantum advantage is established, and classical-vs-quantum results must come from measured validated runs. Literature search returns metadata, not a guarantee of full-text access or relevance.
