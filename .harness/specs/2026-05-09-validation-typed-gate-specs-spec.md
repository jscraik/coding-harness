---
schema_version: 1
artifact_id: validation-typed-gate-specs-spec
artifact_type: he-spec
canonical_slug: validation-typed-gate-specs
title: Validation Typed Gate Specs
harness_stage: he-spec
status: draft
date: 2026-05-09
traceability_required: true
origin: .harness/linear/coding-harness-linear-plan.md
linear_issue: JSC-290
linear_status: Triage
linear_milestone: Validation Typed Gate Specs Slice (planned)
risk: migration-risk
depth: bounded
ui: false
---

# Validation Typed Gate Specs

## Table Of Contents

- [Mode Decision](#mode-decision)
- [Problem](#problem)
- [Goals](#goals)
- [Non-Goals](#non-goals)
- [Linear Work Item Contract](#linear-work-item-contract)
- [Boundary And Scope](#boundary-and-scope)
- [Baseline Evidence](#baseline-evidence)
- [Domain Model](#domain-model)
- [Lifecycle And State Model](#lifecycle-and-state-model)
- [Gate Inventory Contract](#gate-inventory-contract)
- [Interfaces And Surfaces](#interfaces-and-surfaces)
- [Typed Mirror Contract](#typed-mirror-contract)
- [Parity Test Contract](#parity-test-contract)
- [Validation Contract](#validation-contract)
- [Phase Admission Rules](#phase-admission-rules)
- [Human Review Gates](#human-review-gates)
- [Invariants](#invariants)
- [Failure And Recovery](#failure-and-recovery)
- [Observability And Evidence](#observability-and-evidence)
- [Acceptance Matrix](#acceptance-matrix)
- [Linear Acceptance Traceability](#linear-acceptance-traceability)
- [First Slice](#first-slice)
- [Open Questions](#open-questions)
- [Done Definition](#done-definition)
- [he-plan Handoff](#he-plan-handoff)
- [Blackboard Delta](#blackboard-delta)
- [Evidence And Traceability](#evidence-and-traceability)

## Mode Decision

This is a bounded architecture refactor specification for the `Validation Typed
Gate Specs Slice`.

The first execution slice must be read-only. It may inventory and snapshot the
current validation gate graph, but it must not replace `scripts/verify-work.sh`,
change exit codes, change gate order, change package scripts, or alter CI/local
validation behavior.

## Problem

`scripts/verify-work.sh` is the canonical repo-local verification entrypoint and
it works. It also carries too much stable orchestration knowledge directly in
shell: stack detection, required path inventories, gate definitions,
parallel/serial execution classes, failure classes, run-state emission,
resume-from behavior, hook-governance scope, and evidence output.

That creates a local reasoning problem for future agents. The right command is
easy to run, but the validation model is expensive to understand or change
safely. Shell remains a good launcher; it is a poor long-term source of truth
for gate graphs and policy metadata once those semantics have stabilized.

The project needs typed gate specs that first mirror the current behavior, then
gradually become the source for stable validation metadata. The wrapper should
remain the stable execution surface until parity is proven.

## Goals

- Capture the current `verify-work.sh` gate graph, modes, gate IDs, execution
  classes, failure classes, resume checkpoints, artifact outputs, and exit-code
  semantics as deterministic evidence.
- Add a typed, read-only gate spec mirror that represents stable validation
  metadata without changing runtime behavior.
- Add parity tests that fail when the typed spec and shell gate definitions
  drift.
- Preserve `bash scripts/verify-work.sh`, `bash scripts/verify-work.sh --fast`,
  and `bash scripts/validate-codestyle.sh` as stable command entrypoints.
- Make validation routing easier for agents to inspect without reading the full
  shell state machine.
- Define a safe handoff from mirror-only typed specs to later runtime extraction
  phases.

## Non-Goals

- Do not rewrite `verify-work.sh` in TypeScript in this slice.
- Do not remove or rename `bash scripts/verify-work.sh`.
- Do not change exit-code semantics for success, failure, or usage errors.
- Do not change package script behavior in `package.json`.
- Do not replace `validate-codestyle.sh` or its required baseline contract.
- Do not make typed specs the runtime source of truth until parity tests exist.
- Do not alter CI provider ownership, branch protection, required checks, or
  release workflows.
- Do not create a broad validation platform or plugin system.

## Linear Work Item Contract

| Field | Value |
| --- | --- |
| Linear issue | `JSC-290` |
| Recommended title | `[coding-harness] Mirror validation gate graph in typed specs` |
| Project | `coding-harness` |
| Initiative | `Dev Portfolio` |
| Milestone | `Validation Typed Gate Specs Slice` (planned; not attached in Linear yet) |
| Priority | High / `2` |
| Recommended labels | `Reliability`, `architecture`, `Refactor`, `Drift-Risk`, `Agent-Native` |
| Execution route | `he-plan` -> `he-work`; agent-assisted; human review before runtime behavior changes |
| Source plan | `.harness/linear/coding-harness-linear-plan.md` |
| Source refactor | `.harness/refactors/validation-orchestration-typed-gate-specs.md` |
| Required eval | `.harness/evals/coding-harness-validation-typed-gate-specs-eval.md` |

## Boundary And Scope

In scope:

- `scripts/verify-work.sh`
- `scripts/validate-codestyle.sh`
- `docs/agents/04-validation.md`
- `package.json` validation-related scripts as evidence only unless the plan
  explicitly admits a package-script change
- Future typed validation modules under `src/lib/validation/**`
- Focused tests for gate graph/spec parity
- Harness artifacts under `.harness/specs`, `.harness/plan`, `.harness/review`,
  and `.harness/evals`

Out of scope:

- CI migration internals from `JSC-289`
- Contract validation modularization from `JSC-178`
- Provider-specific CI ownership changes
- Branch-protection or required-check migration
- New public CLI commands
- Broad docs-gate redesign

## Baseline Evidence

Hard evidence from the repository:

- `package.json` defines `check`, `lint`, `typecheck`, `test`, `test:ci`,
  `test:deep`, `test:evals`, `workflow:validate`, `codestyle:validate`,
  `quality:docstrings`, `quality:size`, and related validation scripts.
- `scripts/verify-work.sh` exposes `--all`, `--changed-only`, `--strict`,
  `--fast`, `--resume-from`, `--json`, `--repo-root`,
  `--project-governance`, and `--workspace-governance`.
- `scripts/verify-work.sh` defines gate IDs including
  `validate-codestyle-fast`, `validate-codestyle`, `ci-check-alignment`, and
  hook-governance gates.
- `scripts/verify-work.sh` emits run state under `.harness/runs/<run-id>/` with
  `run.json`, `gates/<gate-id>.json`, and `summary.json`.
- `scripts/verify-work.sh` classifies execution as `read_only_parallel` and
  `serial_guarded`, with failure classes such as `transient_infra`,
  `internal_unknown`, and contract/policy failures.
- `scripts/validate-codestyle.sh` is itself a required baseline gate and runs
  package scripts including `lint`, `docs:lint`, `skill:validate`,
  `workflow:validate`, `typecheck`, `quality:docstrings`, `quality:size`, and
  `test:related` or `test`.
- `docs/agents/04-validation.md` states that `validate-codestyle.sh --fast`,
  full `validate-codestyle.sh`, and `pnpm test:deep` are the required baseline
  pattern depending on change type.
- `.harness/refactors/validation-orchestration-typed-gate-specs.md` defines the
  desired migration path: snapshot, typed mirror, failure taxonomy, resume model,
  then shell burn-down.
- `.harness/core/execution-invariants.md` requires observable evidence, repo
  wrappers over ad hoc equivalents, eval artifacts before closure, and explicit
  rollback conditions.
- `.harness/decisions/ADR-006-no-new-behavior-in-oversized-orchestrators.md`
  says shell wrappers should remain stable entrypoints while policy, gate
  graphs, and validation semantics move toward typed, testable internals.

Interpretation:

- The current validation wrapper is not broken; it is overburdened.
- The safe first move is a typed mirror and parity proof, not runtime
  replacement.
- The moat-relevant gain is better deterministic validation cognition for
  agents and maintainers, not fewer lines of shell by itself.

## Domain Model

| Term | Meaning | Boundary implication |
| --- | --- | --- |
| Validation entrypoint | The command users and agents run, primarily `bash scripts/verify-work.sh`. | Must remain stable while internals evolve. |
| Gate graph | The ordered set of gates, dependencies, execution classes, and stop rules. | Should become typed metadata before runtime extraction. |
| Gate ID | Stable identifier such as `validate-codestyle-fast` or `ci-check-alignment`. | Must not drift without parity tests and docs updates. |
| Execution class | Whether a gate is safe for bounded parallel execution or requires serial guarded execution. | Must be explicit and testable before orchestration changes. |
| Failure class | Operational category for a failure, such as transient infrastructure, contract policy, or internal unknown. | Must remain visible in human and JSON output. |
| Run state | `.harness/runs/<run-id>/` evidence for gate execution. | Must remain inspectable and resumable. |
| Resume checkpoint | Gate boundary accepted by `--resume-from`. | Must match current gate IDs and fingerprint rules. |
| Typed gate spec | A TypeScript-readable representation of stable validation metadata. | Starts as mirror-only, then may become source of truth for stable slices. |

## Lifecycle And State Model

The intended lifecycle is:

1. Snapshot the current shell-owned validation model without changing behavior.
2. Encode the stable gate graph as typed metadata.
3. Add parity tests between typed metadata and shell behavior.
4. Extract failure taxonomy and artifact expectations into typed metadata.
5. Extract resume metadata only after gate graph parity is proven.
6. Burn down shell policy only after the typed model is proven and reviewed.

State transitions:

| State | Meaning | Allowed next state |
| --- | --- | --- |
| `shell_authoritative` | Current state; shell owns runtime and metadata. | `typed_mirror` |
| `typed_mirror` | Typed spec mirrors shell; shell remains runtime truth. | `parity_enforced` |
| `parity_enforced` | Tests fail if shell and typed spec drift. | `typed_metadata_authoritative` for stable slices |
| `typed_metadata_authoritative` | Selected metadata is read from typed modules. | `shell_policy_burn_down` |
| `shell_policy_burn_down` | Shell no longer owns extracted policy slices. | complete |

No phase may skip from `shell_authoritative` to runtime replacement.

## Gate Inventory Contract

`IU-VAL-001` must produce a read-only inventory of the live gate plan before any
typed module is added. The inventory is not allowed to infer desired behavior; it
must quote or reference current behavior from `scripts/verify-work.sh`,
`scripts/validate-codestyle.sh`, `docs/agents/04-validation.md`, and
`package.json`.

The inventory must capture these fields for each gate:

| Field | Requirement |
| --- | --- |
| Gate ID | Stable string used by `build_gate_plan` and `--resume-from`. |
| Mode membership | Whether the gate appears in fast mode, full mode, or both. |
| Execution class | `read_only_parallel` or `serial_guarded`. |
| Default failure class | `contract_policy`, `transient_infra`, or `internal_unknown`. |
| Command surface | The exact command or function path used by `run_gate_command`. |
| Artifact output | Expected `.harness/runs/<run-id>/gates/<gate-id>.json` fields. |
| Resume behavior | Whether prior passed results may be reused before this gate. |
| Retry behavior | Whether retry is possible and under which failure classification. |
| Shell-native notes | Any dynamic branch that should remain shell-owned for now. |

The inventory must also capture run-level artifacts, because gate metadata alone
is not enough to validate resume or closure behavior:

| Artifact | Required inventory fields |
| --- | --- |
| `.harness/runs/<run-id>/run.json` | `runId`, `mode`, `sourceRunId`, `status`, `startedAt`, `resumeFromGateId`, `repoRoot`, `providerClass`, `schemaVersion`, `contractVersion`, `contractFingerprint`, and lane flags. |
| `.harness/runs/<run-id>/gates/<gate-id>.json` | `gateId`, `executionClass`, `attempt`, `status`, `failureClass`, `startedAt`, `finishedAt`, `nextAction`, `exitCode`, plus optional `reused` and `sourceRunId` for hydrated prior gates. |
| `.harness/runs/<run-id>/summary.json` | `runId`, `overallStatus`, `failedGateId`, `freshVsResumed`, and `durationMs`. |

Current hard-evidence gate plan:

| Gate ID | Fast mode | Full mode | Execution class | Default failure class |
| --- | --- | --- | --- | --- |
| `preflight` | yes | yes | `serial_guarded` | `contract_policy` |
| `ci-check-alignment` | yes | no | `read_only_parallel` | `contract_policy` |
| `hook-governance-inventory` | yes | yes | `serial_guarded` | `contract_policy` |
| `hook-governance-rollout-check` | yes | yes | `read_only_parallel` | `contract_policy` |
| `hook-governance-docstring-ratchet` | yes | yes | `read_only_parallel` | `contract_policy` |
| `hook-governance-format-reports` | yes | yes | `serial_guarded` | `contract_policy` |
| `validate-codestyle-fast` | yes | no | `read_only_parallel` | `transient_infra` |
| `validate-codestyle` | no | yes | `serial_guarded` | `internal_unknown` |

The first slice should save the inventory as a review artifact, recommended:

`.harness/review/2026-05-09-JSC-290-validation-gate-graph-inventory.md`

That artifact must include a "runtime edits: none" statement and a diff
checklist proving no production source, package script, CI, or shell behavior
changed during the snapshot phase.

## Interfaces And Surfaces

Stable public surfaces:

- `bash scripts/verify-work.sh`
- `bash scripts/verify-work.sh --fast`
- `bash scripts/verify-work.sh --resume-from <gate-id>`
- `bash scripts/verify-work.sh --json`
- `bash scripts/validate-codestyle.sh`
- `bash scripts/validate-codestyle.sh --fast`
- `pnpm check`
- `pnpm test:deep`
- `.harness/runs/<run-id>/run.json`
- `.harness/runs/<run-id>/gates/<gate-id>.json`
- `.harness/runs/<run-id>/summary.json`

Candidate internal surfaces:

- `src/lib/validation/gate-spec.ts`
- `src/lib/validation/gate-spec.test.ts`
- `src/lib/validation/verify-work-spec.ts`
- `src/lib/validation/failure-taxonomy.ts`
- `src/lib/validation/run-state-contract.ts`

The exact file names may change in `he-plan`, but the split must remain:
metadata and pure validation logic in TypeScript; process execution and shell
portability in shell.

## Typed Mirror Contract

The typed mirror must begin as non-authoritative metadata. It may be imported by
tests and documentation tooling, but it must not be consumed by
`scripts/verify-work.sh` until parity and human review are complete.

Minimum typed shape:

```ts
export type ValidationGateExecutionClass =
  | "read_only_parallel"
  | "serial_guarded";

export type ValidationGateFailureClass =
  | "contract_policy"
  | "internal_unknown"
  | "transient_infra";

export interface ValidationGateSpec {
  id: string;
  modes: Array<"fast" | "full">;
  executionClass: ValidationGateExecutionClass;
  defaultFailureClass: ValidationGateFailureClass;
  commandSurface: string;
  resumeCheckpoint: boolean;
  retryPolicy: "none" | "transient-infra-only";
  artifactContract: {
    runFile: string;
    gateFile: string;
    summaryFile: string;
    requiredFields: string[];
    reusedGateFields: string[];
  };
  shellNativeReason?: string;
}
```

The plan may choose a different exact type name, but it must preserve these
semantics. The mirror must not expose a second command runner, a plugin system,
or another orchestration entrypoint.

## Parity Test Contract

Parity tests must prove that typed metadata matches the shell-owned gate plan.
They should be narrow, deterministic, and hostile to silent drift.

Required parity checks:

- Fast-mode typed gate IDs match the shell fast-mode gate IDs in order.
- Full-mode typed gate IDs match the shell full-mode gate IDs in order.
- Execution classes match the shell arrays for every gate.
- Default failure classes match the shell arrays for every gate.
- Every live gate ID is represented as a possible `--resume-from` checkpoint.
- Resumed runs only reuse prior gate artifacts when the source run matches repo
  root, schema version, contract version, contract fingerprint, provider class,
  and lane flags.
- Resume rejects an unknown gate ID and reports available gate IDs.
- Run-state fixtures include `gateId`, `executionClass`, `attempt`, `status`,
  `failureClass`, `nextAction`, and `exitCode`.
- Reused prior-gate fixtures include `reused` and `sourceRunId`.
- `transient_infra` retry remains limited to gates whose execution class is
  `read_only_parallel`.

Parity tests should avoid executing the full validation lane by default. The
first test layer may parse or source a constrained fixture from shell evidence;
runtime execution remains a separate validation gate.

## Validation Contract

Spec validation:

- `python3 /Users/jamiecraik/dev/agent-skills/Infrastructure/scripts/validation-and-linting/he_artifact_identity_lint.py .harness/specs/2026-05-09-validation-typed-gate-specs-spec.md`
- `python3 /Users/jamiecraik/dev/agent-skills/Infrastructure/scripts/validation-and-linting/he_linear_traceability_lint.py .harness/specs/2026-05-09-validation-typed-gate-specs-spec.md`
- `pnpm markdownlint .harness/specs/2026-05-09-validation-typed-gate-specs-spec.md`

Implementation validation must be phase-specific:

- Every phase closeout: full `bash scripts/validate-codestyle.sh` unless a
  concrete environment blocker is recorded. `bash scripts/validate-codestyle.sh
  --fast` may be used as an iteration gate, but it does not replace the full
  baseline proof.
- Snapshot-only phase: artifact validation, markdown lint, diff proof that no
  runtime source changed, and full `bash scripts/validate-codestyle.sh` before
  closure.
- Typed mirror phase: focused TypeScript tests for typed spec shape and shell
  parity, `pnpm typecheck`, and full `bash scripts/validate-codestyle.sh`.
- Failure taxonomy phase: focused tests for failure class metadata and rendered
  human/JSON output expectations, plus full `bash scripts/validate-codestyle.sh`.
- Resume model phase: fixture tests for compatible prior run, missing prior gate,
  non-passed prior gate, fingerprint mismatch, and unknown gate ID, plus full
  `bash scripts/validate-codestyle.sh`.
- Runtime shell burn-down phase: `bash scripts/verify-work.sh --fast`, full
  `bash scripts/validate-codestyle.sh`, and `pnpm test:deep` unless a concrete
  environment blocker is recorded.

At the start of each phase, the plan must re-read the live
`scripts/verify-work.sh` gate plan and `docs/agents/04-validation.md` baseline
rules. If either changed since this spec, refresh the inventory or stop for
human review before implementing.

## Phase Admission Rules

`he-plan` must keep the migration staged. Each phase is admitted only when the
previous phase has evidence and no blocking review finding.

| Phase | Allowed work | Blocked work | Required proof |
| --- | --- | --- | --- |
| `IU-VAL-001` | Read-only inventory and review artifact. | Runtime edits, typed source modules, package scripts, CI. | Inventory artifact, markdown lint, diff proves no runtime edits, full `bash scripts/validate-codestyle.sh`. |
| `IU-VAL-002` | Non-authoritative typed mirror and type/unit tests. | Shell consumption of typed metadata. | Focused tests, `pnpm typecheck`, full `bash scripts/validate-codestyle.sh`. |
| `IU-VAL-003` | Parity tests between shell evidence and typed metadata. | Shell policy removal. | Intentional mismatch test fails, normal parity passes, full `bash scripts/validate-codestyle.sh`. |
| `IU-VAL-004` | Failure taxonomy and artifact contract metadata. | JSON schema or wording change without review. | Focused tests for failure class and next-action mapping, full `bash scripts/validate-codestyle.sh`. |
| `IU-VAL-005` | Resume model fixtures and fail-closed compatibility tests. | Runtime resume behavior change without human review. | Compatible and incompatible fixture tests, full `bash scripts/validate-codestyle.sh`. |
| Later burn-down | Remove shell-owned policy already covered by parity. | Entrypoint rename/removal or broad TypeScript rewrite. | Full wrapper validation, deep tests, eval artifact, rollback proof. |

Any phase that needs to change `scripts/verify-work.sh`, package scripts, CI
provider policy, required-check identity, or public command behavior must stop
and require human review before implementation.

## Human Review Gates

Human review is required before:

- The typed spec becomes runtime-authoritative for any gate metadata.
- `scripts/verify-work.sh` removes existing shell policy branches.
- `--resume-from` behavior changes.
- Failure wording or JSON schema changes.
- Exit-code behavior changes.
- CI/local parity claims are made.

Human review is not required for:

- Read-only inventory.
- Mirror-only typed metadata that is not consumed at runtime.
- Tests that assert current shell behavior.

## Invariants

- `verify-work.sh` remains the canonical entrypoint until an explicit migration
  decision replaces it.
- Typed specs must reduce reasoning cost; they are not allowed to become
  pass-through duplication with no parity enforcement.
- Exact command evidence must remain visible.
- Run-state artifacts must remain inspectable.
- Resume behavior must fail closed when compatibility cannot be proven.
- Shell portability is intentional complexity; shell-owned policy is accidental
  complexity after the policy is stable enough to type.
- No Linear parent or milestone closes without
  `.harness/evals/coding-harness-validation-typed-gate-specs-eval.md`.

## Failure And Recovery

| Failure | Required response |
| --- | --- |
| Snapshot contradicts live shell behavior | Fix the snapshot or mark the dynamic behavior out of typed scope. Do not edit runtime. |
| Typed mirror cannot represent a dynamic shell branch | Scope the mirror to stable slices and record the dynamic branch as shell-native. |
| Parity test fails after shell edit | Treat as validation drift; update typed spec only if the shell change was intentional and reviewed. |
| Runtime behavior changes before parity exists | Revert or block the phase. |
| Resume compatibility changes unexpectedly | Stop and require human review. |
| Exact command evidence disappears | Block closure. |
| Full validation cannot run | Record blocker and nearest meaningful validation; do not claim runtime readiness. |

Rollback rule:

The shell wrapper remains the rollback path until typed orchestration has proven
parity. Any runtime extraction must be revertible by returning the affected
metadata slice to shell-owned behavior.

## Observability And Evidence

Required evidence artifacts:

- Gate graph snapshot artifact under `.harness/review/**` or `.harness/plan/**`
  as selected by `he-plan`.
- Focused test output for typed gate spec parity.
- Run-state examples under `.harness/runs/<run-id>/` or fixture equivalents.
- Eval artifact:
  `.harness/evals/coding-harness-validation-typed-gate-specs-eval.md`.
- Linear closure note linking the spec, plan, validation commands, and eval.

Observability must answer:

- Which gate IDs exist?
- Which gates run in fast mode versus full mode?
- Which gates are read-only parallel versus serial guarded?
- Which failures are contract/policy, transient infrastructure, or internal
  unknown?
- Which gate can be resumed from safely?
- Which artifacts prove pass, fail, or blocked state?

## Acceptance Matrix

| ID | Acceptance Criterion | Evidence Required | Validation |
| --- | --- | --- | --- |
| SA-VAL-001 | Current validation gate graph is snapshotted without runtime changes. | Artifact listing modes, gate IDs, execution classes, stop rules, run-state files, and exit semantics. | Artifact lint; `git diff` proves no runtime edits in snapshot phase. |
| SA-VAL-002 | Typed gate spec mirror represents stable gate metadata. | TypeScript module or fixture with gate IDs, modes, execution classes, command text, and artifact expectations. | Focused unit tests; `pnpm typecheck`. |
| SA-VAL-003 | Shell and typed mirror cannot drift silently. | Parity test comparing current shell gate labels/metadata against typed metadata. | Focused parity test fails on intentional mismatch fixture. |
| SA-VAL-004 | Stable failure taxonomy is typed and visible. | Metadata for failure classes and next-action wording. | Focused tests for human and JSON failure outputs where admitted. |
| SA-VAL-005 | Resume behavior remains fail-closed. | Fixtures for compatible run, missing gate result, non-passed prior gate, unknown gate, and fingerprint mismatch. | Focused resume model tests before runtime extraction. |
| SA-VAL-006 | Runtime entrypoints remain stable. | No rename/removal of `verify-work.sh`, `validate-codestyle.sh`, or documented package scripts. | Full `bash scripts/validate-codestyle.sh` for every phase closeout; `bash scripts/verify-work.sh --fast` and `pnpm test:deep` when runtime behavior changes. |
| SA-VAL-007 | Agent cognition improves measurably. | Spec/mirror lets an agent identify the fast-mode gate graph without reading the full shell script. | Eval report includes before/after context path comparison or explicit inspection checklist. |
| SA-VAL-008 | Shell policy decreases only after parity. | Diff shows extracted policy slice removed from shell after typed parity is already enforced. | Eval compares shell-owned policy sections before and after burn-down. |
| SA-VAL-009 | Linear closure is eval-backed. | `.harness/evals/coding-harness-validation-typed-gate-specs-eval.md` links spec, plan, tests, and rollback evidence. | HE eval-report validation and artifact identity lint. |

## Linear Acceptance Traceability

| Linear issue | Linear target | Acceptance IDs | Closure rule |
| --- | --- | --- | --- |
| JSC-290 | `[coding-harness] Mirror validation gate graph in typed specs` | `SA-VAL-001` through `SA-VAL-009` | Do not close until eval artifact exists and human review accepts any runtime behavior change. |
| JSC-290 | Milestone: `Validation Typed Gate Specs Slice` (planned) | `SA-VAL-001` through `SA-VAL-009` | Do not mark milestone complete while Linear closure cleanup for JSC-288/JSC-289 is unresolved or while typed spec is mirror-only without parity tests. |

## First Slice

Recommended first slice for `he-plan`:

`IU-VAL-001`: produce a read-only gate graph snapshot for `verify-work.sh`.

Allowed outputs:

- A review or inventory artifact describing current gate graph, modes, gate IDs,
  run-state artifacts, resume checkpoints, and failure classes.
- No production source changes.
- No package script changes.
- No CI changes.

Exit criteria:

- Snapshot identifies which shell branches are stable enough to type and which
  should remain shell-native.
- Snapshot names the exact parity tests required before typed metadata can be
  introduced.
- Snapshot records the current gate table, artifact schema, resume
  compatibility checks, retry limits, and failure-class next actions.
- Snapshot records live `--help` output for `verify-work.sh` and
  `validate-codestyle.sh` as source evidence for accepted command flags.
- Snapshot verifies current validation requirements against
  `docs/agents/04-validation.md` before planning later phases.
- Snapshot includes a diff checklist proving no behavior-changing files changed.
- `pnpm markdownlint` and full `bash scripts/validate-codestyle.sh` pass for
  the artifact, unless a concrete environment blocker is recorded.

## Open Questions

- Should the planned `Validation Typed Gate Specs Slice` milestone be created
  and attached before `he-plan`, or should `JSC-290` remain the sole execution
  container until the first implementation plan proves milestone scope?
- Should typed gate metadata live under `src/lib/validation/**`, or should
  `he-plan` choose a narrower name after inventory?
- Which run-state examples are safe to commit as fixtures without leaking local
  environment details?

## Done Definition

The slice is done when:

- The current gate graph has a read-only snapshot.
- Typed metadata mirrors at least one stable validation slice.
- Parity tests prevent silent drift.
- Runtime behavior is unchanged unless explicitly planned, reviewed, and
  validated.
- The shell entrypoint remains stable.
- The eval artifact proves cognition improvement, validation parity, rollback
  safety, and Linear traceability.

## he-plan Handoff

Use this spec to generate a bounded plan for `Validation Typed Gate Specs Slice`.

Planning constraints:

- Start with `IU-VAL-001` snapshot-only.
- Do not include runtime extraction or typed runtime consumption in the first
  implementation unit.
- Keep `IU-VAL-001` to a single inventory artifact plus validation evidence.
- Use the phase admission table as the implementation-unit boundary.
- Do not admit `JSC-178` modularization scope.
- Do not modify CI ownership or branch protection.
- Make human review required before any runtime behavior change.
- Keep active work to one implementation unit at a time.

Expected plan file:

`.harness/plan/2026-05-09-JSC-290-validation-typed-gate-specs-plan.md`

Expected eval file:

`.harness/evals/coding-harness-validation-typed-gate-specs-eval.md`

## Blackboard Delta

```yaml
schema_version: he-blackboard-delta/v1
topic: validation-typed-gate-specs
selected_slice: Validation Typed Gate Specs Slice
linear_issue: JSC-290
next_stage: he-plan
first_active_unit: IU-VAL-001
guardrails:
  - snapshot_before_runtime_change
  - preserve_verify_work_entrypoint
  - typed_mirror_before_authoritative_runtime
  - parity_tests_before_shell_burn_down
  - human_review_before_resume_or_exit_semantics_change
blocking_eval: .harness/evals/coding-harness-validation-typed-gate-specs-eval.md
```

## Evidence And Traceability

| Claim | Evidence | Interpretation | Confidence |
| --- | --- | --- | --- |
| `verify-work.sh` is the stable entrypoint. | `scripts/verify-work.sh`; `docs/agents/04-validation.md`; `AGENTS.md`. | Preserve command surface during migration. | High |
| Validation orchestration is shell-heavy. | `scripts/verify-work.sh` owns gate definitions, run-state, resume, and failure handling. | Move stable metadata toward typed specs. | High |
| `validate-codestyle.sh` is a required baseline gate. | `scripts/validate-codestyle.sh`; `docs/agents/04-validation.md`; `package.json`. | Do not bypass or replace casually. | High |
| Typed gate specs are already the approved next slice. | `.harness/linear/coding-harness-linear-plan.md` after 2026-05-09 Linear delta capture. | This spec is the correct next `he-spec` target. | High |
| Runtime extraction before parity is unsafe. | `.harness/refactors/validation-orchestration-typed-gate-specs.md`; `.harness/core/execution-invariants.md`; ADR-006. | Start with snapshot and mirror. | High |
| Eval-backed closure is mandatory. | `.harness/core/execution-invariants.md`; refactor program eval requirements. | Linear closure requires `.harness/evals/coding-harness-validation-typed-gate-specs-eval.md`. | High |
