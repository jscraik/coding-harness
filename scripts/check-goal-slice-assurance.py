#!/usr/bin/env python3
"""Validate per-slice assurance evidence on a goal receipt.

This guard makes the Codex Runtime Evidence Verifier Cockpit goal's
skill-lens and independent-reviewer contract executable. It intentionally
checks one named receipt at a time so slice completion cannot be inferred from
nearby prose or older receipts.
"""

from __future__ import annotations

import argparse
import json
import posixpath
import sys
from pathlib import Path
from typing import Any, cast


REQUIRED_SKILL_LENSES = (
    "improve-codebase-architecture",
    "simplify",
    "unslopify",
    "he-code-review",
    "testing",
)
REQUIRED_REVIEWERS = (
    "adversarial-reviewer",
    "agent-native-reviewer",
    "best-practices-researcher",
)
ALLOWED_STATUSES = {"pass", "fail", "blocked", "not applicable"}


class ValidationError(Exception):
    """Raised when the receipt cannot support a slice done claim."""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate evidence-backed skill/reviewer assurance for one goal receipt.",
    )
    parser.add_argument("receipts", help="Path to receipts.jsonl")
    parser.add_argument("--receipt-id", required=True, help="Receipt id to validate")
    parser.add_argument(
        "--repo",
        default=".",
        help="Repository root used to resolve evidence refs",
    )
    return parser.parse_args()


def fail(message: str) -> int:
    print(f"fail: {message}", file=sys.stderr)
    return 1


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
        receipts.append(cast(dict[str, Any], receipt))
    return receipts


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


def changed_file_identities(receipt: dict[str, Any], repo: Path) -> set[str]:
    changed_files = receipt.get("changed_files")
    if not isinstance(changed_files, list) or not changed_files:
        raise ValidationError("changed_files must be a non-empty list")

    identities: set[str] = set()
    for index, entry in enumerate(cast(list[Any], changed_files)):
        lexical = normalize_repo_relative_path(entry, f"changed_files[{index}]")
        identities.add(lexical)
        candidate = repo / lexical
        if candidate.exists():
            identities.add(relative_to_repo(candidate.resolve(), repo, f"changed_files[{index}]"))
    return identities


def resolve_evidence_ref(value: Any, field: str, repo: Path, changed_files: set[str]) -> str:
    lexical = normalize_repo_relative_path(value, field)
    candidate = repo / lexical
    if not candidate.exists():
        raise ValidationError(f"{field} does not exist: {lexical}")
    resolved = candidate.resolve()
    resolved_relative = relative_to_repo(resolved, repo, field)
    if not candidate.is_file():
        raise ValidationError(f"{field} must resolve to a file: {lexical}")
    if candidate.stat().st_size == 0:
        raise ValidationError(f"{field} points to a zero-byte file: {lexical}")
    if lexical not in changed_files and resolved_relative not in changed_files:
        raise ValidationError(f"{field} must be listed in changed_files: {lexical}")
    return resolved_relative


def find_target_receipt(
    receipts: list[dict[str, Any]],
    receipt_id: str,
) -> dict[str, Any]:
    ids: dict[str, int] = {}
    target: dict[str, Any] | None = None
    for receipt in receipts:
        current_id = require_string(receipt.get("id"), "receipt.id")
        ids[current_id] = ids.get(current_id, 0) + 1
        if current_id == receipt_id:
            target = receipt
    duplicates = sorted(receipt_id for receipt_id, count in ids.items() if count > 1)
    if duplicates:
        raise ValidationError(f"duplicate receipt id(s): {', '.join(duplicates)}")
    if target is None:
        raise ValidationError(f"receipt id not found: {receipt_id}")
    return target


def require_result_map(receipt: dict[str, Any], field: str) -> dict[str, Any]:
    value = receipt.get(field)
    if not isinstance(value, dict):
        raise ValidationError(f"{field} must be an object")
    return cast(dict[str, Any], value)


def validate_required_member(
    *,
    member_key: str,
    group_field: str,
    result: Any,
    receipt: dict[str, Any],
    repo: Path,
    changed_files: set[str],
    used_evidence_refs: dict[str, str],
) -> None:
    field = f"{group_field}.{member_key}"
    if not isinstance(result, dict):
        raise ValidationError(f"{field} must be a structured object")
    result_object = cast(dict[str, Any], result)

    status = require_string(result_object.get("status"), f"{field}.status")
    if status not in ALLOWED_STATUSES:
        raise ValidationError(f"{field}.status has unsupported value {status!r}")

    if status == "pass":
        validate_pass_member(
            member_key=member_key,
            field=field,
            result=result_object,
            receipt=receipt,
            repo=repo,
            changed_files=changed_files,
            used_evidence_refs=used_evidence_refs,
        )
        return

    validate_non_pass_member(
        field=field,
        result=result_object,
        repo=repo,
        changed_files=changed_files,
        used_evidence_refs=used_evidence_refs,
    )


def validate_pass_member(
    *,
    member_key: str,
    field: str,
    result: dict[str, Any],
    receipt: dict[str, Any],
    repo: Path,
    changed_files: set[str],
    used_evidence_refs: dict[str, str],
) -> None:
    expected_receipt_id = require_string(receipt.get("id"), "receipt.id")
    expected_lifecycle_unit = require_string(receipt.get("lifecycle_unit"), "receipt.lifecycle_unit")
    expected_head_sha = require_string(receipt.get("head_sha"), "receipt.head_sha")

    role = require_string(result.get("role"), f"{field}.role")
    if role != member_key:
        raise ValidationError(f"{field}.role must match member key {member_key!r}")
    require_string(result.get("producer"), f"{field}.producer")

    receipt_id = require_string(result.get("receipt_id"), f"{field}.receipt_id")
    if receipt_id != expected_receipt_id:
        raise ValidationError(f"{field}.receipt_id must match target receipt")
    lifecycle_unit = require_string(result.get("lifecycle_unit"), f"{field}.lifecycle_unit")
    if lifecycle_unit != expected_lifecycle_unit:
        raise ValidationError(f"{field}.lifecycle_unit must match target receipt")
    head_sha = require_string(result.get("head_sha"), f"{field}.head_sha")
    if head_sha != expected_head_sha:
        raise ValidationError(f"{field}.head_sha must match target receipt")

    freshness = require_string(result.get("freshness"), f"{field}.freshness")
    if freshness != "current":
        raise ValidationError(f"{field}.freshness must be current")

    evidence_ref = resolve_evidence_ref(
        result.get("evidence_ref"),
        f"{field}.evidence_ref",
        repo,
        changed_files,
    )
    if evidence_ref in used_evidence_refs:
        raise ValidationError(
            f"{field}.evidence_ref reuses evidence from {used_evidence_refs[evidence_ref]}: {evidence_ref}",
        )
    used_evidence_refs[evidence_ref] = field


def validate_non_pass_member(
    *,
    field: str,
    result: dict[str, Any],
    repo: Path,
    changed_files: set[str],
    used_evidence_refs: dict[str, str],
) -> None:
    require_string(result.get("reason"), f"{field}.reason")
    owner = result.get("owner")
    if owner is not None:
        require_string(owner, f"{field}.owner")
        return
    accepted_exception_ref = result.get("accepted_exception_ref")
    if accepted_exception_ref is None:
        raise ValidationError(
            f"{field} requires owner or accepted_exception_ref for non-pass status",
        )
    exception_ref = resolve_evidence_ref(
        accepted_exception_ref,
        f"{field}.accepted_exception_ref",
        repo,
        changed_files,
    )
    if exception_ref in used_evidence_refs:
        raise ValidationError(
            f"{field}.accepted_exception_ref reuses evidence from {used_evidence_refs[exception_ref]}: {exception_ref}",
        )
    used_evidence_refs[exception_ref] = field


def validate_group(
    *,
    receipt: dict[str, Any],
    group_field: str,
    required_members: tuple[str, ...],
    repo: Path,
    changed_files: set[str],
    used_evidence_refs: dict[str, str],
) -> None:
    result_map = require_result_map(receipt, group_field)
    missing = [member for member in required_members if member not in result_map]
    if missing:
        raise ValidationError(f"{group_field} missing required member(s): {', '.join(missing)}")
    for member in required_members:
        validate_required_member(
            member_key=member,
            group_field=group_field,
            result=result_map[member],
            receipt=receipt,
            repo=repo,
            changed_files=changed_files,
            used_evidence_refs=used_evidence_refs,
        )


def validate(receipts_path: Path, receipt_id: str, repo: Path) -> dict[str, Any]:
    if not receipts_path.is_file():
        raise ValidationError(f"receipts file does not exist: {receipts_path}")
    repo_root = repo.resolve()
    receipts = load_receipts(receipts_path)
    receipt = find_target_receipt(receipts, receipt_id)
    changed_files = changed_file_identities(receipt, repo_root)
    used_evidence_refs: dict[str, str] = {}

    validate_group(
        receipt=receipt,
        group_field="slice_skill_lens_results",
        required_members=REQUIRED_SKILL_LENSES,
        repo=repo_root,
        changed_files=changed_files,
        used_evidence_refs=used_evidence_refs,
    )
    validate_group(
        receipt=receipt,
        group_field="independent_reviewer_results",
        required_members=REQUIRED_REVIEWERS,
        repo=repo_root,
        changed_files=changed_files,
        used_evidence_refs=used_evidence_refs,
    )

    return {
        "status": "pass",
        "receipt_id": receipt_id,
        "required_skill_lenses": list(REQUIRED_SKILL_LENSES),
        "required_reviewers": list(REQUIRED_REVIEWERS),
    }


def main() -> int:
    args = parse_args()
    try:
        result = validate(Path(args.receipts), args.receipt_id, Path(args.repo))
    except ValidationError as exc:
        return fail(str(exc))
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
