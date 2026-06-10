#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

bash ./scripts/check-validation-locks.sh

base_ref="$(git merge-base HEAD '@{upstream}' 2>/dev/null || git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main 2>/dev/null || true)"
changed_files=""
if [[ -n "$base_ref" ]]; then
	changed_files="$(git diff --name-only --diff-filter=ACMRDT "$base_ref"...HEAD --)"
fi

only_environment_change=false
if [[ -n "$changed_files" ]]; then
	only_environment_change=true
	while IFS= read -r changed_file; do
		[[ -z "$changed_file" ]] && continue
		if [[ "$changed_file" != ".codex/environments/environment.toml" ]]; then
			only_environment_change=false
			break
		fi
	done <<< "$changed_files"
fi

if [[ "$only_environment_change" == true ]]; then
	echo "Environment-only push detected; running check-environment only."
	bash ./scripts/check-environment.sh
	exit 0
fi

pnpm exec tsx src/cli.ts docs-gate --mode required --json

tmp_changed_files="$(mktemp)"
trap 'rm -f "$tmp_changed_files"' EXIT
if [[ -n "$base_ref" ]]; then
	git diff --name-only --diff-filter=ACMRDT "$base_ref"...HEAD -- > "$tmp_changed_files"
fi
bash ./scripts/check-diagram-freshness.sh --changed-files "$tmp_changed_files"

pnpm exec tsx src/cli.ts tooling-audit --path . --json
bash ./scripts/check-environment.sh
make semgrep-changed
make codestyle
pnpm build
