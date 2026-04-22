#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"

if [[ $# -eq 0 ]]; then
	echo "Usage: bash scripts/run-harness-gate.sh <harness-subcommand> [args...]" >&2
	exit 2
fi

is_harness_source_repo() {
	[[ -f "$REPO_ROOT/src/cli.ts" ]] || return 1
	[[ -f "$REPO_ROOT/package.json" ]] || return 1

	if command -v python3 >/dev/null 2>&1; then
		python3 - "$REPO_ROOT/package.json" >/dev/null <<'PY'
import json
import sys

path = sys.argv[1]
try:
    with open(path, "r", encoding="utf-8") as handle:
        package_json = json.load(handle)
except Exception as exc:
    print(f"Failed to parse {path} with python3: {exc}", file=sys.stderr)
    raise SystemExit(2)

raise SystemExit(
    0 if package_json.get("name") == "@brainwav/coding-harness" else 1
)
PY
		return $?
	fi

	if command -v jq >/dev/null 2>&1; then
		local package_name
		if ! package_name="$(jq -er '.name // empty' "$REPO_ROOT/package.json" 2>/dev/null)"; then
			echo "Failed to parse $REPO_ROOT/package.json with jq" >&2
			return 2
		fi
		[[ "$package_name" == "@brainwav/coding-harness" ]] && return 0
		return 1
	fi

	if ! command -v node >/dev/null 2>&1; then
		echo "Unable to resolve harness source-repo identity: python3, jq, and node are unavailable." >&2
		return 2
	fi

	node -e '
		const { readFileSync } = require("node:fs");
		const path = process.argv[1];
		try {
			const packageJson = JSON.parse(readFileSync(path, "utf8"));
			process.exit(packageJson.name === "@brainwav/coding-harness" ? 0 : 1);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			process.stderr.write("Failed to parse " + path + ": " + message + "\n");
			process.exit(2);
		}
	' "$REPO_ROOT/package.json" >/dev/null
}

source_repo_status=1
if is_harness_source_repo; then
	source_repo_status=0
else
	source_repo_status="$?"
fi

if [[ "$source_repo_status" -eq 2 ]]; then
	echo "Error: unable to resolve harness source-runner identity from package metadata." >&2
	exit 1
fi

has_fallback_runner() {
	if [[ -x "$REPO_ROOT/scripts/harness-cli.sh" ]]; then
		return 0
	fi
	if command -v mise >/dev/null 2>&1; then
		MISE_RESOLVED="$(mise which harness 2>/dev/null || true)"
		if [[ -n "$MISE_RESOLVED" && -x "$MISE_RESOLVED" ]]; then
			return 0
		fi
	fi
	command -v harness >/dev/null 2>&1
}

if [[ "$source_repo_status" -eq 0 ]]; then
	if command -v pnpm >/dev/null 2>&1; then
		exec pnpm exec tsx "$REPO_ROOT/src/cli.ts" "$@"
	fi
	if [[ "${HARNESS_ALLOW_SOURCE_RUNNER_FALLBACK:-0}" == "1" ]]; then
		echo "Warning: pnpm not found; HARNESS_ALLOW_SOURCE_RUNNER_FALLBACK=1 enabled fallback to non-source harness runners." >&2
	else
		echo "Error: pnpm is required to run the harness source CLI in this repository." >&2
		echo "Set HARNESS_ALLOW_SOURCE_RUNNER_FALLBACK=1 only when you intentionally want to use a non-source harness runner." >&2
		echo "Install pnpm or provide an executable fallback runner (scripts/harness-cli.sh, mise harness, or global harness)." >&2
		exit 1
	fi
fi

if [[ -x "$REPO_ROOT/scripts/harness-cli.sh" ]]; then
	exec bash "$REPO_ROOT/scripts/harness-cli.sh" "$@"
fi

if command -v mise >/dev/null 2>&1; then
	MISE_RESOLVED="$(mise which harness 2>/dev/null || true)"
	if [[ -n "$MISE_RESOLVED" && -x "$MISE_RESOLVED" ]]; then
		exec "$MISE_RESOLVED" "$@"
	fi
fi

if command -v harness >/dev/null 2>&1; then
	exec harness "$@"
fi

echo "Error: unable to resolve a harness runner for this repository." >&2
echo "Install dependencies with:" >&2
echo "  pnpm install" >&2
echo "or run with a local harness install via:" >&2
echo "  pnpm exec harness <command>" >&2
exit 1
