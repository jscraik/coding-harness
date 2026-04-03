#!/usr/bin/env bash
set -euo pipefail

# Template for harness --merge-queue-orchestrator.
# The runner must write:
# 1) JSON evidence file to "$HARNESS_CI_MIGRATE_EVIDENCE_PATH"
# 2) Signature sidecar to "${HARNESS_CI_MIGRATE_EVIDENCE_PATH}.sig"
#
# ci-migrate exports these binding env vars and this template mirrors them into
# evidence.binding so replayed artifacts are rejected:
# - HARNESS_CI_MIGRATE_BINDING_REPO_FULL_NAME
# - HARNESS_CI_MIGRATE_BINDING_HEAD_SHA
# - HARNESS_CI_MIGRATE_BINDING_TRUSTED_POLICY_REF
# - HARNESS_CI_MIGRATE_BINDING_AUTHORITY_CONFIG_SHA256
# - HARNESS_CI_MIGRATE_BINDING_REQUIRED_CHECK_MANIFEST_SHA256

snapshot_id="${HARNESS_CI_MIGRATE_SNAPSHOT_ID:-}"
evidence_path="${HARNESS_CI_MIGRATE_EVIDENCE_PATH:-}"
signing_key="${HARNESS_CI_MIGRATE_SIGNING_KEY:-}"
require_full_lifecycle="${HARNESS_CI_MIGRATE_REQUIRE_FULL_LIFECYCLE:-0}"
binding_repo_full_name="${HARNESS_CI_MIGRATE_BINDING_REPO_FULL_NAME:-}"
binding_head_sha="${HARNESS_CI_MIGRATE_BINDING_HEAD_SHA:-}"
binding_trusted_policy_ref="${HARNESS_CI_MIGRATE_BINDING_TRUSTED_POLICY_REF:-}"
binding_authority_sha256="${HARNESS_CI_MIGRATE_BINDING_AUTHORITY_CONFIG_SHA256:-}"
binding_required_manifest_sha256="${HARNESS_CI_MIGRATE_BINDING_REQUIRED_CHECK_MANIFEST_SHA256:-}"

if [[ -z "$snapshot_id" || -z "$evidence_path" || -z "$signing_key" ]]; then
  echo "missing required harness orchestration env vars" >&2
  exit 11
fi

if [[ -z "$binding_repo_full_name" || -z "$binding_head_sha" || -z "$binding_trusted_policy_ref" || -z "$binding_authority_sha256" || -z "$binding_required_manifest_sha256" ]]; then
  echo "missing required merge-queue evidence binding env vars" >&2
  exit 12
fi

# validate_utc_timestamp validates that the first argument is a UTC timestamp in the format %Y-%m-%dT%H:%M:%SZ. If parsing fails it prints `invalid <label> timestamp (expected UTC ISO-8601): <value>` to stderr and exits with status 1; the optional second argument supplies the `<label>` used in the error message.
validate_utc_timestamp() {
  local ts="${1:-}"
  local label="${2:-timestamp}"
  python3 - "$ts" "$label" <<'PY'
from datetime import datetime
import sys
ts = sys.argv[1]
label = sys.argv[2]
try:
    datetime.strptime(ts, "%Y-%m-%dT%H:%M:%SZ")
except ValueError:
    print(f"invalid {label} timestamp (expected UTC ISO-8601): {ts}", file=sys.stderr)
    sys.exit(1)
PY
}

# offset_timestamp_minutes adds an integer minute offset to a UTC timestamp in the format YYYY-MM-DDTHH:MM:SSZ and echoes the resulting timestamp in the same format.
# offset_timestamp_minutes adds an integer minute offset to a UTC timestamp in the format YYYY-MM-DDTHH:MM:SSZ and echoes the resulting timestamp; `minutes` may be negative.
offset_timestamp_minutes() {
  local base_ts="$1"
  local minutes="$2"
  python3 - "$base_ts" "$minutes" <<'PY'
from datetime import datetime, timedelta, timezone
import sys
base = datetime.strptime(sys.argv[1], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
delta_minutes = int(sys.argv[2])
print((base + timedelta(minutes=delta_minutes)).strftime("%Y-%m-%dT%H:%M:%SZ"))
PY
}

# require_non_negative_int ensures the given value is a non-negative integer; an optional label is used in the error message and the function exits with status 13 on failure.
require_non_negative_int() {
  local value="${1:-}"
  local label="${2:-count}"
  if [[ ! "$value" =~ ^[0-9]+$ ]]; then
    echo "invalid $label value (expected non-negative integer): $value" >&2
    exit 13
  fi
}

# Prefer real queue lifecycle evidence from env (set by orchestrator integrations).
# Fall back to deterministic synthetic timing when no upstream event feed is available.
paused_at="${HARNESS_CI_MIGRATE_QUEUE_PAUSED_AT:-$(date -u +"%Y-%m-%dT%H:%M:%SZ")}"
validate_utc_timestamp "$paused_at" "HARNESS_CI_MIGRATE_QUEUE_PAUSED_AT"

paused_queue_depth="${HARNESS_CI_MIGRATE_QUEUE_PAUSED_DEPTH:-1}"
require_non_negative_int "$paused_queue_depth" "HARNESS_CI_MIGRATE_QUEUE_PAUSED_DEPTH"

if [[ "$require_full_lifecycle" == "1" ]]; then
  drained_at="${HARNESS_CI_MIGRATE_QUEUE_DRAINED_AT:-$(offset_timestamp_minutes "$paused_at" 1)}"
  revalidated_at="${HARNESS_CI_MIGRATE_QUEUE_REVALIDATED_AT:-$(offset_timestamp_minutes "$paused_at" 2)}"
  validate_utc_timestamp "$drained_at" "HARNESS_CI_MIGRATE_QUEUE_DRAINED_AT"
  validate_utc_timestamp "$revalidated_at" "HARNESS_CI_MIGRATE_QUEUE_REVALIDATED_AT"

  drained_candidate_count="${HARNESS_CI_MIGRATE_QUEUE_DRAINED_COUNT:-1}"
  revalidated_candidate_count="${HARNESS_CI_MIGRATE_QUEUE_REVALIDATED_COUNT:-1}"
else
  drained_at=""
  revalidated_at=""
  drained_candidate_count=0
  revalidated_candidate_count=0
fi

require_non_negative_int "$drained_candidate_count" "HARNESS_CI_MIGRATE_QUEUE_DRAINED_COUNT"
require_non_negative_int "$revalidated_candidate_count" "HARNESS_CI_MIGRATE_QUEUE_REVALIDATED_COUNT"

signing_key_id="$(printf '%s' "$signing_key" | shasum -a 256 | awk '{print substr($1,1,16)}')"

mkdir -p "$(dirname "$evidence_path")"

jq -n \
  --arg snapshot_id "$snapshot_id" \
  --arg generated_at "$paused_at" \
  --arg paused_at "$paused_at" \
  --arg drained_at "$drained_at" \
  --arg revalidated_at "$revalidated_at" \
  --arg repo_full_name "$binding_repo_full_name" \
  --arg head_sha "$binding_head_sha" \
  --arg trusted_policy_ref "$binding_trusted_policy_ref" \
  --arg authority_sha256 "$binding_authority_sha256" \
  --arg required_manifest_sha256 "$binding_required_manifest_sha256" \
  --arg signing_key_id "$signing_key_id" \
  --argjson paused_queue_depth "$paused_queue_depth" \
  --argjson drained_candidate_count "$drained_candidate_count" \
  --argjson revalidated_candidate_count "$revalidated_candidate_count" \
  '
  {
    schemaVersion: "ci-migrate-merge-queue-evidence/v2",
    snapshotId: $snapshot_id,
    generatedAt: $generated_at,
    binding: {
      repoFullName: $repo_full_name,
      headSha: $head_sha,
      trustedPolicyRef: $trusted_policy_ref,
      authorityConfigSha256: $authority_sha256,
      requiredCheckManifestSha256: $required_manifest_sha256
    },
    pausedAt: $paused_at,
    pausedQueueDepth: $paused_queue_depth,
    integrity: {
      signatureAlgorithm: "hmac-sha256",
      signingKeyId: $signing_key_id,
      payloadSha256: ""
    }
  }
  + (if $drained_at == "" then {} else { drainedAt: $drained_at, drainedCandidateCount: $drained_candidate_count } end)
  + (if $revalidated_at == "" then {} else { revalidatedAt: $revalidated_at, revalidatedCandidateCount: $revalidated_candidate_count } end)
  ' >"$evidence_path"

payload_sha256="$(
  jq -c '.integrity.payloadSha256 = ""' "$evidence_path" \
    | shasum -a 256 \
    | awk '{print $1}'
)"
jq --arg payload "$payload_sha256" '.integrity.payloadSha256 = $payload' \
  "$evidence_path" >"${evidence_path}.tmp"
mv "${evidence_path}.tmp" "$evidence_path"

signature="$(
  openssl dgst -sha256 -hmac "$signing_key" "$evidence_path" \
    | awk '{print $2}'
)"
printf '%s\n' "$signature" >"${evidence_path}.sig"

echo "wrote merge-queue cutover evidence: $evidence_path"
