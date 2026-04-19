---
title: Canonical Run/Eval Substrate for Agent-First Autonomy
type: feat
status: active
date: 2026-03-08
origin: docs/brainstorms/2026-02-25-agent-first-throughput-v1-brainstorm.md + oracle autonomy/eval review
risk: high
spec_depth: full
last_validated: 2026-04-18
---

# Canonical Run/Eval Substrate for Agent-First Autonomy

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

**Deepened on:** 2026-03-08  
**Key areas improved:** lifecycle/state machine, timeout/retry/cancel semantics, trust boundaries, degraded-mode contract, observability gates, and readiness validation.

- Added a normative run state machine and terminal path contract so all commands produce machine-legible outcomes.
- Added explicit precondition, trust, and policy-provenance requirements (including TOCTOU, authz/environment, and marker-path coherence).
- Added concrete failure taxonomy, recovery rules, and rollout readiness gates for `/prompts:workflow-plan`.

## Problem Statement
`coding-harness` has strong governance and policy surfaces, but runtime truth is fragmented across command-specific artifacts. This creates composition risk for autonomous progression because promotion, rollback, and remediation decisions are not consistently backed by one machine-legible run record.

Observed fragmentation includes:
- automation idempotency/report artifacts (`automation-idempotency/v1`, `automation-report/v1`)
- pilot evaluator artifact set (`pr-lead-time.json`, `remediation-events.jsonl`, `rollback-events.jsonl`, `incidents.jsonl`, `pending-incidents.json`)
- replay trace substrate (`.traces/<traceId>/trace.json`)

The system therefore governs well but cannot yet answer, with one canonical query, what happened in a run, whether it was safe, and whether it is promotable.

This spec strengthens runtime composition without changing core intent: preserve existing command behavior, add a canonical run/eval substrate, and make autonomy gates measurable.

## Goals
1. Define a canonical run/eval substrate that all autonomy-relevant commands can emit and consumers can trust.
2. Make outcome semantics machine-legible across success, hold, rollback, failure, and policy denial.
3. Preserve existing command capabilities while adding a shared composition layer (no big-bang rewrite).
4. Enable reliable measurement of intervention rate, rollback reliability, evidence completeness, and thrash.
5. Ensure policy and runtime outputs remain auditable and deterministic enough for replay and promotion gating.
6. Standardize timeout/retry/cancel/degraded-mode semantics as contract-level behavior, not command-local convention.

## Non-Goals
1. Building a new orchestration engine or multi-agent coordinator in this phase.
2. Replacing all existing artifact schemas immediately.
3. Expanding provider integrations or changing product scope beyond run/eval legibility.
4. Removing current safety constraints (manual-release posture, disposable workspace checks, policy gates).
5. Treating advisory docs as runtime truth when code/command behavior disagrees.

## System Boundary
### Owns
- Canonical run-level contract and event contract for harness runtime execution.
- Command emission and consumption behavior for:
  - `automation-run`
  - `remediate`
  - `pilot-evaluate`
  - `pilot-rollback`
  - `replay`
  - `search` / `context` / `index-context` degraded-mode signaling (policy/event semantics)
- Compatibility rules between legacy artifacts and canonical records.
- Promotion/rollback decision legibility requirements.
- Terminal path output guarantees (schema-valid terminal records on all exit paths).

### Does Not Own
- GitHub/Linear product policy semantics not represented in runtime records.
- Non-runtime docs quality or governance prose freshness by itself.
- External telemetry platform architecture outside repository-controlled artifacts.
- General UX improvements unrelated to autonomy/eval composition.

### Trust Boundaries
- **Process-controlled policy**: runtime safety policy that must not be overridden by untrusted repo content.
- **Repo-controlled contract content**: settings permitted for runtime consumption when explicitly allowed.
- **Operator overrides**: explicit CLI/runtime overrides that must be captured as provenance events.

## Core Domain Model
### 1) AgentRunManifest (canonical)
Stable per-run envelope.

Required fields (minimum):
- `schemaVersion`
- `runId` (stable ID)
- `command` (entry command)
- `scenarioId` (if applicable)
- `startedAt`, `finishedAt`, `durationMs`
- `repo` (`repository`, `branch`, `headSha`)
- `contract` (`path`, `hash`, `version` when available)
- `policyContext` (mode, safety posture, effective policy source)
- `outcome` (`success|hold|rollback|failed|blocked|canceled`)
- `exit` (`code`, `classification`)
- `artifactRefs[]` (typed pointers)
- `preconditions` (authz/environment/workspace snapshots where applicable)

### 2) AgentRunEvent (canonical)
Append-only structured stream per run.

Required fields (minimum):
- `schemaVersion`
- `runId`
- `eventId`
- `timestamp`
- `eventType` (`phase`, `policy_check`, `precondition`, `artifact_write`, `decision`, `retry`, `timeout`, `cancel`, `error`, `rollback`, `intervention`, `degraded_mode`)
- `status` (`started|passed|failed|skipped|blocked|completed`)
- `severity` (`info|warn|error|critical`)
- `payload` (typed by `eventType`)
- optional `correlationId` for retries/rollback chains

### 3) RunStateMachine
Canonical states for autonomy-relevant runs:
- `created`
- `preconditions_validated`
- `running`
- `decision_pending` (optional)
- terminal: `success | hold | rollback | failed | blocked | canceled`

State rules:
- Every run starts at `created` and ends in exactly one terminal state.
- Terminal state cannot transition to any other state.
- `hold` and `rollback` are distinct terminal states.
- `blocked` is reserved for policy/precondition denials.

### 4) ExitClassification
Separate machine-classification from raw numeric exit codes.

Canonical values:
- `ok`
- `policy_blocked`
- `validation_failed`
- `precondition_failed`
- `runtime_failed`
- `rollback_required`
- `manual_intervention_required`
- `canceled`

### 5) ScenarioDefinition
Registry entry used by evals/smoke.

Required fields:
- `scenarioId`
- `name`
- `category` (e.g., remediation, rollback, replay, retrieval)
- `expectedOutcomes`
- `requiredEvidenceTypes`
- `requiredPreconditions`

### 6) MetricDerivations
Derived from canonical manifests/events:
- `interventionRate`
- `rollbackReliability`
- `evidenceCompleteness`
- `thrashRate`

## Main Flow / Lifecycle
### A. Run initialization and preconditions
1. Command creates `AgentRunManifest` in `created` state.
2. Command emits `precondition` events for required checks (examples: authz, environment, workspace cleanliness, marker presence).
3. If any hard precondition fails, run transitions to `blocked` with `precondition_failed` or `policy_blocked` classification.

### B. Active execution
4. Command transitions to `running` and emits phase events.
5. Side effects (files/artifacts/policy decisions) emit `artifact_write` and `policy_check` events with provenance.
6. Retries must emit `retry` events with attempt number and reason.

### C. Decision and terminal behavior
7. For pilot/eval paths, transition to `decision_pending` before emitting explicit decision event (`promote|hold|rollback`).
8. `rollback` MUST map to `rollback_required` classification and distinct terminal state.
9. `hold` MUST map to a non-rollback classification.
10. Every canonical producer terminal path writes terminal manifest + terminal event.

### D. Timeout / cancel / degraded-mode behavior
11. Timeout must produce `timeout` event and terminal `failed` (or `canceled` if explicitly user/operator canceled); canonical producer commands must also persist a terminal manifest.
12. Cancel must produce `cancel` event and terminal `canceled`; canonical producer commands must also persist a terminal manifest.
13. Degraded retrieval mode must emit `degraded_mode` event with fallback mode and confidence constraints.
14. If no degraded path is configured, backend unavailability must fail explicitly (terminal `failed`) with actionable error payload.

### E. Consumption
15. `pilot-evaluate`, `replay`, and reporting consume canonical records first.
16. Legacy artifact ingestion is compatibility-only and must include version mapping events.

## Interfaces and Dependencies
### Internal commands
- `src/commands/automation-run.ts`
- `src/commands/remediate.ts`
- `src/commands/pilot-evaluate.ts`
- `src/commands/pilot-rollback.ts`
- `src/commands/replay.ts`
- `src/commands/context.ts`
- `src/commands/index-context.ts`
- `src/commands/search.ts` (for degraded semantic-vs-lexical behavior alignment)

### Internal libraries
- `src/lib/automation/idempotency.ts`
- `src/lib/pilot-evaluation/{types.ts,metrics-capture.ts}`
- `src/lib/remediation/{orchestrator.ts,types.ts}`
- `src/lib/replay/tracer.ts`
- `src/lib/context-compound/{constants.ts,ollama.ts}`
- `src/lib/input/{validator.ts,sanitize.ts}`
- `src/lib/contract/{loader.ts,types.ts}`

### Contracts and schemas
- Existing: `harness.contract.json`, `contracts/consistency-contract.schema.yaml`, `contracts/browser-evidence.schema.json`, `docs/benchmarks/schema/benchmark-run.schema.json`
- New (this spec):
  - `contracts/agent-run-manifest.schema.json`
  - `contracts/agent-run-event.schema.json`
  - `evals/scenarios/daily-smoke/*`

## Invariants / Safety Requirements
1. Every canonical producer run must produce exactly one canonical terminal manifest.
2. Every terminal manifest must include explicit exit classification and terminal outcome.
3. `rollback` and `hold` must be distinct machine outcomes and exit semantics.
4. Events must be append-only and immutable once written.
5. Every side-effecting command action must be representable as at least one canonical event.
6. Policy denials must never be emitted as generic runtime failures.
7. Marker-based manual-release gating must use one canonical path contract, or explicit path mapping rules.
8. Evidence completeness must be computed from canonical event/manifests, not inferred from prose.
9. Retrieval backend unavailability must emit explicit degraded-mode events when fallback is used.
10. Legacy artifact compatibility must fail closed on schema mismatch when used for promotion decisions.
11. TOCTOU-sensitive operations must record head/ancestry checks used for safety decisions.
12. All human/operator overrides must be represented in provenance events.
13. Sensitive data in events/manifests must pass output sanitization rules before persistence.

Producer scope note:
- Canonical producer runs (terminal manifest + terminal events) are:
  `automation-run`, `remediate`, `pilot-evaluate`, `pilot-rollback`, and `replay`.
- Retrieval commands (`search`, `context`, `index-context`) are event-emitting surfaces in v1-core.
  They are not required to emit terminal manifests unless explicitly promoted to producer scope in a later version.

## Failure Model and Recovery
### Failure taxonomy
1. `validation_failed` — schema/input/path violations.
2. `policy_blocked` — denied by policy constraints.
3. `precondition_failed` — required runtime precondition missing.
4. `runtime_failed` — execution/system error.
5. `rollback_required` — explicit rollback decision required.
6. `manual_intervention_required` — autonomous continuation unsafe.
7. `canceled` — explicit cancellation by operator/system.

### Recovery rules
1. **Schema incompatibility**
   - Recovery: fail run terminally, emit schema error event, write terminal manifest.

2. **Producer/consumer drift**
   - Recovery: compatibility adapter with explicit version mapping and drift event; block promotion if unresolved.

3. **Policy-gate ambiguity**
   - Recovery: require explicit exit classification even if numeric codes stay backward compatible.

4. **Rollback signaling mismatch**
   - Recovery: canonical marker path contract and explicit mapping events for overrides.

5. **Retrieval backend unavailability**
   - Recovery: degraded mode if configured; otherwise explicit terminal failure.

6. **Partial artifact writes / interruption**
   - Recovery: write terminal failed/canceled manifest with diagnostic events and partial artifact references.

7. **TOCTOU/race detected during remediation**
   - Recovery: abort safely, classify as `precondition_failed` or `runtime_failed` based on policy definition, emit race diagnostics.

### Retry rules
- Retries are allowed only for retryable classes (`runtime_failed` and selected degraded backend/network cases).
- Retries are forbidden for policy/precondition denials unless preconditions change and a new run is started.
- Retry attempts must be bounded and emitted as structured `retry` events.

## Observability
### Required emitted artifacts
- Canonical run manifest (JSON)
- Canonical run events stream (JSONL)
- Command-specific artifacts (optional/legacy) referenced from manifest

### Required metrics definitions
- `interventionRate = manual_interventions / autonomous_runs`
- `rollbackReliability = successful_rollbacks / rollback_triggers`
- `evidenceCompleteness = runs_meeting_required_evidence / total_runs`
- `thrashRate = runs_with_retry_or_rollback_oscillation / autonomous_runs`

### Metric denominator guards (normative)
- If a metric denominator is `0`, metric status is `insufficient_evidence` (not pass).
- If required minimum sample floors are not met for promotion windows, metric status is `insufficient_evidence`.
- Promotion decisions must fail closed when any required metric is `insufficient_evidence`.

### Required operator views
- Per-run timeline from events
- Outcome distribution by command and scenario
- Policy denial vs runtime failure breakdown
- Retry/timeout/cancel trend view
- Drift and compatibility warnings for legacy adapters
- Evidence completeness and freshness compliance view

### Terminal Path Contract (normative)
On every canonical producer terminal path (including errors), the system must persist:
1. schema-valid terminal manifest
2. at least one terminal event with classification
3. diagnostic payload sufficient for operator triage
4. checksums for canonical artifact files when present

### Validation command baseline (verified)
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:deep` (required when runtime/source behavior changes)
- `pnpm audit`
- `pnpm check`
- `pnpm build`

All listed commands are evidenced in `package.json` as of 2026-03-08 and are eligible for required-gate use.
Checkpoint owners must re-validate this command baseline at CP0/CP1 before checkpoint sign-off.

## Acceptance and Test Matrix
1. **Manifest completeness**
   - For each canonical producer command, terminal manifest exists and validates against canonical schema.

2. **Event stream validity**
   - JSONL event records validate and include required lifecycle events.

3. **Outcome legibility**
   - `hold` and `rollback` produce distinct machine outputs (event + classification + terminal state).

4. **Rollback composition**
   - `pilot-rollback` output is consumable by `pilot-evaluate` without manual edits.

5. **Marker-path coherence**
   - Rollback completion marker path used by rollback producer and remediate gate is coherent or explicitly mapped.

6. **Legacy compatibility path**
   - Legacy artifacts can be ingested only through versioned adapters with drift detection.

7. **Retrieval degradation behavior**
   - When semantic backend is unavailable, behavior is explicitly degraded or explicitly failed according to contract.

8. **Retry/timeout/cancel behavior**
   - Retries are bounded and observable; timeout/cancel produce canonical terminal outputs.

9. **Evidence completeness reproducibility**
   - Evidence completeness is computed from canonical artifacts and matches expected thresholds.

10. **Gate mode behavior**
    - Advisory mode remains exit-neutral for non-fatal drift; health mode fails on schema/integrity/runtime-critical faults.

11. **Readiness gates before autonomy raise**
    - Demonstrate a minimum run window where:
        - rollback composition passes
        - evidence completeness threshold is met
        - intervention/thrash metrics are computable from canonical records
    - Numeric readiness thresholds (normative):
        - `rollbackReliability >= 1.0` with `rollbackTriggerCount >= 3` (else `insufficient_evidence`)
        - `evidenceCompletenessRatio >= 0.95`
        - `minTotalSampleSize >= 100`
        - `minPerCommandScenarioSampleSize >= 10`

12. **Sample-floor readiness**
    - Promotion windows must meet minimum sample floors for total runs and per command/scenario buckets.

13. **Sanitization gate**
    - Required sanitization fixtures pass with `sensitive_field_leak_count == 0` for canonical manifests/events.

## Open Questions

### Resolved Decisions (2026-03-08)
1. **`runId` scope**: canonical `runId` is globally unique across command families and replay traces (ULID/UUID-class uniqueness), with command family represented as metadata fields (not namespacing).
2. **Retrieval fallback contract (v1 core)**:
   - `search`: may degrade to lexical unless strict semantic mode is enabled.
   - `context` / `index-context`: explicit fail behavior is required in v1 core when semantic backend is unavailable; degraded lexical parity is tracked as v1.1 expansion.
3. **Promotion-mandatory fields**: promotion decisions require, at minimum, `runId`, `command`, `startedAt`, `finishedAt`, `outcome`, `exit.classification`, `policyContext`, contract hash/provenance, evidence references, and attestation verification status.
4. **Policy/config provenance**: include both repo contract hash and effective process-controlled policy hash in canonical manifest provenance.
5. **Legacy adapter sunset criterion**: legacy command-specific artifacts can be sunset only after a parity window of at least 30 consecutive days with zero critical parity drifts, canonical coverage >= 95%, and owner sign-off.

### Remaining Open Questions
These questions are non-blocking for CP1–CP6 and default to conservative behavior until explicitly resolved via ADR.
1. Should benchmark schema (`benchmark-run`) be folded into canonical runtime manifest or remain benchmark-specific with a mapping layer?
2. How long should canonical event retention persist locally, and what pruning rules preserve auditability?

## Definition of Done
This spec is considered complete when all are true:
1. Canonical manifest/event schemas are defined and versioned under `contracts/`.
2. Target commands emit or reference canonical run artifacts with terminal outcome and exit classification.
3. Pilot rollback/evaluation composition mismatch is resolved by schema alignment or explicit adapter contract.
4. Promotion logic can distinguish `promote`, `hold`, `rollback`, `failed`, `blocked`, and `canceled` from machine-readable outputs.
5. Required metrics are derivable from canonical artifacts without relying on narrative documents.
6. Retrieval unavailability behavior is explicitly contracted (degraded mode or explicit fail behavior).
7. Retry/timeout/cancel semantics are represented in canonical event and terminal manifest outputs.
8. `/prompts:workflow-plan` can generate implementation phases from this spec without inventing core behavior.
