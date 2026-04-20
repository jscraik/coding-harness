#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"

# usage prints the help message for scripts/new-task.sh, describing the required <slug>, available options (--base, --branch-prefix, --path, --bootstrap, -h/--help), and the script's purpose of creating a task-specific git worktree and branch.
usage() {
	cat <<'USAGE'
Usage: scripts/new-task.sh [options] <slug>

Create a dedicated git worktree and branch for one task, then print the
bootstrap commands to run inside that worktree.

This repository expects one task = one worktree = one branch = one agent thread.

Options:
  --base <ref>            Start the branch from this ref (default: main)
  --branch-prefix <name>  Branch prefix (default: jscraik/feature)
  --path <dir>            Worktree path (default: ../wt-<slug>)
  --bootstrap             Run worktree bootstrap immediately after creation
  -h, --help              Show this help text
USAGE
}

base_ref="main"
branch_prefix="jscraik/feature"
worktree_path=""
bootstrap=0
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
		--bootstrap)
			bootstrap=1
			shift
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
resolved_base_ref="$base_ref"
remote_base_branch=""
remote_name="origin"
explicit_remote_ref=0

if [[ "$base_ref" == refs/remotes/*/* ]]; then
	explicit_remote_ref=1
	remote_name="${base_ref#refs/remotes/}"
	remote_name="${remote_name%%/*}"
elif [[ "$base_ref" == */* ]]; then
	candidate_remote="${base_ref%%/*}"
	candidate_branch="${base_ref#*/}"
	if git -C "$REPO_ROOT" remote get-url "$candidate_remote" >/dev/null 2>&1; then
		explicit_remote_ref=1
		remote_name="$candidate_remote"
		remote_base_branch="$candidate_branch"
	fi
elif [[ "$base_ref" != *"/"* ]]; then
	if git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/$base_ref"; then
		remote_base_branch="$base_ref"
	elif ! git -C "$REPO_ROOT" rev-parse --verify --quiet "${base_ref}^{commit}" >/dev/null; then
		remote_base_branch="$base_ref"
	fi
fi

if [[ -z "$worktree_path" ]]; then
	worktree_path="${REPO_ROOT}/../wt-${slug}"
fi

cd "$REPO_ROOT"

git rev-parse --show-toplevel >/dev/null

if git show-ref --verify --quiet "refs/heads/${branch_name}"; then
	echo "[new-task] local branch already exists: ${branch_name}" >&2
	exit 1
fi

if git remote get-url origin >/dev/null 2>&1 && git ls-remote --exit-code --heads origin "${branch_name}" >/dev/null 2>&1; then
	echo "[new-task] remote branch already exists on origin: ${branch_name}" >&2
	exit 1
fi

if [[ -e "$worktree_path" ]]; then
	echo "[new-task] worktree path already exists: $worktree_path" >&2
	exit 1
fi

if [[ -n "$remote_base_branch" ]]; then
	if git remote get-url "$remote_name" >/dev/null 2>&1; then
		echo "[new-task] fetching latest $remote_name/$remote_base_branch"
		if ! git fetch --prune "$remote_name" "$remote_base_branch"; then
			if [[ "$explicit_remote_ref" -eq 1 ]]; then
				echo "[new-task] failed to fetch explicit remote base: $base_ref" >&2
				exit 2
			fi
			echo "[new-task] warning: could not fetch $remote_name/$remote_base_branch; continuing with local refs" >&2
		elif git show-ref --verify --quiet "refs/remotes/$remote_name/$remote_base_branch"; then
			resolved_base_ref="refs/remotes/$remote_name/$remote_base_branch"
		elif [[ "$explicit_remote_ref" -eq 1 ]]; then
			echo "[new-task] explicit remote base not found on $remote_name: $base_ref" >&2
			exit 2
		fi
	elif [[ "$explicit_remote_ref" -eq 1 ]]; then
		echo "[new-task] remote '$remote_name' is required for explicit remote base: $base_ref" >&2
		exit 2
	fi
fi

if ! git rev-parse --verify --quiet "${resolved_base_ref}^{commit}" >/dev/null; then
	echo "[new-task] base ref is not a valid commit: $base_ref" >&2
	exit 2
fi

echo "[new-task] repo: $REPO_ROOT"
echo "[new-task] base: $base_ref"
if [[ "$resolved_base_ref" != "$base_ref" ]]; then
	echo "[new-task] resolved base: $resolved_base_ref"
fi
echo "[new-task] branch: ${branch_name}"
echo "[new-task] path: $worktree_path"

git worktree add "$worktree_path" -b "${branch_name}" "$resolved_base_ref"

if [[ "$bootstrap" -eq 1 ]]; then
	echo "[new-task] bootstrapping worktree"
	(
		cd "$worktree_path"
		if [[ -f Makefile ]] && rg -q '^worktree-ready:' Makefile; then
			make worktree-ready
		else
			bash scripts/prepare-worktree.sh
		fi
	)
fi

echo
echo "[new-task] next:"
echo "  cd \"$worktree_path\""
if [[ "$bootstrap" -eq 1 ]]; then
	echo "  # bootstrap already ran (--bootstrap)"
elif [[ -f "$worktree_path/Makefile" ]] && rg -q '^worktree-ready:' "$worktree_path/Makefile"; then
	echo "  make worktree-ready"
else
	echo "  bash scripts/prepare-worktree.sh"
fi
echo "  bash scripts/codex-preflight.sh --mode optional"
