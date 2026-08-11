"""Tests for typed agent-native artifact contracts."""

from __future__ import annotations

import json
import subprocess
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
    CompactHarnessDecision,
    ControlledEffectivenessObservation,
    GovernanceDecisionSurfaceReport,
    HarnessDecision,
    ReviewerDecisionReport,
    SessionDistillReport,
    tracked_files,
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


def test_tracked_files_ignores_paths_deleted_in_the_worktree(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    (tmp_path / "present.md").write_text("present\n", encoding="utf-8")
    monkeypatch.chdir(tmp_path)

    def fake_run_command(
        _command: Sequence[str], *, timeout_seconds: float = 60
    ) -> subprocess.CompletedProcess[str]:
        del timeout_seconds
        return subprocess.CompletedProcess(
            args=[], returncode=0, stdout="present.md\ndeleted.md\n", stderr=""
        )

    monkeypatch.setattr(
        "check_artifact_type_contracts.run_command",
        fake_run_command,
    )

    assert tracked_files() == [Path("present.md")]


def _compact_harness_decision() -> dict[str, Any]:
    payload = deepcopy(_load_example("harness-decision.example.json"))
    for field in (
        "producer",
        "phase",
        "cockpitLane",
        "objective",
        "requiredEvidence",
        "stopConditions",
        "humanEscalation",
        "followUpCommands",
        "hiddenPlumbing",
        "safeToRun",
        "requiresHuman",
        "requiresNetwork",
        "writesFiles",
        "evidenceRef",
        "failureClass",
        "retry",
        "riskTier",
        "meta",
    ):
        del payload[field]
    payload.update(
        {
            "warnings": [],
            "executionBoundary": {
                "safeToRun": True,
                "requiresHuman": False,
                "requiresNetwork": False,
                "writesFiles": False,
            },
            "claimsBoundary": "Local routing only.",
        }
    )
    return payload


def _load_example(name: str) -> dict[str, Any]:
    path = REPO_ROOT / "contracts" / "examples" / name
    return cast(dict[str, Any], json.loads(path.read_text(encoding="utf-8")))


def _load_effectiveness_observation() -> dict[str, Any]:
    path = REPO_ROOT / "docs" / "roadmap" / "agent-first-effectiveness-observation-2026-08-11.json"
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


class TestHarnessDecisionShapes:
    def test_rejects_full_decisions_with_compact_only_fields(self) -> None:
        compact_only_fields: tuple[tuple[str, Any], ...] = (
            ("warnings", []),
            (
                "executionBoundary",
                {
                    "safeToRun": True,
                    "requiresHuman": False,
                    "requiresNetwork": False,
                    "writesFiles": False,
                },
            ),
            ("claimsBoundary", "Local routing only."),
        )
        for field, value in compact_only_fields:
            payload = _load_example("harness-decision.example.json")
            payload[field] = value

            with pytest.raises(ValidationError, match="full harness decisions"):
                HarnessDecision.model_validate(payload)

    @pytest.mark.parametrize(
        ("next_command", "safe_to_run", "expected"),
        [
            ("harness check --json", False, "must be true"),
            (None, True, "must be false"),
        ],
    )
    def test_rejects_compact_decision_with_contradictory_command_safety(
        self, next_command: str | None, safe_to_run: bool, expected: str
    ) -> None:
        payload = _compact_harness_decision()
        payload["nextCommand"] = next_command
        payload["executionBoundary"]["safeToRun"] = safe_to_run

        with pytest.raises(ValidationError, match=expected):
            CompactHarnessDecision.model_validate(payload)

    def test_rejects_whitespace_only_compact_claims_boundary(self) -> None:
        payload = _compact_harness_decision()
        payload["claimsBoundary"] = "   "

        with pytest.raises(ValidationError, match="must not be blank"):
            CompactHarnessDecision.model_validate(payload)


class TestControlledEffectivenessObservation:
    def test_accepts_replayable_observation_artifact(self) -> None:
        report = ControlledEffectivenessObservation.model_validate(
            _load_effectiveness_observation()
        )

        assert len(report.tasks) == 5
        assert all(task.replayability == "replayable" for task in report.tasks)
        assert all(task.treatment.cli_path == "dist/cli.js" for task in report.tasks)

    def test_rejects_observation_without_replay_metadata(self) -> None:
        payload = _load_effectiveness_observation()
        del payload["tasks"][0]["remote_url"]

        with pytest.raises(ValidationError, match="remote_url"):
            ControlledEffectivenessObservation.model_validate(payload)

    def test_rejects_untyped_decision_stdout(self) -> None:
        payload = _load_effectiveness_observation()
        payload["tasks"][0]["treatment"]["stdout"] = "{}"

        with pytest.raises(ValidationError, match="harness-decision/v1"):
            ControlledEffectivenessObservation.model_validate(payload)

    def test_rejects_status_exit_code_contradiction(self) -> None:
        payload = _load_effectiveness_observation()
        payload["tasks"][0]["baseline"]["exit_code"] = 1

        with pytest.raises(ValidationError, match="exit_code"):
            ControlledEffectivenessObservation.model_validate(payload)

    @pytest.mark.parametrize("value", [float("nan"), float("inf"), float("-inf")])
    def test_rejects_non_finite_durations(self, value: float) -> None:
        payload = _load_effectiveness_observation()
        payload["tasks"][0]["treatment"]["wall_seconds"] = value

        with pytest.raises(ValidationError, match="finite"):
            ControlledEffectivenessObservation.model_validate(payload)

    def test_rejects_failed_decision_with_zero_exit_code(self) -> None:
        payload = _load_effectiveness_observation()
        decision = json.loads(payload["tasks"][0]["treatment"]["stdout"])
        decision["status"] = "fail"
        payload["tasks"][0]["treatment"]["status"] = "fail"
        payload["tasks"][0]["treatment"]["stdout"] = json.dumps(decision)

        with pytest.raises(ValidationError, match="non-zero exit_code"):
            ControlledEffectivenessObservation.model_validate(payload)

    def test_rejects_replayable_head_mismatch(self) -> None:
        payload = _load_effectiveness_observation()
        payload["tasks"][0]["observed_head"] = "0" * 40

        with pytest.raises(ValidationError, match="replayable"):
            ControlledEffectivenessObservation.model_validate(payload)

    def test_rejects_insufficient_repository_diversity(self) -> None:
        payload = _load_effectiveness_observation()
        for task in payload["tasks"]:
            task["repository"] = "coding-harness"

        with pytest.raises(ValidationError, match="three repositories"):
            ControlledEffectivenessObservation.model_validate(payload)

    def test_rejects_non_replayable_source_diagnostic_label(self) -> None:
        payload = _load_effectiveness_observation()
        payload["tasks"][0]["source_diagnostic"]["command"] += " (source diagnostic)"

        with pytest.raises(ValidationError, match="directly runnable"):
            ControlledEffectivenessObservation.model_validate(payload)

    def test_rejects_declared_command_mismatch(self) -> None:
        payload = _load_effectiveness_observation()
        payload["tasks"][0]["treatment"]["command"] = "harness next --json"

        with pytest.raises(ValidationError, match="treatment command"):
            ControlledEffectivenessObservation.model_validate(payload)

    def test_rejects_decision_status_mismatch(self) -> None:
        payload = _load_effectiveness_observation()
        payload["tasks"][1]["treatment"]["status"] = "fail"

        with pytest.raises(ValidationError, match="status must match"):
            ControlledEffectivenessObservation.model_validate(payload)

    def test_accepts_action_required_decision_with_success_exit(self) -> None:
        payload = _load_effectiveness_observation()
        decision = json.loads(payload["tasks"][0]["treatment"]["stdout"])
        decision["status"] = "action_required"
        payload["tasks"][0]["treatment"]["status"] = "action_required"
        payload["tasks"][0]["treatment"]["stdout"] = json.dumps(decision)

        ControlledEffectivenessObservation.model_validate(payload)

    def test_rejects_action_required_baseline_observation(self) -> None:
        payload = _load_effectiveness_observation()
        payload["tasks"][0]["baseline"]["status"] = "action_required"

        with pytest.raises(ValidationError):
            ControlledEffectivenessObservation.model_validate(payload)

    def test_rejects_source_diagnostic_without_source_head_binding(self) -> None:
        payload = _load_effectiveness_observation()
        payload["tasks"][0]["source_diagnostic"]["source_head"] = "0" * 40

        with pytest.raises(ValidationError, match="source_head"):
            ControlledEffectivenessObservation.model_validate(payload)

    @pytest.mark.parametrize(
        ("field", "value", "message"),
        [
            (
                "repository_url",
                "https://github.com/example/other",
                "repository_url",
            ),
            ("ref", "main", "ref must bind source_head"),
            ("relative_working_directory", "src", "relative working directory"),
        ],
    )
    def test_rejects_source_diagnostic_without_concrete_checkout_binding(
        self, field: str, value: str, message: str
    ) -> None:
        payload = _load_effectiveness_observation()
        payload["tasks"][0]["source_diagnostic"][field] = value

        with pytest.raises(ValidationError, match=message):
            ControlledEffectivenessObservation.model_validate(payload)

    @pytest.mark.parametrize(
        ("field", "value", "message"),
        [
            ("task_root_ref", "other-task", "task_root_ref"),
            ("entrypoint", "dist/cli.js", "entrypoint"),
            ("replay_command", "node src/cli.ts next --json", "replay_command"),
        ],
    )
    def test_rejects_source_diagnostic_replay_binding_drift(
        self, field: str, value: str, message: str
    ) -> None:
        payload = _load_effectiveness_observation()
        payload["tasks"][0]["source_diagnostic"][field] = value

        with pytest.raises(ValidationError, match=message):
            ControlledEffectivenessObservation.model_validate(payload)

    @pytest.mark.parametrize(
        ("field", "value", "message"),
        [
            ("working_directory", "other-task", "working_directory"),
            ("cli_path", "bin/cli.js", "cli_path"),
        ],
    )
    def test_rejects_treatment_replay_binding_drift(
        self, field: str, value: str, message: str
    ) -> None:
        payload = _load_effectiveness_observation()
        payload["tasks"][0]["treatment"][field] = value

        with pytest.raises(ValidationError, match=message):
            ControlledEffectivenessObservation.model_validate(payload)

    @pytest.mark.parametrize(
        ("field", "value", "message"),
        [
            ("source_checkout_ref", "0" * 40, "source_checkout_ref"),
            (
                "replay_command",
                "node dist/cli.js next --json",
                "replay_command",
            ),
        ],
    )
    def test_rejects_treatment_source_replay_binding_drift(
        self, field: str, value: str, message: str
    ) -> None:
        payload = _load_effectiveness_observation()
        payload["tasks"][0]["treatment"][field] = value

        with pytest.raises(ValidationError, match=message):
            ControlledEffectivenessObservation.model_validate(payload)


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

    def test_rejects_non_hexadecimal_session_head_sha(self) -> None:
        payload = deepcopy(_load_example("session-distill.example.json"))
        payload["headSha"] = "not-a-sha"

        with pytest.raises(ValidationError, match="7-40 character lowercase Git SHA"):
            SessionDistillReport.model_validate(payload)


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

    def test_rejects_passing_report_without_coverage_receipt(self) -> None:
        payload = deepcopy(_load_example("reviewer-decision.example.json"))
        payload["status"] = "pass"
        payload["decision"] = "accept"
        payload["outcomes"] = ["accept"]
        del payload["coverageReceipt"]

        with pytest.raises(
            ValidationError,
            match="coverageReceipt is required for passing reviewer decisions",
        ):
            ReviewerDecisionReport.model_validate(payload)

    def test_rejects_passing_report_without_coverage_evidence_refs(self) -> None:
        payload = deepcopy(_load_example("reviewer-decision.example.json"))
        payload["status"] = "pass"
        payload["decision"] = "accept"
        payload["outcomes"] = ["accept"]
        payload["coverageReceipt"]["evidenceRefs"] = []

        with pytest.raises(
            ValidationError,
            match="coverageReceipt.evidenceRefs must not be empty",
        ):
            ReviewerDecisionReport.model_validate(payload)

    @pytest.mark.parametrize("evidence_ref", ["", "   "])
    def test_rejects_passing_report_with_blank_coverage_evidence_ref(
        self, evidence_ref: str
    ) -> None:
        payload = deepcopy(_load_example("reviewer-decision.example.json"))
        payload["status"] = "pass"
        payload["decision"] = "accept"
        payload["outcomes"] = ["accept"]
        payload["coverageReceipt"]["evidenceRefs"] = [evidence_ref]

        with pytest.raises(ValidationError, match="must not contain blank items"):
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
