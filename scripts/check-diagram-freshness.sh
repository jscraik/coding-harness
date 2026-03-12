#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"

TRACKED_ARTIFACT_PATHS=(
  "AI/diagrams"
  "AI/context/diagram-context.md"
  "AI/context/diagram-context.meta.json"
)

is_ignored_change() {
  local changed_path="$1"

  case "$changed_path" in
    src/*.test.ts|src/*.spec.ts|src/*.test.js|src/*.spec.js)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

is_architecture_sensitive_change() {
  local changed_path="$1"

  case "$changed_path" in
    package.json|tsconfig.json|scripts/refresh-diagram-context.sh|scripts/check-diagram-freshness.sh)
      return 0
      ;;
    AI/diagrams/*|AI/context/*)
      return 0
      ;;
    src/*)
      if is_ignored_change "$changed_path"; then
        return 1
      fi
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

snapshot_artifacts() {
  REPO_ROOT="$REPO_ROOT" python3 <<'PY'
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path

repo_root = Path(os.environ["REPO_ROOT"]).resolve()
tracked_paths = [
    "AI/diagrams",
    "AI/context/diagram-context.md",
    "AI/context/diagram-context.meta.json",
]


def normalize_text(path: Path, raw_text: str) -> str:
    rel_path = path.relative_to(repo_root).as_posix()
    if rel_path.endswith("diagram-context.md"):
        lines = raw_text.splitlines(keepends=True)
        return "".join(
            line for line in lines if not line.startswith("Generated: ")
        )
    if rel_path.endswith("diagram-context.meta.json"):
        payload = json.loads(raw_text)
        for key in (
            "generated_at",
            "last_generated_epoch",
            "changed",
            "context_sha256",
        ):
            payload.pop(key, None)
        return json.dumps(payload, sort_keys=True, separators=(",", ":"))
    if rel_path.endswith("manifest.json"):
        payload = json.loads(raw_text)
        payload.pop("generatedAt", None)
        return json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return raw_text


entries: list[str] = []
for tracked in tracked_paths:
    candidate = repo_root / tracked
    if candidate.is_dir():
        files = sorted(path for path in candidate.rglob("*") if path.is_file())
    elif candidate.is_file():
        files = [candidate]
    else:
        files = []

    for file_path in files:
        normalized = normalize_text(file_path, file_path.read_text())
        digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
        entries.append(f"{file_path.relative_to(repo_root).as_posix()} {digest}")

print("\n".join(entries))
PY
}

resolve_diff_base() {
  if git -C "$REPO_ROOT" rev-parse --verify '@{upstream}' >/dev/null 2>&1; then
    git -C "$REPO_ROOT" merge-base HEAD '@{upstream}'
    return 0
  fi

  if git -C "$REPO_ROOT" rev-parse --verify main >/dev/null 2>&1; then
    git -C "$REPO_ROOT" merge-base HEAD main
    return 0
  fi

  if git -C "$REPO_ROOT" rev-parse --verify HEAD^ >/dev/null 2>&1; then
    git -C "$REPO_ROOT" rev-parse HEAD^
    return 0
  fi

  return 1
}

collect_changed_paths() {
  local base
  if base="$(resolve_diff_base)"; then
    {
      git -C "$REPO_ROOT" diff --name-only "$base...HEAD"
      git -C "$REPO_ROOT" diff --name-only
      git -C "$REPO_ROOT" diff --cached --name-only
    } | awk 'NF { print }' | sort -u
  else
    {
      git -C "$REPO_ROOT" diff --name-only
      git -C "$REPO_ROOT" diff --cached --name-only
    } | awk 'NF { print }' | sort -u
  fi
}

should_refresh=0
while IFS= read -r changed_path; do
  [[ -n "$changed_path" ]] || continue
  if is_architecture_sensitive_change "$changed_path"; then
    should_refresh=1
    break
  fi
done < <(collect_changed_paths)

if [[ "$should_refresh" -ne 1 ]]; then
  echo "Diagram freshness check skipped: no architecture-sensitive implementation paths changed."
  exit 0
fi

echo "Refreshing architecture diagrams for changed sensitive paths..."
before_snapshot="$(snapshot_artifacts)"
bash "$REPO_ROOT/scripts/refresh-diagram-context.sh" --force --quiet
after_snapshot="$(snapshot_artifacts)"

if [[ "$before_snapshot" != "$after_snapshot" ]]; then
  echo "Error: architecture diagram artifacts are stale after refresh."
  echo "Changed tracked files:"
  git -C "$REPO_ROOT" diff --name-only -- "${TRACKED_ARTIFACT_PATHS[@]}"
  echo "Fix: run 'bash scripts/refresh-diagram-context.sh --force' and commit the updated artifacts."
  exit 1
fi

echo "Diagram freshness check passed."
