#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"

if [[ $# -eq 0 ]]; then
	echo "Usage: bash scripts/run-uv-python.sh <command> [args...]" >&2
	exit 2
fi

if ! command -v uv >/dev/null 2>&1; then
	echo "[run-uv-python] missing required binary: uv" >&2
	exit 1
fi

# This wrapper owns an isolated worktree runtime boundary. Do not inherit a
# user-global cache or environment location, which may be unavailable to hooks
# and would make validation depend on another checkout's mutable state.
export UV_CACHE_DIR="$REPO_ROOT/.cache/uv-python-types-cache"
export UV_PROJECT_ENVIRONMENT="$REPO_ROOT/.cache/uv-python-types"
export UV_MALWARE_CHECK=1

exec uv run --python 3.12 --group dev "$@"
