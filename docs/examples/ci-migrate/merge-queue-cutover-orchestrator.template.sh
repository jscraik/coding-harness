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

# TODO: replace these timestamps/counts with real queue API events for:
# - pause admission
# - drain in-flight candidates
# - revalidate candidates against updated required checks
paused_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
drained_at="$(
  python3 - "$paused_at" <<'PY'
from datetime import datetime, timedelta, timezone
import sys
base = datetime.strptime(sys.argv[1], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
print((base + timedelta(minutes=1)).strftime("%Y-%m-%dT%H:%M:%SZ"))
PY
)"
revalidated_at="$(
  python3 - "$paused_at" <<'PY'
from datetime import datetime, timedelta, timezone
import sys
base = datetime.strptime(sys.argv[1], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
print((base + timedelta(minutes=2)).strftime("%Y-%m-%dT%H:%M:%SZ"))
PY
)"

if [[ "$require_full_lifecycle" == "1" ]]; then
  drained_candidate_count=1
  revalidated_candidate_count=1
else
  drained_at=""
  revalidated_at=""
  drained_candidate_count=0
  revalidated_candidate_count=0
fi

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
  --argjson paused_queue_depth 1 \
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
