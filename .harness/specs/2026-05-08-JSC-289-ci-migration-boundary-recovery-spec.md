---
schema_version: 1
artifact_id: jsc-289-ci-migration-boundary-recovery-spec
artifact_type: he-spec
canonical_slug: jsc-289-ci-migration-boundary-recovery
title: JSC-289 CI Migration Boundary Recovery Spec
harness_stage: he-spec
status: draft
date: 2026-05-08
traceability_required: true
origin: .harness/linear/coding-harness-linear-plan.md
linear_issue: JSC-289
linear_status: Triage
linear_milestone: CI Migration Boundary Recovery Slice
risk: migration-risk
depth: bounded
ui: false
---

# JSC-289 CI Migration Boundary Recovery Spec

## Table Of Contents

- [Mode Decision](#mode-decision)
- [Problem](#problem)
- [Goals](#goals)
- [Non-Goals](#non-goals)
- [Linear Work Item Contract](#linear-work-item-contract)
- [Boundary And Scope](#boundary-and-scope)
- [Baseline Evidence](#baseline-evidence)
- [Loophole Closure Notes](#loophole-closure-notes)
- [Domain Model](#domain-model)
- [Lifecycle And State Model](#lifecycle-and-state-model)
- [Interfaces And Surfaces](#interfaces-and-surfaces)
- [Characterization Contract](#characterization-contract)
- [Validation Contract](#validation-contract)
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

This is an architecture refactor specification for `JSC-289`.

The first execution slice must be characterization-only. Do not extract modules,
change CI migration behavior, rewrite provider logic, or move policy boundaries
until the current command behavior is recorded as deterministic evidence.

## Problem

`src/commands/ci-migrate-core.ts` has become the repo's highest-risk oversized
orchestrator. It combines command parsing, provider selection, branch protection
proofs, provenance, snapshots, break-glass workflows, merge-queue evidence,
proof-pack reporting, rollback behavior, and user-facing JSON output in one
large runtime path.

That shape makes local reasoning expensive. Future agents can easily repair one
CI migration concern while accidentally changing another because the current
file does not make lifecycle boundaries obvious. The risk is not merely file
size; the risk is that CI governance behavior, user-facing CLI behavior, and
artifact proof behavior are tightly interleaved.

The architecture must move toward smaller lifecycle boundaries, but a direct
extraction without characterization would be unsafe. CI migration is a governance
surface, so compatibility proof matters more than fast reshaping.

## Goals

- Capture the current CI migration command contract before extraction.
- Record deterministic characterization evidence for the visible action,
  provider, dry-run, JSON, artifact, and failure paths.
- Characterize delegated registry actions, environment-sensitive paths, and
  snapshot/signing behavior that have previously caused operational drift.
- Define the first safe extraction boundary without changing public CLI
  behavior.
- Preserve the stable `ci-migrate` command entrypoint while reducing hidden
  orchestration.
- Make `JSC-289` traceable from Linear issue to spec, plan, implementation
  phases, validation, and eval artifact.

## Non-Goals

- Do not rewrite the CI migration system.
- Do not change provider behavior for `github-actions` or `circleci`.
- Do not clean up orphan GitHub Actions workflows in this slice.
- Do not absorb `JSC-178` contract-registry modularization scope.
- Do not absorb `JSC-248` cockpit umbrella scope.
- Do not change break-glass, merge-queue, release, or security policy semantics
  before characterization proves the current behavior.
- Do not introduce a new framework or plugin system for CI migration.

## Linear Work Item Contract

| Field | Value |
| --- | --- |
| Linear issue | `JSC-289` |
| Title | `[coding-harness] Characterize and split CI migration lifecycle boundaries` |
| Project | `coding-harness` |
| Initiative | `Dev Portfolio` |
| Milestone | `CI Migration Boundary Recovery Slice` |
| Priority | High / `2` |
| Labels | `Reliability`, `architecture`, `Refactor`, `Drift-Risk` |
| Execution route | Agent-assisted; human review required at phase boundaries |
| Source plan | `.harness/linear/coding-harness-linear-plan.md` |
| Source refactor | `.harness/refactors/ci-migration-boundary-recovery.md` |
| Required eval | `.harness/evals/coding-harness-ci-migration-boundary-recovery-eval.md` |

## Boundary And Scope

In scope:

- `src/commands/ci-migrate-core.ts`
- `src/commands/ci-migrate.ts`
- `src/commands/ci-migrate.test.ts`
- `src/lib/ci/ci-migrate-command-contract.ts`
- `src/lib/cli/registry/command-specs-core.ts`
- New characterization fixtures or focused tests needed to freeze current
  command behavior.
- Harness artifacts for plan, review, eval, and traceability.

Out of scope:

- Provider rewrite.
- CI ownership migration.
- Broad release governance refactor.
- GitHub workflow deletion.
- Behavior-changing edits without prior characterization.
- New external services or runtime dependencies.

## Baseline Evidence

Hard evidence from the repository:

- `src/commands/ci-migrate-core.ts` is 10,402 lines.
- `src/commands/ci-migrate.test.ts` is 6,319 lines.
- `src/commands/ci-migrate.ts` is an export-only shim for
  `./ci-migrate-core.js`.
- `src/lib/ci/ci-migrate-command-contract.ts` defines the valid actions
  `prepare`, `commit`, `abort`, `verify`, and `bootstrap`.
- `src/lib/ci/ci-migrate-command-contract.ts` defines the valid providers
  `github-actions` and `circleci`, with default provider `circleci`.
- `src/lib/cli/registry/command-specs-core.ts` registers the public
  `ci-migrate` CLI surface and dispatches to `runCIMigrateCLI`.
- `src/lib/cli/registry/command-specs-core.ts` also routes positional
  `sync-branch-protection` to `runSyncBranchProtectionCLI` and `promote-mode`
  to `runPromoteModeCLI`; these are public `ci-migrate` registry paths even
  though they are not `CIMigrateAction` values.
- `src/commands/ci-migrate-core.ts` accepts runtime options for provider,
  dry-run, JSON, apply, rollback, snapshot, break-glass approval, merge-queue
  evidence/orchestrator, proof-pack generation, commit mode, and bootstrap
  force.
- `src/commands/ci-migrate.test.ts` already exercises many `runCIMigrateCLI`
  paths, including prepare/commit/abort/verify, dry-run JSON output, merge queue
  evidence, proof packs, strict verify behavior, and bootstrap behavior.

Interpretation:

The command has meaningful test coverage, but the tests live beside an oversized
orchestrator and do not yet form a clean characterization boundary that future
extractions can use as a compatibility contract.

Memory-derived operational warnings to verify during planning:

- `harness ci-migrate` has required `HARNESS_CI_MIGRATE_SIGNING_KEY` in prior
  runs; specs and plans must distinguish credential absence from code failure.
- Snapshot IDs have behaved as single-use in prior partial runs; repeated
  characterization runs must use deterministic fresh IDs or isolate state.
- `sync-branch-protection --json` has previously reported success without full
  live ruleset alignment; do not treat JSON success alone as live governance
  proof when that delegated path is in scope.
- Generated scaffold churn and stale contract-hash manifests have previously
  appeared after CI migration work; implementation must distinguish generated
  artifact drift from logic regressions before editing or reverting files.

## Loophole Closure Notes

This spec closes the following planning loopholes:

- **Action mismatch:** `CIMigrateAction` covers `prepare`, `commit`, `abort`,
  `verify`, and `bootstrap`; the command registry additionally exposes
  `sync-branch-protection` and `promote-mode` as delegated `ci-migrate`
  positional actions. Characterization must classify both sets separately.
- **Credential ambiguity:** tests or direct runs blocked by missing
  `HARNESS_CI_MIGRATE_SIGNING_KEY` are credential blockers, not runtime
  compatibility proof.
- **Snapshot reuse ambiguity:** repeated test or CLI runs must not reuse a
  snapshot ID when behavior depends on first-use state.
- **Live governance false confidence:** delegated branch-protection sync JSON
  output is not enough to prove live ruleset alignment; live reads are required
  only when that delegated path is intentionally exercised.
- **Generated artifact churn:** scaffold or manifest churn after CI migration
  commands must be inventoried and classified before any cleanup. Do not fold
  unrelated generated diffs into the refactor.
- **Test bulk ambiguity:** the existing 6,319-line test file is coverage
  evidence, not automatically a characterization contract. `he-plan` must name
  the specific tests or fixtures that anchor each public behavior.

## Domain Model

| Term | Meaning | Boundary implication |
| --- | --- | --- |
| CI migration action | The lifecycle command mode: `prepare`, `commit`, `abort`, `verify`, or `bootstrap`. | Actions should become explicit lifecycle handlers, not scattered branches. |
| Delegated registry action | Registry-level `ci-migrate` action such as `sync-branch-protection` or `promote-mode` that bypasses `runCIMigrateCLI`. | Characterize separately from `CIMigrateAction`; do not break delegated dispatch while extracting runtime code. |
| Provider | The CI backend contract: `circleci` or `github-actions`. | Provider behavior should sit behind adapters after characterization. |
| Proof pack | Evidence bundle proving migration state, parity, provenance, and gate readiness. | Reporting/proof generation is a candidate extraction boundary. |
| Snapshot | Persisted migration state used for rollback, verification, and audit. | State-store behavior must remain stable before moving code. |
| Signing key | Environment-backed secret required for snapshot/proof attestation in some paths. | Missing key is a validation blocker to classify, not a reason to weaken tests. |
| Break glass | Emergency policy/approval path. | Governance-sensitive; do not change before characterization. |
| Merge queue evidence | Data proving merge queue policy and branch-protection readiness. | CI ownership-sensitive; characterize before adapter extraction. |

## Lifecycle And State Model

Current public lifecycle:

1. `prepare` computes or stages migration evidence.
2. `commit` applies or records migration state.
3. `abort` rolls back pending or staged migration state.
4. `verify` checks parity, policy, and readiness evidence.
5. `bootstrap` initializes migration control-plane surfaces.
6. `sync-branch-protection` delegates to the branch-protection sync command.
7. `promote-mode` delegates to the promotion-mode command.

Required migration model:

1. Freeze visible behavior through characterization.
2. Identify one lifecycle boundary with stable inputs/outputs.
3. Extract behind the existing command entrypoint.
4. Prove unchanged public behavior through focused tests and eval evidence.
5. Only then select the next extraction boundary.

## Interfaces And Surfaces

Stable interfaces:

- Public CLI command: `ci-migrate`.
- Command registry dispatch to `runCIMigrateCLI`.
- Valid actions and providers in `ci-migrate-command-contract.ts`.
- JSON output shape for `--json` paths.
- Dry-run behavior.
- Artifact paths and proof-pack outputs.
- Failure categories and exit semantics.
- Existing shell and harness gates that call CI migration behavior.
- Delegated registry dispatch for `sync-branch-protection` and `promote-mode`.

Candidate internal boundaries:

- Lifecycle planning.
- Provider adapters.
- Snapshot/state store.
- Parity proof.
- Break-glass policy.
- Merge-queue evidence.
- Reporting/proof-pack generation.

## Characterization Contract

`he-plan` must map every characterization requirement to one or more exact
tests, fixtures, or direct command probes.

Minimum Phase 1 characterization set:

| Surface | Required proof | Notes |
| --- | --- | --- |
| Command registry routing | Positional action parsing, `--action` parsing, target-dir validation, and delegated action routing are documented. | Must distinguish `runCIMigrateCLI` actions from delegated registry actions. |
| Action parsing edge cases | Missing action, empty `--action`, unsupported action, positional action, `--action` value, delegated positional action, delegated `--action` value, and too-many-positionals behavior are covered or explicitly deferred. | This pins fallback and error behavior before extraction. |
| Action lifecycle | `prepare`, `commit`, `abort`, `verify`, and `bootstrap` have explicit coverage anchors. | Existing tests may be reused if named precisely. |
| Provider handling | Default `circleci`, explicit `circleci`, explicit `github-actions`, and invalid provider behavior are characterized. | Do not change provider defaults in this work. |
| Output modes | Human output, `--json`, and `--dry-run --json` paths are covered where currently supported. | JSON snapshots must avoid unstable timestamps unless normalized. |
| Snapshot/state paths | Snapshot ID validation, first-use behavior, reuse failure, rollback state, and generated artifact paths are recorded. | Use isolated temp dirs and fresh deterministic snapshot IDs. |
| Signing/attestation | Required signing-key paths and missing-key errors are classified. | Never commit or log secret values. |
| Proof-pack/reporting | Report schema, proof-pack generation, attestation, and signature paths are characterized before extraction. | Candidate first extraction boundary. |
| Break-glass governance | Approval, roster, policy, and workflow artifact schema paths are identified. | Governance-sensitive; no behavior changes in Phase 1. |
| Merge-queue governance | Evidence, orchestrator, provider API, and window schema paths are identified. | Governance-sensitive; no behavior changes in Phase 1. |
| Delegated branch protection | `sync-branch-protection` dispatch is characterized; live ruleset proof is separate from JSON success. | Live external checks require explicit plan approval. |
| Promotion mode | `promote-mode` dispatch is characterized enough to preserve registry behavior. | Do not expand into promotion policy redesign. |
| Generated artifacts | Any generated scaffold/hash/contract churn is inventoried and classified. | Do not clean unrelated generated diffs in this slice. |

Phase 1 deliverable:

- A plan/evidence artifact that names the source tests or fixtures for every row
  above.
- A gap list for uncovered paths, with explicit choice to add a fixture now,
  defer to a later extraction phase, or mark out of scope.

## Validation Contract

Minimum validation before Phase 1 completion:

- Artifact identity and Linear traceability lint for this spec and the generated
  plan/eval artifacts.
- Focused CI migration characterization test command selected by `he-plan`.
- `pnpm typecheck` if TypeScript source or test code changes.
- `pnpm markdownlint` for changed Markdown artifacts.
- `bash scripts/validate-codestyle.sh --fast` for implementation slices that add
  or change source/test behavior.
- `git diff --check`.
- A dirty-worktree review proving only JSC-289 files are included.

Minimum validation before any extraction phase completion:

- Focused characterization tests from Phase 1 still pass.
- Focused tests for the extracted boundary pass.
- `pnpm typecheck`.
- `pnpm check` unless the plan records a concrete blocker or a narrower
  repo-approved command that genuinely covers the touched production path.
- `bash scripts/validate-codestyle.sh`.
- `bash scripts/verify-work.sh --fast`.
- `pnpm test:related` or a narrower repo-approved command only if it exercises
  the touched production path.
- `pnpm test:deep` if runtime or artifact behavior changes.
- Architecture drift review proves extracted modules do not import the old core
  as a hidden dependency.
- Eval artifact records exact command outcomes and rollback conditions.

Blocked validation must be recorded as blocked with the exact blocker. Missing
credentials, unavailable external services, and live-API restrictions are not
test passes.

## Human Review Gates

Human review is required:

- After Phase 1 characterization, before selecting the first extraction
  boundary.
- Before changing break-glass, merge-queue, branch-protection, promotion, or
  proof-pack semantics.
- Before converting any delegated registry action into a different public CLI
  surface.
- Before accepting live external API evidence as closure proof.
- Before deleting or rewriting generated governance artifacts that changed
  during CI migration commands.

## Invariants

- Keep the public `ci-migrate` command stable.
- Do not add new behavior to `ci-migrate-core.ts` unless it is part of a
  staged extraction approved by plan and review.
- Do not let extracted modules import `ci-migrate-core.ts` as a hidden
  dependency.
- Do not change provider defaults or valid action names without an ADR-level
  compatibility decision.
- Do not drop delegated `ci-migrate` registry actions without an ADR-level
  compatibility decision.
- Do not change break-glass, merge-queue, or proof-pack semantics without
  characterization and human review.
- Do not treat missing signing credentials or reused snapshot IDs as generic
  test failures.
- Every extraction phase must have rollback conditions before implementation.
- Every completed phase requires exact validation outcomes and eval proof.

## Failure And Recovery

Stop the migration if:

- Characterization output is non-deterministic.
- Characterization cannot isolate snapshot state or credential requirements.
- Tests cannot distinguish documentation artifact failure from runtime behavior
  failure.
- A proposed extraction requires public CLI behavior changes.
- An extracted module depends on the old core as a hidden runtime boundary.
- Existing CI migration tests fail for reasons unrelated to intentional
  characterization updates.
- Generated scaffold or contract-hash churn appears and ownership cannot be
  classified.
- Dirty worktree ownership is unclear.

Rollback strategy:

- Before extraction, rollback is deletion of new characterization artifacts.
- During extraction, rollback is restoring the old command path and preserving
  the characterization tests as compatibility evidence.
- If behavior drift is discovered, stop and write the drift into the eval
  artifact before continuing.

## Observability And Evidence

Required evidence:

- Exact command outcomes for focused tests and gates.
- Characterization artifact or fixture naming the action/provider/output paths
  covered.
- Characterization matrix mapping action, provider, output mode, artifact path,
  credential requirement, and known drift risk.
- Diff evidence showing public command entrypoint remains stable.
- Eval artifact at
  `.harness/evals/coding-harness-ci-migration-boundary-recovery-eval.md`.
- Linear issue/milestone traceability back to `JSC-289`.

Do not claim compatibility unless the touched production path or focused test
path actually ran.

## Acceptance Matrix

| Acceptance ID | Requirement | Evidence | Validation |
| --- | --- | --- | --- |
| SA-289-001 | Inventory the current CI migration public contract: actions, providers, options, artifacts, JSON paths, dry-run behavior, and failure classes. | Characterization inventory in plan/review/eval artifact. | Manual evidence review plus focused source references. |
| SA-289-002 | Add or identify deterministic characterization coverage before extraction. | Fixture/test evidence covering representative `prepare`, `commit`, `abort`, `verify`, `bootstrap`, dry-run, and JSON paths. | Focused CI migration test command passes. |
| SA-289-003 | Preserve the public command entrypoint and registry dispatch. | Diff shows `ci-migrate` command remains routed through the stable command interface. | Focused CLI/registry tests or direct command path check. |
| SA-289-004 | Define the first extraction boundary and prove it does not introduce hidden dependency back into the oversized core. | Plan and diff identify extracted module inputs/outputs and import direction. | Architecture drift check plus source inspection. |
| SA-289-005 | Keep Phase 1 characterization-only. | No behavior-changing edits in `ci-migrate-core.ts` before characterization baseline is accepted. | Git diff review. |
| SA-289-006 | Record exact validation outcomes and rollback conditions. | Eval artifact with command outcomes, blockers, and rollback notes. | Eval review before closure. |
| SA-289-007 | Keep Linear traceability current. | `JSC-289`, milestone, spec, plan, and eval paths reference each other. | Linear Delta Capture Gate before next slice. |
| SA-289-008 | Classify delegated `sync-branch-protection` and `promote-mode` registry paths separately from `CIMigrateAction` runtime actions. | Characterization matrix includes delegated dispatch rows. | Registry source inspection plus focused dispatch test or explicit deferral. |
| SA-289-009 | Classify credential, snapshot, and generated-artifact failure modes before extraction. | Phase 1 evidence records signing-key requirements, snapshot isolation/reuse behavior, and generated artifact ownership. | Focused tests or blocked validation entries with exact blocker. |
| SA-289-010 | Pin command action parsing edge cases before extraction. | Characterization matrix names missing, empty, unsupported, positional, flag-based, delegated, and too-many-positionals cases. | Focused registry/CLI parsing tests or explicit deferral with human review. |
| SA-289-011 | Keep repo-required validation gates visible in the plan. | Plan and eval record focused checks plus required repo gates or exact blockers. | `bash scripts/validate-codestyle.sh`, `bash scripts/verify-work.sh --fast`, and `pnpm check` where applicable. |

## Linear Acceptance Traceability

| Linear issue | Acceptance IDs | Notes |
| --- | --- | --- |
| `JSC-289` parent issue | SA-289-001 through SA-289-011 | Parent issue owns the full characterization-to-first-boundary migration. |
| `CI Migration Boundary Recovery Slice` milestone | SA-289-001 through SA-289-011 | Milestone should not close without eval proof. |
| Future sub-issue: characterization baseline | SA-289-001, SA-289-002, SA-289-005, SA-289-008, SA-289-009, SA-289-010, SA-289-011 | Create only when implementation begins. |
| Future sub-issue: first boundary extraction | SA-289-003, SA-289-004, SA-289-006, SA-289-011 | Must be blocked by accepted characterization baseline. |

## First Slice

The first implementation slice is Phase 1: Characterization Baseline.

Objective:

- Produce a deterministic inventory and characterization baseline for the
  existing CI migration command.
- Separate `CIMigrateAction` runtime behavior from delegated registry behavior.
- Pin command action parsing edge cases before any extraction.
- Classify credential, snapshot, and generated-artifact failure modes.

Allowed changes:

- Add characterization fixtures or focused tests.
- Add harness evidence/eval artifacts.
- Update plan/review artifacts for traceability.
- Add a characterization matrix artifact if the plan needs one.

Forbidden changes:

- Behavior-changing edits to CI migration runtime.
- Provider rewrite.
- Break-glass behavior changes.
- Merge-queue policy changes.
- Broad module extraction before characterization passes.
- Direct live branch-protection mutation unless explicitly approved by the
  phase plan and human review.
- Reusing previous snapshot IDs for repeated local probes.

## Open Questions

- Which exact existing CI migration tests are sufficient characterization
  anchors, and which paths need new fixtures?
- Should proof-pack/reporting be the first extraction boundary, or should the
  state-store boundary come first after characterization?
- Which validation command should become the canonical focused CI migration
  command for `JSC-289` closure?
- Should `sync-branch-protection` and `promote-mode` remain in the same
  command registry entry long term, or should they be explicitly documented as
  delegated subcommands before extraction?

## Done Definition

`JSC-289` is done only when:

- Characterization baseline exists and is deterministic.
- Characterization matrix covers accepted, delegated, credential, snapshot, and
  generated-artifact paths or records explicit deferrals.
- The first extraction boundary is either completed with unchanged public
  behavior or explicitly deferred with evidence.
- `ci-migrate` public action/provider/default behavior remains stable.
- Required validation outcomes are recorded exactly.
- `.harness/evals/coding-harness-ci-migration-boundary-recovery-eval.md`
  exists and supports closure.
- Linear Delta Capture Gate classifies `JSC-289` as complete or ready for human
  closure.

## he-plan Handoff

`he-plan` should create a phased plan with this sequence:

1. Phase 1 - Characterization Baseline.
2. Phase 2 - Boundary Selection Review.
3. Phase 3 - First Extraction Behind Stable Entrypoint.
4. Phase 4 - Compatibility/Eval Closure.

`he-plan` must not start with extraction. It must define explicit rollback
conditions and a human review checkpoint between Phase 1 and Phase 3.
It must also include a loophole check covering delegated registry actions,
action parsing edge cases, credential-sensitive paths, snapshot reuse, live
branch-protection proof, generated-artifact churn, and repo-required validation
gates.

## Blackboard Delta

- Selected next slice: `CI Migration Boundary Recovery Slice`.
- Linear tracker: `JSC-289`.
- Current stance: characterization-first, no behavior changes before baseline.
- Next recommended command: run `he-plan` against this spec.

## Evidence And Traceability

| Conclusion | Evidence type | Files / Linear objects | Symbols / components | Runtime behavior observed | Confidence | Why it matters |
| --- | --- | --- | --- | --- | --- | --- |
| CI migration is oversized and high-risk. | source-code | `src/commands/ci-migrate-core.ts`; `src/commands/ci-migrate.test.ts` | `runCIMigrateCLI` test surface | File counts observed with `wc -l`: 10,402-line core and 6,319-line test file. | High | Size plus mixed responsibilities makes behavior-preserving extraction risky without characterization. |
| Public command contract is explicit and must remain stable. | source-code | `src/lib/ci/ci-migrate-command-contract.ts`; `src/lib/cli/registry/command-specs-core.ts` | valid actions/providers; command registry dispatch | Source inspection found action/provider definitions and registry dispatch to `runCIMigrateCLI`. | High | Extraction cannot change action names, provider defaults, or dispatch behavior accidentally. |
| Registry exposes delegated `ci-migrate` actions beyond `CIMigrateAction`. | source-code | `src/lib/cli/registry/command-specs-core.ts`; `src/commands/ci-migrate-core.ts` | `runSyncBranchProtectionCLI`; `runPromoteModeCLI`; `runCIMigrateCLI` | Source inspection found registry dispatch branches for `sync-branch-protection` and `promote-mode` before calling `runCIMigrateCLI`. | High | Characterization must not confuse runtime actions with delegated registry paths. |
| Action parsing edge cases need explicit characterization. | source-code / review | `src/lib/cli/registry/command-specs-core.ts`; technical review | positional parsing; `--action`; delegated dispatch; too-many-positionals error | Feasibility review identified that missing, empty, unsupported, positional, flag-based, delegated, and too-many-positionals cases were not explicit enough. | Medium-high | Prevents extraction from drifting fallback/error behavior while still passing broad characterization language. |
| Repo-required validation gates must remain visible. | docs / review | `AGENTS.md`; technical review | `pnpm check`; `bash scripts/validate-codestyle.sh`; `bash scripts/verify-work.sh` | Feasibility review found the spec's previous validation floor could pass while repo-required gates remained unrun. | High | Prevents a locally valid spec from producing a non-mergeable implementation plan. |
| Credential and snapshot behavior are operational drift risks. | memory / source-code | `MEMORY.md`; `src/commands/ci-migrate-core.ts`; `src/commands/ci-migrate.test.ts` | signing-key paths; snapshot report/state files | Prior memory records signing-key and single-use snapshot issues; tests/source show snapshot and attestation schema paths. | Medium-high | Prevents false failures and false passes during characterization. |
| Generated artifact churn can masquerade as logic regression. | memory | `MEMORY.md` | generated scaffold and contract-hash manifests | Prior memory records scaffold churn and stale manifest failures after CI migration. | Medium | Keeps the refactor from absorbing unrelated generated diffs. |
| The first slice must be characterization-only. | ADR / core invariant / refactor program | `.harness/decisions/ADR-006-no-new-behavior-in-oversized-orchestrators.md`; `.harness/refactors/ci-migration-boundary-recovery.md`; `.harness/core/architecture-invariants.md` | oversized-orchestrator rule; CI migration refactor phases | No runtime behavior changed during spec generation. | High | It prevents agents from turning a refactor program into an unsafe rewrite. |
| Linear tracker exists for execution. | Linear / harness plan | `JSC-289`; `CI Migration Boundary Recovery Slice`; `.harness/linear/coding-harness-linear-plan.md` | Parent issue and milestone | Linear milestone and parent issue were created before this spec. | High | HE execution requires a tracker before durable plan/work handoff. |
| Eval proof is mandatory before closure. | core invariant / harness plan | `.harness/core/execution-invariants.md`; `.harness/linear/coding-harness-linear-plan.md` | Required eval path | No eval has been run for this spec yet. | High | Prevents Linear closure based on architecture prose alone. |
