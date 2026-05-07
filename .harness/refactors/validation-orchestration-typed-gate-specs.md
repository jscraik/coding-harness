# Validation Orchestration Typed Gate Specs

# Refactor Classification

orchestration simplification, execution determinism, anti-drift hardening,
cognition compression, governance reduction, context-load reduction

# Problem Statement

`scripts/verify-work.sh` is a stable and valuable entrypoint, but the prior
artifacts identify it as about 1261 lines and shell-heavy. It handles stack
detection, run state, parallel and serial gates, fallback normalization, resume
behavior, failure classes, and evidence output.

The operational issue is that a shell wrapper is carrying orchestration state.
Shell is useful as a launcher, but poor as the long-term home for gate graphs,
resume semantics, and failure taxonomy.

The future-agent issue is local reasoning. Agents can run `verify-work.sh`, but
they cannot easily modify its orchestration safely or test small pieces of gate
behavior.

# Root Cause Analysis

The architecture emerged for pragmatic reasons. A shell wrapper can run across
local machines and CI, invoke repo tools directly, and give agents a canonical
entrypoint. That entrypoint is a strength and should stay.

It survived because it works and because validation needs to orchestrate many
tools. The abstraction failure is not the wrapper. The failure is allowing the
wrapper to become a state machine.

This is operational complexity, not cleanup. It should be migrated only where
logic is stable enough to encode as typed data or TypeScript modules.

# Evidence

Facts:

- `.harness/review/coding-harness-architecture-review.md` identifies
  `scripts/verify-work.sh` at 1261 lines and describes run-state, gate
  orchestration, fallback normalization, and resume behavior.
- `.harness/triage/coding-harness-triage.md` recommends moving stable
  `verify-work.sh` orchestration logic toward typed gate specs while preserving
  the shell entrypoint.
- `.harness/strategy/coding-harness-strategy.md` says shell wrappers must remain
  thin entrypoints, not policy engines.

Interpretation:

- `verify-work.sh` is valuable but should stop absorbing policy.
- The migration target is typed gate specs plus a thin shell launcher, not
  deletion of the wrapper.

Assumptions:

- Some dynamic shell behavior may remain shell-native.
- The first typed spec should model stable gate sequencing, not every fallback.

# Architectural Impact

Affected systems:

- `scripts/verify-work.sh`
- `scripts/validate-codestyle.sh`
- package scripts invoked by validation
- gate result schemas
- docs validation policy
- CI/local parity
- future eval artifacts

Blast radius:

Medium-high. Validation is load-bearing for local work and CI confidence.

Migration complexity:

Difficult if attempted broadly. Moderate if staged gate-by-gate.

Rollback difficulty:

Low if the shell entrypoint remains and can fall back to current behavior.

Likely files/directories touched:

- `scripts/verify-work.sh`
- future `src/lib/validation/**`
- tests for gate graph and resume model
- docs describing validation contracts
- package scripts only if entrypoints change

Systems that must not be touched casually:

- shell entrypoint path
- exit-code semantics
- validation evidence wording contract
- CI/local parity
- fast/required/deep mode behavior

# Desired End State

`verify-work.sh` remains the canonical shell entrypoint.

Stable orchestration moves into typed specs:

- gate graph
- prerequisites
- resume checkpoints
- failure classes
- parallel/serial classification
- command text
- artifact expectations
- skip/block conditions

Agents can inspect the gate spec to understand validation without reading a
large shell state machine.

# Migration Strategy

Do not rewrite the wrapper. Extract stable knowledge into typed specs and make
the shell consume or validate against those specs.

Sequencing order:

1. Document current gate graph and modes.
2. Create a read-only typed gate spec that mirrors current behavior.
3. Add tests comparing spec to current shell output/checkpoints.
4. Move one stable slice at a time: gate list, failure class metadata, resume
   labels, artifact expectations.
5. Keep shell execution until TypeScript orchestration proves parity.
6. Reduce shell policy only after parity tests pass.

Coexistence rule:

During migration, shell remains executable truth. Typed specs start as
validation mirrors, then become source for stable slices.

Rollback strategy:

If typed spec execution diverges, leave the shell as runtime and revert that
slice to mirror-only mode.

Linear milestone/parent issue shape:

One parent issue with sub-issues by stable slice. Do not create a large rewrite
issue called "port verify-work to TypeScript."

# Execution Phases

## Phase 1 - Gate Graph Snapshot

Objective:

Capture current modes, gate sequence, resume labels, exit semantics, and
artifact expectations.

Affected systems:

`verify-work.sh`, docs, eval artifact.

Expected risk:

Low.

Can run in parallel:

No.

Validation requirements:

- Snapshot generated without changing runtime.
- `bash scripts/verify-work.sh --fast` passes.

Rollback conditions:

If snapshot contradicts live behavior, fix the snapshot, not the wrapper.

Linear mapping:

Sub-issue: "Snapshot verify-work gate graph".

Agent-safe:

Yes.

Human review required:

No.

## Phase 2 - Typed Spec Mirror

Objective:

Create a typed representation of the current gate graph without changing
execution.

Affected systems:

future `src/lib/validation/**`, tests.

Expected risk:

Low-medium.

Can run in parallel:

No.

Validation requirements:

- Spec validates current gate names and modes.
- Tests fail if shell labels drift from spec.

Rollback conditions:

If spec cannot represent dynamic behavior cleanly, scope it to stable slices.

Linear mapping:

Sub-issue: "Add typed validation spec mirror".

Agent-safe:

Yes.

Human review required:

Yes.

## Phase 3 - Failure Taxonomy And Artifact Expectations

Objective:

Move stable failure classes, blocker reasons, and artifact expectations into
typed metadata.

Affected systems:

Validation metadata, docs, tests.

Expected risk:

Medium.

Can run in parallel:

Yes, after spec mirror exists.

Validation requirements:

- Existing failure wording remains acceptable.
- Artifact expectations are testable.
- Docs reference generated/typed truth.

Rollback conditions:

If agents lose clear failure messages, revert the wording projection.

Linear mapping:

Sub-issue: "Extract validation failure taxonomy".

Agent-safe:

Assisted.

Human review required:

Yes.

## Phase 4 - Resume Model Extraction

Objective:

Move resume checkpoints and mode transitions behind typed validation.

Affected systems:

Resume flags, run state, shell wrapper.

Expected risk:

High.

Can run in parallel:

No.

Validation requirements:

- Resume fixtures for fast and required modes.
- Interrupted-run behavior preserved.
- Exact command evidence still emitted.

Rollback conditions:

Any resume regression.

Linear mapping:

Sub-issue: "Extract verify-work resume model".

Agent-safe:

Assisted.

Human review required:

Yes.

## Phase 5 - Thin Launcher Burn-Down

Objective:

Remove shell policy that now lives in typed specs while preserving entrypoint and
exit semantics.

Affected systems:

`verify-work.sh`, typed validation modules, docs.

Expected risk:

Medium-high.

Can run in parallel:

No.

Validation requirements:

- `bash scripts/verify-work.sh --fast` passes.
- Required mode passes or has documented blocker.
- Shell size and policy sections trend down.

Rollback conditions:

If local/CI parity changes or shell becomes harder to debug.

Linear mapping:

Sub-issue: "Burn down verify-work shell policy".

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

Coding Harness - Validation Orchestration Simplification.

Repo-specific or cross-repo:

Repo-specific first. Cross-repo later if typed gate specs become part of the
harness scaffold.

Portfolio Ops:

Reference only until the local proof exists.

Dev Portfolio:

Yes.

Recommended milestone name:

Validation Typed Gate Specs.

Recommended parent issue title:

Move stable verify-work orchestration into typed gate specs.

Recommended sub-issues:

- Snapshot verify-work gate graph.
- Add typed validation spec mirror.
- Extract validation failure taxonomy.
- Extract verify-work resume model.
- Burn down verify-work shell policy.

Suggested priority:

P2.

Suggested labels:

validation, orchestration, shell, typed-specs, agent-cognition, refactor-program.

Dependencies:

Gate graph snapshot before typed spec execution.

Project reactivation:

Create or reactivate a validation architecture project only if it groups these
sub-issues under one parent.

Active set:

One runtime-changing sub-issue active at a time.

# Anti-Regression Constraints

- Do not remove `bash scripts/verify-work.sh --fast`.
- Do not change exit-code semantics without explicit migration.
- Do not hide exact command evidence.
- Do not move dynamic shell behavior into opaque generated code.
- Do not make CI and local validation diverge.
- Do not close a phase with mirror-only specs presented as runtime simplification.

# Eval Requirements

Expected eval artifact:

`.harness/evals/coding-harness-validation-typed-gate-specs-eval.md`

Eval must prove:

- Spec mirrors live gate graph.
- Fast mode behavior is unchanged.
- Resume behavior is covered by fixtures before extraction.
- Failure classes and artifact expectations are machine-readable.
- Shell policy surface decreases after burn-down.
- Agents can inspect validation routing without reading the full shell script.

No Linear parent issue or milestone should close without this eval artifact.

# Success Criteria

- `verify-work.sh` remains the stable entrypoint.
- Gate graph exists as typed metadata.
- Resume checkpoints are validated.
- Artifact expectations are explicit.
- Shell logic decreases without behavior drift.
- Future validation changes happen in typed specs or modules, not ad hoc shell
  branches.

# Safe Rollback Conditions

Rollback if:

- fast mode breaks
- resume semantics drift
- exact command evidence disappears
- CI/local parity changes
- typed specs become pass-through duplication with no enforcement

Linear status recommendation:

Block the active extraction sub-issue and leave prior mirror/inventory work
accepted if accurate.

# Future-Agent Guidance

Preserve:

- shell entrypoint
- exact evidence output
- exit-code semantics
- fast/required/deep mode meaning

Simplify further:

- gate graph
- failure taxonomy
- artifact expectations
- resume metadata

Intentional complexity:

Validation needs to orchestrate many tools.

Accidental complexity:

Encoding stable orchestration state in shell.

Safe to modify:

Typed spec mirrors, tests, metadata projections.

Human review required:

Runtime execution changes, resume behavior, and exit semantics.

# Related Systems

- `.harness/review/coding-harness-architecture-review.md`
- `.harness/triage/coding-harness-triage.md`
- `.harness/strategy/coding-harness-strategy.md`
- `scripts/verify-work.sh`
- `scripts/validate-codestyle.sh`
- `docs/agents/04-validation.md`
- package scripts and CI validation jobs
