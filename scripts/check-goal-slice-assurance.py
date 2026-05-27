#!/usr/bin/env python3
"""Validate per-slice skill-lens and reviewer assurance receipts.

This deliberately checks one receipt at a time. Historical receipts may predate
the current assurance contract, but new slice-done claims must name the exact
receipt whose lenses and independent reviews support the claim.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


REQUIRED_SKILL_LENSES = {
    "improve-codebase-architecture",
    "simplify",
    "unslopify",
    "testing",
}
REQUIRED_REVIEWERS = {
    "agent-native-reviewer",
    "adversarial-reviewer",
    "best-practices-researcher",
}
PASS_STATUSES = {"pass"}
EVIDENCE_ROOT = Path("artifacts/reviews")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Check that a goal receipt records required slice assurance.",
    )
    parser.add_argument("receipts", type=Path)
    parser.add_argument("--receipt-id", required=True)
    parser.add_argument("--repo", type=Path, default=Path("."))
    return parser.parse_args()


def load_receipt(path: Path, receipt_id: str) -> dict[str, Any]:
    matches: list[tuple[int, dict[str, Any]]] = []
    for line_number, line in enumerate(path.read_text().splitlines(), start=1):
        if not line.strip():
            continue
        try:
            receipt = json.loads(line)
        except json.JSONDecodeError as error:
            raise SystemExit(f"{path}:{line_number}: invalid JSON: {error}") from error
        if receipt.get("id") == receipt_id:
            matches.append((line_number, receipt))
    if len(matches) > 1:
        line_numbers = ", ".join(str(line_number) for line_number, _receipt in matches)
        raise SystemExit(f"receipt {receipt_id!r} is duplicated in {path} at lines {line_numbers}")
    if matches:
        return matches[0][1]
    raise SystemExit(f"receipt {receipt_id!r} not found in {path}")


def evidence_exists(repo: Path, ref: str | None) -> bool:
    if not ref:
        return False
    ref_path = Path(ref)
    if ref_path.is_absolute() or ".." in ref_path.parts:
        return False
    if not ref_path.is_relative_to(EVIDENCE_ROOT):
        return False
    candidate = (repo / ref_path).resolve()
    try:
        candidate.relative_to(repo)
    except ValueError:
        return False
    return candidate.is_file() and candidate.stat().st_size > 0


def entries_by_key(entries: Any, key: str, errors: list[str], label: str) -> dict[str, dict[str, Any]]:
    if not isinstance(entries, list):
        errors.append(f"{label} must be a list")
        return {}
    result: dict[str, dict[str, Any]] = {}
    for entry in entries:
        if not isinstance(entry, dict) or not isinstance(entry.get(key), str):
            errors.append(f"{label} contains an entry without string {key}")
            continue
        entry_key = entry[key]
        if entry_key in result:
            errors.append(f"{label} contains duplicate {key} {entry_key}")
            continue
        result[entry_key] = entry
    return result


def status_passes(status: Any) -> bool:
    return isinstance(status, str) and status in PASS_STATUSES


def changed_file_refs(receipt: dict[str, Any]) -> set[str]:
    changed_files = receipt.get("changed_files")
    if not isinstance(changed_files, list):
        return set()
    return {changed_file for changed_file in changed_files if isinstance(changed_file, str)}


def main() -> int:
    args = parse_args()
    repo = args.repo.resolve()
    receipt = load_receipt(args.receipts, args.receipt_id)
    errors: list[str] = []
    changed_refs = changed_file_refs(receipt)
    if not changed_refs:
        errors.append("receipt changed_files must list the slice evidence artifacts")

    skill_results = entries_by_key(
        receipt.get("skill_lens_results"),
        "lens",
        errors,
        "skill_lens_results",
    )
    for lens, entry in sorted(skill_results.items()):
        if not status_passes(entry.get("status")):
            errors.append(f"skill lens {lens} does not have a passing status")
        if not evidence_exists(repo, entry.get("evidence_ref")):
            errors.append(f"skill lens {lens} evidence_ref is missing or empty")
        elif entry.get("evidence_ref") not in changed_refs:
            errors.append(f"skill lens {lens} evidence_ref is not listed in changed_files")
    for lens in sorted(REQUIRED_SKILL_LENSES):
        if lens not in skill_results:
            errors.append(f"missing skill_lens_results entry for {lens}")

    reviewer_results = entries_by_key(
        receipt.get("independent_reviewer_results"),
        "reviewer",
        errors,
        "independent_reviewer_results",
    )
    reviewer_evidence_refs: dict[str, str] = {}
    for reviewer, entry in sorted(reviewer_results.items()):
        if not status_passes(entry.get("status")):
            errors.append(f"reviewer {reviewer} does not have a passing status")
        evidence_ref = entry.get("evidence_ref")
        if not evidence_exists(repo, evidence_ref):
            errors.append(f"reviewer {reviewer} evidence_ref is missing or empty")
        elif evidence_ref not in changed_refs:
            errors.append(f"reviewer {reviewer} evidence_ref is not listed in changed_files")
        elif isinstance(evidence_ref, str):
            prior_reviewer = reviewer_evidence_refs.get(evidence_ref)
            if prior_reviewer is not None:
                errors.append(
                    f"reviewer {reviewer} reuses evidence_ref already used by {prior_reviewer}",
                )
            reviewer_evidence_refs[evidence_ref] = reviewer
    for reviewer in sorted(REQUIRED_REVIEWERS):
        if reviewer not in reviewer_results:
            errors.append(f"missing independent_reviewer_results entry for {reviewer}")

    if errors:
        for error in errors:
            print(f"fail: {error}", file=sys.stderr)
        return 1

    print(
        json.dumps(
            {
                "status": "pass",
                "receipt_id": args.receipt_id,
                "required_skill_lenses": sorted(REQUIRED_SKILL_LENSES),
                "required_reviewers": sorted(REQUIRED_REVIEWERS),
            },
            sort_keys=True,
        ),
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
