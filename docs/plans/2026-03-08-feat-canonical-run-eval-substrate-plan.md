---
title: "feat: Canonical Run/Eval Substrate Implementation"
type: feat
status: active
date: 2026-03-08
origin: docs/brainstorms/2026-02-25-agent-first-throughput-v1-brainstorm.md
spec: docs/specs/2026-03-08-feat-canonical-run-eval-substrate-spec.md
---

# feat: Canonical Run/Eval Substrate Implementation

## Table of Contents
- [Enhancement Summary](#enhancement-summary)
- [Overview](#overview)
- [Problem Statement / Motivation](#problem-statement--motivation)
- [Scope and Non-Goals](#scope-and-non-goals)
- [Implementation Phases](#implementation-phases)
- [Dependencies and Risks](#dependencies-and-risks)
- [Test and Validation Strategy](#test-and-validation-strategy)
- [Rollout / Migration / Monitoring](#rollout--migration--monitoring)
- [Acceptance Checklist](#acceptance-checklist)
- [Sources & References](#sources--references)

## Enhancement Summary

**Deepened on:** 2026-03-08  
**Key areas improved:** executable checkpoint realism, solo-maintainer operating profile, artifact/discovery contract, migration parity controls, and explicit v0 preflight vs v1 attestation split.

- Reframed **CP0.5** as a decision-verification checkpoint (not a re-freeze) because core decisions are already specified.
- Reworked validation and rollout gates to preserve a **fast loop** for solo maintenance and reserve heavy checks for promotion windows.
- Updated rollback/runbook semantics to match current command behavior and marked authoritative lane-freeze controls as post-substrate deliverables.

## Overview

Implement the canonical run/eval substrate defined in the spec by introducing shared run manifest/event contracts and converging producers/consumers onto one machine-legible run record.

This plan is execution-only and does not redefine product behavior beyond the linked spec. It emphasizes smallest-safe convergence from command-specific artifacts to canonical runtime truth.

## Problem Statement / Motivation

Current command surfaces (`automation-run`, `remediate`, `pilot-rollback`, `pilot-evaluate`, `replay`, retrieval commands) produce/consume divergent artifacts and decision semantics. That ambiguity weakens autonomy promotion decisions and rollback confidence.

The leverage path is phased: establish canonical schemas/writers first, migrate producers, then move consumers to canonical-first with explicit legacy adapters and fail-closed promotion gating.

## Scope and Non-Goals

### In Scope
- Add canonical contracts:
  - `contracts/agent-run-manifest.schema.json`
  - `contracts/agent-run-event.schema.json`
- Add shared runtime typing/IO utilities for canonical run records.
- Wire producer commands to emit canonical records:
  - `src/commands/automation-run.ts`
  - `src/commands/remediate.ts`
  - `src/commands/pilot-evaluate.ts`
  - `src/commands/pilot-rollback.ts`
  - `src/commands/replay.ts`
- Update consumer path to use canonical records first (while remaining a producer of its own run records):
  - `src/commands/pilot-evaluate.ts`
  - `src/lib/pilot-evaluation/metrics-capture.ts`
  - `src/lib/pilot-evaluation/types.ts`
- Resolve known composition seams:
  - rollback vs hold outcome/exit legibility
  - rollback marker path coherence
  - evaluator compatibility-adapter explicitness
- Bootstrap scenario registry for smoke/eval: `evals/scenarios/daily-smoke/`.
- Add machine-readable metric registry for CP5/CP6 gate math: `contracts/agent-metric-registry.json`.

### v1-core and v1.1 lane split
- **v1-core (blocking for initial rollout):** CP0 → CP0.5 → CP1 → CP2 → CP3 → CP4a → CP5 → CP6.
- **v1.1 (follow-on expansion):** CP4b retrieval parity (`search`, `context`, `index-context`) and broader degraded-mode harmonization.
- **Track rule:** CP4b is a v1.1 checkpoint and is not a prerequisite for CP5/CP6 core readiness unless a release explicitly scopes v1.1 retrieval parity.
- **v1.1 scope authority:** release/governance approver (or solo-mode owner) must record whether CP4b is in-scope for a release in the checkpoint evidence package.

### Non-Goals
- No orchestration engine redesign.
- No immediate removal of all legacy artifacts.
- No broad provider/integration expansion.
- No speculative multi-agent expansion before substrate metrics are stable.

## Implementation Phases

### Checkpoint model (hard-stop progression)

Progression is hard-stop **within each track**.

**Core track (blocking):**
- **CP0:** baseline, ownership, trust-boundary lock complete
- **CP0.5:** contract-freeze decisions resolved and linked
- **CP1:** canonical schemas + writer/validator substrate complete
- **CP2:** producer emission complete
- **CP3:** consumer canonical-first + outcome legibility complete
- **CP4a:** marker-path seam closure complete (v1-core)
- **CP5:** scenario registry + rollout controls complete
- **CP6:** readiness window complete and promotable

**v1.1 retrieval track (follow-on):**
- **CP4b:** retrieval seam closure complete (v1.1)

If any checkpoint fails, stop, fix root cause, and rerun from the first failed gate.

---

### Phase 0 — Baseline, ownership, and safety preconditions

**Objective:** Establish unambiguous authority and reproducible baseline behavior before schema/runtime edits.

**Tasks**
1. Define canonical ownership matrix for:
   - run manifest schema
   - run event schema
   - evaluator compatibility adapters
   - rollback marker path source-of-truth
2. Define explicit accountability per checkpoint with a solo-safe operating profile:
   - default (team mode): DRI + backup DRI + final approver
   - solo mode: single DRI/owner; approver/backup fields may be `N/A (solo-mode)` with explicit owner sign-off artifact
3. Add **Trust Boundary Matrix** (actor, authority, write/read permissions, verification duty, failure mode) for:
   - producer commands
   - evaluator/consumer commands
   - artifact storage
   - CI/verifier and human operator paths
4. Capture baseline fixtures for known seams:
   - `pilot-evaluate` rollback/hold path
   - marker-path interaction (`harness.contract.json` ↔ `pilot-rollback` ↔ `remediate`)
   - semantic-unavailable behavior across `search`, `context`, `index-context`
5. Define evidence freshness contract:
   - required fields: claim ID, UTC timestamp, HEAD SHA, command, exit code, artifact path, checksum, evidence posture ref (`preflight_only` in v0, signed attestation ref in v1)
   - machine-generated relevance-set rule (see validation section)

**Deliverables**
- Baseline fixture set and ownership/trust matrix in plan PR.
- Freshness/invalidation policy applied to all phase evidence.

**Validation Gate (CP0)**
- Baseline mismatches reproducible via tests + artifact fixtures with schema versions.
- Owner and trust matrices explicitly approved by maintainers.
- Linked spec is either `status: active` or explicitly permitted for implementation under a documented draft-freeze rule.

---

### Phase 0.5 — Contract decision verification (required before implementation)

**Objective:** Verify that already-resolved spec decisions remain authoritative before Phase 1 implementation (no re-freeze ceremony).

**Tasks**
1. Verify and link authoritative decision sources for:
   - `runId` uniqueness scope
   - retrieval fallback contract for v1 core
   - promotion-mandatory fields
   - provenance hash requirements (repo + process policy)
   - legacy adapter sunset criterion
2. Record any divergence from spec in a checkpoint note with explicit disposition (`accepted`, `deferred`, `requires-spec-update`).

**Validation Gate (CP0.5)**
- All five decisions are linked to existing spec/ADR sources and marked `verified`.
- No unresolved decision remains that can invalidate CP1–CP4a schemas.
- Any newly discovered ambiguity is explicitly marked blocking/non-blocking with an interim default.

---

### Phase 1 — Canonical contract substrate (schema + shared library)

**Objective:** Land canonical schema/writer substrate without breaking existing command behavior.

**Tasks**
1. Add canonical schemas:
   - `contracts/agent-run-manifest.schema.json`
   - `contracts/agent-run-event.schema.json`
2. Add shared writer/validator utilities with:
   - schema validation
   - safe path handling
   - checksum support
   - per-event hash-chain support (`prevEventHash` continuity)
3. Add normative canonical artifact storage/discovery contract:
   - root path and per-run directory layout
   - manifest/event canonical filenames
   - temp-write + atomic-rename semantics
   - consumer discovery order precedence
4. Implement migration-first approach:
   - normalize payload generation and atomic writes first
   - strict schema rejection and fail-closed promotion checks second
5. Add contract fixtures for valid/invalid/partial-write cases.
6. Add sanitization test fixtures (allow/deny) for manifests/events to prevent secret/PII persistence.

**Target files (expected)**
- `contracts/agent-run-manifest.schema.json` (new)
- `contracts/agent-run-event.schema.json` (new)
- `src/lib/contract/types.ts`
- `src/lib/contract/loader.ts`
- new tests under `src/lib/contract/*.test.ts`

**Validation Gate (CP1)**
- All schema fixtures pass.
- Invalid and partial-write fixtures fail closed.
- Append-only event behavior and hash-chain continuity verified when appending to pre-existing log files.
- Artifact discovery contract tests pass (path, naming, precedence, atomicity).
- `sensitive_field_leak_count == 0` across required sanitization fixtures.
- Global `runId` uniqueness/collision suite passes across command families, retries, and replay paths.
- Canonical provenance contract suite verifies both `repoContractHash` and `processPolicyHash` are present and schema-valid on all terminal manifests.

---

### Phase 2 — Producer emission wiring

**Objective:** Emit canonical manifests/events from run-producing commands.

**Tasks**
1. Add canonical emission to:
   - `automation-run`
   - `remediate`
   - `pilot-evaluate` (evaluation-run terminal manifest/event output)
   - `pilot-rollback`
   - `replay`
   - note: retrieval commands (`search`, `context`, `index-context`) remain canonical event-emitting surfaces in v1-core (not terminal-manifest producers); v1-core behavior is frozen and validated in CP4a, while CP4b is v1.1 parity expansion only.
2. Enforce terminal-path contract on all paths:
   - success
   - policy blocked
   - precondition failed
   - runtime failed
   - canceled/timeout
3. Emit structured retry/timeout/cancel/degraded-mode events where applicable.
4. Enforce retry legality:
   - no in-run retry for `policy_blocked` or `precondition_failed`
   - retries after precondition change require new `runId`
5. Require TOCTOU-sensitive provenance in canonical records (`headSha` + ancestry check data) when safety decisions depend on repo state.
6. Preserve legacy artifacts but reference them via canonical `artifactRefs`.

**Target files (expected)**
- `src/commands/automation-run.ts`
- `src/commands/remediate.ts`
- `src/commands/pilot-evaluate.ts`
- `src/commands/pilot-rollback.ts`
- `src/commands/replay.ts`
- `src/lib/automation/idempotency.ts`
- `src/lib/replay/tracer.ts`

**Validation Gate (CP2)**
- Per-command terminal-path matrix passes for required outcomes/classifications.
- Every producer run writes exactly one terminal manifest and **at least one** terminal event with canonical classification.
- Terminal artifacts include required diagnostic payload and checksum fields.
- `missing_terminal_manifest_count == 0` over 20 consecutive scenario runs.
- `toctou_provenance_missing_count == 0` for TOCTOU-sensitive paths.
- `illegal_retry_count == 0` for `policy_blocked`/`precondition_failed` runs.
- Retrieval commands (`search`, `context`, `index-context`) are excluded from CP2 producer-manifest gates; their semantic-unavailable event contract is validated in CP4a.

---

### Phase 3 — Consumer convergence and decision legibility

**Objective:** Replace throughput-v1 evaluator assumptions with canonical-first evaluation logic and fix outcome legibility seams.

**Tasks**
1. Update `pilot-evaluate` to consume canonical records first, then versioned legacy adapters.
2. Resolve rollback/hold semantics end-to-end:
   - distinct terminal outcomes
   - distinct classification
   - distinct exit behavior (no rollback collapse into hold path)
3. Align rollback event ingestion contract end-to-end:
   - `pilot-rollback` emitted event shape must match evaluator-required schema, or
   - an explicit versioned adapter must exist and emit drift events on mismatch.
4. Add explicit adapter drift events and fail-closed promotion behavior on unresolved drift.
5. Add evidence freshness gating and attestation verification before promotion decisions.
6. Define preflight evidence artifact lifecycle and signer/verifier upgrade gate:
   - issuer/authority
   - preflight artifact emission timing
   - signer/verifier command/checkpoint owner
   - key-rotation owner + failure classes
   - command templates:
     - preflight artifact emit (promotion/checkpoint evidence only; not required for everyday fast-loop iteration): `pnpm exec tsx src/cli.ts check-environment --contract harness.contract.json --attestation <attestationPath> --json`
     - promotion verifier (post-CP3 migration only): `pnpm exec tsx src/cli.ts pilot-evaluate --artifacts <artifactsDir> --json`
       - note: `--contract` is currently accepted by CLI wiring but non-functional in `pilot-evaluate` until contract-driven evaluator configuration lands.
   - expected outputs:
     - preflight artifact path
     - plan-level evidence classification: `preflight_only` until signer/verifier is implemented (emitted via `check-environment` checkpoint `evidenceReference`)
     - verifier outcome (`pass|fail`) only after canonical evaluator migration includes required predicates
   - current-state constraint:
     - `check-environment --attestation` evidence remains non-authoritative until attestation write failures are fail-closed (non-path write failures must not be silently ignored for checkpoint evidence use).
7. Deliver evaluator-v2 readiness contract as a CP3 blocking output:
   - replace repo-level sample adequacy outputs with machine-readable per-command/per-scenario/per-outcome sample-floor outputs required by CP5/CP6 gates
   - add metric fields: `interventionRate`, `thrashRate`, `rollbackTriggerCount`
   - add fail-closed denominator semantics (`insufficient_evidence`)
   - add machine-distinct rollback vs hold exit behavior in evaluator output/exit mapping
8. Land metric registry ownership + enforcement wiring:
   - create/update `contracts/agent-metric-registry.json`
   - ensure CP5/CP6 gates read metric definitions from this registry (not prose-only values).

**Target files (expected)**
- `src/commands/pilot-evaluate.ts`
- `src/commands/check-environment.ts`
- `src/lib/pilot-evaluation/metrics-capture.ts`
- `src/lib/pilot-evaluation/types.ts`
- `contracts/agent-metric-registry.json`

**Validation Gate (CP3)**
- Rollback path is machine-distinct from hold path (outcome + classification + exit behavior).
- Canonical-first ingestion succeeds; legacy path requires explicit mapping metadata.
- Rollback event ingestion compatibility is test-proven (`pilot-rollback` output schema-compatible or adapter-backed with drift events).
- Canonical evaluator metric contract is upgraded for CP5/CP6 readiness use (includes `interventionRate`, `thrashRate`, `rollbackTriggerCount`, and fail-closed denominator semantics with explicit `insufficient_evidence` status).
- Evaluator readiness outputs expose machine-readable per-command/per-scenario/per-outcome sample-floor adequacy (not repo-only sample buckets).
- `unresolved_adapter_drift_count == 0` for promotion-evaluated runs.
- Preflight artifact lifecycle checks are test-proven, and signer/verifier upgrade requirements are explicitly gated before promotion use.
- `check-environment --attestation` write-path behavior is fail-closed before checkpoint evidence packages may rely on that artifact.
- Metric registry file exists, is machine-validated, and is referenced as the authoritative source for CP5/CP6 gate thresholds and window math.
- Promotion path blocks on stale evidence, preflight artifact write failures, attestation failures, unresolved schema/adapter drift, or insufficient-evidence denominator failures.

---

### Phase 4a — Composition seam closure (marker-path, v1-core)

**Objective:** Close marker-path seam required for v1-core trust.

**Tasks**
1. Resolve marker-path coherence:
   - declare canonical source-of-truth path
   - add explicit mapping behavior for legacy/default path divergence
   - verify parity between `pilot-rollback` producer and `remediate` gate consumer
2. Add rollback transaction safety semantics:
   - idempotency key
   - two-phase rollback state
   - post-rollback invariant verification
   - forced manual safe mode on rollback verification failure
3. Freeze and verify v1-core retrieval contract behavior:
   - `search` mode-aware behavior when semantic backend unavailable (degraded in default mode, strict fail when strict semantic mode enabled)
   - `context` explicit fail when semantic backend unavailable
   - `index-context` explicit fail when semantic backend unavailable
   - canonical degraded/fail retrieval events are emitted for semantic-unavailable paths (required in v1-core)

**Target files (expected)**
- `src/commands/pilot-rollback.ts`
- `src/commands/remediate.ts`
- `src/commands/search.ts`
- `src/commands/context.ts`
- `src/commands/index-context.ts`
- `src/lib/context-compound/ollama.ts`
- `src/lib/context-compound/constants.ts`

**Validation Gate (CP4a)**
- Marker-path parity tests pass.
- `marker_path_mismatch_count == 0` over 20 consecutive scenario runs.
- Rollback transaction safety tests pass, including partial rollback detection and forced manual safe mode.
- Required rollback invariant suite outputs (ID-tagged checks) attached for drill and incident runs.
- v1-core retrieval contract is verified: `search` mode-aware semantic-unavailable behavior passes tests.
- v1-core retrieval contract is verified: `context` and `index-context` explicit-fail behavior passes semantic-unavailable tests.
- v1-core retrieval contract is verified: canonical degraded/fail retrieval events are emitted with required fields for semantic-unavailable paths.

---

### Phase 4b — Retrieval seam closure (v1.1)

**Objective:** Harmonize retrieval degraded/fail behavior after v1-core completion.

**Entry condition**
- CP4a must pass.

**Tasks**
1. Define and implement retrieval behavior matrix for semantic backend unavailability:
   - `search`: degraded/strict behavior according to mode
   - `context`: degraded lexical parity behavior (v1.1 enhancement)
   - `index-context`: degraded lexical parity behavior (v1.1 enhancement)
2. Expand retrieval event metadata (v1.1) with richer fallback metadata and confidence constraints beyond v1-core required fields.

**Target files (expected)**
- `src/commands/search.ts`
- `src/commands/context.ts`
- `src/commands/index-context.ts`
- `src/lib/context-compound/ollama.ts`
- `src/lib/context-compound/constants.ts`

**Validation Gate (CP4b)**
- Retrieval behavior matrix tests pass across all three commands.
- v1.1 metadata enrichment is present for degraded and explicit-fail retrieval events.
- `retrieval_parity_failure_count == 0` over 10 consecutive retrieval scenarios.

---

### Phase 5 — Scenario registry + rollout controls

**Objective:** Operationalize substrate with scenario coverage and lane-based rollout controls.

**Entry condition**
- CP3 canonical evaluator migration is complete and is the only authoritative evaluator for rollout/promotion decisions.
- Canonical evaluator metric schema includes CP6 core metrics and fail-closed denominator semantics.
- Legacy evaluator outputs are advisory only and cannot satisfy CP5/CP6 gates.

**Tasks**
1. Create `evals/scenarios/daily-smoke/` registry and metadata.
2. Add smoke scenarios with explicit mandatory/optional split:
   - **mandatory (v1-core):**
     - producer emission
     - consumer ingestion and decisioning
     - rollback marker flow
     - replay consumption
     - v1-core retrieval behavior contract (`search` mode-aware degraded/strict semantics; `context`/`index-context` explicit fail under semantic-unavailable)
   - **optional (only when CP4b is enabled in scope evidence):**
     - retrieval lexical parity behavior
3. Implement lane controls:
   - **advisory lane**: exit-neutral for drift-only findings, artifact-producing
   - **health lane**: blocking on schema/runtime/integrity failures
4. Add kill-switch and manual safe mode for adapter/evaluator critical failures.
5. Add adapter registry + sunset policy fields:
   - `owner`
   - `introducedAt`
   - `sunsetBy` (date or measurable condition)
   - `blockAfter`
6. Add non-bypass policy: advisory outputs cannot be used for promotion/release decisions.
7. Define lane/checkpoint command universes for sampling math:
   - CP5 sampling floors evaluate only commands checkpointed as in-scope through CP4a.
   - CP4b command buckets are excluded from CP5 promotion-readiness denominators unless CP4b is explicitly enabled for that lane.

**Validation Gate (CP5)**
- Scenario runs produce canonical artifacts with pass rate >= 99% across last 100 runs.
- Minimum sampling floors are met with normative values:
  - `minTotalSampleSize >= 100`
  - `minPerCommandScenarioSampleSize >= 10`
  - `minPerTerminalOutcomeBucketSampleSize >= 5`
- Per-command and per-terminal-outcome pass-rate thresholds are enforced with normative floor `>= 0.95` (no bucket may fall below configured floor).
- Advisory/health lane behavior deterministic and test-backed.
- Kill-switch and manual safe mode test-proven.
- Adapter registry entries complete for 100% of active adapters.
- Adapter `blockAfter` enforcement is test-proven (usage after cutoff hard-fails in health lane).
- Sampling-floor denominator contract is test-proven for checkpoint/lane-scoped command universes (no out-of-scope bucket inclusion).

---

### Phase 6 — Hardening and promotion-readiness window

**Objective:** Prove safe autonomy progression using canonical evidence and canonical evaluator semantics only.

**Tasks**
1. Run readiness window using canonical artifacts as sole truth input.
2. Evaluate core metrics:
   - intervention rate
   - rollback reliability
   - evidence completeness
   - thrash rate
3. Use evaluator baseline thresholds as minimum floor:
   - `rollbackReliability >= 1.0`
   - `rollbackTriggerCount >= 3` (otherwise status is `insufficient_evidence` and promotion remains blocked)
   - `evidenceCompletenessRatio >= 0.95`
   - `minTotalSampleSize >= 100` (CP5-qualified window)
   - `minPerCommandScenarioSampleSize >= 10`
   - `interventionRate` and `thrashRate` are tracked as required indicators in CP6, but remain non-blocking until explicit blocking thresholds are approved in a CP6 addendum/ADR.
4. Enforce rollback-to-manual and re-enable criteria as machine-checked predicates.
5. Execute rollback drills (see rollout section) and attach evidence.

**Validation Gate (CP6)**
- Spec acceptance criteria demonstrated via canonical records.
- Readiness decision and sign-off reproducible from artifacts without narrative-only evidence.
- Promotion lane entry requires 3 consecutive health-lane windows (rolling 24h windows) with zero unresolved critical drift.
- CP6 promotion decisions must be generated by canonical evaluator outputs; legacy evaluator outputs are non-authoritative.

## Dependencies and Risks

### Dependencies
- Schema contract compatibility with current contract loader/types.
- Command owner coordination across producer and consumer surfaces.
- Test fixture updates for output expectations.
- CI support for smoke scenarios and artifact retention.
- Maintainer decisions on adapter ownership/sunset policy and attestation verifier ownership.
- `check-environment` dependency checks (`python3`, `uv`, `ralph`) are required only in phases that consume preflight posture artifacts; they are not universal fast-loop prerequisites.

### Key Risks and Mitigations
1. **Rollback/hold ambiguity regressions**
   - Mitigation: explicit CP3 gate with exit/classification parity tests.
2. **Marker-path drift between producer/consumer**
   - Mitigation: CP4a parity tests + canonical path authority + migration mapping.
3. **Long-lived adapter drift (mixed-mode ambiguity)**
   - Mitigation: adapter registry fields + sunset enforcement + CP5 completion checks.
4. **Retrieval behavior divergence across commands**
   - Mitigation: CP4b behavior matrix tests + canonical degraded/fail events.
5. **Stale evidence used for promotion decisions**
   - Mitigation: machine-generated relevance sets + invalidation checks + evidence posture verification (v0 preflight status, v1 signed attestation verification).
6. **Artifact tampering risk**
   - Mitigation (staged):
     - v0: unsigned preflight posture artifact with checksum + freshness enforcement (informative, non-signature semantics)
     - v1: signed attestations + verifier checks + key rotation policy (promotion-blocking once implemented)
7. **Operational noise during rollout**
   - Mitigation: advisory-first lane and measurable promotion criteria before health enforcement.

## Test and Validation Strategy

### Validation order (required)

Use the **smallest gate needed** by lane.

This validation-lane model is rollout/checkpoint workflow guidance layered on top of repository baseline validation policy (`docs/agents/04-validation.md`, `docs/agents/10-agent-testing-gates.md`), not a replacement for those baseline docs.

0. **Targeted-only local iteration (lowest-cost path)**
   - allowed for edit/debug loops before checkpoint evidence collection
   - run targeted module tests only
   - allowed through CP0–CP2 local development work; not sufficient for checkpoint sign-off

1. **Fast loop (default for local iteration once a checkpoint-ready candidate exists)**
   - targeted module tests for changed surfaces
   - default aggregate gate: `pnpm check`
   - escalate to `pnpm test:deep` when artifact/runtime behavior changes and deep artifact checks are required (`pnpm test:deep` includes `pnpm check` + artifact verification)
   - prerequisite for `pnpm test:deep`: environment provides `jq` and `rg` (or run in CI image that provides both)
2. **Promotion gate (checkpoint evidence only)**
   - `pnpm test:deep` (if not already run in fast loop)
   - `pnpm build` only when distribution/entrypoint/package outputs changed
3. **Do not duplicate aggregate gates**
   - targeted-only loops should be preferred until a checkpoint candidate is ready.
   - once checkpoint evidence capture starts, follow lane rules without mixing targeted-only claims with promotion assertions.
   - avoid running `lint`/`typecheck`/`test`/`audit` separately after `pnpm check` or `pnpm test:deep` unless debugging a specific failure path.
4. **Promotion/release assertions require checkpoint evidence gates**
   - no CP3+ readiness claim may rely only on targeted-only test runs.

### Test layers
1. **Schema/contract tests**
   - manifest/event schema validity, required-field invariants, version checks.
2. **Producer terminal-path tests**
   - success/policy/precondition/runtime/cancel paths emit one terminal manifest + >=1 terminal event.
   - terminal diagnostics and checksums are required for promotion-eligible artifacts.
   - no in-run retries for `policy_blocked`/`precondition_failed` paths.
3. **Consumer/adapter tests**
   - canonical-first ingestion, explicit adapter mapping, drift-event emission.
4. **Failure-injection tests**
   - interrupted writes, partial artifacts, append behavior in event streams, and TOCTOU provenance checks.
5. **Seam parity tests**
   - rollback marker path coherence and retrieval behavior matrix parity.
6. **Scenario smoke tests**
   - registry-driven end-to-end coverage for canonical composition.

### Gate discipline
- Stop at first required gate failure.
- Fix root cause.
- Rerun from first failed gate.
- Do not promote phases with stale, superseded, or evidence-posture-invalid artifacts.

### Evidence requirements per phase
Each claim must include: claim ID, UTC timestamp, HEAD SHA, command, exit code, artifact path, checksum, and evidence posture reference.

Evidence posture reference semantics:
- v0 (current): unsigned preflight artifact reference (`preflight_only` lifecycle status)
- v1 (future): signed attestation reference with verifier outcome

Evidence becomes invalid when:
- machine-generated relevance set changes after evidence capture,
- artifact checksums or event-chain continuity no longer match,
- v1-only: attestation signature verification fails,
- referenced run artifacts are missing.

### Relevance-set contract (machine-generated)
The relevance set is generated per checkpoint from:
- changed files in target scope,
- dependency expansion (config/lockfile/contract/spec links),
- policy and runtime control files.

If relevance set differs between capture and decision, checkpoint evidence is stale and must be re-collected.

## Rollout / Migration / Monitoring

### Rollout lanes
1. **Advisory lane (initial):**
   - emits artifacts and diagnostics,
   - exit-neutral for drift-only findings,
   - not eligible for promotion/release decisions,
   - auto-escalates to health blocking when `critical_drift_count >= 2` in any rolling 24h window.
2. **Health lane (promotion):**
   - blocks on unresolved schema drift, missing terminal artifacts, integrity violations, adapter ambiguity.
3. **Promotion-readiness lane:**
   - requires CP6 evidence and maintainer sign-off.

### Solo-maintainer operating profile

When repository operation is single-owner, apply these defaults unless explicitly overridden:
- one owner acts as DRI/approver with explicit sign-off artifacts (`owner_signoff`), no synthetic backup role required,
- approval/escalation wording maps to owner actions (not multi-party routing),
- promotion evidence still requires machine-checkable artifacts; role simplification does not relax technical gates,
- optional governance fields (`backupDRI`, `secondaryApprover`) may be `N/A (solo-mode)`.

### Migration strategy
- Keep legacy artifacts while canonical coverage reaches checkpoint criteria.
- Require explicit version-mapping adapters for legacy consumption.
- Enforce a **dual-read parity window** before legacy retirement:
  - outcome parity: 100%
  - classification parity: 100%
  - artifactRef completeness parity: >= 99%
  - no critical parity drift events for 30 consecutive days
  - minimum sample floors met for every command/scenario/outcome bucket (no undersampled retirements)

### Rollback and re-enable controls
- **Rollback-to-manual triggers:** unresolved critical integrity drift, failed rollback reliability floor, missing terminal-path guarantees, or attestation failures.
- **Re-enable requirements:** trigger cause fixed, relevant checkpoint rerun passed, fresh evidence regenerated, rollback invariants verified.
- **Marker-path authority:** manual-release gating uses `pilotRollbackPolicy.completionMarkerPath` from `harness.contract.json` unless `remediate --completion-marker` explicitly overrides it.
- **Current-state seam (must be handled explicitly):** `pilot-rollback` default marker output path may diverge from the contract authority path; until code alignment lands, runbook commands must write marker artifacts to the contract-authoritative path (or `remediate` must be invoked with an explicit matching override).

### Go/No-Go + rollback runbook (required)

#### A) Current executable runbook (pre-authoritative lane state)

Use this flow until authoritative mode/lane-freeze controls are implemented.

1. **Containment signal:** emit rollback signal artifacts and record incident metadata.
   - command template: `pnpm exec tsx src/cli.ts pilot-rollback --mode manual --incident-id <incidentId> --reason "<reason>" --artifacts <artifactDir> --output <contractCompletionMarkerPath> --json`
   - note: in current command behavior, `--output` writes the rollback marker JSON (not the rollback events stream).
   - pass predicate: `rollback-events.jsonl` exists, marker exists at `<contractCompletionMarkerPath>`, and incident metadata is captured.
2. **Manual safety enforcement (operator/governance):** enforce promotion freeze + manual mode in governance controls (outside current rollback command authority).
   - pass predicate: promotion actions are blocked by policy until recovery evidence is accepted.
   - required manual evidence artifact (until authoritative lane-state controls land): attach `manual-freeze-evidence.json` with owner identity, timestamp, freeze scope, and validation of blocked promotion actions.
3. **Verification loop:** run smallest required validation lane checks and attach outputs.
   - fast-loop minimum: targeted tests + (`pnpm check` or `pnpm test:deep`)
   - promotion checkpoint: `pnpm test:deep` + conditional `pnpm build` when required
4. **Evaluator check (authoritative only after CP3 migration):**
   - command template: `pnpm exec tsx src/cli.ts pilot-evaluate --artifacts <artifactDir> --json`
   - prerequisite: `<artifactDir>` contains a full pilot evaluation bundle (not rollback artifacts alone).
   - pre-CP3 behavior: advisory only (cannot drive promotion/re-enable).
5. **Re-enable decision:** only after trigger cause is fixed and fresh evidence is regenerated.
   - in solo mode, owner sign-off artifact is sufficient; in team mode, named approver sign-off is required.

#### B) Post-substrate authoritative runbook (post-CP3 + CP4a + lane-state controls)

After authoritative lane-freeze/mode-state controls are implemented, this runbook becomes machine-enforceable:
- containment step must set authoritative manual mode and freeze promotion lane,
- rollback/re-enable predicates must be evaluator-checked from canonical artifacts,
- re-enable evidence must include owner/approver identity, timestamp, and regenerated fresh artifacts,
- manual-release marker authority must use `pilotRollbackPolicy.completionMarkerPath` (unless explicit override is provided).

### Rollback drill runbook (required)
- cadence:
  - solo mode: per release boundary and after any rollback-path change
  - team mode: weekly during rollout phases CP4a–CP6
- owner:
  - solo mode: single owner
  - team mode: release/governance owner on rotation
- scenarios: adapter failure, marker mismatch, partial rollback, stale evidence rejection
- target restore time: <= 30 minutes to stable manual mode
- drill pass/fail: required rollback artifacts generated, invariants pass when available, manual-safe fallback engages when expected

### Monitoring and operational checks
- Per-run timeline from canonical events.
- Outcome distribution by command/scenario.
- Rollback trigger/success tracking + marker-path integrity.
- Evidence freshness compliance dashboard/report.
- Thrash/retry oscillation detection from canonical events only.

### Metric registry (authoritative source)

Create and maintain one machine-readable metric registry (`contracts/agent-metric-registry.json`) with, for every rollout metric:
- metric name
- numerator definition
- denominator definition
- artifact/event source path
- window rule (size + rolling/fixed semantics)
- blocking policy (`blocking`, `non_blocking`, `advisory_only`)
- owner + last-updated checkpoint

Ownership/enforcement:
- initially landed as a CP3 blocking deliverable,
- validated in CP3 gate,
- treated as authoritative for CP5/CP6 readiness math.

CP5/CP6 gates must reference this registry directly; prose-only metric definitions are non-authoritative.

### Alert thresholds and escalation
- `missing_terminal_manifest_count > 0` in any 1h window → block health lane.
- `unresolved_adapter_drift_count > 0` in any promotion window → block promotion.
- `evidence_freshness_compliance < 100%` in health lane window → block promotion.
- `rollback_reliability < 1.0` in readiness window with `rollbackTriggerCount >= 3` → rollback-to-manual trigger.
- `critical_drift_count >= 2` in rolling 24h window → auto-containment (manual-safe mode + promotion freeze).
- Escalation path:
  - solo mode: owner → manual-mode enforcement
  - team mode: owner on-call → release/governance approver → manual-mode enforcement
- Override governance:
  - solo mode: owner override with explicit reason artifact + expiration <= 24h
  - team mode: named approver override + expiration <= 24h + explicit reason artifact.

## Acceptance Checklist

- [x] Enhancement summary and checkpoint model (including CP0.5, CP4a/CP4b) are documented.
- [x] Canonical manifest and event schemas are added and versioned.
- [x] Shared canonical run-record IO/types are implemented and tested.
- [x] Canonical artifact storage/discovery contract is documented and test-proven.
- [x] `automation-run`, `remediate`, `pilot-evaluate`, `pilot-rollback`, and `replay` emit canonical terminal artifacts.
- [x] `pilot-evaluate` is canonical-first as a consumer, preserves explicit legacy adapter mapping, and exposes CP6 metric/denominator semantics.
- [x] Rollback and hold outcomes are machine-distinct (state, classification, exit behavior).
- [x] Rollback marker path is coherent across contract, producer, and consumer gate (including default-path behavior).
- [x] v1-core retrieval behavior contract is explicit and test-proven (`search` mode-aware degraded/strict semantics; `context`/`index-context` explicit fail on semantic-unavailable).
- [x] CP4b lexical retrieval parity expansion is explicit and test-proven when CP4b is enabled for the lane.
- [x] Failure-injection tests prove terminal-path and append/hash-chain guarantees.
- [x] Scenario registry (`evals/scenarios/daily-smoke/`) exists with core coverage.
- [x] Advisory/health lane behavior and kill-switch safe mode are test-proven.
- [x] Adapter registry fields (`owner`, `introducedAt`, `sunsetBy`, `blockAfter`) are complete.
- [x] Dual-read parity window passes required thresholds before legacy retirement.
- [x] RunId uniqueness/collision and dual provenance hash gates pass (`repoContractHash` + `processPolicyHash` required on terminal manifests).
- [x] Metrics (`interventionRate`, `rollbackReliability`, `evidenceCompleteness`, `thrashRate`) are computed from canonical artifacts.
- [x] Metric definitions used by CP5/CP6 gates are sourced from a machine-readable metric registry (no prose-only gate math).
- [x] Rollback reliability denominator guard is enforced (`rollbackTriggerCount >= 3` or promotion blocked as insufficient evidence).
- [x] Sanitization gate passes with `sensitive_field_leak_count == 0`.
- [ ] Validation baseline commands pass with fresh evidence posture references attached to checkpoints (`preflight_only` in v0; signed verifier evidence when v1 attestation is enabled).
  Current blocker: fresh `check-environment --attestation` evidence now includes `evidenceReference`, but the local baseline still fails until approval posture is set for mutative runs and `uv` resolves to the pinned `0.9.5` runtime.

## Sources & References

- Plan (enhanced):
  - `/Users/jamiecraik/dev/coding-harness/docs/plans/2026-03-08-feat-canonical-run-eval-substrate-plan.md`
- Spec (authoritative):
  - `/Users/jamiecraik/dev/coding-harness/docs/specs/2026-03-08-feat-canonical-run-eval-substrate-spec.md`
- Origin brainstorm:
  - `/Users/jamiecraik/dev/coding-harness/docs/brainstorms/2026-02-25-agent-first-throughput-v1-brainstorm.md`
- Core command/lib surfaces:
  - `/Users/jamiecraik/dev/coding-harness/src/commands/automation-run.ts`
  - `/Users/jamiecraik/dev/coding-harness/src/commands/remediate.ts`
  - `/Users/jamiecraik/dev/coding-harness/src/commands/pilot-evaluate.ts`
  - `/Users/jamiecraik/dev/coding-harness/src/commands/pilot-rollback.ts`
  - `/Users/jamiecraik/dev/coding-harness/src/commands/replay.ts`
  - `/Users/jamiecraik/dev/coding-harness/src/commands/search.ts`
  - `/Users/jamiecraik/dev/coding-harness/src/commands/context.ts`
  - `/Users/jamiecraik/dev/coding-harness/src/commands/index-context.ts`
  - `/Users/jamiecraik/dev/coding-harness/src/lib/automation/idempotency.ts`
  - `/Users/jamiecraik/dev/coding-harness/src/lib/pilot-evaluation/types.ts`
  - `/Users/jamiecraik/dev/coding-harness/src/lib/pilot-evaluation/metrics-capture.ts`
  - `/Users/jamiecraik/dev/coding-harness/src/lib/replay/tracer.ts`
  - `/Users/jamiecraik/dev/coding-harness/src/lib/context-compound/ollama.ts`
- Governance and prior-plan learnings:
  - `/Users/jamiecraik/dev/coding-harness/docs/agents/04-validation.md`
  - `/Users/jamiecraik/dev/coding-harness/docs/agents/06-security-and-governance.md`
  - `/Users/jamiecraik/dev/coding-harness/docs/agents/08-release-and-change-control.md`
  - `/Users/jamiecraik/dev/coding-harness/docs/agents/09-audit-trail-policy.md`
  - `/Users/jamiecraik/dev/coding-harness/docs/agents/10-agent-testing-gates.md`
  - `/Users/jamiecraik/dev/coding-harness/docs/plans/2026-03-05-feat-consistency-contract-advisory-drift-gate-plan.md`
  - `/Users/jamiecraik/dev/coding-harness/docs/plans/2026-02-24-refactor-contract-surface-runtime-parity-plan.md`
  - `/Users/jamiecraik/dev/coding-harness/docs/plans/2026-02-24-feat-deterministic-remediation-gap-loop-plan.md`
  - `/Users/jamiecraik/dev/coding-harness/docs/plans/2026-02-25-feat-agent-first-throughput-v1-pilot-plan.md`
- Validation command source:
  - `/Users/jamiecraik/dev/coding-harness/package.json`
