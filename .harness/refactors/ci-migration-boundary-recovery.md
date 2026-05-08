# CI Migration Boundary Recovery

# Table Of Contents

- [Refactor Classification](#refactor-classification)
- [Problem Statement](#problem-statement)
- [Root Cause Analysis](#root-cause-analysis)
- [Evidence](#evidence)
- [Architectural Impact](#architectural-impact)
- [Desired End State](#desired-end-state)
- [Migration Strategy](#migration-strategy)
- [Execution Phases](#execution-phases)
- [Linear Mapping](#linear-mapping)
- [Anti-Regression Constraints](#anti-regression-constraints)
- [Eval Requirements](#eval-requirements)
- [Success Criteria](#success-criteria)
- [Safe Rollback Conditions](#safe-rollback-conditions)
- [Future-Agent Guidance](#future-agent-guidance)
- [Related Systems](#related-systems)

# Refactor Classification

modularity correction, orchestration simplification, cognition compression,
anti-drift hardening, execution determinism, moat reinforcement

# Problem Statement

`src/commands/ci-migrate-core.ts` is the highest-risk structural hotspot in the
repo. The prior artifacts identify it as about 10402 lines, with parity proof,
break-glass policy, merge queue behavior, provider APIs, signatures,
provenance, snapshots, and reporting sharing one runtime unit. Its test file,
`src/commands/ci-migrate.test.ts`, is about 6319 lines and mirrors that
complexity.

The operational issue is not file size by itself. The problem is that CI
migration has too many reasons to change in one place. Provider behavior,
policy rules, proof artifacts, state persistence, human approval paths, merge
queue windows, and report rendering can all pressure the same module.

Future agents will struggle to make local edits safely because the boundary
does not tell them which concern owns which behavior. The moat risk is direct:
CI migration and check ownership are part of the operational scar tissue that
could be hard to copy, but a god orchestrator turns that scar tissue into
regression risk.

# Root Cause Analysis

This shape likely emerged from a pragmatic tracer-bullet implementation. CI
migration needed to prove real provider workflows end to end before the domain
boundaries were obvious. That was a reasonable early move.

It survived because the file works, has broad tests, and carries high-risk
behavior where maintainers may prefer "do not disturb" over extraction. The
tests protect behavior but also make the system feel expensive to split. The
code-size guard prevents some new damage but tolerates legacy oversized files,
so the hotspot remains normalized.

The issue is historical and operational, not cosmetic. The current boundary is
insufficient because it organizes by command implementation rather than by CI
migration lifecycle.

# Evidence

Facts:

- `.harness/review/coding-harness-architecture-review.md` identifies
  `src/commands/ci-migrate-core.ts` at 10402 lines and
  `src/commands/ci-migrate.test.ts` at 6319 lines.
- The review says the core combines parity proof, break-glass policy, merge
  queue windows, provider APIs, signatures, provenance manifests, snapshots,
  and verification logic.
- `.harness/triage/coding-harness-triage.md` ranks CI migration decomposition
  as a critical refactor program.
- `.harness/strategy/coding-harness-strategy.md` says no new CI migration
  feature should grow `ci-migrate-core.ts`.

Interpretation:

- The file is a god orchestrator and the largest local-reasoning risk.
- New feature work in this area should be blocked unless it extracts behavior
  or lands behind an extracted module.

Assumptions:

- Current tests can be repurposed into characterization coverage before module
  extraction.
- The CLI command shape can remain stable while internals move.

# Architectural Impact

Affected systems:

- CI migration command runtime.
- Provider adapter logic.
- State snapshots and signatures.
- Parity proof artifacts.
- Break-glass governance.
- Merge queue lifecycle.
- Human and JSON reporting.
- CI migration tests.
- Future Linear issues touching CI ownership and branch protection.

Blast radius:

High. CI migration touches release safety, branch protection, provider state,
and review trust.

Migration complexity:

Migration-risk. The first phases must be characterization and routing isolation,
not broad code movement.

Rollback difficulty:

Moderate if the public command entrypoint and existing core remain callable
during migration. High if the old core is deleted too early.

Likely files/directories touched:

- `src/commands/ci-migrate-core.ts`
- `src/commands/ci-migrate.test.ts`
- future `src/lib/ci-migrate/**`
- command dispatch and command capability metadata only if the public surface
  changes
- fixture/eval artifacts under `.harness/evals/**`

Systems that must not be touched casually:

- CI ownership contract.
- Current-head review proof.
- Required-check manifests.
- Public CLI behavior.
- Existing rollback and dry-run semantics.

# Desired End State

CI migration should be composed from bounded lifecycle modules:

- `plan`: migration planning and stage transitions.
- `provider-adapters`: CircleCI, GitHub, and provider API boundaries.
- `state-store`: snapshots, signatures, state reads, and writes.
- `parity-proof`: proof pack schema, validation, and evidence binding.
- `break-glass`: roster, approval, and governance policy.
- `merge-queue`: queue windows, evidence binding, and lifecycle.
- `reports`: human and JSON rendering.

The command core should become a thin coordinator. Future agents should be able
to modify a provider adapter without reading break-glass policy or merge queue
logic.

# Migration Strategy

Use a strangler migration. Keep the existing command entrypoint stable while
extracting one lifecycle boundary at a time behind characterization tests.

Sequencing order:

1. Characterize current behavior and artifact outputs.
2. Introduce module directories with no behavior change.
3. Extract pure helpers first: reporting and proof-pack formatting.
4. Extract state-store reads/writes and signature handling.
5. Extract provider adapter boundaries.
6. Extract break-glass and merge queue policy after state contracts stabilize.
7. Split tests around extracted modules.
8. Freeze new behavior in the old core and burn down legacy sections.

Coexistence rule:

The old core may call extracted modules. Extracted modules must not import the
old core.

Rollback strategy:

Each phase must be revertible by routing the command back through the old core.
Do not delete old code until characterization and module-specific tests pass.

Linear milestone/parent issue shape:

Create one parent issue for the refactor program, with one sub-issue per
lifecycle boundary. Keep at most two extraction sub-issues active at once.

# Execution Phases

## Phase 1 - Characterization Baseline

Objective:

Capture current CLI behavior, JSON output, artifact paths, dry-run behavior, and
failure classes before extraction.

Affected systems:

`ci-migrate` command tests, fixture data, eval artifact.

Expected risk:

Low.

Can run in parallel:

No.

Validation requirements:

- Existing CI migration tests pass.
- Characterization fixture records expected public outputs.
- `bash scripts/verify-work.sh --fast` passes.

Rollback conditions:

If characterization changes behavior or requires broad production edits, stop.

Linear mapping:

Sub-issue: "Characterize CI migration public behavior".

Agent-safe:

Yes.

Human review required:

Yes.

## Phase 2 - Reporting And Proof-Pack Extraction

Objective:

Extract rendering and proof-pack schema logic first because it should have lower
mutation risk than provider or state behavior.

Affected systems:

`ci-migrate-core.ts`, future `src/lib/ci-migrate/reports.ts`, future
`src/lib/ci-migrate/parity-proof.ts`, tests.

Expected risk:

Medium.

Can run in parallel:

No.

Validation requirements:

- Characterization tests pass.
- Module-specific tests prove identical report/proof output.
- Existing CI migration tests pass.

Rollback conditions:

Any output drift not intentionally approved.

Linear mapping:

Sub-issue: "Extract CI migration report and proof modules".

Agent-safe:

Assisted.

Human review required:

Yes.

## Phase 3 - State Store Boundary

Objective:

Move snapshot, signature, provenance, and persisted state behavior behind a
single state-store interface.

Affected systems:

State reads/writes, signatures, provenance manifests, tests.

Expected risk:

High.

Can run in parallel:

No.

Validation requirements:

- Existing state fixture outputs remain identical.
- Round-trip tests for snapshots and signatures.
- Rollback/dry-run semantics verified.

Rollback conditions:

Any mismatch in persisted state shape or signature behavior.

Linear mapping:

Sub-issue: "Extract CI migration state-store boundary".

Agent-safe:

Assisted.

Human review required:

Yes.

## Phase 4 - Provider Adapter Isolation

Objective:

Separate CircleCI/GitHub/provider interactions from migration planning and
policy.

Affected systems:

Provider API calls, auth boundaries, remote check handling, fixtures.

Expected risk:

High.

Can run in parallel:

No.

Validation requirements:

- Provider adapter contract tests.
- Dry-run tests without credentials.
- Credential-required paths marked blocked rather than falsely passed.

Rollback conditions:

Any provider side effect escapes dry-run mode or auth boundaries become unclear.

Linear mapping:

Sub-issue: "Extract CI migration provider adapters".

Agent-safe:

Assisted.

Human review required:

Yes.

## Phase 5 - Policy Boundary Extraction

Objective:

Extract break-glass and merge queue rules after state and provider boundaries
are stable.

Affected systems:

Break-glass approvals, merge queue windows, CI ownership policy.

Expected risk:

High.

Can run in parallel:

No.

Validation requirements:

- Policy tests for allowed/blocked paths.
- Current rollback behavior preserved.
- Required-check ownership tests unchanged.

Rollback conditions:

Any weakening of approval, check ownership, or break-glass constraints.

Linear mapping:

Sub-issue: "Extract CI migration policy boundaries".

Agent-safe:

Assisted.

Human review required:

Yes.

## Phase 6 - Legacy Core Burn-Down

Objective:

Turn `ci-migrate-core.ts` into a coordinator and remove dead internal sections.

Affected systems:

Old core file, test layout, code-size guard exemptions.

Expected risk:

Medium-high.

Can run in parallel:

No.

Validation requirements:

- File-size trend documented.
- No old-core imports from extracted modules.
- Existing command behavior unchanged.

Rollback conditions:

If the coordinator starts gaining new policy, stop and split again.

Linear mapping:

Sub-issue: "Burn down legacy CI migration core".

Agent-safe:

Assisted.

Human review required:

Yes.

# Linear Mapping

Workspace/team: Jscraik
Team key: JSC
Top-level initiative: Dev Portfolio
Cross-repo project: Portfolio Ops
Repo-specific work: coding-harness

Target Linear project:

Coding Harness - CI Migration Boundary Recovery.

Repo-specific or cross-repo:

Repo-specific, with cross-repo implications for downstream CI migration users.

Portfolio Ops:

Reference only. This should not become a cross-repo project until the local
boundary extraction proves safe.

Dev Portfolio:

Yes, as a strategic architecture stabilization initiative.

Recommended milestone name:

CI Migration Boundary Recovery.

Recommended parent issue title:

Refactor CI migration into bounded lifecycle modules.

Recommended sub-issues:

- Characterize CI migration public behavior.
- Extract CI migration report and proof modules.
- Extract CI migration state-store boundary.
- Extract CI migration provider adapters.
- Extract CI migration policy boundaries.
- Burn down legacy CI migration core.

Suggested priority:

P1.

Suggested labels:

architecture, refactor-program, ci-migration, agent-cognition, migration-risk.

Dependencies:

Characterization baseline before any extraction.

Project reactivation:

Yes if a dormant coding-harness architecture project exists. Otherwise create a
repo-specific project rather than many independent issues.

Active set:

Keep at most two sub-issues active.

# Anti-Regression Constraints

- Do not change public `ci-migrate` behavior without explicit migration note.
- Do not weaken dry-run, rollback, or break-glass behavior.
- Do not let extracted modules import the old core.
- Do not add new CI migration feature work to `ci-migrate-core.ts`.
- Do not split code only to create pass-through modules.
- Do not close the program without reducing reasons to change in the old core.

# Eval Requirements

Expected eval artifact:

`.harness/evals/coding-harness-ci-migration-boundary-recovery-eval.md`

Eval must prove:

- Existing public behavior is preserved.
- Extracted modules have module-specific tests.
- Legacy core size and responsibility count trend down.
- Provider paths preserve dry-run and auth boundaries.
- Break-glass and merge queue policies remain enforced.
- Agents can identify ownership boundaries without reading the full old core.

No Linear parent issue should close without this eval artifact.

# Success Criteria

- `ci-migrate-core.ts` becomes a coordinator rather than a policy/runtime store.
- At least five lifecycle boundaries have dedicated modules and tests.
- No extracted module imports the old core.
- CI migration feature work lands in domain modules, not the old core.
- Characterization tests prove no unintended public behavior drift.
- Future agents can route edits to a named module from file ownership alone.

# Safe Rollback Conditions

Rollback if:

- public CLI output drifts unintentionally
- persisted state shape changes unintentionally
- dry-run mode performs remote mutation
- break-glass or merge queue policy weakens
- extracted modules depend back on the old core
- test coverage becomes weaker than the starting baseline

Linear status recommendation:

Move the active sub-issue to blocked, preserve the parent, and document the
rollback trigger in the eval artifact.

# Future-Agent Guidance

Preserve:

- CLI behavior
- dry-run and rollback semantics
- current check ownership assumptions
- break-glass approval strictness
- state/proof artifact compatibility

Simplify further:

- report rendering
- proof-pack formatting
- provider adapter contracts
- test fixture layout

Intentional complexity:

Provider drift, branch protection, and migration state are real complexity.

Accidental complexity:

Multiple lifecycle concerns in one command core.

Safe to modify:

Extracted modules after characterization tests exist.

Human review required:

Provider side effects, break-glass behavior, state persistence, and public CLI
contract changes.

# Related Systems

- `.harness/review/coding-harness-architecture-review.md`
- `.harness/triage/coding-harness-triage.md`
- `.harness/strategy/coding-harness-strategy.md`
- `src/commands/ci-migrate-core.ts`
- `src/commands/ci-migrate.test.ts`
- `harness.contract.json`
- `.harness/ci-required-checks.json`
- CircleCI and GitHub provider integration paths
