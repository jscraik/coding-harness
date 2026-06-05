#!/usr/bin/env python3
"""Validate the JSC-363 historical review coverage backfill ledger.

The ledger makes pre-R064 review coverage explicit without rewriting history:
each PU-001..PU-016 unit must either carry member-level evidence or an accepted
exception that points back to the receipt trail.
"""

from __future__ import annotations

import argparse
import json
import posixpath
import sys
from datetime import datetime
from pathlib import Path
from typing import Any


EXPECTED_SCHEMA_VERSION = "goal-review-coverage-backfill/v1"
EXPECTED_GOAL_SLUG = "codex-runtime-evidence-verifier-cockpit"
REQUIRED_LIFECYCLE_UNITS = tuple(f"PU-{index:03d}" for index in range(1, 17))
REQUIRED_SKILL_LENSES = (
    "simplify",
    "improve-codebase-architecture",
    "sy-review",
    "testing",
)
REQUIRED_REVIEWERS = (
    "adversarial-reviewer",
    "agent-native-reviewer",
    "best-practices-researcher",
)
ALLOWED_STATUSES = {"pass", "fail", "blocked", "not applicable"}
RECEIPTS_REF = "docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl"
EXPECTED_COVERAGE_WINDOW = ("PU-001", "PU-016")
EXPECTED_REVIEW_CONTRACT_RECEIPT_ID = "R064"
EXPECTED_SOURCE_RECEIPT_REFS = {
    "PU-001": ("R004",),
    "PU-002": ("R005",),
    "PU-003": ("R007",),
    "PU-004": ("R008",),
    "PU-005": ("R009",),
    "PU-006": ("R011", "R012"),
    "PU-007": ("R013", "R014", "R015"),
    "PU-008": ("R016", "R017", "R018"),
    "PU-009": ("R019", "R020", "R021", "R025"),
    "PU-010": ("R026",),
    "PU-011": ("R027", "R035"),
    "PU-012": ("R038", "R042"),
    "PU-013": ("R043", "R045"),
    "PU-014": ("R046", "R047"),
    "PU-015": ("R048", "R051"),
    "PU-016": ("R053", "R061"),
}


class ValidationError(Exception):
    """Raised when the backfill ledger cannot support closeout."""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate the Codex runtime evidence goal review-coverage backfill ledger.",
    )
    parser.add_argument("ledger", help="Path to review-coverage-backfill.json")
    parser.add_argument(
        "--repo",
        default=".",
        help="Repository root used to resolve evidence refs",
    )
    return parser.parse_args()


def fail(message: str) -> int:
    print(f"fail: {message}", file=sys.stderr)
    return 1


def require_string(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValidationError(f"{field} must be a non-empty string")
    return value.strip()


def require_list(value: Any, field: str) -> list[Any]:
    if not isinstance(value, list) or not value:
        raise ValidationError(f"{field} must be a non-empty list")
    return value


def require_object(value: Any, field: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValidationError(f"{field} must be an object")
    return value


def normalize_repo_relative_path(value: str, field: str) -> str:
    path = Path(value)
    if path.is_absolute():
        raise ValidationError(f"{field} must be repo-relative, got absolute path {value!r}")
    path_text = value.replace("\\", "/")
    normalized = posixpath.normpath(path_text)
    if path_text != normalized:
        raise ValidationError(f"{field} must be a canonical repo-relative path, got {value!r}")
    if normalized in {".", ""}:
        raise ValidationError(f"{field} must point at a file, got {value!r}")
    if normalized.startswith("../") or normalized == ".." or "/../" in f"/{normalized}/":
        raise ValidationError(f"{field} must not contain path traversal, got {value!r}")
    return normalized.removeprefix("./")


def relative_to_repo(path: Path, repo: Path, field: str) -> str:
    try:
        return path.relative_to(repo).as_posix()
    except ValueError as exc:
        raise ValidationError(f"{field} escapes repository root: {path}") from exc


def split_ref(value: Any, field: str) -> tuple[str, str | None]:
    raw_value = require_string(value, field)
    if raw_value.count("#") > 1:
        raise ValidationError(f"{field} must contain at most one fragment separator")
    path_text, separator, fragment = raw_value.partition("#")
    lexical = normalize_repo_relative_path(path_text, field)
    if separator and not fragment.strip():
        raise ValidationError(f"{field} fragment must be non-empty")
    return lexical, fragment.strip() or None


def expected_source_refs(lifecycle_unit: str) -> list[str]:
    return [f"{RECEIPTS_REF}#{receipt_id}" for receipt_id in EXPECTED_SOURCE_RECEIPT_REFS[lifecycle_unit]]


def load_receipts(path: Path) -> dict[str, dict[str, Any]]:
    receipts: dict[str, dict[str, Any]] = {}
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
        receipt_id = receipt.get("id")
        if isinstance(receipt_id, str) and receipt_id:
            if receipt_id in receipts:
                raise ValidationError(
                    f"{path}:{line_number} duplicates receipt id {receipt_id!r}",
                )
            receipts[receipt_id] = receipt
    return receipts


def resolve_ref(value: Any, field: str, repo: Path, receipt_cache: dict[str, dict[str, dict[str, Any]]]) -> str:
    lexical, fragment = split_ref(value, field)
    candidate = repo / lexical
    if not candidate.exists():
        raise ValidationError(f"{field} does not exist: {lexical}")
    resolved_relative = relative_to_repo(candidate.resolve(), repo, field)
    if not candidate.is_file():
        raise ValidationError(f"{field} must resolve to a file: {lexical}")
    if candidate.stat().st_size == 0:
        raise ValidationError(f"{field} points to a zero-byte file: {lexical}")

    if fragment is None:
        return resolved_relative

    if lexical.endswith(".jsonl") and fragment.startswith("R"):
        receipts = receipt_cache.setdefault(resolved_relative, load_receipts(candidate))
        if fragment not in receipts:
            raise ValidationError(f"{field} references missing receipt fragment: {lexical}#{fragment}")
        return f"{resolved_relative}#{fragment}"

    raise ValidationError(f"{field} uses unsupported fragment: {lexical}#{fragment}")


def resolve_receipt_ref(
    value: Any,
    field: str,
    repo: Path,
    receipt_cache: dict[str, dict[str, dict[str, Any]]],
) -> tuple[str, dict[str, Any]]:
    lexical, fragment = split_ref(value, field)
    if fragment is None or not lexical.endswith(".jsonl") or not fragment.startswith("R"):
        raise ValidationError(f"{field} must be a receipt fragment")
    resolved_ref = resolve_ref(value, field, repo, receipt_cache)
    resolved_path = resolved_ref.split("#", 1)[0]
    return resolved_ref, receipt_cache[resolved_path][fragment]


def member_receipt_result(receipt: dict[str, Any], member_key: str) -> dict[str, Any] | None:
    for field in ("slice_skill_lens_results", "independent_reviewer_results"):
        value = receipt.get(field)
        if isinstance(value, list):
            for entry in value:
                if isinstance(entry, dict) and entry.get("role") == member_key:
                    return entry
        if isinstance(value, dict):
            entry = value.get(member_key)
            if isinstance(entry, dict):
                return entry
    return None


def require_exact_members(actual: Any, expected: tuple[str, ...], field: str) -> None:
    values = require_list(actual, field)
    if values != list(expected):
        raise ValidationError(f"{field} must equal {list(expected)!r}")


def validate_member_result(
    *,
    member_key: str,
    field: str,
    value: Any,
    repo: Path,
    receipt_cache: dict[str, dict[str, dict[str, Any]]],
    allowed_exceptions: set[str],
) -> None:
    result = require_object(value, field)
    status = require_string(result.get("status"), f"{field}.status")
    if status not in ALLOWED_STATUSES:
        raise ValidationError(f"{field}.status has unsupported value {status!r}")

    if status == "pass":
        role = require_string(result.get("role"), f"{field}.role")
        if role != member_key:
            raise ValidationError(f"{field}.role must match member key {member_key!r}")
        require_string(result.get("producer"), f"{field}.producer")
        freshness = require_string(result.get("freshness"), f"{field}.freshness")
        if freshness != "current":
            raise ValidationError(f"{field}.freshness must be current")
        _, receipt = resolve_receipt_ref(result.get("evidenceRef"), f"{field}.evidenceRef", repo, receipt_cache)
        receipt_result = member_receipt_result(receipt, member_key)
        if receipt_result is None:
            raise ValidationError(f"{field}.evidenceRef receipt does not contain member result for {member_key!r}")
        if receipt_result.get("status") != "pass":
            raise ValidationError(f"{field}.evidenceRef receipt member result must be pass")
        if receipt_result.get("freshness") != "current":
            raise ValidationError(f"{field}.evidenceRef receipt member freshness must be current")
        return

    require_string(result.get("reason"), f"{field}.reason")
    exception_ref = resolve_receipt_ref(result.get("acceptedExceptionRef"), f"{field}.acceptedExceptionRef", repo, receipt_cache)[0]

    if exception_ref not in allowed_exceptions:
        raise ValidationError(f"{field}.acceptedExceptionRef references fragment not in acceptedExceptionRefs: {exception_ref}")

    if status == "fail":
        require_string(result.get("owner"), f"{field}.owner")
        return

    owner = result.get("owner")
    if owner is not None:
        require_string(owner, f"{field}.owner")


def validate_result_map(
    *,
    value: Any,
    required_members: tuple[str, ...],
    field: str,
    repo: Path,
    receipt_cache: dict[str, dict[str, dict[str, Any]]],
    allowed_exceptions: set[str],
) -> None:
    result_map = require_object(value, field)
    missing = [member for member in required_members if member not in result_map]
    if missing:
        raise ValidationError(f"{field} missing required member(s): {', '.join(missing)}")
    extras = sorted(member for member in result_map if member not in required_members)
    if extras:
        raise ValidationError(f"{field} has unsupported member(s): {', '.join(extras)}")
    for member in required_members:
        validate_member_result(
            member_key=member,
            field=f"{field}.{member}",
            value=result_map[member],
            repo=repo,
            receipt_cache=receipt_cache,
            allowed_exceptions=allowed_exceptions,
        )


def validate_lifecycle_unit(
    entry: Any,
    *,
    repo: Path,
    receipt_cache: dict[str, dict[str, dict[str, Any]]],
    allowed_exceptions: set[str],
) -> str:
    unit = require_object(entry, "lifecycleUnits[]")
    lifecycle_unit = require_string(unit.get("lifecycleUnit"), "lifecycleUnits[].lifecycleUnit")
    source_refs = require_list(unit.get("sourceReceiptRefs"), f"{lifecycle_unit}.sourceReceiptRefs")
    expected_refs = expected_source_refs(lifecycle_unit) if lifecycle_unit in EXPECTED_SOURCE_RECEIPT_REFS else []
    if source_refs != expected_refs:
        raise ValidationError(f"{lifecycle_unit}.sourceReceiptRefs must equal {expected_refs!r}")
    for index, ref in enumerate(source_refs):
        resolve_ref(ref, f"{lifecycle_unit}.sourceReceiptRefs[{index}]", repo, receipt_cache)
    validate_result_map(
        value=unit.get("sliceSkillLensResults"),
        required_members=REQUIRED_SKILL_LENSES,
        field=f"{lifecycle_unit}.sliceSkillLensResults",
        repo=repo,
        receipt_cache=receipt_cache,
        allowed_exceptions=allowed_exceptions,
    )
    validate_result_map(
        value=unit.get("independentReviewerResults"),
        required_members=REQUIRED_REVIEWERS,
        field=f"{lifecycle_unit}.independentReviewerResults",
        repo=repo,
        receipt_cache=receipt_cache,
        allowed_exceptions=allowed_exceptions,
    )
    return lifecycle_unit


def validate_coverage_window(value: Any) -> None:
    coverage_window = require_object(value, "coverageWindow")
    require_exact_members(
        coverage_window.get("lifecycleUnits"),
        EXPECTED_COVERAGE_WINDOW,
        "coverageWindow.lifecycleUnits",
    )
    receipt_id = require_string(
        coverage_window.get("effectiveReviewContractReceiptId"),
        "coverageWindow.effectiveReviewContractReceiptId",
    )
    if receipt_id != EXPECTED_REVIEW_CONTRACT_RECEIPT_ID:
        raise ValidationError(
            "coverageWindow.effectiveReviewContractReceiptId must be "
            f"{EXPECTED_REVIEW_CONTRACT_RECEIPT_ID!r}",
        )
    require_string(coverage_window.get("rule"), "coverageWindow.rule")


def validate(ledger_path: Path, repo: Path) -> dict[str, Any]:
    if not ledger_path.is_file():
        raise ValidationError(f"ledger file does not exist: {ledger_path}")
    repo_root = repo.resolve()
    try:
        ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValidationError(f"{ledger_path} is not valid JSON: {exc}") from exc
    root = require_object(ledger, "ledger")

    schema_version = require_string(root.get("schemaVersion"), "schemaVersion")
    if schema_version != EXPECTED_SCHEMA_VERSION:
        raise ValidationError(f"schemaVersion must be {EXPECTED_SCHEMA_VERSION!r}")

    goal_slug = require_string(root.get("goalSlug"), "goalSlug")
    if goal_slug != EXPECTED_GOAL_SLUG:
        raise ValidationError(f"goalSlug must be {EXPECTED_GOAL_SLUG!r}")

    generated_at = require_string(root.get("generatedAt"), "generatedAt")
    try:
        datetime.fromisoformat(generated_at.replace("Z", "+00:00"))
    except (ValueError, AttributeError) as exc:
        raise ValidationError(f"generatedAt must be a valid ISO 8601 timestamp: {exc}") from exc
    validate_coverage_window(root.get("coverageWindow"))
    require_exact_members(root.get("requiredSkillLenses"), REQUIRED_SKILL_LENSES, "requiredSkillLenses")
    require_exact_members(
        root.get("requiredIndependentReviewers"),
        REQUIRED_REVIEWERS,
        "requiredIndependentReviewers",
    )

    receipt_cache: dict[str, dict[str, dict[str, Any]]] = {}
    accepted_refs = require_object(root.get("acceptedExceptionRefs"), "acceptedExceptionRefs")
    allowed_exceptions: set[str] = set()
    for key, ref in accepted_refs.items():
        require_string(key, f"acceptedExceptionRefs.{key}.key")
        resolved_ref = resolve_ref(ref, f"acceptedExceptionRefs.{key}", repo_root, receipt_cache)
        allowed_exceptions.add(resolved_ref)

    units = require_list(root.get("lifecycleUnits"), "lifecycleUnits")
    observed: list[str] = []
    for entry in units:
        observed.append(
            validate_lifecycle_unit(
                entry,
                repo=repo_root,
                receipt_cache=receipt_cache,
                allowed_exceptions=allowed_exceptions,
            ),
        )

    duplicates = sorted({unit for unit in observed if observed.count(unit) > 1})
    if duplicates:
        raise ValidationError(f"duplicate lifecycle unit(s): {', '.join(duplicates)}")

    missing = [unit for unit in REQUIRED_LIFECYCLE_UNITS if unit not in observed]
    if missing:
        raise ValidationError(f"lifecycleUnits missing required unit(s): {', '.join(missing)}")

    extras = sorted(unit for unit in observed if unit not in REQUIRED_LIFECYCLE_UNITS)
    if extras:
        raise ValidationError(f"lifecycleUnits has unsupported unit(s): {', '.join(extras)}")

    return {
        "status": "pass",
        "schemaVersion": EXPECTED_SCHEMA_VERSION,
        "goalSlug": EXPECTED_GOAL_SLUG,
        "lifecycleUnitCount": len(observed),
        "requiredSkillLenses": list(REQUIRED_SKILL_LENSES),
        "requiredIndependentReviewers": list(REQUIRED_REVIEWERS),
    }


def main() -> int:
    args = parse_args()
    try:
        result = validate(Path(args.ledger), Path(args.repo))
    except ValidationError as exc:
        return fail(str(exc))
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
