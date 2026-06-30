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
GENERIC_ALLOWED_GOAL_ROOT = {
    "goal.md",
    "state.yaml",
    "receipts.jsonl",
    "notes",
    "current-route.json",
}
GENERIC_TASK_ID = re.compile(r"^T\d{3}$")
GENERIC_TASK_TYPES = {"scout", "judge", "worker", "pm"}
GENERIC_ASSIGNEES = {"Scout", "Judge", "Worker", "PM"}
GENERIC_STATUSES = {"queued", "active", "blocked", "done"}
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
RUNTIME_EVIDENCE_CURRENT_ROUTE_PATH = (
    REPO_ROOT / RUNTIME_EVIDENCE_COCKPIT_GOAL / "current-route.json"
)
REQUIRED_RUNTIME_EVIDENCE_ROUTE_REFS = (
    ".harness/specs/2026-05-24-codex-runtime-evidence-verifier-cockpit-spec.md",
    ".harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md",
    "docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md",
    ".harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md",
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
JsonObject = dict[str, Any]


def strip_yaml_comment(value: str) -> str:
    quote: str | None = None
    escaped = False
    for index, char in enumerate(value):
        if escaped:
            escaped = False
            continue
        if char == "\\":
            escaped = True
            continue
        if char in {"'", '"'}:
            if quote is None:
                quote = char
            elif quote == char:
                quote = None
            continue
        if char == "#" and quote is None:
            return value[:index].strip()
    return value.strip()


def parse_yaml_scalar(value: str) -> object:
    cleaned = strip_yaml_comment(value)
    if cleaned in {"", "null", "Null", "NULL", "~"}:
        return None
    if cleaned in {"true", "True", "TRUE"}:
        return True
    if cleaned in {"false", "False", "FALSE"}:
        return False
    if (
        (cleaned.startswith('"') and cleaned.endswith('"'))
        or (cleaned.startswith("'") and cleaned.endswith("'"))
    ):
        return cleaned[1:-1]
    try:
        return int(cleaned)
    except ValueError:
        return cleaned


def parse_yaml_mapping_fallback(text: str) -> dict[str, object]:
    root: dict[str, object] = {}
    stack: list[tuple[int, dict[str, object]]] = [(-1, root)]

    for raw_line in text.splitlines():
        if not raw_line.strip() or raw_line.lstrip().startswith("#"):
            continue
        indent = len(raw_line) - len(raw_line.lstrip())
        line = raw_line.strip()
        if ":" not in line:
            continue
        key, raw_value = line.split(":", 1)
        key = key.strip().strip('"').strip("'")
        if not key:
            continue
        while stack and indent <= stack[-1][0]:
            stack.pop()
        parent = stack[-1][1]
        if raw_value.strip() == "":
            child: dict[str, object] = {}
            parent[key] = child
            stack.append((indent, child))
        else:
            parent[key] = parse_yaml_scalar(raw_value)

    return root


def load_state_mapping(state_path: Path) -> object:
    text = state_path.read_text(encoding="utf-8")
    try:
        import yaml  # type: ignore[import-untyped]
    except ModuleNotFoundError:
        return parse_yaml_mapping_fallback(text)

    try:
        return yaml.safe_load(text)
    except yaml.YAMLError as exc:
        print(
            f"Runtime evidence cockpit state file is not valid YAML: {state_path}: {exc}",
            file=sys.stderr,
        )
        raise SystemExit(1) from exc


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


def resolve_validator() -> Path | None:
    for candidate in candidate_validators():
        if candidate.is_file():
            return candidate
    return None


def resolve_goal_dir(argv: list[str]) -> Path:
    for value in argv:
        if value.startswith("-"):
            continue
        goal_dir = Path(value).expanduser()
        if not goal_dir.is_absolute():
            goal_dir = REPO_ROOT / goal_dir
        return goal_dir.resolve()
    print("Goal directory argument is required.", file=sys.stderr)
    raise SystemExit(2)


def task_list_from_state(state: Mapping[str, object]) -> list[dict[str, object]]:
    raw_tasks = state.get("tasks")
    if not isinstance(raw_tasks, list):
        return []
    tasks: list[dict[str, object]] = []
    for raw_task in cast(list[object], raw_tasks):
        if isinstance(raw_task, dict):
            tasks.append(cast(dict[str, object], raw_task))
    return tasks


def parse_tasks_fallback(state_path: Path) -> list[dict[str, object]]:
    tasks: list[dict[str, object]] = []
    in_tasks = False
    task_item_indent: int | None = None
    current: dict[str, object] | None = None
    for raw_line in state_path.read_text(encoding="utf-8").splitlines():
        stripped = raw_line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        indent = len(raw_line) - len(raw_line.lstrip())
        if raw_line.startswith("tasks:"):
            in_tasks = True
            continue
        if not in_tasks:
            continue
        if not raw_line.startswith(" ") and not raw_line.startswith("-"):
            break
        if stripped.startswith("- "):
            if task_item_indent is None:
                task_item_indent = indent
            if indent != task_item_indent:
                continue
            if current is not None:
                tasks.append(current)
            current = {}
            item = stripped[2:].strip()
            if ":" in item:
                key, value = item.split(":", 1)
                current[key.strip()] = parse_yaml_scalar(value.strip())
            continue
        if current is None or ":" not in stripped:
            continue
        if task_item_indent is not None and indent <= task_item_indent:
            continue
        key, value = stripped.split(":", 1)
        current[key.strip()] = parse_yaml_scalar(value.strip())
    if current is not None:
        tasks.append(current)
    return tasks


def generic_validate_goal_board(argv: list[str]) -> int:
    goal_dir = resolve_goal_dir(argv)
    if not goal_dir.is_dir():
        print(f"Goal directory not found: {goal_dir}", file=sys.stderr)
        return 2

    root_entries = {entry.name for entry in goal_dir.iterdir()}
    unexpected = sorted(root_entries - GENERIC_ALLOWED_GOAL_ROOT)
    if unexpected:
        print(f"FAIL: unexpected root entries: {', '.join(unexpected)}", file=sys.stderr)
        return 1

    required = ("goal.md", "state.yaml", "receipts.jsonl")
    missing = [name for name in required if not (goal_dir / name).is_file()]
    if missing:
        print(f"FAIL: missing required files: {', '.join(missing)}", file=sys.stderr)
        return 1

    try:
        state = load_state_mapping(goal_dir / "state.yaml")
    except SystemExit as exc:
        return normalize_exit_code(exc.code)
    if not isinstance(state, Mapping):
        print("FAIL: state.yaml must parse as a mapping", file=sys.stderr)
        return 1

    tasks = task_list_from_state(cast(Mapping[str, object], state))
    if not tasks:
        tasks = parse_tasks_fallback(goal_dir / "state.yaml")
    active_tasks = [task for task in tasks if task.get("status") == "active"]
    if len(active_tasks) != 1:
        print("FAIL: exactly one task must be active", file=sys.stderr)
        return 1

    for index, task in enumerate(tasks, start=1):
        task_id = task.get("id")
        task_type = task.get("type")
        assignee = task.get("assignee")
        status = task.get("status")
        receipt_id = task.get("receipt_id")
        if not isinstance(task_id, str) or not GENERIC_TASK_ID.match(task_id):
            print(f"FAIL: tasks[{index}] has invalid id", file=sys.stderr)
            return 1
        if task_type not in GENERIC_TASK_TYPES:
            print(f"FAIL: {task_id} has invalid type", file=sys.stderr)
            return 1
        if assignee not in GENERIC_ASSIGNEES:
            print(f"FAIL: {task_id} has invalid assignee", file=sys.stderr)
            return 1
        if status not in GENERIC_STATUSES:
            print(f"FAIL: {task_id} has invalid status", file=sys.stderr)
            return 1
        if status in {"active", "done"} and (
            not isinstance(receipt_id, str) or not receipt_id.strip()
        ):
            print(f"FAIL: {task_id} missing receipt_id", file=sys.stderr)
            return 1

    try:
        receipts = load_runtime_evidence_receipts(goal_dir / "receipts.jsonl")
    except SystemExit as exc:
        return normalize_exit_code(exc.code)
    receipt_ids = {
        receipt.get("id")
        for _line_number, receipt in receipts
        if isinstance(receipt.get("id"), str)
    }
    for task in tasks:
        receipt_id = task.get("receipt_id")
        if isinstance(receipt_id, str) and receipt_id not in receipt_ids:
            print(
                f"FAIL: {task.get('id')} references missing receipt {receipt_id}",
                file=sys.stderr,
            )
            return 1

    print("PASS: goal board is valid")
    return 0


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


def latest_route_receipt_head(receipts_path: Path) -> str:
    receipts = load_runtime_evidence_receipts(receipts_path)
    for _line_number, receipt in reversed(receipts):
        head = receipt.get("head_sha")
        if isinstance(head, str) and head.strip():
            return head.strip()

    if receipts:
        print(
            "No head_sha found in runtime evidence cockpit receipts: "
            f"{receipts_path}",
            file=sys.stderr,
        )
        raise SystemExit(1)

    print(
        f"Runtime evidence cockpit receipts file has no receipts: {receipts_path}",
        file=sys.stderr,
    )
    raise SystemExit(1)


def latest_route_receipt_identity(receipts_path: Path) -> tuple[str, str]:
    receipts = load_runtime_evidence_receipts(receipts_path)
    for _line_number, receipt in reversed(receipts):
        receipt_id = receipt.get("id")
        head = receipt.get("head_sha")
        if (
            isinstance(receipt_id, str)
            and receipt_id.strip()
            and isinstance(head, str)
            and head.strip()
        ):
            return receipt_id.strip(), head.strip()

    print(
        "No receipt with both id and head_sha found in runtime evidence "
        f"cockpit receipts: {receipts_path}",
        file=sys.stderr,
    )
    raise SystemExit(1)


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


def parse_runtime_active_route(state_path: Path) -> dict[str, str]:
    if not state_path.is_file():
        print(
            f"Runtime evidence cockpit state file is missing: {state_path}",
            file=sys.stderr,
        )
        raise SystemExit(1)

    state = load_state_mapping(state_path)

    if not isinstance(state, Mapping):
        return {}
    state_mapping = cast(Mapping[str, object], state)

    thin_execution_tracker = state_mapping.get("thin_execution_tracker")
    if not isinstance(thin_execution_tracker, Mapping):
        return {}
    tracker_mapping = cast(Mapping[str, object], thin_execution_tracker)

    active_route = tracker_mapping.get("active_route")
    if active_route is None:
        # Missing active_route is intentionally a no-op for this narrow guard:
        # the stale-route check only rejects an explicitly declared GitHub PR route.
        return {}
    if not isinstance(active_route, Mapping):
        print(
            "Runtime evidence cockpit active_route must be a mapping when present.",
            file=sys.stderr,
        )
        raise SystemExit(1)
    active_route_mapping = cast(Mapping[object, object], active_route)

    fields: dict[str, str] = {}
    for key, value in active_route_mapping.items():
        if isinstance(key, str) and value is not None:
            fields[key] = str(value)
    return fields


def check_stale_runtime_pr_route(
    goal_path: Path,
    jsc_363_rows: list[str],
) -> int:
    active_route = parse_runtime_active_route(goal_path / "state.yaml")
    violations: list[str] = []

    route_kind = active_route.get("kind")
    open_pr_count = active_route.get("open_pr_count")
    active_branch = active_route.get("active_branch", "")
    stale_merge_phrases = ("merge this post-PR", "merge and pull this post-PR")
    route_text = "\n".join(jsc_363_rows)

    if (
        route_kind == "github_pr"
        and open_pr_count == "0"
        and active_branch.startswith("codex/")
    ):
        violations.append(
            "Runtime evidence cockpit state has a github_pr active_route with "
            "open_pr_count: 0 but still names active_branch "
            f"{active_branch}. After a PR merges and main is pulled, the route "
            "must either record no active PR branch or set open_pr_count to the "
            "real open PR count."
        )

    violations.extend(
        "Project Brain active-artifacts index contains stale post-merge "
        f"route text: {phrase!r}. Current-main route truth must not tell "
        "operators to merge a blocker-refresh PR that has already merged."
        for phrase in stale_merge_phrases
        if phrase in route_text
    )

    if violations:
        print("\n".join(violations), file=sys.stderr)
        return 1
    return 0


def load_json_object(path: Path, label: str) -> JsonObject:
    if not path.is_file():
        print(f"Required {label} is missing: {path}", file=sys.stderr)
        raise SystemExit(1)
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"{label} is not valid JSON: {path}: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
    if not isinstance(value, dict):
        print(f"{label} must be a JSON object: {path}", file=sys.stderr)
        raise SystemExit(1)
    return cast(JsonObject, value)


def check_current_route_guard(jsc_363_rows: list[str]) -> int:
    guard = load_json_object(
        RUNTIME_EVIDENCE_CURRENT_ROUTE_PATH,
        "runtime evidence cockpit current-route guard",
    )
    latest_receipt_id, latest_head = latest_route_receipt_identity(
        RUNTIME_EVIDENCE_RECEIPTS_PATH,
    )
    violations: list[str] = []

    expected_scalars = {
        "schemaVersion": "goal-current-route/v1",
        "goalSlug": "codex-runtime-evidence-verifier-cockpit",
        "issueKey": "JSC-363",
        "currentHeadSha": latest_head,
        "lastReceipt": latest_receipt_id,
    }
    for key, expected in expected_scalars.items():
        actual = guard.get(key)
        if actual != expected:
            violations.append(
                "Runtime evidence cockpit current-route guard has stale "
                f"{key}: expected {expected!r}, got {actual!r}."
            )

    if guard.get("status") not in {"blocked", "active"}:
        violations.append(
            "Runtime evidence cockpit current-route guard status must be "
            "'blocked' or 'active' while parent completion remains unclaimed."
        )

    blockers = guard.get("blockers")
    if not isinstance(blockers, list) or not blockers:
        violations.append(
            "Runtime evidence cockpit current-route guard must list at least "
            "one blocker while Judge/PM readiness and parent completion are "
            "unclaimed."
        )

    canonical_refs_value = guard.get("canonicalRefs")
    if not isinstance(canonical_refs_value, list) or not all(
        isinstance(item, str) for item in cast(list[object], canonical_refs_value)
    ):
        violations.append(
            "Runtime evidence cockpit current-route guard canonicalRefs must "
            "be a list of strings."
        )
    else:
        canonical_refs = cast(list[str], canonical_refs_value)
        missing_guard_refs = [
            ref
            for ref in REQUIRED_RUNTIME_EVIDENCE_ROUTE_REFS
            if ref not in canonical_refs
        ]
        if missing_guard_refs:
            violations.append(
                "Runtime evidence cockpit current-route guard is missing "
                "canonical refs: " + ", ".join(missing_guard_refs)
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

    latest_route_head = latest_route_receipt_head(RUNTIME_EVIDENCE_RECEIPTS_PATH)
    if not any(latest_route_head in row for row in jsc_363_rows):
        print(
            "Project Brain active-artifacts index routes JSC-363 with stale "
            "route state. Latest receipt head "
            f"{latest_route_head} is missing from Current Active Route.",
            file=sys.stderr,
        )
        return 1

    current_route_guard_status = check_current_route_guard(jsc_363_rows)
    if current_route_guard_status != 0:
        return current_route_guard_status

    stale_route_status = check_stale_runtime_pr_route(goal_path, jsc_363_rows)
    if stale_route_status != 0:
        return stale_route_status

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
    if validator is None:
        validator_status = generic_validate_goal_board(sys.argv[1:])
    else:
        validator_status = run_goal_board_validator(validator, sys.argv[1:])
    if validator_status != 0:
        raise SystemExit(validator_status)
    raise SystemExit(run_goal_extensions(sys.argv[1:]))
