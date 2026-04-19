#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"

usage() {
	cat <<'USAGE'
Usage: scripts/new-task-and-bootstrap.sh [new-task options] <slug>

Create a task worktree, bootstrap it, and emit one consolidated JSON payload.

This wrapper:
  1) runs scripts/new-task.sh --json
  2) runs scripts/prepare-worktree.sh --json in the created worktree (with legacy fallback)
  3) prints merged orchestration JSON on stdout

Notes:
  - Do not pass --bootstrap; this wrapper always performs bootstrap itself.
  - All non-JSON progress logs are emitted on stderr.
USAGE
}

if (( $# == 0 )); then
	usage >&2
	exit 2
fi

for arg in "$@"; do
	case "$arg" in
		-h|--help)
			usage
			exit 0
			;;
		--bootstrap)
			echo "[new-task-and-bootstrap] do not pass --bootstrap; bootstrap is automatic in this wrapper" >&2
			exit 2
			;;
	esac
done

if ! command -v jq >/dev/null 2>&1; then
	echo "[new-task-and-bootstrap] jq is required on PATH" >&2
	exit 1
fi

if [[ ! -x "$SCRIPT_DIR/new-task.sh" ]]; then
	echo "[new-task-and-bootstrap] missing executable: $SCRIPT_DIR/new-task.sh" >&2
	exit 1
fi

new_task_json="$("$SCRIPT_DIR/new-task.sh" --json "$@")"
worktree_path="$(jq -r '.worktreePath // empty' <<<"$new_task_json")"

if [[ -z "$worktree_path" ]]; then
	echo "[new-task-and-bootstrap] new-task output did not include worktreePath" >&2
	exit 1
fi

if [[ ! -d "$worktree_path" ]]; then
	echo "[new-task-and-bootstrap] worktree path does not exist: $worktree_path" >&2
	exit 1
fi

if (
	cd "$worktree_path"
	bash scripts/prepare-worktree.sh --help 2>/dev/null | rg -q -- '--json'
); then
	prepare_json="$(
		cd "$worktree_path"
		bash scripts/prepare-worktree.sh --json
	)"
else
	echo "[new-task-and-bootstrap] prepare-worktree.sh has no --json support in target worktree; using compatibility fallback" >&2
	before_branch="$(git -C "$worktree_path" symbolic-ref --short -q HEAD || true)"
	(
		cd "$worktree_path"
		bash scripts/prepare-worktree.sh
	)
	after_branch="$(git -C "$worktree_path" symbolic-ref --short -q HEAD || true)"
	attached_from_detached=false
	if [[ -z "$before_branch" && -n "$after_branch" ]]; then
		attached_from_detached=true
	fi
	prepare_json="$(jq -cn \
		--arg repo_root "$worktree_path" \
		--arg active_branch "$after_branch" \
		--arg next_cmd "bash scripts/verify-work.sh --fast" \
		--arg compat_mode "legacy_prepare_no_json" \
		--argjson attached_from_detached "$attached_from_detached" \
		'{
			repoRoot: $repo_root,
			activeBranch: $active_branch,
			forceInstall: false,
			attachedFromDetached: $attached_from_detached,
			installRan: null,
			hooksSynced: true,
			nextCmd: $next_cmd,
			compatMode: $compat_mode
		}')"
fi

jq -cn \
	--argjson newTask "$new_task_json" \
	--argjson prepare "$prepare_json" \
	'{
		repoRoot: $newTask.repoRoot,
		worktreePath: $newTask.worktreePath,
		baseRef: $newTask.baseRef,
		resolvedBaseRef: $newTask.resolvedBaseRef,
		detachedMode: $newTask.detachedMode,
		branchName: ($newTask.branchName // $prepare.activeBranch),
		runCmdHint: $newTask.runCmdHint,
		appCmd: $newTask.appCmd,
		newTask: $newTask,
		prepareWorktree: $prepare,
		nextCmds: [
			$newTask.bootstrapCmd,
			$newTask.preflightCmd,
			$prepare.nextCmd
		]
	}'
