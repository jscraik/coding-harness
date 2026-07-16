"""Tests for typed agent-native artifact contracts."""

from __future__ import annotations

import json
import sys
from collections.abc import Sequence
from copy import deepcopy
from pathlib import Path
from typing import Any, cast

import pytest
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).parent.parent))

from check_artifact_type_contracts import (
    AgentNativeRatchetsReport,
    AgentReworkReport,
    GovernanceDecisionSurfaceReport,
    ReviewerDecisionReport,
    SessionDistillReport,
)


REPO_ROOT = Path(__file__).resolve().parents[2]
FORBIDDEN_HARNESS_CLAIMS = {
    "codex_context_current",
    "codex_session_truth",
    "connector_snapshot_current",
    "sidecar_export_current",
    "ci_passed",
    "review_threads_resolved",
    "tracker_closed",
    "merge_ready",
}


def _load_example(name: str) -> dict[str, Any]:
    path = REPO_ROOT / "contracts" / "examples" / name
    return cast(dict[str, Any], json.loads(path.read_text(encoding="utf-8")))


def _assert_harness_boundary(
    native_authority: str,
    source_kind: str,
    may_claim: Sequence[str],
    must_not_claim: Sequence[str],
    *,
    expected_source_kind: str,
) -> None:
    assert native_authority == "harness"
    assert source_kind == expected_source_kind
    assert may_claim
    assert FORBIDDEN_HARNESS_CLAIMS.issubset(must_not_claim)
    assert set(may_claim).isdisjoint(must_not_claim)


class TestAgentNativeRatchetsReport:
    def test_accepts_canonical_report_example(self) -> None:
        report = AgentNativeRatchetsReport.model_validate(
            _load_example("agent-native-ratchets.example.json")
        )

        assert report.status == "pass"
        assert [ratchet.id for ratchet in report.ratchets] == [
            "orientation_packet",
            "session_distillation",
            "agent_rework_loop",
            "reviewer_decision_contract",
            "governance_decision_surface",
        ]
        expected_source_kinds = [
            "repo_contract",
            "repo_worktree",
            "repo_artifact",
            "repo_artifact",
            "repo_artifact",
        ]
        for ratchet, expected_source_kind in zip(
            report.ratchets, expected_source_kinds, strict=True
        ):
            _assert_harness_boundary(
                ratchet.nativeAuthority,
                ratchet.sourceKind,
                ratchet.mayClaim,
                ratchet.mustNotClaim,
                expected_source_kind=expected_source_kind,
            )

    def test_rejects_missing_canonical_ratchet(self) -> None:
        payload = deepcopy(_load_example("agent-native-ratchets.example.json"))
        payload["ratchets"] = cast(list[dict[str, Any]], payload["ratchets"])[:-1]

        with pytest.raises(ValidationError, match="canonical ratchet ids"):
            AgentNativeRatchetsReport.model_validate(payload)

    def test_rejects_status_that_disagrees_with_child_ratchets(self) -> None:
        payload = deepcopy(_load_example("agent-native-ratchets.example.json"))
        ratchets = cast(list[dict[str, Any]], payload["ratchets"])
        ratchets[0]["status"] = "needs_attention"

        with pytest.raises(ValidationError, match="status must match ratchet statuses"):
            AgentNativeRatchetsReport.model_validate(payload)

    def test_rejects_harness_ratchet_that_claims_codex_context_truth(self) -> None:
        payload = deepcopy(_load_example("agent-native-ratchets.example.json"))
        ratchets = cast(list[dict[str, Any]], payload["ratchets"])
        ratchets[0]["mayClaim"] = ["repo_orientation", "codex_context_current"]

        with pytest.raises(ValidationError, match="must not overlap"):
            AgentNativeRatchetsReport.model_validate(payload)

    def test_rejects_harness_ratchet_that_claims_connector_truth(self) -> None:
        payload = deepcopy(_load_example("agent-native-ratchets.example.json"))
        ratchets = cast(list[dict[str, Any]], payload["ratchets"])
        ratchets[0]["mayClaim"] = ["repo_orientation", "connector_snapshot_current"]

        with pytest.raises(ValidationError, match="must not overlap"):
            AgentNativeRatchetsReport.model_validate(payload)

    def test_rejects_harness_ratchet_that_claims_sidecar_truth(self) -> None:
        payload = deepcopy(_load_example("agent-native-ratchets.example.json"))
        ratchets = cast(list[dict[str, Any]], payload["ratchets"])
        ratchets[0]["mayClaim"] = ["repo_orientation", "sidecar_export_current"]

        with pytest.raises(ValidationError, match="must not overlap"):
            AgentNativeRatchetsReport.model_validate(payload)

    def test_rejects_harness_ratchet_missing_forbidden_delivery_claim(self) -> None:
        payload = deepcopy(_load_example("agent-native-ratchets.example.json"))
        ratchets = cast(list[dict[str, Any]], payload["ratchets"])
        ratchets[0]["mustNotClaim"] = [
            claim
            for claim in cast(list[str], ratchets[0]["mustNotClaim"])
            if claim != "merge_ready"
        ]

        with pytest.raises(ValidationError, match="cross-authority claims"):
            AgentNativeRatchetsReport.model_validate(payload)

    def test_rejects_unknown_claim_tokens(self) -> None:
        payload = deepcopy(_load_example("agent-native-ratchets.example.json"))
        ratchets = cast(list[dict[str, Any]], payload["ratchets"])
        ratchets[0]["mayClaim"] = ["repo_orientation", "review_resolved"]

        with pytest.raises(ValidationError, match="unknown claim token"):
            AgentNativeRatchetsReport.model_validate(payload)

    def test_rejects_harness_ratchet_with_wrong_source_kind(self) -> None:
        payload = deepcopy(_load_example("agent-native-ratchets.example.json"))
        ratchets = cast(list[dict[str, Any]], payload["ratchets"])
        ratchets[1]["sourceKind"] = "repo_artifact"

        with pytest.raises(ValidationError, match="repo_worktree sourceKind"):
            AgentNativeRatchetsReport.model_validate(payload)


class TestSessionDistillReport:
    def test_accepts_canonical_report_example(self) -> None:
        report = SessionDistillReport.model_validate(
            _load_example("session-distill.example.json")
        )

        assert report.status == "pass"
        _assert_harness_boundary(
            report.nativeAuthority,
            report.sourceKind,
            report.mayClaim,
            report.mustNotClaim,
            expected_source_kind="repo_worktree",
        )
        assert "validation_passed" in report.mustNotClaim

    def test_rejects_changed_file_count_mismatch(self) -> None:
        payload = deepcopy(_load_example("session-distill.example.json"))
        payload["changedFileCount"] = 99

        with pytest.raises(ValidationError, match="changedFileCount"):
            SessionDistillReport.model_validate(payload)

    def test_rejects_duplicate_evidence_lane_ids(self) -> None:
        payload = deepcopy(_load_example("session-distill.example.json"))
        lanes = cast(list[dict[str, Any]], payload["evidenceLanes"])
        lanes.append(deepcopy(lanes[0]))

        with pytest.raises(ValidationError, match="duplicate ids"):
            SessionDistillReport.model_validate(payload)

    def test_rejects_session_distill_claiming_validation_passed(self) -> None:
        payload = deepcopy(_load_example("session-distill.example.json"))
        payload["mayClaim"] = ["repo_handoff_orientation", "validation_passed"]

        with pytest.raises(ValidationError, match="must not overlap"):
            SessionDistillReport.model_validate(payload)

    def test_accepts_abbreviated_v1_head_sha_for_compatibility(self) -> None:
        payload = deepcopy(_load_example("session-distill.example.json"))
        payload["headSha"] = "1111111"

        report = SessionDistillReport.model_validate(payload)

        assert report.headSha == "1111111"


class TestAgentReworkReport:
    def test_accepts_canonical_report_example(self) -> None:
        report = AgentReworkReport.model_validate(
            _load_example("agent-rework.example.json")
        )

        assert report.status == "pass"
        _assert_harness_boundary(
            report.nativeAuthority,
            report.sourceKind,
            report.mayClaim,
            report.mustNotClaim,
            expected_source_kind="repo_artifact",
        )

    def test_rejects_unavailable_run_with_pass_status(self) -> None:
        payload = deepcopy(_load_example("agent-rework.example.json"))
        payload["latestRun"] = {
            "status": "unavailable",
            "reason": "no verify-work run artifacts exist",
        }

        with pytest.raises(ValidationError, match="latestRun availability"):
            AgentReworkReport.model_validate(payload)


class TestReviewerDecisionReport:
    def test_accepts_canonical_report_example(self) -> None:
        report = ReviewerDecisionReport.model_validate(
            _load_example("reviewer-decision.example.json")
        )

        assert report.decision == "needs_evidence"
        _assert_harness_boundary(
            report.nativeAuthority,
            report.sourceKind,
            report.mayClaim,
            report.mustNotClaim,
            expected_source_kind="repo_artifact",
        )

    def test_accepts_report_without_optional_coverage_receipt(self) -> None:
        payload = deepcopy(_load_example("reviewer-decision.example.json"))
        del payload["coverageReceipt"]

        report = ReviewerDecisionReport.model_validate(payload)

        assert report.coverageReceipt is None

    def test_rejects_null_coverage_receipt(self) -> None:
        payload = deepcopy(_load_example("reviewer-decision.example.json"))
        payload["coverageReceipt"] = None

        with pytest.raises(
            ValidationError, match="coverageReceipt must be an object when present"
        ):
            ReviewerDecisionReport.model_validate(payload)

    def test_rejects_pass_status_without_accept_decision(self) -> None:
        payload = deepcopy(_load_example("reviewer-decision.example.json"))
        payload["status"] = "pass"

        with pytest.raises(ValidationError, match="passing reviewer decisions"):
            ReviewerDecisionReport.model_validate(payload)


class TestGovernanceDecisionSurfaceReport:
    def test_accepts_canonical_report_example(self) -> None:
        report = GovernanceDecisionSurfaceReport.model_validate(
            _load_example("governance-decision-surface.example.json")
        )

        assert report.status == "pass"
        _assert_harness_boundary(
            report.nativeAuthority,
            report.sourceKind,
            report.mayClaim,
            report.mustNotClaim,
            expected_source_kind="repo_artifact",
        )

    def test_rejects_decision_inputs_without_runtime_decision_class(self) -> None:
        payload = deepcopy(_load_example("governance-decision-surface.example.json"))
        decision_inputs = cast(list[dict[str, Any]], payload["decisionInputs"])
        decision_inputs[0]["classes"] = ["operator_policy"]

        with pytest.raises(ValidationError, match="decisionInputs"):
            GovernanceDecisionSurfaceReport.model_validate(payload)

    def test_rejects_archive_candidates_without_archive_class(self) -> None:
        payload = deepcopy(_load_example("governance-decision-surface.example.json"))
        payload["archiveCandidates"] = [
            {
                "path": "docs/old.md",
                "classes": ["historical_context"],
                "lifecycleStage": "retired",
                "knowledgeCategory": "history",
                "lifecycleState": "archived",
            }
        ]

        with pytest.raises(ValidationError, match="archiveCandidates"):
            GovernanceDecisionSurfaceReport.model_validate(payload)
