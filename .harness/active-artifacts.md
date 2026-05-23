# Active Harness Specs And Plans

## Table Of Contents

- [Scope](#scope)
- [Current Active Route](#current-active-route)
- [Artifact Index](#artifact-index)
- [Duplicate Resolution](#duplicate-resolution)
- [Closeout Reconcile Items](#closeout-reconcile-items)

## Scope

Last reconciled: 2026-05-21.

This index is a local control-plane hygiene artifact. It reconciles tracked
`.harness/specs` and `.harness/plan` files against local merged-PR evidence and
the local Linear queue file. It does not claim live Linear, GitHub, or CI state
unless a live refresh is recorded in the referenced artifact.

## Current Active Route

| Route | Linear Key | Canonical Artifacts | Status | Next Safe Action |
| --- | --- | --- | --- | --- |
| Harness assurance and artifact handling routine | JSC-331 | `.harness/plan/2026-05-18-agent-testing-gates-harness-assurance-plan.md` plus `.harness/research/audits/2026-05-20-evidence-led-codebase-gap-audit.md` plus `docs/goals/jsc-331-goal-governed-evidence-led-implementation/goal.md` | Active local plan selected to live Linear issue; artifact routine, review stack, Codex runtime-evidence audit update, and Goal Governor kickoff board added | Use the goal board and audit as the current graded fix plan: start with governor bootstrap, harden false-success edges first, add `runtime-evidence-contract/v1`, then expand issue-loop/product-driver/Linear tracker enforcement. Keep JSC-308 as related broader artifact-policy context. |

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
- JSC-308 is related broader HE runtime-authoring/process-exhaust context. Do
  not use it as the coding-harness tracker for the 2026-05-18 assurance plan
  unless Linear is explicitly reparented or updated later.
