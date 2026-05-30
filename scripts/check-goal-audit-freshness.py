#!/usr/bin/env python3
"""Validate that a goal receipt acknowledges the current adopted audit content.

This guard exists for the Codex Runtime Evidence Verifier Cockpit goal. It is
deliberately narrow: the governed 2026-05-26 audit must be re-read and recorded
with a content digest after the audit file's latest filesystem timestamp before
the goal can use that audit as closeout evidence.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import posixpath
import subprocess
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any


GOVERNED_AUDIT_PATH = ".harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md"
REQUIRED_SOURCE_FIELDS = ("path", "sha256", "checked_at", "head_sha")
CHECKED_AT_FUTURE_SKEW = timedelta(minutes=5)
SELF_REFERENTIAL_GOAL_RECEIPT_PATHS = {
    ".harness/active-artifacts.md",
    "docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl",
    "docs/goals/codex-runtime-evidence-verifier-cockpit/state.yaml",
}


class ValidationError(Exception):
    """Raised when the audit freshness receipt is missing or stale."""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate the current adopted audit source against goal receipts.",
    )
    parser.add_argument("goal_dir", help="Goal directory containing receipts.jsonl")
    parser.add_argument(
        "--repo",
        default=".",
        help="Repository root used to resolve the governed audit path",
    )
    parser.add_argument(
        "--audit",
        default=GOVERNED_AUDIT_PATH,
        help="Governed audit path; required-mode validation rejects alternate paths",
    )
    return parser.parse_args()


def fail(message: str) -> int:
    print(f"fail: {message}", file=sys.stderr)
    return 1


def require_string(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValidationError(f"{field} must be a non-empty string")
    return value.strip()


def normalize_repo_relative_path(value: Any, field: str) -> str:
    raw_value = require_string(value, field)
    path = Path(raw_value)
    if path.is_absolute():
        raise ValidationError(f"{field} must be repo-relative, got absolute path {raw_value!r}")
    path_text = raw_value.replace("\\", "/")
    normalized = posixpath.normpath(path_text)
    if path_text != normalized:
        raise ValidationError(f"{field} must be a canonical repo-relative path, got {raw_value!r}")
    if normalized in {".", ""}:
        raise ValidationError(f"{field} must point at a file, got {raw_value!r}")
    if normalized.startswith("../") or normalized == ".." or "/../" in f"/{normalized}/":
        raise ValidationError(f"{field} must not contain path traversal, got {raw_value!r}")
    return normalized.removeprefix("./")


def relative_to_repo(path: Path, repo: Path, field: str) -> str:
    try:
        return path.relative_to(repo).as_posix()
    except ValueError as exc:
        raise ValidationError(f"{field} escapes repository root: {path}") from exc


def load_receipts(path: Path) -> list[dict[str, Any]]:
    receipts: list[dict[str, Any]] = []
    for line_number, raw_line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        line = raw_line.strip()
        if not line:
            continue
        try:
            receipt = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ValidationError(f"{path}:{line_number} is not valid JSON: {exc}") from exc
        if not isinstance(receipt, dict):
            raise ValidationError(f"{path}:{line_number} is not a JSON object")
        receipts.append(receipt)
    return receipts


def parse_utc_timestamp(value: Any, field: str) -> datetime:
    raw_value = require_string(value, field)
    timestamp = raw_value
    if timestamp.endswith("Z"):
        timestamp = f"{timestamp[:-1]}+00:00"
    try:
        parsed = datetime.fromisoformat(timestamp)
    except ValueError as exc:
        raise ValidationError(f"{field} must be an ISO-8601 timestamp") from exc
    if parsed.tzinfo is None:
        raise ValidationError(f"{field} must include a timezone")
    return parsed.astimezone(UTC)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def changed_paths_between(repo_root: Path, base_head: str, current_head: str) -> set[str]:
    try:
        completed = subprocess.run(
            ["git", "diff", "--name-only", f"{base_head}..{current_head}"],
            cwd=repo_root,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
    except (OSError, subprocess.CalledProcessError) as exc:
        raise ValidationError(
            f"could not inspect files changed since receipt.head_sha: {exc}",
        ) from exc
    return {line.strip() for line in completed.stdout.splitlines() if line.strip()}


def permits_self_referential_goal_receipt_commit(
    repo_root: Path,
    receipt: dict[str, Any],
    receipt_head_sha: str,
    source_head_sha: str,
    current_head: str,
) -> bool:
    if receipt_head_sha != source_head_sha:
        return False
    changed_files = receipt.get("changed_files", [])
    if not isinstance(changed_files, list):
        return False
    declared_paths: set[str] = set()
    for value in changed_files:
        if not isinstance(value, str):
            return False
        declared_paths.add(normalize_repo_relative_path(value, "receipt.changed_files[]"))
    changed_paths = changed_paths_between(repo_root, receipt_head_sha, current_head)
    allowed_paths = SELF_REFERENTIAL_GOAL_RECEIPT_PATHS | declared_paths
    return bool(changed_paths) and changed_paths <= allowed_paths


def latest_audit_source(
    receipts: list[dict[str, Any]],
    audit_path: str,
) -> tuple[dict[str, Any], dict[str, Any]]:
    for receipt in reversed(receipts):
        sources = receipt.get("audit_sources_checked")
        if not isinstance(sources, list):
            continue
        for source in reversed(sources):
            if not isinstance(source, dict):
                raise ValidationError("audit_sources_checked entries must be objects")
            source_path = normalize_repo_relative_path(source.get("path"), "audit_sources_checked[].path")
            if source_path == audit_path:
                return receipt, source
    raise ValidationError(f"no audit_sources_checked entry found for {audit_path}")


def validate(goal_dir: Path, repo: Path, audit_arg: str) -> dict[str, Any]:
    repo_root = repo.resolve()
    audit_path = normalize_repo_relative_path(audit_arg, "--audit")
    if audit_path != GOVERNED_AUDIT_PATH:
        raise ValidationError(
            f"--audit must be the governed audit path {GOVERNED_AUDIT_PATH!r}, got {audit_path!r}",
        )

    audit_file = repo_root / audit_path
    if not audit_file.is_file():
        raise ValidationError(f"governed audit file does not exist: {audit_path}")
    relative_to_repo(audit_file.resolve(), repo_root, "--audit")

    receipts_path = goal_dir / "receipts.jsonl"
    if not receipts_path.is_file():
        raise ValidationError(f"receipts file does not exist: {receipts_path}")
    receipts = load_receipts(receipts_path)
    if not receipts:
        raise ValidationError("receipts file contains no receipts")

    try:
        current_head = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=repo_root,
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        ).stdout.strip()
    except (OSError, subprocess.CalledProcessError) as exc:
        raise ValidationError(f"could not retrieve current repository HEAD: {exc}") from exc

    current_sha256 = sha256_file(audit_file)
    audit_mtime = datetime.fromtimestamp(audit_file.stat().st_mtime, tz=UTC)
    receipt, source = latest_audit_source(receipts, audit_path)
    current_head_normalized = current_head.lower()

    missing_fields = [field for field in REQUIRED_SOURCE_FIELDS if field not in source]
    if missing_fields:
        raise ValidationError(
            f"audit_sources_checked entry missing required field(s): {', '.join(missing_fields)}",
        )

    receipt_id = require_string(receipt.get("id"), "receipt.id")
    receipt_head_sha = require_string(receipt.get("head_sha"), "receipt.head_sha")
    require_reachable_head(repo_root, receipt_head_sha, "receipt.head_sha")
    receipt_head_sha_normalized = receipt_head_sha.lower()
    source_head_sha = require_string(source.get("head_sha"), "audit_sources_checked[].head_sha")
    require_reachable_head(repo_root, source_head_sha, "audit_sources_checked[].head_sha")
    source_head_sha_normalized = source_head_sha.lower()
    if source_head_sha_normalized != receipt_head_sha_normalized:
        raise ValidationError("audit_sources_checked[].head_sha must match receipt.head_sha")
    if receipt_head_sha_normalized != current_head_normalized:
        if not permits_self_referential_goal_receipt_commit(
            repo_root,
            receipt,
            receipt_head_sha_normalized,
            source_head_sha_normalized,
            current_head_normalized,
        ):
            raise ValidationError(f"receipt.head_sha must match current repository HEAD: receipt={receipt_head_sha} current={current_head}")
    if source_head_sha_normalized != current_head_normalized:
        if not permits_self_referential_goal_receipt_commit(
            repo_root,
            receipt,
            receipt_head_sha_normalized,
            source_head_sha_normalized,
            current_head_normalized,
        ):
            raise ValidationError(f"audit_sources_checked[].head_sha must match current repository HEAD: source={source_head_sha} current={current_head}")

    source_sha256 = require_string(source.get("sha256"), "audit_sources_checked[].sha256").lower()
    if len(source_sha256) != 64 or any(character not in "0123456789abcdef" for character in source_sha256):
        raise ValidationError("audit_sources_checked[].sha256 must be a lower-case sha256 hex digest")
    if source_sha256 != current_sha256:
        raise ValidationError(
            f"audit sha256 is stale for {audit_path}: receipt={source_sha256} current={current_sha256}",
        )

    receipt_created_at = parse_utc_timestamp(receipt.get("created_at"), "receipt.created_at")
    checked_at = parse_utc_timestamp(source.get("checked_at"), "audit_sources_checked[].checked_at")
    if checked_at < receipt_created_at:
        raise ValidationError(
            "audit_sources_checked[].checked_at must be at or after receipt.created_at",
        )
    now = datetime.now(UTC)
    if checked_at > now + CHECKED_AT_FUTURE_SKEW:
        raise ValidationError(
            "audit_sources_checked[].checked_at must not be in the future",
        )
    if checked_at < audit_mtime:
        raise ValidationError(
            "audit_sources_checked[].checked_at is older than the current audit file timestamp",
        )

    return {
        "status": "pass",
        "audit_path": audit_path,
        "audit_sha256": current_sha256,
        "audit_mtime": audit_mtime.isoformat().replace("+00:00", "Z"),
        "checked_at": checked_at.isoformat().replace("+00:00", "Z"),
        "receipt_id": receipt_id,
        "head_sha": receipt_head_sha_normalized,
    }


def require_reachable_head(repo_root: Path, head_sha: str, field: str) -> None:
    if len(head_sha) != 40 or any(character not in "0123456789abcdef" for character in head_sha.lower()):
        raise ValidationError(f"{field} must be a 40-character git commit SHA")
    normalized_head_sha = head_sha.lower()
    try:
        completed = subprocess.run(
            ["git", "merge-base", "--is-ancestor", normalized_head_sha, "HEAD"],
            cwd=repo_root,
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
    except OSError as exc:
        raise ValidationError(f"could not verify {field} against repository history: {exc}") from exc
    if completed.returncode != 0:
        detail = completed.stderr.strip()
        suffix = f": {detail}" if detail else ""
        raise ValidationError(f"{field} must be reachable from current repository HEAD{suffix}")


def main() -> int:
    args = parse_args()
    try:
        result = validate(Path(args.goal_dir), Path(args.repo), args.audit)
    except ValidationError as exc:
        return fail(str(exc))
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
