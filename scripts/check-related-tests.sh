#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

related_sources=()
while IFS= read -r path; do
	[[ -n "$path" ]] || continue
	if [[ "$path" =~ ^src/.*\.(ts|tsx|js|jsx|mts|cts)$ ]] && \
		[[ ! "$path" =~ \.d\.ts$ ]] && \
		[[ ! "$path" =~ \.(test|spec)\.(ts|tsx|js|jsx|mts|cts)$ ]]; then
		related_sources+=("$path")
	fi
done < <(git diff --cached --name-only --diff-filter=ACMR)

if [[ ${#related_sources[@]} -eq 0 ]]; then
	echo "No staged src/** implementation changes detected for related tests."
	exit 0
fi

# Git hooks export repo-bound env vars (for example GIT_DIR/GIT_INDEX_FILE)
# that can leak into test subprocesses and break fixture-local git commands.
for git_hook_env in \
	GIT_DIR \
	GIT_WORK_TREE \
	GIT_INDEX_FILE \
	GIT_OBJECT_DIRECTORY \
	GIT_ALTERNATE_OBJECT_DIRECTORIES \
	GIT_QUARANTINE_PATH \
	GIT_REFLOG_ACTION \
	GIT_PREFIX \
	GIT_AUTHOR_NAME \
	GIT_AUTHOR_EMAIL \
	GIT_AUTHOR_DATE \
	GIT_COMMITTER_NAME \
	GIT_COMMITTER_EMAIL \
	GIT_COMMITTER_DATE; do
	unset "$git_hook_env"
done

# Also clear any numbered GIT_PUSH_OPTION_N vars that may be present.
for env_name in $(env | cut -d= -f1 | rg '^GIT_PUSH_OPTION_[0-9]+$' || true); do
	unset "$env_name"
done

pnpm exec vitest related --run --passWithNoTests "${related_sources[@]}"