# Data Analyzer

Modularization branch preserving the existing browser prototype while introducing independently testable scientific modules.

## Run
Serve this directory with a static HTTP server and open `index.html`. Run core tests with Node.js 18+: `npm test`; syntax checks: `npm run check`.

## Layout
- `index.html`: document shell.
- `assets/app.css`: visual styles.
- `assets/legacy-app.js`: original UI logic retained as a compatibility layer during migration.
- `src/core`: transient state management.
- `src/io`: input-format parsers.
- `src/analysis`: pure statistical functions.
- `src/quantum`: algorithm capability metadata.
- `src/services`: future backend HTTP adapter.
- `tests`: core module tests.

## Honest capability boundaries
VQE, QAOA, QAE and Grover are currently catalogue entries, not executable algorithms. The backend client is an integration boundary; it does not mean a Python/Qiskit service is deployed. Imported data remains temporary in browser memory unless a persistence adapter is deliberately added.

## Migration
The original script is preserved intact to avoid losing features. Migrate one responsibility at a time into tested modules; remove the compatibility layer only after the old responsibilities have been replaced.
