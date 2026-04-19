#!/usr/bin/env bash
#
# codex-enforced
# Wraps codex with repo-local preflight enforcement and scoped failure learning.
#

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
PREFLIGHT_SCRIPT="${SCRIPT_DIR}/codex-preflight.sh"
LEARN_SCRIPT="${SCRIPT_DIR}/codex-learn"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

usage() {
	echo "Usage: codex-enforced [options] <prompt>"
	echo ""
	echo "Runs repo-local preflight before executing codex."
	echo ""
	echo "Options:"
	echo "  --skip-preflight    Skip preflight (not recommended)"
	echo "  --preflight-only    Run preflight and exit"
	echo "  --learn-only        Run preflight, record outcome, exit"
	echo "  --worktree-slug     On main, force task worktree slug before codex launch"
	echo "  --help              Show this help"
	echo ""
	echo "All other options passed to codex."
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
	usage
	exit 0
fi

SKIP_PREFLIGHT=false
PREFLIGHT_ONLY=false
LEARN_ONLY=false
SKIP_WORKTREE_GUARD=false
WORKTREE_SLUG=""
ORIGINAL_ARGS=("$@")
NEW_ARGS=()

while (( $# > 0 )); do
	case "${1}" in
		--skip-preflight)
			SKIP_PREFLIGHT=true
			shift
			;;
		--preflight-only)
			PREFLIGHT_ONLY=true
			shift
			;;
		--learn-only)
			LEARN_ONLY=true
			shift
			;;
		--worktree-slug)
			if [[ -z "${2:-}" ]]; then
				echo -e "${RED}ERROR: --worktree-slug requires a value${NC}"
				exit 2
			fi
			WORKTREE_SLUG="${2}"
			shift 2
			;;
		--skip-worktree-guard)
			SKIP_WORKTREE_GUARD=true
			shift
			;;
		--)
			shift
			while (( $# > 0 )); do
				NEW_ARGS+=("${1}")
				shift
			done
			;;
		*)
			NEW_ARGS+=("${1}")
			shift
			;;
	esac
done

slugify() {
	local raw="${1:-}"
	local normalized=""
	normalized="$(printf '%s' "${raw}" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-{2,}/-/g')"
	if [[ -z "${normalized}" ]]; then
		normalized="task"
	fi
	printf '%s' "${normalized:0:48}"
}

ensure_task_worktree() {
	local repo_root=""
	local current_branch=""
	local slug_source=""
	local slug=""
	local base_slug=""
	local worktree_path=""
	local suffix=1

	if [[ "${SKIP_WORKTREE_GUARD}" == true || "${PREFLIGHT_ONLY}" == true || "${LEARN_ONLY}" == true ]]; then
		return 0
	fi

	repo_root="$(git -C "${SCRIPT_DIR}/.." rev-parse --show-toplevel 2>/dev/null || true)"
	if [[ -z "${repo_root}" ]]; then
		return 0
	fi

	current_branch="$(git -C "${repo_root}" symbolic-ref --short -q HEAD || true)"
	if [[ "${current_branch}" != "main" ]]; then
		return 0
	fi

	if [[ -n "${WORKTREE_SLUG}" ]]; then
		slug_source="${WORKTREE_SLUG}"
	else
		for arg in "${NEW_ARGS[@]}"; do
			if [[ "${arg}" == --* ]]; then
				continue
			fi
			slug_source="${arg}"
			break
		done
	fi

	slug="$(slugify "${slug_source}")"
	base_slug="${slug}"
	while git -C "${repo_root}" show-ref --verify --quiet "refs/heads/codex/${slug}"; do
		slug="${base_slug}-${suffix}"
		suffix=$((suffix + 1))
	done

	worktree_path="${repo_root}/../wt-${slug}"
	suffix=1
	while [[ -e "${worktree_path}" ]]; do
		worktree_path="${repo_root}/../wt-${slug}-${suffix}"
		suffix=$((suffix + 1))
	done

	if [[ ! -f "${SCRIPT_DIR}/new-task.sh" ]]; then
		echo -e "${RED}ERROR: worktree helper not found: ${SCRIPT_DIR}/new-task.sh${NC}"
		exit 1
	fi

	echo -e "${BLUE}Main branch guard: creating dedicated task worktree...${NC}"
	echo "  slug: ${slug}"
	echo "  path: ${worktree_path}"

	if ! bash "${SCRIPT_DIR}/new-task.sh" --bootstrap --path "${worktree_path}" "${slug}"; then
		echo -e "${RED}ERROR: failed to create/bootstrap worktree${NC}"
		exit 1
	fi

	echo ""
	echo -e "${GREEN}Re-launching codex from worktree:${NC} ${worktree_path}"
	exec bash "${worktree_path}/scripts/codex-enforced" --skip-worktree-guard "${ORIGINAL_ARGS[@]}"
}

ensure_task_worktree

PREFLIGHT_STATUS=0
if [[ "${SKIP_PREFLIGHT}" == true ]]; then
	echo -e "${YELLOW}WARNING: Skipping preflight (not recommended)${NC}"
else
	echo "Running preflight checks..."
	echo ""

	if [[ ! -x "${PREFLIGHT_SCRIPT}" ]]; then
		echo -e "${RED}ERROR: Preflight script not found: ${PREFLIGHT_SCRIPT}${NC}"
		exit 1
	fi

	if ! "${PREFLIGHT_SCRIPT}"; then
		PREFLIGHT_STATUS=1
		echo ""
		echo -e "${RED}PREFLIGHT FAILED${NC}"
		echo ""

		if [[ -x "${LEARN_SCRIPT}" ]]; then
			echo -e "${BLUE}Recording failure for analysis...${NC}"
			"${LEARN_SCRIPT}" --scope repo record "preflight_failure" "Preflight checks failed" || true
			echo ""
			echo "Run './scripts/codex-learn analyze' to see scoped override suggestions."
		fi

		echo ""
		echo "Fix the issues above before running codex."
		echo ""
		echo "To bypass (not recommended):"
		echo "  ./scripts/codex-enforced --skip-preflight <your prompt>"
		exit 1
	fi

	echo ""
	echo -e "${GREEN}Preflight passed. Proceeding to codex...${NC}"
	echo ""
fi

if [[ "${PREFLIGHT_ONLY}" == true ]]; then
	exit "${PREFLIGHT_STATUS}"
fi

if [[ "${LEARN_ONLY}" == true ]]; then
	echo "Preflight recorded. Exiting."
	exit 0
fi

CODEX_STATUS=0
codex "${NEW_ARGS[@]}" || CODEX_STATUS=$?

if (( CODEX_STATUS != 0 )) && [[ -x "${LEARN_SCRIPT}" ]]; then
	echo ""
	echo -e "${YELLOW}Session ended with errors. Recording for analysis...${NC}"
	"${LEARN_SCRIPT}" --scope repo record "codex_exit_${CODEX_STATUS}" "Codex exited with code ${CODEX_STATUS}" || true
fi

exit "${CODEX_STATUS}"
