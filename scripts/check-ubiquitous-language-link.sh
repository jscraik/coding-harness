#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

GLOSSARY_FILE="$REPO_ROOT/UBIQUITOUS_LANGUAGE.md"
AGENTS_FILE="$REPO_ROOT/AGENTS.md"

if [[ ! -f "$GLOSSARY_FILE" ]]; then
	echo "[check-ubiquitous-language-link] missing glossary: UBIQUITOUS_LANGUAGE.md" >&2
	exit 1
fi

if [[ ! -f "$AGENTS_FILE" ]]; then
	echo "[check-ubiquitous-language-link] missing AGENTS.md" >&2
	exit 1
fi

if ! grep -Fq "UBIQUITOUS_LANGUAGE.md" "$AGENTS_FILE"; then
	echo "[check-ubiquitous-language-link] AGENTS.md must reference UBIQUITOUS_LANGUAGE.md" >&2
	exit 1
fi

echo "[check-ubiquitous-language-link] pass"
