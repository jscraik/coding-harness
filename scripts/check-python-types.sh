#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"

if ! command -v uv >/dev/null 2>&1; then
	echo "[check-python-types] missing required binary: uv" >&2
	exit 1
fi

export UV_CACHE_DIR="${UV_CACHE_DIR:-$REPO_ROOT/.cache/uv-python-types-cache}"
export UV_PROJECT_ENVIRONMENT="${UV_PROJECT_ENVIRONMENT:-$REPO_ROOT/.cache/uv-python-types}"

cd "$REPO_ROOT"

uv run --python 3.12 --group dev ruff check \
	scripts/check_artifact_type_contracts.py \
	scripts/hook-governance/inventory_repos.py \
	scripts/hook-governance/tests/test_inventory_repos.py
uv run --python 3.12 --group dev pyright
uv run --python 3.12 --group dev python scripts/check_artifact_type_contracts.py
uv run --python 3.12 --group dev pytest \
	scripts/hook-governance/tests/test_inventory_repos.py
