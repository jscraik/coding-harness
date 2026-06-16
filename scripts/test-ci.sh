#!/usr/bin/env bash
set -euo pipefail

echo "[test-ci] Running standard Vitest suites"
TEST_RESULTS_DIR="${TEST_RESULTS_DIR:-artifacts/test-results}"
mkdir -p "$TEST_RESULTS_DIR"

run_with_heartbeat() {
	local label="$1"
	shift
	local heartbeat_interval="${TEST_CI_HEARTBEAT_INTERVAL_SECONDS:-60}"
	local status_file
	status_file="${TMPDIR:-/tmp}/test-ci-status-$$-$RANDOM"
	(
		set +e
		"$@"
		printf '%s\n' "$?" > "$status_file"
	) &
	local command_pid="$!"
	local elapsed=0
	while [[ ! -s "$status_file" ]]; do
		sleep 1
		[[ -s "$status_file" ]] && break
		kill -0 "$command_pid" 2>/dev/null || break
		elapsed=$((elapsed + 1))
		if [[ "$elapsed" -ge "$heartbeat_interval" ]]; then
			echo "[test-ci] still running: $label"
			elapsed=0
		fi
	done
	set +e
	wait "$command_pid"
	local wait_status="$?"
	set -e
	local command_status="$wait_status"
	if [[ -s "$status_file" ]]; then
		command_status="$(cat "$status_file")"
	fi
	rm -f "$status_file"
	return "$command_status"
}

# Vitest can intermittently report worker RPC timeout false positives on long suites.
run_with_heartbeat "standard Vitest suites" pnpm vitest run --maxWorkers=1 --exclude src/commands/ci-migrate.test.ts --reporter=default --reporter=junit --outputFile.junit="$TEST_RESULTS_DIR/junit-standard.xml"

echo "[test-ci] Running ci-migrate suite with known Vitest worker-timeout mitigation"
run_with_heartbeat "ci-migrate Vitest suite" pnpm vitest run --maxWorkers=1 src/commands/ci-migrate.test.ts --reporter=default --reporter=junit --outputFile.junit="$TEST_RESULTS_DIR/junit-ci-migrate.xml"
