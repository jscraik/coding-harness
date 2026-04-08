---
schema_version: 1
title: Coding Harness Reliability Orchestration
type: feat
status: active
applies_to:
  - scripts/verify-work.sh
  - src/commands/doctor.ts
  - src/commands/linear-gate.ts
date: 2026-04-08
deepened: 2026-04-08
origin: docs/brainstorms/2026-04-08-coding-harness-reliability-orchestration-requirements.md
risk: medium
spec_depth: full
ui_required: false
---

# Coding Harness Reliability Orchestration

## Enhancement Summary

**Deepened on:** 2026-04-08
**Mode:** targeted-confidence
**Key areas improved:** lifecycle states, contract compatibility, failure recovery precision, acceptance coverage

- Added an explicit verification state model with blocked and resumed transitions so gate orchestration behavior is deterministic, not implied.
- Tightened canonical contract compatibility rules for resumed runs, including mismatch handling and stable run-version boundaries.
- Strengthened safety and recovery semantics around idempotent result persistence, non-retryable policy failures, and operator-facing diagnostics.
- Extended acceptance coverage with explicit scenarios for blocked/unblocked recovery, idempotent state writes, and resume compatibility rejection.

## Table of Contents
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

## Problem Statement

`coding-harness` verification reliability is currently limited by orchestration behavior rather than missing checks:

1. `scripts/verify-work.sh` is fail-fast (`set -euo pipefail`) and currently executes a linear lane, so any single gate failure forces restart from the beginning.
2. Governance contracts are distributed across multiple surfaces (`.harness/ci-required-checks.json`, `src/commands/doctor.ts`, `src/commands/linear-gate.ts`, docs), creating drift risk in check identity and messaging.
3. Transient infrastructure failures and policy/contract failures are not modeled as separate recovery classes in the verification entrypoint.

The system needs deterministic, fail-closed orchestration that preserves governance strictness while reducing avoidable rerun cost and noisy retries.

## Goals

1. Establish one canonical gate contract that governs gate identity, check mapping, execution class, and failure class.
2. Preserve strict governance controls (`linear-gate`, required-check alignment such as `pr-pipeline`) while improving operator throughput.
3. Add resumable verification state so eligible runs can continue from a bounded point instead of always restarting.
4. Introduce explicit retry policy that applies only to transient failures.
5. Keep both human-readable and machine-readable outputs consistent across `verify-work` and `doctor`.

## Non-Goals

1. Replacing `verify-work` with a full new platform runtime in this phase.
2. Weakening fail-closed behavior for governance or contract checks.
3. Changing external CI provider semantics beyond canonical check-name alignment.
4. Introducing model/prompt/token optimization work.
5. Creating new UI surfaces or dedicated UI specification work.

## System Boundary

### Owns

- Canonical verification gate contract data model and storage.
- Verification orchestration lifecycle for fresh and resumed runs.
- Gate execution strategy (bounded parallel read-only phase plus serial guarded phase).
- Retry classification and bounded back-off policy for transient failures.
- Run-state persistence and audit trail under `.harness/runs/`.
- Output normalization for operator and machine consumers.

### Does Not Own

- The business logic inside each individual gate command.
- Branch protection settings outside existing contract-managed paths.
- CI provider implementations themselves.
- Repository feature development unrelated to verification control-plane behavior.

### Governed Existing Surfaces

- `.harness/ci-required-checks.json` (check identity and provider mapping).
- `scripts/verify-work.sh` (canonical verification entrypoint).
- `src/commands/doctor.ts` (`ci:check-alignment` advisory and contract diagnostics).
- `src/commands/linear-gate.ts` (policy enforcement and key-consistency checks).
- `docs/agents/17-ci-required-checks.md` (required-check semantics and branch-protection guidance).

## Core Domain Model

### Entities

| Entity | Purpose | Required fields |
| --- | --- | --- |
| `GateDefinition` | Canonical per-gate contract | `policyId`, `displayName`, `executionClass`, `failureClassDefault`, `enabled`, `order` |
| `CheckBinding` | Maps internal gates to GitHub check contexts | `policyId`, `activeProvider`, `githubCheckName`, `displayName`, `externalIdPattern` |
| `VerificationRun` | One verify execution instance | `runId`, `mode`, `startedAt`, `trigger`, `resumeFromPolicyId`, `status`, `schemaVersion`, `contractVersion`, `repoRoot`, `providerClass` |
| `GateRunResult` | Per-gate recorded outcome | `policyId`, `attempt`, `status`, `failureClass`, `startedAt`, `finishedAt`, `nextAction` |
| `RetryPolicy` | Retry rules per failure class and environment | `failureClass`, `maxRetries`, `baseDelayMs`, `maxDelayMs`, `jitter` |
| `RunSummary` | Durable terminal record for reporting and audit | `runId`, `overallStatus`, `failedPolicyId`, `freshVsResumed`, `durationMs` |

### Enumerations

| Enumeration | Values |
| --- | --- |
| `executionClass` | `read_only_parallel`, `serial_guarded` |
| `gateStatus` | `pending`, `running`, `passed`, `failed`, `skipped`, `blocked` |
| `failureClass` | `transient_infra`, `contract_policy`, `internal_unknown` |
| `runMode` | `fresh`, `resume` |

### Canonical Contract Rule

`GateDefinition` and `CheckBinding` are canonicalized from `.harness/ci-required-checks.json` with explicit additional orchestration metadata. `doctor`, `verify-work`, and required-check documentation must derive identity from this same canonical source and must not define independent gate-name truth tables.

## Main Flow / Lifecycle

### 1. Fresh Run Lifecycle

1. Load and validate canonical gate contract.
2. Build deterministic gate graph ordered by `order` and filtered by mode flags (`--fast`, `--changed-only`, `--all`).
3. Execute read-only gates in bounded parallel batches.
4. Execute serial guarded gates in defined order.
5. Persist per-gate results and terminal summary.
6. Exit non-zero on first blocking failure class.

### 2. Resume Lifecycle

1. Resolve resume target from `--resume-from <policy-id>` and latest compatible `VerificationRun` snapshot.
2. Verify contract compatibility between stored run and current contract version.
3. Rehydrate prior passed results for unaffected gates.
4. Re-enter lifecycle at the selected gate boundary.
5. Continue fail-closed behavior from resume point.
6. Persist `runMode=resume` and source run linkage.

### 3. Verification State Model

```
S0 INIT (non-terminal)
S1 CONTRACT_VALIDATED (non-terminal)
S2 READ_ONLY_BATCH (non-terminal)
S3 SERIAL_GUARDED (non-terminal)
S4 BLOCKED (non-terminal)
S5 DONE (terminal)
S_FAIL (terminal)
```

| S | E | G | A | N |
| --- | --- | --- | --- | --- |
| `S0 INIT` | `start` | run request is syntactically valid | initialize run context | `S1 CONTRACT_VALIDATED` |
| `S1 CONTRACT_VALIDATED` | `contract_ok` | canonical contract parse and identity checks pass | materialize gate graph | `S2 READ_ONLY_BATCH` |
| `S1 CONTRACT_VALIDATED` | `contract_fail` | contract is unreadable or incompatible | emit blocking diagnostics | `S_FAIL` |
| `S2 READ_ONLY_BATCH` | `batch_pass` | all read-only gates pass | advance to guarded lane | `S3 SERIAL_GUARDED` |
| `S2 READ_ONLY_BATCH` | `batch_blocked` | dependency unavailable | record blocker and unblock action | `S4 BLOCKED` |
| `S2 READ_ONLY_BATCH` | `batch_fail` | non-recoverable gate failure | mark failed gate | `S_FAIL` |
| `S3 SERIAL_GUARDED` | `gate_pass` | current guarded gate passes AND `isLastSerialGate` is false | continue serial execution | `S3 SERIAL_GUARDED` |
| `S3 SERIAL_GUARDED` | `gate_pass` | current guarded gate passes AND `isLastSerialGate` is true | mark run complete | `S5 DONE` |
| `S3 SERIAL_GUARDED` | `gate_blocked` | dependency unavailable | record blocker and unblock action | `S4 BLOCKED` |
| `S3 SERIAL_GUARDED` | `gate_fail` | fail-closed or unrecoverable failure | mark failed gate | `S_FAIL` |
| `S4 BLOCKED` | `unblocked` | dependency restored and contract unchanged | resume at blocked gate boundary | previous non-terminal state |
| `S4 BLOCKED` | `contract_changed` | contract version differs from blocked run | refuse implicit resume | `S_FAIL` |

### 4. Execution Phase Rules

- `read_only_parallel` gates may run concurrently with a default max parallelism of `4` and must not mutate repository or remote governance state.
- `serial_guarded` gates execute one at a time and include governance-critical checks.
- Any gate without explicit `executionClass` is treated as `serial_guarded`.

### 5. State Persistence Rules

Run artifacts are stored under `.harness/runs/<run-id>/`:

- `run.json` (run header + mode)
- `gates/<policy-id>.json` (per-gate attempts and outcome)
- `summary.json` (final status and timings)

`run.json` must include at minimum:

- `runId`
- `mode`
- `schemaVersion`
- `contractVersion`
- `repoRoot`
- `providerClass`
- `startedAt`

Retention policy:

- Keep last `50` runs or `30` days, whichever is larger.
- Pruning must never delete the most recent failed run.

### 6. Resume Admissibility Rules

Resume is allowed only when all checks pass:

1. `resumeFromPolicyId` exists in current canonical contract.
2. Stored run `contractVersion` matches current canonical contract version.
3. Stored run was produced by the same repository root and provider class.
4. All reused gate results are `passed` and were emitted by the same gate identity tuple (`policyId`, `activeProvider`, `externalIdPattern`, `githubCheckName`).

If any admissibility check fails, resume is rejected as a contract-safety failure and requires a fresh run.

## Interfaces and Dependencies

### Inputs

- `scripts/verify-work.sh` flags and environment.
- Canonical gate/check contract (`.harness/ci-required-checks.json`).
- `linear-gate` contract data loaded via `harness.contract.json`.

### Downstream Command Interfaces

| Interface | Contract expectation |
| --- | --- |
| `harness doctor --json` | reports alignment diagnostics sourced from canonical check binding |
| `harness linear-gate --json` | returns explicit pass/fail checks including key consistency and reference mode |
| `scripts/validate-codestyle.sh` | preserves existing fail-closed quality gate semantics |
| `scripts/codex-preflight.sh` | remains first required baseline gate in verify flow |

### Output Interfaces

- Human mode: ordered gate output including policy id, status, failure class, and action hint.
- JSON mode: deterministic schema with run metadata, gate outcomes, and resume eligibility.

### Backward Compatibility

- Existing `verify-work` flags remain valid.
- Legacy behavior without resume flags remains equivalent to a fresh run.
- Existing doctor contract checks remain advisory but source data becomes canonicalized through shared gate contract.

### Contract Versioning and Compatibility

The orchestration contract exposes a version tuple:

- `schemaVersion` (shape compatibility)
- `contractVersion` (semantic gate/check identity compatibility)

### Version Source of Truth

Canonical source remains `.harness/ci-required-checks.json` and extends as follows:

1. Existing top-level `version` is treated as `schemaVersion` for backward compatibility.
2. `contractVersion` is a deterministic semantic version derived from the canonical gate identity tuple:
   - `policyId`
   - `activeProvider`
   - `externalIdPattern`
   - `githubCheckName`
3. Both values are materialized into run-state (`run.json`) at run start and used for resume admissibility checks.
4. During migration, manifests lacking explicit `contractVersion` are treated as `contractVersion=1` until the canonicalized contract writer emits explicit values.

Rules:

1. `schemaVersion` mismatch is a hard failure.
2. `contractVersion` mismatch blocks resume but permits fresh runs.
3. Non-identity metadata updates (for example `displayName` text or freshness window tuning) must not invalidate previously persisted pass records.
4. Identity updates (for example `policyId`, `activeProvider`, `githubCheckName`, `externalIdPattern`, or required policy class) invalidate prior reused results for affected gates.

## Invariants / Safety Requirements

1. Fail-closed: any `contract_policy` failure exits non-zero immediately and blocks forward progression.
2. No silent retries for governance checks (`linear-gate`, check-name alignment, missing required metadata).
3. Check identity invariance: for CircleCI, workflow-level check context mapping (for example `pr-pipeline`) must not drift silently.
4. Resume correctness: a resumed run cannot mark a gate passed unless a valid prior pass record exists for matching contract version.
5. Auditability: every run must record whether it was fresh or resumed and which gate started execution.
6. Deterministic ordering: serial gates always execute in canonical `order`.
7. Safe parallelism: only `read_only_parallel` gates may run concurrently.
8. Idempotent persistence: writing `GateRunResult` for the same (`runId`, `policyId`, `attempt`) key must be idempotent.
9. Blocked-state integrity: `S4 BLOCKED` cannot transition directly to `S5 DONE`.

## Failure Model and Recovery

### Failure Class Taxonomy

| Failure class | Examples | Retry behavior | Exit behavior |
| --- | --- | --- | --- |
| `transient_infra` | network timeout, temporary CLI transport error, temporary API unavailable | bounded retry enabled | fail after retry budget exhausted |
| `contract_policy` | missing Linear key, branch/PR key mismatch, invalid check mapping | no retry | immediate fail-closed exit |
| `internal_unknown` | unclassified script error, malformed gate response | no automatic retry | fail with explicit diagnostic |

### Retry Policy

Default transient retry profile:

- local: `maxRetries=2`, `baseDelayMs=1000`, `maxDelayMs=5000`, `jitter=20%`
- CI: `maxRetries=3`, `baseDelayMs=3000`, `maxDelayMs=15000`, `jitter=20%`

Back-off function:

`delay = min(baseDelayMs * 2^attempt, maxDelayMs) + jitter`

Retry boundary rules:

1. Retries are permitted only for gates marked `read_only_parallel`.
2. `contract_policy` failures are always final within the current run.
3. A resumed run may retry newly executed transient failures but must not replay already-passed gate outputs.

Guarded gate retries are out of scope for this phase and remain disabled by policy.

### Recovery Semantics

- On transient exhaustion, gate result is `failed` with `failureClass=transient_infra` and explicit next action.
- On `contract_policy`, run terminates at first failure and records blocking contract code.
- On `internal_unknown`, run records raw diagnostic envelope and recommends manual rerun from failed gate after fix.
- On `blocked` events, run status becomes `blocked` and must include one unblock condition plus one deterministic resume entrypoint.

## Observability

### Required Emissions

1. `run_started` with run id, mode, contract version, and requested flags.
2. `gate_started` and `gate_finished` for each gate.
3. `gate_retry` with attempt count, delay, and failure class.
4. `run_blocked` and `run_unblocked` with blocker class and affected gate.
5. `run_finished` with status, failed gate, and duration.

### Required Fields per Gate Event

- `runId`
- `policyId`
- `executionClass`
- `attempt`
- `status`
- `failureClass`
- `nextAction`
- `contractVersion`
- `timestamp`

### Operator Output Requirements

- Each failed gate line must include: policy id, failure class, and one deterministic next step.
- Resume-capable failures must include explicit resume command using policy id.
- `doctor` alignment messages and verify-work failure messages must use consistent check identity terms.

## Acceptance and Test Matrix

| ID | Scenario | Expected behavior | Validation evidence |
| --- | --- | --- | --- |
| SA1 | Canonical check-name mapping for CircleCI | check bindings resolve to workflow-level contexts (`pr-pipeline` / configured equivalents), not job names | unit tests for contract parsing + doctor alignment check fixtures |
| SA2 | Linear branch/PR key mismatch | verify lane fails immediately as `contract_policy` without retry | `linear-gate` integration test with mismatched branch/pr keys |
| SA3 | Transient read-only gate timeout | gate retries with bounded back-off and succeeds or fails with retry-exhausted status | retry policy unit tests with deterministic clock |
| SA4 | Resume from failed gate | rerun skips unaffected passed gates and continues from selected gate boundary | run-state fixture tests for `--resume-from` |
| SA5 | Contract version drift between stored run and current contract | resume is blocked with explicit contract mismatch reason | compatibility test across two manifest versions |
| SA6 | Missing execution class in gate contract | gate defaults to `serial_guarded` | contract normalization unit test |
| SA7 | Unknown internal gate error | failure classified as `internal_unknown` and no auto retry | error-classification test case |
| SA8 | Audit trail persistence | run artifacts include run header, per-gate results, and terminal summary | filesystem integration test under `.harness/runs` |
| SA9 | Backward compatibility for fresh run | existing `verify-work` behavior remains functionally equivalent when resume is not requested | regression test comparing legacy and contract-driven execution outputs |
| SA10 | Consistent failure messaging | doctor and verify outputs use same canonical check identity text for check-name drift | golden snapshot tests for both command outputs |
| SA11 | Blocked dependency recovery | blocked run records unblock condition and resumes at the blocked gate only after dependency restoration | transition-state integration test covering `S4 BLOCKED -> previous state` |
| SA12 | Idempotent gate-result persistence | duplicate write attempts for same run/gate/attempt do not create conflicting records | run-store persistence test with repeated writes |
| SA13 | Resume compatibility rejection | resume attempt fails when contract identity tuple has changed even if gate names match | contract-version mismatch test with modified `githubCheckName` or `externalIdPattern` |
| SA14 | Completion transition correctness | run cannot enter `S5 DONE` unless final serial gate passes with `isLastSerialGate=true` | lifecycle transition test covering guarded-lane termination rules |

## Open Questions

### Resolved for `ce-plan` (2026-04-08)

1. Pruning policy authority: retention remains fixed in this phase (`keep last 50 runs OR 30 days`, always preserve latest failed run), with contract-level control deferred.
2. Resume trigger policy: when resume mode is requested, omitted `--resume-from` is invalid in this phase; explicit `--resume-from <policy-id>` is required. If resume mode is not requested, execution defaults to a fresh run.

### Deferred (non-blocking for current planning)

1. Whether guarded gates should ever become retry-eligible in a future phase with explicit policy and per-gate metadata.

## Definition of Done

1. Canonical gate contract is implemented and consumed by verify orchestration and doctor alignment checks.
2. `verify-work` supports resumable execution with durable run-state and auditable fresh/resume markers.
3. Retry behavior is class-based and bounded, with retries limited to transient failures.
4. Governance-critical failures remain fail-closed and non-retryable.
5. Acceptance items `SA1` to `SA14` are covered by tests or executable verification commands.
6. Documentation for required checks and verification behavior is updated to match canonical contract semantics.
