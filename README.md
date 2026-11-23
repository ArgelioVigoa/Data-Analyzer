# Data Analyzer

Scientific-data workspace for importing and inspecting experimental data, organizing scientific problems, discovering literature and progressively developing classical/quantum computing workflows.

## Application
The static frontend is published through GitHub Pages: https://argeliovigoa.github.io/Data-Analyzer/

## Python API
The FastAPI backend is in [backend/](backend/). It now includes PostgreSQL persistence, account registration and JWT login, account-isolated data, upload validation, rate limits, CORS/host restrictions, literature metadata search and PDF report export.

Read [backend/README.md](backend/README.md) for local setup and deployment. A Render Blueprint is provided at [backend/render.yaml](backend/render.yaml).

## Deployment status
The backend code and deployment blueprint are committed on `architecture/modular-refactor`. A public API is not considered deployed until a hosting provider has been connected, the private PostgreSQL connection string configured, and the health endpoint verified. The frontend remains a static site and must be connected to the API in a subsequent integration step.

## Important capability boundaries
- The original uploaded files are not retained; analysis metadata/results are stored in PostgreSQL.
- Quantum algorithm entries are candidates only; Qiskit execution is not implemented.
- AI is not integrated yet.
- Free hosting/database plans have sleep, inactivity, capacity and backup limitations. Keep independent backups of important research data.
