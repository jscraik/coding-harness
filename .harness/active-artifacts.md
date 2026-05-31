# Active Harness Specs And Plans

## Table Of Contents

- [Scope](#scope)
- [Current Active Route](#current-active-route)
- [Artifact Index](#artifact-index)
- [Duplicate Resolution](#duplicate-resolution)
- [Closeout Reconcile Items](#closeout-reconcile-items)

## Scope

Last reconciled: 2026-05-31T02:56Z (origin/main freshness, R158/R159 PR #322 pushes, and R160 release-readiness closeout remediation; live CI/review truth remains pending).

This index is a local control-plane hygiene artifact. It reconciles tracked
`.harness/specs` and `.harness/plan` files against local merged-PR evidence and
the local Linear queue file. It does not claim live Linear, GitHub, or CI state
unless a live refresh is recorded in the referenced artifact.

## Current Active Route

| Route | Linear Key | Canonical Artifacts | Status | Next Safe Action |
| --- | --- | --- | --- | --- |
| Codex runtime evidence verifier cockpit | JSC-363 | `.harness/specs/2026-05-24-codex-runtime-evidence-verifier-cockpit-spec.md` plus `.harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md` plus `docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md` plus `.harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md` plus `.harness/research/deep/2026-05-27-codex-system-prompt-operational-analysis.md` | Active Goal Governor board for the full lifecycle implementation. Historical PR #309 continuity is preserved for the goal-board index invariant: PR #309's branch head was `84bd19b1a5da56800e7cf4239c9f65348ccf2d96` and its current-main squash evidence is historical, not a current route blocker. R149 records PR #312 merged into main as squash commit `7e8cb93fa16636336194e15e53a592117b9f276a`. R150/R152 preserved the PR #318 lane and PU-040 validation. PR #319 merged into main on 2026-05-29 as squash commit `1afb519f7623f109b7a383688449c031541ff3dd`; R154 reanchors route truth because the pre-squash R153 branch head is no longer reachable from current main. PR #320 merged as current-main route truth. Current slice truth is R156/R157/R158/R159/R160: reviewed hidden-dependency guard hardening passed final adversarial, agent-native, and best-practices artifacts plus focused local validation; PR #322 metadata was repaired after live refresh showed stale feedback-loop PR text was failing `ci/circleci: linear-gate`; PR #322 review-thread remediation was pushed as `fa74a817fd5b476f10510ef26803c5a2790abd91`; R159 records the remaining current-head goal-evidence follow-up for R155 validators and current-PR handoff wording; and R160 records reviewed release-readiness closeout blocker remediation with governed_change regression coverage. The branch contains `origin/main` at `ddd2b966663114c385811fe01ae43ef98c0b3818`; PR #322 is open at `f208aa3da8d7c56fb36a7a121dd453a3f4268ecd` before the R160 remediation push; CodeRabbit, review threads, linked-issue truth, and CircleCI checks must be refreshed after the push. | Use the goal board as the current execution cockpit. Next safe action is to commit and push the R160 release-readiness closeout remediation, resolve only demonstrably fixed review threads, then refresh PR #322 checks/review-thread truth and Linear JSC-363 as separate lanes before any merge-ready, Judge/PM-ready, or goal-complete claim. |

## Artifact Index

| Linear Key | Canonical Slug | Active Spec | Active Plan | Local Status | Notes |
| --- | --- | --- | --- | --- | --- |
| JSC-198 | flow-ops-closure-evidence-reconciliation | `.harness/specs/2026-05-09-jsc-198-flow-ops-closure-evidence-reconciliation-spec.md` | `.harness/plan/2026-05-09-JSC-198-flow-ops-closure-evidence-reconciliation-plan.md` | Later / legacy context | Artifact status remains `draft`; local queue demotes this behind JSC-311 integration unless stale closure repeats. |
| JSC-282 | command-truth-cockpit | `.harness/specs/coding-harness-agent-cockpit-compression-spec.md` | `.harness/plan/2026-05-08-architecture-JSC-282-command-truth-cockpit-plan.md` | Complete / historical | The earlier 2026-05-07 plan is explicitly superseded by the 2026-05-08 plan. |
| JSC-283 | packaged-skill-behavior-assurance | `.harness/specs/2026-05-08-jsc-283-packaged-skill-behavior-assurance-spec.md` | `.harness/plan/2026-05-08-architecture-JSC-283-packaged-skill-behavior-assurance-plan.md` | Resolved historical context | Local queue records this work as done. Keep these artifacts as historical references only; do not route new work from their older front matter. |
| JSC-288 | governance-trust-repair | `.harness/specs/2026-05-08-jsc-288-governance-trust-repair-spec.md` | `.harness/plan/2026-05-08-architecture-JSC-288-governance-trust-repair-plan.md` | Resolved historical context | Local queue records this work as done. Keep these artifacts as historical references only; do not route new work from their older front matter. |
| JSC-289 | ci-migration-boundary-recovery | `.harness/specs/2026-05-08-JSC-289-ci-migration-boundary-recovery-spec.md` | `.harness/plan/2026-05-08-architecture-JSC-289-ci-migration-boundary-recovery-plan.md` | Resolved historical context | Local queue records this work as done. Keep these artifacts as historical references only; do not route new work from their older front matter. |
| JSC-290 | validation-typed-gate-specs | `.harness/specs/2026-05-09-validation-typed-gate-specs-spec.md` | `.harness/plan/2026-05-09-JSC-290-validation-typed-gate-specs-plan.md` | Resolved historical context | Local queue records this work as done. Keep these artifacts as historical references only; do not route new work from their older front matter. |
| JSC-301 | route-decision-contract | `.harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md` | `.harness/plan/2026-05-11-JSC-301-route-decision-contract-plan.md` | Archived PR closeout context | Not the next active implementation slice. Keep as dependency context for JSC-311 control-plane work. |
| JSC-311 | he-phase-exit-evidence-gates | `.harness/specs/2026-05-13-jsc-311-he-phase-exit-evidence-gates-spec.md` | `.harness/plan/2026-05-13-JSC-311-he-phase-exit-evidence-gates-plan.md` | Implemented in current checkout; validation/PR closeout pending | PR #247 merged the internal `HeGateResult/v1` / `HePhaseExit/v1` contract and worktree baseline. The current checkout adds the operator-visible `harness next --phase-exit <artifact>` path. |
| JSC-331 | harness-assurance-artifact-handling | n.a. | `.harness/plan/2026-05-18-agent-testing-gates-harness-assurance-plan.md`; `.harness/research/audits/2026-05-20-evidence-led-codebase-gap-audit.md`; `docs/goals/jsc-331-goal-governed-evidence-led-implementation/goal.md` | Active assurance route with ready-not-started Goal Governor board | Selected instead of creating a duplicate issue because live Linear already has a coding-harness apparatus/assurance lane. The audit now adds the Codex runtime-evidence contract and `.agents` observed-state bridge as the next durable hardening targets. The Goal Governor board is prepared for owner kickoff and begins with read-only governor bootstrap, not Worker implementation. JSC-308 remains related HE artifact-policy context. |
| JSC-363 | codex-runtime-evidence-verifier-cockpit | `.harness/specs/2026-05-24-codex-runtime-evidence-verifier-cockpit-spec.md` | `.harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md`; `docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md`; `.harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md`; `.harness/research/deep/2026-05-26-codex-ecosystem-operational-review.md`; `.harness/research/deep/2026-05-27-codex-system-prompt-operational-analysis.md` | Current active Goal Governor route for this thread | The board governs the full lifecycle, not just Phase 1. The standard goal-board validator now runs audit freshness for the 2026-05-26 evidence-led audit, and the goal board now adopts the 2026-05-27 system-prompt operational analysis as SPG-001 through SPG-012. Future audit or system-prompt-analysis edits must be re-adopted in receipts before done, Judge/PM, closeout, or merge-readiness claims. |

## Duplicate Resolution

| Linear Key | Duplicate Pattern | Resolution | Remaining Risk |
| --- | --- | --- | --- |
| JSC-282 | Two command-truth cockpit plans looked active: 2026-05-07 and 2026-05-08. | Marked `.harness/plan/2026-05-07-architecture-JSC-282-command-truth-cockpit-plan.md` as `superseded` by the 2026-05-08 plan. | None for local routing; live Linear was not refreshed in this pass. |
| JSC-311 | 2026-05-11 and 2026-05-13 spec/plan pairs exist for phase-exit evidence gates. | 2026-05-11 artifacts were already marked `superseded`; 2026-05-13 artifacts remain canonical for the merged internal contract and follow-up routing. | After this checkout is delivered, remaining risk moves to live Linear/PR closeout and future session-evidence ingestion. |
| JSC-331 | The 2026-05-18 assurance plan was active but had no Linear owner and was not indexed. | Selected live issue JSC-331, added artifact handling routine to the plan, and synced the 2026-05-21 runtime-evidence audit update to Linear. | Live Linear is now reachable for this lane. Remaining risk is implementation/PR closeout evidence, not tracker reachability. |

## Closeout Reconcile Items

- Live Linear was refreshed for JSC-331 on 2026-05-21; tracker closure and
  live issue status for other issues remain explicit external actions.
- JSC-283, JSC-288, JSC-289, and JSC-290 are no longer active routing items in
  this index. Their older draft front matter is historical artifact state, not a
  current status-drift claim.
- JSC-311's current checkout implements the explicit artifact visibility path
  and adds `runtime-card/v1` as the cockpit summary input for `harness next`.
  Remaining JSC-311 closeout work is validation, PR #250 CI recovery, live
  Linear reconciliation, and a future session-collector evidence adapter slice
  if admitted separately.
- JSC-331 now owns the current harness assurance and route-driving artifact
  handling routine. The 2026-05-20 evidence-led audit is the current graded
  fix plan and now includes the Codex runtime-evidence contract and `.agents`
  observed-state bridge. The Goal Governor kickoff board is
  `docs/goals/jsc-331-goal-governed-evidence-led-implementation/goal.md`.
  Before any `.harness` artifact drives implementation, confirm live Linear
  ownership, tracked state, referenced-path existence, stale frontmatter
  disposition, active-index freshness, native goal reconciliation, board
  validity, and completion-blocking review evidence from `$he-code-review`,
  `@testing-reviewer`, `$simplify`, `$unslopify`,
  `$improve-codebase-architecture`, and `$ubiquitous-language` when
  implementation changed.
- JSC-363 is the current execution route for the Codex Runtime Evidence
  Verifier Cockpit goal. Use
  `docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md` as the
  cockpit, keep `.harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md`
  freshness enforced through `scripts/check-goal-board.py`, and keep Linear,
  PR, CI, review-thread, Project Brain, and runtime evidence truth separated in
  receipts. Historical PR #309 continuity remains indexed by branch head
  `84bd19b1a5da56800e7cf4239c9f65348ccf2d96` for validator compatibility;
  it is not current route truth. R149 records the post-merge refresh after PR
  #312 merged into main as squash commit
  `7e8cb93fa16636336194e15e53a592117b9f276a`. R150/R152 record the PR #318
  and PU-040 validator-hardening lane. PR #319 merged into main as squash
  commit `1afb519f7623f109b7a383688449c031541ff3dd`; R154 is the current
  route-truth reanchor because the latest pre-squash branch receipt R153 is no
  longer reachable from current main. PR #322 is the current live branch lane
  for `codex/jsc-363-pr320-rerun`; R157 records that its stale PR title/body
  were repaired after `ci/circleci: linear-gate` failed on missing JSC-363 PR
  metadata. R158 records remediation for PR #322 review-thread findings,
  including the release-readiness handoff-evidence fix, and was pushed as
  `fa74a817fd5b476f10510ef26803c5a2790abd91`. R159 records the remaining
  goal-evidence follow-up for R155 validators and current-PR handoff wording,
  and was pushed as `f208aa3da8d7c56fb36a7a121dd453a3f4268ecd`. R160 records
  the release-readiness closeout blocker remediation before push: explicit
  `releaseReadinessImpact` values now feed top-level closeout blockers, with
  governed-change regression coverage. PR #322 checks, CodeRabbit/review-thread
  truth, linked-issue status, and Linear JSC-363 must be refreshed after the
  next push before any closeout claim.
  Historical stacked PRs may still show CONFLICTING/DIRTY metadata because
  their old head/base refs are stale. That historical metadata is not an active
  open-PR merge blocker. Before any
  closeout, refresh Linear
  JSC-363, current PR/CI/review-thread truth, runtime producer evidence,
  delivery-truth consumption, Judge/PM readiness, merge execution, and final
  goal completion as separate lanes.
- JSC-308 is related broader HE runtime-authoring/process-exhaust context. Do
  not use it as the coding-harness tracker for the 2026-05-18 assurance plan
  unless Linear is explicitly reparented or updated later.
