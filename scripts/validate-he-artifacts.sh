#!/usr/bin/env bash
set -u

usage() {
  cat >&2 <<'USAGE'
Usage: bash scripts/validate-he-artifacts.sh <plan.md> <spec.md>

Runs the Harness Engineering artifact checks required before implementing a
plan/spec pair. The script discovers the external Harness Engineering validator
bundle from HE_AGENT_SKILLS_ROOT or ../agent-skills.

Exit codes:
  0 pass
  1 validation failed or required validator bundle missing
  2 usage error
USAGE
}

json_escape() {
  local value=$1
  value=${value//\\/\\\\}
  value=${value//\"/\\\"}
  value=${value//$'\n'/\\n}
  printf '%s' "$value"
}

emit_json() {
  local status=$1
  local blocker_class=$2
  local reason=$3
  printf '{"schema_version":1,"status":"%s","blockerClass":"%s","reason":"%s"}\n' \
    "$(json_escape "$status")" \
    "$(json_escape "$blocker_class")" \
    "$(json_escape "$reason")"
}

if [[ $# -ne 2 ]]; then
  usage
  emit_json "blocked" "usage_error" "expected plan and spec paths"
  exit 2
fi

if ! repo_root=$(git rev-parse --show-toplevel 2>/dev/null); then
  emit_json "blocked" "repo_root_unavailable" "could not determine git repository root"
  exit 1
fi
cd "$repo_root" || {
  emit_json "blocked" "repo_root_unavailable" "could not enter repository root"
  exit 1
}

plan_path=$1
spec_path=$2

# Resolve to canonical absolute paths
if ! plan_path_resolved=$(realpath "$plan_path" 2>/dev/null); then
  emit_json "blocked" "missing_plan" "plan path does not exist or cannot be resolved: $plan_path"
  exit 1
fi

if ! spec_path_resolved=$(realpath "$spec_path" 2>/dev/null); then
  emit_json "blocked" "missing_spec" "spec path does not exist or cannot be resolved: $spec_path"
  exit 1
fi

# Verify both paths are inside the repository root
plan_relative=$(realpath --relative-to="$repo_root" "$plan_path_resolved" 2>/dev/null || echo "")
if [[ -z "$plan_relative" || "$plan_relative" == ../* || "$plan_relative" == /* ]]; then
  emit_json "blocked" "missing_plan" "plan path is outside repository: $plan_path"
  exit 1
fi

spec_relative=$(realpath --relative-to="$repo_root" "$spec_path_resolved" 2>/dev/null || echo "")
if [[ -z "$spec_relative" || "$spec_relative" == ../* || "$spec_relative" == /* ]]; then
  emit_json "blocked" "missing_spec" "spec path is outside repository: $spec_path"
  exit 1
fi

# Use resolved paths for file checks
if [[ ! -f "$plan_path_resolved" ]]; then
  emit_json "blocked" "missing_plan" "plan path does not exist: $plan_path"
  exit 1
fi

if [[ ! -f "$spec_path_resolved" ]]; then
  emit_json "blocked" "missing_spec" "spec path does not exist: $spec_path"
  exit 1
fi

# Use original paths for validator commands
plan_path="$plan_path_resolved"
spec_path="$spec_path_resolved"

candidate_roots=()
if [[ -n "${HE_AGENT_SKILLS_ROOT:-}" ]]; then
  candidate_roots+=("$HE_AGENT_SKILLS_ROOT")
fi
candidate_roots+=("$repo_root/../agent-skills")

agent_skills_root=""
for candidate in "${candidate_roots[@]}"; do
  if [[ -d "$candidate/Infrastructure/scripts/validation-and-linting" && -d "$candidate/Plugins/harness-engineering/scripts" ]]; then
    agent_skills_root=$candidate
    break
  fi
done

if [[ -z "$agent_skills_root" ]]; then
  emit_json "blocked" "missing_he_validator_bundle" "set HE_AGENT_SKILLS_ROOT or provide ../agent-skills with Harness Engineering validators"
  exit 1
fi

identity_lint="$agent_skills_root/Infrastructure/scripts/validation-and-linting/he_artifact_identity_lint.py"
traceability_lint="$agent_skills_root/Infrastructure/scripts/validation-and-linting/he_linear_traceability_lint.py"
bluf_check="$agent_skills_root/Plugins/harness-engineering/scripts/check_bluf_structure.py"
shape_check="$agent_skills_root/Plugins/harness-engineering/scripts/check_generated_artifact_shape.py"

for validator in "$identity_lint" "$traceability_lint" "$bluf_check" "$shape_check"; do
  if [[ ! -f "$validator" ]]; then
    emit_json "blocked" "missing_he_validator" "required validator missing: $validator"
    exit 1
  fi
done

run_step() {
  local label=$1
  shift
  printf 'validate-he-artifacts: %s\n' "$label" >&2
  if ! "$@" >&2; then
    emit_json "fail" "he_artifact_validation_failed" "$label failed"
    exit 1
  fi
}

run_step "artifact identity" python3 "$identity_lint" "$plan_path" "$spec_path"
run_step "linear traceability" python3 "$traceability_lint" "$plan_path" "$spec_path"
run_step "BLUF structure" python3 "$bluf_check" "$plan_path" "$spec_path" --json
run_step "plan shape" python3 "$shape_check" "$plan_path" --kind plan --json
run_step "spec shape" python3 "$shape_check" "$spec_path" --kind spec --json

printf '{"schema_version":1,"status":"pass","validated":["artifact_identity","linear_traceability","bluf_structure","plan_shape","spec_shape"],"plan":"%s","spec":"%s"}\n' \
  "$(json_escape "$plan_path")" \
  "$(json_escape "$spec_path")"
