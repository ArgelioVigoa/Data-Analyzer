# Data Analyzer Backend

FastAPI service for scientific file inspection, exploratory statistics, scientific-problem records, quantum-algorithm capability metadata, literature metadata search, comparison records and PDF report export.

## Run locally

Python 3.10+ is recommended.

```bash
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Open `http://localhost:8000/docs` for interactive API documentation.

## Endpoints

- `GET /health`
- `POST /api/v1/files/analyze` — multipart upload: CSV, TSV, XLSX, XLS, JSON.
- `POST /api/v1/problems`, `GET /api/v1/problems/{id}`
- `GET /api/v1/quantum/algorithms`
- `POST /api/v1/quantum/recommend`
- `POST /api/v1/research/search` — OpenAlex, Crossref, arXiv.
- `POST /api/v1/comparisons`, `GET /api/v1/comparisons/{id}`
- `POST /api/v1/reports/pdf`

## Capability boundaries and deployment notes

- Uploaded files are size-limited and processed in memory; no file is retained.
- Problem and comparison records are currently in process memory. They disappear on restart and are not shared across multiple server workers. Add a database before multi-user production deployment.
- Literature results are metadata discovery, not a guarantee that a paper is relevant or freely accessible. Always verify DOI, authors and publication details.
- Quantum algorithms are listed and matched using transparent keyword heuristics only. This version does not run Qiskit circuits, prove mathematical suitability, or claim quantum advantage.
- No AI model is included yet.
- Configure `FRONTEND_ORIGINS` with the exact frontend origins before public deployment.
- For public multi-user deployment, add authentication, rate limiting, durable storage, quotas and observability.
