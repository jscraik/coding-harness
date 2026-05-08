---
schema_version: 1
artifact_id: jsc-289-ci-migration-boundary-recovery-plan
artifact_type: he-plan
canonical_slug: jsc-289-ci-migration-boundary-recovery
title: JSC-289 CI Migration Boundary Recovery Plan
harness_stage: he-plan
status: draft
date: 2026-05-08
traceability_required: true
origin: .harness/specs/2026-05-08-JSC-289-ci-migration-boundary-recovery-spec.md
linear_issue: JSC-289
linear_status: In Progress
linear_milestone: CI Migration Boundary Recovery Slice
risk: migration-risk
depth: bounded
ui: false
---

# JSC-289 CI Migration Boundary Recovery Plan

## Table Of Contents

- [Plan Decision](#plan-decision)
- [Linear Work Item Contract](#linear-work-item-contract)
- [Source Authority](#source-authority)
- [Linear Delta Capture](#linear-delta-capture)
- [Scope Guardrails](#scope-guardrails)
- [Implementation Units](#implementation-units)
- [Phase 1 Work Orders](#phase-1-work-orders)
- [Non-Behavior Change Definition](#non-behavior-change-definition)
- [Coverage Anchor Inventory](#coverage-anchor-inventory)
- [Execution Phases](#execution-phases)
- [Characterization Matrix Target](#characterization-matrix-target)
- [Loophole Closure Checklist](#loophole-closure-checklist)
- [Validation Plan](#validation-plan)
- [Review Gates](#review-gates)
- [Rollback Strategy](#rollback-strategy)
- [File Change Boundaries](#file-change-boundaries)
- [Dependencies And Sequencing](#dependencies-and-sequencing)
- [Linear / Spec / Plan / PR Traceability](#linear--spec--plan--pr-traceability)
- [Slack Policy](#slack-policy)
- [Post-Plan Handoff](#post-plan-handoff)
- [Blackboard Delta](#blackboard-delta)
- [Evidence And Traceability](#evidence-and-traceability)

## Plan Decision

`JSC-289` should start with a characterization-only execution slice.

The first active implementation unit is `IU-289-001`. It may inspect source,
map current behavior, and write a durable characterization inventory. It must
not extract modules, change `ci-migrate` runtime behavior, alter CI provider
semantics, clean up orphan workflows, or edit branch-protection policy paths.

Reason: `src/commands/ci-migrate-core.ts` is a governance-sensitive command
orchestrator. The system already has many tests, but the tests do not yet form
a clear compatibility boundary for future extraction. Planning must protect the
public `ci-migrate` command before reducing the core file.

## Linear Work Item Contract

| Field | Value |
| --- | --- |
| Linear issue | `JSC-289` |
| Title | `[coding-harness] Characterize and split CI migration lifecycle boundaries` |
| Project | `coding-harness` |
| Initiative | `Dev Portfolio` |
| Milestone | `CI Migration Boundary Recovery Slice` |
| Linear status | `Triage` |
| Priority | High / `2` |
| Labels | `Reliability`, `architecture`, `Refactor`, `Drift-Risk` |
| Execution route | Agent-assisted; human review required at phase boundaries |
| Source Linear plan | `.harness/linear/coding-harness-linear-plan.md` |
| Source spec | `.harness/specs/2026-05-08-JSC-289-ci-migration-boundary-recovery-spec.md` |
| Source refactor | `.harness/refactors/ci-migration-boundary-recovery.md` |
| Required eval | `.harness/evals/coding-harness-ci-migration-boundary-recovery-eval.md` |

## Source Authority

Authority order for this plan:

1. Current user request: run `he-plan` for the JSC-289 spec.
2. Source spec:
   `.harness/specs/2026-05-08-JSC-289-ci-migration-boundary-recovery-spec.md`.
3. Linear control surface:
   `.harness/linear/coding-harness-linear-plan.md`.
4. Refactor program:
   `.harness/refactors/ci-migration-boundary-recovery.md`.
5. Core invariants:
   `.harness/core/architecture-invariants.md`,
   `.harness/core/execution-invariants.md`,
   `.harness/core/routing-invariants.md`, and
   `.harness/core/anti-drift-principles.md`.

Secondary artifacts may provide evidence, but they must not expand this slice.

## Linear Delta Capture

Live Linear state was refreshed before writing the first version of this plan
and refreshed again on 2026-05-08 after Linear OAuth access recovered.

| Object | Live state | Plan response |
| --- | --- | --- |
| `JSC-289` | Exists in project `coding-harness`, status `Triage`, priority High / `2`. | Use as the active tracked parent issue for this plan. |
| Milestone | `CI Migration Boundary Recovery Slice` exists with zero progress. | Use as the target milestone. |
| Labels | `Drift-Risk`, `Reliability`, `architecture`, and `Refactor` exist and are applied to `JSC-289`. | No label repair required before planning. |
| Historical CI migration issues | `JSC-54`, `JSC-58`, `JSC-59`, `JSC-60`, `JSC-61`, `JSC-79`, `JSC-104`, and `JSC-117` are done or historical context. | Treat as evidence only; do not reopen or absorb. |
| `JSC-159` | Open related CI cleanup issue for orphan workflow detection/removal. | Explicitly out of scope for JSC-289; do not admit into this plan. |

Delta classification: live Linear now matches the approved next slice. No new
initiative, project, milestone, label, or parent issue is required.

Current confidence-loop status: live Linear re-verification succeeded. Proceed
to `he-work` only if the worktree dirty-state ownership is clear and the next
unit remains `IU-289-001`.

## Scope Guardrails

In scope:

- Inventory and characterize `ci-migrate` public behavior.
- Add or identify focused characterization tests for command registry dispatch.
- Add or identify focused characterization tests for runtime lifecycle paths.
- Produce a boundary recommendation for the first extraction.
- Produce eval evidence before claiming the milestone is closable.

Out of scope:

- Full rewrite of `src/commands/ci-migrate-core.ts`.
- Provider rewrite for `github-actions` or `circleci`.
- Orphan GitHub Actions workflow cleanup.
- `JSC-178` contract-registry modularization.
- `JSC-248` cockpit umbrella work.
- Branch-protection live mutation unless explicitly selected in a later gate.
- Any behavior-changing edit before characterization evidence exists.

Stop if:

- The live Linear state contradicts the plan.
- Existing dirty worktree changes cannot be attributed to this slice.
- A characterization run needs credentials that are not available.
- Snapshot behavior is non-deterministic and cannot be isolated.
- Tests cannot distinguish docs/artifact drift from runtime behavior.
- Any change would require editing unrelated CI governance surfaces.

## Implementation Units

| Unit | Objective | Acceptance IDs | Output | Agent-safe | Human review |
| --- | --- | --- | --- | --- | --- |
| `IU-289-001` | Produce CI migration behavior inventory and characterization matrix. | `SA-289-001`, `SA-289-005`, `SA-289-008`, `SA-289-009`, `SA-289-010` | `.harness/review/2026-05-08-JSC-289-ci-migration-characterization-inventory.md` with `artifact_type: he-code-review-inventory` and `harness_stage: he-code-review` | Yes | Required before extraction |
| `IU-289-002` | Freeze command-registry parsing and delegated dispatch behavior. | `SA-289-002`, `SA-289-003`, `SA-289-008`, `SA-289-010` | Focused tests or explicit coverage map for `src/lib/cli/registry/command-specs-core.ts` and `src/cli-dispatch.test.ts`. | Agent-assisted | Required if behavior gaps are found |
| `IU-289-003` | Freeze runtime lifecycle behavior for action/provider/dry-run/JSON/proof paths. | `SA-289-002`, `SA-289-004`, `SA-289-009`, `SA-289-010` | Focused tests or coverage map for `src/commands/ci-migrate.test.ts`. | Agent-assisted | Required before extraction |
| `IU-289-004` | Select exactly one first extraction boundary or explicitly defer extraction. | `SA-289-004`, `SA-289-005`, `SA-289-006`, `SA-289-011` | Boundary decision note in the characterization inventory or plan update. | No | Required |
| `IU-289-005` | Execute first extraction only after characterization and boundary approval. | `SA-289-003`, `SA-289-004`, `SA-289-006`, `SA-289-011` | Small internal module extraction behind stable `ci-migrate` entrypoint. | Agent-assisted | Required |
| `IU-289-006` | Produce eval evidence and Linear-ready closure recommendation. | `SA-289-006`, `SA-289-007`, `SA-289-011` | `.harness/evals/coding-harness-ci-migration-boundary-recovery-eval.md` | Agent-assisted | Required before closure |

Only `IU-289-001` is authorized as the next active unit after this plan unless
the user explicitly requests a broader phase heartbeat.

## Phase 1 Work Orders

`IU-289-001` is the only next executable work order.

Work order:

1. Read, do not edit, the runtime and registry surfaces:
   `src/commands/ci-migrate-core.ts`,
   `src/lib/ci/ci-migrate-command-contract.ts`,
   `src/lib/cli/registry/command-specs-core.ts`,
   `src/cli-dispatch.test.ts`,
   `src/lib/cli/registry/command-specs.test.ts`, and
   `src/commands/ci-migrate.test.ts`.
2. Produce
   `.harness/review/2026-05-08-JSC-289-ci-migration-characterization-inventory.md`
   as an inventory review artifact with artifact identity frontmatter,
   `artifact_type: he-code-review-inventory`, `harness_stage: he-code-review`,
   `origin` pointing at this plan, `linear_issue: JSC-289`, and a matrix for
   every row in [Characterization Matrix Target](#characterization-matrix-target).
3. For every matrix row, classify the current proof state as one of:
   `covered-by-existing-test`, `covered-by-source-inspection-only`,
   `needs-focused-test`, `credential-blocked`, `external-live-blocked`,
   `deferred-by-human-review`, or `out-of-scope`.
4. Name exact source/test anchors for covered rows. Use file paths plus line
   numbers or test names; do not use vague phrases such as "existing tests".
5. Write a gap list that chooses one of three actions for each uncovered row:
   add a focused test in `IU-289-002` or `IU-289-003`, defer behind human
   review, or mark out of scope for `JSC-289`.
6. Record dirty-worktree ownership before and after the work order.

`IU-289-002` may begin only after the inventory proves which registry gaps need
tests and a human accepts moving beyond inventory-only work. It should add the
smallest focused tests for command parsing and delegated dispatch. It must not
change `command-specs-core.ts` behavior unless the test exposes an existing bug
and the user explicitly approves a fix.

`IU-289-003` may begin only after the inventory proves which runtime lifecycle
gaps need tests and a human accepts moving beyond inventory-only work. It should
prefer existing `runCIMigrateCLI` fixtures and isolated temp directories. It
must not rely on live CI providers, reused snapshot IDs, or real signing
secrets.

`IU-289-004` is a decision gate, not an implementation task. It must choose one
first extraction boundary or explicitly defer extraction. It should compare at
least these candidates:

- proof-pack/reporting generation
- snapshot/state path handling
- provider adapter selection
- break-glass governance
- merge-queue evidence handling
- delegated registry routing

`IU-289-005` is blocked until `IU-289-004` is reviewed. A future extraction
must name inputs, outputs, import direction, rollback files, and exact tests
before editing source.

## Non-Behavior Change Definition

For this plan, a behavior change means any edit that changes observable output,
exit code, generated artifact shape, default provider/action handling, accepted
flag syntax, delegated dispatch target, governance policy semantics, or
credential/snapshot failure classification.

Allowed before boundary approval:

- New Markdown characterization and review artifacts.
- New or amended tests that assert current behavior.
- Test helper edits that do not affect production imports or runtime output.
- Plan/spec/eval traceability updates.

Forbidden before boundary approval:

- Production edits to `src/commands/ci-migrate-core.ts`.
- Production edits to `src/lib/cli/registry/command-specs-core.ts`.
- Provider default changes.
- Action name changes.
- New fallback behavior for missing or invalid flags.
- Any edit that makes delegated actions look like `CIMigrateAction` values.
- Live branch-protection mutation.
- Orphan workflow deletion.

If a characterization test exposes a real defect, stop and classify it as a
review blocker. Do not fix it in the same unit unless the user explicitly moves
the plan into `he-fix-bugs` or approved implementation.

## Coverage Anchor Inventory

Known anchor candidates from source inspection:

| Surface | Existing anchor candidate | Current plan stance |
| --- | --- | --- |
| Action/provider constants | `src/lib/ci/ci-migrate-command-contract.test.ts` keeps default provider, supported providers, and supported actions. | Use as coverage for constants, then verify it still names all current values. |
| Registry too-many-positionals guard | `src/lib/cli/registry/command-specs.test.ts` has `ci-migrate execute validation` for multiple positional args. | Reuse as one parsing anchor; inventory must still cover missing/empty/unsupported action behavior. |
| CLI positional action dispatch | `src/cli-dispatch.test.ts` dispatches `ci-migrate prepare /tmp/cutover-repo ...`. | Reuse for positional action and target-dir behavior. |
| CLI `--action` dispatch | `src/cli-dispatch.test.ts` dispatches `ci-migrate /tmp/cutover-repo --action commit --dry-run`. | Reuse for explicit action and dry-run dispatch. |
| Missing value flag handling | `src/cli-dispatch.test.ts` verifies `--provider --action commit --dry-run` does not treat action value as target dir. | Reuse for value-flag parsing behavior. |
| Multiple target dirs | `src/cli-dispatch.test.ts` fails `ci-migrate prepare /tmp/repo-a /tmp/repo-b --apply` with exit `2`. | Reuse for target-dir validation. |
| Runtime lifecycle | `src/commands/ci-migrate.test.ts` has `describe("runCIMigrateCLI")` with prepare, commit, abort, verify, rollback, strict verify, proof-pack, merge-queue, and break-glass cases. | Inventory must map exact test names to matrix rows before extraction. |
| Bootstrap lifecycle | `src/commands/ci-migrate.test.ts` has `describe("runCIMigrateCLI bootstrap action")`. | Use as bootstrap anchor. |
| Signing key absence | `src/commands/ci-migrate.test.ts` includes "fails apply when snapshot signing key env is missing". | Classify as credential-sensitive behavior; no real key values. |
| Snapshot reuse | `src/commands/ci-migrate.test.ts` includes phased-artifact reuse failure cases. | Use to prevent repeated probe false failures. |

Known missing or likely-thin anchors:

- Delegated `sync-branch-protection` dispatch from both positional action and
  `--action`.
- Delegated `promote-mode` dispatch from both positional action and `--action`.
- Missing action and empty `--action` behavior at the registry/CLI boundary.
- Unsupported action behavior at the registry/CLI boundary versus runtime
  `parseCIMigrateAction`.
- A single matrix row tying each proof-pack/reporting test to a future
  extraction candidate.

These gaps do not mean the runtime is broken. They mean Phase 1 cannot approve
extraction until each gap is either tested, explicitly deferred, or marked out
of scope with human review.

## Execution Phases

### Phase 1 - Characterization Baseline

Objective: prove current behavior before moving code.

Affected systems:

- `src/commands/ci-migrate-core.ts`
- `src/commands/ci-migrate.ts`
- `src/commands/ci-migrate.test.ts`
- `src/lib/ci/ci-migrate-command-contract.ts`
- `src/lib/cli/registry/command-specs-core.ts`
- `src/cli-dispatch.test.ts`
- `src/lib/cli/registry/command-specs.test.ts`

Units: `IU-289-001`, `IU-289-002`, `IU-289-003`.

Expected risk: medium. Tests may expose drift, credential assumptions, or
snapshot isolation issues. Runtime behavior must not change in this phase.

Can run in parallel: no for `IU-289-001`; partial yes for `IU-289-002` and
`IU-289-003` only after inventory rows are defined.

Validation requirements:

- Characterization inventory exists and maps actions, delegated actions,
  providers, JSON/dry-run paths, snapshot/signing behavior, and proof-pack
  paths.
- Focused command-registry tests pass or gaps are explicitly documented.
- Focused CI migration tests pass or blockers are classified as credential,
  environment, or existing test instability.
- `git diff --check` passes.

Rollback conditions:

- Behavior-changing source edits appear before characterization is accepted.
- Tests require live CI mutation or unavailable credentials.
- Inventory cannot distinguish runtime `CIMigrateAction` paths from delegated
  registry paths.

Linear mapping: parent issue `JSC-289`; no sub-issues required unless phase
work grows beyond three independently verifiable changes.

Agent-safe: assisted. `IU-289-001` is agent-safe; tests and extraction require
human review if they affect runtime code.

Human review required: yes before leaving Phase 1.

### Phase 2 - Boundary Selection

Objective: choose the first safe extraction boundary from evidence.

Affected systems:

- Characterization inventory.
- Source files listed in Phase 1 only as references.

Unit: `IU-289-004`.

Expected risk: low if it remains a decision artifact; high if it silently
becomes implementation.

Can run in parallel: no.

Validation requirements:

- Boundary decision names one candidate boundary.
- Decision explains why alternatives were deferred.
- Decision lists exact compatibility tests that protect the boundary.
- Decision states whether extraction is approved or deferred.

Rollback conditions:

- Boundary decision relies on unverified assumptions.
- Decision admits provider rewrite, orphan workflow cleanup, or `JSC-178`
  modularization.

Linear mapping: update `JSC-289` comment or local plan evidence only after
human review, if requested.

Agent-safe: no. This is a human-review checkpoint.

Human review required: yes.

### Phase 3 - First Extraction

Objective: reduce one internal responsibility while preserving the stable
`ci-migrate` public entrypoint.

Affected systems: only the boundary approved in Phase 2.

Unit: `IU-289-005`.

Expected risk: migration-risk. The core file is large and governance-sensitive.

Can run in parallel: no.

Validation requirements:

- Extracted module has a real responsibility and is not a pass-through wrapper.
- Public `ci-migrate` entrypoint remains stable.
- Extracted module does not import `ci-migrate-core.ts` as a hidden dependency.
- Existing and newly added characterization tests pass.
- `pnpm typecheck`, `pnpm run test:related`, focused tests, and the relevant
  repo wrapper gates pass.
- `pnpm run quality:docstrings` and `pnpm run quality:size` pass when
  production `src/**` files change.
- `pnpm check` runs before PR handoff for extraction changes unless an exact
  blocker is recorded.

Rollback conditions:

- Public CLI behavior changes without explicit migration decision.
- Extracted code increases hidden coupling.
- Test failures cannot be isolated to the extraction.

Linear mapping: only create a sub-issue if extraction scope exceeds one commit.

Agent-safe: assisted.

Human review required: yes.

### Phase 4 - Eval And Closure

Objective: prove the slice improved reasoning quality without weakening CI
governance behavior.

Affected systems:

- Eval artifact.
- Linear closure evidence.
- Any touched test/source files from Phase 3.

Unit: `IU-289-006`.

Expected risk: low if evidence is exact; high if closure is based on summaries.

Can run in parallel: no.

Validation requirements:

- Eval report exists at
  `.harness/evals/coding-harness-ci-migration-boundary-recovery-eval.md`.
- Eval records exact command outcomes.
- Eval states whether `JSC-289` is complete, blocked, or needs another slice.
- Linear closure is not recommended unless acceptance IDs are traceable.

Rollback conditions:

- Eval cannot map acceptance IDs to concrete evidence.
- Behavior drift is found after extraction.
- Review gate has blocking findings.

Linear mapping: closure recommendation for `JSC-289`; do not close Linear from
the plan alone.

Agent-safe: assisted.

Human review required: yes before closure.

## Characterization Matrix Target

The Phase 1 inventory must include at least these rows.

| Surface | Required classification | Evidence target |
| --- | --- | --- |
| Runtime actions | `prepare`, `commit`, `abort`, `verify`, `bootstrap`. | Source map plus focused tests in `src/commands/ci-migrate.test.ts`. |
| Delegated registry actions | `sync-branch-protection`, `promote-mode`. | Source map plus focused dispatch tests in registry or CLI dispatch tests. |
| Provider behavior | `circleci`, `github-actions`, default provider `circleci`. | Contract source plus focused runtime tests or explicit coverage map. |
| CLI parsing | Positional action, `--action`, target directory, too many targets, unsupported action. | Registry and CLI dispatch tests. |
| JSON and dry-run output | Exit code and output shape for representative dry-run paths. | Existing test anchors plus any new characterization row. |
| Snapshot/signing | Signing-key requirement, snapshot ID isolation, state/report/attestation paths. | Existing tests or credential-blocker classification. |
| Proof pack/reporting | Report schema, proof-pack generation, related artifact paths. | Existing tests and boundary recommendation. |
| Break-glass/merge queue | Approval, policy, roster, evidence, and provider API paths. | Existing tests or explicit deferral if not selected for first extraction. |
| Generated artifact drift | Scaffold, manifest, and required-check artifacts that may change during runs. | Inventory classification before cleanup. |

## Loophole Closure Checklist

Before Phase 1 can be marked complete, the review artifact or eval must answer:

| Loophole | Required closure |
| --- | --- |
| Delegated action confusion | Show `sync-branch-protection` and `promote-mode` are handled separately from `CIMigrateAction`, with tests or explicit deferral. |
| `--action` ambiguity | Cover missing action, empty `--action`, unsupported action, positional action, explicit action, and missing value-flag behavior. |
| Provider default drift | Prove `circleci` remains the default and both supported providers remain documented. |
| Credential false failure | Classify missing `HARNESS_CI_MIGRATE_SIGNING_KEY` as credential-blocked when encountered, not as runtime proof. |
| Snapshot reuse false failure | Use fresh deterministic snapshot IDs per probe or rely on existing isolated temp-dir tests. |
| Live governance false pass | Do not claim live branch-protection alignment from delegated JSON success alone. |
| Generated artifact churn | Classify scaffold/hash/manifest diffs before cleanup or rollback. |
| Shallow extraction risk | Do not approve Phase 3 unless the chosen module owns a real responsibility and avoids hidden imports back to `ci-migrate-core.ts`. |
| Linear scope creep | Keep `JSC-159` and historical completed CI migration issues as evidence only. |
| Validation understatement | Record exact focused commands, repo wrapper gates, and blocked reasons before any closure claim. |

## Validation Plan

Plan artifact validation:

| Command | Required before handoff |
| --- | --- |
| `python3 /Users/jamiecraik/dev/agent-skills/Infrastructure/scripts/validation-and-linting/he_artifact_identity_lint.py .harness/plan/2026-05-08-architecture-JSC-289-ci-migration-boundary-recovery-plan.md` | Yes |
| `python3 /Users/jamiecraik/dev/agent-skills/Infrastructure/scripts/validation-and-linting/he_frontmatter_safety_lint.py .harness/plan/2026-05-08-architecture-JSC-289-ci-migration-boundary-recovery-plan.md` | Yes |
| `python3 /Users/jamiecraik/dev/agent-skills/Infrastructure/scripts/validation-and-linting/he_linear_traceability_lint.py .harness/plan/2026-05-08-architecture-JSC-289-ci-migration-boundary-recovery-plan.md` | Yes |
| `pnpm markdownlint .harness/plan/2026-05-08-architecture-JSC-289-ci-migration-boundary-recovery-plan.md` | Yes |
| `git diff --check` | Yes |

Implementation validation for Phase 1:

| Command | When to run | Notes |
| --- | --- | --- |
| `pnpm vitest run src/lib/ci/ci-migrate-command-contract.test.ts` | If action/provider contract tests are changed, or to prove constants before extraction. | Protects provider/action constants. |
| `pnpm vitest run src/lib/cli/registry/command-specs.test.ts src/cli-dispatch.test.ts` | If registry/CLI dispatch tests are added or changed. | Protects action parsing and delegated dispatch. |
| `pnpm vitest run --maxWorkers=1 --dangerouslyIgnoreUnhandledErrors src/commands/ci-migrate.test.ts` | If runtime characterization tests are added or changed. | Mirrors the repo's CI mitigation for this suite. |
| `pnpm typecheck` | If TypeScript source or tests change. | Required before claiming source compatibility. |
| `pnpm run test:related` | If production `src/**` files change. | Required by repo testing standards; must not pass silently without related coverage. |
| `pnpm run quality:docstrings` | If production public API source changes. | Required by repo development workflow standards. |
| `pnpm run quality:size` | If production source changes. | Guards size/complexity growth during extraction. |
| `bash scripts/validate-codestyle.sh --fast` | Before phase handoff after source/test edits. | Narrow repo wrapper gate. |
| `bash scripts/verify-work.sh --fast` | Before broader handoff when practical. | Broader readiness gate. |
| `pnpm check` | Before PR handoff for any source/test extraction slice unless blocked. | Aggregate package contract from `package.json`. |
| `pnpm test:deep` | Only if runtime/artifact behavior changes. | Phase 1 should avoid needing this by remaining characterization-first. |

Implementation validation for Phase 3:

- Re-run all Phase 1 focused tests.
- Run `pnpm typecheck`.
- Run `pnpm run quality:docstrings`.
- Run `pnpm run quality:size`.
- Run `pnpm run test:related`.
- Run `bash scripts/validate-codestyle.sh --fast`.
- Run `bash scripts/verify-work.sh --fast`.
- Run `pnpm check` before PR handoff unless blocked by a concrete environment
  issue.
- Run `pnpm test:deep` if runtime or artifact behavior changes.

Do not claim live branch-protection correctness from `--json` output alone.
Live governance reads are required only if a later approved phase intentionally
touches delegated branch-protection behavior.

Phase 1 command selection rules:

- If `IU-289-001` only writes the inventory artifact, run artifact identity,
  frontmatter safety, traceability, `pnpm markdownlint` on changed Markdown, and
  `git diff --check` for both the plan and inventory review artifact.
- If `IU-289-002` adds registry/dispatch tests, run the exact focused registry
  and CLI dispatch command above plus `pnpm typecheck`.
- If `IU-289-003` adds runtime tests, run the CI migration suite with
  `--maxWorkers=1 --dangerouslyIgnoreUnhandledErrors` plus `pnpm typecheck`.
- If any production source changes before Phase 2 approval, stop and review;
  that is outside the characterization-only route.
- If any production source changes after Phase 2 approval, run the repo-required
  production-source gates: `pnpm run quality:docstrings`,
  `pnpm run quality:size`, `pnpm run test:related`, `pnpm check`, focused
  tests, and wrapper gates unless a concrete blocker is recorded.
- If validation is blocked, record the command as blocked with the exact
  blocker and do not convert the blocker into a pass.

## Review Gates

Before any local commit for a completed phase:

1. Run `simplify` review against the phase diff.
2. Run `he-fix-bugs` only if validation or regression evidence fails.
3. Run `he-code-review` against the phase diff.
4. Commit only if gates have no blocking findings and exact validation outcomes
   are recorded.

Phase-specific gates:

- Phase 1: review must confirm no runtime behavior changes.
- Phase 1: review must confirm every characterization matrix row has one of
  the allowed proof classifications.
- Phase 2: human review must approve or defer extraction boundary.
- Phase 3: review must confirm the extraction is not a shallow wrapper and does
  not import the old core as a hidden dependency.
- Phase 4: review must confirm eval evidence is enough for Linear closure or
  state the blocker.

## Rollback Strategy

Rollback is file-scoped and phase-scoped.

- Phase 1 rollback: remove characterization artifact/test additions that are
  wrong or non-deterministic. No runtime rollback should be necessary.
- Phase 2 rollback: supersede the boundary decision; do not edit source.
- Phase 3 rollback: revert only extraction files and import changes for the
  selected boundary; keep characterization evidence if valid.
- Phase 4 rollback: mark eval as blocked or needs rework; do not close Linear.

Never rollback unrelated user edits or stale local artifacts outside this slice.

## File Change Boundaries

Allowed in Phase 1:

- `.harness/review/2026-05-08-JSC-289-ci-migration-characterization-inventory.md`
  as a `he-code-review-inventory` artifact.
- `.harness/evals/coding-harness-ci-migration-boundary-recovery-eval.md` only
  if producing eval evidence after validation.
- Focused test files only if needed:
  - `src/lib/cli/registry/command-specs.test.ts`
  - `src/cli-dispatch.test.ts`
  - `src/commands/ci-migrate.test.ts`
  - `src/lib/ci/ci-migrate-command-contract.test.ts`

Allowed in Phase 3 only after Phase 2 approval:

- One new internal module or a small set of modules for the selected boundary.
- Minimal import/export edits needed to keep `ci-migrate` entrypoint stable.
- Tests that prove no public behavior changed.

Protected unless explicitly approved:

- `.circleci/config.yml`
- `.github/workflows/**`
- `harness.contract.json`
- `.harness/ci-required-checks.json`
- Branch-protection/live-governance scripts
- Provider migration behavior
- Orphan workflow cleanup paths

## Dependencies And Sequencing

| Dependency | Type | Blocks | Notes |
| --- | --- | --- | --- |
| Characterization inventory | blocking | All extraction work | Without it, extraction is unsafe. |
| Registry dispatch coverage | blocking for command parsing changes | Any registry-adjacent extraction | Must separate runtime actions from delegated registry actions. |
| Runtime lifecycle coverage | blocking for runtime extraction | First extraction | Existing tests can count only when mapped to matrix rows. |
| Human boundary review | blocking | Phase 3 | Prevents accidental broad rewrite. |
| Eval artifact | closure | Linear completion | No closure recommendation without eval. |

Commit slicing guidance:

- Phase 1 inventory-only work should be one local commit if committed.
- Phase 1 test additions may be a second commit if they touch test files.
- Phase 3 extraction must not share a commit with characterization inventory.
- Eval and closure evidence may be separate from source/test changes if it
  makes review easier.
- Stage only files belonging to the completed implementation unit.

## Linear / Spec / Plan / PR Traceability

| Linear issue | Source acceptance IDs | Plan units | Acceptance IDs | PR evidence |
| --- | --- | --- | --- | --- |
| `JSC-289` | `SA-289-001`, `SA-289-005`, `SA-289-008`, `SA-289-009`, `SA-289-010` | `IU-289-001` | `SA-289-001`, `SA-289-005`, `SA-289-008`, `SA-289-009`, `SA-289-010` | Characterization inventory and phase diff proving no runtime behavior edits. |
| `JSC-289` | `SA-289-002`, `SA-289-003`, `SA-289-008`, `SA-289-010` | `IU-289-002` | `SA-289-002`, `SA-289-003`, `SA-289-008`, `SA-289-010` | Focused registry/CLI dispatch tests or explicit coverage map. |
| `JSC-289` | `SA-289-002`, `SA-289-004`, `SA-289-009`, `SA-289-010` | `IU-289-003` | `SA-289-002`, `SA-289-004`, `SA-289-009`, `SA-289-010` | Focused CI migration lifecycle tests or explicit coverage map. |
| `JSC-289` | `SA-289-004`, `SA-289-005`, `SA-289-006`, `SA-289-011` | `IU-289-004`, `IU-289-005` | `SA-289-004`, `SA-289-005`, `SA-289-006`, `SA-289-011` | Boundary decision, approved extraction diff, focused test results. |
| `JSC-289` | `SA-289-006`, `SA-289-007`, `SA-289-011` | `IU-289-006` | `SA-289-006`, `SA-289-007`, `SA-289-011` | Eval artifact and Linear closure recommendation. |

PR evidence must include exact command outcomes. Use `Refs JSC-289` until the
issue is fully complete after review; use `Closes JSC-289` only if the PR
completes the issue.

## Slack Policy

No Slack broadcast is required for this plan.

If a future phase exposes a governance blocker that changes team execution
policy, summarize it in Linear first. Use Slack only for time-sensitive human
coordination and keep the durable decision in `.harness/**` or Linear.

## Post-Plan Handoff

```yaml
post_plan_handoff:
  state: explicit_stop
  selected_next_stage: he-work
  evidence: ".harness/plan/2026-05-08-architecture-JSC-289-ci-migration-boundary-recovery-plan.md"
  next_action: "Invoke he-work on this plan and start with IU-289-001 only."
```

## Blackboard Delta

```yaml
blackboard_delta:
  latest_plan: ".harness/plan/2026-05-08-architecture-JSC-289-ci-migration-boundary-recovery-plan.md"
  active_linear_issue: "JSC-289"
  active_milestone: "CI Migration Boundary Recovery Slice"
  first_active_unit: "IU-289-001"
  active_scope: "characterization-only"
  linear_refresh_status: "verified on 2026-05-08 via Linear plugin"
  stop_rule: "Do not extract or change ci-migrate behavior before characterization evidence and human boundary review."
```

## Evidence And Traceability

| Conclusion | Evidence type | Files / systems | Confidence | Why it matters |
| --- | --- | --- | --- | --- |
| JSC-289 is the current approved slice. | Linear live state; Linear plan | `.harness/linear/coding-harness-linear-plan.md`; Linear issue `JSC-289`; milestone `CI Migration Boundary Recovery Slice`; Linear plugin refresh on 2026-05-08 | High | Prevents the plan from reopening completed cockpit/governance slices or drifting into unrelated backlog. |
| Phase 1 must be characterization-only. | Spec; source risk | `.harness/specs/2026-05-08-JSC-289-ci-migration-boundary-recovery-spec.md`; `src/commands/ci-migrate-core.ts` | High | Protects governance-sensitive behavior before extraction. |
| Runtime actions and delegated registry actions must be separated. | Source-code; spec | `src/lib/ci/ci-migrate-command-contract.ts`; `src/lib/cli/registry/command-specs-core.ts` | High | Prevents tests and extraction from confusing `CIMigrateAction` with delegated registry paths. |
| CI migration tests already exist but need a compatibility map. | Source-code; tests | `src/commands/ci-migrate.test.ts`; `src/lib/cli/registry/command-specs.test.ts`; `src/cli-dispatch.test.ts` | High | Existing tests are coverage evidence; the plan needs them mapped to visible behaviors. |
| JSC-159 and historical CI migration issues are not part of this slice. | Linear live state | Linear issues `JSC-159`, `JSC-54`, `JSC-58`, `JSC-59`, `JSC-60`, `JSC-61`, `JSC-79`, `JSC-104`, `JSC-117` | High | Prevents issue-delta capture from expanding the current scope. |
| Eval evidence is required before closure. | HE workflow; spec | `.harness/evals/coding-harness-ci-migration-boundary-recovery-eval.md`; `SA-289-007` | High | Keeps Linear closure proof-backed instead of summary-backed. |
