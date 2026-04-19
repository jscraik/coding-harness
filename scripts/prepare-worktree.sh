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
  --json            Emit machine-readable summary JSON on stdout
  -h, --help        Show this help text
USAGE
}

force_install=0
output_json=0
attached_from_detached=0
active_branch=""
install_ran=0
while (( $# > 0 )); do
	case "$1" in
		--force-install)
			force_install=1
			shift
			;;
		--json)
			output_json=1
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

if [[ "$output_json" -eq 1 ]]; then
	if ! command -v jq >/dev/null 2>&1; then
		echo "[prepare-worktree] --json requires jq on PATH" >&2
		exit 1
	fi
	# Keep human-oriented logs visible on stderr while reserving stdout for JSON.
	exec 3>&1
	exec 1>&2
fi

cd "$REPO_ROOT"

if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
	echo "[prepare-worktree] not inside a git work tree" >&2
	exit 1
fi

attach_branch_if_detached() {
	current_branch="$(git symbolic-ref --short -q HEAD || true)"
	if [[ -n "$current_branch" ]]; then
		active_branch="$current_branch"
		echo "[prepare-worktree] branch: $current_branch"
		return 0
	fi

	repo_slug="$(basename "$REPO_ROOT" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//')"
	if [[ -z "$repo_slug" ]]; then
		repo_slug="worktree"
	fi

	short_sha="$(git rev-parse --short HEAD)"
	branch_base="codex/$repo_slug-worktree-$short_sha"
	branch_name="$branch_base"
	suffix=1
	while git show-ref --verify --quiet "refs/heads/$branch_name"; do
		branch_name="$branch_base-$suffix"
		suffix=$((suffix + 1))
	done

	echo "[prepare-worktree] detached HEAD detected; creating branch $branch_name"
	git switch -c "$branch_name"
	attached_from_detached=1
	active_branch="$branch_name"
	if git show-ref --verify --quiet "refs/remotes/origin/main"; then
		git branch --set-upstream-to=origin/main "$branch_name" >/dev/null 2>&1 || true
		echo "[prepare-worktree] tracking origin/main for $branch_name"
		echo "[prepare-worktree] fast-forwarding $branch_name with origin/main"
		git pull --ff-only origin main
	fi
}

if [[ ! -f package.json ]]; then
	echo "[prepare-worktree] package.json not found; nothing to bootstrap for this repo shape"
	exit 0
fi

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
	install_ran=1
else
	echo "[prepare-worktree] node_modules already present; skipping install"
fi

echo "[prepare-worktree] syncing git hooks"
node scripts/setup-git-hooks.js

echo "[prepare-worktree] ready"
echo "[prepare-worktree] next: bash scripts/verify-work.sh --fast"

if [[ "$output_json" -eq 1 ]]; then
	force_install_json=false
	if [[ "$force_install" -eq 1 ]]; then
		force_install_json=true
	fi

	attached_from_detached_json=false
	if [[ "$attached_from_detached" -eq 1 ]]; then
		attached_from_detached_json=true
	fi

	install_ran_json=false
	if [[ "$install_ran" -eq 1 ]]; then
		install_ran_json=true
	fi

	jq -cn \
		--arg repo_root "$REPO_ROOT" \
		--arg active_branch "$active_branch" \
		--arg next_cmd "bash scripts/verify-work.sh --fast" \
		--argjson force_install "$force_install_json" \
		--argjson attached_from_detached "$attached_from_detached_json" \
		--argjson install_ran "$install_ran_json" \
		'{
			repoRoot: $repo_root,
			activeBranch: $active_branch,
			forceInstall: $force_install,
			attachedFromDetached: $attached_from_detached,
			installRan: $install_ran,
			hooksSynced: true,
			nextCmd: $next_cmd
		}' >&3
fi
