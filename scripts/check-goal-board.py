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
import re
import runpy
import subprocess
import sys
import urllib.parse
from collections.abc import Mapping
from pathlib import Path
from typing import Any, cast


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
LOCAL_PATH_GUARD_CUTOFF_RECEIPT_NUMBER = 151
JSON_OBJECT_KEY = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
UNIX_HOME_PATH = re.compile(r"(^|[^A-Za-z0-9_])/(Users|home|var/home)/[^/\s]+")
WINDOWS_HOME_PATH = re.compile(
    r"(^|[^A-Za-z0-9_])[A-Za-z]:/Users/[^/\s]+",
    re.IGNORECASE,
)
WSL_HOME_PATH = re.compile(
    r"(^|[^A-Za-z0-9_])/mnt/[A-Za-z]/Users/[^/\s]+",
    re.IGNORECASE,
)
TILDE_HOME_PATH = re.compile(r"(^|[\s:=,])~/[^\s]+")
type JsonObject = dict[str, Any]


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
    snapshot_payload = cast(Mapping[str, object], snapshot)
    pr_number = (
        snapshot_payload.get("pr")
        or snapshot_payload.get("number")
        or snapshot_payload.get("pr_number")
    )
    if pr_number == 309 or pr_number == "309":
        return True
    nested = snapshot_payload.get("pr_309")
    return isinstance(nested, dict)


def head_from_snapshot(snapshot: object) -> str | None:
    if not isinstance(snapshot, dict):
        return None
    snapshot_payload = cast(Mapping[str, object], snapshot)
    candidates: list[Mapping[str, object]] = [snapshot_payload]
    nested = snapshot_payload.get("pr_309")
    if isinstance(nested, dict):
        candidates.append(cast(Mapping[str, object], nested))
    for candidate in candidates:
        for key in PR_309_HEAD_KEYS:
            value = candidate.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    return None


def load_runtime_evidence_receipts(receipts_path: Path) -> list[tuple[int, JsonObject]]:
    if not receipts_path.is_file():
        print(
            f"Runtime evidence cockpit receipts file is missing: {receipts_path}",
            file=sys.stderr,
        )
        raise SystemExit(1)

    receipts: list[tuple[int, JsonObject]] = []
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
        if not isinstance(receipt, dict):
            print(
                f"Runtime evidence cockpit receipt at {receipts_path}:{line_number} "
                "must be a JSON object.",
                file=sys.stderr,
            )
            raise SystemExit(1)
        receipts.append((line_number, cast(JsonObject, receipt)))
    return receipts


def latest_pr_309_receipt_head(receipts_path: Path) -> str | None:
    latest_head: str | None = None
    for _line_number, receipt in load_runtime_evidence_receipts(receipts_path):
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


def receipt_number(receipt: Mapping[str, object]) -> int | None:
    value = receipt.get("id")
    if not isinstance(value, str):
        return None
    match = re.fullmatch(r"R(\d+)", value.strip())
    if match is None:
        return None
    return int(match.group(1))


def receipt_cutover_candidate_number(receipt: Mapping[str, object]) -> int | None:
    value = receipt.get("id")
    if not isinstance(value, str):
        return None
    match = re.match(r"R(\d+)", value.strip())
    if match is None:
        return None
    return int(match.group(1))


def json_path_child(path: str, key: object) -> str:
    if isinstance(key, int):
        return f"{path}[{key}]"
    if isinstance(key, str) and JSON_OBJECT_KEY.fullmatch(key):
        return f"{path}.{key}"
    return f"{path}[<key>]"


def json_path_key(path: str) -> str:
    return f"{path}[<key>]"


def iter_string_leaves(value: object, path: str = "$") -> list[tuple[str, str]]:
    if isinstance(value, str):
        return [(path, value)]
    if isinstance(value, dict):
        leaves: list[tuple[str, str]] = []
        for key, child in cast(Mapping[object, object], value).items():
            if isinstance(key, str):
                leaves.append((json_path_key(path), key))
            leaves.extend(iter_string_leaves(child, json_path_child(path, key)))
        return leaves
    if isinstance(value, list):
        leaves: list[tuple[str, str]] = []
        for index, child in enumerate(cast(list[object], value)):
            leaves.extend(iter_string_leaves(child, json_path_child(path, index)))
        return leaves
    return []


def normalize_path_probe(value: str) -> str:
    decoded = urllib.parse.unquote(value)
    if decoded.startswith("file://"):
        decoded = urllib.parse.urlparse(decoded).path
        decoded = urllib.parse.unquote(decoded)
    return decoded.replace("\\", "/")


def local_home_path_kind(value: str) -> str | None:
    normalized = normalize_path_probe(value)
    if WINDOWS_HOME_PATH.search(normalized):
        return "Windows user profile path"
    if WSL_HOME_PATH.search(normalized):
        return "WSL user profile path"
    if UNIX_HOME_PATH.search(normalized):
        return "Unix or macOS home path"
    if TILDE_HOME_PATH.search(normalized):
        return "tilde home path"
    return None


def receipts_for_local_path_guard(
    receipts: list[tuple[int, JsonObject]],
) -> list[tuple[int, JsonObject]]:
    post_cutover: list[tuple[int, JsonObject]] = []
    cutover_seen = False
    for line_number, receipt in receipts:
        exact_number = receipt_number(receipt)
        candidate_number = receipt_cutover_candidate_number(receipt)
        if exact_number is not None and exact_number >= LOCAL_PATH_GUARD_CUTOFF_RECEIPT_NUMBER:
            cutover_seen = True
        if cutover_seen or (
            candidate_number is not None
            and candidate_number >= LOCAL_PATH_GUARD_CUTOFF_RECEIPT_NUMBER
        ):
            post_cutover.append((line_number, receipt))
    if post_cutover:
        return post_cutover
    return receipts[-1:]


def check_receipt_local_path_hygiene(receipts_path: Path) -> int:
    violations: list[str] = []
    for line_number, receipt in receipts_for_local_path_guard(
        load_runtime_evidence_receipts(receipts_path),
    ):
        receipt_id = receipt.get("id")
        receipt_label = receipt_id if isinstance(receipt_id, str) else f"line {line_number}"
        for json_path, value in iter_string_leaves(receipt):
            path_kind = local_home_path_kind(value)
            if path_kind is None:
                continue
            violations.append(
                "Runtime evidence cockpit receipt contains a local home path "
                f"({path_kind}) at receipt {receipt_label}, line {line_number}, "
                f"JSON path {json_path}. Store a repo-relative evidence ref, "
                "durable artifact ref, or <REDACTED_HOME_PATH> placeholder instead."
            )
    if violations:
        print("\n".join(violations), file=sys.stderr)
        return 1
    return 0


def check_duplicate_receipt_ids(receipts_path: Path) -> int:
    seen: dict[str, int] = {}
    violations: list[str] = []
    for line_number, receipt in load_runtime_evidence_receipts(receipts_path):
        receipt_id = receipt.get("id")
        if not isinstance(receipt_id, str) or not receipt_id.strip():
            continue
        normalized_id = receipt_id.strip()
        first_line = seen.get(normalized_id)
        if first_line is None:
            seen[normalized_id] = line_number
            continue
        violations.append(
            "Runtime evidence cockpit receipt id must be unique: "
            f"{normalized_id} appears at lines {first_line} and {line_number}. "
            "Append a new receipt id or remove the duplicate before using this "
            "goal board as route truth."
        )
    if violations:
        print("\n".join(violations), file=sys.stderr)
        return 1
    return 0


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

    duplicate_receipt_status = check_duplicate_receipt_ids(
        RUNTIME_EVIDENCE_RECEIPTS_PATH,
    )
    if duplicate_receipt_status != 0:
        return duplicate_receipt_status

    receipt_hygiene_status = check_receipt_local_path_hygiene(
        RUNTIME_EVIDENCE_RECEIPTS_PATH,
    )
    if receipt_hygiene_status != 0:
        return receipt_hygiene_status

    return 0


if __name__ == "__main__":
    validator = resolve_validator()
    validator_status = run_goal_board_validator(validator, sys.argv[1:])
    if validator_status != 0:
        raise SystemExit(validator_status)
    raise SystemExit(run_goal_extensions(sys.argv[1:]))
