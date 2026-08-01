#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

GLOSSARY_FILE="$REPO_ROOT/UBIQUITOUS_LANGUAGE.md"
MAP_FILE="$REPO_ROOT/UBIQUITOUS-MAP.md"
AGENTS_FILE="$REPO_ROOT/AGENTS.md"

if [[ ! -f "$GLOSSARY_FILE" ]]; then
	echo "[check-ubiquitous-language-link] missing glossary: UBIQUITOUS_LANGUAGE.md" >&2
	exit 1
fi

if [[ ! -f "$MAP_FILE" ]]; then
	echo "[check-ubiquitous-language-link] missing language map: UBIQUITOUS-MAP.md" >&2
	exit 1
fi

if [[ ! -f "$AGENTS_FILE" ]]; then
	echo "[check-ubiquitous-language-link] missing AGENTS.md" >&2
	exit 1
fi

contains_fixed_string() {
	local needle=$1
	local file=$2
	if command -v rg >/dev/null 2>&1; then
		rg --fixed-strings --quiet "$needle" "$file"
	else
		awk -v needle="$needle" 'index($0, needle) { found = 1; exit } END { exit(found ? 0 : 1) }' "$file"
	fi
}

if ! contains_fixed_string "UBIQUITOUS_LANGUAGE.md" "$AGENTS_FILE"; then
	echo "[check-ubiquitous-language-link] AGENTS.md must reference UBIQUITOUS_LANGUAGE.md" >&2
	exit 1
fi

if ! contains_fixed_string "UBIQUITOUS-MAP.md" "$AGENTS_FILE"; then
	echo "[check-ubiquitous-language-link] AGENTS.md must reference UBIQUITOUS-MAP.md" >&2
	exit 1
fi

if ! contains_fixed_string "UBIQUITOUS_LANGUAGE.md" "$MAP_FILE"; then
	echo "[check-ubiquitous-language-link] UBIQUITOUS-MAP.md must reference UBIQUITOUS_LANGUAGE.md" >&2
	exit 1
fi

echo "[check-ubiquitous-language-link] pass"
