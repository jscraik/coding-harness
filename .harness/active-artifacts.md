# Active Harness Specs And Plans

## Table Of Contents

- [Scope](#scope)
- [Current Active Route](#current-active-route)
- [Artifact Index](#artifact-index)
- [Duplicate Resolution](#duplicate-resolution)
- [Closeout Reconcile Items](#closeout-reconcile-items)

## Scope

Last reconciled: 2026-05-15.

This index is a local control-plane hygiene artifact. It reconciles tracked
`.harness/specs` and `.harness/plan` files against local merged-PR evidence and
the local Linear queue file. It does not claim live Linear, GitHub, or CI state
unless a live refresh is recorded in the referenced artifact.

## Current Active Route

| Route | Linear Key | Canonical Artifacts | Status | Next Safe Action |
| --- | --- | --- | --- | --- |
| Phase-exit evidence visibility and adapter follow-up | JSC-311 | `.harness/specs/2026-05-13-jsc-311-he-phase-exit-evidence-gates-spec.md`; `.harness/plan/2026-05-13-JSC-311-he-phase-exit-evidence-gates-plan.md` | Implemented in current checkout; validation/PR closeout pending | Validate the `harness next --phase-exit <artifact>` cockpit path, then reconcile Linear and PR evidence before closing JSC-311. |

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

## Duplicate Resolution

| Linear Key | Duplicate Pattern | Resolution | Remaining Risk |
| --- | --- | --- | --- |
| JSC-282 | Two command-truth cockpit plans looked active: 2026-05-07 and 2026-05-08. | Marked `.harness/plan/2026-05-07-architecture-JSC-282-command-truth-cockpit-plan.md` as `superseded` by the 2026-05-08 plan. | None for local routing; live Linear was not refreshed in this pass. |
| JSC-311 | 2026-05-11 and 2026-05-13 spec/plan pairs exist for phase-exit evidence gates. | 2026-05-11 artifacts were already marked `superseded`; 2026-05-13 artifacts remain canonical for the merged internal contract and follow-up routing. | After this checkout is delivered, remaining risk moves to live Linear/PR closeout and future session-evidence ingestion. |

## Closeout Reconcile Items

- Live Linear was not refreshed during this local hygiene pass; tracker closure
  and live issue status remain explicit external actions.
- JSC-283, JSC-288, JSC-289, and JSC-290 are no longer active routing items in
  this index. Their older draft front matter is historical artifact state, not a
  current status-drift claim.
- JSC-311's current checkout implements the explicit artifact visibility path
  and adds `runtime-card/v1` as the cockpit summary input for `harness next`.
  Remaining JSC-311 closeout work is validation, PR #250 CI recovery, live
  Linear reconciliation, and a future session-collector evidence adapter slice
  if admitted separately.
