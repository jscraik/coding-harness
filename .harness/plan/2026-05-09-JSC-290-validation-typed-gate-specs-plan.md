---
schema_version: 1
artifact_id: jsc-290-validation-typed-gate-specs-plan
artifact_type: he-plan
canonical_slug: jsc-290-validation-typed-gate-specs
title: JSC-290 Validation Typed Gate Specs Plan
harness_stage: he-plan
status: draft
date: 2026-05-09
traceability_required: true
origin: .harness/specs/2026-05-09-validation-typed-gate-specs-spec.md
linear_issue: JSC-290
linear_status: Triage
linear_milestone: Validation Typed Gate Specs Slice (not present in Linear)
risk: migration-risk
depth: bounded
ui: false
---

# JSC-290 Validation Typed Gate Specs Plan

## Table Of Contents

- [Plan Decision](#plan-decision)
- [Stage Context](#stage-context)
- [Linear Work Item Contract](#linear-work-item-contract)
- [Source Authority](#source-authority)
- [Linear Delta Capture](#linear-delta-capture)
- [Scope Guardrails](#scope-guardrails)
- [Implementation Units](#implementation-units)
- [IU-VAL-001 Read-Only Gate Graph Inventory](#iu-val-001-read-only-gate-graph-inventory)
- [IU-VAL-001 Inventory Artifact Contract](#iu-val-001-inventory-artifact-contract)
- [IU-VAL-001 Evidence Capture Procedure](#iu-val-001-evidence-capture-procedure)
- [IU-VAL-001 Shell-Native Classification Rules](#iu-val-001-shell-native-classification-rules)
- [IU-VAL-002 Non-Authoritative Typed Mirror](#iu-val-002-non-authoritative-typed-mirror)
- [IU-VAL-003 Shell And Typed Parity Tests](#iu-val-003-shell-and-typed-parity-tests)
- [IU-VAL-004 Failure Taxonomy And Artifact Contract](#iu-val-004-failure-taxonomy-and-artifact-contract)
- [IU-VAL-005 Resume Model Fixtures](#iu-val-005-resume-model-fixtures)
- [Later Runtime Burn-Down](#later-runtime-burn-down)
- [Phase Admission Rules](#phase-admission-rules)
- [Validation Gates](#validation-gates)
- [Rollback And Stop Rules](#rollback-and-stop-rules)
- [Human Review Gates](#human-review-gates)
- [Review Gates](#review-gates)
- [Linear Mapping](#linear-mapping)
- [Linear / Spec / Plan / PR Traceability](#linear--spec--plan--pr-traceability)
- [Acceptance Traceability](#acceptance-traceability)
- [Confidence Hardening Notes](#confidence-hardening-notes)
- [Evidence And Traceability](#evidence-and-traceability)
- [Post-Plan Handoff](#post-plan-handoff)
- [Blackboard Delta](#blackboard-delta)

## Plan Decision

This plan admits one bounded execution slice:

`JSC-290` / `Validation Typed Gate Specs Slice`.

The first executable implementation unit is `IU-VAL-001` only. It is
inventory-only and may produce a durable review artifact plus validation
evidence. It must not edit runtime source, package scripts, CI configuration,
or validation wrapper behavior.

The plan deliberately preserves `bash scripts/verify-work.sh` and
`bash scripts/validate-codestyle.sh` as stable command entrypoints. The
migration path is characterization first, typed mirror second, parity third,
and runtime burn-down only after human review and eval proof.

## Stage Context

```yaml
schema_version: 1
stage_context:
  selected_stage: he-plan
  selected_slice: "Validation Typed Gate Specs Slice / JSC-290"
  slice_status: resolved
  tracker_status: refresh_required_before_work
  artifact_identity_status: pass
  artifact_route_status: pass
  evidence_freshness: repo_sources_fresh_linear_refresh_required
  session_trace_status: resolved
  linear_delta_status: pass_with_note
  domain_skill_status: not_applicable
  steering_status: not_needed
  coding_harness_status: pass
  project_brain_status: not_checked
  validation_status: pass
  blocker: null
```

`linear_delta_status` is `pass_with_note` because live Linear has no
`Validation Typed Gate Specs Slice` milestone in the `coding-harness` project as
of this plan. The parent issue `JSC-290` exists and is sufficient for planning.
Milestone creation or attachment is a tracking decision before active
implementation management, not a blocker for the read-only inventory unit.

## Linear Work Item Contract

| Field | Value |
| --- | --- |
| Workspace/team | `Jscraik` / `JSC` |
| Top-level initiative | `Dev Portfolio` |
| Project | `coding-harness` |
| Parent issue | `JSC-290` |
| Parent title | `[coding-harness] Mirror validation gate graph in typed specs` |
| Last observed parent status | `Triage` from the spec and prior Linear creation evidence; refresh live Linear before work |
| Priority | High / `2` |
| Last observed labels | `Reliability`, `Agent-Native`, `CE: Spec`, `Refactor`, `Drift-Risk`, `architecture`; refresh live Linear before work |
| Planned milestone | `Validation Typed Gate Specs Slice` |
| Live milestone status | Not present in Linear project milestone list |
| Execution route | Agent-assisted; human review before wrapper behavior changes |
| First active unit | `IU-VAL-001` |
| Required eval | `.harness/evals/coding-harness-validation-typed-gate-specs-eval.md` |

No Linear objects should be created by this plan. If tracking needs to become
active before `he-work`, create or attach the planned milestone explicitly in a
Linear update stage. The active agent must treat Linear state in this artifact
as last-observed planning evidence, not current truth.

## Source Authority

Primary authorities:

| Source | Role |
| --- | --- |
| `.harness/specs/2026-05-09-validation-typed-gate-specs-spec.md` | Approved bounded spec and acceptance source. |
| `.harness/linear/coding-harness-linear-plan.md` | Execution routing and parent issue context. |
| `.harness/refactors/validation-orchestration-typed-gate-specs.md` | Migration sequencing and rollback posture. |
| `.harness/review/2026-05-09-JSC-290-validation-typed-gate-specs-technical-review.md` | Review findings already repaired before planning. |
| `.harness/core/execution-invariants.md` | Validation, rollback, and eval closure invariants. |
| `.harness/core/architecture-invariants.md` | Stable shell-entrypoint and typed-internal boundary. |
| `.harness/decisions/ADR-006-no-new-behavior-in-oversized-orchestrators.md` | Decision against adding new behavior to oversized orchestrators. |

Live implementation evidence:

| Source | Fact used by this plan |
| --- | --- |
| `scripts/verify-work.sh` | Owns current gate plan, run-state emission, resume behavior, and failure handling. |
| `scripts/validate-codestyle.sh` | Required baseline validation wrapper. |
| `docs/agents/04-validation.md` | Documents full validation proof requirements and run-state semantics. |
| `package.json` | Defines validation-related scripts that must not change in the inventory unit. |

Secondary review, strategy, and triage artifacts are not admitted as additional
scope. They are only context.

## Linear Delta Capture

Last-observed Linear milestone check:

- Command/tool: Linear milestone list for project `coding-harness` during the
  preceding delta-capture stage.
- Result: existing milestones are `Gold-standard foundation (2026 H1)`,
  `Control loop hardening and flow telemetry`, `Agent Cockpit Compression
  Slice`, `Governance Trust Repair Slice`, and `CI Migration Boundary Recovery
  Slice`.
- Delta: `Validation Typed Gate Specs Slice` is not present.
- Classification: tracking delta, not implementation-scope delta.
- Response: keep planning under `JSC-290`; recommend milestone creation or
  attachment only if the user wants active Linear milestone tracking before
  `he-work`.

Because Linear state is external and can change after this artifact is written,
`he-work` must refresh `JSC-290` and the `coding-harness` project milestone list
before editing. If the connector or CLI cannot refresh Linear, stop and report a
tracking-evidence blocker instead of inferring current state from this plan.

The local Linear plan already classifies stale closure cleanup for `JSC-282`,
`JSC-283`, `JSC-288`, and `JSC-289` as separate from this new implementation
slice. Do not reopen those scopes during JSC-290.

## Scope Guardrails

In scope:

- Inventory current validation gate graph and run-state behavior.
- Add mirror-only typed metadata after the inventory is accepted.
- Add tests that prove shell and typed metadata cannot drift silently.
- Keep validation wrappers stable.
- Produce eval-backed closure after implementation evidence exists.

Out of scope:

- Runtime extraction in `IU-VAL-001`.
- Rewriting `scripts/verify-work.sh` in TypeScript.
- Removing or renaming `scripts/verify-work.sh`.
- Changing `scripts/validate-codestyle.sh`.
- Changing `package.json` scripts.
- CI provider ownership changes.
- Branch protection or required-check migration.
- `JSC-178` contract validation modularization.
- `JSC-289` CI migration boundary work.
- New public CLI commands.

## Implementation Units

| Unit | Title | Acceptance IDs | Expected output | Agent-safe | Human review |
| --- | --- | --- | --- | --- | --- |
| `IU-VAL-001` | Read-only gate graph inventory. | `SA-VAL-001`, `SA-VAL-006`, `SA-VAL-007` | `.harness/review/2026-05-09-JSC-290-validation-gate-graph-inventory.md` | Yes | No, unless evidence contradicts live behavior |
| `IU-VAL-002` | Add non-authoritative typed gate mirror. | `SA-VAL-002`, `SA-VAL-006`, `SA-VAL-007` | `src/lib/validation/**` metadata and focused tests | Agent-assisted | Required before runtime consumption |
| `IU-VAL-003` | Add shell/typed parity tests. | `SA-VAL-003`, `SA-VAL-006`, `SA-VAL-007` | Focused parity tests that fail on mismatch | Agent-assisted | Required if parsing shell evidence is brittle |
| `IU-VAL-004` | Extract failure taxonomy and artifact contract metadata. | `SA-VAL-004`, `SA-VAL-006`, `SA-VAL-007` | Typed failure/artifact metadata plus tests | Agent-assisted | Required before wording/schema changes |
| `IU-VAL-005` | Add resume model fixtures. | `SA-VAL-005`, `SA-VAL-006`, `SA-VAL-007` | Compatible and incompatible resume fixtures | Agent-assisted | Required before resume behavior changes |
| Later | Runtime shell policy burn-down. | `SA-VAL-008`, `SA-VAL-009` | Small extraction after parity and eval proof | Assisted | Required |

Only `IU-VAL-001` is authorized as the next active unit from this plan.

## IU-VAL-001 Read-Only Gate Graph Inventory

Objective:

Capture the live validation model in a durable inventory without changing
runtime behavior.

Allowed files:

- `.harness/review/2026-05-09-JSC-290-validation-gate-graph-inventory.md`
- Optional validation evidence notes inside the same artifact.

Forbidden files:

- `scripts/verify-work.sh`
- `scripts/validate-codestyle.sh`
- `package.json`
- `.github/**`
- `.circleci/**`
- `src/**`
- `tests/**`
- `harness.contract.json`
- `.harness/ci-required-checks.json`

Required inventory sections:

- Table of Contents.
- Runtime edits statement: `none`.
- Source files inspected.
- `verify-work.sh --help` accepted flags.
- `validate-codestyle.sh --help` accepted flags.
- Fast-mode gate graph.
- Full-mode gate graph.
- Gate IDs.
- Execution classes.
- Default failure classes.
- Command surface per gate.
- Run-level artifact fields for `run.json`.
- Gate-level artifact fields for `gates/<gate-id>.json`.
- Summary artifact fields for `summary.json`.
- Resume compatibility checks.
- Retry behavior and limits.
- Failure-class next actions.
- Shell-native behavior that should remain out of typed scope.
- Candidate parity tests for `IU-VAL-003`.
- Diff checklist proving no behavior-changing files changed.
- Validation evidence with exact command outcomes.

Commands to gather evidence:

```bash
bash scripts/verify-work.sh --help
bash scripts/validate-codestyle.sh --help
rg -n "add_gate|build_gate_plan|run_gate_command|record_gate_result|find_resume_source_run_dir|hydrate_prior_passes|read_only_parallel|serial_guarded|transient_infra|contract_policy|internal_unknown" scripts/verify-work.sh
rg -n "validate-codestyle.sh|verify-work.sh|resume-from|run-state|read_only_parallel|serial_guarded" docs/agents/04-validation.md
rg -n '"check"|"lint"|"typecheck"|"test"|"test:deep"|"codestyle:validate"|"workflow:validate"|"quality:docstrings"|"quality:size"' package.json
git diff --name-only
```

Validation requirements:

```bash
python3 "$AGENT_SKILLS_ROOT/Infrastructure/scripts/validation-and-linting/he_artifact_identity_lint.py" .harness/review/2026-05-09-JSC-290-validation-gate-graph-inventory.md
python3 "$AGENT_SKILLS_ROOT/Infrastructure/scripts/validation-and-linting/he_linear_traceability_lint.py" .harness/review/2026-05-09-JSC-290-validation-gate-graph-inventory.md
python3 "$AGENT_SKILLS_ROOT/Infrastructure/scripts/validation-and-linting/he_frontmatter_safety_lint.py" .harness/review/2026-05-09-JSC-290-validation-gate-graph-inventory.md
pnpm markdownlint .harness/review/2026-05-09-JSC-290-validation-gate-graph-inventory.md
bash scripts/validate-codestyle.sh --fast
bash scripts/validate-codestyle.sh
```

Rollback:

Delete or revise only the inventory artifact. Do not edit runtime files to make
the inventory cleaner.

Stop conditions:

- Inventory cannot explain a current gate from live shell evidence.
- A required validation source cannot be read.
- `bash scripts/validate-codestyle.sh --fast` or full
  `bash scripts/validate-codestyle.sh` cannot run and no concrete environment
  blocker can be recorded.
- Any runtime file changes appear in the diff.
- Any generated or untracked validation artifact appears after validation and
  cannot be classified as pre-existing, disposable, or in-scope evidence.

## IU-VAL-001 Inventory Artifact Contract

The inventory artifact must be written as a review artifact, not a spec,
implementation plan, or eval:

```yaml
schema_version: 1
artifact_id: jsc-290-validation-gate-graph-inventory
artifact_type: he-code-review-inventory
canonical_slug: jsc-290-validation-gate-graph-inventory
title: JSC-290 Validation Gate Graph Inventory
harness_stage: he-code-review
status: draft
date: 2026-05-09
traceability_required: true
origin: .harness/plan/2026-05-09-JSC-290-validation-typed-gate-specs-plan.md
linear_issue: JSC-290
linear_status: Triage
linear_milestone: Validation Typed Gate Specs Slice (not present in Linear)
```

Required inventory tables:

| Table | Required columns | Purpose |
| --- | --- | --- |
| Source Evidence | `Source`, `Command or path`, `Observed fact`, `Confidence` | Prevents inferred shell behavior from becoming source truth. |
| Gate Graph | `Gate ID`, `Fast`, `Full`, `Order`, `Execution class`, `Failure class`, `Command surface`, `Source line evidence` | Captures the stable graph before typed metadata exists. |
| Run Artifacts | `Artifact`, `Required fields`, `Producer function or block`, `Consumer behavior`, `Source line evidence` | Captures `run.json`, per-gate JSON, and `summary.json`. |
| Resume Compatibility | `Compatibility check`, `Pass condition`, `Fail-closed behavior`, `Source line evidence` | Prevents unsafe resume inference. |
| Retry Behavior | `Gate or class`, `Retry allowed`, `Retry limit`, `Reason`, `Source line evidence` | Keeps `transient_infra` retry bounded. |
| Shell-Native Residue | `Behavior`, `Why it is shell-native`, `Typed mirror risk`, `Future extraction condition` | Avoids forcing dynamic shell behavior into premature typed metadata. |
| Candidate Parity Tests | `Test`, `Shell evidence`, `Typed assertion`, `Intentional mismatch case`, `Deferred until` | Feeds `IU-VAL-003` without implementing it early. |
| Diff Checklist | `Path group`, `Changed?`, `Allowed?`, `Evidence` | Proves `IU-VAL-001` stayed read-only. |

The inventory must quote source line ranges narrowly enough that a future agent
can re-check the claim. If a fact is inferred across multiple functions, record
that as interpretation, not hard evidence.

## IU-VAL-001 Evidence Capture Procedure

Execute the inventory in this order:

1. Re-read `scripts/verify-work.sh`, `scripts/validate-codestyle.sh`,
   `docs/agents/04-validation.md`, and `package.json`.
2. Capture `bash scripts/verify-work.sh --help` and
   `bash scripts/validate-codestyle.sh --help`.
3. Capture gate-definition evidence from `build_gate_plan`, `add_gate`, and the
   gate-command dispatcher.
4. Capture run-state evidence from the result writer, summary writer, resume
   lookup, compatibility matching, and prior-pass hydration code paths.
5. Capture docs evidence from `docs/agents/04-validation.md`, especially
   baseline validation, run-state, resume, and proof-language sections.
6. Write the inventory artifact.
7. Run `git diff --name-only` and record the diff checklist before validation.
8. Run artifact identity lint, Linear traceability lint, frontmatter safety lint,
   markdownlint, `bash scripts/validate-codestyle.sh --fast`, and full
   `bash scripts/validate-codestyle.sh`.
9. Run `git status --short` and `git diff --name-only` again after validation.
   Record any generated artifact as pre-existing, disposable, or in-scope
   evidence before claiming the phase is clean.

Do not run `bash scripts/verify-work.sh --fast` as the proof gate for
`IU-VAL-001` unless the inventory explicitly needs a fresh run-state sample.
The required closure baseline is `bash scripts/validate-codestyle.sh --fast`
followed by full `bash scripts/validate-codestyle.sh`; the inventory phase is
not allowed to create runtime artifacts merely to make the plan feel more
complete.

## IU-VAL-001 Shell-Native Classification Rules

Classify a behavior as shell-native for now when any of these are true:

- It depends on local process environment, temporary files, or portability
  mechanics rather than stable validation policy.
- It is fallback behavior for missing tools or generated artifacts.
- It would require sourcing or executing shell inside a TypeScript unit test to
  prove accurately.
- Its behavior is intentionally dynamic across repo stack, governance lane, or
  local workspace mode.
- The inventory can describe it, but a typed mirror would duplicate procedural
  shell control flow without reducing reasoning cost.

Classify a behavior as typed-mirror-ready when all of these are true:

- It is a stable string, enum, ordered gate list, field contract, or compatibility
  predicate.
- It can be validated by a deterministic test without running the full
  validation lane.
- It improves agent reasoning by making a decision visible without reading the
  entire shell script.
- It does not require changing the shell entrypoint or command behavior.

## IU-VAL-002 Non-Authoritative Typed Mirror

Objective:

Create typed metadata that mirrors stable validation gate facts without being
used by runtime execution.

Likely files:

- `src/lib/validation/gate-spec.ts`
- `src/lib/validation/gate-spec.test.ts`
- Optional narrower names if `IU-VAL-001` proves better boundaries.

Allowed work:

- Define gate IDs, mode membership, execution classes, failure classes,
  command surfaces, retry policy, and artifact contract fields.
- Add focused tests for shape and expected values.
- Keep metadata read-only and non-authoritative.

Blocked work:

- Import typed metadata from `scripts/verify-work.sh`.
- Change shell execution.
- Introduce a second command runner or plugin system.

Validation:

```bash
pnpm test -- src/lib/validation/gate-spec.test.ts
pnpm typecheck
bash scripts/validate-codestyle.sh --fast
bash scripts/validate-codestyle.sh
```

Rollback:

Remove the typed mirror and tests. The shell wrapper remains authoritative.

## IU-VAL-003 Shell And Typed Parity Tests

Objective:

Make typed metadata and shell evidence fail loudly when they drift.

Allowed work:

- Add tests that compare typed gate IDs, mode order, execution classes, failure
  classes, resume checkpoint coverage, and retry policy against captured or
  live shell evidence.
- Add an intentional mismatch fixture proving the test fails.

Blocked work:

- Running the full validation lane inside a normal unit test.
- Runtime shell consumption of typed metadata.

Validation:

```bash
pnpm test -- <focused parity test path>
bash scripts/validate-codestyle.sh --fast
bash scripts/validate-codestyle.sh
```

Rollback:

Remove parity tests and keep the typed mirror as non-authoritative until a safer
comparison boundary is designed.

## IU-VAL-004 Failure Taxonomy And Artifact Contract

Objective:

Represent stable failure classes, next-action expectations, and artifact
contract fields in typed metadata.

Allowed work:

- Type failure classes currently present in shell behavior.
- Type required run/gate/summary artifact fields.
- Add tests for failure-class metadata and artifact contract shape.

Blocked work:

- Changing human failure wording.
- Changing JSON schema or emitted fields.
- Altering retry behavior.

Validation:

```bash
pnpm test -- <focused failure taxonomy test path>
bash scripts/validate-codestyle.sh --fast
bash scripts/validate-codestyle.sh
```

Rollback:

Remove taxonomy metadata; shell remains source of truth.

## IU-VAL-005 Resume Model Fixtures

Objective:

Freeze resume compatibility semantics before any runtime extraction.

Fixture cases:

- Compatible prior run can hydrate prior passed gates.
- Missing prior gate result fails closed.
- Prior gate not passed fails closed.
- Unknown gate ID reports available gate IDs.
- Repo root mismatch fails closed.
- Schema version mismatch fails closed.
- Contract version mismatch fails closed.
- Contract fingerprint mismatch fails closed.
- Provider class mismatch fails closed.
- Lane flag mismatch fails closed.
- Reused gate fixtures include `reused` and `sourceRunId`.

Blocked work:

- Changing `--resume-from` behavior.
- Editing runtime compatibility matching.

Validation:

```bash
pnpm test -- <focused resume model test path>
bash scripts/validate-codestyle.sh --fast
bash scripts/validate-codestyle.sh
```

Rollback:

Remove fixtures or mark uncovered behavior as shell-native. Do not alter shell
resume behavior to satisfy fixtures without human review.

## Later Runtime Burn-Down

Runtime burn-down is not authorized by this plan until these are complete:

- `IU-VAL-001` inventory accepted.
- `IU-VAL-002` typed mirror exists.
- `IU-VAL-003` parity tests pass and fail on intentional mismatch.
- `IU-VAL-004` and `IU-VAL-005` cover failure and resume behavior.
- Human review accepts the specific runtime extraction boundary.
- Eval artifact proves behavior parity and cognition improvement.

Required validation for any runtime burn-down:

```bash
bash scripts/verify-work.sh --fast
bash scripts/validate-codestyle.sh --fast
bash scripts/validate-codestyle.sh
pnpm test:deep
```

## Phase Admission Rules

| Phase | Admission requirement | Completion requirement | May run in parallel |
| --- | --- | --- | --- |
| `IU-VAL-001` | This plan and spec exist; live validation sources readable; live Linear refresh confirms `JSC-290` is still the active slice. | Inventory artifact plus artifact identity, Linear traceability, frontmatter, markdown, fast, and full validation. | No |
| `IU-VAL-002` | `IU-VAL-001` accepted and no blocking review findings. | Typed mirror tests, typecheck, fast and full validation. | No |
| `IU-VAL-003` | Typed mirror exists and is non-authoritative. | Parity tests pass, mismatch fixture fails, fast and full validation pass. | No |
| `IU-VAL-004` | Parity boundary exists or failure metadata is clearly mirror-only. | Failure taxonomy tests plus fast and full validation. | Partly, after `IU-VAL-003` boundary |
| `IU-VAL-005` | Inventory proves resume behavior and artifact fields. | Resume fixtures plus fast and full validation. | No |
| Later burn-down | Human review and eval-backed boundary. | Wrapper validation, deep tests, eval proof. | No |

At the start of every phase, re-read:

- `scripts/verify-work.sh`
- `scripts/validate-codestyle.sh`
- `docs/agents/04-validation.md`
- `package.json`

If the live validation contract changed since the previous phase, refresh the
inventory or stop for human review.

Phase ownership rules:

- A phase may update this plan only to append phase evidence, blocker status, or
  human acceptance notes. It must not silently rewrite earlier phase boundaries.
- A later phase may rely on a previous phase only when its validation evidence is
  present and there are no unresolved critical, high, or medium technical-review
  findings against that phase's artifact.
- A phase that needs to edit a forbidden file must stop and request a plan
  revision before implementation.
- A phase cannot be marked complete if its evidence would require the eval
  artifact but the eval is still missing.

## Validation Gates

Plan artifact validation:

```bash
python3 "$AGENT_SKILLS_ROOT/Infrastructure/scripts/validation-and-linting/he_artifact_identity_lint.py" .harness/plan/2026-05-09-JSC-290-validation-typed-gate-specs-plan.md
python3 "$AGENT_SKILLS_ROOT/Infrastructure/scripts/validation-and-linting/he_linear_traceability_lint.py" .harness/plan/2026-05-09-JSC-290-validation-typed-gate-specs-plan.md
python3 "$AGENT_SKILLS_ROOT/Infrastructure/scripts/validation-and-linting/he_frontmatter_safety_lint.py" .harness/plan/2026-05-09-JSC-290-validation-typed-gate-specs-plan.md
pnpm markdownlint .harness/plan/2026-05-09-JSC-290-validation-typed-gate-specs-plan.md
```

Implementation validation:

- Every phase: `bash scripts/validate-codestyle.sh --fast` followed by full
  `bash scripts/validate-codestyle.sh` unless a concrete environment blocker is
  recorded.
- Runtime behavior changes: add `bash scripts/verify-work.sh --fast` and
  `pnpm test:deep`.
- Typed source changes: add focused tests and `pnpm typecheck`.
- Docs or harness artifact changes: add artifact identity/frontmatter lint and
  markdownlint.

Do not close any implementation unit on artifact existence alone.

## Rollback And Stop Rules

Stop immediately if:

- The selected work would modify a forbidden file for the active unit.
- Shell behavior must change before parity exists.
- A gate ID, execution class, failure class, or resume rule cannot be proven
  from live sources.
- Fast or full validation cannot run and the blocker is not concrete.
- Live Linear state contradicts `JSC-290` as the active slice or promotes a
  different parent issue or milestone into the active slice.
- The work starts pulling in `JSC-178`, `JSC-289`, CI provider ownership, or
  branch protection.

Rollback posture:

- `IU-VAL-001`: remove or correct only the inventory artifact.
- `IU-VAL-002` through `IU-VAL-005`: remove typed metadata/tests for the failed
  phase; keep prior accepted phases if their evidence remains true.
- Runtime burn-down: revert the extraction and leave shell as source of truth.

## Human Review Gates

Human review is required before:

- Typed metadata is consumed by runtime execution.
- `scripts/verify-work.sh` removes shell-owned policy.
- `--resume-from` behavior changes.
- Failure wording changes.
- JSON run-state schema changes.
- Exit-code semantics change.
- CI/local validation parity claims are made.

Human review is not required for:

- `IU-VAL-001` read-only inventory when evidence matches live behavior.
- Mirror-only typed metadata that is not consumed at runtime.
- Tests that assert current shell behavior without changing it.

## Review Gates

Before `he-work` starts `IU-VAL-001`, the active agent must verify that:

- This plan exists at
  `.harness/plan/2026-05-09-JSC-290-validation-typed-gate-specs-plan.md`.
- The latest technical review for this plan has no unresolved critical, high, or
  medium findings.
- Live Linear still has `JSC-290` as the active parent issue for this slice,
  and any milestone status change has been recorded before implementation.
- Live git status does not contain unrelated dirty runtime files.
- The current thread authorizes `IU-VAL-001` only, unless newer user guidance
  explicitly expands scope.

At the end of `IU-VAL-001`, run:

- `simplify` for artifact clarity and scope compression.
- `he-code-review` against the inventory artifact and diff.
- `he-fix-bugs` only if validation or review evidence fails.

Do not commit `IU-VAL-001` until review gates have no blocking findings and the
inventory artifact records exact validation outcomes.

## Linear Mapping

Recommended Linear structure:

| Linear object | Recommendation |
| --- | --- |
| Parent issue | Use existing `JSC-290`. |
| Milestone | Create or attach `Validation Typed Gate Specs Slice` only when active milestone tracking is desired. |
| Child issue for first unit | Optional: `[coding-harness] Snapshot verify-work gate graph and artifact expectations`. |
| Priority | High / `2`. |
| Labels | Reuse current parent labels; do not create new labels for this plan. |
| Active set | One implementation unit at a time. |

Suggested parent issue description update, if Linear is updated later:

```markdown
## Execution Plan
- Plan: .harness/plan/2026-05-09-JSC-290-validation-typed-gate-specs-plan.md
- First unit: IU-VAL-001 read-only gate graph inventory
- Stop rule: no runtime, package script, CI, or wrapper behavior edits in IU-VAL-001
- Eval: .harness/evals/coding-harness-validation-typed-gate-specs-eval.md
```

Do not create child issues for every acceptance criterion. Child issues should
exist only when a phase needs independent tracking.

## Linear / Spec / Plan / PR Traceability

| Linear issue | Source acceptance IDs | Plan units | Acceptance IDs | PR evidence |
| --- | --- | --- | --- | --- |
| `JSC-290` | `SA-VAL-001`, `SA-VAL-006`, `SA-VAL-007` | `IU-VAL-001` | `SA-VAL-001`, `SA-VAL-006`, `SA-VAL-007` | Read-only gate graph inventory, no-runtime-edit diff checklist, fast and full validation. |
| `JSC-290` | `SA-VAL-002`, `SA-VAL-006`, `SA-VAL-007` | `IU-VAL-002` | `SA-VAL-002`, `SA-VAL-006`, `SA-VAL-007` | Non-authoritative typed mirror and focused tests; runtime remains shell-authoritative. |
| `JSC-290` | `SA-VAL-003`, `SA-VAL-006`, `SA-VAL-007` | `IU-VAL-003` | `SA-VAL-003`, `SA-VAL-006`, `SA-VAL-007` | Parity tests and mismatch proof; typed/shell drift cannot pass silently. |
| `JSC-290` | `SA-VAL-004`, `SA-VAL-006`, `SA-VAL-007` | `IU-VAL-004` | `SA-VAL-004`, `SA-VAL-006`, `SA-VAL-007` | Failure taxonomy and artifact contract tests; no wording or schema behavior change without review. |
| `JSC-290` | `SA-VAL-005`, `SA-VAL-006`, `SA-VAL-007` | `IU-VAL-005` | `SA-VAL-005`, `SA-VAL-006`, `SA-VAL-007` | Resume compatibility fixtures; resume behavior remains fail-closed. |
| `JSC-290` | `SA-VAL-008`, `SA-VAL-009` | Later runtime burn-down | `SA-VAL-008`, `SA-VAL-009` | Eval artifact, wrapper validation, deep tests, human review; do not close parent or milestone without eval-backed acceptance. |

## Acceptance Traceability

| Acceptance ID | Plan unit | Evidence required | Closure rule |
| --- | --- | --- | --- |
| `SA-VAL-001` | `IU-VAL-001` | Gate graph inventory and no-runtime-edit diff checklist. | Inventory accepted and fast plus full validation pass. |
| `SA-VAL-002` | `IU-VAL-002` | Typed mirror module and focused tests. | Metadata remains non-authoritative. |
| `SA-VAL-003` | `IU-VAL-003` | Parity tests plus intentional mismatch failure proof. | Shell/typed drift cannot pass silently. |
| `SA-VAL-004` | `IU-VAL-004` | Typed failure taxonomy and artifact contract tests. | No wording/schema behavior change without review. |
| `SA-VAL-005` | `IU-VAL-005` | Resume fixtures for compatible and incompatible prior runs. | Fail-closed behavior proven. |
| `SA-VAL-006` | All units | Stable wrapper paths plus fast and full validation proof. | No command entrypoint regression. |
| `SA-VAL-007` | `IU-VAL-001` through eval | Agent can inspect gate graph without reading whole shell script. | Eval records cognition comparison. |
| `SA-VAL-008` | Later burn-down | Shell policy removal after parity. | Human review plus deep validation. |
| `SA-VAL-009` | Final eval | Eval artifact links spec, plan, tests, rollback, and Linear. | Parent issue not closed without eval. |

## Confidence Hardening Notes

The confidence loop for this plan checked the plan against these verified
sources:

- `bash scripts/verify-work.sh --help`
- `bash scripts/validate-codestyle.sh --help`
- `scripts/verify-work.sh` gate construction, gate execution, run-state, retry,
  and resume code paths
- `docs/agents/04-validation.md` baseline, run-state, resume, and proof-language
  sections
- `package.json` validation command contract
- `.harness/refactors/validation-orchestration-typed-gate-specs.md`
- `.harness/core/execution-invariants.md`
- `.harness/core/architecture-invariants.md`
- `.harness/decisions/ADR-006-no-new-behavior-in-oversized-orchestrators.md`

Loopholes closed during confidence hardening:

| Loophole | Fix |
| --- | --- |
| Inventory frontmatter requires Linear traceability but the phase validation omitted the Linear traceability lint. | Added `he_linear_traceability_lint.py` to `IU-VAL-001` validation and completion requirements. |
| The plan could proceed with unresolved medium review findings. | Review and phase-admission gates now block unresolved critical, high, or medium findings. |
| Diff proof before validation could miss files generated by validation itself. | `IU-VAL-001` now requires pre-validation and post-validation diff/status checks. |
| Linear state was described too strongly as live even though Linear can drift after artifact creation. | Reworded Linear fields as last-observed evidence and added a required live refresh/stop rule before `he-work`. |

Known verification limit:

The Linear connector was attempted during confidence hardening but did not return
current issue/project data in this session. That does not invalidate the plan
because the plan now treats Linear as a required pre-work refresh gate. It does
mean no agent may claim current Linear truth from this plan alone.

## Evidence And Traceability

| Claim | Evidence | Confidence | Plan impact |
| --- | --- | --- | --- |
| `verify-work.sh` is stable entrypoint. | `scripts/verify-work.sh`; `docs/agents/04-validation.md`; spec baseline evidence. | High | Preserve wrapper path and command behavior. |
| Validation policy is shell-heavy. | `scripts/verify-work.sh` gate definitions, run-state, resume, failure handling. | High | Inventory before typed migration. |
| Fast plus full `validate-codestyle.sh` are required for closeout. | `docs/agents/04-validation.md`; repaired technical review. | High | Every phase requires fast and full validation or concrete blocker. |
| Typed mirror must start non-authoritative. | ADR-006; refactor program; spec phase admission table. | High | No runtime consumption before parity and review. |
| Linear milestone is missing. | Live Linear milestone list for project `coding-harness`. | High | Use `JSC-290`; milestone creation is optional tracking work. |
| Eval-backed closure is mandatory. | `.harness/core/execution-invariants.md`; spec done definition. | High | Do not close JSC-290 before eval artifact. |

## Post-Plan Handoff

```yaml
post_plan_handoff:
  state: explicit_stop
  selected_next_stage: he-work
  evidence: ".harness/plan/2026-05-09-JSC-290-validation-typed-gate-specs-plan.md"
  next_action: "Invoke he-work on this plan and start with IU-VAL-001 only."
```

This plan does not automatically proceed to implementation. `he-work` is the
next eligible stage once the user authorizes it.

## Blackboard Delta

```yaml
schema_version: he-blackboard-delta/v1
topic: validation-typed-gate-specs
selected_slice: Validation Typed Gate Specs Slice
linear_issue: JSC-290
plan: .harness/plan/2026-05-09-JSC-290-validation-typed-gate-specs-plan.md
next_stage: he-work
first_active_unit: IU-VAL-001
guardrails:
  - inventory_only_first
  - preserve_verify_work_entrypoint
  - preserve_validate_codestyle_baseline
  - typed_mirror_before_runtime_authority
  - parity_before_shell_burn_down
  - human_review_before_resume_or_exit_semantics_change
blocking_eval: .harness/evals/coding-harness-validation-typed-gate-specs-eval.md
```
