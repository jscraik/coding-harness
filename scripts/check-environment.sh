#!/usr/bin/env bash
# Local environment preflight (strict)
# Fails fast when required tooling is missing.

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
CONTRACT_PATH="$REPO_ROOT/harness.contract.json"
ATTESTATION_PATH="$REPO_ROOT/artifacts/policy/environment-attestation.json"

if [[ ! -f "$CONTRACT_PATH" ]]; then
	echo "Error: missing contract file at $CONTRACT_PATH"
	exit 1
fi

required_bins=(pnpm node jq)
for bin in "${required_bins[@]}"; do
	if ! command -v "$bin" >/dev/null 2>&1; then
		echo "Error: required binary '$bin' is not installed or not on PATH"
		exit 1
	fi
done

mkdir -p "$REPO_ROOT/artifacts/policy"

echo "Running harness environment preflight..."
pnpm exec tsx src/cli.ts check-environment \
	--contract "$CONTRACT_PATH" \
	--json \
	--attestation "$ATTESTATION_PATH"

jq -e '.passed == true' "$ATTESTATION_PATH" >/dev/null
echo "Environment check passed (attestation: $ATTESTATION_PATH)"
