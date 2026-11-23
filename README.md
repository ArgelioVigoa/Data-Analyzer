# Data Analyzer

Data Analyzer is a scientific-data workspace designed to connect experimental data inspection, classical analysis, scientific problem formulation, literature discovery and (in later stages) quantum-computing workflows.

## Frontend
The current public GitHub Pages application is a static frontend. Serve the repository with a static HTTP server for local development. Run frontend checks with `npm test` and `npm run check`.

## Python backend
A FastAPI backend is provided in `backend/`. See [backend/README.md](backend/README.md) for setup, endpoints, API behavior and limitations. The API includes file analysis, scientific-problem records, quantum algorithm metadata and heuristic candidate matching, literature metadata search (OpenAlex/Crossref/arXiv), comparison records and PDF report export.

### Local backend run
```bash
cd backend
python -m venv .venv
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Interactive API documentation: `http://localhost:8000/docs`.

## Important capability boundaries
- GitHub Pages hosts only the frontend. The Python API must be deployed separately.
- This backend is code-ready for local execution and a free-tier deployment blueprint is included, but it is not yet a live hosted API.
- Uploaded files are processed in memory and discarded after analysis.
- Scientific problem and comparison records currently live in process memory and disappear when the server restarts. Durable database storage and authentication are production-hardening tasks.
- Quantum algorithms are catalogued and preliminarily matched by transparent keyword heuristics. No Qiskit execution or quantum advantage is claimed.
- No AI model is integrated yet.

## Development branch
Current work is being developed on `architecture/modular-refactor`; `main` is kept separate.
