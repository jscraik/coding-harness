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

bash ./scripts/check-validation-locks.sh

base_ref="$(git merge-base HEAD '@{upstream}' 2>/dev/null || git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main 2>/dev/null || true)"
if [[ -z "$base_ref" ]]; then
	echo "Error: unable to resolve a base ref for pre-push changed-file gates." >&2
	echo "Set an upstream branch or ensure origin/main is available before pushing." >&2
	exit 1
fi

changed_files=""
changed_files="$(git diff --name-only --diff-filter=ACMRDT "$base_ref"...HEAD --)"

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

docs_gate_output="$(mktemp)"
if bash ./scripts/run-harness-gate.sh docs-gate --mode required --json > "$docs_gate_output"; then
	cat "$docs_gate_output"
else
	docs_gate_status=$?
	cat "$docs_gate_output"
	if [[ "$docs_gate_status" -eq 10 ]] && jq -e \
		'(.status == "warn") and (.summary.errors == 0) and ([.findings[]? | select(.severity == "warning") | .id] | length > 0) and ([.findings[]? | select(.severity == "warning") | .id] | all(. == "docs-gate.docs:archive-candidates.docs.archive_candidates.advisory"))' \
		"$docs_gate_output" > /dev/null; then
		echo "Continuing pre-push after docs-gate advisory warnings."
	else
		rm -f "$docs_gate_output"
		exit "$docs_gate_status"
	fi
fi
rm -f "$docs_gate_output"

tmp_changed_files="$(mktemp)"
trap 'rm -f "$tmp_changed_files"' EXIT
git diff --name-only --diff-filter=ACMRDT "$base_ref"...HEAD -- > "$tmp_changed_files"
bash ./scripts/check-diagram-freshness.sh --changed-files "$tmp_changed_files"

bash ./scripts/run-harness-gate.sh tooling-audit --path . --json
bash ./scripts/check-environment.sh
make semgrep-changed
if [[ "${HARNESS_PRE_PUSH_FULL_CODESTYLE:-0}" == "1" ]]; then
	make codestyle
else
	echo "Skipping broad make codestyle in pre-push; run HARNESS_PRE_PUSH_FULL_CODESTYLE=1 git push to enable it."
fi
unset_git_context_env
bash ./scripts/run-package-command.sh pnpm build
