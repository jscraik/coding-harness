#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

unset_git_context_env() {
	local git_env_name
	while IFS= read -r git_env_name; do
		[[ -n "$git_env_name" ]] && unset "$git_env_name"
	done < <(compgen -v GIT_)
}

bash ./scripts/check-hook-critical-config-sync.sh
make codestyle-parity
unset_git_context_env
bash ./scripts/validate-codestyle.sh --fast
bash ./scripts/run-package-command.sh pnpm lint
bash ./scripts/run-package-command.sh pnpm docs:lint
bash ./scripts/run-package-command.sh pnpm typecheck
bash ./scripts/run-package-command.sh pnpm run quality:docstrings
bash ./scripts/run-package-command.sh pnpm run quality:size
bash ./scripts/run-package-command.sh pnpm run quality:behavior-tests
bash ./scripts/run-package-command.sh pnpm run quality:git-env-sanitizer
bash ./scripts/run-package-command.sh pnpm run harness:audit-tracking
make secrets-staged
make docs-style-changed
make related-tests-staged
