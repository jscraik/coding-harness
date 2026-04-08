#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"

changed_only=1
fast_mode=0
strict_mode=0
json_mode=0
repo_root=""
resume_from=""

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
  -h, --help         Show this help text
USAGE
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
		js) echo 'git,bash,sed,rg,jq,curl,node,python3,pnpm' ;;
		py) echo 'git,bash,sed,rg,jq,curl,python3' ;;
		rust) echo 'git,bash,sed,rg,jq,curl,python3,cargo' ;;
		repo) echo 'git,bash,sed,rg,jq,curl,python3' ;;
		*) echo "[verify-work] unknown stack: $1" >&2; return 2 ;;
	esac
}

# preflight_paths_csv returns a comma-separated list of repository paths required for preflight verification for the given project stack.
preflight_paths_csv() {
	case "$1" in
		js) echo 'package.json,CODESTYLE.md,CONTRIBUTING.md,Makefile,scripts,scripts/codex-preflight.sh,scripts/codex-preflight-local-memory-legacy.sh,scripts/verify-work.sh,scripts/validate-codestyle.sh' ;;
		py) echo 'pyproject.toml,CODESTYLE.md,CONTRIBUTING.md,Makefile,scripts,scripts/codex-preflight.sh,scripts/codex-preflight-local-memory-legacy.sh,scripts/verify-work.sh,scripts/validate-codestyle.sh' ;;
		rust) echo 'Cargo.toml,CODESTYLE.md,CONTRIBUTING.md,Makefile,scripts,scripts/codex-preflight.sh,scripts/codex-preflight-local-memory-legacy.sh,scripts/verify-work.sh,scripts/validate-codestyle.sh' ;;
		repo) echo 'CODESTYLE.md,CONTRIBUTING.md,Makefile,scripts,scripts/codex-preflight.sh,scripts/codex-preflight-local-memory-legacy.sh,scripts/verify-work.sh,scripts/validate-codestyle.sh' ;;
		*) echo "[verify-work] unknown stack: $1" >&2; return 2 ;;
	esac
}

has_package_script() {
	local script_name="$1"
	[[ -f "$repo_root/package.json" ]] || return 1
	jq -e --arg script_name "$script_name" '(.scripts // {}) | has($script_name)' "$repo_root/package.json" >/dev/null 2>&1
}

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

	if ! jq -e '.activeProvider and (.requiredChecks | type == "array")' "$manifest_path" >/dev/null 2>&1; then
		echo "[verify-work] ci-check-alignment: invalid manifest structure"
		return 1
	fi

	local provider
	provider="$(jq -r '.activeProvider' "$manifest_path")"
	local github_check_names
	github_check_names="$(jq -r '.requiredChecks[]?.githubCheckName // empty' "$manifest_path")"

	if [[ -z "$github_check_names" ]]; then
		echo "[verify-work] ci-check-alignment: no githubCheckName values found"
		if [[ "$strict_mode" -eq 1 ]]; then
			return 1
		fi
		return 0
	fi

	if [[ "$provider" == "circleci" ]]; then
		local suspicious=()
		local circleci_check_names
		circleci_check_names="$(jq -r '.requiredChecks[]? | select((.sourceAppSlug // "") == "circleci") | .githubCheckName // empty' "$manifest_path")"
		while IFS= read -r name; do
			case "$name" in
				lint|typecheck|test|audit|check|build|memory|security-scan|dependency-scan|orb-pinning|docs-gate|linear-gate|risk-policy-gate|consistency-drift-health|pr-template)
					suspicious+=("$name")
					;;
				*)
					;;
			esac
		done <<< "$circleci_check_names"

		if (( ${#suspicious[@]} > 0 )); then
			printf '[verify-work] ci-check-alignment: CircleCI job-like githubCheckName values detected: %s\n' "${suspicious[*]}"
			return 1
		fi
	fi

	echo "[verify-work] ci-check-alignment: manifest check names look aligned"
	return 0
}

compute_contract_version() {
	local manifest_path="$repo_root/.harness/ci-required-checks.json"
	if [[ ! -f "$manifest_path" ]]; then
		echo "1"
		return 0
	fi

	if ! command -v node >/dev/null 2>&1; then
		echo "1"
		return 0
	fi

	node - "$manifest_path" <<'NODE'
const fs = require("node:fs");
const crypto = require("node:crypto");
const path = process.argv[2];
try {
  const raw = JSON.parse(fs.readFileSync(path, "utf8"));
  if (typeof raw.contractVersion === "string" && raw.contractVersion.trim().length > 0) {
    console.log(raw.contractVersion.trim());
    process.exit(0);
  }
  const checks = Array.isArray(raw.requiredChecks) ? raw.requiredChecks : [];
  const tuples = checks.map((entry, index) => ({
    gateId: typeof entry.gateId === "string" && entry.gateId.trim().length > 0 ? entry.gateId : (typeof entry.displayName === "string" ? entry.displayName : `required-check-${index + 1}`),
    provider: typeof entry.sourceAppSlug === "string" ? entry.sourceAppSlug : "",
    externalIdPattern: typeof entry.externalIdPattern === "string" ? entry.externalIdPattern : "",
    githubCheckName: typeof entry.githubCheckName === "string" ? entry.githubCheckName : "",
  }));
  tuples.sort((a, b) => {
    const ak = `${a.gateId}::${a.provider}::${a.externalIdPattern}::${a.githubCheckName}`;
    const bk = `${b.gateId}::${b.provider}::${b.externalIdPattern}::${b.githubCheckName}`;
    return ak.localeCompare(bk);
  });
  const digest = crypto.createHash("sha256").update(JSON.stringify(tuples)).digest("hex").slice(0, 16);
  console.log(digest || "1");
} catch {
  console.log("1");
}
NODE
}

compute_provider_class() {
	local manifest_path="$repo_root/.harness/ci-required-checks.json"
	if [[ ! -f "$manifest_path" ]]; then
		echo "unknown"
		return 0
	fi
	jq -r '.activeProvider // "unknown"' "$manifest_path" 2>/dev/null || echo "unknown"
}

compute_schema_version() {
	local manifest_path="$repo_root/.harness/ci-required-checks.json"
	if [[ ! -f "$manifest_path" ]]; then
		echo "1"
		return 0
	fi
	jq -r '.version // 1' "$manifest_path" 2>/dev/null || echo "1"
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
		add_gate "validate-codestyle-fast" "read_only_parallel" "transient_infra"
	else
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
			contractVersion: $contractVersion
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
	local gate_file="$run_dir/gates/$gate_id.json"

	jq -n \
		--arg gateId "$gate_id" \
		--arg executionClass "$execution_class" \
		--argjson attempt "$attempt" \
		--arg status "$status" \
		--arg failureClass "$failure_class" \
		--arg startedAt "$started_at" \
		--arg finishedAt "$finished_at" \
		--arg nextAction "$next_action" \
		--argjson exitCode "$exit_code" \
		'{
			gateId: $gateId,
			executionClass: $executionClass,
			attempt: $attempt,
			status: $status,
			failureClass: $failureClass,
			startedAt: $startedAt,
			finishedAt: $finishedAt,
			nextAction: $nextAction,
			exitCode: $exitCode
		}' > "$gate_file"
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

	if [[ "$execution_class" == "read_only_parallel" && "$failure_default" == "transient_infra" ]]; then
		max_retries="$(retry_budget)"
	fi

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

		cat "$output_file"

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
				0
			rm -f "$output_file"
			return 0
		fi

		local failure_class="$failure_default"
		if [[ "$failure_default" == "transient_infra" ]] && ! is_transient_failure_output "$output_file"; then
			failure_class="internal_unknown"
		fi

		if [[ "$failure_class" == "transient_infra" && "$attempt" -le "$max_retries" ]]; then
			local delay_seconds
			delay_seconds="$(retry_delay_seconds "$attempt")"
			echo "[verify-work] gate '$gate_id' transient failure on attempt $attempt/$((max_retries + 1)); retrying in ${delay_seconds}s"
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
				"$exit_code"
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
			"$exit_code"
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
		[[ -f "$candidate/run.json" ]] || continue
		[[ "$candidate" == "$run_dir" ]] && continue
		local same_root same_contract same_provider
		same_root="$(jq -r --arg repoRoot "$repo_root" '.repoRoot == $repoRoot' "$candidate/run.json" 2>/dev/null || echo false)"
		same_contract="$(jq -r --arg contractVersion "$contract_version" '.contractVersion == $contractVersion' "$candidate/run.json" 2>/dev/null || echo false)"
		same_provider="$(jq -r --arg providerClass "$provider_class" '.providerClass == $providerClass' "$candidate/run.json" 2>/dev/null || echo false)"
		if [[ "$same_root" == "true" && "$same_contract" == "true" && "$same_provider" == "true" ]]; then
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
		'.status = $status | .finishedAt = "'$(iso_now)'"' \
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
			shift 2
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

if [[ -z "$repo_root" ]]; then
	repo_root="$REPO_ROOT"
fi

cd "$repo_root"
echo "[verify-work] repo root: $repo_root"

stack="$(detect_stack)"
bins_csv="$(preflight_bins_csv "$stack")"
paths_csv="$(preflight_paths_csv "$stack")"
provider_class="$(compute_provider_class)"
schema_version="$(compute_schema_version)"
contract_version="$(compute_contract_version)"

build_gate_plan

start_index=0
if [[ -n "$resume_from" ]]; then
	run_mode="resume"
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
		echo "[verify-work] no compatible prior run found for resume (contract/provider/root must match)" >&2
		exit 1
	fi
	run_source_id="$(basename "$source_run_dir")"
	write_run_header
	if ! hydrate_prior_passes "$source_run_dir" "$start_index"; then
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
		if [[ "$overall_status" == "passed" ]]; then
			echo "[verify-work] status: pass"
		else
			resume_hint=""
			if [[ "$fast_mode" -eq 1 ]]; then
				resume_hint=" --fast"
			fi
			echo "[verify-work] status: fail (gate: $failed_gate_id)"
			echo "[verify-work] to resume: bash scripts/verify-work.sh --resume-from $failed_gate_id$resume_hint"
		fi
	fi

if [[ "$overall_status" != "passed" ]]; then
	exit 1
fi
