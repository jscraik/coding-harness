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
**Key areas improved:** contract freeze gating, executable checkpoints, artifact/discovery contract, migration parity controls, attestation/integrity controls, and v1-core vs v1.1 lane split.

- Added **CP0.5 Contract Freeze** to resolve spec-blocking decisions before schema implementation.
- Converted CP2–CP5 from qualitative checks to **numeric/boolean go/no-go predicates**.
- Added **tamper-evident evidence controls**, machine-generated relevance-set invalidation, and rollback drill/escalation requirements.

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
  - `src/commands/pilot-rollback.ts`
  - `src/commands/replay.ts`
- Update consumer path to use canonical records first:
  - `src/commands/pilot-evaluate.ts`
  - `src/lib/pilot-evaluation/metrics-capture.ts`
  - `src/lib/pilot-evaluation/types.ts`
- Resolve known composition seams:
  - rollback vs hold outcome/exit legibility
  - rollback marker path coherence
  - evaluator compatibility-adapter explicitness
- Bootstrap scenario registry for smoke/eval: `evals/scenarios/daily-smoke/`.

### v1-core and v1.1 lane split
- **v1-core (blocking for initial rollout):** CP0 → CP0.5 → CP1 → CP2 → CP3 → CP4a → CP5 → CP6.
- **v1.1 (follow-on expansion):** CP4b retrieval parity (`search`, `context`, `index-context`) and broader degraded-mode harmonization.
- **Track rule:** CP4b is a v1.1 checkpoint and is not a prerequisite for CP5/CP6 core readiness unless a release explicitly scopes v1.1 retrieval parity.

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
2. Define explicit accountability per checkpoint:
   - DRI
   - backup DRI
   - final approver for go/no-go decisions
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
   - required fields: claim ID, UTC timestamp, HEAD SHA, command, exit code, artifact path, checksum, attestation ref
   - machine-generated relevance-set rule (see validation section)

**Deliverables**
- Baseline fixture set and ownership/trust matrix in plan PR.
- Freshness/invalidation policy applied to all phase evidence.

**Validation Gate (CP0)**
- Baseline mismatches reproducible via tests + artifact fixtures with schema versions.
- Owner and trust matrices explicitly approved by maintainers.
- Linked spec is either `status: active` or explicitly permitted for implementation under a documented draft-freeze rule.

---

### Phase 0.5 — Contract freeze (required before implementation)

**Objective:** Resolve schema-blocking decisions before Phase 1 implementation.

**Tasks**
1. Resolve and freeze decisions for:
   - `runId` uniqueness scope
   - retrieval fallback contract for v1 core
   - promotion-mandatory fields
   - provenance hash requirements (repo + process policy)
   - legacy adapter sunset criterion
2. Link decisions in spec or ADR refs and mark as frozen through CP4a.

**Validation Gate (CP0.5)**
- All five decisions resolved and documented in spec/ADR references.
- No unresolved decision remains that can invalidate CP1–CP4a schemas.
- Remaining open questions are explicitly marked non-blocking for CP1–CP6 with interim defaults.

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
- Retrieval commands (`search`, `context`, `index-context`) emit canonical semantic-unavailable events with required run identifiers/classification in v1-core paths.

---

### Phase 3 — Consumer convergence and decision legibility

**Objective:** Move evaluation logic to canonical-first and fix outcome legibility seams.

**Tasks**
1. Update `pilot-evaluate` to consume canonical records first, then versioned legacy adapters.
2. Resolve rollback/hold semantics end-to-end:
   - distinct terminal outcomes
   - distinct classification
   - distinct exit behavior (no rollback collapse into hold path)
3. Add explicit adapter drift events and fail-closed promotion behavior on unresolved drift.
4. Add evidence freshness gating and attestation verification before promotion decisions.
5. Define executable attestation lifecycle:
   - issuer/authority
   - signing step timing
   - verification command/checkpoint owner
   - key-rotation owner + failure classes
   - command templates:
     - sign (environment/governance attestation artifact): `pnpm exec tsx src/cli.ts check-environment --contract harness.contract.json --attestation <attestationPath> --json`
     - verify (policy/evidence validation of attested package): `pnpm exec tsx src/cli.ts pilot-evaluate --artifacts <artifactsDir> --contract harness.contract.json --json`
   - expected outputs:
     - attestation artifact path
     - verifier outcome (`pass|fail`) in canonical event stream

**Target files (expected)**
- `src/commands/pilot-evaluate.ts`
- `src/commands/check-environment.ts`
- `src/lib/pilot-evaluation/metrics-capture.ts`
- `src/lib/pilot-evaluation/types.ts`

**Validation Gate (CP3)**
- Rollback path is machine-distinct from hold path.
- Canonical-first ingestion succeeds; legacy path requires explicit mapping metadata.
- `unresolved_adapter_drift_count == 0` for promotion-evaluated runs.
- Attestation lifecycle checks are test-proven end to end (sign + verify + rotation controls).
- Promotion path blocks on stale evidence, attestation failures, or unresolved schema/adapter drift.

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
2. Ensure canonical degraded/fail events include fallback metadata and confidence constraints.

**Target files (expected)**
- `src/commands/search.ts`
- `src/commands/context.ts`
- `src/commands/index-context.ts`
- `src/lib/context-compound/ollama.ts`
- `src/lib/context-compound/constants.ts`

**Validation Gate (CP4b)**
- Retrieval behavior matrix tests pass across all three commands.
- Canonical events emitted for degraded and explicit-fail paths.
- `retrieval_parity_failure_count == 0` over 10 consecutive retrieval scenarios.

---

### Phase 5 — Scenario registry + rollout controls

**Objective:** Operationalize substrate with scenario coverage and lane-based rollout controls.

**Tasks**
1. Create `evals/scenarios/daily-smoke/` registry and metadata.
2. Add smoke scenarios covering:
   - producer emission
   - consumer ingestion and decisioning
   - rollback marker flow
   - replay consumption
   - v1-core retrieval behavior contract (`search` mode-aware degraded/strict semantics; `context`/`index-context` explicit fail under semantic-unavailable)
   - retrieval lexical parity behavior (CP4b only, if in scope)
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
- Minimum sampling floors are met per command, per scenario, and per terminal outcome class.
- Per-command and per-terminal-outcome pass-rate thresholds are enforced (no bucket may fall below configured floor).
- Advisory/health lane behavior deterministic and test-backed.
- Kill-switch and manual safe mode test-proven.
- Adapter registry entries complete for 100% of active adapters.
- Adapter `blockAfter` enforcement is test-proven (usage after cutoff hard-fails in health lane).
- Sampling-floor denominator contract is test-proven for checkpoint/lane-scoped command universes (no out-of-scope bucket inclusion).

---

### Phase 6 — Hardening and promotion-readiness window

**Objective:** Prove safe autonomy progression using canonical evidence only.

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
4. Enforce rollback-to-manual and re-enable criteria as machine-checked predicates.
5. Execute rollback drills (see rollout section) and attach evidence.

**Validation Gate (CP6)**
- Spec acceptance criteria demonstrated via canonical records.
- Readiness decision and sign-off reproducible from artifacts without narrative-only evidence.
- Promotion lane entry requires 3 consecutive health-lane windows with zero unresolved critical drift.

## Dependencies and Risks

### Dependencies
- Schema contract compatibility with current contract loader/types.
- Command owner coordination across producer and consumer surfaces.
- Test fixture updates for output expectations.
- CI support for smoke scenarios and artifact retention.
- Maintainer decisions on adapter ownership/sunset policy and attestation verifier ownership.

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
   - Mitigation: machine-generated relevance sets + invalidation checks + attestation verification.
6. **Artifact tampering risk**
   - Mitigation: signed attestations + immutable evidence ledger/WORM sink + verifier key rotation policy.
7. **Operational noise during rollout**
   - Mitigation: advisory-first lane and measurable promotion criteria before health enforcement.

## Test and Validation Strategy

### Validation order (required)
1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test`
4. targeted module tests for changed surfaces
5. `pnpm test:deep` (required when source/runtime behavior changes)
6. `pnpm audit`
7. `pnpm check`
8. `pnpm build`

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
- Do not promote phases with stale, superseded, or un-attested evidence.

### Evidence requirements per phase
Each claim must include: claim ID, UTC timestamp, HEAD SHA, command, exit code, artifact path, checksum, attestation reference.

Evidence becomes invalid when:
- machine-generated relevance set changes after evidence capture,
- artifact checksums or event-chain continuity no longer match,
- attestation signature verification fails,
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

### Go/No-Go + rollback runbook (required, executable)
1. **Containment (Go/No-Go):** switch to manual mode and freeze promotion lane; capture trigger artifact and timestamp.
   - command template: `pnpm exec tsx src/cli.ts pilot-rollback --mode manual --incident-id <incidentId> --reason "<reason>" --artifacts <artifactDir> --json`
   - pass predicate: mode state reads `manual` and promotion lane is blocked.
2. **Rollback execution:** run canonical rollback command path and persist rollback event + marker artifacts.
   - command template: `pnpm exec tsx src/cli.ts pilot-rollback --mode manual --incident-id <incidentId> --reason "<reason>" --artifacts <artifactDir> --json`
   - required artifacts: `run-manifest.json`, `events.jsonl`, rollback marker, rollback event record.
3. **Verification:** run required validation commands (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm check`) and attach outputs.
   - pass predicate: all commands exit 0 and no required-gate regressions remain.
4. **Invariant suite:** run ID-tagged rollback invariants; attach pass/fail payloads.
   - command template: `pnpm exec tsx src/cli.ts pilot-evaluate --artifacts <artifactDir> --contract harness.contract.json --json`
   - pass predicate: all invariant IDs pass and no partial-rollback flag is present.
5. **Re-enable decision:** only re-enable when all re-enable requirements are met and approver signs off.
   - command template: `pnpm exec tsx src/cli.ts pilot-rollback --mode autonomous --incident-id <incidentId> --reason "<reason>" --artifacts <artifactDir> --json`
   - pass predicate: re-enable evidence package includes approver identity, timestamp, and regenerated fresh artifacts.

### Rollback drill runbook (required)
- cadence: weekly during rollout phases CP4a–CP6
- owner: release/governance owner on rotation
- scenarios: adapter failure, marker mismatch, partial rollback, stale evidence rejection
- target restore time: <= 30 minutes to stable manual mode
- drill pass/fail: all rollback artifacts generated, invariants pass, manual-safe fallback engages when expected

### Monitoring and operational checks
- Per-run timeline from canonical events.
- Outcome distribution by command/scenario.
- Rollback trigger/success tracking + marker-path integrity.
- Evidence freshness compliance dashboard/report.
- Thrash/retry oscillation detection from canonical events only.

### Alert thresholds and escalation
- `missing_terminal_manifest_count > 0` in any 1h window → block health lane.
- `unresolved_adapter_drift_count > 0` in any promotion window → block promotion.
- `evidence_freshness_compliance < 100%` in health lane window → block promotion.
- `rollback_reliability < 1.0` in readiness window with `rollbackTriggerCount >= 3` → rollback-to-manual trigger.
- `critical_drift_count >= 2` in rolling 24h window → auto-containment (manual-safe mode + promotion freeze).
- Escalation path: owner on-call → release/governance approver → manual-mode enforcement.
- Override governance: manual override requires named approver + expiration <= 24h and explicit reason artifact.

## Acceptance Checklist

- [ ] Enhancement summary and checkpoint model (including CP0.5, CP4a/CP4b) are documented.
- [ ] Canonical manifest and event schemas are added and versioned.
- [ ] Shared canonical run-record IO/types are implemented and tested.
- [ ] Canonical artifact storage/discovery contract is documented and test-proven.
- [ ] `automation-run`, `remediate`, `pilot-rollback`, and `replay` emit canonical terminal artifacts.
- [ ] `pilot-evaluate` is canonical-first and preserves explicit legacy adapter mapping.
- [ ] Rollback and hold outcomes are machine-distinct (state, classification, exit behavior).
- [ ] Rollback marker path is coherent across contract, producer, and consumer gate.
- [ ] v1-core retrieval behavior contract is explicit and test-proven (`search` mode-aware degraded/strict semantics; `context`/`index-context` explicit fail on semantic-unavailable).
- [ ] CP4b lexical retrieval parity expansion is explicit and test-proven when CP4b is enabled for the lane.
- [ ] Failure-injection tests prove terminal-path and append/hash-chain guarantees.
- [ ] Scenario registry (`evals/scenarios/daily-smoke/`) exists with core coverage.
- [ ] Advisory/health lane behavior and kill-switch safe mode are test-proven.
- [ ] Adapter registry fields (`owner`, `introducedAt`, `sunsetBy`, `blockAfter`) are complete.
- [ ] Dual-read parity window passes required thresholds before legacy retirement.
- [ ] RunId uniqueness/collision and dual provenance hash gates pass (`repoContractHash` + `processPolicyHash` required on terminal manifests).
- [ ] Metrics (`interventionRate`, `rollbackReliability`, `evidenceCompleteness`, `thrashRate`) are computed from canonical artifacts.
- [ ] Rollback reliability denominator guard is enforced (`rollbackTriggerCount >= 3` or promotion blocked as insufficient evidence).
- [ ] Sanitization gate passes with `sensitive_field_leak_count == 0`.
- [ ] Validation baseline commands pass with fresh, attested evidence attached to checkpoints.

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
