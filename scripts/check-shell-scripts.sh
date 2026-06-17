#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "$REPO_ROOT"

shell_scripts=()

if command -v git >/dev/null 2>&1; then
	while IFS= read -r path; do
		[[ -n "$path" ]] || continue
		shell_scripts+=("$path")
	done < <(
		git ls-files --cached --others --exclude-standard -- \
			'*.sh' \
			'scripts/*' |
			while IFS= read -r path; do
				[[ -f "$path" ]] || continue
				first_line=""
				IFS= read -r first_line <"$path" || true
				if [[ "$path" == *.sh ]] || [[ "$first_line" =~ ^#!.*(bash|sh) ]]; then
					printf '%s\n' "$path"
				fi
			done |
			sort -u
	)
else
	while IFS= read -r path; do
		[[ -n "$path" ]] || continue
		shell_scripts+=("$path")
	done < <(find scripts -type f -name '*.sh' | sort)
fi

if [[ ${#shell_scripts[@]} -eq 0 ]]; then
	echo "[shell-scripts] no shell scripts found"
	exit 0
fi

for path in "${shell_scripts[@]}"; do
	bash -n "$path"
done

echo "[shell-scripts] syntax checked ${#shell_scripts[@]} script(s)"
