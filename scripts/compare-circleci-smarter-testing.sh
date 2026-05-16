#!/usr/bin/env bash
set -uo pipefail

ARTIFACT_ROOT="${ARTIFACT_ROOT:-artifacts/test-results/smarter-testing-comparison}"
BASELINE_RESULTS_DIR="$ARTIFACT_ROOT/baseline"
SMARTER_RESULTS_DIR="$ARTIFACT_ROOT/smarter"
SUMMARY_JSON="$ARTIFACT_ROOT/comparison.json"
SUMMARY_MD="$ARTIFACT_ROOT/comparison.md"

mkdir -p "$BASELINE_RESULTS_DIR" "$SMARTER_RESULTS_DIR"

run_measured() {
  local label="$1"
  local log_path="$2"
  local command_text="$3"
  local started_at ended_at exit_code duration_seconds

  started_at="$(date +%s)"
  {
    printf '# %s\n' "$label"
    printf '$ %s\n\n' "$command_text"
  } >"$log_path"

  bash -lc "$command_text" >>"$log_path" 2>&1
  exit_code=$?
  ended_at="$(date +%s)"
  duration_seconds=$((ended_at - started_at))

  printf '%s|%s|%s\n' "$exit_code" "$duration_seconds" "$log_path"
}

baseline_command="${BASELINE_COMMAND:-TEST_RESULTS_DIR=artifacts/test-results/smarter-testing-comparison/baseline bash scripts/test-ci.sh}"
smarter_command="${SMARTER_COMMAND:-circleci run testsuite 'ci tests'}"

baseline_result="$(run_measured "baseline pnpm test:ci" "$ARTIFACT_ROOT/baseline.log" "$baseline_command")"
baseline_exit="${baseline_result%%|*}"
baseline_remainder="${baseline_result#*|}"
baseline_duration="${baseline_remainder%%|*}"
baseline_log="${baseline_remainder#*|}"

if [[ -n "${SMARTER_COMMAND:-}" ]] || command -v circleci >/dev/null 2>&1; then
  smarter_result="$(run_measured "CircleCI Smarter Testing testsuite" "$ARTIFACT_ROOT/smarter-testing.log" "$smarter_command")"
  smarter_exit="${smarter_result%%|*}"
  smarter_remainder="${smarter_result#*|}"
  smarter_duration="${smarter_remainder%%|*}"
  smarter_log="${smarter_remainder#*|}"
  smarter_status="ran"
else
  smarter_exit=127
  smarter_duration=0
  smarter_log="$ARTIFACT_ROOT/smarter-testing.log"
  smarter_status="blocked_missing_circleci_cli"
  {
    printf '# CircleCI Smarter Testing testsuite\n'
    printf 'STATUS: blocked_missing_circleci_cli\n'
    printf 'The circleci CLI was not found on PATH, so the testsuite comparison could not run.\n'
  } >"$smarter_log"
fi

duration_delta=$((smarter_duration - baseline_duration))

cat >"$SUMMARY_JSON" <<JSON
{
  "baseline": {
    "command": "$baseline_command",
    "exitCode": $baseline_exit,
    "durationSeconds": $baseline_duration,
    "resultsPath": "$BASELINE_RESULTS_DIR",
    "logPath": "$baseline_log"
  },
  "smarterTesting": {
    "command": "$smarter_command",
    "status": "$smarter_status",
    "exitCode": $smarter_exit,
    "durationSeconds": $smarter_duration,
    "resultsPath": "$SMARTER_RESULTS_DIR",
    "logPath": "$smarter_log"
  },
  "comparison": {
    "durationDeltaSeconds": $duration_delta
  }
}
JSON

cat >"$SUMMARY_MD" <<MD
# CircleCI Smarter Testing Comparison

This comparison is evidence-only. The required CircleCI test authority remains \`pnpm test:ci\` unless this artifact shows that Smarter Testing is stable and comparable.

| Lane | Command | Exit | Duration |
| --- | --- | ---: | ---: |
| Baseline | \`$baseline_command\` | $baseline_exit | ${baseline_duration}s |
| Smarter Testing | \`$smarter_command\` | $smarter_exit | ${smarter_duration}s |

Duration delta: ${duration_delta}s.

Artifacts:

- Baseline JUnit/logs: \`$BASELINE_RESULTS_DIR\`, \`$baseline_log\`
- Smarter Testing JUnit/logs: \`$SMARTER_RESULTS_DIR\`, \`$smarter_log\`
- Machine-readable summary: \`$SUMMARY_JSON\`

Promotion rule:

Keep \`pnpm test:ci\` as the required lane until Smarter Testing exits 0, CircleCI's Tests tab shows comparable test counts, and the runtime delta is materially better across repeated runs.
MD

printf 'WROTE: %s\n' "$SUMMARY_MD"
printf 'WROTE: %s\n' "$SUMMARY_JSON"

# Evidence-only comparison: regular required test jobs still enforce correctness.
exit 0
