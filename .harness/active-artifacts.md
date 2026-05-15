# Active Harness Specs And Plans

## Table Of Contents

- [Scope](#scope)
- [Current Active Route](#current-active-route)
- [Artifact Index](#artifact-index)
- [Duplicate Resolution](#duplicate-resolution)
- [Remaining Reconcile Items](#remaining-reconcile-items)

## Scope

Last reconciled: 2026-05-15.

This index is a local control-plane hygiene artifact. It reconciles tracked
`.harness/specs` and `.harness/plan` files against local merged-PR evidence and
the local Linear queue file. It does not claim live Linear, GitHub, or CI state
unless a live refresh is recorded in the referenced artifact.

## Current Active Route

| Route | Linear Key | Canonical Artifacts | Status | Next Safe Action |
| --- | --- | --- | --- | --- |
| Phase-exit evidence visibility and adapter follow-up | JSC-311 | `.harness/specs/2026-05-13-jsc-311-he-phase-exit-evidence-gates-spec.md`; `.harness/plan/2026-05-13-JSC-311-he-phase-exit-evidence-gates-plan.md` | Active follow-up candidate; internal contract merged | Create a narrow addendum/spec slice for operator-visible evidence and adapters into `HeGateResult/v1`; do not replay the merged internal contract slice. |

## Artifact Index

| Linear Key | Canonical Slug | Active Spec | Active Plan | Local Status | Notes |
| --- | --- | --- | --- | --- | --- |
| JSC-198 | flow-ops-closure-evidence-reconciliation | `.harness/specs/2026-05-09-jsc-198-flow-ops-closure-evidence-reconciliation-spec.md` | `.harness/plan/2026-05-09-JSC-198-flow-ops-closure-evidence-reconciliation-plan.md` | Later / legacy context | Artifact status remains `draft`; local queue demotes this behind JSC-311 integration unless stale closure repeats. |
| JSC-282 | command-truth-cockpit | `.harness/specs/coding-harness-agent-cockpit-compression-spec.md` | `.harness/plan/2026-05-08-architecture-JSC-282-command-truth-cockpit-plan.md` | Complete / historical | The earlier 2026-05-07 plan is explicitly superseded by the 2026-05-08 plan. |
| JSC-283 | packaged-skill-behavior-assurance | `.harness/specs/2026-05-08-jsc-283-packaged-skill-behavior-assurance-spec.md` | `.harness/plan/2026-05-08-architecture-JSC-283-packaged-skill-behavior-assurance-plan.md` | Historical with status drift | Local Linear queue records the issue as done; artifacts still say `draft`, so status promotion needs owner decision or direct evidence refresh. |
| JSC-288 | governance-trust-repair | `.harness/specs/2026-05-08-jsc-288-governance-trust-repair-spec.md` | `.harness/plan/2026-05-08-architecture-JSC-288-governance-trust-repair-plan.md` | Historical with status drift | Local Linear queue records the issue as done; artifacts still say `draft`, so status promotion needs owner decision or direct evidence refresh. |
| JSC-289 | ci-migration-boundary-recovery | `.harness/specs/2026-05-08-JSC-289-ci-migration-boundary-recovery-spec.md` | `.harness/plan/2026-05-08-architecture-JSC-289-ci-migration-boundary-recovery-plan.md` | Historical with status drift | Local Linear queue records the issue as done; artifacts still say `draft`, so status promotion needs owner decision or direct evidence refresh. |
| JSC-290 | validation-typed-gate-specs | `.harness/specs/2026-05-09-validation-typed-gate-specs-spec.md` | `.harness/plan/2026-05-09-JSC-290-validation-typed-gate-specs-plan.md` | Historical with status drift | The spec filename does not include the Linear key but is the plan origin. Local Linear queue records the issue as done; artifacts still say `draft`. |
| JSC-301 | route-decision-contract | `.harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md` | `.harness/plan/2026-05-11-JSC-301-route-decision-contract-plan.md` | Archived PR closeout context | Not the next active implementation slice. Keep as dependency context for JSC-311 control-plane work. |
| JSC-311 | he-phase-exit-evidence-gates | `.harness/specs/2026-05-13-jsc-311-he-phase-exit-evidence-gates-spec.md` | `.harness/plan/2026-05-13-JSC-311-he-phase-exit-evidence-gates-plan.md` | Active follow-up candidate; internal contract merged | PR #247 merged the internal `HeGateResult/v1` / `HePhaseExit/v1` contract and worktree baseline. The next slice is visibility/adapters. |

## Duplicate Resolution

| Linear Key | Duplicate Pattern | Resolution | Remaining Risk |
| --- | --- | --- | --- |
| JSC-282 | Two command-truth cockpit plans looked active: 2026-05-07 and 2026-05-08. | Marked `.harness/plan/2026-05-07-architecture-JSC-282-command-truth-cockpit-plan.md` as `superseded` by the 2026-05-08 plan. | None for local routing; live Linear was not refreshed in this pass. |
| JSC-311 | 2026-05-11 and 2026-05-13 spec/plan pairs exist for phase-exit evidence gates. | 2026-05-11 artifacts were already marked `superseded`; 2026-05-13 artifacts remain canonical for the merged internal contract and follow-up routing. | The next follow-up should be an addendum/new slice for visibility and adapters, not edits that imply the merged internal contract is incomplete. |

## Remaining Reconcile Items

- Live Linear was not refreshed during this local hygiene pass; tracker closure
  and live issue status remain explicit external actions.
- JSC-283, JSC-288, JSC-289, and JSC-290 have local queue evidence indicating
  completed work, while their tracked spec/plan front matter still says `draft`.
  Promote or close those statuses only after a dedicated evidence refresh or
  spec-owner decision.
- JSC-311 should move next to a small phase-exit evidence visibility and adapter
  slice. The merged internal contract should be treated as baseline evidence,
  not reimplemented.
