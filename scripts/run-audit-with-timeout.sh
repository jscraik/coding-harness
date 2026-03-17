#!/usr/bin/env bash
set -euo pipefail

TIMEOUT_SECONDS="${HARNESS_AUDIT_TIMEOUT_SECONDS:-300}"

resolve_timeout_cmd() {
	if command -v gtimeout >/dev/null 2>&1; then
		echo "gtimeout"
		return 0
	fi
	if command -v timeout >/dev/null 2>&1; then
		echo "timeout"
		return 0
	fi
	echo ""
}

TIMEOUT_CMD="$(resolve_timeout_cmd)"

if [[ -n "${TIMEOUT_CMD}" ]]; then
	set +e
	"${TIMEOUT_CMD}" "${TIMEOUT_SECONDS}" pnpm audit --audit-level=moderate
	AUDIT_EXIT=$?
	set -e

	if [[ ${AUDIT_EXIT} -eq 124 ]]; then
		echo "Audit timed out after ${TIMEOUT_SECONDS}s. Set HARNESS_AUDIT_TIMEOUT_SECONDS to adjust." >&2
		exit 124
	fi

	exit ${AUDIT_EXIT}
fi

echo "No timeout command found; running audit without timeout guard." >&2
pnpm audit --audit-level=moderate
