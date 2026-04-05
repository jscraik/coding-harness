#!/usr/bin/env bash
#
# codex-learn
# Records preflight failures and writes repo-scoped override suggestions.
#

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
WORKSPACE_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd -P)"
DEFAULT_SCOPE='repo'

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

usage() {
	echo "Usage: codex-learn [--scope auto|global|repo] <command>"
	echo ""
	echo "Commands:"
	echo "  record <error_type> <details>  Record a failure for analysis"
	echo "  analyze                        Analyze failures and suggest overrides"
	echo "  apply                          Write scoped preflight overrides"
	echo "  list                           Show recorded failures"
	echo "  clear                          Clear scoped learning history"
}

realpath_value() {
	python3 -c 'import os, sys; print(os.path.realpath(sys.argv[1]))' "$1"
}

is_path_within_root() {
	local candidate="$1"
	local root="$2"
	[[ "${candidate}" == "${root}" || "${candidate}" == "${root}/"* ]]
}

resolve_safe_global_home() {
	local default_root="${HOME}/.codex"
	local requested_root="${CODEX_HOME:-${default_root}}"
	local resolved_default=''
	local resolved_requested=''

	resolved_default="$(realpath_value "${default_root}")"
	resolved_requested="$(realpath_value "${requested_root}")"
	if is_path_within_root "${resolved_requested}" "${resolved_default}"; then
		printf '%s\n' "${resolved_requested}"
		return 0
	fi

	echo -e "${YELLOW}WARN:${NC} unsafe CODEX_HOME '${resolved_requested}' ignored; using ${resolved_default}" >&2
	printf '%s\n' "${resolved_default}"
}

ensure_safe_write_target() {
	local target="$1"
	local root="$2"
	local parent_dir=''
	local resolved_root=''
	local resolved_parent=''

	resolved_root="$(realpath_value "${root}")"
	parent_dir="$(dirname -- "${target}")"
	resolved_parent="$(realpath_value "${parent_dir}")"
	if ! is_path_within_root "${resolved_parent}" "${resolved_root}"; then
		echo -e "${RED}ERROR:${NC} refusing write outside allowed root: ${target}" >&2
		return 1
	fi

	if [[ -L "${target}" ]]; then
		echo -e "${RED}ERROR:${NC} refusing to write through symlink: ${target}" >&2
		return 1
	fi

	mkdir -p "${parent_dir}"
	resolved_parent="$(realpath_value "${parent_dir}")"
	if ! is_path_within_root "${resolved_parent}" "${resolved_root}"; then
		echo -e "${RED}ERROR:${NC} refusing write outside allowed root: ${target}" >&2
		return 1
	fi

	return 0
}

safe_write_file() {
	local target="$1"
	local root="$2"
	local temp_file=''
	if ! ensure_safe_write_target "${target}" "${root}"; then
		return 1
	fi
	temp_file="$(mktemp "${target}.tmp.XXXXXX")"
	if ! cat > "${temp_file}"; then
		rm -f "${temp_file}"
		return 1
	fi
	mv -f "${temp_file}" "${target}"
}

resolve_scope_context() {
	local requested_scope="${1:-${DEFAULT_SCOPE}}"
	local safe_global_root=''

	case "${requested_scope}" in
		auto|repo)
			LEARN_SCOPE='repo'
			LEARN_DIR="${WORKSPACE_ROOT}/.harness/memory/codex-learned"
			OVERRIDES_FILE="${WORKSPACE_ROOT}/.harness/memory/codex-preflight-overrides.env"
			PREFLIGHT_SCRIPT="${WORKSPACE_ROOT}/scripts/codex-preflight.sh"
			SAFE_WRITE_ROOT="${WORKSPACE_ROOT}"
			;;
		global)
			safe_global_root="$(resolve_safe_global_home)"
			LEARN_SCOPE='global'
			LEARN_DIR="${safe_global_root}/learned"
			OVERRIDES_FILE="${safe_global_root}/preflight-overrides.env"
			PREFLIGHT_SCRIPT="${safe_global_root}/scripts/codex-preflight.sh"
			SAFE_WRITE_ROOT="${safe_global_root}"
			;;
		*)
			echo -e "${RED}ERROR:${NC} invalid scope '${requested_scope}'" >&2
			exit 1
			;;
	esac

	SUGGESTIONS_FILE="${LEARN_DIR}/suggestions.json"
	PROJECT_BRAIN_SUMMARY_FILE="${WORKSPACE_ROOT}/.harness/knowledge/tooling/codex-learn-summary.md"
	mkdir -p "${LEARN_DIR}"
}

check_missing_binaries() {
	local missing=()
	local bin=''

	for bin in git rg fd jq node pnpm; do
		if ! command -v "${bin}" >/dev/null 2>&1; then
			missing+=("${bin}")
		fi
	done

	printf '%s\n' "${missing[@]}" | jq -R . | jq -s .
}

record_failure() {
	local error_type="${1:-unknown}"
	local details="${2:-}"
	local timestamp=''
	local session_id=''
	local record_file=''

	timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
	session_id="$(date +%s)"
	record_file="${LEARN_DIR}/${session_id}.json"

	safe_write_file "${record_file}" "${SAFE_WRITE_ROOT}" <<EOF
{
  "timestamp": "${timestamp}",
  "scope": "${LEARN_SCOPE}",
  "repo_root": $(printf '%s' "${WORKSPACE_ROOT}" | jq -R .),
  "error_type": $(printf '%s' "${error_type}" | jq -R .),
  "details": $(printf '%s' "${details}" | jq -R .),
  "cwd": $(pwd | jq -R .),
  "pwd_files": $(ls -1 2>/dev/null | head -20 | jq -R . | jq -s .),
  "env": {
    "NODE_ENV": $(printf '%s' "${NODE_ENV:-}" | jq -R .),
    "PATH_preview": $(printf '%s' "${PATH:0:160}..." | jq -R .)
  },
  "binaries_missing": $(check_missing_binaries)
}
EOF

	echo -e "${YELLOW}Recorded:${NC} ${error_type}"
	echo "Scope: ${LEARN_SCOPE}"
	echo "Learned: ${record_file}"
}

write_project_brain_summary() {
	local files=("$@")
	local generated_at=''
	local extra_bins='(none)'

	if [[ "${LEARN_SCOPE}" != "repo" ]]; then
		return 0
	fi
	if [[ ! -d "$(dirname -- "${PROJECT_BRAIN_SUMMARY_FILE}")" ]]; then
		return 0
	fi
	if [[ ! -f "${SUGGESTIONS_FILE}" ]]; then
		return 0
	fi

	generated_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
	extra_bins="$(jq -r '.extraBins | if length > 0 then join(", ") else "(none)" end' "${SUGGESTIONS_FILE}")"

	{
		cat <<EOF
# Codex Learn Summary

This file is auto-generated by \`./scripts/codex-learn analyze\`.

**Last generated:** ${generated_at}
**Scope:** ${LEARN_SCOPE}
**Failure store:** \`${LEARN_DIR}\`

## Error frequency
EOF

		if (( ${#files[@]} == 0 )); then
			echo ""
			echo "- (none yet)"
		else
			echo ""
			jq -r '.error_type' "${files[@]}" | sort | uniq -c | sort -rn | head -10 | while read -r count error_type; do
				printf '%s\n' "- ${count}x \`${error_type}\`"
			done
		fi

		cat <<EOF

## Suggested preflight overrides

- Extra bins: ${extra_bins}

## Path hints
EOF

		if jq -e '.pathHints | length > 0' "${SUGGESTIONS_FILE}" >/dev/null; then
			echo ""
			jq -r '.pathHints[]' "${SUGGESTIONS_FILE}" | while read -r hint; do
				printf '%s\n' "- ${hint}"
			done
		else
			echo ""
			echo "- (none)"
		fi

		cat <<'EOF'

## Promotion guide

- Confirmed 3+ times: promote to `rules.md`.
- Still uncertain: keep notes in `hypotheses.md`.
EOF
	} | safe_write_file "${PROJECT_BRAIN_SUMMARY_FILE}" "${SAFE_WRITE_ROOT}"

	echo ""
	echo "Project Brain summary updated: ${PROJECT_BRAIN_SUMMARY_FILE}"
}

analyze_failures() {
	local files=()
	local extra_bins_json='[]'
	local path_hints_json='[]'

	echo -e "${BLUE}Analyzing failure patterns...${NC}"
	echo ""

	mapfile -t files < <(find "${LEARN_DIR}" -maxdepth 1 -type f -name '*.json' ! -name 'suggestions.json' | sort)
	if (( ${#files[@]} == 0 )); then
		echo "No failures recorded yet."
		echo "Failures are recorded automatically when preflight detects issues."
		return 0
	fi

	echo "Scope: ${LEARN_SCOPE}"
	echo "Store: ${LEARN_DIR}"
	echo ""
	echo "Error frequency:"
	jq -r '.error_type' "${files[@]}" | sort | uniq -c | sort -rn | head -10 | while read -r count type; do
		echo "  ${count}× ${type}"
	done

	extra_bins_json="$(
		jq -s 'map(.binaries_missing[]?) | map(select(length > 0)) | unique | sort' "${files[@]}"
	)"
	path_hints_json="$(
		jq -s '
			map(select(.details | type == "string"))
			| map(.details)
			| map(select(test("path|file|missing"; "i")))
			| unique
			| sort
		' "${files[@]}"
	)"

	safe_write_file "${SUGGESTIONS_FILE}" "${SAFE_WRITE_ROOT}" <<EOF
{
  "generatedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "scope": "${LEARN_SCOPE}",
  "preflightScript": $(printf '%s' "${PREFLIGHT_SCRIPT}" | jq -R .),
  "overridesFile": $(printf '%s' "${OVERRIDES_FILE}" | jq -R .),
  "extraBins": ${extra_bins_json},
  "pathHints": ${path_hints_json}
}
EOF

	echo ""
	echo -e "${YELLOW}Suggested preflight overrides:${NC}"
	if jq -e '.extraBins | length > 0' "${SUGGESTIONS_FILE}" >/dev/null; then
		echo "  extra bins: $(jq -r '.extraBins | join(", ")' "${SUGGESTIONS_FILE}")"
	else
		echo "  extra bins: none"
	fi
	if jq -e '.pathHints | length > 0' "${SUGGESTIONS_FILE}" >/dev/null; then
		echo "  path hints:"
		jq -r '.pathHints[]' "${SUGGESTIONS_FILE}" | while read -r hint; do
			echo "    - ${hint}"
		done
	else
		echo "  path hints: none"
	fi
	echo ""
	echo "Suggestions written to: ${SUGGESTIONS_FILE}"
	write_project_brain_summary "${files[@]}"
}

apply_updates() {
	local extra_bins_csv=''

	if [[ ! -f "${SUGGESTIONS_FILE}" ]]; then
		echo "No suggestions to apply. Run 'codex-learn analyze' first."
		return 1
	fi

	extra_bins_csv="$(
		jq -r '
			.extraBins
			| map(select(type == "string"))
			| map(select(test("^[A-Za-z0-9._+-]+$")))
			| unique
			| join(",")
		' "${SUGGESTIONS_FILE}"
	)"
	mkdir -p "$(dirname -- "${OVERRIDES_FILE}")"
	safe_write_file "${OVERRIDES_FILE}" "${SAFE_WRITE_ROOT}" <<EOF
#!/usr/bin/env bash
# Generated by codex-learn apply on $(date -u +"%Y-%m-%dT%H:%M:%SZ")

CODEX_PREFLIGHT_EXTRA_BINS='${extra_bins_csv}'
CODEX_PREFLIGHT_EXTRA_PATHS=''
EOF

	echo -e "${GREEN}Overrides written.${NC}"
	echo "Override file: ${OVERRIDES_FILE}"
	if jq -e '.pathHints | length > 0' "${SUGGESTIONS_FILE}" >/dev/null; then
		echo -e "${YELLOW}Manual review still required for path hints; they were not auto-applied.${NC}"
	fi
}

list_failures() {
	local files=()

	mapfile -t files < <(find "${LEARN_DIR}" -maxdepth 1 -type f -name '*.json' ! -name 'suggestions.json' | sort -r)
	if (( ${#files[@]} == 0 )); then
		echo "No failures recorded."
		return 0
	fi

	echo "Recent failures (${LEARN_SCOPE}):"
	local file=''
	for file in "${files[@]:0:10}"; do
		jq -r '[.timestamp, .error_type, .cwd] | @tsv' "${file}"
	done
}

clear_failures() {
	if [[ ! -d "${LEARN_DIR}" ]]; then
		echo "No learning history recorded."
		return 0
	fi

	read -r -p "Clear ${LEARN_SCOPE} learning history in ${LEARN_DIR}? (yes/no): " confirm
	if [[ "${confirm}" = "yes" ]]; then
		if ! ensure_safe_write_target "${LEARN_DIR}/.keep" "${SAFE_WRITE_ROOT}"; then
			return 1
		fi
		find "${LEARN_DIR}" -maxdepth 1 -type f -delete
		echo "Learning history cleared."
	else
		echo "Cancelled."
	fi
}

scope="${DEFAULT_SCOPE}"
if [[ "${1:-}" == "--scope" ]]; then
	scope="${2:-}"
	shift 2
fi

case "${1:-}" in
	record|analyze|apply|list|clear) ;;
	-h|--help|'')
		usage
		exit 0
		;;
	*)
		usage >&2
		exit 1
		;;
esac

resolve_scope_context "${scope}"

case "${1:-}" in
	record)
		shift
		record_failure "$@"
		;;
	analyze)
		analyze_failures
		;;
	apply)
		apply_updates
		;;
	list)
		list_failures
		;;
	clear)
		clear_failures
		;;
esac
