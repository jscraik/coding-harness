#!/usr/bin/env bash
set -euo pipefail

# Template: harvest immutable CI artifacts into signed provenance inputs.
#
# This script:
# 1) Downloads or copies CI artifacts listed in a harvest manifest.
# 2) Emits `.harness/ci-parity-proof-provenance.input.json`.
# 3) Emits signed `.harness/ci-parity-proof-artifact-index.json` + `.sig`.
#
# Then run:
#   harness ci-migrate commit --snapshot <id> --auto-generate-proof-pack
#
# Required:
# - HARNESS_CI_MIGRATE_SIGNING_KEY
# Optional:
# - HARNESS_CI_MIGRATE_HARVEST_MANIFEST_PATH (default: .harness/ci-parity-proof-harvest-manifest.json)
# - HARNESS_CI_MIGRATE_PROVENANCE_INPUT_PATH (default: .harness/ci-parity-proof-provenance.input.json)
# - HARNESS_CI_MIGRATE_ARTIFACT_INDEX_PATH (default: .harness/ci-parity-proof-artifact-index.json)

manifest_path="${HARNESS_CI_MIGRATE_HARVEST_MANIFEST_PATH:-.harness/ci-parity-proof-harvest-manifest.json}"
provenance_input_path="${HARNESS_CI_MIGRATE_PROVENANCE_INPUT_PATH:-.harness/ci-parity-proof-provenance.input.json}"
artifact_index_path="${HARNESS_CI_MIGRATE_ARTIFACT_INDEX_PATH:-.harness/ci-parity-proof-artifact-index.json}"
signing_key="${HARNESS_CI_MIGRATE_SIGNING_KEY:-}"

if [[ -z "$signing_key" ]]; then
  echo "HARNESS_CI_MIGRATE_SIGNING_KEY is required." >&2
  exit 10
fi

for required_cmd in jq shasum openssl curl; do
  if ! command -v "$required_cmd" >/dev/null 2>&1; then
    echo "missing required command: $required_cmd" >&2
    exit 11
  fi
done

if [[ ! -f "$manifest_path" ]]; then
  echo "harvest manifest not found: $manifest_path" >&2
  exit 12
fi

schema_version="$(jq -r '.schemaVersion // empty' "$manifest_path")"
if [[ "$schema_version" != "ci-parity-proof-harvest-manifest/v1" ]]; then
  echo "harvest manifest schemaVersion must be ci-parity-proof-harvest-manifest/v1" >&2
  exit 13
fi

generated_at="$(jq -r '.generatedAt // empty' "$manifest_path")"
if [[ -z "$generated_at" ]]; then
  generated_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
fi

signing_key_id="$(
  printf '%s' "$signing_key" \
    | shasum -a 256 \
    | awk '{print substr($1,1,16)}'
)"

mapfile -t artifact_rows < <(jq -c '.artifacts[]?' "$manifest_path")
if [[ "${#artifact_rows[@]}" -eq 0 ]]; then
  echo "harvest manifest must include at least one artifact." >&2
  exit 14
fi

provenance_input_artifacts='[]'
index_artifacts='[]'

for artifact_row in "${artifact_rows[@]}"; do
  artifact_id="$(jq -r '.artifactId // empty' <<<"$artifact_row")"
  destination_path="$(jq -r '.destinationPath // empty' <<<"$artifact_row")"
  source_provider="$(jq -r '.sourceProvider // empty' <<<"$artifact_row")"
  source_run_id="$(jq -r '.sourceRunId // empty' <<<"$artifact_row")"
  source_workflow_ref="$(jq -r '.sourceWorkflowRef // empty' <<<"$artifact_row")"
  source_commit_sha="$(jq -r '.sourceCommitSha // empty' <<<"$artifact_row")"
  captured_at="$(jq -r '.capturedAt // empty' <<<"$artifact_row")"
  scenario="$(jq -r '.scenario // empty' <<<"$artifact_row")"

  if [[ -z "$artifact_id" || -z "$destination_path" || -z "$source_provider" || -z "$source_run_id" || -z "$source_workflow_ref" || -z "$source_commit_sha" || -z "$captured_at" ]]; then
    echo "artifact entry missing required fields: $artifact_row" >&2
    exit 15
  fi

  if [[ "$source_provider" != "github-actions" && "$source_provider" != "circleci" ]]; then
    echo "artifact sourceProvider must be github-actions or circleci: $artifact_id" >&2
    exit 16
  fi

  if [[ ! "$source_commit_sha" =~ ^[a-f0-9]{40}$ ]]; then
    echo "artifact sourceCommitSha must be a 40-character lowercase commit SHA: $artifact_id" >&2
    exit 17
  fi

  if [[ "$destination_path" != .harness/ci-parity-proof-source-artifacts/* || "$destination_path" == *".."* ]]; then
    echo "artifact destinationPath must be under .harness/ci-parity-proof-source-artifacts/: $artifact_id" >&2
    exit 18
  fi

  mkdir -p "$(dirname "$destination_path")"

  source_path="$(jq -r '.source.path // empty' <<<"$artifact_row")"
  source_url="$(jq -r '.source.url // empty' <<<"$artifact_row")"
  if [[ -n "$source_path" && -n "$source_url" ]]; then
    echo "artifact source must include either source.path or source.url, not both: $artifact_id" >&2
    exit 19
  fi
  if [[ -z "$source_path" && -z "$source_url" ]]; then
    echo "artifact source must include source.path or source.url: $artifact_id" >&2
    exit 20
  fi

  if [[ -n "$source_path" ]]; then
    if [[ ! -f "$source_path" ]]; then
      echo "artifact source.path not found: $source_path ($artifact_id)" >&2
      exit 21
    fi
    cp "$source_path" "$destination_path"
  else
    source_auth="$(jq -r '.source.auth // "none"' <<<"$artifact_row")"
    source_token_env="$(jq -r '.source.tokenEnv // empty' <<<"$artifact_row")"
    source_accept="$(jq -r '.source.accept // empty' <<<"$artifact_row")"
    curl_args=(-fsSL --retry 3 --retry-delay 1 --connect-timeout 15 --max-time 180)
    if [[ -n "$source_accept" ]]; then
      curl_args+=(-H "Accept: $source_accept")
    fi
    case "$source_auth" in
      none)
        ;;
      bearer-env)
        if [[ -z "$source_token_env" ]]; then
          echo "artifact source.tokenEnv is required for auth=bearer-env: $artifact_id" >&2
          exit 22
        fi
        source_token="${!source_token_env:-}"
        if [[ -z "$source_token" ]]; then
          echo "artifact auth token env var is empty: $source_token_env ($artifact_id)" >&2
          exit 23
        fi
        curl_args+=(-H "Authorization: Bearer $source_token")
        ;;
      *)
        echo "unsupported source.auth '$source_auth' for $artifact_id" >&2
        exit 24
        ;;
    esac
    curl "${curl_args[@]}" "$source_url" -o "$destination_path"
  fi

  artifact_sha256="$(
    shasum -a 256 "$destination_path" \
      | awk '{print $1}'
  )"

  artifact_signature_payload="${destination_path}:${artifact_sha256}:${source_provider}:${source_run_id}:${source_commit_sha}:${captured_at}"
  artifact_signature="$(
    printf '%s' "$artifact_signature_payload" \
      | openssl dgst -sha256 -hmac "$signing_key" \
      | awk '{print $2}'
  )"

  provenance_input_artifacts="$(
    jq -c \
      --arg artifact_id "$artifact_id" \
      --arg path "$destination_path" \
      --arg source_provider "$source_provider" \
      --arg source_run_id "$source_run_id" \
      --arg source_workflow_ref "$source_workflow_ref" \
      --arg source_commit_sha "$source_commit_sha" \
      --arg captured_at "$captured_at" \
      --arg scenario "$scenario" \
      '
      . + [
        {
          artifactId: $artifact_id,
          path: $path,
          sourceProvider: $source_provider,
          sourceRunId: $source_run_id,
          sourceWorkflowRef: $source_workflow_ref,
          sourceCommitSha: $source_commit_sha,
          capturedAt: $captured_at
        }
        + (if $scenario == "" then {} else { scenario: $scenario } end)
      ]
      ' <<<"$provenance_input_artifacts"
  )"

  index_artifacts="$(
    jq -c \
      --arg artifact_id "$artifact_id" \
      --arg path "$destination_path" \
      --arg sha256 "$artifact_sha256" \
      --arg signature "$artifact_signature" \
      --arg source_provider "$source_provider" \
      --arg source_run_id "$source_run_id" \
      --arg source_workflow_ref "$source_workflow_ref" \
      --arg source_commit_sha "$source_commit_sha" \
      --arg captured_at "$captured_at" \
      --arg scenario "$scenario" \
      '
      . + [
        {
          artifactId: $artifact_id,
          path: $path,
          sha256: $sha256,
          signature: $signature,
          sourceProvider: $source_provider,
          sourceRunId: $source_run_id,
          sourceWorkflowRef: $source_workflow_ref,
          sourceCommitSha: $source_commit_sha,
          capturedAt: $captured_at
        }
        + (if $scenario == "" then {} else { scenario: $scenario } end)
      ]
      ' <<<"$index_artifacts"
  )"
done

repo_json="$(jq -c '.repo // null' "$manifest_path")"
behavioral_parity_json="$(jq -c '.behavioralParity' "$manifest_path")"
promotion_gate_json="$(jq -c '.promotionGate' "$manifest_path")"
downstream_json="$(jq -c '.downstream' "$manifest_path")"

provenance_input_json="$(
  jq -n \
    --arg generated_at "$generated_at" \
    --argjson repo "$repo_json" \
    --argjson behavioral_parity "$behavioral_parity_json" \
    --argjson promotion_gate "$promotion_gate_json" \
    --argjson downstream "$downstream_json" \
    --argjson artifacts "$provenance_input_artifacts" \
    '
    {
      schemaVersion: "ci-parity-proof-provenance-input/v1",
      generatedAt: $generated_at,
      behavioralParity: $behavioral_parity,
      promotionGate: $promotion_gate,
      downstream: $downstream,
      artifacts: $artifacts
    }
    + (if $repo == null then {} else { repo: $repo } end)
    '
)"

mkdir -p "$(dirname "$provenance_input_path")"
printf '%s\n' "$provenance_input_json" | jq '.' >"$provenance_input_path"

artifact_index_json="$(
  jq -n \
    --arg generated_at "$generated_at" \
    --arg signing_key_id "$signing_key_id" \
    --argjson repo "$repo_json" \
    --argjson behavioral_parity "$behavioral_parity_json" \
    --argjson promotion_gate "$promotion_gate_json" \
    --argjson downstream "$downstream_json" \
    --argjson artifacts "$index_artifacts" \
    '
    {
      schemaVersion: "ci-parity-proof-artifact-index/v2",
      generatedAt: $generated_at,
      behavioralParity: $behavioral_parity,
      promotionGate: $promotion_gate,
      downstream: $downstream,
      artifacts: $artifacts,
      integrity: {
        signatureAlgorithm: "hmac-sha256",
        signingKeyId: $signing_key_id,
        payloadSha256: ""
      }
    }
    + (if $repo == null then {} else { repo: $repo } end)
    '
)"

payload_sha256="$(
  printf '%s\n' "$artifact_index_json" \
    | jq -c '.integrity.payloadSha256 = ""' \
    | shasum -a 256 \
    | awk '{print $1}'
)"
artifact_index_json="$(
  printf '%s\n' "$artifact_index_json" \
    | jq --arg payload_sha256 "$payload_sha256" '.integrity.payloadSha256 = $payload_sha256'
)"

mkdir -p "$(dirname "$artifact_index_path")"
printf '%s\n' "$artifact_index_json" | jq '.' >"$artifact_index_path"

artifact_index_signature="$(
  openssl dgst -sha256 -hmac "$signing_key" "$artifact_index_path" \
    | awk '{print $2}'
)"
printf '%s\n' "$artifact_index_signature" >"${artifact_index_path}.sig"

echo "wrote provenance input: $provenance_input_path"
echo "wrote signed artifact index: $artifact_index_path"
echo "next step: harness ci-migrate commit --snapshot <id> --auto-generate-proof-pack"
