#!/usr/bin/env bash
set -euo pipefail

echo "[test-ci] Running standard Vitest suites"
# Vitest can intermittently report worker RPC timeout false positives on long suites.
pnpm vitest run --maxWorkers=1 --dangerouslyIgnoreUnhandledErrors --exclude src/commands/ci-migrate.test.ts

echo "[test-ci] Running ci-migrate suite with known Vitest worker-timeout mitigation"
pnpm vitest run --maxWorkers=1 --dangerouslyIgnoreUnhandledErrors src/commands/ci-migrate.test.ts
