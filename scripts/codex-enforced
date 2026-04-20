#!/usr/bin/env bash
#
# codex-enforced
# Wraps codex with repo-local preflight enforcement and scoped failure learning.
#

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
PREFLIGHT_SCRIPT="${SCRIPT_DIR}/codex-preflight.sh"
LEARN_SCRIPT="${SCRIPT_DIR}/codex-learn"
# WORKTREE_BRANCH_PREFIX: Default branch prefix for auto-created worktrees.
# For Linear-tracked work, use --worktree-slug JSC-XXX-short-description or
# set WORKTREE_BRANCH_PREFIX="codex/JSC-" to preserve ticket traceability.
WORKTREE_BRANCH_PREFIX="codex/feature"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# usage prints the script usage message showing supported options and indicates that remaining arguments are passed through to `codex`.
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
			NEW_ARGS+=("--")
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

# slugify converts a raw string into a lowercase, URL-safe slug, defaults to "task" if empty, and echoes the result truncated to 48 characters.
slugify() {
	local raw="${1:-}"
	local normalized=""
	normalized="$(printf '%s' "${raw}" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-{2,}/-/g')"
	if [[ -z "${normalized}" ]]; then
		normalized="task"
	fi
	printf '%s' "${normalized:0:48}"
}

# ensure_task_worktree creates and switches to a dedicated task worktree (bootstrapping it via scripts/new-task.sh) when running on the `main` branch and the guard is not skipped, then re-executes the wrapper from that worktree.
# It returns immediately if running outside a git repo, not on `main`, or if `SKIP_WORKTREE_GUARD`, `PREFLIGHT_ONLY`, or `LEARN_ONLY` are set; it also ensures a unique branch slug and worktree path before bootstrapping.
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

	if [[ -n "$(git -C "${repo_root}" status --porcelain --untracked-files=normal)" ]]; then
		echo "[codex] refusing to auto-create a task worktree from a dirty main checkout." >&2
		echo "[codex] commit or stash local changes first, or rerun with SKIP_WORKTREE_GUARD=true." >&2
		exit 2
	fi

	if [[ -n "${WORKTREE_SLUG}" ]]; then
		slug_source="${WORKTREE_SLUG}"
	else
		# Extract positional arguments by skipping options and their values
		local positional_args=()
		local skip_next=false
		for arg in "${NEW_ARGS[@]}"; do
			if [[ "${skip_next}" == true ]]; then
				skip_next=false
				continue
			fi
			# Skip long options with values (--option=value or --option value)
			if [[ "${arg}" == --*=* ]]; then
				continue
			elif [[ "${arg}" == --* ]]; then
				# Long option that may have a value in the next arg
				# Common codex options that take values: --model, --max-tokens, --temperature
				if [[ "${arg}" =~ ^--(model|max-tokens|temperature|timeout|config)$ ]]; then
					skip_next=true
				fi
				continue
			elif [[ "${arg}" == -* ]]; then
				# Short option; common ones that take values: -m, -t
				if [[ "${arg}" =~ ^-(m|t)$ ]]; then
					skip_next=true
				fi
				continue
			fi
			# This is a positional argument
			positional_args+=("${arg}")
		done

		# Only use the first positional as slug source if exactly one exists
		if [[ ${#positional_args[@]} -eq 1 ]]; then
			slug_source="${positional_args[0]}"
		fi
	fi

	slug="$(slugify "${slug_source}")"
	base_slug="${slug}"
	local local_collision=0
	local remote_collision=0
	local remote_refs=""
	while :; do
		local_collision=0
		remote_collision=0
		if git -C "${repo_root}" show-ref --verify --quiet "refs/heads/${WORKTREE_BRANCH_PREFIX}/${slug}"; then
			local_collision=1
		fi
		if [[ "${local_collision}" -eq 0 ]] && git -C "${repo_root}" remote get-url origin >/dev/null 2>&1; then
			if ! remote_refs="$(git -C "${repo_root}" ls-remote --heads origin "${WORKTREE_BRANCH_PREFIX}/${slug}" 2>/dev/null)"; then
				echo "[codex] unable to verify remote branch availability for ${WORKTREE_BRANCH_PREFIX}/${slug}; refusing auto-create." >&2
				exit 2
			fi
			if [[ -n "${remote_refs}" ]]; then
				remote_collision=1
			fi
		fi
		if [[ "${local_collision}" -eq 0 && "${remote_collision}" -eq 0 ]]; then
			break
		fi
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

	if ! bash "${SCRIPT_DIR}/new-task.sh" --bootstrap --branch-prefix "${WORKTREE_BRANCH_PREFIX}" --path "${worktree_path}" "${slug}"; then
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
