#!/usr/bin/env bash
set -euo pipefail

ensure_optional_npm_token_env() {
	if [[ -z "${NPM_TOKEN+x}" ]]; then
		export NPM_TOKEN=""
	fi
}

ensure_optional_npm_token_env

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"

changed_only=1
fast_mode=0
strict_mode=0
json_mode=0
repo_root=""
resume_from=""
normalized_manifest_path=""
normalized_manifest_source=""
lane_fast_mode_json="false"
lane_changed_only_json="true"
lane_strict_mode_json="false"
hook_governance_scope="project-local"
project_governance_flag=0
workspace_governance_flag=0
current_git_root=""
current_repo_name=""
workspace_root=""
hook_scope_manifest=""
hook_inventory_builder=""
hook_rollout_checker=""
hook_docstring_ratchet_evaluator=""
hook_classification_input=""
hook_metrics_input=""
hook_inventory_output=""
hook_rollout_output=""
hook_docstring_output=""
declare -a hook_temp_paths=()

usage() {
	cat <<'USAGE'
Usage: scripts/verify-work.sh [options]

Canonical repo-local verification runner.

Options:
  --all              Run full test coverage in --fast mode
  --changed-only     Prefer changed-file validation in --fast mode (default)
  --strict           Fail when fast-mode fallbacks are needed
  --fast             Run preflight + lint + typecheck + tests instead of the full check bundle
  --resume-from ID   Resume execution from a gate id (requires compatible prior run state)
  --json             Emit final summary as JSON
  --repo-root PATH   Run checks in a specific repository root
  --project-governance Limit hook-governance checks to this repository only (default)
  --workspace-governance Run hook-governance checks from docs/hooks-governance/repo-scope.manifest.json
  -h, --help         Show this help text
USAGE
}

log_info() {
	if [[ "$json_mode" -eq 1 ]]; then
		echo "$@" >&2
	else
		echo "$@"
	fi
}

refresh_lane_metadata() {
	if [[ "$fast_mode" -eq 1 ]]; then
		lane_fast_mode_json="true"
	else
		lane_fast_mode_json="false"
	fi

	if [[ "$changed_only" -eq 1 ]]; then
		lane_changed_only_json="true"
	else
		lane_changed_only_json="false"
	fi

	if [[ "$strict_mode" -eq 1 ]]; then
		lane_strict_mode_json="true"
	else
		lane_strict_mode_json="false"
	fi
}

detect_stack() {
	if [[ -f package.json ]]; then
		echo js
		return
	fi
	if [[ -f pyproject.toml ]]; then
		echo py
		return
	fi
	if [[ -f Cargo.toml ]]; then
		echo rust
		return
	fi
	echo repo
}

preflight_bins_csv() {
	case "$1" in
		js) echo 'git,bash,sed,rg,jq,curl,node,python3,uv,pnpm' ;;
		py) echo 'git,bash,sed,rg,jq,curl,python3' ;;
		rust) echo 'git,bash,sed,rg,jq,curl,python3,cargo' ;;
		repo) echo 'git,bash,sed,rg,jq,curl,python3' ;;
		*) echo "[verify-work] unknown stack: $1" >&2; return 2 ;;
	esac
}

# preflight_paths_csv returns a comma-separated list of repository paths required for preflight verification for the given project stack.
preflight_paths_csv() {
	case "$1" in
		js) echo 'package.json,CODESTYLE.md,CONTRIBUTING.md,Makefile,scripts,scripts/codex-preflight.sh,scripts/codex-preflight-local-memory-legacy.sh,scripts/check-git-common-config.sh,scripts/verify-work.sh,scripts/validate-codestyle.sh' ;;
		py) echo 'pyproject.toml,CODESTYLE.md,CONTRIBUTING.md,Makefile,scripts,scripts/codex-preflight.sh,scripts/codex-preflight-local-memory-legacy.sh,scripts/check-git-common-config.sh,scripts/verify-work.sh,scripts/validate-codestyle.sh' ;;
		rust) echo 'Cargo.toml,CODESTYLE.md,CONTRIBUTING.md,Makefile,scripts,scripts/codex-preflight.sh,scripts/codex-preflight-local-memory-legacy.sh,scripts/check-git-common-config.sh,scripts/verify-work.sh,scripts/validate-codestyle.sh' ;;
		repo) echo 'CODESTYLE.md,CONTRIBUTING.md,Makefile,scripts,scripts/codex-preflight.sh,scripts/codex-preflight-local-memory-legacy.sh,scripts/check-git-common-config.sh,scripts/verify-work.sh,scripts/validate-codestyle.sh' ;;
		*) echo "[verify-work] unknown stack: $1" >&2; return 2 ;;
	esac
}

has_package_script() {
	local script_name="$1"
	[[ -f "$repo_root/package.json" ]] || return 1
	jq -e --arg script_name "$script_name" '(.scripts // {}) | has($script_name)' "$repo_root/package.json" >/dev/null 2>&1
}

is_truthy() {
	case "${1:-}" in
		1|true|TRUE|yes|YES|on|ON) return 0 ;;
		*) return 1 ;;
	esac
}

# prepare_normalized_required_checks_manifest locates .harness/ci-required-checks.json and produces a normalized manifest in a temporary file, setting the globals `normalized_manifest_path` and `normalized_manifest_source`.
# It tries, in order, the repo dist CLI, a pnpm/tsx repo runner, a mise-provided harness (with configurable timeout), a harness on PATH, and finally falls back to copying the raw manifest if it is a JSON object; exits success when a normalized or raw-fallback manifest is available, and non-zero if normalization fails.
prepare_normalized_required_checks_manifest() {
	local manifest_path="$repo_root/.harness/ci-required-checks.json"
	normalized_manifest_path=""
	normalized_manifest_source=""
	if [[ ! -f "$manifest_path" ]]; then
		return 0
	fi

	local dist_cli_path="$repo_root/dist/cli.js"
	local pnpm_bin=""
	local mise_harness_bin=""
	local harness_bin=""
	local external_normalization_timeout="${HARNESS_VERIFY_WORK_EXTERNAL_NORMALIZE_TIMEOUT_SECONDS:-5}"
	local normalized_tmp
	normalized_tmp="$(mktemp)"

	if [[ -f "$dist_cli_path" ]] && command -v node >/dev/null 2>&1; then
		if node "$dist_cli_path" contract normalize-required-checks --manifest "$manifest_path" > "$normalized_tmp"; then
			normalized_manifest_path="$normalized_tmp"
			normalized_manifest_source="normalized"
			return 0
		fi
		echo "[verify-work] required checks normalization via dist CLI failed, trying fallback runners" >&2
	fi

	if [[ -f "$repo_root/src/cli.ts" ]] && pnpm_bin="$(command -v pnpm 2>/dev/null)"; then
		if "$pnpm_bin" exec tsx "$repo_root/src/cli.ts" contract normalize-required-checks --manifest "$manifest_path" > "$normalized_tmp"; then
			normalized_manifest_path="$normalized_tmp"
			normalized_manifest_source="normalized"
			return 0
		fi
		echo "[verify-work] required checks normalization via repo runner failed, trying fallback runners" >&2
	fi

	if ! is_truthy "${HARNESS_VERIFY_WORK_SKIP_EXTERNAL_NORMALIZATION:-0}"; then
		if command -v mise >/dev/null 2>&1; then
			if command -v timeout >/dev/null 2>&1; then
				mise_harness_bin="$(timeout "$external_normalization_timeout" mise which harness 2>/dev/null || true)"
			else
				mise_harness_bin="$(mise which harness 2>/dev/null || true)"
			fi
		fi
		if [[ -n "$mise_harness_bin" && -x "$mise_harness_bin" ]]; then
			if command -v timeout >/dev/null 2>&1; then
				if timeout "$external_normalization_timeout" "$mise_harness_bin" contract normalize-required-checks --manifest "$manifest_path" > "$normalized_tmp"; then
					normalized_manifest_path="$normalized_tmp"
					normalized_manifest_source="normalized"
					return 0
				fi
			else
				if "$mise_harness_bin" contract normalize-required-checks --manifest "$manifest_path" > "$normalized_tmp"; then
					normalized_manifest_path="$normalized_tmp"
					normalized_manifest_source="normalized"
					return 0
				fi
			fi
			echo "[verify-work] required checks normalization via mise harness failed, trying PATH harness" >&2
		fi

		harness_bin="$(command -v harness 2>/dev/null || true)"
		if [[ -n "$harness_bin" ]]; then
			if command -v timeout >/dev/null 2>&1; then
				if timeout "$external_normalization_timeout" "$harness_bin" contract normalize-required-checks --manifest "$manifest_path" > "$normalized_tmp"; then
					normalized_manifest_path="$normalized_tmp"
					normalized_manifest_source="normalized"
					return 0
				fi
			else
				if "$harness_bin" contract normalize-required-checks --manifest "$manifest_path" > "$normalized_tmp"; then
					normalized_manifest_path="$normalized_tmp"
					normalized_manifest_source="normalized"
					return 0
				fi
			fi
		fi
	fi

	if jq -e 'type == "object"' "$manifest_path" >/dev/null 2>&1; then
		cp "$manifest_path" "$normalized_tmp"
		normalized_manifest_path="$normalized_tmp"
		normalized_manifest_source="raw-fallback"
		echo "[verify-work] required checks normalization unavailable; using raw manifest fallback" >&2
		return 0
	fi

	rm -f "$normalized_tmp"
	echo "[verify-work] required checks normalization failed for $manifest_path" >&2
	return 1
}

resolve_manifest_provider() {
	if [[ -z "$normalized_manifest_path" || ! -f "$normalized_manifest_path" ]]; then
		echo ""
		return 0
	fi

	jq -r '
		.activeProvider
		// (.requiredChecks[]? | (.provider // .sourceAppSlug // .sourceAppId // empty))
		// (.gates[]? | (.provider // empty))
		// ""
	' "$normalized_manifest_path" | head -n 1
}

build_resume_hint_from_run_json() {
	local run_json_path="$1"
	local hint=""
	local lane_fast lane_changed lane_strict

	lane_fast="$(jq -r 'if (.lane.fastMode == null) then false else .lane.fastMode end' "$run_json_path" 2>/dev/null || echo false)"
	lane_changed="$(jq -r 'if (.lane.changedOnly == null) then true else .lane.changedOnly end' "$run_json_path" 2>/dev/null || echo true)"
	lane_strict="$(jq -r 'if (.lane.strictMode == null) then false else .lane.strictMode end' "$run_json_path" 2>/dev/null || echo false)"

	if [[ "$lane_fast" == "true" ]]; then
		hint+=" --fast"
	fi
	if [[ "$lane_changed" == "true" ]]; then
		hint+=" --changed-only"
	else
		hint+=" --all"
	fi
	if [[ "$lane_strict" == "true" ]]; then
		hint+=" --strict"
	fi

	echo "$hint"
}

cleanup_verify_work_temp_files() {
	if [[ -n "$normalized_manifest_path" && -f "$normalized_manifest_path" ]]; then
		rm -f "$normalized_manifest_path"
	fi
	for tmp_path in "${hook_temp_paths[@]-}"; do
		if [[ -n "$tmp_path" && -f "$tmp_path" ]]; then
			rm -f "$tmp_path"
		fi
	done
}

cleanup_verify_work_temp_files_on_exit() {
	local exit_code=$?
	trap - EXIT INT TERM
	cleanup_verify_work_temp_files
	return "$exit_code"
}

cleanup_verify_work_temp_files_on_signal() {
	local exit_code="$1"
	trap - EXIT INT TERM
	cleanup_verify_work_temp_files
	exit "$exit_code"
}

trap cleanup_verify_work_temp_files_on_exit EXIT
trap 'cleanup_verify_work_temp_files_on_signal 130' INT
trap 'cleanup_verify_work_temp_files_on_signal 143' TERM

iso_now() {
	date -u +"%Y-%m-%dT%H:%M:%SZ"
}

is_transient_failure_output() {
	local output_file="$1"
	if [[ ! -f "$output_file" ]]; then
		return 1
	fi
	# Network/infra signals only; policy/contract failures are handled separately.
	if rg -qi 'timed out|timeout|ECONNRESET|EAI_AGAIN|ENOTFOUND|temporary|temporarily unavailable|connection refused|TLS|network error|503|502|429|transport error' "$output_file"; then
		return 0
	fi
	return 1
}

retry_budget() {
	local budget=2
	if [[ -n "${CI:-}" ]]; then
		budget=3
	fi
	echo "$budget"
}

retry_delay_seconds() {
	local attempt="$1"
	local base=1
	local max=5
	if [[ -n "${CI:-}" ]]; then
		base=3
		max=15
	fi
	local delay=$((base * (2 ** (attempt - 1))))
	if (( delay > max )); then
		delay="$max"
	fi
	echo "$delay"
}

run_ci_check_alignment_gate() {
	local manifest_path="$repo_root/.harness/ci-required-checks.json"
	if [[ ! -f "$manifest_path" ]]; then
		echo "[verify-work] ci-check-alignment: manifest missing, skipping"
		return 0
	fi

	if [[ -z "$normalized_manifest_path" || ! -f "$normalized_manifest_path" ]]; then
		echo "[verify-work] ci-check-alignment: invalid manifest structure"
		return 1
	fi

	local provider
	provider="$(
		jq -r '
			.activeProvider
			// (.requiredChecks[]? | (.provider // .sourceAppSlug // .sourceAppId // empty))
			// (.gates[]? | (.provider // .sourceAppSlug // .sourceAppId // empty))
			// ""
		' "$normalized_manifest_path" | head -n 1
	)"
	if [[ -z "$provider" ]]; then
		echo "[verify-work] ci-check-alignment: active provider identity is required in required checks manifest"
		echo "[verify-work] ci-check-alignment: blocking due to missing canonical provider identity"
		return 1
	fi

	local github_check_names
	if [[ "$normalized_manifest_source" == "raw-fallback" ]]; then
		github_check_names="$(jq -r --arg provider "$provider" '.requiredChecks[]? | select((.provider // .sourceAppSlug // .sourceAppId // "") == $provider) | .githubCheckName // empty' "$normalized_manifest_path")"
	else
		github_check_names="$(jq -r --arg provider "$provider" '.gates[]? | select((.provider // "") == $provider) | .githubCheckName // empty' "$normalized_manifest_path")"
	fi

	if [[ -z "$github_check_names" ]]; then
		echo "[verify-work] ci-check-alignment: no githubCheckName values found for active provider"
		echo "[verify-work] ci-check-alignment: blocking due to missing canonical check identity"
		return 1
	fi

	if [[ "$provider" == "circleci" ]]; then
		local suspicious=()
		local circleci_check_names="$github_check_names"
		if [[ "$normalized_manifest_source" != "raw-fallback" ]]; then
			circleci_check_names="$(jq -r '.gates[]? | select((.provider // "") == "circleci") | .githubCheckName // empty' "$normalized_manifest_path")"
		fi
		while IFS= read -r name; do
			case "$name" in
				lint|typecheck|test|audit|check|build|memory|dependency-scan|orb-pinning|docs-gate|linear-gate|risk-policy-gate|consistency-drift-health|pr-template)
					suspicious+=("$name")
					;;
				*)
					;;
			esac
		done <<< "$github_check_names"

		if (( ${#suspicious[@]} > 0 )); then
			printf '[verify-work] ci-check-alignment: CircleCI job-like githubCheckName values detected: %s\n' "${suspicious[*]}"
			return 1
		fi
	fi

	echo "[verify-work] ci-check-alignment: manifest check names look aligned"
	return 0
}

read_normalized_manifest_value_or_default() {
	local fallback="$1"
	local jq_expression="$2"
	if [[ -n "$normalized_manifest_path" && -f "$normalized_manifest_path" ]]; then
		local manifest_value
		manifest_value="$(jq -r "$jq_expression" "$normalized_manifest_path" 2>/dev/null || true)"
		if [[ -n "$manifest_value" ]]; then
			echo "$manifest_value"
			return 0
		fi
	fi
	echo "$fallback"
}

compute_contract_version() {
	read_normalized_manifest_value_or_default "1" '.contractVersion // "1"'
}

compute_contract_fingerprint() {
	local contract_path="$repo_root/harness.contract.json"
	if [[ ! -f "$contract_path" ]]; then
		echo "missing"
		return 0
	fi

	local fingerprint=""
	if command -v node >/dev/null 2>&1; then
		fingerprint="$(
			node -e 'const fs=require("node:fs"); const crypto=require("node:crypto"); const path=process.argv[1]; const bytes=fs.readFileSync(path); process.stdout.write(crypto.createHash("sha256").update(bytes).digest("hex"));' "$contract_path" 2>/dev/null || true
		)"
	fi
	if [[ -z "$fingerprint" ]] && command -v shasum >/dev/null 2>&1; then
		fingerprint="$(shasum -a 256 "$contract_path" 2>/dev/null | awk '{print $1}')"
	fi
	if [[ -z "$fingerprint" ]] && command -v openssl >/dev/null 2>&1; then
		fingerprint="$(
			openssl dgst -sha256 -r "$contract_path" 2>/dev/null | awk '{print $1}' || true
		)"
	fi

	if [[ -z "$fingerprint" ]]; then
		echo "unknown"
		return 0
	fi

	echo "$fingerprint"
}

compute_provider_class() {
	local provider
	provider="$(resolve_manifest_provider)"
	if [[ -n "$provider" ]]; then
		echo "$provider"
		return 0
	fi

	echo "unknown"
}

compute_schema_version() {
	read_normalized_manifest_value_or_default "1" ".schemaVersion // 1"
}

first_existing_path() {
	for candidate in "$@"; do
		if [[ -f "$candidate" ]]; then
			echo "$candidate"
			return 0
		fi
	done
	return 1
}

prepare_hook_governance_inputs() {
	hook_inventory_builder="$(
		first_existing_path \
			"$repo_root/scripts/hook-governance/inventory_repos.py" \
			"$repo_root/codex/scripts/hook-governance/inventory_repos.py" \
			|| true
	)"
	hook_rollout_checker="$(
		first_existing_path \
			"$repo_root/scripts/hook-governance/rollout_check.py" \
			"$repo_root/codex/scripts/hook-governance/rollout_check.py" \
			|| true
	)"
	hook_docstring_ratchet_evaluator="$(
		first_existing_path \
			"$repo_root/scripts/hook-governance/evaluate_docstring_ratchet.py" \
			"$repo_root/codex/scripts/hook-governance/evaluate_docstring_ratchet.py" \
			|| true
	)"
	hook_classification_input="$(
		first_existing_path \
			"$repo_root/docs/hooks-governance/public-api-classification.json" \
			"$repo_root/codex/docs/hooks-governance/public-api-classification.json" \
			|| true
	)"
	hook_metrics_input="$(
		first_existing_path \
			"$repo_root/docs/hooks-governance/docstring-ratchet-metrics.json" \
			"$repo_root/codex/docs/hooks-governance/docstring-ratchet-metrics.json" \
			|| true
	)"

	if [[ "$hook_governance_scope" == "project-local" ]]; then
		hook_scope_manifest="$(mktemp "${TMPDIR:-/tmp}/verify-work-hook-scope.XXXXXX")"
		hook_inventory_output="$(mktemp "${TMPDIR:-/tmp}/verify-work-repo-profile-matrix.XXXXXX")"
		hook_rollout_output="$(mktemp "${TMPDIR:-/tmp}/verify-work-rollout-check-report.XXXXXX")"
		hook_docstring_output="$(mktemp "${TMPDIR:-/tmp}/verify-work-docstring-ratchet-report.XXXXXX")"
		hook_temp_paths+=(
			"$hook_scope_manifest"
			"$hook_inventory_output"
			"$hook_rollout_output"
			"$hook_docstring_output"
		)

		jq -n \
			--arg workspaceRoot "$workspace_root" \
			--arg repoName "$current_repo_name" \
			'{
				workspace_root: $workspaceRoot,
				repos: {
					in_scope: [$repoName],
					excluded: []
				}
			}' > "$hook_scope_manifest"
		log_info "[verify-work] hook-governance scope: project-local (repo=$current_repo_name)"
		return 0
	fi

	hook_scope_manifest="$(
		first_existing_path \
			"$repo_root/docs/hooks-governance/repo-scope.manifest.json" \
			"$repo_root/codex/docs/hooks-governance/repo-scope.manifest.json" \
			|| true
	)"
	hook_inventory_output="$repo_root/docs/hooks-governance/repo-profile-matrix.json"
	hook_rollout_output="$repo_root/docs/hooks-governance/rollout-check-report.json"
	hook_docstring_output="$repo_root/docs/hooks-governance/docstring-ratchet-report.json"
	mkdir -p "$(dirname "$hook_inventory_output")"
	log_info "[verify-work] hook-governance scope: workspace"
}

# format_hook_governance_reports formats workspace-scoped hook-governance report files (inventory, rollout, docstring) with `pnpm fmt` after making their paths relative to the repo root; it is a no-op when scope is not "workspace" or no report files exist, and it prints an error and returns non-zero if `pnpm` is not available.
format_hook_governance_reports() {
	if [[ "$hook_governance_scope" != "workspace" ]]; then
		return 0
	fi

	local -a report_paths=()
	local path
	if [[ -n "$hook_inventory_output" && -f "$hook_inventory_output" ]]; then
		path="$hook_inventory_output"
		if [[ "$path" == "$repo_root/"* ]]; then
			path="${path#"$repo_root"/}"
		fi
		report_paths+=("$path")
	fi
	if [[ -n "$hook_rollout_output" && -f "$hook_rollout_output" ]]; then
		path="$hook_rollout_output"
		if [[ "$path" == "$repo_root/"* ]]; then
			path="${path#"$repo_root"/}"
		fi
		report_paths+=("$path")
	fi
	if [[ -n "$hook_docstring_output" && -f "$hook_docstring_output" ]]; then
		path="$hook_docstring_output"
		if [[ "$path" == "$repo_root/"* ]]; then
			path="${path#"$repo_root"/}"
		fi
		report_paths+=("$path")
	fi

	if (( ${#report_paths[@]} == 0 )); then
		return 0
	fi

	if ! command -v pnpm >/dev/null 2>&1; then
		echo "[verify-work] pnpm is required to format hook-governance workspace reports"
		return 1
	fi

	pnpm fmt "${report_paths[@]}" >/dev/null
}

declare -a gate_ids=()
declare -a gate_exec_classes=()
declare -a gate_failure_defaults=()

add_gate() {
	local gate_id="$1"
	local execution_class="$2"
	local failure_default="$3"
	gate_ids+=("$gate_id")
	gate_exec_classes+=("$execution_class")
	gate_failure_defaults+=("$failure_default")
}

build_gate_plan() {
	gate_ids=()
	gate_exec_classes=()
	gate_failure_defaults=()

	add_gate "preflight" "serial_guarded" "contract_policy"

	if [[ "$fast_mode" -eq 1 ]]; then
		add_gate "ci-check-alignment" "read_only_parallel" "contract_policy"
		add_gate "hook-governance-inventory" "serial_guarded" "contract_policy"
		add_gate "hook-governance-rollout-check" "read_only_parallel" "contract_policy"
		add_gate "hook-governance-docstring-ratchet" "read_only_parallel" "contract_policy"
		add_gate "hook-governance-format-reports" "serial_guarded" "contract_policy"
		add_gate "validate-codestyle-fast" "read_only_parallel" "transient_infra"
	else
		add_gate "hook-governance-inventory" "serial_guarded" "contract_policy"
		add_gate "hook-governance-rollout-check" "read_only_parallel" "contract_policy"
		add_gate "hook-governance-docstring-ratchet" "read_only_parallel" "contract_policy"
		add_gate "hook-governance-format-reports" "serial_guarded" "contract_policy"
		add_gate "validate-codestyle" "serial_guarded" "internal_unknown"
	fi
}

run_gate_command() {
	local gate_id="$1"

	case "$gate_id" in
		preflight)
			echo
			echo "==> codex-preflight"
			bash "$repo_root/scripts/codex-preflight.sh" \
				--stack "$stack" \
				--mode required \
				--bins "$bins_csv" \
				--paths "$paths_csv"
			;;
		ci-check-alignment)
			echo
			echo "==> ci-check-alignment"
			run_ci_check_alignment_gate
			;;
		hook-governance-inventory)
			echo
			echo "==> hook-governance-inventory"
			if [[ -z "$hook_inventory_builder" ]]; then
				echo "[verify-work] hook-governance inventory script not found; skipping"
				return 0
			fi
			if [[ -z "$hook_scope_manifest" || ! -f "$hook_scope_manifest" ]]; then
				echo "[verify-work] hook-governance scope manifest missing"
				return 1
			fi
			local hook_project_root
			hook_project_root="$(dirname "$(dirname "$hook_inventory_builder")")"
			(
				cd "$hook_project_root"
				UV_CACHE_DIR="${UV_CACHE_DIR:-$repo_root/.cache/uv-python-types-cache}" \
				UV_PROJECT_ENVIRONMENT="${UV_PROJECT_ENVIRONMENT:-$repo_root/.cache/uv-python-types}" \
				uv run --python 3.12 --group dev python "$hook_inventory_builder" \
				--manifest "$hook_scope_manifest" \
				--out "$hook_inventory_output"
			)
			;;
		hook-governance-rollout-check)
			echo
			echo "==> hook-governance-rollout-check"
			if [[ -z "$hook_rollout_checker" ]]; then
				echo "[verify-work] rollout_check.py not found; skipping"
				return 0
			fi
			if [[ "$hook_governance_scope" == "project-local" && ! -f "$repo_root/.codex/hook-conformance.json" ]]; then
				echo "[verify-work] project-local rollout check skipped: missing optional local conformance artifact (.codex/hook-conformance.json)"
				return 0
			fi
			if [[ -z "$hook_inventory_output" || ! -f "$hook_inventory_output" ]]; then
				echo "[verify-work] hook-governance inventory output missing"
				return 1
			fi
			python3 "$hook_rollout_checker" \
				--inventory "$hook_inventory_output" \
				--recovery-slo-hours 24 \
				--out "$hook_rollout_output"
			;;
		hook-governance-docstring-ratchet)
			echo
			echo "==> hook-governance-docstring-ratchet"
			if [[ -z "$hook_docstring_ratchet_evaluator" ]]; then
				echo "[verify-work] evaluate_docstring_ratchet.py not found; skipping"
				return 0
			fi
			if [[ -z "$hook_classification_input" || ! -f "$hook_classification_input" ]]; then
				echo "[verify-work] hook-governance classification input missing"
				return 1
			fi
			if [[ -z "$hook_metrics_input" || ! -f "$hook_metrics_input" ]]; then
				echo "[verify-work] hook-governance metrics input missing"
				return 1
			fi
			python3 "$hook_docstring_ratchet_evaluator" \
				--classification "$hook_classification_input" \
				--metrics "$hook_metrics_input" \
				--window-days 14 \
				--out "$hook_docstring_output"
			;;
		hook-governance-format-reports)
			echo
			echo "==> hook-governance-format-reports"
			format_hook_governance_reports
			;;
		validate-codestyle)
			echo
			echo "==> validate-codestyle"
			bash "$repo_root/scripts/validate-codestyle.sh" --repo-root "$repo_root"
			;;
		validate-codestyle-fast)
			echo
			echo "==> validate-codestyle --fast"
			local validate_args=(--repo-root "$repo_root" --fast)
			if [[ "$changed_only" -eq 1 ]]; then
				validate_args+=(--changed-only)
			else
				validate_args+=(--all)
			fi
			if [[ "$strict_mode" -eq 1 ]]; then
				validate_args+=(--strict)
			fi
			bash "$repo_root/scripts/validate-codestyle.sh" "${validate_args[@]}"
			;;
		*)
			echo "[verify-work] unknown gate id: $gate_id" >&2
			return 2
			;;
	esac
}

run_id=""
run_dir=""
runs_dir=""
run_mode="fresh"
run_source_id=""
run_start_epoch=0

write_run_header() {
	jq -n \
		--arg runId "$run_id" \
		--arg mode "$run_mode" \
		--arg sourceRunId "$run_source_id" \
		--arg startedAt "$(iso_now)" \
		--arg resumeFromGateId "${resume_from:-}" \
		--arg repoRoot "$repo_root" \
		--arg providerClass "$provider_class" \
		--arg schemaVersion "$schema_version" \
		--arg contractVersion "$contract_version" \
		--arg contractFingerprint "$contract_fingerprint" \
		--argjson laneFastMode "$lane_fast_mode_json" \
		--argjson laneChangedOnly "$lane_changed_only_json" \
		--argjson laneStrictMode "$lane_strict_mode_json" \
		'{
			runId: $runId,
			mode: $mode,
			sourceRunId: (if $sourceRunId == "" then null else $sourceRunId end),
			status: "running",
			startedAt: $startedAt,
			resumeFromGateId: (if $resumeFromGateId == "" then null else $resumeFromGateId end),
			repoRoot: $repoRoot,
			providerClass: $providerClass,
			schemaVersion: $schemaVersion,
			contractVersion: $contractVersion,
			contractFingerprint: $contractFingerprint,
			lane: {
				fastMode: $laneFastMode,
				changedOnly: $laneChangedOnly,
				strictMode: $laneStrictMode
			},
			safetyCoverage: {
				local: [
					{
						name: "secrets:staged",
						command: "pnpm run secrets:staged",
						status: "available_not_run_by_verify_work",
						scope: "staged_content"
					},
					{
						name: "semgrep:changed",
						command: "pnpm run semgrep:changed",
						status: "available_not_run_by_verify_work",
						scope: "changed_src_files"
					}
				],
				aggregate: {
					name: "safety:local",
					command: "pnpm run safety:local",
					status: "available_not_run_by_verify_work"
				},
				ciOwned: [
					{
						name: "security-scan",
						provider: "circleci",
						command: "bash scripts/check-semgrep-full.sh",
						status: "ci_owned"
					}
				],
				externalRequired: [
					{
						name: "semgrep-cloud-platform/scan",
						provider: "semgrep-cloud",
						status: "external_required_check"
					}
				]
			}
		}' > "$run_dir/run.json"
}

record_gate_result() {
	local gate_id="$1"
	local execution_class="$2"
	local attempt="$3"
	local status="$4"
	local failure_class="$5"
	local started_at="$6"
	local finished_at="$7"
	local next_action="$8"
	local exit_code="$9"
	local max_attempts="${10}"
	local first_failure_attempt="${11}"
	local first_failure_class="${12}"
	local first_failure_exit_code="${13}"
	local first_failure_at="${14}"
	local retry_decision="${15}"
	local retry_reason="${16}"
	local next_attempt="${17}"
	local owner="${18}"
	local stop_reason="${19}"
	local gate_file="$run_dir/gates/$gate_id.json"

	jq -n \
		--arg gateId "$gate_id" \
		--arg executionClass "$execution_class" \
		--argjson attempt "$attempt" \
		--argjson maxAttempts "$max_attempts" \
		--arg status "$status" \
		--arg failureClass "$failure_class" \
		--arg startedAt "$started_at" \
		--arg finishedAt "$finished_at" \
		--arg nextAction "$next_action" \
		--argjson exitCode "$exit_code" \
		--arg firstFailureAttempt "$first_failure_attempt" \
		--arg firstFailureClass "$first_failure_class" \
		--argjson firstFailureExitCode "$first_failure_exit_code" \
		--arg firstFailureAt "$first_failure_at" \
		--arg retryDecision "$retry_decision" \
		--arg retryReason "$retry_reason" \
		--arg nextAttempt "$next_attempt" \
		--arg owner "$owner" \
		--arg stopReason "$stop_reason" \
		'{
			gateId: $gateId,
			executionClass: $executionClass,
			attempt: $attempt,
			status: $status,
			failureClass: $failureClass,
			startedAt: $startedAt,
			finishedAt: $finishedAt,
			nextAction: $nextAction,
			exitCode: $exitCode,
			attemptLedger: {
				schemaVersion: "attempt-ledger/v1",
				command: ("verify-work:" + $gateId),
				attempt: $attempt,
				maxAttempts: $maxAttempts,
				firstFailure: (
					if $firstFailureAt == "" then null else {
						attempt: ($firstFailureAttempt | tonumber),
						failureClass: $firstFailureClass,
						exitCode: $firstFailureExitCode,
						observedAt: $firstFailureAt
					} end
				),
				retryDecision: {
					decision: $retryDecision,
					reason: $retryReason,
					nextAttempt: (if $nextAttempt == "" then null else ($nextAttempt | tonumber) end)
				},
				owner: $owner,
				stopReason: (if $stopReason == "" then null else $stopReason end),
				nextAction: $nextAction,
				evidenceRefs: [("verify-work:gate:" + $gateId)]
			},
			recoveryEvent: (
				if $status == "passed" then null else {
					schemaVersion: "recovery-event/v1",
					eventId: ("verify-work:" + $gateId + ":attempt-" + ($attempt | tostring)),
					command: ("verify-work:" + $gateId),
					attempt: $attempt,
					owner: $owner,
					failureClass: $failureClass,
					stopReason: $stopReason,
					nextAction: $nextAction,
					retryDecision: $retryDecision,
					evidenceRefs: [("verify-work:gate:" + $gateId)]
				} end
			)
		}' > "$gate_file"
}

recovery_owner_for_failure() {
	local failure_class="$1"
	case "$failure_class" in
		transient_infra) echo "external_service" ;;
		contract_policy) echo "codex" ;;
		*) echo "codex" ;;
	esac
}

record_reused_gate_result() {
	local gate_id="$1"
	local source_gate_file="$2"
	local gate_file="$run_dir/gates/$gate_id.json"
	jq \
		--arg sourceRunId "$run_source_id" \
		'. + {reused: true, sourceRunId: $sourceRunId}' \
		"$source_gate_file" > "$gate_file"
}

run_gate_with_retry() {
	local gate_id="$1"
	local execution_class="$2"
	local failure_default="$3"
	local max_retries=0
	local attempt=1
	local next_action=""
	local first_failure_attempt=""
	local first_failure_class=""
	local first_failure_exit_code=0
	local first_failure_at=""

	if [[ "$execution_class" == "read_only_parallel" && "$failure_default" == "transient_infra" ]]; then
		max_retries="$(retry_budget)"
	fi
	local max_attempts=$((max_retries + 1))

	while true; do
		local started_at
		started_at="$(iso_now)"
		local output_file
		output_file="$(mktemp)"
		local exit_code
		if run_gate_command "$gate_id" >"$output_file" 2>&1; then
			exit_code=0
		else
			exit_code=$?
		fi

		if [[ "$json_mode" -eq 1 ]]; then
			cat "$output_file" >&2
		else
			cat "$output_file"
		fi

		if [[ "$exit_code" -eq 0 ]]; then
			record_gate_result \
				"$gate_id" \
				"$execution_class" \
				"$attempt" \
				"passed" \
				"internal_unknown" \
				"$started_at" \
				"$(iso_now)" \
				"none" \
				0 \
				"$max_attempts" \
				"$first_failure_attempt" \
				"$first_failure_class" \
				"$first_failure_exit_code" \
				"$first_failure_at" \
				"none" \
				"gate_passed" \
				"" \
				"codex" \
				""
			rm -f "$output_file"
			return 0
		fi

		local failure_class="$failure_default"
		if [[ "$failure_default" == "transient_infra" ]] && ! is_transient_failure_output "$output_file"; then
			failure_class="internal_unknown"
		fi
		if [[ -z "$first_failure_at" ]]; then
			first_failure_attempt="$attempt"
			first_failure_class="$failure_class"
			first_failure_exit_code="$exit_code"
			first_failure_at="$started_at"
		fi

		if [[ "$failure_class" == "transient_infra" && "$attempt" -le "$max_retries" ]]; then
			local delay_seconds
			delay_seconds="$(retry_delay_seconds "$attempt")"
			log_info "[verify-work] gate '$gate_id' transient failure on attempt $attempt/$((max_retries + 1)); retrying in ${delay_seconds}s"
			next_action="retry"
			record_gate_result \
				"$gate_id" \
				"$execution_class" \
				"$attempt" \
				"blocked" \
				"$failure_class" \
				"$started_at" \
				"$(iso_now)" \
				"$next_action" \
				"$exit_code" \
				"$max_attempts" \
				"$first_failure_attempt" \
				"$first_failure_class" \
				"$first_failure_exit_code" \
				"$first_failure_at" \
				"retry" \
				"retry_transient_read_only_failure" \
				"$((attempt + 1))" \
				"$(recovery_owner_for_failure "$failure_class")" \
				"transient failure remains within retry budget"
			rm -f "$output_file"
			sleep "$delay_seconds"
			attempt=$((attempt + 1))
			continue
		fi

		if [[ "$failure_class" == "contract_policy" ]]; then
			next_action="fix contract/policy mismatch, then rerun from this gate"
		elif [[ "$failure_class" == "transient_infra" ]]; then
			next_action="retry budget exhausted; fix infrastructure blocker and resume"
		else
			next_action="inspect gate output, fix root cause, and rerun"
		fi

		record_gate_result \
			"$gate_id" \
			"$execution_class" \
			"$attempt" \
			"failed" \
			"$failure_class" \
				"$started_at" \
				"$(iso_now)" \
				"$next_action" \
				"$exit_code" \
				"$max_attempts" \
				"$first_failure_attempt" \
				"$first_failure_class" \
				"$first_failure_exit_code" \
				"$first_failure_at" \
				"stop" \
				"$next_action" \
				"" \
				"$(recovery_owner_for_failure "$failure_class")" \
				"$next_action"
		rm -f "$output_file"
		return 1
	done
}

hydrate_prior_passes() {
	local source_run_dir="$1"
	local start_index="$2"
	local idx

	for ((idx = 0; idx < start_index; idx++)); do
		local gate_id="${gate_ids[$idx]}"
		local source_gate_file="$source_run_dir/gates/$gate_id.json"
		if [[ ! -f "$source_gate_file" ]]; then
			echo "[verify-work] resume blocked: missing prior gate result for '$gate_id'" >&2
			return 1
		fi
		local status
		status="$(jq -r '.status // ""' "$source_gate_file")"
		if [[ "$status" != "passed" ]]; then
			echo "[verify-work] resume blocked: gate '$gate_id' is not passed in source run" >&2
			return 1
		fi
		record_reused_gate_result "$gate_id" "$source_gate_file"
	done
	return 0
}

find_resume_source_run_dir() {
	local candidate
	if [[ ! -d "$runs_dir" ]]; then
		return 1
	fi

	while IFS= read -r candidate; do
		[[ -n "$candidate" ]] || continue
		[[ -f "$candidate/run.json" && -f "$candidate/summary.json" ]] || continue
		[[ "$candidate" == "$run_dir" ]] && continue
		local same_root same_schema same_contract same_contract_fingerprint same_provider same_lane
		same_root="$(jq -r --arg repoRoot "$repo_root" '.repoRoot == $repoRoot' "$candidate/run.json" 2>/dev/null || echo false)"
		same_schema="$(jq -r --arg schemaVersion "$schema_version" '.schemaVersion == $schemaVersion' "$candidate/run.json" 2>/dev/null || echo false)"
		same_contract="$(jq -r --arg contractVersion "$contract_version" '.contractVersion == $contractVersion' "$candidate/run.json" 2>/dev/null || echo false)"
		same_contract_fingerprint="$(
			jq -r \
				--arg contractFingerprint "$contract_fingerprint" \
				--argjson allowLegacyMissingFingerprint "$(if [[ "$contract_fingerprint" == "missing" ]]; then echo true; else echo false; fi)" \
				'
					if has("contractFingerprint") then
						.contractFingerprint == $contractFingerprint
					else
						$allowLegacyMissingFingerprint
					end
				' "$candidate/run.json" 2>/dev/null || echo false
		)"
		same_provider="$(jq -r --arg providerClass "$provider_class" '.providerClass == $providerClass' "$candidate/run.json" 2>/dev/null || echo false)"
		same_lane="$(
			jq -r \
				--argjson laneFastMode "$lane_fast_mode_json" \
				--argjson laneChangedOnly "$lane_changed_only_json" \
				--argjson laneStrictMode "$lane_strict_mode_json" \
				'((if (.lane.fastMode == null) then false else .lane.fastMode end) == $laneFastMode) and ((if (.lane.changedOnly == null) then true else .lane.changedOnly end) == $laneChangedOnly) and ((if (.lane.strictMode == null) then false else .lane.strictMode end) == $laneStrictMode)' \
				"$candidate/run.json" 2>/dev/null || echo false
		)"
		if [[ "$same_root" == "true" && "$same_schema" == "true" && "$same_contract" == "true" && "$same_contract_fingerprint" == "true" && "$same_provider" == "true" && "$same_lane" == "true" ]]; then
			echo "$candidate"
			return 0
		fi
	done < <(ls -1dt "$runs_dir"/* 2>/dev/null || true)

	return 1
}

finalize_run() {
	local overall_status="$1"
	local failed_gate_id="$2"
	local duration_ms="$3"

	jq \
		--arg status "$overall_status" \
		--arg finishedAt "$(iso_now)" \
		'.status = $status | .finishedAt = $finishedAt' \
		"$run_dir/run.json" > "$run_dir/run.json.tmp"
	mv "$run_dir/run.json.tmp" "$run_dir/run.json"

	jq -n \
		--arg runId "$run_id" \
		--arg overallStatus "$overall_status" \
		--arg failedGateId "$failed_gate_id" \
		--arg freshVsResumed "$run_mode" \
		--argjson durationMs "$duration_ms" \
		'{
			runId: $runId,
			overallStatus: $overallStatus,
			failedGateId: (if $failedGateId == "" then null else $failedGateId end),
			freshVsResumed: $freshVsResumed,
			durationMs: $durationMs
		}' > "$run_dir/summary.json"
}

prune_runs() {
	local keep_count=50
	local latest_failed=""
	local dirs=()
	local dir

	while IFS= read -r dir; do
		[[ -n "$dir" ]] || continue
		dirs+=("$dir")
	done < <(ls -1dt "$runs_dir"/* 2>/dev/null || true)

	if (( ${#dirs[@]} <= keep_count )); then
		return 0
	fi

	for dir in "${dirs[@]}"; do
		if [[ -f "$dir/summary.json" ]]; then
			local status
			status="$(jq -r '.overallStatus // ""' "$dir/summary.json" 2>/dev/null || echo "")"
			if [[ "$status" == "failed" || "$status" == "blocked" ]]; then
				latest_failed="$dir"
				break
			fi
		fi
	done

	local index=0
	for dir in "${dirs[@]}"; do
		index=$((index + 1))
		if (( index <= keep_count )); then
			continue
		fi
		if [[ -n "$latest_failed" && "$dir" == "$latest_failed" ]]; then
			continue
		fi
		rm -rf "$dir"
	done
}

while (( $# > 0 )); do
	case "$1" in
		--all|--all-skills)
			changed_only=0
			shift
			;;
		--changed-only)
			changed_only=1
			shift
			;;
		--strict)
			strict_mode=1
			shift
			;;
		--fast)
			fast_mode=1
			shift
			;;
		--resume-from)
			resume_from="${2:-}"
			if [[ -z "$resume_from" ]]; then
				echo "[verify-work] --resume-from requires a gate id" >&2
				exit 2
			fi
			shift 2
			;;
		--json)
			json_mode=1
			shift
			;;
		--repo-root)
			repo_root="${2:-}"
			if [[ -z "$repo_root" || "$repo_root" == -* ]]; then
				echo "[verify-work] --repo-root requires a path" >&2
				exit 2
			fi
			shift 2
			;;
		--project-governance)
			hook_governance_scope="project-local"
			project_governance_flag=1
			shift
			;;
		--workspace-governance)
			hook_governance_scope="workspace"
			workspace_governance_flag=1
			shift
			;;
		-h|--help)
			usage
			exit 0
			;;
		*)
			echo "[verify-work] unknown argument: $1" >&2
			usage >&2
			exit 2
			;;
	esac
done

if [[ "$project_governance_flag" -eq 1 && "$workspace_governance_flag" -eq 1 ]]; then
	echo "[verify-work] --project-governance and --workspace-governance are mutually exclusive" >&2
	exit 2
fi

if [[ -z "$repo_root" ]]; then
	repo_root="$REPO_ROOT"
fi

cd "$repo_root"
log_info "[verify-work] repo root: $repo_root"

if [[ -x "$repo_root/scripts/check-git-common-config.sh" ]]; then
	bash "$repo_root/scripts/check-git-common-config.sh"
fi

current_git_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd -P)"
current_repo_name="$(basename "$current_git_root")"
workspace_root="$(dirname "$current_git_root")"

if ! prepare_normalized_required_checks_manifest; then
	exit 1
fi

stack="$(detect_stack)"
bins_csv="$(preflight_bins_csv "$stack")"
paths_csv="$(preflight_paths_csv "$stack")"
provider_class="$(compute_provider_class)"
schema_version="$(compute_schema_version)"
contract_version="$(compute_contract_version)"
contract_fingerprint="$(compute_contract_fingerprint)"
prepare_hook_governance_inputs

build_gate_plan

refresh_lane_metadata

start_index=0
if [[ -n "$resume_from" ]]; then
	run_mode="resume"
	if [[ "$contract_fingerprint" == "unknown" ]]; then
		echo "[verify-work] resume blocked: deterministic contract fingerprint is unavailable" >&2
		echo "[verify-work] install node, shasum, or openssl to enable safe resume matching" >&2
		exit 1
	fi
	found_resume_gate=0
	for idx in "${!gate_ids[@]}"; do
		if [[ "${gate_ids[$idx]}" == "$resume_from" ]]; then
			start_index="$idx"
			found_resume_gate=1
			break
		fi
	done
	if [[ "$found_resume_gate" -ne 1 ]]; then
		echo "[verify-work] unknown gate id for --resume-from: $resume_from" >&2
		echo "[verify-work] available gates: ${gate_ids[*]}" >&2
		exit 2
	fi
fi

runs_dir="$repo_root/.harness/runs"
mkdir -p "$runs_dir"
run_start_epoch="$(date +%s)"
run_id="$(date -u +"%Y%m%dT%H%M%SZ")-$$"
run_dir="$runs_dir/$run_id"
mkdir -p "$run_dir/gates"
write_run_header

if [[ "$run_mode" == "resume" ]]; then
	source_run_dir="$(find_resume_source_run_dir || true)"
	if [[ -z "${source_run_dir:-}" ]]; then
		echo "[verify-work] no compatible prior run found for resume (contract/provider/root/fingerprint must match)" >&2
		rm -rf "$run_dir"
		exit 1
	fi
	run_source_id="$(basename "$source_run_dir")"
	write_run_header
	if ! hydrate_prior_passes "$source_run_dir" "$start_index"; then
		rm -rf "$run_dir"
		exit 1
	fi
fi

failed_gate_id=""
overall_status="passed"

idx="$start_index"
while (( idx < ${#gate_ids[@]} )); do
	execution_class="${gate_exec_classes[$idx]}"
	if [[ "$execution_class" == "read_only_parallel" ]]; then
		batch_start="$idx"
		batch_end="$idx"
		for ((j = idx + 1; j < ${#gate_ids[@]}; j++)); do
			if [[ "${gate_exec_classes[$j]}" != "read_only_parallel" ]]; then
				break
			fi
			batch_end="$j"
		done

		declare -a batch_pids=()
		declare -a batch_status_files=()
		for ((j = batch_start; j <= batch_end; j++)); do
			gate_id="${gate_ids[$j]}"
			exec_class="${gate_exec_classes[$j]}"
			failure_default="${gate_failure_defaults[$j]}"
			status_file="$(mktemp)"
			batch_status_files+=("$status_file")
			(
				if run_gate_with_retry "$gate_id" "$exec_class" "$failure_default"; then
					echo "0" > "$status_file"
				else
					echo "1" > "$status_file"
				fi
			) &
			batch_pids+=("$!")
		done

		for pid in "${batch_pids[@]}"; do
			wait "$pid" || true
		done

		batch_failed=0
		for ((j = batch_start; j <= batch_end; j++)); do
			status_file_index=$((j - batch_start))
			status_file="${batch_status_files[$status_file_index]}"
			if [[ "$(cat "$status_file")" != "0" && "$batch_failed" -eq 0 ]]; then
				batch_failed=1
				failed_gate_id="${gate_ids[$j]}"
				overall_status="failed"
			fi
			rm -f "$status_file"
		done

		if [[ "$batch_failed" -eq 1 ]]; then
			break
		fi
		idx=$((batch_end + 1))
		continue
	fi

	gate_id="${gate_ids[$idx]}"
	exec_class="${gate_exec_classes[$idx]}"
	failure_default="${gate_failure_defaults[$idx]}"
	if ! run_gate_with_retry "$gate_id" "$exec_class" "$failure_default"; then
		failed_gate_id="$gate_id"
		overall_status="failed"
		break
	fi
	idx=$((idx + 1))
done

run_end_epoch="$(date +%s)"
duration_ms=$(((run_end_epoch - run_start_epoch) * 1000))
finalize_run "$overall_status" "$failed_gate_id" "$duration_ms"
prune_runs

if [[ "$json_mode" -eq 1 ]]; then
	cat "$run_dir/summary.json"
	else
		echo
		echo "[verify-work] run id: $run_id"
		echo "[verify-work] mode: $run_mode"
		echo "[verify-work] contract version: $contract_version"
		echo "[verify-work] contract fingerprint: $contract_fingerprint"
		if [[ "$overall_status" == "passed" ]]; then
			echo "[verify-work] status: pass"
		else
			resume_hint="$(build_resume_hint_from_run_json "$run_dir/run.json")"
			echo "[verify-work] status: fail (gate: $failed_gate_id)"
			echo "[verify-work] to resume: bash scripts/verify-work.sh --resume-from $failed_gate_id$resume_hint"
		fi
	fi

if [[ "$overall_status" != "passed" ]]; then
	exit 1
fi
