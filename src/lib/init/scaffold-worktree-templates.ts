/**
 * Worktree helper script renderers used by the init scaffold.
 *
 * This module owns the task/worktree shell helpers so `scaffold.ts` can keep
 * its template inventory separate from long generated script bodies.
 *
 * @module lib/init/scaffold-worktree-templates
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AGENT_BRANCH_PREFIX } from "./scaffold-root-command-templates.js";
import { renderInstallCommand } from "./scaffold-shell-templates.js";

/**
 * Generate a bash script that prepares a git worktree for local hooks and checks.
 *
 * @param packageManager - Package manager executable name.
 * @returns The complete `scripts/prepare-worktree.sh` contents.
 */
export function renderPrepareWorktreeScript(packageManager: string): string {
	const installCommand = renderInstallCommand(packageManager);
	return `#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${"${"}BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"

usage() {
	cat <<'USAGE'
Usage: scripts/prepare-worktree.sh [options]

Prepare a freshly created git worktree for local hooks and pre-push checks.

Options:
  --force-install   Run ${installCommand} even if node_modules already exists
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

# attach_branch_if_detached attaches HEAD to a new uniquely named branch when the repository is in a detached HEAD state (branch name uses the \`jscraik/feature/<repo>-worktree-<short_sha>\` pattern); if already on a branch it prints that branch.
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
	branch_base="${AGENT_BRANCH_PREFIX}/$repo_slug-worktree-$short_sha"
	branch_name="$branch_base"
	suffix=1
	while git show-ref --verify --quiet "refs/heads/$branch_name"; do
		branch_name="$branch_base-$suffix"
		suffix=$((suffix + 1))
	done

	echo "[prepare-worktree] detached HEAD detected; creating branch $branch_name"
	git switch -c "$branch_name"
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

if ! command -v ${packageManager} >/dev/null 2>&1; then
	echo "[prepare-worktree] ${packageManager} is required but not on PATH" >&2
	exit 1
fi

if ! command -v node >/dev/null 2>&1; then
	echo "[prepare-worktree] node is required but not on PATH" >&2
	exit 1
fi

echo "[prepare-worktree] repo: $REPO_ROOT"
attach_branch_if_detached

if [[ "$force_install" -eq 1 || ! -d node_modules ]]; then
	echo "[prepare-worktree] installing dependencies (${installCommand})"
	${installCommand}
else
	echo "[prepare-worktree] node_modules already present; skipping install"
fi

echo "[prepare-worktree] syncing git hooks"
node scripts/setup-git-hooks.js

echo "[prepare-worktree] ready"
echo "[prepare-worktree] next: bash scripts/verify-work.sh --fast"
`;
}

/**
 * Generate a bash helper that creates a dedicated worktree and branch for one task.
 *
 * @returns The complete `scripts/new-task.sh` contents.
 */
export function renderNewTaskScript(): string {
	const scriptPath = fileURLToPath(
		new URL("../../../scripts/new-task.sh", import.meta.url),
	);
	return readFileSync(scriptPath, "utf-8");
}
