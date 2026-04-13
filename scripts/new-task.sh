#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"

usage() {
	cat <<'USAGE'
Usage: scripts/new-task.sh [options] <slug>

Create a dedicated git worktree and branch for one task, then print the
bootstrap commands to run inside that worktree.

This repository expects one task = one worktree = one branch = one agent thread.

Options:
  --base <ref>            Start the branch from this ref (default: main)
  --branch-prefix <name>  Branch prefix (default: codex)
  --path <dir>            Worktree path (default: ../wt-<slug>)
  -h, --help              Show this help text
USAGE
}

base_ref="main"
branch_prefix="codex"
worktree_path=""
slug=""

while (( $# > 0 )); do
	case "$1" in
		--base)
			base_ref="${2:-}"
			shift 2
			;;
		--branch-prefix)
			branch_prefix="${2:-}"
			shift 2
			;;
		--path)
			worktree_path="${2:-}"
			shift 2
			;;
		-h|--help)
			usage
			exit 0
			;;
		--)
			shift
			break
			;;
		-*)
			echo "[new-task] unknown option: $1" >&2
			usage >&2
			exit 2
			;;
		*)
			slug="$1"
			shift
			break
			;;
	esac
done

if [[ -z "$slug" && $# -gt 0 ]]; then
	slug="$1"
	shift
fi

if [[ -z "$slug" || $# -gt 0 ]]; then
	usage >&2
	exit 2
fi

if [[ ! "$slug" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
	echo "[new-task] slug must be lower-case kebab-case: $slug" >&2
	exit 2
fi

if [[ ! "$branch_prefix" =~ ^[A-Za-z0-9._/-]+$ ]]; then
	echo "[new-task] invalid branch prefix: $branch_prefix" >&2
	exit 2
fi

branch_name="${branch_prefix}/${slug}"

if [[ -z "$worktree_path" ]]; then
	worktree_path="${REPO_ROOT}/../wt-${slug}"
fi

cd "$REPO_ROOT"

git rev-parse --show-toplevel >/dev/null

if git show-ref --verify --quiet "refs/heads/${branch_name}"; then
	echo "[new-task] local branch already exists: ${branch_name}" >&2
	exit 1
fi

if [[ -e "$worktree_path" ]]; then
	echo "[new-task] worktree path already exists: $worktree_path" >&2
	exit 1
fi

echo "[new-task] repo: $REPO_ROOT"
echo "[new-task] base: $base_ref"
echo "[new-task] branch: ${branch_name}"
echo "[new-task] path: $worktree_path"

git worktree add "$worktree_path" -b "${branch_name}" "$base_ref"

echo
echo "[new-task] next:"
echo "  cd \"$worktree_path\""
if [[ -f "$worktree_path/Makefile" ]] && rg -q '^worktree-ready:' "$worktree_path/Makefile"; then
	echo "  make worktree-ready"
else
	echo "  bash scripts/prepare-worktree.sh"
fi
echo "  bash scripts/codex-preflight.sh --mode optional"
