"""Tests for typed agent-native artifact contracts."""

from __future__ import annotations

import json
import sys
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


def _load_example(name: str) -> dict[str, Any]:
    path = REPO_ROOT / "contracts" / "examples" / name
    return cast(dict[str, Any], json.loads(path.read_text(encoding="utf-8")))


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


class TestSessionDistillReport:
    def test_accepts_canonical_report_example(self) -> None:
        report = SessionDistillReport.model_validate(
            _load_example("session-distill.example.json")
        )

        assert report.status == "pass"

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


class TestAgentReworkReport:
    def test_accepts_canonical_report_example(self) -> None:
        report = AgentReworkReport.model_validate(
            _load_example("agent-rework.example.json")
        )

        assert report.status == "pass"

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
