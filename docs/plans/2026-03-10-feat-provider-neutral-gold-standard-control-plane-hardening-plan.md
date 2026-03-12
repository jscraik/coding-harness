---
title: "feat: Provider-Neutral Gold-Standard Control Plane Hardening"
type: feat
status: active
date: 2026-03-10
plan_id: feat-provider-neutral-gold-standard-control-plane-hardening
origin: docs/brainstorms/2026-03-10-gold-standard-control-plane-hardening-brainstorm.md
spec: docs/specs/2026-03-10-feat-provider-neutral-gold-standard-control-plane-hardening-spec.md
---

# feat: Provider-Neutral Gold-Standard Control Plane Hardening

## Table of Contents
- [Enhancement Summary](#enhancement-summary)
- [Current Execution Status](#current-execution-status)
- [Overview](#overview)
- [Problem Statement / Motivation](#problem-statement--motivation)
- [Scope and Non-Goals](#scope-and-non-goals)
- [Planning Inputs](#planning-inputs)
- [Implementation Phases](#implementation-phases)
- [Dependencies and Risks](#dependencies-and-risks)
- [Test and Validation Strategy](#test-and-validation-strategy)
- [Rollout / Migration / Monitoring](#rollout--migration--monitoring)
- [Acceptance Checklist](#acceptance-checklist)
- [Sources & References](#sources--references)

## Enhancement Summary

**Deepened on:** 2026-03-10  
**Key areas improved:** checkpoint ownership, file-level execution detail, validation depth, rollout evidence, and implementation-versus-promotion clarity.

- Keeps canonical manifest/event files authoritative and additive; control-plane artifacts remain companion-only.
- Sharpens the execution order so provider-neutral identity and adapter normalization land before scorecard math and enforcement mapping.
- Adds explicit phase outputs, target files, verification slices, and checkpoint exit criteria instead of relying on implied handoff.
- Treats `docs-gate` and the trusted `pr-template` check as authoritative governance inputs, not parallel truth paths to be recomputed by the control plane.
- Separates `implementation complete` from `promotion ready`, so CP0-CP5 delivery is not mistaken for CP6 rollout clearance.

## Current Execution Status

Updated on 2026-03-11 after CP6 rollout artifact stabilization, flake mitigation, and full validation.

- Landed the foundational provider-neutral companion-artifact seam for `pilot-evaluate`:
  - shared control-plane types in `src/lib/pilot-evaluation/types.ts`
  - additive artifact builder/loader in `src/lib/pilot-evaluation/control-plane.ts`
  - trusted `docs-gate`/PR-template/provider identity CLI threading in `src/commands/pilot-evaluate.ts` and `src/cli.ts`
  - focused coverage in `src/lib/pilot-evaluation/control-plane.test.ts`, `src/commands/pilot-evaluate.test.ts`, and `src/cli-dispatch.test.ts`
- Landed the required-check governance parity slice:
  - init scaffolding now renders branch-protection guidance from shared policy truth in `src/lib/policy/required-checks.ts`
  - `branch-protect` continues to consume `BRANCH_PROTECTION_REQUIRED_CHECKS` directly
  - the control-plane governance snapshot now compares the full required-check identity set across `harness.contract.json`, `.github/workflows/*`, init guidance, and governed docs
  - focused parity coverage now lives in `src/commands/init.test.ts` and `src/lib/pilot-evaluation/control-plane.test.ts`
- Landed the contract-backed override-policy slice:
  - trusted `controlPlanePolicy.overridePolicy` contract defaults and validation now flow through `src/lib/contract/types.ts`, `src/lib/contract/validator.ts`, `harness.contract.json`, and `src/commands/init.ts`
  - `pilot-evaluate` now accepts explicit override inputs, enforces authorized-principal and TTL rules, rejects non-overridable controls fail-closed, and writes append-only `override-policy-record.json` plus audit-log entries in `src/lib/pilot-evaluation/control-plane.ts`
  - merge-authoritative degraded-identity handling now resolves to `block_for_evidence` rather than adapter drift, aligning blocker semantics with the approved spec
  - focused override coverage now lives in `src/lib/pilot-evaluation/control-plane.test.ts`, `src/commands/pilot-evaluate.test.ts`, `src/lib/contract/validator.test.ts`, `src/cli-dispatch.test.ts`, and `src/commands/init.test.ts`
- Landed the evidence-formatting slice:
  - every emitted companion artifact and audit-log entry now carries shared `compatibilityMajor` and `producerVersion` metadata
  - control-plane loaders reject unsupported compatibility majors and require phase-report evidence alongside the core companion artifacts
  - stable machine-readable phase reports now emit as `pilot-evaluate-report.json` and `override-policy-report.json`, carrying command, artifact refs, provenance, blocker context, and follow-up notes
  - focused coverage now verifies metadata presence, phase-report emission, compatibility rejection, and command-level report writing in `src/lib/pilot-evaluation/control-plane.test.ts` and `src/commands/pilot-evaluate.test.ts`
- Landed the Phase 6 rollout-window tracking slice:
  - `RolloutWindow`, `RolloutWindowHistory`, `PromotionPacket`, `DemotionTrigger`, and `MonitoringMetricsSnapshot` types added to `src/lib/pilot-evaluation/types.ts`
  - rollout window tracking with explicit stage-exit thresholds and consecutive passing window counting in `src/lib/pilot-evaluation/control-plane.ts`
  - promotion packet generation for stage transitions (`shadow` -> `advisory` -> `enforced`) plus loader validation
  - demotion trigger emission in `enforced`, persisted `demotion-triggers.jsonl` evidence, and `control-plane-audit-log.jsonl` demotion audit entries
  - monitoring metrics persistence in `monitoring-metrics-latest.json` and additive CP6 compatibility checks in artifact loading
  - focused rollout coverage in `src/lib/pilot-evaluation/control-plane.test.ts` now proves promotion packet generation, demotion evidence emission, and partial-set compatibility failure behavior
- Stabilized the flaky pilot metrics test lane:
  - `src/commands/pilot-evaluate.test.ts` `capturePilotMetrics` coverage now applies explicit timeout budget to the valid-artifact fixture case
- The implementation is intentionally additive:
  - canonical `pilot-evaluate` outcome behavior remains authoritative
  - control-plane artifacts are only emitted when explicit control-plane inputs are provided
  - enforcement remains non-authoritative in `shadow`/`advisory` mode
- Repo-wide validation passed:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm check`
  - `pnpm test`
  - `pnpm audit`
- Implementation complete for CP0-CP6 at the code and test gate level; production promotion remains contingent on live rollout-window evidence in merge-authoritative operation.

## Overview

Implement the provider-neutral control-plane hardening layer defined in the linked spec by extending the existing canonical run/eval substrate with companion artifacts, governance snapshots, adapter normalization, and deterministic scorecards.

This plan is execution-only. It does not redefine system behavior beyond the approved spec. The focus is to land the smallest safe sequence that improves trust and operator legibility before any broader provider expansion or orchestration work.

Completion model for this plan:

- **Implementation complete** means the contract, artifact, command, and CI integration work for CP0-CP5 has landed and passed the required validation slices.
- **Promotion ready** means CP6 rollout evidence proves the stage-exit criteria and rollback/demotion controls defined by the spec.

## Problem Statement / Motivation

`coding-harness` now has a real canonical run/eval substrate and strong governance surfaces, but the control plane still lacks one authoritative, provider-neutral answer to:

1. who produced a run;
2. which trusted governance and instruction surfaces governed it;
3. whether adapter normalization was complete and drift-free;
4. whether evidence is sufficient to promote, hold, or block;
5. whether PR-template correctness, instruction parity, and required-check identity are enforced through one machine-legible decision path.

Without that hardening layer, expanding to more agent clients increases surface area faster than trust. The right sequencing is to harden the current control plane first, then treat provider integrations as thin adapters against that stable contract.

## Scope and Non-Goals

### In Scope

- Provider-neutral companion artifact contracts and storage layout bound to canonical run records.
- Shared runtime typing, loaders, validators, and join-integrity checks for control-plane artifacts.
- Adapter registry and identity normalization updates needed to produce provider-neutral `evaluationDecision` and `enforcementDecision`.
- Governance snapshot capture covering trusted contract, workflow, instruction, branch, and PR-template policy truth.
- Consumption of `docs-gate` parity artifacts and trusted `pr-template` workflow outcomes as governance inputs.
- Deterministic scorecard computation, false-block tracking, override/audit handling, and rollout-stage mapping.
- Command and CI integration across existing control-plane producers and consumers.
- Test coverage, rollout gates, and monitoring needed to operate the layer safely.

### Non-Goals

- New orchestration engine behavior.
- Broad provider expansion beyond the adapter seams required by the spec.
- Replacing canonical run/eval manifest/event contracts.
- Dynamic just-in-time tool assembly, context compaction, or trace-self-healing as v1 deliverables.
- Re-implementing `docs-gate` or PR-body parsing as a second parity truth source.

## Planning Inputs

### Authoritative product contract

- `docs/specs/2026-03-10-feat-provider-neutral-gold-standard-control-plane-hardening-spec.md`
- `docs/brainstorms/2026-03-10-gold-standard-control-plane-hardening-brainstorm.md`

### Existing implementation patterns to follow

- Canonical runtime contracts and emission utilities in `contracts/agent-run-manifest.schema.json`, `contracts/agent-run-event.schema.json`, `src/lib/contract/run-records.ts`, and `src/lib/contract/run-record-emitter.ts`
- Evaluation and metric plumbing in `src/commands/pilot-evaluate.ts`, `src/lib/pilot-evaluation/metrics-capture.ts`, and `contracts/agent-metric-registry.json`
- Governance-parity and trusted-source loading patterns in `src/commands/docs-gate.ts`, `src/commands/check-environment.ts`, `src/commands/review-gate.ts`, and `.github/workflows/pr-pipeline.yml`
- Contract validation and CLI registration patterns in `src/lib/contract/types.ts`, `src/lib/contract/validator.ts`, `src/lib/cli/command-registry.ts`, and `src/cli.ts`
- Downstream required-check and scaffolding emission paths in `src/lib/policy/required-checks.ts`, `src/commands/branch-protect.ts`, and `src/commands/init.ts`

### Planning guardrails that must remain true

- Canonical manifest/event files remain the runtime source of truth; control-plane artifacts are companion-only.
- `docs-gate` remains the single instruction-parity authority.
- PR-template correctness is consumed from trusted workflow evidence, not reparsed from mutable PR prose.
- Retry handling is append-only from the first landed artifact implementation; no phase is allowed to mutate or overwrite prior attempts.
- `pnpm test:deep` is a promotion/readiness validation lane layered on top of the baseline required gates, not a peer alternative to `pnpm check`.

## Implementation Phases

### Checkpoint model

Progression is hard-stop. If a checkpoint fails, stop, fix the root cause, and rerun from the first failed gate.

- **CP0:** contract crosswalk, authority lock, and additive rollout invariants confirmed.
- **CP0.5:** decision-lock checkpoint for storage, ownership, retry, and rollout semantics.
- **CP1:** companion artifact substrate and join-integrity rules complete.
- **CP2:** provider-neutral identity and adapter normalization complete.
- **CP3:** governance snapshot and trusted parity-policy ingestion complete.
- **CP4:** scorecard engine, failure precedence, and audit-backed metric math complete.
- **CP5:** command, CI, and policy integration complete.
- **CP6:** rollout windows, observability, and promotion-readiness evidence complete.

### Phase 0 - Contract crosswalk, authority lock, and additive rollout invariants

**Objective:** Map the approved spec onto existing repo seams, freeze authoritative producers/consumers, and prevent implementation drift before new artifacts are introduced.

**Tasks**

1. Build a crosswalk from spec nouns to current modules and contracts:
   - canonical substrate: `contracts/agent-run-manifest.schema.json`, `contracts/agent-run-event.schema.json`, `src/lib/contract/run-records.ts`, `src/lib/contract/run-record-emitter.ts`
   - evaluation/metrics: `src/commands/pilot-evaluate.ts`, `src/lib/pilot-evaluation/metrics-capture.ts`, `contracts/agent-metric-registry.json`
   - governance/parity: `src/commands/docs-gate.ts`, `src/commands/check-environment.ts`, `src/commands/review-gate.ts`
   - policy truth: `harness.contract.json`, `src/lib/policy/required-checks.ts`, `.github/workflows/pr-pipeline.yml`, `.github/PULL_REQUEST_TEMPLATE.md`
   - provisioning and branch protection: `src/commands/init.ts`, `src/commands/branch-protect.ts`
2. Record the additive rollout invariant:
   - canonical manifest/event readers and writers remain authoritative;
   - control-plane artifacts are companion-only;
   - existing canonical substrate behavior must remain valid while control-plane features are still in `shadow`.
3. Lock normative ownership boundaries:
   - `docs-gate` remains the only parity authority;
   - PR-template correctness comes from the trusted `pr-template` check result;
   - control-plane logic translates those inputs into promotability outcomes.
4. Capture the existing required-check identity set and freeze the names that must remain aligned across contract, workflow, branch protection, and init scaffolding.

**Deliverables**

- Crosswalk table in plan PR notes or linked implementation notes.
- Explicit additive rollout invariant and authority map.
- Frozen end-to-end required-check identity set carried across contract, workflow, branch protection, init, and governed docs:
  - `pr-template`
  - `linear-gate`
  - `risk-policy-gate`
  - `dependency-review`
  - `actions-pinning`
  - `consistency-drift-health`
  - `docs-gate`
  - `lint`
  - `typecheck`
  - `test`
  - `audit`
  - `check`
  - `memory`
  - `security-scan`
  - `Greptile Review`

**Validation Gate (CP0)**

- Crosswalk covers every spec-owned artifact family and existing producer/consumer seam.
- Additive rollout invariant is documented and accepted.
- No implementation phase depends on a second parity authority or PR-body parsing path.
- A machine-checkable evidence bundle exists for the checkpoint:
  - exact commands run,
  - artifact paths,
  - trusted source provenance when applicable,
  - blocker/follow-up notes.
- Evidence is folded into existing audit-log/report families rather than a new bundle artifact:
  - `control-plane-audit-log.jsonl` entries carry `checkpointId`, `phase`, `command`, `status`, `artifactRefs`, `sourceProvenance`, `blocker`, `followUp`, and `recordedAt`;
  - phase reports use stable names under `artifacts/control-plane/<checkpointId>/<phase>-report.json`.

### Phase 0.5 - Decision-lock checkpoint

**Objective:** Verify the contract decisions that must be settled before shared artifact and decision logic work begins.

**Tasks**

1. Lock the v1 storage model:
   - companion artifacts, not schema extension of canonical manifest/event files;
   - append-only attempt records;
   - conditional `override-policy-record.json` creation only when an override exists.
2. Lock retry semantics:
   - every retry emits a new `evaluationAttemptId`;
   - governance snapshot is recaptured when spec conditions require it;
   - audit and scorecard joins remain append-only.
3. Lock join-integrity semantics:
   - joins require matching `runId`;
   - mismatched `headSha`, manifest hash, or required join key cause reject/fail-closed behavior.
4. Lock rollout-stage contract:
   - `evaluationDecision` is computed once from evidence;
   - `enforcementDecision` is derived from rollout stage;
   - `shadow`, `advisory`, and `enforced` remain semantically distinct.

**Validation Gate (CP0.5)**

- Storage, retry, join, and rollout decisions are all explicitly linked to the approved spec.
- No unresolved ambiguity remains that would alter CP1-CP4 outputs.
- Decision verification is recorded as evidence, not left as implicit reviewer knowledge.

### Phase 1 - Companion artifact substrate and join integrity

**Objective:** Add shared contracts and storage rules for provider-neutral control-plane artifacts while preserving canonical substrate authority.

**Tasks**

1. Add or extend typed loaders/writers/validators for the spec-required artifact families:
   - `control-plane-run.json`
   - `governance-snapshot.json`
   - `instruction-parity.json`
   - `control-plane-scorecard.json`
   - `control-plane-audit-log.jsonl`
   - conditional `override-policy-record.json`
2. Define the normative storage/discovery layout, version headers, and join keys for each artifact family.
   - every companion artifact and every `control-plane-audit-log.jsonl` entry must carry:
     - `schemaVersion`
     - `compatibilityMajor`
     - `producerVersion`
     - `runId`
     - `evaluationAttemptId`
3. Implement append-only write semantics for:
   - repeated evaluation attempts;
   - audit-log entries;
   - conditional override records.
4. Implement join-integrity validation:
   - reject joins on `runId` mismatch;
   - reject joins on `evaluationAttemptId` mismatch when an attempt-scoped join is required;
   - reject joins on `headSha` mismatch;
   - reject joins on manifest-hash mismatch where required;
   - surface explicit failure reasons for operator debugging.
5. Preserve canonical substrate compatibility:
   - dual-read where needed during migration;
   - canonical manifest/event files remain unchanged as the authoritative run substrate.

**Target files (expected)**

- `src/lib/contract/types.ts`
- `src/lib/contract/loader.ts`
- `src/lib/contract/validator.ts`
- `src/lib/contract/run-records.ts`
- `src/lib/contract/run-record-emitter.ts`
- `contracts/agent-run-manifest.schema.json`
- `contracts/agent-run-event.schema.json`
- new or updated control-plane contract files under `contracts/`

**Phase outputs**

- Versioned companion artifact contracts with stable headers, exact mandatory metadata fields, and join keys.
- Loader/writer behavior that preserves append-only attempts and surfaces join failures deterministically.
- Fixture set for valid, invalid, partial-write, and mismatched-join cases.

**Validation Gate (CP1)**

- Artifact contract fixtures pass for valid, invalid, partial, and mismatched-join cases.
- Append-only attempt history is preserved across retries.
- Canonical substrate tests still pass with control-plane artifact production disabled or absent.
- Every companion artifact and every audit-log entry validates the required metadata set:
  - `schemaVersion`
  - `compatibilityMajor`
  - `producerVersion`
  - `runId`
  - `evaluationAttemptId`
- Attempt-scoped join checks fail closed for any `runId + evaluationAttemptId + headSha + manifest-hash` mismatch.
- Existing run-record tests remain green:
  - `src/lib/contract/run-records.test.ts`
  - `src/lib/contract/run-record-emitter.test.ts`
  - `src/lib/contract/loader.test.ts`
  - `src/lib/contract/validator.test.ts`

### Phase 2 - Provider-neutral identity and adapter normalization

**Objective:** Remove Codex-shaped assumptions from core decision inputs before scorecard math is introduced.

**Tasks**

1. Expand `contracts/agent-adapter-registry.json` and supporting runtime types to model:
   - `clientFamily`
   - adapter lifecycle (`active|shadow|sunset_pending|retired`)
   - parity windows
   - capability coverage
   - promotion and rollback criteria
2. Normalize `AgentIdentity` fields from provider-specific inputs:
   - `actorId`
   - `clientFamily`
   - `providerId`
   - `modelDescriptor`
   - `executionMode`
   - `operatorType`
   - `identityStatus`
   - `degradedReasons[]`
3. Isolate or retire Codex-specific assumptions from shared enforcement seams such as `src/lib/memory/branch-enforcer.ts`.
4. Implement adapter input-hardening rules:
   - strict schema mode;
   - unknown-field rejection or explicit quarantine path;
   - payload size bounds;
   - canonical source restriction for instruction lineage inputs.
5. Add compatibility shims only where required to preserve current repo behavior during `shadow`.

**Target files (expected)**

- `contracts/agent-adapter-registry.json`
- `src/lib/contract/types.ts`
- `src/lib/contract/validator.ts`
- `src/lib/memory/branch-enforcer.ts`
- provider-neutral helper modules under `src/lib/` as needed

**Phase outputs**

- Stable adapter capability and lifecycle metadata.
- Provider-neutral `AgentIdentity` normalization path with explicit degraded-mode handling.
- Quarantine or reject path for invalid provider-local input.

**Validation Gate (CP2)**

- Identity normalization is deterministic for supported provider families.
- Degraded identity paths fail closed exactly as required by the spec.
- No scorecard or command path still requires Codex-only identity assumptions.
- Test coverage includes adapter-gap, degraded-identity, and branch-enforcer compatibility cases.

### Phase 3 - Governance snapshot and trusted parity-policy ingestion

**Objective:** Capture one trusted governance snapshot per evaluation attempt and bind parity/policy truth to trusted sources.

**Tasks**

1. Implement `GovernanceSnapshot` capture covering:
   - contract refs and hashes;
   - required-check refs and workflow evidence;
   - instruction-surface refs and hashes;
   - branch policy refs;
   - PR-template policy and validation refs.
2. Support the required evaluation modes from the spec:
   - `local`
   - `pr`
   - `merge_group`
3. Consume the machine-readable `docs-gate` artifact as the only instruction-parity truth path.
4. Consume trusted `pr-template` workflow results instead of reparsing PR body content.
5. Reframe required-check handling as policy-truth ingestion:
   - use `src/lib/policy/required-checks.ts`, `harness.contract.json`, workflow data, and branch-protect emission as inputs to the snapshot;
   - do not invent a separate command contract for required checks.
6. Implement recapture rules when governance inputs drift between attempts.

**Target files (expected)**

- `src/commands/docs-gate.ts`
- `src/commands/check-environment.ts`
- `src/commands/review-gate.ts`
- `src/lib/policy/required-checks.ts`
- `src/commands/branch-protect.ts`
- `src/commands/init.ts`
- `.github/workflows/pr-pipeline.yml`
- `.github/PULL_REQUEST_TEMPLATE.md`

**Phase outputs**

- Deterministic `GovernanceSnapshot` capture for `local`, `pr`, and `merge_group`.
- Trusted parity-policy ingestion path that consumes `docs-gate` and `pr-template` outcomes without recomputation.
- Frozen required-check identity map spanning contract, workflow, branch protection, init, and governed docs.

**Validation Gate (CP3)**

- Governance snapshot capture is reproducible for `local`, `pr`, and `merge_group`.
- Missing or untrusted parity/PR-template evidence produces the required fail-closed outcomes.
- Required-check identity remains stable across contract, workflow, init, and branch protection emission.
- `local` mode is explicitly non-promotable and cannot emit merge-authoritative `promote`.
- `merge_group` evaluation must resolve the originating PR's most recent successful trusted `pr-template` result or fail closed with `block_for_evidence`.
- Test coverage includes `pr` and `merge_group` trusted `pr-template` validation handling plus required-check parity assertions across all emitting surfaces.

### Phase 4 - Scorecard engine, failure precedence, and audit-backed metrics

**Objective:** Convert normalized identity and trusted governance inputs into deterministic control-plane decisions.

**Tasks**

1. Implement `ControlPlaneScorecard` computation using spec-defined metrics, denominator guards, thresholds, and fallback rules.
2. Collapse decisions onto exactly two authoritative fields:
   - `evaluationDecision`
   - `enforcementDecision`
3. Implement deterministic failure precedence and highest-precedence reason retention.
4. Implement `falseBlockRate` using the spec formula and dedicated `control-plane-audit-log.jsonl` adjudication source.
5. Implement override policy handling:
   - authorized principals;
   - scope;
   - TTL;
   - non-overridable controls rejection;
   - conditional `override-policy-record.json` creation.
6. Ensure audit-log entries are append-only and joined to evaluation attempts without rewriting prior outcomes.

**Target files (expected)**

- `src/commands/pilot-evaluate.ts`
- `src/lib/pilot-evaluation/metrics-capture.ts`
- `src/lib/pilot-evaluation/registries.ts`
- `contracts/agent-metric-registry.json`
- control-plane artifact loaders/writers from CP1

**Phase outputs**

- Deterministic scorecard output keyed by `evaluationAttemptId`.
- Append-only audit entries in `control-plane-audit-log.jsonl`.
- Conditional override artifacts only when override policy is exercised.

**Validation Gate (CP4)**

- Metric formulas and denominator guards are reproducible from fixtures.
- Highest-precedence failure reason wins consistently.
- Audit-backed false-block adjudications change metrics only when the audit artifact exists and validates.
- Override TTL expiry and non-overridable control rejection behave exactly as spec'd.
- Test coverage includes:
  - deterministic precedence with one retained blocker reason,
  - denominator-zero `insufficient_evidence` handling,
  - one false-block maximum per run,
  - retry creates a new `evaluationAttemptId` without mutating prior attempts,
  - `telemetry_unavailable` maps to `block_for_evidence` in merge-authoritative modes and `hold` in advisory/local modes.

### Phase 5 - Command, CLI, CI, and policy integration

**Objective:** Thread the hardened control-plane outputs through existing command and governance surfaces without inventing a parallel system.

**Tasks**

1. Integrate control-plane artifact production/consumption into existing commands and command discovery:
   - `src/commands/pilot-evaluate.ts`
   - `src/commands/check-environment.ts`
   - `src/commands/observability-gate.ts`
   - `src/commands/review-gate.ts`
   - `src/commands/docs-gate.ts`
   - `src/cli.ts`
   - `src/lib/cli/command-registry.ts`
2. Ensure CI and branch governance consume the same policy-truth identity:
   - the full required-check identity set remains authoritative end to end from `harness.contract.json` and `src/lib/policy/required-checks.ts`
   - this change must preserve parity for all current identities:
     - `pr-template`
     - `linear-gate`
     - `risk-policy-gate`
     - `dependency-review`
     - `actions-pinning`
     - `consistency-drift-health`
     - `docs-gate`
     - `lint`
     - `typecheck`
     - `test`
     - `audit`
     - `check`
     - `memory`
     - `security-scan`
     - `Greptile Review`
   - `pr-template`, `docs-gate`, `risk-policy-gate`, and `Greptile Review` are the control-plane-focused identities touched most directly by this change, but the plan governs parity for the complete required-check set.
3. Update init/bootstrap paths so new repos receive the correct control-plane and governance wiring.
4. Preserve additive behavior:
   - command outputs remain usable while rollout stage is `shadow` or `advisory`;
   - canonical substrate remains authoritative if control-plane companion artifacts are absent or intentionally disabled.

**Target files (expected)**

- `src/commands/pilot-evaluate.ts`
- `src/commands/check-environment.ts`
- `src/commands/observability-gate.ts`
- `src/commands/review-gate.ts`
- `src/commands/docs-gate.ts`
- `src/lib/cli/command-registry.ts`
- `src/cli.ts`
- `src/lib/policy/required-checks.ts`
- `src/commands/branch-protect.ts`
- `src/commands/init.ts`

**Phase outputs**

- Registry/dispatch wiring that exposes control-plane behavior through existing command surfaces.
- CI and scaffolding outputs that share one required-check identity contract.
- Downstream upgrade path that can emit the same posture through `init --update`.

**Validation Gate (CP5)**

- Command registration, JSON outputs, and CI integration tests pass.
- Branch protection/init scaffolding emits the correct required-check set.
- Additive rollout invariant still holds in mixed old/new artifact states.
- Existing command and registry tests remain green:
  - `src/commands/pilot-evaluate.test.ts`
  - `src/commands/docs-gate.test.ts`
  - `src/commands/check-environment.test.ts`
  - `src/commands/review-gate.test.ts`
  - `src/commands/branch-protect.test.ts`
  - `src/lib/cli/command-registry.test.ts`
  - `src/cli-dispatch.test.ts`

### Phase 6 - Rollout windows, monitoring, and promotion readiness

**Objective:** Prove that the hardened control plane is operationally safe before merge-authoritative enforcement.

**Tasks**

1. Execute rollout in spec-defined stages:
   - `shadow`: collect artifacts, compute decisions, no merge-authoritative blocking from control-plane enforcement;
   - `advisory`: surface promotability and blocking signals to operators, still human-gated;
   - `enforced`: allow merge-authoritative control-plane enforcement.
2. Enforce explicit stage exit criteria:
   - `shadow` requires minimum sample window, parity stability, no critical drift, and `falseBlockRate <= parityWindow.maxFalseBlockRate`;
   - `advisory` requires consecutive passing windows and named approval authority;
   - `enforced` must roll back on critical drift, repeated threshold breach, or integrity failures defined by the spec.
3. Add monitoring/reporting for:
   - parity drift;
   - adapter coverage gaps;
   - identity degradation;
   - override usage;
   - false-block adjudications;
   - PR-template invalid or missing trusted validation.
4. Produce operator-facing runbooks and evidence expectations for rollout freeze, demotion, and rollback.

**Phase outputs**

- Promotion packets for `shadow -> advisory` and `advisory -> enforced`.
- Rollout metrics persistence path and schema for trend analysis.
- Explicit rollback/demotion procedure that operators can execute without inventing missing steps.

**Validation Gate (CP6)**

- Rollout evidence proves each stage exit criterion was satisfied.
- Mandatory rollback/demotion triggers are tested and documented.
- Operator-visible artifacts are sufficient to explain every block/hold/enforce outcome.
- Promotion packet contains:
  - sample size and evaluation window,
  - `falseBlockRate`,
  - unresolved drift count,
  - maintainer sign-off evidence,
  - rollback proof.

## Dependencies and Risks

### Dependencies

- Approved spec: `docs/specs/2026-03-10-feat-provider-neutral-gold-standard-control-plane-hardening-spec.md`
- Existing canonical substrate contracts and runtime libraries.
- Existing docs-gate parity work and trusted PR pipeline enforcement.
- Trusted-source loading support for both `pull_request` and `merge_group` lanes.
- Stable required-check identity across:
  - `harness.contract.json`
  - `src/lib/policy/required-checks.ts`
  - `.github/workflows/pr-pipeline.yml`
  - `src/commands/branch-protect.ts`
  - `src/commands/init.ts`

### Primary Risks

- Encoding Codex-specific assumptions too early in scorecard logic.
- Creating a second parity truth path instead of consuming `docs-gate`.
- Drifting required-check identities across contract, workflow, and bootstrap surfaces.
- Breaking canonical substrate readers/writers during additive rollout.
- Counting false blocks or overrides from non-authoritative audit sources.
- Under-specifying retry semantics and accidentally mutating prior attempt history.

### Mitigations

- Finish adapter neutralization before scorecard logic.
- Keep `docs-gate` and `pr-template` workflow evidence as authoritative inputs only.
- Add join-integrity and additive rollout invariant tests in early checkpoints.
- Freeze required-check identities before CI/bootstrap integration work.
- Treat denominator-zero and missing-audit cases as non-promotable.

## Test and Validation Strategy

### Baseline repo validation

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm audit`
- `pnpm check`
- `pnpm test:deep` after baseline gates pass when promotion-readiness or artifact-heavy behavior changed
- `pnpm build` when CLI entrypoints, packaged outputs, or distribution-facing behavior changed

Stop on first failure and rerun from the first failed gate after fixes.

### Targeted command and integration validation

- `pnpm exec tsx src/cli.ts docs-gate --mode advisory --json`
- `pnpm exec tsx src/cli.ts check-environment --json`
- `pnpm exec tsx src/cli.ts pilot-evaluate --json`
- `pnpm exec tsx src/cli.ts branch-protect --help`
- merge-authoritative fixture/workflow validation for `merge_group` trusted-base loading and originating successful `pr-template` provenance

For every validation lane, capture:

- exact command,
- status (`pass|fail|blocked`),
- artifact paths,
- blocker details when blocked,
- trusted source provenance when the lane is merge-authoritative.

### Required automated coverage additions

- Artifact loader/writer fixtures for valid, invalid, partial, retry, and mismatched-join cases.
- Deterministic failure precedence tests with highest-precedence reason retention.
- `pr_template_invalid` and missing trusted PR-template validation in both `pr` and `merge_group`.
- `falseBlockRate` rules:
  - denominator `0`
  - one false-block maximum per run
  - audit-log adjudication required before metric impact
- Stage-aware enforcement mapping:
  - `shadow` non-blocking
  - `advisory` human-gated
  - `enforced` merge-authoritative
- Degraded identity and adapter-gap fail-closed behavior.
- Override TTL expiry and non-overridable control rejection.
- Instruction-surface lifecycle semantics:
  - `generated_template` non-blocking scaffold-only behavior
  - `optional` evaluation without parity-pass credit or blocking behavior
  - `shadow_required` reporting and threshold collection before enforced rollout
  - `required` merge-authoritative parity enforcement
  - `retired` non-scaffold and non-satisfaction behavior
- Additive rollout invariant proving canonical substrate readers/writers remain authoritative when control-plane artifacts are absent, partial, or in `shadow`.

### High-signal existing tests to reuse or extend

- `src/commands/docs-gate.test.ts`
- `src/commands/branch-protect.test.ts`
- `src/commands/review-gate.test.ts`
- `src/cli-dispatch.test.ts`
- `src/lib/cli/command-registry.test.ts`
- `src/lib/contract/validator.test.ts`
- `src/lib/contract/loader.test.ts`

## Rollout / Migration / Monitoring

### Migration posture

- Additive only in v1.
- Companion artifacts are introduced beside canonical run/eval records.
- Consumers may dual-read during migration, but canonical manifest/event files remain the runtime-truth base.

### Rollout sequence

1. Land substrate and identity normalization behind non-authoritative control-plane outputs.
2. Enable `shadow` collection and compare outputs against existing operator expectations.
3. Promote to `advisory` only after `shadow` proves:
   - at least `50` eligible runs in the score window,
   - `minimumCanonicalCoverage >= 0.95`,
   - zero critical drift,
   - `falseBlockRate <= 0.02`.
4. Promote to `enforced` only after `advisory` proves:
   - at least `30` consecutive passing windows,
   - `canonicalCoverage >= 0.99`,
   - zero unresolved adapter drift,
   - zero required parity contradictions,
   - `identityCompleteness >= 0.99`,
   - `adapterCoverage >= 0.99` for active adapters and `>= 0.95` for shadow adapters,
   - `instructionParityPassRate = 1.00` for required instruction surfaces,
   - `governanceParityPassRate = 1.00`,
   - `evidenceCompleteness >= 0.99`,
   - `overrideRate <= 0.05`,
   - `telemetryCoverageGapRate <= 0.10` in merge-authoritative mode,
   - named maintainer approval recorded in audit/report evidence.

### Promotion packet requirements

Each stage transition must produce a promotion packet with:

- metrics snapshots for the evaluation window,
- category breakdowns for failures and drift sources,
- unresolved drift count,
- `falseBlockRate` calculation inputs and result,
- explicit numeric threshold results for:
  - eligible-run count,
  - canonical coverage,
  - consecutive passing windows,
  - identity completeness,
  - adapter coverage,
  - instruction parity pass rate,
  - governance parity pass rate,
  - evidence completeness,
  - override rate,
  - telemetry coverage gap rate,
- named maintainer sign-off,
- rollback proof showing the mode can be demoted cleanly.

### Monitoring expectations

| Metric / signal | Threshold | Cadence | Owner | Action when breached |
| --- | --- | --- | --- | --- |
| Artifact presence and freshness | 100% expected artifacts present for eligible runs | every PR / merge_group, daily review during rollout windows | repo maintainer | freeze promotion; investigate missing writer/loader path |
| Governance snapshot capture success rate | `1.00` in merge-authoritative lanes | every PR / merge_group | repo maintainer | `block_for_evidence`; fix trusted-source loading before continuing |
| `docs-gate` artifact availability and required parity | `1.00` for required surfaces | every PR / merge_group, daily review | repo maintainer | `block_for_parity` or demote if regression is systemic |
| Trusted `pr-template` validation availability | `1.00` in `pr` and `merge_group` | every PR / merge_group | repo maintainer | `block_for_evidence`; stop promotion window |
| Identity completeness | `>= 0.99` | every rollout window | repo maintainer | hold or demote depending on stage |
| Adapter coverage | `>= 0.99` active, `>= 0.95` shadow | every rollout window | repo maintainer | `block_for_adapter`; keep or demote adapter stage |
| False-block rate | `<= 0.02` | every rollout window | repo maintainer | hold in advisory; demote if repeated or during enforced |
| Override rate | `<= 0.05` | daily during rollout windows | repo maintainer | hold until reviewed |
| Telemetry coverage gap rate | `<= 0.10` in merge-authoritative mode | every rollout window | repo maintainer | hold or `block_for_evidence` depending on mode |
| Critical drift count | `0` | every PR / merge_group, immediate escalation | repo maintainer | immediate demotion or rollback |

### Rollback / demotion triggers

- Critical drift in governance snapshot or required-check identity.
- Repeated threshold breach in `falseBlockRate`.
- Canonical/control-plane join-integrity failures.
- Missing trusted parity or PR-template evidence in merge-authoritative modes.
- Any condition the approved spec marks as mandatory rollback from `enforced`.

### Rollback / demotion procedure

| Step | Mutation target / verification surface | Action |
| --- | --- | --- |
| 1 | `harness.contract.json` control-plane rollout mode / threshold profile fields introduced by this work | revert to the last safe stage (`advisory` or `shadow`) |
| 2 | `.github/workflows/pr-pipeline.yml` control-plane mode flags and trusted-source posture | switch workflow enforcement back to the matching safe stage |
| 3 | `src/commands/init.ts`, `src/lib/policy/required-checks.ts`, `src/commands/branch-protect.ts` | restore emitted defaults and branch-protection parity to the same safe posture |
| 4 | audit/report evidence surfaces | append demotion event to `control-plane-audit-log.jsonl` and regenerate the stage report under `artifacts/control-plane/<checkpointId>/` |
| 5 | smoke verification commands | rerun `pnpm exec tsx src/cli.ts docs-gate --mode advisory --json`, `pnpm exec tsx src/cli.ts check-environment --json`, `pnpm exec tsx src/cli.ts pilot-evaluate --json`, and required-check parity verification across contract/workflow/init/branch-protect |
| 6 | operator communication | notify contributors/operators of the temporary posture change and blocker summary |
| 7 | re-promotion guard | do not re-promote until a fresh promotion packet replaces the superseded evidence |

## Acceptance Checklist

- [x] Plan preserves the canonical run/eval substrate as the authoritative runtime base.
- [x] Provider-neutral identity and adapter normalization occur before scorecard decision logic.
- [x] Companion artifacts, retry semantics, and join-integrity rules are phased before command integration.
- [x] `docs-gate` remains the only instruction-parity authority consumed by the control plane.
- [x] PR-template correctness is enforced via trusted workflow evidence, not reparsed prose.
- [x] Required-check handling is implemented as policy-truth ingestion, not a parallel command contract.
- [x] Scorecard work collapses onto `evaluationDecision` and `enforcementDecision` only.
- [x] `falseBlockRate` depends on `control-plane-audit-log.jsonl` adjudications and honors denominator guards.
- [x] Override policy remains conditional, append-only, and fail-closed for non-overridable controls.
- [x] Rollout stages include explicit stage exit criteria, demotion triggers, and additive compatibility checks.
- [x] Test coverage proves precedence, retry, integrity, rollout, and trusted-evidence behavior.
- [x] Each checkpoint has a machine-checkable evidence bundle with commands, artifact paths, provenance, and blocker notes.
- [x] Implementation-complete evidence is explicitly separated from promotion-ready evidence.
- [x] The full required-check identity set is governed end to end across contract, workflow, init, branch protection, and governed docs.
- [x] Evidence formatting is folded into existing audit-log/report families with stable required keys and naming.

## Sources & References

- `docs/specs/2026-03-10-feat-provider-neutral-gold-standard-control-plane-hardening-spec.md`
- `docs/brainstorms/2026-03-10-gold-standard-control-plane-hardening-brainstorm.md`
- `docs/plans/2026-03-08-feat-canonical-run-eval-substrate-plan.md`
- `docs/specs/2026-03-08-feat-canonical-run-eval-substrate-spec.md`
- `docs/specs/2026-03-10-feat-docs-gate-governance-parity-spec.md`
- `docs/plans/2026-03-10-feat-docs-gate-governance-parity-plan.md`
- `docs/agents/04-validation.md`
- `docs/agents/09-audit-trail-policy.md`
- `docs/agents/10-agent-testing-gates.md`
- `docs/agents/14-docs-gate-rollout.md`
- `harness.contract.json`
- `contracts/agent-adapter-registry.json`
- `contracts/agent-metric-registry.json`
- `contracts/agent-run-manifest.schema.json`
- `contracts/agent-run-event.schema.json`
- `src/lib/contract/run-records.ts`
- `src/lib/contract/run-record-emitter.ts`
- `src/lib/pilot-evaluation/metrics-capture.ts`
- `src/lib/policy/required-checks.ts`
- `src/commands/docs-gate.ts`
- `src/commands/pilot-evaluate.ts`
- `src/commands/check-environment.ts`
- `src/commands/review-gate.ts`
- `src/commands/branch-protect.ts`
- `src/commands/init.ts`
- `.github/workflows/pr-pipeline.yml`
- `.github/PULL_REQUEST_TEMPLATE.md`

Notes:

- `docs/solutions/` is not currently present in this repo, so institutional planning guidance for this work is sourced from `docs/specs/*`, `docs/plans/*`, and `docs/agents/*`.
