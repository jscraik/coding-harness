#!/usr/bin/env python3
"""Validate that a goal receipt acknowledges the current adopted audit content.

This guard exists for the Codex Runtime Evidence Verifier Cockpit goal. It is
deliberately narrow: the governed 2026-05-26 audit must be re-read and recorded
with the current content digest and head SHA before the goal can use that audit
as closeout evidence. Filesystem mtimes are intentionally ignored because Git
checkouts rewrite them and cannot prove source freshness.
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
from typing import Any, cast


GOVERNED_AUDIT_PATH = ".harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md"
REQUIRED_RECEIPT_FIELDS = (
    "id",
    "head_sha",
    "created_at",
    "changed_files",
    "audit_sources_checked",
)
REQUIRED_SOURCE_FIELDS = ("path", "sha256", "checked_at", "head_sha")
ALLOWED_AUDIT_RECEIPT_FIELDS = {
    "action_type",
    "actor",
    "architecture_review",
    "artifact_runtime_surface_refs",
    "assignee",
    "audit_gap_ids",
    "audit_sources_checked",
    "blocked_done_claims",
    "blocked_lanes",
    "blocker_class",
    "blockers",
    "board_truth_lane_split",
    "branch",
    "changed_files",
    "changed_surfaces",
    "ci_truth",
    "circleci_credential_policy",
    "circleci_direct_api",
    "circleci_evidence",
    "circleci_truth",
    "codex_native_refinement_ids",
    "codex_runtime_state_inputs",
    "commands",
    "committed_slice_files",
    "created_at",
    "current_slice_gate",
    "decision_request_boundary_refs",
    "deferred_follow_up_or_blocker",
    "documented_surfaces",
    "durable_improvement",
    "durable_system_improvement",
    "ecosystem_review_findings",
    "environment_permission_refs",
    "evidence_commit_changed_files",
    "evidence_observed",
    "explicit_non_claims",
    "external_state_checked",
    "failure_category",
    "feedback_signal",
    "final_independent_review_results",
    "follow_up_candidates",
    "generated_architecture_surfaces",
    "github_pr_truth",
    "goal_governor_results",
    "head_sha",
    "id",
    "implementation_changed_files",
    "implementation_commit",
    "implementation_files",
    "implementation_review_findings_adopted",
    "independent_reviewer_results",
    "initial_reviewer_findings",
    "instruction_provenance_refs",
    "intent_review_results",
    "learning_gate_summary",
    "lifecycle_unit",
    "linear_evidence",
    "linear_tracker_snapshot",
    "linear_truth",
    "local_main_sync",
    "local_runtime_artifacts",
    "memory_surfaces_read",
    "next_action",
    "next_actions",
    "no_hidden_work_statement",
    "open_lifecycle_truth",
    "origin_main_sha",
    "pending_external_surfaces",
    "pr",
    "pr_state_snapshot",
    "project_brain_inputs",
    "prompt_context_refs",
    "proof_artifacts_ignored",
    "remaining_work",
    "remote_status_truth",
    "replay_packet_refs",
    "review_artifacts",
    "review_artifacts_normalized",
    "review_artifacts_promoted",
    "review_evidence",
    "review_feedback_addressed",
    "review_finding",
    "review_findings_adopted",
    "review_findings_fixed",
    "review_findings_resolved",
    "review_lifecycle_refs",
    "review_recovery_attempts",
    "review_status",
    "review_thread",
    "review_thread_refs",
    "review_thread_truth",
    "review_threads",
    "review_truth",
    "reviewer_evidence",
    "reviewer_findings_resolved",
    "reviewer_results",
    "root_operational_failure",
    "route_truth",
    "route_validation_commands",
    "runtime_card_continuity_refs",
    "runtime_identity_refs",
    "runtime_recovery_class",
    "scope_guardrails_checked",
    "sibling_pattern_sweep",
    "slice_completion_contract",
    "slice_skill_lens_results",
    "slice_status",
    "source_receipt",
    "source_repair_commit",
    "stack_dependency",
    "status",
    "steering_queue_refs",
    "subagent_artifacts",
    "summary",
    "superseded_route_files",
    "system_prompt_gap_ids",
    "task_id",
    "tool_exposure_snapshot",
    "ubiquitous_language_results",
    "validation",
    "validation_commands",
    "validation_commands_pending_after_append",
    "validation_results",
    "waiver_scope",
}
ALLOWED_AUDIT_SOURCE_FIELDS = set(REQUIRED_SOURCE_FIELDS) | {"status"}
CHECKED_AT_FUTURE_SKEW = timedelta(minutes=5)
SELF_REFERENTIAL_GOAL_RECEIPT_PATHS = {
    ".harness/active-artifacts.md",
    ".harness/implementation-notes/goal-kanban-board.html",
    "docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md",
    "docs/goals/codex-runtime-evidence-verifier-cockpit/notes/execution-tracker.md",
    "docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl",
    "docs/goals/codex-runtime-evidence-verifier-cockpit/state.yaml",
    "goal-governor-output.yaml",
}
SELF_REFERENTIAL_DECLARABLE_PATHS = SELF_REFERENTIAL_GOAL_RECEIPT_PATHS | {
    "scripts/check-goal-board.py",
    "scripts/check-goal-audit-freshness.py",
    "src/dev/check-goal-audit-freshness-script.test.ts",
    "src/dev/check-goal-board-script.test.ts",
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
        receipts.append(cast(dict[str, Any], receipt))
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
            capture_output=True,
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
    for value in cast(list[Any], changed_files):
        if not isinstance(value, str):
            return False
        declared_paths.add(normalize_repo_relative_path(value, "receipt.changed_files[]"))
    if not declared_paths <= SELF_REFERENTIAL_DECLARABLE_PATHS:
        return False
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
        for source in reversed(cast(list[Any], sources)):
            if not isinstance(source, dict):
                raise ValidationError("audit_sources_checked entries must be objects")
            source_object = cast(dict[str, Any], source)
            source_path = normalize_repo_relative_path(source_object.get("path"), "audit_sources_checked[].path")
            if source_path == audit_path:
                return receipt, source_object
    raise ValidationError(f"no audit_sources_checked entry found for {audit_path}")


def validate_receipt_key_contract(receipt: dict[str, Any], source: dict[str, Any]) -> None:
    missing_receipt_fields = [field for field in REQUIRED_RECEIPT_FIELDS if field not in receipt]
    if missing_receipt_fields:
        raise ValidationError(
            f"receipt missing required field(s): {', '.join(missing_receipt_fields)}",
        )
    unknown_receipt_fields = sorted(set(receipt) - ALLOWED_AUDIT_RECEIPT_FIELDS)
    if unknown_receipt_fields:
        raise ValidationError(
            f"receipt contains unknown field(s): {', '.join(unknown_receipt_fields)}",
        )

    changed_files = receipt.get("changed_files")
    if not isinstance(changed_files, list):
        raise ValidationError("receipt.changed_files must be a list")
    for value in cast(list[Any], changed_files):
        if not isinstance(value, str):
            raise ValidationError("receipt.changed_files[] must be a string")
        normalize_repo_relative_path(value, "receipt.changed_files[]")

    unknown_source_fields = sorted(set(source) - ALLOWED_AUDIT_SOURCE_FIELDS)
    if unknown_source_fields:
        raise ValidationError(
            "audit_sources_checked entry contains unknown field(s): "
            f"{', '.join(unknown_source_fields)}",
        )


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
            capture_output=True,
            text=True,
        ).stdout.strip()
    except (OSError, subprocess.CalledProcessError) as exc:
        raise ValidationError(f"could not retrieve current repository HEAD: {exc}") from exc

    current_sha256 = sha256_file(audit_file)
    receipt, source = latest_audit_source(receipts, audit_path)
    validate_receipt_key_contract(receipt, source)
    current_head_normalized = current_head.lower()

    missing_fields = [field for field in REQUIRED_SOURCE_FIELDS if field not in source]
    if missing_fields:
        raise ValidationError(
            f"audit_sources_checked entry missing required field(s): {', '.join(missing_fields)}",
        )

    receipt_id = require_string(receipt.get("id"), "receipt.id")
    receipt_head_sha = require_string(receipt.get("head_sha"), "receipt.head_sha")
    receipt_head_relation = classify_head_relation(
        repo_root,
        receipt_head_sha,
        current_head,
        "receipt.head_sha",
    )
    receipt_head_sha_normalized = receipt_head_sha.lower()
    source_head_sha = require_string(source.get("head_sha"), "audit_sources_checked[].head_sha")
    source_head_relation = classify_head_relation(
        repo_root,
        source_head_sha,
        current_head,
        "audit_sources_checked[].head_sha",
    )
    source_head_sha_normalized = source_head_sha.lower()
    if source_head_sha_normalized != receipt_head_sha_normalized:
        raise ValidationError("audit_sources_checked[].head_sha must match receipt.head_sha")
    if receipt_head_sha_normalized != current_head_normalized:
        full_history_receipt_permitted = permits_self_referential_goal_receipt_commit(
            repo_root,
            receipt,
            receipt_head_sha_normalized,
            source_head_sha_normalized,
            current_head_normalized,
        )
        if receipt_head_relation != "tree_equivalent" and not full_history_receipt_permitted:
            raise ValidationError(f"receipt.head_sha must match current repository HEAD: receipt={receipt_head_sha} current={current_head}")
    if source_head_sha_normalized != current_head_normalized:
        full_history_source_permitted = permits_self_referential_goal_receipt_commit(
            repo_root,
            receipt,
            receipt_head_sha_normalized,
            source_head_sha_normalized,
            current_head_normalized,
        )
        if source_head_relation != "tree_equivalent" and not full_history_source_permitted:
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
    return {
        "status": "pass",
        "audit_path": audit_path,
        "audit_sha256": current_sha256,
        "checked_at": checked_at.isoformat().replace("+00:00", "Z"),
        "receipt_id": receipt_id,
        "head_sha": receipt_head_sha_normalized,
        "head_relation": receipt_head_relation,
    }


def classify_head_relation(repo_root: Path, head_sha: str, current_head: str, field: str) -> str:
    if len(head_sha) != 40 or any(
        character not in "0123456789abcdef" for character in head_sha.lower()
    ):
        raise ValidationError(f"{field} must be a 40-character git commit SHA")
    normalized_head_sha = head_sha.lower()
    if normalized_head_sha == current_head.lower():
        return "current"
    try:
        completed = subprocess.run(
            ["git", "merge-base", "--is-ancestor", normalized_head_sha, "HEAD"],
            cwd=repo_root,
            check=False,
            capture_output=True,
            text=True,
        )
    except OSError as exc:
        raise ValidationError(f"could not verify {field} against repository history: {exc}") from exc
    if completed.returncode == 0:
        return "ancestor"
    if completed.returncode == 1:
        return classify_non_ancestor_tree_relation(
            repo_root,
            normalized_head_sha,
            current_head,
            field,
        )
    if is_shallow_repository(repo_root) and fetch_commit_from_origin(repo_root, normalized_head_sha):
        return classify_head_relation(repo_root, normalized_head_sha, current_head, field)
    detail = completed.stderr.strip()
    suffix = f": {detail}" if detail else ""
    raise ValidationError(f"{field} must be reachable from current repository HEAD{suffix}")


def is_shallow_repository(repo_root: Path) -> bool:
    try:
        completed = subprocess.run(
            ["git", "rev-parse", "--is-shallow-repository"],
            cwd=repo_root,
            check=False,
            capture_output=True,
            text=True,
        )
    except OSError:
        return False
    return completed.returncode == 0 and completed.stdout.strip().lower() == "true"


def fetch_commit_from_origin(repo_root: Path, head_sha: str) -> bool:
    try:
        completed = subprocess.run(
            ["git", "fetch", "--depth=1", "--no-tags", "origin", head_sha],
            cwd=repo_root,
            check=False,
            capture_output=True,
            text=True,
        )
    except OSError:
        return False
    return completed.returncode == 0


def classify_non_ancestor_tree_relation(
    repo_root: Path,
    head_sha: str,
    current_head: str,
    field: str,
) -> str:
    try:
        completed = subprocess.run(
            ["git", "diff", "--quiet", f"{head_sha}..{current_head}"],
            cwd=repo_root,
            check=False,
            capture_output=True,
            text=True,
        )
    except OSError as exc:
        raise ValidationError(f"could not compare {field} with current repository HEAD: {exc}") from exc
    if completed.returncode == 0:
        return "tree_equivalent"
    if completed.returncode == 1:
        return "non_ancestor_tree_diff"
    detail = completed.stderr.strip()
    suffix = f": {detail}" if detail else ""
    raise ValidationError(f"could not compare {field} with current repository HEAD{suffix}")


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
