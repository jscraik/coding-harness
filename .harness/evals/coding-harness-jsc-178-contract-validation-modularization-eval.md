---
schema_version: 1
artifact_id: coding-harness-jsc-178-contract-validation-modularization-eval
artifact_type: he-eval-report
canonical_slug: contract-validation-modularization
title: Contract Validation Modularization Eval
harness_stage: he-eval-report
status: complete-with-blocked-broad-gate
date: 2026-05-09
traceability_required: true
origin: .harness/plan/2026-05-09-JSC-178-contract-validation-modularization-plan.md
linear_issue: JSC-178
linear_milestone: Contract Validation Modularization Slice
linear_status: In Progress
implementation_unit: IU-178-004
---

# Contract Validation Modularization Eval

## Table Of Contents

- [Executive Eval Summary](#executive-eval-summary)
- [Evaluated Slice](#evaluated-slice)
- [Linear Work Item Contract](#linear-work-item-contract)
- [Compatibility Proof](#compatibility-proof)
- [Local Reasoning Improvement](#local-reasoning-improvement)
- [Validation Results](#validation-results)
- [Review Gate Results](#review-gate-results)
- [Drift And Scope Check](#drift-and-scope-check)
- [Failures / Regressions](#failures--regressions)
- [Linear Completion Recommendation](#linear-completion-recommendation)
- [Follow-Up Work](#follow-up-work)
- [Evidence & Traceability Matrix](#evidence--traceability-matrix)

## Executive Eval Summary

Status: local implementation proof is complete for the JSC-178 contract
validation modularization slice.

Linear Completion Recommendation: keep `JSC-178` open until remote PR checks and
human acceptance are complete. The local extraction is technically sound, but
the broad `pnpm test:related` gate cannot be used as clean closure evidence
while unrelated scaffold/worktree-template edits remain dirty and failing in
the same checkout.

Primary Blockers: none for the JSC-178 extraction itself. Broad checkout-level
closure is blocked by unrelated dirty files under `src/lib/init/**` and
`src/lib/validation/gate-specs.ts`.

Confidence: high for aggregate contract-validation compatibility; medium for
whole-checkout closure because unrelated work is currently changing the related
test graph.

## Evaluated Slice

Linear Project: `coding-harness`

Linear Milestone: `Contract Validation Modularization Slice`

Linear Parent Issue: `JSC-178`

Plugin Harness Engineering Spec:
`.harness/specs/2026-05-09-jsc-178-contract-validation-modularization-spec.md`

Plan:
`.harness/plan/2026-05-09-JSC-178-contract-validation-modularization-plan.md`

Affected Files/Modules:

- `.harness/review/2026-05-09-JSC-178-contract-validation-boundary-inventory.md`
- `src/lib/contract/validator.test.ts`
- `src/lib/contract/validator-core.ts`
- `.harness/evals/coding-harness-jsc-178-contract-validation-modularization-eval.md`

Out Of Scope:

- `harness.contract.json`
- `src/lib/cli/**`
- command registry files
- CI workflows
- validation wrapper scripts
- unrelated scaffold/template work currently dirty in this checkout

## Linear Work Item Contract

| Field | Value |
| --- | --- |
| Linear issue | `JSC-178` |
| Linear project | `coding-harness` |
| Linear milestone | `Contract Validation Modularization Slice` |
| Plan unit | `IU-178-004` |
| Scope | Prove compatibility for the tooling-policy validator seam. |
| Output | `.harness/evals/coding-harness-jsc-178-contract-validation-modularization-eval.md` |
| Closure recommendation | Complete after PR, remote CI, and human acceptance. |
| Human review | Required before closing `JSC-178`. |

## Compatibility Proof

Aggregate contract validation remains compatible.

Evidence:

- Commit `96388b3a` adds focused valid/invalid tooling-policy
  characterization tests before extraction.
- Commit `a844f719` changes `validator-core.ts` to import
  `isValidToolingPolicy` from `./policy-validators.js` and removes the
  duplicate local tooling-policy validator helpers.
- `pnpm vitest run src/lib/contract` passed after extraction with `13` test
  files and `283` tests.
- `pnpm typecheck` passed after extraction, proving public export type
  compatibility for the changed TypeScript graph.

Interpretation:

The extraction did not change the accepted/rejected tooling-policy behavior
covered by the characterization tests. It moved aggregate validation onto the
existing policy-validator seam instead of preserving two implementations of the
same shape rules.

## Local Reasoning Improvement

Before:

- `validator-core.ts` contained its own private tooling-policy constants and
  validator helpers.
- `policy-validators-core.ts` contained the same tooling-policy constants and
  validator helpers behind the public policy-validator export.
- Future changes to tooling-policy shape rules required checking two files for
  semantic parity.

After:

- `validator-core.ts` delegates `toolingPolicy` shape checks to
  `isValidToolingPolicy`.
- The tooling-policy shape owner is `policy-validators-core.ts`.
- Aggregate contract validation keeps the same error envelope in
  `validator-core.ts`, while the domain-specific predicate lives in the policy
  validator boundary.

Reasoning gain:

Future agents can now inspect one tooling-policy validator implementation for
shape rules, then inspect `validator-core.ts` only for aggregate contract error
construction.

## Validation Results

| Command | Result | Evidence |
| --- | --- | --- |
| `pnpm vitest run src/lib/contract` | pass | `13` files, `283` tests passed. |
| `pnpm typecheck` | pass | `tsc --noEmit` completed successfully. |
| `pnpm exec vitest related --run src/lib/contract/validator-core.ts` | pass | `41` files, `1211` tests passed; baseline drift/policy output was non-blocking for the test command. |
| `bash scripts/check-related-tests.sh --staged` | pass | `41` files, `1211` tests passed for the staged JSC-178 change. |
| `pnpm test:related` | blocked | Failed on unrelated dirty scaffold/worktree-template changes, not on `src/lib/contract/**`. |
| `pnpm check` | blocked | Earlier stages passed, then the aggregate gate failed during `pnpm test:related`; it also emitted baseline drift warnings and policy-gate demo failures outside the JSC-178 file set. |

The blocked broad related gate reported failures in:

- `src/commands/init.test.ts`
- `src/lib/init/scaffold-worktree-templates.test.ts`

Those failures compare `codex/$repo_slug-worktree-$short_sha` with
`jscraik/feature/$repo_slug-worktree-$short_sha` in unrelated scaffold
worktree-template changes. They are outside the JSC-178 allowed file set.

## Review Gate Results

Simplify Gate: pass. The chosen extraction removed duplicated tooling-policy
validator logic instead of adding another pass-through module.

Bug-Fix Gate: not run. No JSC-178 validation or review regression failed. The
only broad gate failure came from unrelated dirty scaffold/template work.

Code Review Gate: pass. The correctness review returned no findings.

Reviewer residual risk:

- Static inspection found no functional drift.
- `policy-validators-core.ts` does not import `validator-core.ts`, so the seam
  does not introduce a circular dependency.
- Runtime proof was required; the full contract suite and staged related suite
  passed after extraction.

## Drift And Scope Check

No command-registry files changed.

No `harness.contract.json` changes were made.

No CI workflow files changed.

No validation wrapper behavior changed.

No JSON schema output file was regenerated or edited.

The final JSC-178 changed-file set is:

- `.harness/review/2026-05-09-JSC-178-contract-validation-boundary-inventory.md`
- `src/lib/contract/validator.test.ts`
- `src/lib/contract/validator-core.ts`
- `.harness/evals/coding-harness-jsc-178-contract-validation-modularization-eval.md`

## Failures / Regressions

No JSC-178 regression was observed.

Known checkout blocker:

- `pnpm test:related` is not clean in the current checkout because unrelated
  dirty scaffold/template files alter `prepare-worktree` branch-prefix
  expectations.
- `pnpm check` is not clean in the current checkout. It reached the aggregate
  related-test stage and failed on the same scaffold/template branch-prefix
  mismatch, with additional baseline drift warnings and policy-gate demo output
  that are not caused by the JSC-178 changed files.

Operational impact:

- JSC-178 can be locally accepted as a bounded extraction.
- Whole-checkout closure should wait until the unrelated scaffold/template work
  is committed, reverted by its owner, or otherwise resolved.

## Linear Completion Recommendation

Recommendation: move `JSC-178` to review after this eval is accepted, but do
not close the issue until:

- this eval is committed,
- the branch is pushed,
- remote PR checks pass,
- independent review has no blocking findings,
- the unrelated checkout-level `pnpm test:related` blocker is no longer mixed
  into the closure evidence.

Do not create follow-up implementation work inside JSC-178 unless remote checks
or independent review identify a contract-validation regression.

## Follow-Up Work

Required outside JSC-178:

- Resolve or isolate the unrelated scaffold/worktree-template dirty changes
  that currently make broad `pnpm test:related` fail.

Optional:

- If future tooling-policy changes are planned, add a smaller
  `policy-validators-core.ts` focused test file so agents do not need to reason
  through the aggregate contract suite for every shape-rule change.

## Evidence & Traceability Matrix

| Conclusion | Evidence Type | Evidence | Confidence | Why It Matters |
| --- | --- | --- | --- | --- |
| The slice had an inventory before extraction. | docs | Commit `3f570d21`; `.harness/review/2026-05-09-JSC-178-contract-validation-boundary-inventory.md` | high | Proves the extraction was planned from observed boundaries rather than opportunistic file movement. |
| Tooling-policy behavior was characterized before extraction. | tests | Commit `96388b3a`; `src/lib/contract/validator.test.ts` | high | Protects valid and invalid tooling-policy behavior while removing duplicate implementation. |
| The extraction removed duplicate validator logic. | source-code | Commit `a844f719`; `src/lib/contract/validator-core.ts` | high | Reduces mixed-domain reasoning in the aggregate validator. |
| Public contract validation still passes. | tests | `pnpm vitest run src/lib/contract` passed with `13` files and `283` tests. | high | Covers loader, merger, preset, validator, and adjacent contract surfaces. |
| Public TypeScript exports remain compatible. | typecheck | `pnpm typecheck` passed. | high | Confirms the changed imports/types do not break exported TypeScript contracts. |
| No circular dependency was introduced. | source-code | `policy-validators-core.ts` imports `validator-helpers.js`, not `validator-core.ts`. | high | Prevents hidden runtime coupling between aggregate validation and policy validation. |
| Command registry scope did not leak into this slice. | source-code | Final JSC-178 changed-file set excludes `src/lib/cli/**`. | high | Preserves the bounded contract-validation objective. |
| Broad related-test closure is blocked by unrelated dirty work. | tests | `pnpm test:related` failed in init/scaffold worktree-template tests; staged related tests passed. | high | Keeps closure evidence honest without expanding JSC-178 into unrelated template repairs. |
| Aggregate checkout closure is blocked by non-JSC-178 signals. | tests | `pnpm check` failed after earlier stages passed, during the related-test stage, with baseline drift warnings and policy-gate demo output outside the JSC-178 file set. | high | Prevents the eval from overstating whole-checkout readiness while preserving the bounded extraction result. |
