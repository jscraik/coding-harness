---
last_validated: 2026-04-18
---

# Flaky test artifacts

## Flaky Test Artifact Capture
- Run `bash scripts/test-with-artifacts.sh all` (or `pnpm run test:artifacts`) to emit machine-readable flaky evidence under `artifacts/test`.
- Optional targeted modes:
  - `bash scripts/test-with-artifacts.sh unit`
  - `bash scripts/test-with-artifacts.sh integration`
  - `bash scripts/test-with-artifacts.sh e2e`
- Commit/retain stable artifact paths for local automation ingestion:
  - `artifacts/test/summary-*.json`
  - `artifacts/test/test-output-*.log`
  - `artifacts/test/junit-*.xml` (when supported by test runner)
  - `artifacts/test/*-results.json` (when supported by test runner)
  - `artifacts/test/artifact-manifest.json`
- Keep artifact filenames stable (no timestamps in filenames) so recurring flake scans can compare runs.
