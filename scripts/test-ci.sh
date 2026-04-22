#!/usr/bin/env bash
set -euo pipefail

echo "[test-ci] Running standard Vitest suites"
TEST_RESULTS_DIR="${TEST_RESULTS_DIR:-artifacts/test-results}"
mkdir -p "$TEST_RESULTS_DIR"
# Run in single-worker mode to reduce worker RPC timeout flakes.
pnpm vitest run --maxWorkers=1 --exclude src/commands/ci-migrate.test.ts --reporter=default --reporter=junit --outputFile.junit="$TEST_RESULTS_DIR/junit-standard.xml"

echo "[test-ci] Running ci-migrate suite with known Vitest worker-timeout mitigation"
pnpm vitest run --maxWorkers=1 src/commands/ci-migrate.test.ts --reporter=default --reporter=junit --outputFile.junit="$TEST_RESULTS_DIR/junit-ci-migrate.xml"
