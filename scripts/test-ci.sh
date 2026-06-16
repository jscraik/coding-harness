#!/usr/bin/env bash
set -euo pipefail

echo "[test-ci] Running standard Vitest suites"
TEST_RESULTS_DIR="${TEST_RESULTS_DIR:-artifacts/test-results}"
mkdir -p "$TEST_RESULTS_DIR"

run_with_heartbeat() {
	local label="$1"
	shift
	local heartbeat_interval="${TEST_CI_HEARTBEAT_INTERVAL_SECONDS:-60}"
	"$@" &
	local command_pid="$!"
	while kill -0 "$command_pid" 2>/dev/null; do
		sleep "$heartbeat_interval" &
		local sleep_pid="$!"
		wait "$sleep_pid" || true
		if kill -0 "$command_pid" 2>/dev/null; then
			echo "[test-ci] still running: $label"
		fi
	done
	wait "$command_pid"
}

# Vitest can intermittently report worker RPC timeout false positives on long suites.
run_with_heartbeat "standard Vitest suites" pnpm vitest run --maxWorkers=1 --exclude src/commands/ci-migrate.test.ts --reporter=default --reporter=junit --outputFile.junit="$TEST_RESULTS_DIR/junit-standard.xml"

echo "[test-ci] Running ci-migrate suite with known Vitest worker-timeout mitigation"
run_with_heartbeat "ci-migrate Vitest suite" pnpm vitest run --maxWorkers=1 src/commands/ci-migrate.test.ts --reporter=default --reporter=junit --outputFile.junit="$TEST_RESULTS_DIR/junit-ci-migrate.xml"
