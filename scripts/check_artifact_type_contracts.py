#!/usr/bin/env python3
"""Validate typed artifact surfaces across repository file kinds."""

from __future__ import annotations

import json
import re
import subprocess
import sys
import tomllib
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import date
from html.parser import HTMLParser
from pathlib import Path
from typing import Literal, cast

from jsonschema import Draft7Validator, Draft202012Validator, validate as validate_json_schema
from jsonschema.exceptions import SchemaError, ValidationError as JsonSchemaValidationError
from pydantic import BaseModel, ConfigDict, ValidationError, field_validator, model_validator
import yaml


REPO_ROOT = Path(__file__).resolve().parent.parent
DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")
JSON_SCHEMA_DRAFTS = {
    "https://json-schema.org/draft/2020-12/schema",
    "http://json-schema.org/draft-07/schema#",
}
REQUIRED_PACKAGE_SCRIPTS = {
    "docs:lint",
    "docs:lifecycle",
    "contracts:command-catalog",
    "contracts:runtime-packets",
    "skill:validate",
    "workflow:validate",
    "typescript:types",
    "typescript:policy",
    "python:types",
    "artifact:types",
    "types:check",
}


def reject_blank_string(value: str) -> str:
    if not value.strip():
        raise ValueError("must not be blank")
    return value


def reject_blank_optional_string(value: str | None) -> str | None:
    if value is not None and not value.strip():
        raise ValueError("must not be blank")
    return value


def reject_blank_list_items(value: list[str]) -> list[str]:
    if any(not item.strip() for item in value):
        raise ValueError("must not contain blank items")
    return value


def reject_empty_or_blank_list(value: list[str]) -> list[str]:
    if not value:
        raise ValueError("must contain at least one item")
    return reject_blank_list_items(value)


def reject_negative_int(value: int) -> int:
    if value < 0:
        raise ValueError("must be non-negative")
    return value


class CommandCapability(BaseModel):
    """Typed contract for one command catalog entry."""

    model_config = ConfigDict(extra="forbid")

    name: str
    aliases: list[str]
    summary: str
    example: str | None = None
    category: Literal[
        "discovery",
        "bootstrap-governance",
        "review-policy",
        "workflow-linear",
        "pilot-remediation",
        "drift-search-evidence",
        "uncategorized",
    ]
    mutability: Literal["read", "write"]
    requiredFlags: list[str]
    expectedArtifacts: list[str]
    retryability: Literal["safe", "conditional", "manual"]
    safeFirstAlternatives: list[str]
    tier: Literal["cockpit", "domain", "plumbing", "legacy"]
    primaryAudience: Literal["agent", "human", "both"]
    orchestratedBy: list[Literal["next", "pr-ready", "fix-review", "learn"]]
    agentMode: Literal[
        "orient",
        "plan",
        "verify",
        "review",
        "repair",
        "handoff",
        "learn",
        "admin",
    ]
    visibility: Literal["default", "agent", "advanced", "plumbing", "hidden", "legacy"]

    @field_validator("name", "summary", "example")
    @classmethod
    def reject_blank_optional_string(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise ValueError("must not be blank")
        return value

    @field_validator(
        "aliases",
        "requiredFlags",
        "expectedArtifacts",
        "safeFirstAlternatives",
        mode="after",
    )
    @classmethod
    def reject_blank_string_items(cls, value: list[str]) -> list[str]:
        if any(not item.strip() for item in value):
            raise ValueError("must not contain blank items")
        return value


class CommandCatalog(BaseModel):
    """Typed contract for command catalog JSON output."""

    model_config = ConfigDict(extra="forbid")

    schemaVersion: Literal["harness-command-catalog/v3"]
    generatedAt: str
    commandCount: int
    commands: list[CommandCapability]

    @field_validator("generatedAt")
    @classmethod
    def require_non_blank_generated_at(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("must not be blank")
        return value


class HarnessDecision(BaseModel):
    """Typed contract for harness-decision/v1 JSON output."""

    model_config = ConfigDict(extra="allow")

    schemaVersion: Literal["harness-decision/v1"]
    producer: str
    status: Literal["pass", "fail", "blocked", "action_required"]
    summary: str
    nextAction: str
    nextCommand: str | None
    phase: Literal["orient", "verify", "review", "repair", "handoff"]
    cockpitLane: Literal["orient", "prove", "repair", "review", "handoff"] | None = None
    objective: str
    requiredEvidence: list[str]
    stopConditions: list[str]
    humanEscalation: str | None
    followUpCommands: list[str]
    hiddenPlumbing: list[str]
    safeToRun: bool
    requiresHuman: bool
    requiresNetwork: bool
    writesFiles: bool
    evidenceRef: list[str]
    failureClass: str | None
    retry: Literal["safe", "conditional", "manual"]
    riskTier: Literal["low", "medium", "high", "critical", "unknown"]

    @field_validator(
        "producer",
        "summary",
        "nextAction",
        "objective",
        "nextCommand",
        "humanEscalation",
        "failureClass",
    )
    @classmethod
    def reject_blank_decision_string(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise ValueError("must not be blank")
        return value

    @field_validator(
        "requiredEvidence",
        "stopConditions",
        "followUpCommands",
        "hiddenPlumbing",
        "evidenceRef",
    )
    @classmethod
    def reject_blank_decision_items(cls, value: list[str]) -> list[str]:
        if any(not item.strip() for item in value):
            raise ValueError("must not contain blank items")
        return value


class CliJsonLiveValidation(BaseModel):
    """Live validation policy for a CLI JSON contract."""

    model_config = ConfigDict(extra="forbid")

    enabled: bool
    allowedExitCodes: list[int]
    stdoutJson: bool
    reason: str | None = None

    @field_validator("allowedExitCodes")
    @classmethod
    def require_allowed_exit_codes(cls, value: list[int]) -> list[int]:
        if not value:
            raise ValueError("must contain at least one exit code")
        if any(code < 0 for code in value):
            raise ValueError("must not contain negative exit codes")
        return value

    @field_validator("reason")
    @classmethod
    def reject_blank_reason(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise ValueError("must not be blank")
        return value


class CliJsonContract(BaseModel):
    """One CLI JSON output contract entry."""

    model_config = ConfigDict(extra="forbid")

    name: str
    command: list[str]
    expectedSchemaVersion: Literal[
        "harness-command-catalog/v3",
        "harness-decision/v1",
        "harness-cli-error/v1",
    ]
    schemaPath: str
    examplePath: str
    liveValidation: CliJsonLiveValidation

    @field_validator("name", "schemaPath", "examplePath")
    @classmethod
    def reject_blank_contract_string(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("must not be blank")
        return value

    @field_validator("command")
    @classmethod
    def reject_blank_command_args(cls, value: list[str]) -> list[str]:
        if not value:
            raise ValueError("must contain at least one argument")
        if any(not item.strip() for item in value):
            raise ValueError("must not contain blank arguments")
        return value


class CliJsonContractsManifest(BaseModel):
    """Manifest of agent-facing CLI JSON contracts."""

    model_config = ConfigDict(extra="forbid")

    schemaVersion: Literal["cli-json-contracts-manifest/v1"]
    generatedAt: str
    contracts: list[CliJsonContract]

    @field_validator("generatedAt")
    @classmethod
    def reject_blank_manifest_generated_at(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("must not be blank")
        return value

    @field_validator("contracts")
    @classmethod
    def require_contracts(cls, value: list[CliJsonContract]) -> list[CliJsonContract]:
        if not value:
            raise ValueError("must contain at least one contract")
        names = [contract.name for contract in value]
        duplicate_names = sorted({name for name in names if names.count(name) > 1})
        if duplicate_names:
            raise ValueError(f"duplicate contract names: {', '.join(duplicate_names)}")
        return value


class DocLifecycleFrontmatter(BaseModel):
    """Typed frontmatter contract for governed documentation surfaces."""

    model_config = ConfigDict(extra="allow")

    doc_schema: Literal["coding-harness-doc/v1"]
    doc_type: Literal[
        "architecture",
        "contributing",
        "control-plane",
        "docs-index",
        "governance",
        "lifecycle",
        "operator-instructions",
        "product",
        "security",
        "skill",
    ]
    authority: Literal["canon", "supporting", "generated", "historical"]
    distribution: Literal[
        "source-only",
        "downstream-template",
        "packaged-skill",
        "generated",
        "example-only",
    ]
    audience: list[str]
    lifecycle_state: Literal[
        "proposed",
        "experimental",
        "active",
        "deprecated",
        "superseded",
        "archived",
    ]
    owner: str
    created: str
    last_reviewed: str
    review_cadence: str
    maintenance_trigger: list[str]
    semver_impact: Literal["none", "patch", "minor", "major"]
    validated_by: list[str]
    depends_on: list[str]
    superseded_by: str | None = None
    remove_after: str | None = None

    @field_validator("audience", "maintenance_trigger", "validated_by")
    @classmethod
    def require_non_empty_list(cls, value: list[str]) -> list[str]:
        if not value:
            raise ValueError("must contain at least one item")
        if any(not item.strip() for item in value):
            raise ValueError("must not contain blank items")
        return value

    @field_validator("depends_on")
    @classmethod
    def reject_blank_depends_on(cls, value: list[str]) -> list[str]:
        if any(not item.strip() for item in value):
            raise ValueError("must not contain blank items")
        return value

    @field_validator("owner", "review_cadence")
    @classmethod
    def require_non_blank_string(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("must not be blank")
        return value

    @field_validator("created", "last_reviewed", "remove_after", mode="before")
    @classmethod
    def require_iso_date(cls, value: object) -> str | None:
        if value is None:
            return None
        if isinstance(value, date):
            return value.isoformat()
        if not isinstance(value, str):
            raise ValueError("must use YYYY-MM-DD")
        if DATE_PATTERN.fullmatch(value) is None:
            raise ValueError("must use YYYY-MM-DD")
        return value


AgentNativeRatchetId = Literal[
    "orientation_packet",
    "session_distillation",
    "agent_rework_loop",
    "reviewer_decision_contract",
    "governance_decision_surface",
]

AgentNativeRatchetStatus = Literal["pass", "needs_attention"]
AgentNativeReportStatus = Literal["pass", "needs_attention"]
EvidenceLaneId = Literal[
    "worktree",
    "policy_route",
    "context_freshness",
    "validation",
    "external_readiness",
]
GovernanceClass = Literal[
    "feeds_runtime_decision",
    "operator_policy",
    "historical_context",
    "archive_candidate",
]
GOVERNANCE_CLASSES: tuple[GovernanceClass, ...] = (
    "feeds_runtime_decision",
    "operator_policy",
    "historical_context",
    "archive_candidate",
)


class AgentNativeRatchet(BaseModel):
    """Typed contract for one agent-native ratchet lane."""

    model_config = ConfigDict(extra="forbid")

    id: AgentNativeRatchetId
    status: AgentNativeRatchetStatus
    purpose: str
    command: str
    evidencePaths: list[str]
    claimBoundary: str
    nextMove: str

    _reject_blank_strings = field_validator(
        "purpose", "command", "claimBoundary", "nextMove"
    )(reject_blank_string)
    _reject_blank_evidence_paths = field_validator("evidencePaths")(
        reject_empty_or_blank_list
    )


class AgentNativeRatchetsReport(BaseModel):
    """Typed contract for the top-level agent-native ratchet report."""

    model_config = ConfigDict(extra="forbid")

    schemaVersion: Literal["agent-native-ratchets/v1"]
    status: AgentNativeReportStatus
    ratchets: list[AgentNativeRatchet]

    @field_validator("ratchets")
    @classmethod
    def require_canonical_ratchet_set(
        cls, value: list[AgentNativeRatchet]
    ) -> list[AgentNativeRatchet]:
        expected: list[AgentNativeRatchetId] = [
            "orientation_packet",
            "session_distillation",
            "agent_rework_loop",
            "reviewer_decision_contract",
            "governance_decision_surface",
        ]
        ids = [ratchet.id for ratchet in value]
        if ids != expected:
            raise ValueError(f"must contain canonical ratchet ids in order: {', '.join(expected)}")
        return value

    @model_validator(mode="after")
    def require_status_matches_ratchets(self) -> AgentNativeRatchetsReport:
        expected_status = (
            "pass" if all(ratchet.status == "pass" for ratchet in self.ratchets)
            else "needs_attention"
        )
        if self.status != expected_status:
            raise ValueError("status must match ratchet statuses")
        return self


class SessionEvidenceLane(BaseModel):
    """Typed evidence lane for a resumed-agent session distillation."""

    model_config = ConfigDict(extra="forbid")

    id: EvidenceLaneId
    status: str
    evidenceRefs: list[str]

    _reject_blank_status = field_validator("status")(reject_blank_string)
    _reject_blank_evidence_refs = field_validator("evidenceRefs")(
        reject_blank_list_items
    )


class SessionDistillReport(BaseModel):
    """Typed contract for session-distill/v1 output."""

    model_config = ConfigDict(extra="forbid")

    schemaVersion: Literal["session-distill/v1"]
    status: Literal["pass"]
    branch: str
    headSha: str
    worktreeStatus: Literal["clean", "dirty"]
    changedFiles: list[str]
    changedFileCount: int
    evidenceLanes: list[SessionEvidenceLane]
    nextCommands: list[str]
    nonClaims: list[str]
    claimBoundary: str

    _reject_blank_strings = field_validator("branch", "headSha", "claimBoundary")(
        reject_blank_string
    )
    _reject_blank_items = field_validator("changedFiles", "nextCommands", "nonClaims")(
        reject_blank_list_items
    )

    @model_validator(mode="after")
    def require_session_consistency(self) -> SessionDistillReport:
        if self.changedFileCount != len(self.changedFiles):
            raise ValueError("changedFileCount must equal changedFiles length")
        lane_ids = [lane.id for lane in self.evidenceLanes]
        if len(lane_ids) != len(set(lane_ids)):
            raise ValueError("evidenceLanes must not contain duplicate ids")
        return self


class AgentReworkFailedGate(BaseModel):
    """Typed failed gate summary from verify-work attempt ledgers."""

    model_config = ConfigDict(extra="forbid")

    gateId: str
    status: str
    failureClass: str
    nextAction: str

    _reject_blank_strings = field_validator(
        "gateId", "status", "failureClass", "nextAction"
    )(reject_blank_string)


class AgentReworkAvailableRun(BaseModel):
    """Typed available verify-work run summary."""

    model_config = ConfigDict(extra="forbid")

    status: Literal["available"]
    runId: str
    overallStatus: str
    failedGateId: str | None
    freshVsResumed: str
    gateCount: int
    failedGates: list[AgentReworkFailedGate]

    _reject_blank_strings = field_validator(
        "runId", "overallStatus", "freshVsResumed", "failedGateId"
    )(reject_blank_optional_string)
    _reject_negative_gate_count = field_validator("gateCount")(reject_negative_int)

    @model_validator(mode="after")
    def require_gate_counts_consistent(self) -> AgentReworkAvailableRun:
        if len(self.failedGates) > self.gateCount:
            raise ValueError("failedGates length must not exceed gateCount")
        if self.failedGateId is None and self.failedGates:
            raise ValueError("failedGateId must name a failed gate when failedGates exist")
        if self.failedGateId is not None and not any(
            gate.gateId == self.failedGateId for gate in self.failedGates
        ):
            raise ValueError("failedGateId must match a failedGates entry")
        return self


class AgentReworkUnavailableRun(BaseModel):
    """Typed unavailable verify-work run sentinel."""

    model_config = ConfigDict(extra="forbid")

    status: Literal["unavailable"]
    reason: str

    _reject_blank_reason = field_validator("reason")(reject_blank_string)


class AgentReworkReport(BaseModel):
    """Typed contract for agent-rework/v1 output."""

    model_config = ConfigDict(extra="forbid")

    schemaVersion: Literal["agent-rework/v1"]
    status: Literal["pass", "needs_evidence"]
    attemptSource: str
    command: str
    latestRun: AgentReworkAvailableRun | AgentReworkUnavailableRun
    retryDecisions: list[Literal["retry", "stop", "fix_contract", "fix_infra"]]
    claimBoundary: str

    _reject_blank_strings = field_validator("attemptSource", "command", "claimBoundary")(
        reject_blank_string
    )

    @model_validator(mode="after")
    def require_rework_status_consistency(self) -> AgentReworkReport:
        expected_status = "needs_evidence" if self.latestRun.status == "unavailable" else "pass"
        if self.status != expected_status:
            raise ValueError("status must match latestRun availability")
        return self


class ReviewerCoverageReceiptSummary(BaseModel):
    """Typed summary of reviewer coverage evidence embedded in reviewer decisions."""

    model_config = ConfigDict(extra="forbid")

    schemaVersion: Literal["reviewer-coverage-receipt/v1"]
    status: str
    blockerClass: str | None
    reason: str
    requestedRoles: int
    completedRoles: int
    blockedRoles: int
    missingArtifacts: int
    synthesisStatus: str | None
    evidenceRefs: list[str]

    _reject_blank_optional_strings = field_validator(
        "status", "reason", "blockerClass", "synthesisStatus"
    )(reject_blank_optional_string)
    _reject_blank_evidence = field_validator("evidenceRefs")(
        reject_blank_list_items
    )
    _reject_negative_counts = field_validator(
        "requestedRoles",
        "completedRoles",
        "blockedRoles",
        "missingArtifacts",
    )(reject_negative_int)

    @model_validator(mode="after")
    def require_role_counts_consistent(self) -> ReviewerCoverageReceiptSummary:
        if self.completedRoles + self.blockedRoles > self.requestedRoles:
            raise ValueError("completedRoles + blockedRoles must not exceed requestedRoles")
        if self.missingArtifacts > self.requestedRoles:
            raise ValueError("missingArtifacts must not exceed requestedRoles")
        return self


class ReviewerDecisionReport(BaseModel):
    """Typed contract for reviewer-decision/v1 output."""

    model_config = ConfigDict(extra="forbid")

    schemaVersion: Literal["reviewer-decision/v1"]
    status: Literal["pass", "needs_evidence", "blocked", "defer"]
    command: str
    decision: Literal[
        "accept",
        "object",
        "needs_evidence",
        "defer",
        "blocked_external",
        "accepted_risk",
    ]
    outcomes: list[
        Literal[
            "accept",
            "object",
            "needs_evidence",
            "defer",
            "blocked_external",
            "accepted_risk",
        ]
    ]
    coverageReceipt: ReviewerCoverageReceiptSummary | None
    nextMove: str
    claimBoundary: str

    _reject_blank_strings = field_validator("command", "nextMove", "claimBoundary")(
        reject_blank_string
    )

    @model_validator(mode="after")
    def require_reviewer_decision_consistency(self) -> ReviewerDecisionReport:
        if self.status == "pass" and self.decision not in {"accept", "accepted_risk"}:
            raise ValueError("passing reviewer decisions must accept or accept risk")
        compatible_decisions = {
            "pass": {"accept", "accepted_risk"},
            "needs_evidence": {"needs_evidence"},
            "blocked": {"blocked_external", "object"},
            "defer": {"defer"},
        }
        if self.decision not in compatible_decisions[self.status]:
            raise ValueError("decision must be compatible with status")
        if self.decision not in self.outcomes:
            raise ValueError("decision must be included in outcomes")
        return self


class GovernanceClassCounts(BaseModel):
    """Typed governance classification counts."""

    model_config = ConfigDict(extra="forbid")

    feeds_runtime_decision: int
    operator_policy: int
    historical_context: int
    archive_candidate: int

    _reject_negative_counts = field_validator(
        "feeds_runtime_decision",
        "operator_policy",
        "historical_context",
        "archive_candidate",
    )(reject_negative_int)


class GovernanceDocument(BaseModel):
    """Typed governance document route entry."""

    model_config = ConfigDict(extra="forbid")

    path: str
    classes: list[GovernanceClass]
    lifecycleStage: str
    knowledgeCategory: str
    lifecycleState: str

    _reject_blank_path = field_validator("path")(reject_blank_string)

    @field_validator("classes")
    @classmethod
    def require_governance_classes(cls, value: list[GovernanceClass]) -> list[GovernanceClass]:
        if not value:
            raise ValueError("must contain at least one class")
        return value


class GovernanceDecisionSurfaceReport(BaseModel):
    """Typed contract for governance-decision-surface/v1 output."""

    model_config = ConfigDict(extra="forbid")

    schemaVersion: Literal["governance-decision-surface/v1"]
    status: Literal["pass", "needs_evidence"]
    classes: list[GovernanceClass]
    documentsAnalyzed: int
    classCounts: GovernanceClassCounts
    decisionInputs: list[GovernanceDocument]
    archiveCandidates: list[GovernanceDocument]
    evidencePaths: list[str]
    nextMove: str
    claimBoundary: str

    _reject_blank_evidence_paths = field_validator("evidencePaths")(
        reject_empty_or_blank_list
    )
    _reject_blank_strings = field_validator("nextMove", "claimBoundary")(
        reject_blank_string
    )
    _reject_negative_documents_analyzed = field_validator("documentsAnalyzed")(
        reject_negative_int
    )

    @model_validator(mode="after")
    def require_governance_class_consistency(self) -> GovernanceDecisionSurfaceReport:
        if sorted(self.classes) != sorted(GOVERNANCE_CLASSES):
            raise ValueError("classes must enumerate every governance class")
        if any("feeds_runtime_decision" not in doc.classes for doc in self.decisionInputs):
            raise ValueError("decisionInputs must feed runtime decisions")
        if any("archive_candidate" not in doc.classes for doc in self.archiveCandidates):
            raise ValueError("archiveCandidates must be archive candidates")
        max_count = max(
            self.classCounts.feeds_runtime_decision,
            self.classCounts.operator_policy,
            self.classCounts.historical_context,
            self.classCounts.archive_candidate,
        )
        if self.documentsAnalyzed < max_count:
            raise ValueError("documentsAnalyzed must cover every class count")
        if self.classCounts.feeds_runtime_decision < len(self.decisionInputs):
            raise ValueError("feeds_runtime_decision count must cover decisionInputs")
        if self.classCounts.archive_candidate < len(self.archiveCandidates):
            raise ValueError("archive_candidate count must cover archiveCandidates")
        return self


AGENT_NATIVE_PACKET_MODELS: dict[str, type[BaseModel]] = {
    "agent-native-ratchets/v1": AgentNativeRatchetsReport,
    "session-distill/v1": SessionDistillReport,
    "agent-rework/v1": AgentReworkReport,
    "reviewer-decision/v1": ReviewerDecisionReport,
    "governance-decision-surface/v1": GovernanceDecisionSurfaceReport,
}


AGENT_NATIVE_LIVE_COMMANDS: dict[str, list[str]] = {
    "agent-native-ratchets/v1": [
        "node",
        "scripts/write-agent-native-ratchet-report.cjs",
        "--json",
    ],
    "session-distill/v1": [
        "node",
        "scripts/write-agent-native-ratchet-report.cjs",
        "--session-distill",
        "--json",
    ],
    "agent-rework/v1": [
        "node",
        "scripts/write-agent-native-ratchet-report.cjs",
        "--rework",
        "--json",
    ],
    "reviewer-decision/v1": [
        "node",
        "scripts/write-agent-native-ratchet-report.cjs",
        "--reviewer-decision",
        "--json",
    ],
    "governance-decision-surface/v1": [
        "node",
        "scripts/write-agent-native-ratchet-report.cjs",
        "--governance",
        "--json",
    ],
}


class ArtifactHtmlParser(HTMLParser):
    """Minimal parser used to surface syntax-level HTML parser errors."""


@dataclass(frozen=True)
class ArtifactReport:
    """Summary of checked artifact files by kind."""

    markdown: int = 0
    markdown_frontmatter: int = 0
    governed_markdown: int = 0
    yaml_files: int = 0
    json_files: int = 0
    jsonl_files: int = 0
    json_schema_files: int = 0
    cli_json_contracts: int = 0
    command_catalog_commands: int = 0
    runtime_packets: int = 0
    agent_native_packets: int = 0
    toml_files: int = 0
    html_files: int = 0
    shell_files: int = 0
    node_files: int = 0
    errors: tuple[str, ...] = ()


def run_command(
    args: Sequence[str], *, timeout_seconds: float = 60
) -> subprocess.CompletedProcess[str]:
    """Run a bounded command at the repository root and capture text output."""
    try:
        return subprocess.run(
            args,
            cwd=REPO_ROOT,
            check=False,
            text=True,
            capture_output=True,
            stdin=subprocess.DEVNULL,
            timeout=timeout_seconds,
        )
    except subprocess.TimeoutExpired as exc:
        stdout = exc.stdout if isinstance(exc.stdout, str) else ""
        stderr = exc.stderr if isinstance(exc.stderr, str) else ""
        detail = stderr or f"command timed out after {timeout_seconds:g}s: {' '.join(args)}"
        return subprocess.CompletedProcess(
            args=args,
            returncode=124,
            stdout=stdout,
            stderr=detail,
        )


def tracked_files(
    patterns: Sequence[str] | None = None, *, include_untracked: bool = False
) -> list[Path]:
    """Return git-tracked paths, optionally including untracked non-ignored paths."""
    command = ["git", "ls-files", "--cached"]
    if include_untracked:
        command.extend(["--others", "--exclude-standard"])
    if patterns:
        command.extend(patterns)
    result = run_command(command)
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip())
    return [Path(line) for line in result.stdout.splitlines() if line]


def load_json(path: Path) -> object:
    with path.open("r", encoding="utf-8") as handle:
        return cast(object, json.load(handle))


def load_yaml(path: Path) -> object:
    with path.open("r", encoding="utf-8") as handle:
        return cast(object, yaml.safe_load(handle))


def as_object_map(value: object) -> dict[str, object] | None:
    """Return a string-keyed object map when a parsed value is object-shaped."""
    if not isinstance(value, dict):
        return None
    raw = cast(dict[object, object], value)
    if not all(isinstance(key, str) for key in raw):
        return None
    return cast(dict[str, object], raw)


def frontmatter_block(content: str) -> str | None:
    if not content.startswith("---\n"):
        return None
    parts = content.split("\n---\n", 1)
    if len(parts) != 2:
        return None
    return parts[0][4:]


def has_version_field(value: object) -> bool:
    if not isinstance(value, dict):
        return False
    return any(
        key in value
        for key in ("schema", "schema_version", "schemaVersion", "version", "$schema")
    )


def require(condition: bool, errors: list[str], message: str) -> None:
    if not condition:
        errors.append(message)


def validate_tool_versions(errors: list[str]) -> None:
    package_json = as_object_map(load_json(REPO_ROOT / "package.json"))
    if package_json is None:
        errors.append("package.json must be a JSON object")
        return

    scripts = as_object_map(package_json.get("scripts"))
    if scripts is None:
        errors.append("package.json scripts must be a JSON object")
        scripts = {}
    for script_name in sorted(REQUIRED_PACKAGE_SCRIPTS):
        require(
            script_name in scripts,
            errors,
            f"package.json missing required artifact/type script: {script_name}",
        )

    dependencies = as_object_map(package_json.get("dependencies"))
    require(dependencies is not None, errors, "package.json dependencies must be an object")
    typescript_version = dependencies.get("typescript") if dependencies is not None else None
    require(
        isinstance(typescript_version, str) and typescript_version.startswith("^5.9."),
        errors,
        "package.json must pin TypeScript to the 5.9.x baseline",
    )
    require(
        package_json.get("packageManager") == "pnpm@10.33.0",
        errors,
        "package.json packageManager must remain pnpm@10.33.0",
    )
    engines = as_object_map(package_json.get("engines"))
    node_engine = engines.get("node") if engines is not None else None
    node_version_valid = False
    if isinstance(node_engine, str) and node_engine.startswith(">="):
        # Parse the minimum version from formats like ">=24", ">=24.0.0", ">=24.0.0 <25"
        version_str = node_engine[2:].strip().split()[0]
        try:
            version_parts = version_str.split(".")
            major = int(version_parts[0]) if len(version_parts) > 0 else 0
            minor = int(version_parts[1]) if len(version_parts) > 1 else 0
            patch = int(version_parts[2]) if len(version_parts) > 2 else 0
            node_version_valid = (major, minor, patch) >= (26, 3, 0)
        except (ValueError, IndexError):
            pass
    require(
        node_version_valid,
        errors,
        "package.json engines.node must declare a version floor >= 26.3.0",
    )

    tsconfig = as_object_map(load_json(REPO_ROOT / "tsconfig.json"))
    compiler_options = as_object_map(tsconfig.get("compilerOptions")) if tsconfig is not None else None
    if compiler_options is None:
        errors.append("tsconfig.json compilerOptions must be an object")
    else:
        for key in (
            "strict",
            "noUncheckedIndexedAccess",
            "exactOptionalPropertyTypes",
            "useUnknownInCatchVariables",
        ):
            require(
                compiler_options.get(key) is True,
                errors,
                f"tsconfig.json compilerOptions.{key} must stay enabled",
            )

    with (REPO_ROOT / "pyproject.toml").open("rb") as handle:
        pyproject = as_object_map(tomllib.load(handle))
    if pyproject is None:
        errors.append("pyproject.toml must be a TOML object")
        return
    project = as_object_map(pyproject.get("project"))
    require(project is not None, errors, "pyproject.toml [project] must exist")
    if project is not None:
        require(
            project.get("requires-python") == ">=3.12",
            errors,
            "pyproject.toml must require Python >=3.12",
        )
        dependencies_value = project.get("dependencies")
        require(
            isinstance(dependencies_value, list)
            and any(
                str(item).startswith("pydantic>=2.")
                for item in cast(list[object], dependencies_value)
            ),
            errors,
            "pyproject.toml must include Pydantic 2.x",
        )
    tool = as_object_map(pyproject.get("tool"))
    pyright = as_object_map(tool.get("pyright")) if tool is not None else None
    require(
        isinstance(pyright, dict) and pyright.get("typeCheckingMode") == "strict",
        errors,
        "pyproject.toml tool.pyright.typeCheckingMode must be strict",
    )


def validate_markdown(path: Path, errors: list[str]) -> bool:
    content = path.read_text(encoding="utf-8")
    block = frontmatter_block(content)
    if block is None:
        return False
    try:
        data = yaml.safe_load(block)
    except yaml.YAMLError as exc:
        errors.append(f"{path}: Markdown frontmatter is invalid YAML: {exc}")
        return True
    if is_governed_doc_frontmatter(data):
        try:
            DocLifecycleFrontmatter.model_validate(data)
        except ValidationError as exc:
            details = "; ".join(
                f"{'.'.join(str(part) for part in error['loc'])}: {error['msg']}"
                for error in exc.errors()
            )
            errors.append(
                f"{path}: governed doc frontmatter violates doc lifecycle contract: {details}"
            )
    return True


def is_governed_doc_frontmatter(value: object) -> bool:
    data = as_object_map(value)
    if data is None:
        return False
    return data.get("doc_schema") == "coding-harness-doc/v1" or "doc_type" in data


def validate_yaml_file(path: Path, errors: list[str]) -> None:
    if not is_yaml_config_surface(path):
        return
    try:
        data = load_yaml(path)
    except yaml.YAMLError as exc:
        errors.append(f"{path}: invalid YAML: {exc}")
        return
    if path.name.endswith(".schema.yaml"):
        require(
            has_version_field(data),
            errors,
            f"{path}: YAML schema files must include schema/version metadata",
        )


def is_yaml_config_surface(path: Path) -> bool:
    path_text = path.as_posix()
    if path_text.startswith(("templates/", "docs/goals/")):
        return False
    return path_text.startswith(
        (
            ".agents/",
            ".circleci/",
            ".github/",
            "rules/",
            "scripts/",
            "AI/prompts/",
        )
    ) or path.name in {
        ".architecture.yml",
        ".coderabbit.yaml",
        ".markdownlint-cli2.yaml",
        "goal-governor-output.yaml",
        "pnpm-lock.yaml",
        "pnpm-workspace.yaml",
    }


def validate_json_file(path: Path, errors: list[str]) -> None:
    try:
        data = load_json(path)
    except json.JSONDecodeError as exc:
        errors.append(f"{path}: invalid JSON: {exc}")
        return
    if path.name.endswith(".schema.json"):
        data_map = as_object_map(data)
        if data_map is None:
            errors.append(f"{path}: JSON Schema root must be an object")
            return
        schema_value = data_map.get("$schema")
        title_value = data_map.get("title")
        type_value = data_map.get("type")
        require(schema_value in JSON_SCHEMA_DRAFTS, errors, f"{path}: unsupported $schema")
        require(
            isinstance(title_value, str) and bool(title_value.strip()),
            errors,
            f"{path}: missing title",
        )
        require(isinstance(type_value, str), errors, f"{path}: missing root type")
    if is_versioned_machine_json(path):
        require(
            has_version_field(data),
            errors,
            f"{path}: machine contract JSON must include schema/version metadata",
        )


def is_versioned_machine_json(path: Path) -> bool:
    path_text = path.as_posix()
    if path.name in {"package.json", "tsconfig.json"}:
        return False
    if path.name.endswith(".schema.json"):
        return False
    if path_text == "harness.contract.json":
        return True
    if path_text.startswith("contracts/") and "/examples/" not in path_text:
        return any(token in path.name for token in ("manifest", "registry", "contract"))
    return path_text in {
        "docs/workflow-artifact-registry.json",
        ".harness/ci-required-checks.json",
        ".harness/ci-provider-transition-status.json",
    }


def validate_jsonl_file(path: Path, errors: list[str]) -> None:
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            try:
                json.loads(stripped)
            except json.JSONDecodeError as exc:
                errors.append(f"{path}:{line_number}: invalid JSONL record: {exc}")


def validate_command_catalog_value(value: object, label: str, errors: list[str]) -> int:
    try:
        catalog = CommandCatalog.model_validate(value)
    except ValidationError as exc:
        details = "; ".join(
            f"{'.'.join(str(part) for part in error['loc'])}: {error['msg']}"
            for error in exc.errors()
        )
        errors.append(f"{label}: command catalog violates schema: {details}")
        return 0
    if catalog.commandCount != len(catalog.commands):
        errors.append(
            f"{label}: commandCount must match commands length "
            f"({catalog.commandCount} != {len(catalog.commands)})"
        )
    command_names = [command.name for command in catalog.commands]
    duplicate_names = sorted(
        {name for name in command_names if command_names.count(name) > 1}
    )
    if duplicate_names:
        errors.append(
            f"{label}: command names must be unique: {', '.join(duplicate_names)}"
        )
    return len(catalog.commands)


def validate_harness_decision_value(value: object, label: str, errors: list[str]) -> None:
    try:
        HarnessDecision.model_validate(value)
    except ValidationError as exc:
        details = "; ".join(
            f"{'.'.join(str(part) for part in error['loc'])}: {error['msg']}"
            for error in exc.errors()
        )
        errors.append(f"{label}: harness decision violates schema: {details}")


def validate_pydantic_value(
    model: type[BaseModel],
    value: object,
    label: str,
    errors: list[str],
) -> None:
    try:
        model.model_validate(value)
    except ValidationError as exc:
        details = "; ".join(
            f"{'.'.join(str(part) for part in error['loc'])}: {error['msg']}"
            for error in exc.errors()
        )
        errors.append(f"{label}: violates typed artifact contract: {details}")


def agent_native_packet_entries(errors: list[str]) -> dict[str, dict[str, object]]:
    manifest_path = REPO_ROOT / "contracts/runtime-packet-schemas.manifest.json"
    manifest_data = as_object_map(load_json(manifest_path))
    if manifest_data is None:
        errors.append(f"{manifest_path}: manifest must be a JSON object")
        return {}
    packets_value = manifest_data.get("packets")
    packets = cast(list[object], packets_value) if isinstance(packets_value, list) else []
    entries: dict[str, dict[str, object]] = {}
    for packet in (as_object_map(packet) for packet in packets):
        if packet is None:
            continue
        schema_version = packet.get("schemaVersion")
        if isinstance(schema_version, str) and schema_version in AGENT_NATIVE_PACKET_MODELS:
            entries[schema_version] = packet
    return entries


def load_agent_native_example(
    schema_version: str,
    entry: dict[str, object],
    errors: list[str],
) -> tuple[str, object] | None:
    example_path_value = entry.get("examplePath")
    if not isinstance(example_path_value, str):
        errors.append(f"{schema_version}: manifest examplePath must be a string")
        return None
    example_path = REPO_ROOT / example_path_value
    if not example_path.exists():
        errors.append(f"{schema_version}: examplePath does not exist: {example_path_value}")
        return None
    try:
        return (example_path_value, load_json(example_path))
    except (json.JSONDecodeError, OSError) as exc:
        errors.append(f"{example_path_value}: {exc}")
        return None


def validate_agent_native_live_command(
    schema_version: str,
    model: type[BaseModel],
    errors: list[str],
) -> bool:
    command = AGENT_NATIVE_LIVE_COMMANDS[schema_version]
    result = run_command(command, timeout_seconds=120)
    command_label = " ".join(command)
    if result.returncode != 0:
        detail = (result.stderr or result.stdout).strip()
        errors.append(f"{schema_version}: live command failed: {command_label}: {detail}")
        return False
    try:
        live_value = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        errors.append(f"{schema_version}: live command emitted invalid JSON: {exc}")
        return False
    validate_pydantic_value(model, live_value, command_label, errors)
    return True


def validate_cli_json_value(
    value: object,
    contract: CliJsonContract,
    label: str,
    errors: list[str],
) -> int:
    data_map = as_object_map(value)
    if data_map is None:
        errors.append(f"{label}: CLI JSON output must be an object")
        return 0
    require(
        data_map.get("schemaVersion") == contract.expectedSchemaVersion,
        errors,
        f"{label}: schemaVersion must be {contract.expectedSchemaVersion}",
    )
    if contract.expectedSchemaVersion == "harness-command-catalog/v3":
        return validate_command_catalog_value(value, label, errors)
    if contract.expectedSchemaVersion == "harness-decision/v1":
        validate_harness_decision_value(value, label, errors)
        return 0
    if contract.expectedSchemaVersion == "harness-cli-error/v1":
        return 0
    errors.append(f"{label}: unsupported CLI JSON schemaVersion {contract.expectedSchemaVersion}")
    return 0


def validate_json_schema_value(
    schema: object, value: object, label: str, errors: list[str]
) -> None:
    """Validate a parsed JSON value against its declared JSON Schema."""
    schema_map = as_object_map(schema)
    if schema_map is None:
        errors.append(f"{label}: JSON Schema root must be an object")
        return

    try:
        if schema_map.get("$schema") == "http://json-schema.org/draft-07/schema#":
            Draft7Validator.check_schema(schema_map)
        else:
            Draft202012Validator.check_schema(schema_map)
        validate_json_schema(instance=value, schema=schema_map)
    except (JsonSchemaValidationError, SchemaError) as exc:
        location = ".".join(str(part) for part in exc.absolute_path)
        suffix = f" at {location}" if location else ""
        message = exc.message if hasattr(exc, "message") else str(exc)
        errors.append(f"{label}: violates JSON Schema{suffix}: {message}")


def validate_cli_json_contracts(errors: list[str]) -> tuple[int, int]:
    manifest_path = REPO_ROOT / "contracts/cli-json-contracts.manifest.json"
    try:
        manifest = CliJsonContractsManifest.model_validate(load_json(manifest_path))
    except (ValidationError, json.JSONDecodeError, OSError) as exc:
        if isinstance(exc, ValidationError):
            details = "; ".join(
                f"{'.'.join(str(part) for part in error['loc'])}: {error['msg']}"
                for error in exc.errors()
            )
            errors.append(f"contracts/cli-json-contracts.manifest.json: invalid manifest: {details}")
        else:
            errors.append(f"contracts/cli-json-contracts.manifest.json: {exc}")
        return (0, 0)

    command_catalog_commands = 0
    for contract in manifest.contracts:
        schema_path = (REPO_ROOT / contract.schemaPath).resolve()
        example_path = (REPO_ROOT / contract.examplePath).resolve()

        # Ensure paths are within REPO_ROOT to prevent escaping the repository
        try:
            schema_path.relative_to(REPO_ROOT)
        except ValueError:
            errors.append(
                f"{contract.name}: schemaPath escapes repository root: {contract.schemaPath}"
            )
            continue
        try:
            example_path.relative_to(REPO_ROOT)
        except ValueError:
            errors.append(
                f"{contract.name}: examplePath escapes repository root: {contract.examplePath}"
            )
            continue

        if not schema_path.exists():
            errors.append(f"{contract.name}: schemaPath does not exist: {contract.schemaPath}")
            continue
        if not example_path.exists():
            errors.append(f"{contract.name}: examplePath does not exist: {contract.examplePath}")
            continue

        try:
            schema_data = load_json(schema_path)
        except (json.JSONDecodeError, OSError) as exc:
            errors.append(f"{contract.schemaPath}: {exc}")
            continue

        try:
            example_data = load_json(example_path)
        except (json.JSONDecodeError, OSError) as exc:
            errors.append(f"{contract.examplePath}: {exc}")
            continue

        validate_json_schema_value(
            schema_data,
            example_data,
            contract.examplePath,
            errors,
        )
        example_count = validate_cli_json_value(
            example_data,
            contract,
            contract.examplePath,
            errors,
        )
        if contract.expectedSchemaVersion == "harness-command-catalog/v3":
            command_catalog_commands = max(command_catalog_commands, example_count)

        if not contract.liveValidation.enabled:
            continue
        result = run_command(contract.command)
        if result.returncode not in contract.liveValidation.allowedExitCodes:
            detail = (result.stderr or result.stdout).strip()
            errors.append(
                f"{contract.name}: live command exited {result.returncode}; "
                f"allowed {contract.liveValidation.allowedExitCodes}: {detail}"
            )
            continue
        if not contract.liveValidation.stdoutJson:
            continue
        try:
            data = json.loads(result.stdout)
        except json.JSONDecodeError as exc:
            errors.append(f"{contract.name}: live command emitted invalid JSON: {exc}")
            continue
        validate_json_schema_value(
            schema_data,
            data,
            " ".join(contract.command),
            errors,
        )
        live_count = validate_cli_json_value(
            data,
            contract,
            " ".join(contract.command),
            errors,
        )
        if contract.expectedSchemaVersion == "harness-command-catalog/v3":
            command_catalog_commands = max(command_catalog_commands, live_count)

    return (len(manifest.contracts), command_catalog_commands)


def validate_agent_native_packet_contracts(errors: list[str]) -> int:
    checked = 0
    packet_entries = agent_native_packet_entries(errors)
    for schema_version, model in AGENT_NATIVE_PACKET_MODELS.items():
        entry = packet_entries.get(schema_version)
        if entry is None:
            errors.append(f"{schema_version}: missing runtime packet manifest entry")
            continue
        example_result = load_agent_native_example(schema_version, entry, errors)
        if example_result is None:
            continue
        example_path_value, example = example_result
        validate_pydantic_value(model, example, example_path_value, errors)
        if not validate_agent_native_live_command(schema_version, model, errors):
            continue
        checked += 1
    return checked


def validate_runtime_packet_schemas(errors: list[str]) -> int:
    result = run_command(["node", "scripts/validate-runtime-packet-schemas.cjs", "--all"])
    if result.returncode != 0:
        detail = (result.stderr or result.stdout).strip()
        errors.append(
            "contracts/runtime-packet-schemas.manifest.json: "
            f"validation failed: {detail}"
        )
        return 0
    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        errors.append(f"scripts/validate-runtime-packet-schemas.cjs emitted invalid JSON: {exc}")
        return 0
    data_map = as_object_map(data)
    if data_map is None:
        errors.append("scripts/validate-runtime-packet-schemas.cjs output must be a JSON object")
        return 0
    require(
        data_map.get("schemaVersion") == "runtime-packet-schema-validation/v1",
        errors,
        "runtime packet validation output must declare schemaVersion "
        "runtime-packet-schema-validation/v1",
    )
    require(
        data_map.get("status") == "pass",
        errors,
        "runtime packet validation output must have status pass",
    )
    packet_count = data_map.get("packetCount")
    require(
        isinstance(packet_count, int) and packet_count > 0,
        errors,
        "runtime packet validation output must include positive packetCount",
    )
    return packet_count if isinstance(packet_count, int) else 0


def validate_toml_file(path: Path, errors: list[str]) -> None:
    try:
        with path.open("rb") as handle:
            tomllib.load(handle)
    except tomllib.TOMLDecodeError as exc:
        errors.append(f"{path}: invalid TOML: {exc}")


def validate_html_file(path: Path, errors: list[str]) -> None:
    try:
        ArtifactHtmlParser().feed(path.read_text(encoding="utf-8"))
    except Exception as exc:  # pragma: no cover - HTMLParser exposes broad parser failures.
        errors.append(f"{path}: invalid HTML parse: {exc}")


def validate_command_syntax(
    paths: Iterable[Path], command_prefix: Sequence[str], errors: list[str]
) -> int:
    checked = 0
    for path in paths:
        checked += 1
        result = run_command([*command_prefix, path.as_posix()])
        if result.returncode != 0:
            detail = (result.stderr or result.stdout).strip()
            errors.append(f"{path}: syntax check failed: {detail}")
    return checked


def build_report() -> ArtifactReport:
    errors: list[str] = []
    files = tracked_files()

    validate_tool_versions(errors)

    markdown_frontmatter = 0
    governed_markdown = 0
    for path in (file_path for file_path in files if file_path.suffix in {".md", ".mdx"}):
        if validate_markdown(path, errors):
            markdown_frontmatter += 1
            block = frontmatter_block(path.read_text(encoding="utf-8"))
            if block is not None:
                try:
                    data = yaml.safe_load(block)
                except yaml.YAMLError:
                    data = None
                if is_governed_doc_frontmatter(data):
                    governed_markdown += 1

    yaml_files = [path for path in files if path.suffix in {".yaml", ".yml"}]
    for path in yaml_files:
        validate_yaml_file(path, errors)

    json_files = [path for path in files if path.suffix == ".json"]
    for path in json_files:
        validate_json_file(path, errors)

    jsonl_files = [path for path in files if path.suffix == ".jsonl"]
    for path in jsonl_files:
        validate_jsonl_file(path, errors)

    cli_json_contracts, command_catalog_commands = validate_cli_json_contracts(errors)
    runtime_packets = validate_runtime_packet_schemas(errors)
    agent_native_packets = validate_agent_native_packet_contracts(errors)

    toml_files = [path for path in files if path.suffix == ".toml"]
    for path in toml_files:
        validate_toml_file(path, errors)

    html_files = [path for path in files if path.suffix == ".html"]
    for path in html_files:
        validate_html_file(path, errors)

    shell_files = [path for path in files if path.suffix == ".sh"]
    shell_count = validate_command_syntax(shell_files, ["bash", "-n"], errors)

    node_files = [path for path in files if path.suffix in {".js", ".mjs", ".cjs"}]
    node_count = validate_command_syntax(node_files, ["node", "--check"], errors)

    return ArtifactReport(
        markdown=sum(1 for path in files if path.suffix in {".md", ".mdx"}),
        markdown_frontmatter=markdown_frontmatter,
        governed_markdown=governed_markdown,
        yaml_files=len(yaml_files),
        json_files=len(json_files),
        jsonl_files=len(jsonl_files),
        json_schema_files=sum(1 for path in json_files if path.name.endswith(".schema.json")),
        cli_json_contracts=cli_json_contracts,
        command_catalog_commands=command_catalog_commands,
        runtime_packets=runtime_packets,
        agent_native_packets=agent_native_packets,
        toml_files=len(toml_files),
        html_files=len(html_files),
        shell_files=shell_count,
        node_files=node_count,
        errors=tuple(errors),
    )


def main() -> int:
    report = build_report()
    if report.errors:
        for error in report.errors:
            print(f"[artifact-types] {error}", file=sys.stderr)
        return 1
    print(
        "[artifact-types] pass "
        f"markdown={report.markdown} frontmatter={report.markdown_frontmatter} "
        f"governed_markdown={report.governed_markdown} "
        f"yaml={report.yaml_files} json={report.json_files} jsonl={report.jsonl_files} "
        f"json_schema={report.json_schema_files} "
        f"cli_json_contracts={report.cli_json_contracts} "
        f"command_catalog_commands={report.command_catalog_commands} "
        f"runtime_packets={report.runtime_packets} "
        f"agent_native_packets={report.agent_native_packets} "
        f"toml={report.toml_files} "
        f"html={report.html_files} shell={report.shell_files} node={report.node_files}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
