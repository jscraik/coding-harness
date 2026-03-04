#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd -P)"
OUTPUT_DIR="${OUTPUT_DIR:-${REPO_ROOT}/docs/benchmarks/runs}"
SCHEMA_PATH="${REPO_ROOT}/docs/benchmarks/schema/benchmark-run.schema.json"
BENCH_COMMAND="${*:-pnpm check}"

for bin in bash git jq; do
  if ! command -v "${bin}" >/dev/null 2>&1; then
    echo "❌ missing required binary: ${bin}" >&2
    exit 2
  fi
done

if [[ ! -f "${SCHEMA_PATH}" ]]; then
  echo "❌ schema not found: ${SCHEMA_PATH}" >&2
  exit 2
fi

mkdir -p "${OUTPUT_DIR}"

RUN_ID="swe-$(date -u +%Y%m%d-%H%M%S)"
OUTPUT_PATH="${OUTPUT_DIR}/${RUN_ID}.json"
STARTED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
START_EPOCH="$(date +%s)"

set +e
bash -lc "${BENCH_COMMAND}"
EXIT_CODE=$?
set -e

FINISHED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
END_EPOCH="$(date +%s)"
DURATION_SECONDS=$((END_EPOCH - START_EPOCH))

STATUS="pass"
if [[ "${EXIT_CODE}" -ne 0 ]]; then
  STATUS="fail"
fi

REPOSITORY="$(git -C "${REPO_ROOT}" config --get remote.origin.url || true)"
if [[ -z "${REPOSITORY}" ]]; then
  REPOSITORY="$(git -C "${REPO_ROOT}" rev-parse --show-toplevel)"
fi

ARTIFACTS_JSON="$(
  jq -nc --arg csv "${BENCH_ARTIFACTS_CSV:-}" '
    if $csv == "" then
      []
    else
      $csv
      | split(",")
      | map(gsub("^\\s+|\\s+$"; ""))
      | map(select(length > 0))
    end
  '
)"

jq -n \
  --arg run_id "${RUN_ID}" \
  --arg track "swe" \
  --arg command "${BENCH_COMMAND}" \
  --arg status "${STATUS}" \
  --arg started_at "${STARTED_AT}" \
  --arg finished_at "${FINISHED_AT}" \
  --arg notes "${BENCH_NOTES:-}" \
  --arg commit "$(git -C "${REPO_ROOT}" rev-parse HEAD)" \
  --arg branch "$(git -C "${REPO_ROOT}" rev-parse --abbrev-ref HEAD)" \
  --arg repository "${REPOSITORY}" \
  --argjson duration_seconds "${DURATION_SECONDS}" \
  --argjson exit_code "${EXIT_CODE}" \
  --argjson artifacts "${ARTIFACTS_JSON}" \
  '{
    run_id: $run_id,
    track: $track,
    command: $command,
    status: $status,
    started_at: $started_at,
    finished_at: $finished_at,
    duration_seconds: $duration_seconds,
    notes: $notes,
    artifacts: $artifacts,
    git: {
      commit: $commit,
      branch: $branch,
      repository: $repository
    },
    metrics: {
      exit_code: $exit_code
    }
  }' > "${OUTPUT_PATH}"

if command -v ajv >/dev/null 2>&1; then
  ajv validate -s "${SCHEMA_PATH}" -d "${OUTPUT_PATH}" >/dev/null
fi

echo "benchmark run record: ${OUTPUT_PATH}"
exit "${EXIT_CODE}"
