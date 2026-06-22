#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
RUN_UV_PYTHON="$REPO_ROOT/scripts/run-uv-python.sh"

cd "$REPO_ROOT"

mode="python-types"
while (( $# > 0 )); do
	case "$1" in
		--artifact-contracts-only)
			mode="artifact-contracts"
			shift
			;;
		-h|--help)
			cat <<'USAGE'
Usage: scripts/check-python-types.sh [--artifact-contracts-only]

Run repo-scoped Python type/lint checks through uv-managed Python 3.12.

Options:
  --artifact-contracts-only  Run only scripts/check_artifact_type_contracts.py
  -h, --help                 Show this help text
USAGE
			exit 0
			;;
		*)
			echo "[check-python-types] unknown argument: $1" >&2
			exit 2
			;;
	esac
done

run_uv() {
	bash "$RUN_UV_PYTHON" "$@"
}

run_artifact_contracts() {
	run_uv python scripts/check_artifact_type_contracts.py
}

if [[ "$mode" == "artifact-contracts" ]]; then
	run_artifact_contracts
	exit 0
fi

	run_uv ruff check \
	scripts/check_artifact_type_contracts.py \
	scripts/tests/test_agent_native_artifact_contracts.py \
	scripts/hook-governance/inventory_repos.py \
	scripts/hook-governance/tests/test_inventory_repos.py
run_uv pyright
run_uv pytest \
	scripts/tests/test_agent_native_artifact_contracts.py \
	scripts/hook-governance/tests/test_inventory_repos.py
