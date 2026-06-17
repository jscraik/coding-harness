#!/usr/bin/env bash
set -euo pipefail

echo "[test-ci] Running standard Vitest suites"
TEST_RESULTS_DIR="${TEST_RESULTS_DIR:-artifacts/test-results}"
mkdir -p "$TEST_RESULTS_DIR"
PROFILE_PATH="${TEST_CI_PROFILE_PATH:-$TEST_RESULTS_DIR/test-ci-profile.jsonl}"
mkdir -p "$(dirname "$PROFILE_PATH")"
: >"$PROFILE_PATH"
active_command_pid=""
active_heartbeat_pid=""

cleanup_active_command() {
	if [[ -n "$active_command_pid" ]]; then
		kill "$active_command_pid" 2>/dev/null || true
	fi
	if [[ -n "$active_heartbeat_pid" ]]; then
		kill "$active_heartbeat_pid" 2>/dev/null || true
	fi
}
cleanup_on_signal() {
	local status="$1"
	cleanup_active_command
	exit "$status"
}
trap cleanup_active_command EXIT
trap 'cleanup_on_signal 130' INT
trap 'cleanup_on_signal 143' TERM

json_escape() {
	local value="$1"
	value="${value//\\/\\\\}"
	value="${value//\"/\\\"}"
	value="${value//$'\n'/\\n}"
	printf '%s' "$value"
}

record_profile() {
	local label="$1"
	local status="$2"
	local duration_seconds="$3"
	printf '{"label":"%s","status":%s,"durationSeconds":%s}\n' \
		"$(json_escape "$label")" \
		"$status" \
		"$duration_seconds" >>"$PROFILE_PATH"
}

run_with_heartbeat() {
	local label="$1"
	shift
	local heartbeat_interval="${TEST_CI_HEARTBEAT_INTERVAL_SECONDS:-60}"
	local started_at
	started_at="$(date +%s)"
	"$@" &
	local command_pid="$!"
	active_command_pid="$command_pid"
	(
		while kill -0 "$command_pid" 2>/dev/null; do
			sleep "$heartbeat_interval" || exit 0
			if kill -0 "$command_pid" 2>/dev/null; then
				echo "[test-ci] still running: $label"
			fi
		done
	) &
	local heartbeat_pid="$!"
	active_heartbeat_pid="$heartbeat_pid"
	set +e
	wait "$command_pid"
	local command_status="$?"
	set -e
	kill "$heartbeat_pid" 2>/dev/null || true
	wait "$heartbeat_pid" 2>/dev/null || true
	active_command_pid=""
	active_heartbeat_pid=""
	local ended_at
	ended_at="$(date +%s)"
	local duration_seconds
	duration_seconds=$((ended_at - started_at))
	record_profile "$label" "$command_status" "$duration_seconds"
	echo "[test-ci] completed: $label status=$command_status duration=${duration_seconds}s"
	return "$command_status"
}

# Vitest can intermittently report worker RPC timeout false positives on long suites.
standard_max_workers="${TEST_CI_STANDARD_MAX_WORKERS:-2}"
standard_args=(vitest run --maxWorkers="$standard_max_workers" --exclude src/commands/ci-migrate.test.ts --reporter=default --reporter=junit --outputFile.junit="$TEST_RESULTS_DIR/junit-standard.xml")
if [[ -n "${TEST_CI_STANDARD_TEST_FILES:-}" ]]; then
	for test_file in $TEST_CI_STANDARD_TEST_FILES; do
		standard_args+=("$test_file")
	done
fi
run_with_heartbeat "standard Vitest suites" pnpm "${standard_args[@]}"

if [[ "${TEST_CI_SKIP_ISOLATED:-0}" == "1" ]]; then
	echo "[test-ci] skipping isolated ci-migrate suite because TEST_CI_SKIP_ISOLATED=1"
	echo "[test-ci] wrote profile: $PROFILE_PATH"
	exit 0
fi

echo "[test-ci] Running ci-migrate suite with known Vitest worker-timeout mitigation"
isolated_max_workers="${TEST_CI_ISOLATED_MAX_WORKERS:-1}"
run_with_heartbeat "ci-migrate Vitest suite" pnpm vitest run --maxWorkers="$isolated_max_workers" src/commands/ci-migrate.test.ts --reporter=default --reporter=junit --outputFile.junit="$TEST_RESULTS_DIR/junit-ci-migrate.xml"

echo "[test-ci] wrote profile: $PROFILE_PATH"
