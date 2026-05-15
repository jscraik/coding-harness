#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"

usage() {
	cat <<'USAGE'
Usage: scripts/prepare-worktree.sh [options]

Prepare a freshly created git worktree for local hooks and pre-push checks.

Options:
  --force-install   Run pnpm install even if node_modules already exists
  -h, --help        Show this help text
USAGE
}

force_install=0
while (( $# > 0 )); do
	case "$1" in
		--force-install)
			force_install=1
			shift
			;;
		-h|--help)
			usage
			exit 0
			;;
		*)
			echo "[prepare-worktree] unknown argument: $1" >&2
			usage >&2
			exit 2
			;;
	esac
done
cd "$REPO_ROOT"

if [[ -x "$REPO_ROOT/scripts/check-git-common-config.sh" ]]; then
	"$REPO_ROOT/scripts/check-git-common-config.sh"
fi

if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
	echo "[prepare-worktree] not inside a git work tree" >&2
	exit 1
fi

trust_mise_config_if_present() {
	local mise_config="$REPO_ROOT/.mise.toml"
	if [[ ! -f "$mise_config" ]]; then
		return 0
	fi
	if ! command -v mise >/dev/null 2>&1; then
		return 0
	fi

	echo "[prepare-worktree] trusting repo mise config"
	if ! mise trust --yes "$mise_config" >/dev/null; then
		echo "[prepare-worktree] warning: mise trust failed; continuing with existing trust state" >&2
	fi
}

# origin_branch_exists checks whether the given branch exists on the `origin` remote.
# Returns exit status 0 if the branch exists, 1 if it does not exist, and exits with status 2 on unexpected errors (an error message is printed to stderr).
origin_branch_exists() {
	local branch_name="$1"
	local status=0

	if ! git remote get-url origin >/dev/null 2>&1; then
		return 1
	fi

	git ls-remote --exit-code --heads origin "$branch_name" >/dev/null 2>&1 || status=$?
	if [[ "$status" -eq 0 ]]; then
		return 0
	fi
	if [[ "$status" -eq 2 ]]; then
		return 1
	fi

	echo "[prepare-worktree] failed to check origin branch: $branch_name" >&2
	exit 2
}

# attach_branch_if_detached attaches HEAD to a new uniquely named branch when the repository is in a detached HEAD state (branch name uses the `jscraik/feature/<repo>-worktree-<short_sha>` pattern); if already on a branch it prints that branch.
attach_branch_if_detached() {
	current_branch="$(git symbolic-ref --short -q HEAD || true)"
	if [[ -n "$current_branch" ]]; then
		echo "[prepare-worktree] branch: $current_branch"
		return 0
	fi

	repo_slug="$(basename "$REPO_ROOT" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')"
	if [[ -z "$repo_slug" ]]; then
		repo_slug="worktree"
	fi

	short_sha="$(git rev-parse --short HEAD)"
	branch_base="${BRANCH_PREFIX:-jscraik/feature}/$repo_slug-worktree-$short_sha"
	branch_name="$branch_base"
	suffix=1
	while true; do
		if git show-ref --verify --quiet "refs/heads/$branch_name"; then
			:
		elif origin_branch_exists "$branch_name"; then
			:
		else
			origin_status="$?"
			if [[ "$origin_status" -eq 2 ]]; then
				exit 2
			fi
			break
		fi
		branch_name="$branch_base-$suffix"
		suffix=$((suffix + 1))
	done

	echo "[prepare-worktree] detached HEAD detected; creating branch $branch_name"
	git switch -c "$branch_name"
	if git show-ref --verify --quiet "refs/remotes/origin/main"; then
		git branch --set-upstream-to=origin/main "$branch_name" >/dev/null 2>&1 || true
		echo "[prepare-worktree] tracking origin/main for $branch_name"
		target_ref="origin/main"
		git fetch --quiet origin main && target_ref="FETCH_HEAD" || echo "[prepare-worktree] could not fetch origin/main; using cached origin/main"
		if git merge-base --is-ancestor HEAD "$target_ref"; then
			echo "[prepare-worktree] fast-forwarding $branch_name with origin/main"
			git merge --ff-only "$target_ref"
		else
			echo "[prepare-worktree] $branch_name diverges from origin/main; skipping fast-forward"
		fi
	fi
}

if [[ ! -f package.json ]]; then
	echo "[prepare-worktree] package.json not found; nothing to bootstrap for this repo shape"
	exit 0
fi

trust_mise_config_if_present

if ! command -v pnpm >/dev/null 2>&1; then
	echo "[prepare-worktree] pnpm is required but not on PATH" >&2
	exit 1
fi

if ! command -v node >/dev/null 2>&1; then
	echo "[prepare-worktree] node is required but not on PATH" >&2
	exit 1
fi

echo "[prepare-worktree] repo: $REPO_ROOT"
attach_branch_if_detached

if [[ "$force_install" -eq 1 || ! -d node_modules ]]; then
	echo "[prepare-worktree] installing dependencies (pnpm install)"
	pnpm install
else
	echo "[prepare-worktree] node_modules already present; skipping install"
fi

echo "[prepare-worktree] syncing git hooks"
node scripts/setup-git-hooks.js

echo "[prepare-worktree] ready"
echo "[prepare-worktree] next: bash scripts/verify-work.sh --fast"
