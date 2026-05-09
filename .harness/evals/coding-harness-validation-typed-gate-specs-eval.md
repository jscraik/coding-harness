---
schema_version: 1
artifact_id: coding-harness-validation-typed-gate-specs-eval
artifact_type: he-eval-report
canonical_slug: validation-typed-gate-specs
title: Validation Typed Gate Specs Eval
harness_stage: he-eval-report
status: draft
date: 2026-05-09
traceability_required: true
origin: .harness/plan/2026-05-09-JSC-290-validation-typed-gate-specs-plan.md
linear_issue: JSC-290
linear_milestone: Validation Typed Gate Specs Slice
linear_status: Triage
---

# Validation Typed Gate Specs Eval

## Table Of Contents

- [Executive Eval Summary](#executive-eval-summary)
- [Evaluated Slice](#evaluated-slice)
- [Linear Definition of Done Status](#linear-definition-of-done-status)
- [Linear Backlink Map](#linear-backlink-map)
- [Source Artifact Trace](#source-artifact-trace)
- [Planned Proof Check](#planned-proof-check)
- [Functional Validation Results](#functional-validation-results)
- [Eval Gate Matrix](#eval-gate-matrix)
- [Agentic Eval Validity](#agentic-eval-validity)
- [Side-Effect Authorization](#side-effect-authorization)
- [Domain Model Integrity Check](#domain-model-integrity-check)
- [Drift Validation](#drift-validation)
- [Architecture Integrity Check](#architecture-integrity-check)
- [Routing Determinism Check](#routing-determinism-check)
- [Context Load Check](#context-load-check)
- [Agent-Native Check](#agent-native-check)
- [Governance Simplicity Check](#governance-simplicity-check)
- [Moat Protection Check](#moat-protection-check)
- [Proof Artifacts](#proof-artifacts)
- [Failures / Regressions](#failures--regressions)
- [Runtime Burn-Down Boundary](#runtime-burn-down-boundary)
- [Linear Completion Recommendation](#linear-completion-recommendation)
- [Follow-Up Work](#follow-up-work)
- [Core / ADR Update Recommendation](#core--adr-update-recommendation)
- [Evidence & Traceability Matrix](#evidence--traceability-matrix)

## Executive Eval Summary

Status: partial pass.

Linear Completion Recommendation: keep `JSC-290` open. The mirror,
characterization, parity, failure taxonomy, and resume-fixture units are
complete with local validation evidence, but the approved plan requires human
review and eval-backed acceptance before runtime burn-down begins.

Primary Blockers: no blocker remains for the mirror-only slice. Runtime
burn-down remains blocked until a human accepts the boundary in this eval and
authorizes the next implementation unit.

Confidence: high for `IU-VAL-001` through `IU-VAL-005` implementation evidence;
medium for runtime burn-down readiness because no runtime extraction has been
performed or deep-tested.

## Evaluated Slice

Linear Project: `coding-harness`

Linear Milestone: `Validation Typed Gate Specs Slice`

Linear Parent Issue: `JSC-290`

Linear Sub-Issues: none identified locally.

Refactor Program:
`.harness/refactors/validation-orchestration-typed-gate-specs.md`

Plugin Harness Engineering Spec:
`.harness/specs/2026-05-09-validation-typed-gate-specs-spec.md`

Affected Files/Modules:

- `.harness/review/2026-05-09-JSC-290-validation-gate-graph-inventory.md`
- `src/lib/validation/gate-specs.ts`
- `src/lib/validation/gate-specs.test.ts`
- `src/lib/validation/gate-specs-parity.test.ts`
- `src/commands/verify-work.test.ts`
- `.harness/specs/2026-05-09-validation-typed-gate-specs-spec.md`
- `.harness/plan/2026-05-09-JSC-290-validation-typed-gate-specs-plan.md`
- `.harness/review/2026-05-09-JSC-290-validation-typed-gate-specs-technical-review.md`
- `.harness/review/2026-05-09-JSC-290-validation-typed-gate-specs-plan-technical-review.md`
- `.harness/linear/coding-harness-linear-plan.md`

Affected Workflows: `verify-work` gate cognition, typed validation metadata,
shell/typed parity testing, validation failure taxonomy, run-state artifact
contracts, and resume fail-closed characterization.

Related ADRs:

- `.harness/decisions/ADR-006-no-new-behavior-in-oversized-orchestrators.md`

Related Core Invariants:

- `.harness/core/architecture-invariants.md`
- `.harness/core/execution-invariants.md`
- `.harness/core/routing-invariants.md`
- `.harness/core/cognition-principles.md`
- `.harness/core/anti-drift-principles.md`

## Linear Definition of Done Status

Artifact Path:
`.harness/evals/coding-harness-validation-typed-gate-specs-eval.md`

Definition of Done Status: incomplete for parent closure. The mirror-only
implementation units are complete, but the parent issue includes the migration
decision about whether runtime burn-down may proceed.

Closure Safety: do not close `JSC-290` yet. It is safe to move the issue to a
review/acceptance state for the typed mirror and runtime extraction boundary.

## Linear Backlink Map

Linear Project: `coding-harness`

Linear Milestone: `Validation Typed Gate Specs Slice`

Linear Parent Issue: `JSC-290`

Linear Sub-Issues: none.

Linear Status Recommendation: keep open in review. Add this eval as the
acceptance artifact before authorizing runtime burn-down.

Proof Artifact Links:

- `.harness/specs/2026-05-09-validation-typed-gate-specs-spec.md`
- `.harness/plan/2026-05-09-JSC-290-validation-typed-gate-specs-plan.md`
- `.harness/review/2026-05-09-JSC-290-validation-gate-graph-inventory.md`
- `.harness/review/2026-05-09-JSC-290-validation-typed-gate-specs-technical-review.md`
- `.harness/review/2026-05-09-JSC-290-validation-typed-gate-specs-plan-technical-review.md`
- `.harness/evals/coding-harness-validation-typed-gate-specs-eval.md`

Missing Identifiers: no local artifact identifier is missing. Live Linear was
not refreshed during this eval write; any tracker update must refresh Linear
before changing status.

Traceability Repair: none required for the local harness artifact chain.

## Source Artifact Trace

Linear Plan:
`.harness/linear/coding-harness-linear-plan.md`

Refactor Program:
`.harness/refactors/validation-orchestration-typed-gate-specs.md`

Plugin HE Spec:
`.harness/specs/2026-05-09-validation-typed-gate-specs-spec.md`

ADRs:
`.harness/decisions/ADR-006-no-new-behavior-in-oversized-orchestrators.md`

Core Invariants:
`.harness/core/architecture-invariants.md`,
`.harness/core/execution-invariants.md`,
`.harness/core/routing-invariants.md`,
`.harness/core/cognition-principles.md`, and
`.harness/core/anti-drift-principles.md`

Other Source Artifacts:

- `.harness/plan/2026-05-09-JSC-290-validation-typed-gate-specs-plan.md`
- `.harness/review/2026-05-09-JSC-290-validation-gate-graph-inventory.md`
- `.harness/review/2026-05-09-JSC-290-validation-typed-gate-specs-technical-review.md`
- `.harness/review/2026-05-09-JSC-290-validation-typed-gate-specs-plan-technical-review.md`
- Commit `26b2f686 docs(jsc-290): inventory validation gate graph`
- Commit `16487853 feat(jsc-290): add validation gate specs mirror`
- Commit `e296d7cb test(jsc-290): add validation gate shell parity`
- Commit `320fef2c feat(jsc-290): type validation failure contracts`
- Commit `5694a7df test(jsc-290): cover resume fail-closed fixtures`
- Commit `d579c6f2 docs(jsc-290): commit validation planning artifacts`

## Planned Proof Check

Promised Proof From Source Artifacts:

- Inventory before behavior changes.
- Non-authoritative typed mirror.
- Shell and typed parity tests.
- Failure taxonomy and artifact contract metadata.
- Resume model fixtures.
- Eval proof before runtime burn-down or Linear closure.

Proof Planned Before Implementation: yes.

Proof Produced:

- Inventory artifact committed in `26b2f686`.
- Typed mirror committed in `16487853`.
- Shell/typed parity committed in `e296d7cb`.
- Failure taxonomy and artifact contract metadata committed in `320fef2c`.
- Resume fixtures committed in `5694a7df`.
- Spec, plan, Linear routing, and review artifacts committed in `d579c6f2`.

Proof Missing:

- `pnpm test:deep` has not been run for runtime burn-down because no runtime
  burn-down has occurred.
- Human acceptance of the runtime extraction boundary has not been recorded.

Interpretation: the plan's mirror-only proof is satisfied; the runtime
burn-down proof is intentionally not satisfied yet.

Blocks Closure: yes for parent issue closure; no for accepting the mirror-only
implementation units.

## Functional Validation Results

Command or Method: commit validation evidence for `26b2f686`.

Result: pass.

Evidence: commit body records artifact identity lint, Linear traceability lint,
frontmatter safety lint, markdownlint, `bash scripts/validate-codestyle.sh
--fast`, and full `bash scripts/validate-codestyle.sh` as passing.

Confidence: high.

Blocks Closure: no for `IU-VAL-001`.

Command or Method: commit validation evidence for `16487853`.

Result: pass.

Evidence: commit body records `pnpm vitest run
src/lib/validation/gate-specs.test.ts`, `pnpm typecheck`, `pnpm lint`, quality
gates, `pnpm run test:related`, fast codestyle, and full codestyle as passing.

Confidence: high.

Blocks Closure: no for `IU-VAL-002`.

Command or Method: commit validation evidence for `e296d7cb`.

Result: pass.

Evidence: commit body records focused parity tests, typecheck, lint, quality
gates, `test:related`, fast codestyle, full codestyle, simplify repairs, and
HE code-review repairs as complete.

Confidence: high.

Blocks Closure: no for `IU-VAL-003`.

Command or Method: commit validation evidence for `320fef2c`.

Result: pass.

Evidence: commit body records focused gate-spec and parity tests, typecheck,
lint, quality gates, `test:related`, fast codestyle, full codestyle, simplify
repairs, and HE code-review repair of the semantic artifact-presence finding.

Confidence: high.

Blocks Closure: no for `IU-VAL-004`.

Command or Method: commit validation evidence for `5694a7df`.

Result: pass.

Evidence: commit body records `pnpm vitest run src/commands/verify-work.test.ts`,
typecheck, lint, quality gates, `test:related`, fast codestyle, full codestyle,
simplify review with no blocking findings, and HE code review with no findings.

Confidence: high.

Blocks Closure: no for `IU-VAL-005`.

Command or Method: commit validation evidence for `d579c6f2`.

Result: pass.

Evidence: commit body records `bash scripts/validate-codestyle.sh --fast` and
full `bash scripts/validate-codestyle.sh` as passing for the planning artifacts.

Confidence: high.

Blocks Closure: no for artifact commit.

## Eval Gate Matrix

Gate: inventory before behavior change.

Expected: capture the live shell gate graph without modifying runtime, CI,
package scripts, source, tests, or validation wrapper behavior.

Actual: `.harness/review/2026-05-09-JSC-290-validation-gate-graph-inventory.md`
records `Runtime edits: none` and maps gate IDs, execution classes, failure
classes, run artifacts, retry behavior, and resume compatibility.

Status: pass.

Evidence: commit `26b2f686`; inventory artifact.

Confidence: high.

Blocks Closure: no.

Required Action: none.

Gate: typed mirror remains non-authoritative.

Expected: typed metadata exists for inspection and tests, but does not replace
`scripts/verify-work.sh`.

Actual: `src/lib/validation/gate-specs.ts` was added as typed metadata and
focused tests; no runtime consumption by `scripts/verify-work.sh` is claimed in
the evidence.

Status: pass.

Evidence: commit `16487853`; spec and plan scope guardrails.

Confidence: high.

Blocks Closure: no.

Required Action: keep this invariant until runtime boundary is accepted.

Gate: parity proof.

Expected: tests fail when shell and typed metadata drift.

Actual: parity tests parse the shell gate plan and compare gate order, execution
classes, failure defaults, retry policy, resume checkpoint coverage, and an
intentional mismatch case.

Status: pass.

Evidence: commit `e296d7cb`.

Confidence: high.

Blocks Closure: no.

Required Action: preserve parity tests before any runtime extraction.

Gate: failure taxonomy and artifact contract proof.

Expected: typed metadata captures failure classes, next actions, terminal
artifact fields, and resume-specific fields without changing shell behavior.

Actual: typed failure and artifact metadata were added, including the reviewed
fix that `finishedAt` is terminal-only rather than resume-only.

Status: pass.

Evidence: commit `320fef2c`; review handoff evidence.

Confidence: high.

Blocks Closure: no.

Required Action: no wording/schema change without human review.

Gate: resume fail-closed proof.

Expected: tests freeze current behavior for missing prior gate artifacts and
repo-root mismatch before resume behavior changes.

Actual: focused `verify-work` tests cover missing prior gate artifact and prior
run repo-root mismatch while leaving runtime unchanged.

Status: pass.

Evidence: commit `5694a7df`.

Confidence: high.

Blocks Closure: no.

Required Action: no `--resume-from` behavior change without human review.

Gate: runtime burn-down readiness.

Expected: human review accepts a specific extraction boundary and deep validation
passes after a runtime change.

Actual: no runtime burn-down has started. No deep validation for runtime
extraction is expected yet.

Status: partial.

Evidence: plan section "Later Runtime Burn-Down"; no matching runtime commit.

Confidence: high.

Blocks Closure: yes.

Required Action: human acceptance of the boundary in this eval before starting
the next implementation unit.

## Agentic Eval Validity

Evaluated Capability / Task: future agents can understand the validation gate
model without reading the entire shell wrapper and can detect typed/shell drift
with tests.

Task Validity: pass. The task is grounded in the JSC-290 spec and plan, not
post-hoc implementation claims.

Outcome Validity: pass for mirror-only work; partial for parent closure until
runtime boundary is accepted or deferred.

Trajectory / Transcript Evidence: phase commits show inventory first, typed
mirror second, parity third, failure metadata fourth, resume fixtures fifth,
and planning artifacts last.

Grader Coverage: focused tests and codestyle gates provide direct coverage for
the mirror and parity model. No grader exists for subjective cognition gain.

Trial Policy: not applicable; this slice is deterministic repository behavior,
not stochastic model output.

Pass@k / Pass^k Reporting: not applicable.

Authorization Validator: human review is required before runtime consumption of
typed metadata.

Saturation / Maintenance Signal: parity tests create a maintenance signal for
future drift; absent runtime burn-down means maintenance risk remains bounded.

Blocks Completion: yes

Required Action: record human acceptance before runtime burn-down.

## Side-Effect Authorization

Protected Action: none. This eval writes a local repository artifact only.

User Authorization Evidence: user asked to commit all artifacts and proceed.

Agent Justification: the approved plan requires an eval artifact before runtime
burn-down or parent closure.

External Party Influence: none.

Validator Decision: exempt

Validator Confidence: high

Suggested Next Step: human accepts or rejects the runtime burn-down boundary.

Blocks Completion: no

## Domain Model Integrity Check

Conclusion: pass for mirror-only validation domain modeling.

Bounded Context: repository validation orchestration and evidence artifacts.

Canonical Terms: gate graph, gate ID, execution class, failure class, run state,
resume checkpoint, typed gate spec, shell authoritative, parity enforced.

Aggregate Invariants: gate order, mode membership, failure defaults, artifact
field requirements, resume compatibility predicates, and retry eligibility.

Lifecycle Ownership: shell remains the execution owner; typed metadata is
inspection and parity evidence only.

Translation Evidence: `src/lib/validation/gate-specs.ts` mirrors shell gate
facts; parity tests compare typed facts against shell source.

Scenario or Test Evidence: `src/lib/validation/gate-specs.test.ts`,
`src/lib/validation/gate-specs-parity.test.ts`, and
`src/commands/verify-work.test.ts`.

Confidence: high.

Blocks Completion: no for mirror-only work; yes for runtime burn-down until
accepted.

## Drift Validation

Architecture Drift: Improved

Routing Drift: Improved

Context Drift: Improved

Governance Drift: Neutral

Agent-Native Drift: Improved

Moat Drift: Improved

Drift interpretation: stable shell entrypoints remain in place while metadata
moves toward typed, testable internals. Gate IDs, modes, resume checkpoints,
and artifact fields are now easier to inspect, and governance did not expand
because no new public command, CI ownership change, or branch-protection change
was introduced.

## Architecture Integrity Check

Conclusion: pass for the admitted scope.

Evidence: the implementation preserves `bash scripts/verify-work.sh` and
`bash scripts/validate-codestyle.sh` as stable command entrypoints, while adding
typed metadata and tests under `src/lib/validation/**`.

Affected Files/Modules: `src/lib/validation/gate-specs.ts`, validation tests,
and the inventory artifact.

Confidence: high.

Blocks Completion: no for completed units.

## Routing Determinism Check

Conclusion: pass.

Evidence: typed metadata preserves gate IDs and mode membership; parity tests
compare typed facts to shell source.

Affected Files/Modules: `src/lib/validation/gate-specs.ts` and
`src/lib/validation/gate-specs-parity.test.ts`.

Confidence: high.

Blocks Completion: no.

## Context Load Check

Conclusion: improved, with one remaining risk.

Evidence: future agents can load typed gate specs and inventory artifacts for
the stable gate model. The remaining risk is that runtime execution still lives
in shell, which is intentional until extraction is accepted.

Affected Files/Modules: `.harness/review/2026-05-09-JSC-290-validation-gate-graph-inventory.md`
and `src/lib/validation/gate-specs.ts`.

Confidence: high.

Blocks Completion: no for mirror-only work.

## Agent-Native Check

Conclusion: pass for discoverability and drift detection.

Evidence: typed metadata, parity tests, and resume fixtures make the validation
model more machine-readable without creating a competing runner.

Affected Files/Modules: `src/lib/validation/**` and
`src/commands/verify-work.test.ts`.

Confidence: high.

Blocks Completion: no.

## Governance Simplicity Check

Conclusion: pass.

Evidence: the slice did not add a new public command, plugin system, Linear
issue fan-out, CI provider change, or branch-protection policy change.

Affected Files/Modules: source validation modules and harness artifacts only.

Confidence: high.

Blocks Completion: no.

## Moat Protection Check

Conclusion: pass with parent closure gated.

Evidence: the work strengthens deterministic validation cognition and reduces
future agent ambiguity. The moat is not the typed metadata itself; it is the
discipline of keeping command truth, evidence artifacts, and parity tests
aligned.

Affected Files/Modules: validation metadata, validation tests, and HE artifacts.

Confidence: high.

Blocks Completion: yes for parent closure until runtime boundary is accepted or
explicitly deferred.

## Proof Artifacts

Produced:

- `.harness/review/2026-05-09-JSC-290-validation-gate-graph-inventory.md`
- `src/lib/validation/gate-specs.ts`
- `src/lib/validation/gate-specs.test.ts`
- `src/lib/validation/gate-specs-parity.test.ts`
- `src/commands/verify-work.test.ts`
- `.harness/specs/2026-05-09-validation-typed-gate-specs-spec.md`
- `.harness/plan/2026-05-09-JSC-290-validation-typed-gate-specs-plan.md`
- `.harness/evals/coding-harness-validation-typed-gate-specs-eval.md`

Required:

- This eval artifact.
- Human acceptance before runtime burn-down.
- Deep validation after any runtime extraction.

Missing:

- Human acceptance of runtime boundary.
- Runtime burn-down validation, because runtime burn-down has not started.

Planned Before Implementation: yes.

Blocks Completion: yes for parent issue closure.

Attach or Link Back to Linear: yes after human acceptance or when preparing
Linear status update.

## Failures / Regressions

Failure or Regression: none observed in the mirror-only evidence.

Evidence: all phase commit validation records are pass; no runtime behavior was
changed.

Required Corrective Action: none for completed mirror-only units.

Follow-Up Justified: yes, but only as the runtime burn-down boundary if a human
accepts it.

Blocks Closure: yes for parent closure because acceptance is still required.

## Runtime Burn-Down Boundary

Recommended boundary: start with a narrow internal extraction only after human
acceptance. The first runtime-facing change should use typed metadata to remove
duplicated stable metadata from shell-adjacent code or tests without changing
the public command surface.

Allowed in the next implementation unit after acceptance:

- Keep `bash scripts/verify-work.sh` and `bash scripts/validate-codestyle.sh`
  as the only public validation entrypoints.
- Preserve gate IDs, gate order, mode membership, execution classes, default
  failure classes, retry policy, artifact field names, exit-code semantics, and
  `--resume-from` behavior.
- Add a small extraction that is fully covered by existing parity tests and a
  direct focused runtime test.
- Run `bash scripts/verify-work.sh --fast`,
  `bash scripts/validate-codestyle.sh --fast`, full
  `bash scripts/validate-codestyle.sh`, and `pnpm test:deep`.

Forbidden in the next implementation unit:

- Rewriting `scripts/verify-work.sh` in TypeScript.
- Removing or renaming validation wrappers.
- Changing run-state JSON schema.
- Changing failure wording or next-action text.
- Changing exit-code semantics.
- Changing CI provider ownership, branch protection, required checks, or
  package script contracts.
- Pulling in `JSC-178`, `JSC-289`, or broader validation-platform work.

Operational decision: if the next phase cannot keep this boundary small, stop
and split it into a new spec/plan rather than widening `JSC-290` in place.

## Linear Completion Recommendation

Classification: Blocked for closure; ready for boundary review.

Recommended Linear Status: keep open in review or equivalent acceptance state.

Required Linear Comment/Update: link this eval and state that `IU-VAL-001`
through `IU-VAL-005` are locally complete, while runtime burn-down requires
human acceptance of this eval's boundary.

Issues to Close: none.

Issues to Reopen: none.

Issues to Leave Open: `JSC-290`.

New Follow-Up Issues: do not create unless the human rejects runtime burn-down
or asks to split it.

Labels to Add/Remove: none from local evidence.

Milestone Completion: do not complete yet.

Project Status Change: none.

Status Update Needed: yes, after Linear refresh and human acceptance decision.

Proof Artifacts to Attach or Link:
`.harness/evals/coding-harness-validation-typed-gate-specs-eval.md`

## Follow-Up Work

Classification: Next.

Target Linear Project: `coding-harness`

Parent Issue or Milestone: `JSC-290` /
`Validation Typed Gate Specs Slice`

Reason: runtime burn-down is the next planned migration step, but it is gated
by human acceptance and deep validation.

Priority: High / `2`.

Labels: existing `JSC-290` labels; do not create new labels.

Agent-Safe or Human Review Required: agent-assisted, human review required.

## Core / ADR Update Recommendation

Core Update: not required. Existing execution and architecture invariants
already cover stable wrappers, eval-backed closure, and deterministic routing.

ADR Update: not required before runtime burn-down. If future work makes typed
metadata runtime-authoritative, add or update an ADR then.

Reason: current work is a mirror and parity layer, not a new irreversible
architecture decision.

## Evidence & Traceability Matrix

| Conclusion | Fact | Interpretation | Assumption | Evidence | Affected Files/Modules | Command or Inspection Method | Confidence | Operational Impact | Blocks Completion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Mirror-only units are complete. | Commits `26b2f686`, `16487853`, `e296d7cb`, `320fef2c`, and `5694a7df` exist with passing validation evidence. | The planned characterization, mirror, parity, failure, and resume units are satisfied. | Commit bodies accurately record the commands run. | `git show -s --format=full <commit>` for each phase. | `.harness/review/**`, `src/lib/validation/**`, `src/commands/verify-work.test.ts` | Git commit inspection. | High | The slice has a defensible implementation baseline. | No |
| Runtime behavior has not changed. | Phase evidence records shell wrappers as stable and no runtime burn-down commit exists. | The work is safe to evaluate as pre-runtime extraction. | No untracked runtime edits exist after the artifact commit. | `git status --short --branch`; phase commit messages. | `scripts/verify-work.sh`, `scripts/validate-codestyle.sh` | Git status and commit inspection. | High | Public validation command behavior should remain stable. | No |
| Parent issue should not close yet. | Plan requires human review and eval-backed boundary before burn-down. | `JSC-290` still has an unresolved migration decision. | The parent issue includes runtime burn-down scope. | `.harness/plan/2026-05-09-JSC-290-validation-typed-gate-specs-plan.md` section "Later Runtime Burn-Down". | `.harness/plan/**`, Linear parent `JSC-290` | Plan inspection. | High | Prevents premature closure and false confidence. | Yes |
| The actual moat gain is cognition discipline, not typed metadata alone. | Typed metadata is backed by parity tests and shell remains command truth. | The compounding value comes from drift-sensitive validation evidence. | Future agents will use these artifacts before editing validation. | `src/lib/validation/gate-specs-parity.test.ts`; core invariants. | `src/lib/validation/**`, `.harness/core/**` | Source and artifact inspection. | Medium-high | Reduces agent ambiguity and future validation drift. | No |
| Next work must stay narrow. | Plan stop rules exclude JSC-178, JSC-289, CI provider ownership, and branch protection. | Broad runtime rewrite would violate the approved migration path. | Human acceptance can authorize only a bounded burn-down unit. | `.harness/plan/2026-05-09-JSC-290-validation-typed-gate-specs-plan.md` stop rules. | Validation wrappers and related docs/tests. | Plan inspection. | High | Keeps migration reversible and reviewable. | Yes for any broader scope |
