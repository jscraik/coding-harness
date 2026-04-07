#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

warn_legacy_manifest() {
  printf '%s\n' \
    "warning: legacy .harness/restore-manifest.json metadata blocks tracked update checks; continuing with remaining setup gates" \
    "remediation: repair the manifest from a known-good tracked install, or remove .harness and re-run \`harness init --track\` when bootstrapping a fresh repo"
}

echo "== Harness setup checks =="
echo "repo: $ROOT"

if command -v local-memory >/dev/null 2>&1; then
  lm_status="$(local-memory status --json 2>/dev/null || true)"
  lm_running="$(printf '%s\n' "$lm_status" | jq -r '.data.running // .running // false' 2>/dev/null || echo false)"
  if [[ "$lm_running" != "true" ]]; then
    echo "starting local-memory daemon for required preflight..."
    local-memory start >/dev/null
  fi
fi

echo
echo "== preflight =="
source scripts/codex-preflight.sh
preflight_repo

echo
echo "== build cli =="
pnpm build

echo
echo "== init check-updates =="
check_output=""
check_status=0
if check_output="$(node dist/cli.js init --check-updates --json 2>&1)"; then
  check_status=0
else
  check_status=$?
fi
printf '%s\n' "$check_output"

legacy_manifest_blocked=0
if [[ "$check_status" -ne 0 ]]; then
  if printf '%s\n' "$check_output" | jq -e '.error.code == "INCOMPLETE_MANIFEST"' >/dev/null 2>&1; then
    legacy_manifest_blocked=1
    warn_legacy_manifest
  else
    exit "$check_status"
  fi
fi

if [[ "$legacy_manifest_blocked" -eq 0 ]] && printf '%s\n' "$check_output" | jq -e '.updateCheck.updateAvailable == true' >/dev/null 2>&1; then
  echo
  echo "== init update =="
  node dist/cli.js init --update --json
  echo
  echo "== init recheck =="
  node dist/cli.js init --check-updates --json
fi

echo
echo "== check-environment (pinned uv + required posture) =="
UV_BIN=""
if command -v mise >/dev/null 2>&1; then
  UV_BIN="$(mise which uv 2>/dev/null || true)"
fi

if [[ -n "$UV_BIN" && -x "$UV_BIN" ]]; then
  UV_DIR="$(dirname "$UV_BIN")"
  echo "uv pin: $UV_BIN"
  CLAUDE_APPROVAL_POSTURE=require PATH="$UV_DIR:$PATH" node dist/cli.js check-environment --json
else
  echo "warning: mise uv pin unavailable; running with current PATH uv"
  CLAUDE_APPROVAL_POSTURE=require node dist/cli.js check-environment --json
fi

echo
echo "== repo quality gate =="
pnpm check

echo
echo "✅ harness setup checks complete"
