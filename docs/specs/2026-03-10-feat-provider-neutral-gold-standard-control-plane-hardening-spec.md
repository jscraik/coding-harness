---
title: Provider-Neutral Gold-Standard Control Plane Hardening
type: feat
status: draft
date: 2026-03-10
origin: docs/brainstorms/2026-03-10-gold-standard-control-plane-hardening-brainstorm.md
risk: high
spec_depth: full
---

# Provider-Neutral Gold-Standard Control Plane Hardening

## Table of Contents

- [Enhancement Summary](#enhancement-summary)
- [Problem Statement](#problem-statement)
- [Goals](#goals)
- [Non-Goals](#non-goals)
- [System Boundary](#system-boundary)
- [Core Domain Model](#core-domain-model)
- [Main Flow / Lifecycle](#main-flow--lifecycle)
- [Interfaces and Dependencies](#interfaces-and-dependencies)
- [Invariants / Safety Requirements](#invariants--safety-requirements)
- [Failure Model and Recovery](#failure-model-and-recovery)
- [Observability](#observability)
- [Acceptance and Test Matrix](#acceptance-and-test-matrix)
- [Open Questions](#open-questions)
- [Definition of Done](#definition-of-done)

## Enhancement Summary

**Deepened on:** 2026-03-10  
**Key areas improved:** provider-neutral identity, instruction/governance parity, canonical runtime composition, fail-closed scorecards, and cross-agent operating boundaries.

- Defines the hardening layer that sits above the existing canonical run/eval substrate and below any future provider-expansion or orchestration layer.
- Introduces provider-neutral control-plane concepts so Codex, Claude-family, Gemini-family, Kimi-style, and future clients can be normalized into one governance and evaluation model.
- Makes instruction parity across `AGENTS.md`, `CLAUDE.md`, and future equivalent instruction surfaces a first-class governed behavior instead of informal convention.
- Requires governance decisions to bind to explicit trusted-source snapshots rather than mutable prose alone.
- Requires evaluation, promotion, and operator trust decisions to fail closed when canonical runtime truth, parity evidence, or adapter normalization is incomplete.

This spec is a full contract because it changes how the repository reasons about identity, policy, parity, and promotability across time. It is not an implementation plan.

Harness framing for this spec:

- In this repository, the harness is every policy, tool, artifact, execution rule, and feedback loop around the model that makes the model operational.
- The provider-neutral control plane is therefore a harness layer, not model behavior.
- Filesystem-backed artifacts, sandbox/tool policy, verification loops, and context-management primitives are harness responsibilities even when the model participates in planning or execution.

## Problem Statement

`coding-harness` already has strong policy and governance surfaces, and the repository now has a real canonical run/eval substrate. That is the right direction, but the current control plane is still incomplete in four ways that matter before more providers or orchestration are added:

1. runtime truth is canonicalizing, but still not the single authoritative answer to which client, provider, actor, instruction set, and governance snapshot produced a run;
2. core enforcement still contains Codex-shaped assumptions, especially around branch and closeout behavior;
3. documentation and instruction parity are improving, but cross-agent surfaces are not yet modeled as a stable governed system;
4. evaluation signals exist, but the repo does not yet define one fail-closed provider-neutral scorecard contract for solo-maintainer trust decisions.

The control plane therefore cannot yet answer, with one auditable contract:

1. who or what produced this run;
2. which trusted governance and instruction surfaces governed it;
3. whether adapter normalization was complete and drift-free;
4. whether evaluation evidence is sufficient to promote, hold, or block further automation;
5. whether a new provider can be added without introducing bespoke governance logic.

Until those answers are machine-legible and deterministic, adding more provider breadth or orchestration complexity increases surface area faster than trust.

## Goals

1. Define a provider-neutral hardening layer that composes with the existing canonical run/eval substrate instead of replacing it.
2. Normalize agent identity, provider identity, execution mode, and instruction lineage into one control-plane contract.
3. Make instruction parity across `AGENTS.md`, `CLAUDE.md`, and future equivalent files explicit, measurable, and fail-closed where policy requires it.
4. Expand governance truth from command-level parity into a trusted snapshot that captures contract, workflow, instruction, and branch-policy context for each evaluated run.
5. Make promotion, hold, rollback, and parity decisions depend on canonical records plus explicit scorecards rather than ad hoc interpretation.
6. Preserve solo-maintainer practicality: deterministic reports, additive rollout, and no mandatory dependence on one vendor runtime.
7. Make future provider integrations thin adapters against a stable control-plane contract instead of new special-case governance.
8. Keep harness-level context management explicit so long-horizon work does not depend on unbounded in-context state.

## Non-Goals

1. Building a new orchestration engine in this phase.
2. Adding broad new provider support before the hardened layer is proven.
3. Making heavy multi-agent coordination a required foundation for the core harness.
4. Replacing the canonical run/eval substrate spec with a second runtime substrate.
5. Requiring proof that a specific authoring skill, prompt, or vendor product was used.
6. Forcing all projects to carry every possible instruction-surface file even when a provider is not in use.
7. Turning `hamelsmu/evals-skills` or any external evaluation library into a mandatory runtime dependency.
8. Coupling mergeability to one provider's local configuration format or app UX.
9. Designing dynamic just-in-time tool assembly or trace-self-healing harnesses in v1.

## System Boundary

### Owns

- The provider-neutral control-plane contract layered on top of canonical run/eval records.
- Normalized identity for runs, agents, providers, adapters, and instruction surfaces.
- Governance snapshot capture for control-plane decisions.
- Instruction-parity evaluation rules for canonical and mirrored agent instruction files.
- Adapter normalization rules that map provider-specific runtime artifacts into canonical control-plane inputs.
- Control-plane scorecards used for promotion, hold, rollback, and parity-blocking decisions.
- Required observability for parity state, adapter coverage, evaluation completeness, and unresolved drift.
- Harness-level context-management rules needed to keep provider-neutral evaluation legible over long-running work, including artifact offloading and append-only attempt records.

### Does Not Own

- The internal reasoning or product UX of Codex, Claude Code, Gemini, Kimi, or other external clients.
- Vendor authentication flows, third-party pricing, or hosted execution infrastructure.
- Repository docs quality in general; that remains the job of `docs:lint` and the dedicated docs-governance layer.
- Feature-specific remediation semantics already governed by `review-gate`, `evidence-verify`, `pilot-evaluate`, or future command-specific specs.
- A universal cross-repo agent policy product outside the harness contract and generated scaffolding.

### Relationship to Existing Specs

- [Canonical Run/Eval Substrate](../specs/2026-03-08-feat-canonical-run-eval-substrate-spec.md) remains the runtime-truth foundation.
- [Docs Gate for Governance Parity](../specs/2026-03-10-feat-docs-gate-governance-parity-spec.md) remains the dedicated documentation-parity gate.
- This spec defines the control-plane layer that composes canonical runtime truth, instruction parity, governance snapshots, and provider adapters into one promotability model.

Normative ownership decision for v1:

- `docs-gate` is the authority for documentation and instruction-surface parity.
- The provider-neutral control-plane layer must consume the machine-readable `docs-gate` parity artifact and must not independently rescan governed instruction files to produce a second contradictory parity answer.
- Control-plane logic owns only the translation from `docs-gate` parity outcomes into promotability/governance decisions.

### Trust Boundaries

- **Protected governance truth:** contract, workflow, and required-check truth loaded from trusted repository state for merge-authoritative evaluation.
- **Canonical instruction truth:** the root repo `AGENTS.md` and explicitly declared canonical instruction sources.
- **Mirrored instruction surfaces:** `CLAUDE.md`, future `GEMINI.md`, and equivalent client-facing files that must align to canonical truth according to policy.
- **Provider adapter inputs:** provider-specific logs, outputs, or metadata are untrusted until normalized and validated by an adapter.
- **Operator override inputs:** explicit overrides are allowed only when recorded with provenance and evaluated under policy.

## Core Domain Model

### 1) ControlPlaneRun

Logical run-level record used for governance and evaluation. In v1 it is realized through append-only companion artifacts bound to the canonical manifest/event substrate, but consumers must observe one unified model.

Required fields:

- `runId`
- `evaluationAttemptId`
- `command`
- `startedAt`
- `finishedAt`
- `repo`
- `headSha`
- `agentIdentityRef`
- `adapterRef`
- `governanceSnapshotRef`
- `instructionSnapshotRef`
- `outcome`
- `exitClassification`
- `artifactRefs`
- `scorecardRefs`

Normative rule:

- A control-plane decision must never be made from provider-local output alone when a `ControlPlaneRun` is required.
- `runId` identifies the durable logical run, while `evaluationAttemptId` identifies each append-only evaluation attempt against that run.

### 2) AgentIdentity

Normalized identity of the actor that produced or consumed a run.

Required fields:

- `actorId`
- `clientFamily` (`codex|claude_family|gemini_family|kimi_family|custom`)
- `providerId`
- `modelDescriptor`
- `executionMode` (`interactive|non_interactive|background|automation|worktree`)
- `operatorType` (`human_directed|agent_directed|automation`)
- `identityStatus` (`complete|degraded`)
- `degradedReasons[]`

Normalization rules:

- `clientFamily` is stable across provider naming churn.
- `providerId` identifies the runtime/provider endpoint or local adapter source.
- `modelDescriptor` records what was actually configured or reported, not what was assumed.
- Missing identity data is allowed only when `identityStatus=degraded`.
- `degradedReasons[]` must use stable enums:
  `missing_provider_id`, `missing_model_descriptor`, `missing_actor_id`,
  `adapter_identity_gap`, `redacted_sensitive_identity`.
- When `identityStatus=degraded`, `providerId` and `modelDescriptor` may be null,
  but `clientFamily`, `executionMode`, and `operatorType` must remain populated.
- `identityStatus=degraded` maps to non-promotable behavior:
  `block_for_evidence` in merge-authoritative modes and `hold` in advisory/local modes.

### 3) ProviderAdapterDescriptor

Registry-backed declaration of how a client/provider-specific runtime is normalized.

Required fields:

- `adapterId`
- `adapterVersion`
- `clientFamily`
- `inputContracts`
- `outputContracts`
- `capabilities`
- `parityWindow`
- `status` (`active|shadow|sunset_pending|retired`)
- `owner`
- `enteredStateAt`
- `maxShadowDurationDays`
- `promotionCriteria`
- `rollbackCriteria`

Capabilities must declare at minimum:

- run identity support,
- instruction lineage support,
- canonical artifact coverage,
- evaluation evidence coverage,
- worktree awareness,
- approval/sandbox awareness when available.

Normative rule:

- Adapters are thin normalization layers. Governance truth cannot live only inside an adapter.

Normative v1 parity-window contract:

- `parityWindow.measurementWindowRuns`: `50`
- `parityWindow.minimumCanonicalCoverage`: `0.95`
- `parityWindow.minimumConsecutivePassingWindows`: `30`
- `parityWindow.maxCriticalDrifts`: `0`
- `parityWindow.maxFalseBlockRate`: `0.02`

Normative v1 state transitions:

- `shadow -> active` requires all parity-window thresholds to pass, no unresolved critical drift,
  and explicit maintainer approval recorded in override/audit artifacts.
- `active -> sunset_pending` requires a declared replacement or retirement decision and no open migration blocker.
- `sunset_pending -> retired` requires all consumers moved off the adapter and a completed compatibility window.
- `active -> shadow` is mandatory after two consecutive failed parity windows or any critical drift that invalidates trust.
- Any adapter remaining in `shadow` longer than `maxShadowDurationDays` must be escalated and cannot be treated as promotable.

### 4) GovernanceSnapshot

Immutable snapshot of the trusted governance surfaces used when a control-plane decision is made.

Required fields:

- `snapshotId`
- `capturedAt`
- `contractRef`
- `workflowRefs`
- `requiredChecksRef`
- `branchPolicyRef`
- `instructionPolicyRef`
- `sourceTrustLevel`
- `evaluationMode` (`local|pr|merge_group`)
- `sourceRef`
- `sourceSha`
- `baseTreeSha`
- `sourceDigests[]`
- `expiresAt`
- `attestation`

Normative rule:

- Governance evaluation must bind to one captured snapshot, not to floating refs or mutable branch state after evaluation begins.

Normative v1 source selection:

- `local` mode uses current checkout `HEAD` for repository-tracked instruction and code surfaces,
  but cannot produce merge-authoritative `promote`.
- `pr` mode uses the protected base-branch SHA for contract, workflow, required-check,
  and branch-policy truth, while using the PR head SHA for changed instruction and implementation surfaces.
- `merge_group` mode uses the merge-group candidate SHA for runtime-under-test plus the protected base SHA lineage for policy truth.

Integrity and freshness requirements:

- `sourceDigests[]` must include a content hash for every protected governance source used by the snapshot.
- `attestation` must contain at minimum the canonical digest bundle and may also include a signature or equivalent verifier output.
- A snapshot is invalid if any referenced SHA or digest can no longer be verified at evaluation time.
- `expiresAt` is mandatory. A snapshot must be recaptured on base ref change, head SHA change,
  required-check/config drift, canonical instruction digest drift, or expiry, whichever comes first.

### 5) InstructionSurface

Any repository instruction file that contributes to agent behavior or parity evaluation.

Required fields:

- `surfaceId`
- `path`
- `kind` (`canonical|mirror|provider_specific|generated_template`)
- `clientFamily`
- `requiredMode` (`required|optional|not_applicable`)
- `lifecycleState` (`generated_template|optional|shadow_required|required|retired`)
- `normalizer`
- `sourceOfTruth`

Normative v1 semantics:

- Root `AGENTS.md` is the canonical repo instruction source unless explicit policy says otherwise.
- `CLAUDE.md` is a mirror surface in this repository today.
- `GEMINI.md` and future equivalents are modeled as optional or generated-template surfaces until explicitly adopted by policy.
- Canonical instruction sources must be repository-tracked files resolved at the captured `headSha`.
- External instruction sources are out of scope for v1 unless pinned by immutable digest and explicitly allowlisted by policy.

Lifecycle rules:

- `generated_template` surfaces may be scaffolded by `init`, but do not participate in required parity until promoted.
- `optional` surfaces may be evaluated and reported, but cannot block promotion and cannot count as parity passes.
- `shadow_required` surfaces participate in reporting and threshold collection during rollout,
  but block only after the rollout stage enters `enforced`.
- `required` surfaces are merge-authoritative and must pass parity when applicable.
- `retired` surfaces must not be scaffolded for new repos and must not be used to satisfy parity requirements.

### 6) InstructionParityResult

Machine-readable outcome for parity evaluation across instruction surfaces.

Required fields:

- `parityResultId`
- `governanceSnapshotRef`
- `evaluatedSurfaces`
- `status` (`pass|fail|not_applicable|error`)
- `contradictions`
- `missingRequiredSurfaces`
- `staleSurfaceRefs`
- `normalizationWarnings`

Normative rule:

- A contradiction between canonical and required mirrored surfaces is a control-plane failure, not a documentation warning.

Normative ownership rule:

- In v1, `InstructionParityResult` is derived from the `docs-gate` machine-readable artifact.
- The control-plane layer must preserve the original `docs-gate` status, blocker taxonomy, and artifact reference in its own records.

### 7) ControlPlaneScorecard

Machine-readable evaluation summary used by promotion and operator trust decisions.

Required fields:

- `scorecardId`
- `runId`
- `evaluationDecision`
- `enforcementDecision`
- `canonicalCoverage`
- `adapterCoverage`
- `instructionParityStatus`
- `governanceParityStatus`
- `evidenceCompleteness`
- `interventionRate`
- `staleReviewRate`
- `rollbackRate`
- `unresolvedAdapterDriftCount`
- `decisionRecommendation`
- `scoreWindow`
- `minimumSample`
- `thresholdProfileRef`

Decision recommendation values:

- `promote`
- `hold`
- `rollback`
- `block_for_parity`
- `block_for_evidence`
- `block_for_adapter`

Normative rule:

- Insufficient denominators or missing canonical evidence must produce `block_for_evidence`, not an optimistic neutral score.

Decision-layer rules:

- `evaluationDecision` is always computed from the deterministic failure-precedence table.
- `enforcementDecision` is derived from `evaluationDecision` plus the active rollout stage.
- `shadow` stage maps all blocking evaluation decisions to non-blocking advisory enforcement.
- `advisory` stage preserves the recommendation in reports, but merge-authoritative enforcement still requires recorded human approval.
- `enforced` stage makes the mapped `enforcementDecision` merge-authoritative for the configured scope.

Normative metric definitions for merge-authoritative v1:

- `canonicalCoverage = valid canonical manifests and event chains / eligible runs`
- `adapterCoverage = runs with complete required adapter-normalized fields / eligible runs for the adapter`
- `instructionParityPassRate = parity-passing required instruction evaluations / instruction-parity-required runs`
- `governanceParityPassRate = governance-snapshot-valid plus docs-gate parity-passing runs / governance-parity-required runs`
- `evidenceCompleteness = runs with all required control-plane artifacts and sanitization outcomes / eligible runs`
- `identityDegradedRate = degraded-identity runs / eligible runs`
- `staleReviewRate = review-gated runs with stale SHA-bound review evidence / review-gated runs`
- `rollbackRate = rollback-recommended or rollback-executed mutative runs / eligible mutative runs`
- `manualInterventionRate = runs requiring override or human release decision / eligible runs`
- `unresolvedAdapterDriftCount = active or shadow adapters with unresolved drift findings in the current score window`

Normative v1 thresholds:

- `scoreWindow`: trailing `200` eligible runs per active adapter/client family in merge-authoritative mode;
  trailing `50` runs in advisory/local mode.
- `minimumSample`: `50` eligible runs in merge-authoritative mode; `10` in advisory/local mode.
- `canonicalCoverage >= 0.99`
- `adapterCoverage >= 0.99` for `active` adapters and `>= 0.95` for `shadow` adapters
- `instructionParityPassRate = 1.00` for required instruction surfaces
- `governanceParityPassRate = 1.00`
- `evidenceCompleteness >= 0.99`
- `identityDegradedRate = 0.00` in merge-authoritative mode
- `staleReviewRate <= 0.02`
- `rollbackRate <= 0.05`
- `manualInterventionRate <= 0.10` in merge-authoritative mode
- `unresolvedAdapterDriftCount = 0`

### 8) OverridePolicyRecord

Machine-readable record for any explicit override of a control-plane recommendation or blocker.

Required fields:

- `overrideId`
- `runId`
- `authorizedPrincipal`
- `scope` (`advisory_hold`, `temporary_unblock`, `temporary_promote`)
- `reason`
- `ticketRef`
- `approvedBy[]`
- `createdAt`
- `expiresAt`
- `nonOverridableControls[]`

Normative override rules:

- Override authority must be derived from trusted contract policy, not from ad hoc runtime input.
- `temporary_promote` and `temporary_unblock` require dual approval by authorized human principals.
- Overrides may not suppress:
  `canonical_runtime_invalid`, `governance_trust_mismatch`,
  `missing_required_instruction_surface`, or missing snapshot integrity verification.
- Maximum override TTL is `24h`.
- Expired overrides must be ignored automatically and preserved only as audit artifacts.

## Main Flow / Lifecycle

### A. Governance discovery

1. Resolve the trusted repository context for the evaluation mode.
2. Capture the immutable `GovernanceSnapshot`.
3. Resolve which instruction surfaces are in scope for this run from policy and repository state.
4. If a required governance source cannot be loaded, transition the control-plane evaluation to `blocked`.

### B. Instruction resolution

5. Normalize canonical instruction truth from repository-tracked `AGENTS.md` and any repository-tracked linked canonical sources at the captured `headSha`.
6. Consume the trusted, SHA-bound `docs-gate` machine-readable artifact for governed instruction/doc surfaces.
7. Produce an `InstructionParityResult` by translating the `docs-gate` artifact into control-plane terminology without changing its blocker meaning.
8. If required parity fails, mark the run `block_for_parity` before any promotion decision is attempted.

Producer rule:

- The control-plane layer may orchestrate `docs-gate` as an upstream producer step, but must never treat an inline `docs-gate` execution as an alternate truth path for a final control-plane decision.

### C. Adapter resolution

9. Resolve the provider/client runtime to a `ProviderAdapterDescriptor`.
10. Validate that the adapter can normalize the available runtime evidence into the required control-plane fields.
11. If adapter coverage is incomplete for a required decision path, mark the run `block_for_adapter`.

Adapter input-hardening rules:

- Adapter inputs must use strict schema validation for decision-critical fields.
- Unknown fields affecting identity, outcome, or governance must be rejected rather than ignored.
- Payload and field sizes must be bounded before parsing.
- Canonicalization must be deterministic.
- Provenance or authenticity metadata must be verified when the provider/runtime exposes it.

### D. Runtime composition

12. Load canonical run/eval artifacts from the existing substrate.
13. Bind them to `AgentIdentity`, `ProviderAdapterDescriptor`, `GovernanceSnapshot`, and `InstructionParityResult`.
14. Build the `ControlPlaneRun`.
15. If canonical runtime truth exists but is invalid, fail closed and do not silently fall back to weaker evidence.

### E. Scorecard evaluation

16. Derive the `ControlPlaneScorecard`.
17. Apply denominator guards and fail-closed rules for missing or degraded evidence.
18. Emit a machine-readable recommendation and explanation payload.

### F. Terminal decision behavior

19. Promotion may occur only when canonical coverage, adapter coverage, governance parity, and instruction parity all meet policy thresholds.
20. Hold is used when the run is valid but requires human review or more evidence.
21. Rollback remains a distinct outcome when runtime behavior crossed the rollback threshold defined by existing pilot/remediation policy.
22. Blocked outcomes are reserved for parity, adapter, policy, or evidence incompleteness that prevents a valid trust decision.

Deterministic failure-precedence and decision mapping:

1. `governance_trust_mismatch` or failed snapshot integrity verification -> `block_for_evidence`
2. `canonical_runtime_invalid` -> `block_for_evidence`
3. `missing_required_instruction_surface` or `instruction_parity_failed` -> `block_for_parity`
4. `adapter_unresolved` or `adapter_coverage_incomplete` -> `block_for_adapter`
5. `scorecard_denominator_insufficient` -> `block_for_evidence`
6. `telemetry_unavailable` -> `block_for_evidence` in merge-authoritative modes, `hold` in advisory/local modes
7. `identity_degraded` -> `block_for_evidence` in merge-authoritative modes, `hold` in advisory/local modes
8. runtime rollback threshold crossed with no higher-precedence blocker -> `rollback`
9. valid but non-promotable with no blocker -> `hold`
10. all thresholds and invariants satisfied -> `promote`

The emitted `exitClassification` and CI status must preserve the highest-precedence failure reason even when a lower-precedence condition also exists.

Stage-aware enforcement mapping:

- In `shadow`, `evaluationDecision` is computed normally, but `enforcementDecision` must remain advisory and cannot introduce new merge blockers.
- In `advisory`, `evaluationDecision` is reported unchanged and `enforcementDecision` may request human hold/review, but not fail merge automatically.
- In `enforced`, `enforcementDecision` must equal the mapped blocking/non-blocking outcome for the configured scope and may fail CI.

### G. Rollout behavior over time

23. Existing command behavior remains authoritative while this layer is rolled out additively.
24. New provider adapters begin in shadow mode until parity evidence is sufficient.
25. Canonical and provider-neutral scorecards must prove stability for a sustained parity window before legacy adapter assumptions are retired.

### H. Rollout stages

Three rollout stages are normative for v1:

1. `shadow`
   - companion artifacts are written;
   - `docs-gate` parity artifacts are consumed but do not introduce new merge blockers beyond existing checks;
   - entry requires canonical substrate already enabled;
   - exit requires at least `50` eligible runs, zero critical drift, and `block_for_*` false positive rate `<= 0.02`.
2. `advisory`
   - control-plane recommendation is visible to operators and CI summaries;
   - blockers are reported, but human approval remains required to enforce new failure classes;
   - exit requires `30` consecutive passing parity windows, `canonicalCoverage >= 0.99`,
     and explicit maintainer approval.
3. `enforced`
   - control-plane recommendations become merge-authoritative for the configured scope;
   - entry requires zero unresolved adapter drift, zero required parity contradictions,
     and all merge-authoritative thresholds satisfied in the score window.

Approval authority:

- entering `shadow` may be done by repository maintainers;
- moving to `advisory` or `enforced` requires recorded maintainer approval in governance artifacts;
- rollback from `enforced` to `advisory` or `shadow` is mandatory after any critical drift or repeated threshold breach.

## Interfaces and Dependencies

### Existing Repository Dependencies

- [docs/specs/2026-03-08-feat-canonical-run-eval-substrate-spec.md](../specs/2026-03-08-feat-canonical-run-eval-substrate-spec.md)
- [docs/architecture/agent-run-records.md](../architecture/agent-run-records.md)
- [contracts/agent-run-manifest.schema.json](../../contracts/agent-run-manifest.schema.json)
- [contracts/agent-run-event.schema.json](../../contracts/agent-run-event.schema.json)
- [contracts/agent-adapter-registry.json](../../contracts/agent-adapter-registry.json)
- [contracts/agent-metric-registry.json](../../contracts/agent-metric-registry.json)
- [src/lib/contract/run-records.ts](../../src/lib/contract/run-records.ts)
- [src/lib/contract/run-record-emitter.ts](../../src/lib/contract/run-record-emitter.ts)
- [src/lib/pilot-evaluation/metrics-capture.ts](../../src/lib/pilot-evaluation/metrics-capture.ts)
- [src/lib/pilot-evaluation/registries.ts](../../src/lib/pilot-evaluation/registries.ts)
- [src/lib/memory/branch-enforcer.ts](../../src/lib/memory/branch-enforcer.ts)
- [src/commands/drift-gate.ts](../../src/commands/drift-gate.ts)
- [src/commands/docs-gate.ts](../../src/commands/docs-gate.ts)
- [src/commands/pilot-evaluate.ts](../../src/commands/pilot-evaluate.ts)
- [src/commands/pilot-rollback.ts](../../src/commands/pilot-rollback.ts)
- [src/commands/check-environment.ts](../../src/commands/check-environment.ts)
- [src/lib/policy/required-checks.ts](../../src/lib/policy/required-checks.ts)
- [src/commands/branch-protect.ts](../../src/commands/branch-protect.ts)
- [src/commands/observability-gate.ts](../../src/commands/observability-gate.ts)
- [docs/specs/2026-03-10-feat-docs-gate-governance-parity-spec.md](../specs/2026-03-10-feat-docs-gate-governance-parity-spec.md)
- [.github/workflows/pr-pipeline.yml](../../.github/workflows/pr-pipeline.yml)
- [AGENTS.md](../../AGENTS.md)
- [CLAUDE.md](../../CLAUDE.md)
- [harness.contract.json](../../harness.contract.json)
- [src/commands/review-gate.ts](../../src/commands/review-gate.ts)
- [src/commands/init.ts](../../src/commands/init.ts)

### New or Extended Control-Plane Interfaces

V1 representation decision:

- v1 must use companion artifacts rather than extending `agent-run-manifest` or `agent-run-event` schemas.
- Existing canonical manifest/event files remain unchanged and continue to be the runtime-truth foundation.
- Companion artifacts must live alongside the canonical run artifacts under an append-only attempt-scoped layout and use the same `runId`.

Required companion artifacts for v1:

- `control-plane-run.json`
- `governance-snapshot.json`
- `instruction-parity.json`
- `control-plane-scorecard.json`
- `override-policy-record.json` when an override exists

Required metadata in every companion artifact:

- `schemaVersion`
- `compatibilityMajor`
- `producerVersion`
- `runId`
- `evaluationAttemptId`

Canonical join contract:

- `runId` is the primary join key.
- `evaluationAttemptId` is required for append-only retry history and must never be reused.
- `headSha`, canonical manifest path, and canonical manifest content hash must also be stored in each companion artifact.
- Consumers must reject joins when `runId` matches but `headSha` or manifest hash do not.

Normative pathing:

- companion artifacts must be written under:
  `.../<runId>/control-plane/<evaluationAttemptId>/`
- an optional `.../<runId>/control-plane/latest.json` index may point to the most recent valid attempt, but it is advisory only.

Compatibility and rollback contract:

- Readers must be dual-read in v1:
  use companion artifacts when present, otherwise fall back to legacy canonical-only behavior without claiming provider-neutral completeness.
- Readers must reject companion artifacts whose `compatibilityMajor` exceeds the supported major version.
- Writers must keep producing canonical manifest/event artifacts regardless of control-plane rollout stage.
- Rollback of the v1 migration must disable companion-artifact writing while preserving canonical writers and canonical readers.
- Previously written companion artifacts remain audit evidence and must not require destructive cleanup.
- If companion artifacts are unavailable after rollback, scorecards may be rehydrated only from canonical records plus preserved `docs-gate` artifacts;
  if those inputs are insufficient, the result must be `block_for_evidence`.

The logical interfaces are normative:

- `ControlPlaneRun`
- `AgentIdentity`
- `ProviderAdapterDescriptor`
- `GovernanceSnapshot`
- `InstructionSurface`
- `InstructionParityResult`
- `ControlPlaneScorecard`

### External Product and Best-Practice Inputs

Current official OpenAI guidance used to shape this contract, verified on 2026-03-10:

- Codex config supports project-scoped config, custom `model_provider` / `model_providers`, and `project_doc_max_bytes`, which supports a provider-neutral instruction model rather than a Codex-only one.
  - Source: [Configuration Reference](https://developers.openai.com/codex/config-reference/)
- Codex supports scripted, CI-style non-interactive execution and newline-delimited JSON events via `codex exec --json`, which reinforces machine-readable control-plane outputs.
  - Source: [CLI Reference: codex exec](https://developers.openai.com/codex/cli/reference/#codex-exec)
- Codex app worktrees and automations use isolated worktrees for Git repositories, which reinforces worktree isolation as a strong operating pattern but not a required foundation for v1 control-plane hardening.
  - Sources: [Worktrees](https://developers.openai.com/codex/app/worktrees/), [Automations](https://developers.openai.com/codex/app/automations/)
- Codex multi-agent tooling is currently experimental and explicitly opt-in, so the hardened layer must not depend on multi-agent orchestration for correctness.
  - Source: [Multi-agents](https://developers.openai.com/codex/multi-agent/)
- OpenAI’s current security guidance treats prompt content, tool arguments, and tool outputs as sensitive and recommends controlled telemetry and retention, which is normative for this layer’s observability design.
  - Source: [Agent approvals and security](https://developers.openai.com/codex/agent-approvals-security/#security-and-privacy-guidance)

### External Reference Inputs

- [`hamelsmu/evals-skills`](https://github.com/hamelsmu/evals-skills) is a pattern input for evaluation hygiene, especially evaluator audit, error analysis, and judge-quality validation.
- It is not a runtime authority for harness governance, adapter identity, or artifact layout.
- Current harness-engineering discussion also reinforces three relevant design principles for this spec:
  - harness scope should be defined explicitly as the system around the model, not confused with model behavior;
  - long-horizon work depends on harness-level context management such as compaction, offloading, and progressive disclosure;
  - models can overfit to the harnesses they are trained in, so provider adapters must stay thin and avoid embedding provider-specific governance truth.

## Invariants / Safety Requirements

1. A control-plane decision must bind to exactly one captured governance snapshot.
2. Canonical runtime truth remains the first source of runtime evidence.
3. If canonical runtime files exist but are invalid, consumers must fail closed rather than silently using weaker evidence.
4. Provider adapters must not redefine governance truth; they only normalize provider-specific inputs.
5. Required mirrored instruction surfaces must agree with canonical instruction truth after normalization.
6. Missing required instruction surfaces must be explicit machine failures, not silent warnings.
7. Optional instruction surfaces may be `not_applicable`, but cannot be counted as passing parity.
8. Identity fields must describe observed or configured reality; placeholder values must be explicit degraded sentinels.
9. Scorecards must use denominator guards and fail closed when evidence is incomplete.
10. A run cannot be promotable if instruction parity, governance parity, or adapter coverage is unresolved.
11. Worktree or background-execution metadata, when present, must be captured as execution context, not inferred later.
12. Overrides by a human or automation must be recorded with provenance, authority, scope, and expiry.
13. Sensitive fields must be sanitized before persistence or telemetry export using deterministic transform rules.
14. This layer must remain additive during rollout; existing command contracts cannot be silently broken to adopt it.
15. Branch- or provider-specific enforcement rules must be expressible without hardcoding one vendor family as the permanent default.
16. In merge-authoritative modes, required-check and branch-policy truth must bind to trusted base-branch or explicitly trusted snapshot sources, not PR-branch rewrites.
17. Companion control-plane artifacts must never mutate the canonical manifest/event truth they reference.
18. `docs-gate` remains the sole authority for instruction/doc parity status in v1.
19. Raw provider evidence must never be linked directly from scorecards using unsanitized file paths or raw payload fragments.

## Failure Model and Recovery

### Failure Classes

- `governance_source_unavailable`
- `governance_trust_mismatch`
- `instruction_parity_failed`
- `missing_required_instruction_surface`
- `adapter_unresolved`
- `adapter_coverage_incomplete`
- `canonical_runtime_invalid`
- `identity_degraded`
- `scorecard_denominator_insufficient`
- `telemetry_unavailable`
- `legacy_assumption_detected`

### Recovery Rules

1. If governance sources cannot be loaded, stop evaluation and emit a blocked result.
2. If canonical instruction truth conflicts with required mirrored surfaces, emit `instruction_parity_failed` and require explicit remediation before promotion.
3. If a provider adapter cannot normalize required fields, emit `adapter_coverage_incomplete`; do not patch missing fields from prose or heuristics.
4. If runtime identity is degraded but the run is otherwise valid, record the degraded sentinel and block promotability.
5. If telemetry or auxiliary observability sinks are unavailable, preserve local control-plane artifacts and mark observability degraded; do not convert that into a false pass.
6. If a legacy Codex-only assumption is encountered in core enforcement, the system must surface it explicitly as migration debt rather than silently treating it as universal behavior.
7. Recovery from parity or adapter failures is additive:
   - repair instruction surfaces or policy;
   - repair adapter mapping or registry coverage;
   - rerun the evaluation from a fresh governance snapshot.

Failure-to-remediation matrix:

- `governance_source_unavailable`
  - owner: maintainer
  - required evidence: failed source resolution plus captured mode/source refs
  - rerun entrypoint: `harness check-environment`, then rerun the producing command
  - done when: trusted source digests resolve and snapshot verifies
- `governance_trust_mismatch`
  - owner: maintainer
  - required evidence: conflicting source digests and normalized statement diff
  - rerun entrypoint: `harness docs-gate`, then rerun the producing command
  - done when: protected truth converges and parity artifact passes
- `instruction_parity_failed` or `missing_required_instruction_surface`
  - owner: maintainer or docs owner
  - required evidence: `docs-gate` blocker artifact
  - rerun entrypoint: `harness docs-gate`
  - done when: required surfaces pass parity and no contradiction remains
- `adapter_unresolved` or `adapter_coverage_incomplete`
  - owner: adapter owner
  - required evidence: adapter coverage report and normalized-field gap report
  - rerun entrypoint: rerun producing command, then `harness pilot-evaluate`
  - done when: required fields are normalized and parity window restarts
- `canonical_runtime_invalid`
  - owner: maintainer
  - required evidence: schema or hash-chain validation failure
  - rerun entrypoint: rerun producing command after runtime fix
  - done when: canonical manifest/event validate cleanly
- `identity_degraded`
  - owner: adapter owner
  - required evidence: degraded reasons plus affected null fields
  - rerun entrypoint: rerun producing command after adapter or runtime fix
  - done when: `identityStatus=complete`
- `scorecard_denominator_insufficient` or `telemetry_unavailable`
  - owner: maintainer
  - required evidence: metric window report and missing-signal explanation
  - rerun entrypoint: `harness observability-gate`, `harness pilot-evaluate`
  - done when: minimum sample and required telemetry return
- `legacy_assumption_detected`
  - owner: maintainer
  - required evidence: migration-debt artifact tied to source path
  - rerun entrypoint: rerun producing command after provider-neutral migration change
  - done when: source path no longer relies on Codex-only behavior

### Retry and Rollback Semantics

- Retrying control-plane evaluation requires a new governance snapshot and a new scorecard evaluation record.
- Retrying a provider adapter normalization must preserve the original raw evidence reference for auditability.
- This spec does not redefine runtime rollback triggers; it requires rollback decisions to be representable in the control-plane scorecard and bound to canonical run truth.
- Schema migration rollback must preserve canonical readers/writers and disable only the companion-artifact writer path.

## Observability

### Required Outputs

Each control-plane evaluation must emit machine-readable outputs sufficient for operator review and later automation.

Minimum required artifact families:

- canonical run/eval records under existing run-record storage;
- governance snapshot artifact or embedded snapshot reference;
- instruction parity report;
- adapter coverage report;
- control-plane scorecard;
- summary status artifact for CI and promotion consumers.

### Required Metrics

- `canonical_coverage`
  - definition: valid canonical manifests and event chains / eligible runs
  - window: trailing `200` eligible runs in merge-authoritative mode, `50` in advisory/local
  - threshold: `>= 0.99`
  - action: below threshold -> `block_for_evidence`
- `adapter_coverage`
  - definition: runs with complete required adapter-normalized fields / eligible runs for the adapter
  - window: same as score window
  - threshold: `>= 0.99` for active adapters, `>= 0.95` for shadow adapters
  - action: below threshold -> `block_for_adapter`
- `instruction_parity_pass_rate`
  - definition: parity-passing required instruction evaluations / required instruction evaluations
  - window: same as score window
  - threshold: `1.00`
  - action: below threshold -> `block_for_parity`
- `governance_parity_pass_rate`
  - definition: governance-snapshot-valid plus docs-gate parity-passing runs / governance-parity-required runs
  - window: same as score window
  - threshold: `1.00`
  - action: below threshold -> `block_for_evidence`
- `evidence_completeness`
  - definition: runs with all required control-plane artifacts and sanitization outcomes / eligible runs
  - window: same as score window
  - threshold: `>= 0.99`
  - action: below threshold -> `block_for_evidence`
- `identity_degraded_rate`
  - definition: degraded-identity runs / eligible runs
  - window: same as score window
  - threshold: `0.00` in merge-authoritative mode
  - action: above threshold -> `block_for_evidence`
- `stale_review_rate`
  - definition: review-gated runs with stale SHA-bound review evidence / review-gated runs
  - window: same as score window
  - threshold: `<= 0.02`
  - action: above threshold -> `hold`
- `rollback_rate`
  - definition: rollback-recommended or rollback-executed mutative runs / eligible mutative runs
  - window: same as score window
  - threshold: `<= 0.05`
  - action: above threshold -> `hold` until reviewed
- `manual_intervention_rate`
  - definition: runs requiring override or human release decision / eligible runs
  - window: same as score window
  - threshold: `<= 0.10` in merge-authoritative mode
  - action: above threshold -> `hold`
- `unresolved_adapter_drift_count`
  - definition: count of active or shadow adapters with unresolved drift findings in the current score window
  - window: current score window
  - threshold: `0`
  - action: above threshold -> `block_for_adapter`

### Required Logs and Provenance

- capture the governing contract/workflow/instruction refs used for each evaluation;
- capture adapter version and parity-window status;
- capture whether the run occurred in local checkout, dedicated worktree, or background mode when known;
- capture any operator override with reason, provenance, approvers, and expiry;
- capture sanitization or redaction actions when sensitive fields are removed.

Raw evidence handling:

- Raw provider evidence must be stored only as immutable restricted artifacts referenced by opaque IDs.
- Scorecards and summaries may include only sanitized metadata references, never raw prompt/tool/output payloads.
- Secret scanning and redaction must run before persistence of any raw-evidence artifact.

Sensitive-field transformation policy:

- secrets, credentials, tokens -> `reject` from scorecard persistence and telemetry; store only hashed opaque reference
- prompt/tool/output payloads with sensitive content -> `drop` from scorecards, retain only restricted raw artifact reference
- high-cardinality identifiers -> `hash`
- user-visible but non-sensitive identifiers -> `mask` when emitted to telemetry if cardinality or privacy risk exists

### Operator Readability

The control-plane layer must support two operator views without changing truth:

1. machine-readable JSON artifacts for CI, automation, and downstream consumers;
2. concise human-readable summaries that explain why the run is promotable, held, rolled back, or blocked.

## Acceptance and Test Matrix

### Contract-Level Acceptance

1. The repository can describe one provider-neutral control-plane decision path without assuming Codex-only semantics.
2. A run can be evaluated with explicit identity, governance snapshot, adapter coverage, and instruction parity state.
3. A missing or contradictory required instruction surface blocks promotion.
4. A canonical runtime artifact that is present but invalid blocks promotion.
5. A new provider can be introduced through an adapter contract without inventing bespoke governance rules.
6. The control-plane layer consumes one authoritative `docs-gate` parity artifact rather than producing a second parity truth.
7. Companion artifacts can be rolled back without breaking canonical run/eval readers.

### Test Matrix

1. **Codex baseline parity**
   - Input: a canonical run emitted by the current substrate plus `AGENTS.md` and `CLAUDE.md`.
   - Expectation: provider-neutral scorecard resolves successfully without Codex-only special cases.

2. **Required instruction contradiction**
   - Input: `AGENTS.md` updated while `CLAUDE.md` remains stale for a governed rule.
   - Expectation: `instruction_parity_failed`, blocked promotion, explicit contradiction payload.

3. **Optional mirror absent**
   - Input: no `GEMINI.md` in a repo where Gemini parity is not enabled.
   - Expectation: `not_applicable`, not a failure, and not counted as a parity pass.

4. **Adapter unresolved**
   - Input: provider runtime evidence from an unsupported client family.
   - Expectation: `adapter_unresolved`, blocked promotion, preserved raw evidence references.

5. **Canonical runtime invalid**
   - Input: canonical manifest exists but fails schema or run-binding validation.
   - Expectation: fail closed, no fallback to weaker evidence.

6. **Identity degraded**
   - Input: run artifacts present but provider/model identity incomplete.
   - Expectation: scorecard emits degraded identity and blocks promotion.

7. **Governance snapshot trust mismatch**
   - Input: required-check truth and contributor-facing guidance disagree after normalization.
   - Expectation: control-plane failure with trusted-source mismatch classification.

8. **Denominator insufficiency**
   - Input: partial evaluation data that cannot support canonical coverage or intervention-rate math.
   - Expectation: `block_for_evidence`, not `hold` and not `promote`.

9. **Background/worktree awareness**
   - Input: run executed in background worktree or automation context with explicit metadata.
   - Expectation: execution mode is captured and survives scorecard generation.

10. **Legacy rule migration detection**
    - Input: core enforcement still relies on `codex/*` or `FORJAMIE.md`-specific logic for a provider-neutral path.
    - Expectation: migration debt is surfaced explicitly and treated as unresolved core hardening.

11. **Sensitive-field sanitization**
    - Input: provider adapter receives tool-output metadata with sensitive key classes.
    - Expectation: persistence and telemetry artifacts redact or reject the sensitive fields.

12. **Shadow adapter rollout**
    - Input: new adapter introduced in shadow mode with less than the required parity window.
    - Expectation: reported as shadow-only and ineligible for promotable status.

13. **Failure precedence**
    - Input: a run with `instruction_parity_failed`, `telemetry_unavailable`, and rollback signal.
    - Expectation: terminal recommendation follows the deterministic precedence table and preserves lower-precedence reason codes as context only.

14. **Override policy enforcement**
    - Input: attempted temporary promote override for `canonical_runtime_invalid`.
    - Expectation: override rejected because the control is non-overridable.

15. **Companion-artifact rollback**
    - Input: v1 companion writer disabled during rollback.
    - Expectation: canonical readers continue to function, companion artifacts remain audit-only, and new provider-neutral completeness claims stop.

### Operational Verification Checklist

Before enabling `advisory` or `enforced` rollout stages, operators must verify:

1. `pnpm check` passes.
2. `harness check-environment` resolves trusted governance sources and emits a valid policy fingerprint.
3. `harness docs-gate` reports no unresolved required instruction contradictions for the target scope.
4. `harness pilot-evaluate` shows the target score window meets all required thresholds for the intended rollout stage.
5. `harness drift-gate` in health mode reports no unresolved governance-surface drift relevant to the rollout.
6. If observability is required for the target mode, `harness observability-gate` passes with no blocking cardinality or missing-signal issue.

After enabling a new stage, operators must verify:

1. complete `ControlPlaneRun` companion artifacts are emitted for the stage scope;
2. parity failure counts do not exceed the stage’s false-block ceiling;
3. `adapter_unresolved` count does not increase unexpectedly;
4. blocked decision rate remains within the approved rollout window; and
5. rollback to the previous stage can be completed without breaking canonical readers.

## Open Questions

1. Which exact instruction-surface set should be scaffolded by default in `init` for non-Codex clients:
   - `CLAUDE.md` only,
   - `CLAUDE.md` plus `GEMINI.md`,
   - or a registry-driven generated set?
2. How should the current `branch-enforcer` migrate from `codex/*` semantics to a provider-neutral rule model without losing existing safety value?

## Definition of Done

The spec is complete when:

- the provider-neutral hardening layer has a clear boundary relative to existing runtime and docs-governance specs;
- the key entities and normalization rules are explicit and stable;
- lifecycle behavior covers governance discovery, instruction parity, adapter resolution, runtime composition, and scorecard evaluation;
- rollout stages, compatibility rules, and rollback behavior are explicit;
- failure and recovery rules are explicit and fail closed where trust would otherwise be ambiguous;
- observability requirements are strong enough for CI, automation, and solo-maintainer operation;
- `/prompts:workflow-plan` can derive an implementation sequence from this document without inventing behavior.
