#!/usr/bin/env python3
"""Repo-local entrypoint for the Goal Governor board validator.

The validator implementation lives with the Goal Governor skill. This wrapper
keeps repository docs and PR review commands portable by providing one stable
repo command while still allowing operators to point at a different skill
checkout through GOAL_GOVERNOR_CHECK_GOAL_BOARD or the older
GOAL_GOVERNOR_CHECK_BOARD override used by the shell wrapper.
"""

from __future__ import annotations

import json
import os
import runpy
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
RELATIVE_SKILL_VALIDATOR = Path(
    "Skills/agent-ops/goal-governor/scripts/check_goal_board.py",
)
ENV_OVERRIDES = ("GOAL_GOVERNOR_CHECK_GOAL_BOARD", "GOAL_GOVERNOR_CHECK_BOARD")
RUNTIME_EVIDENCE_COCKPIT_GOAL = Path(
    "docs/goals/codex-runtime-evidence-verifier-cockpit",
)
AUDIT_FRESHNESS_VALIDATOR = REPO_ROOT / "scripts/check-goal-audit-freshness.py"
REVIEW_BACKFILL_VALIDATOR = REPO_ROOT / "scripts/check-goal-review-backfill.py"
REVIEW_BACKFILL_LEDGER = (
    REPO_ROOT / RUNTIME_EVIDENCE_COCKPIT_GOAL / "notes/review-coverage-backfill.json"
)
ACTIVE_ARTIFACTS_PATH = REPO_ROOT / ".harness/active-artifacts.md"
RUNTIME_EVIDENCE_RECEIPTS_PATH = (
    REPO_ROOT / RUNTIME_EVIDENCE_COCKPIT_GOAL / "receipts.jsonl"
)
REQUIRED_RUNTIME_EVIDENCE_ROUTE_REFS = (
    ".harness/specs/2026-05-24-codex-runtime-evidence-verifier-cockpit-spec.md",
    ".harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md",
    "docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md",
    ".harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md",
)
PR_309_HEAD_KEYS = (
    "head_sha",
    "observed_head_sha",
    "headRefOid",
    "head_ref_oid",
    "current_head_sha",
)


def source_checkout_root() -> Path | None:
    try:
        common_dir = subprocess.check_output(
            [
                "git",
                "rev-parse",
                "--path-format=absolute",
                "--git-common-dir",
            ],
            cwd=REPO_ROOT,
            stderr=subprocess.DEVNULL,
            text=True,
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return None

    common_path = Path(common_dir)
    if common_path.name != ".git":
        return None
    return common_path.parent


def candidate_validators() -> list[Path]:
    candidates: list[Path] = []
    for env_name in ENV_OVERRIDES:
        override = os.environ.get(env_name)
        if override:
            candidates.append(Path(override).expanduser())
    candidates.append(REPO_ROOT.parent / "agent-skills" / RELATIVE_SKILL_VALIDATOR)
    source_root = source_checkout_root()
    if source_root and source_root != REPO_ROOT:
        candidates.append(source_root.parent / "agent-skills" / RELATIVE_SKILL_VALIDATOR)
    candidates.append(Path.home() / "dev" / "agent-skills" / RELATIVE_SKILL_VALIDATOR)
    return list(dict.fromkeys(candidates))


def resolve_validator() -> Path:
    for candidate in candidate_validators():
        if candidate.is_file():
            return candidate
    searched = "\n- ".join(str(candidate) for candidate in candidate_validators())
    raise SystemExit(
        "Cannot find Goal Governor board validator. Searched:\n"
        f"- {searched}\n"
        "Set GOAL_GOVERNOR_CHECK_GOAL_BOARD or GOAL_GOVERNOR_CHECK_BOARD "
        "to the validator path if your skill checkout lives elsewhere.",
    )


def normalize_exit_code(value: object) -> int:
    if value is None:
        return 0
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        return 0 if value == "" else 1
    return 1


def run_goal_board_validator(validator: Path, argv: list[str]) -> int:
    previous_argv = sys.argv
    sys.argv = [str(validator), *argv]
    try:
        try:
            runpy.run_path(str(validator), run_name="__main__")
        except SystemExit as exc:
            return normalize_exit_code(exc.code)
    finally:
        sys.argv = previous_argv
    return 0


def resolve_runtime_evidence_goal_path(argv: list[str]) -> Path | None:
    expected_goal_path = (REPO_ROOT / RUNTIME_EVIDENCE_COCKPIT_GOAL).resolve()
    for value in argv:
        if value.startswith("-"):
            continue
        candidate = Path(value).expanduser()
        if not candidate.is_absolute():
            candidate = (REPO_ROOT / candidate).resolve()
        else:
            candidate = candidate.resolve()
        if candidate == expected_goal_path:
            return candidate
    return None


def markdown_section_lines(content: str, heading: str) -> list[str]:
    section_lines: list[str] = []
    in_section = False
    heading_marker = f"## {heading}"
    for line in content.splitlines():
        if line.startswith("## "):
            if in_section:
                break
            if line.strip() == heading_marker:
                in_section = True
            continue
        if in_section:
            section_lines.append(line)
    return section_lines


def snapshot_matches_pr_309(snapshot: object) -> bool:
    if not isinstance(snapshot, dict):
        return False
    pr_number = snapshot.get("pr") or snapshot.get("number") or snapshot.get("pr_number")
    if pr_number == 309 or pr_number == "309":
        return True
    nested = snapshot.get("pr_309")
    return isinstance(nested, dict)


def head_from_snapshot(snapshot: object) -> str | None:
    if not isinstance(snapshot, dict):
        return None
    candidates = [snapshot]
    nested = snapshot.get("pr_309")
    if isinstance(nested, dict):
        candidates.append(nested)
    for candidate in candidates:
        for key in PR_309_HEAD_KEYS:
            value = candidate.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    return None


def latest_pr_309_receipt_head(receipts_path: Path) -> str | None:
    if not receipts_path.is_file():
        print(
            f"Runtime evidence cockpit receipts file is missing: {receipts_path}",
            file=sys.stderr,
        )
        raise SystemExit(1)

    latest_head: str | None = None
    for line_number, line in enumerate(
        receipts_path.read_text(encoding="utf-8").splitlines(),
        start=1,
    ):
        if not line.strip():
            continue
        try:
            receipt = json.loads(line)
        except json.JSONDecodeError as exc:
            print(
                f"Invalid JSON in runtime evidence cockpit receipts at "
                f"{receipts_path}:{line_number}: {exc}",
                file=sys.stderr,
            )
            raise SystemExit(1) from exc
        snapshot = receipt.get("pr_state_snapshot")
        if snapshot_matches_pr_309(snapshot):
            head = head_from_snapshot(snapshot)
            if head:
                latest_head = head

    if latest_head is None:
        print(
            f"No PR #309 head found in runtime evidence cockpit receipts: {receipts_path}",
            file=sys.stderr,
        )
        raise SystemExit(1)

    return latest_head


def run_goal_extensions(argv: list[str]) -> int:
    goal_path = resolve_runtime_evidence_goal_path(argv)
    if goal_path is None:
        return 0

    if not AUDIT_FRESHNESS_VALIDATOR.is_file():
        print(
            "Required audit freshness validator is missing: "
            f"{AUDIT_FRESHNESS_VALIDATOR}",
            file=sys.stderr,
        )
        return 1

    result = subprocess.run(
        [
            sys.executable,
            str(AUDIT_FRESHNESS_VALIDATOR),
            str(goal_path),
            "--repo",
            str(REPO_ROOT),
        ],
        check=False,
    )
    if result.returncode != 0:
        return result.returncode

    if not REVIEW_BACKFILL_VALIDATOR.is_file():
        print(
            "Required review coverage backfill validator is missing: "
            f"{REVIEW_BACKFILL_VALIDATOR}",
            file=sys.stderr,
        )
        return 1

    result = subprocess.run(
        [
            sys.executable,
            str(REVIEW_BACKFILL_VALIDATOR),
            str(REVIEW_BACKFILL_LEDGER),
            "--repo",
            str(REPO_ROOT),
        ],
        check=False,
    )
    if result.returncode != 0:
        return result.returncode

    if not ACTIVE_ARTIFACTS_PATH.is_file():
        print(
            "Required Project Brain active-artifacts index is missing: "
            f"{ACTIVE_ARTIFACTS_PATH}",
            file=sys.stderr,
        )
        return 1

    active_artifacts = ACTIVE_ARTIFACTS_PATH.read_text(encoding="utf-8")
    current_route_lines = markdown_section_lines(
        active_artifacts,
        "Current Active Route",
    )
    jsc_363_rows = [
        line
        for line in current_route_lines
        if line.lstrip().startswith("|") and "JSC-363" in line
    ]
    if not jsc_363_rows:
        print(
            "Project Brain active-artifacts index does not route the runtime "
            "evidence cockpit goal from Current Active Route. Missing JSC-363 "
            "route row.",
            file=sys.stderr,
        )
        return 1

    missing_refs = [
        ref
        for ref in REQUIRED_RUNTIME_EVIDENCE_ROUTE_REFS
        if not any(ref in row for row in jsc_363_rows)
    ]
    if missing_refs:
        print(
            "Project Brain active-artifacts index does not route the runtime "
            "evidence cockpit goal. Missing refs: "
            + ", ".join(missing_refs),
            file=sys.stderr,
        )
        return 1

    latest_pr_head = latest_pr_309_receipt_head(RUNTIME_EVIDENCE_RECEIPTS_PATH)
    if latest_pr_head and not any(latest_pr_head in row for row in jsc_363_rows):
        print(
            "Project Brain active-artifacts index routes JSC-363 with stale "
            "PR #309 state. Latest receipt head "
            f"{latest_pr_head} is missing from Current Active Route.",
            file=sys.stderr,
        )
        return 1

    return 0


if __name__ == "__main__":
    validator = resolve_validator()
    validator_status = run_goal_board_validator(validator, sys.argv[1:])
    if validator_status != 0:
        raise SystemExit(validator_status)
    raise SystemExit(run_goal_extensions(sys.argv[1:]))
