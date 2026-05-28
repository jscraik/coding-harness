# Active Harness Specs And Plans

## Table Of Contents

- [Scope](#scope)
- [Current Active Route](#current-active-route)
- [Artifact Index](#artifact-index)
- [Duplicate Resolution](#duplicate-resolution)
- [Closeout Reconcile Items](#closeout-reconcile-items)

## Scope

Last reconciled: 2026-05-28.

This index is a local control-plane hygiene artifact. It reconciles tracked
`.harness/specs` and `.harness/plan` files against local merged-PR evidence and
the local Linear queue file. It does not claim live Linear, GitHub, or CI state
unless a live refresh is recorded in the referenced artifact.

## Current Active Route

| Route | Linear Key | Canonical Artifacts | Status | Next Safe Action |
| --- | --- | --- | --- | --- |
| Codex runtime evidence verifier cockpit | JSC-363 | `.harness/specs/2026-05-24-codex-runtime-evidence-verifier-cockpit-spec.md` plus `.harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md` plus `docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md` plus `.harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md` plus `.harness/research/deep/2026-05-27-codex-system-prompt-operational-analysis.md` | Active Goal Governor board for the full lifecycle implementation. PR #309 is merged; its branch head was `84bd19b1a5da56800e7cf4239c9f65348ccf2d96` and current main includes the squash commit `75b77c2543053ade3c3e793d28f8811998b9f01c`. R114 reconciles the board to current HEAD and encodes the tool promotion threshold. R115 records PU-035 ArtifactRuntimeSurface/v1 local contract implementation on branch `codex/jsc-363-artifact-runtime-surface`; commit `565921f7` is pushed and PR #312 is open against `codex/jsc-363-goal-board-merge-reconcile`. R118 records PU-036 commit `618b31c7a2237531a2d62e8f9320025fc3372cb6`, pushed branch `codex/jsc-363-replay-packet-surface`, PR #313 open against `codex/jsc-363-artifact-runtime-surface`, and all visible PR #313 checks passing. R120 records PU-037 PromptContextDriftReport/v1 local implementation and validation on branch `codex/jsc-363-prompt-context-drift-validator`. GitHub review-thread truth, Linear full-lifecycle scope alignment, Judge/PM readiness, runtime producer emission, delivery-truth consumption, merge readiness, and final goal completion truth remain unclaimed. | Use the goal board as the current execution cockpit. Next safe action is PU-037 commit, push, PR creation against the current JSC-363 stack base, then isolated PR triage with git fetch and env-backed CircleCI/GitHub checks while the coordinator keeps PR checks, reviewDecision, Linear scope alignment, merge readiness, Judge/PM readiness, and goal completion as separate truth lanes. |

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
  receipts. PR #309 is merged; the PR branch head was
  `84bd19b1a5da56800e7cf4239c9f65348ccf2d96`, and current main includes
  squash commit `75b77c2543053ade3c3e793d28f8811998b9f01c`. R114 restores
  current-head goal-board freshness and encodes the tool promotion threshold,
  and R115 records PU-035 ArtifactRuntimeSurface/v1 local contract evidence on
  branch `codex/jsc-363-artifact-runtime-surface`. R118 records that PU-036
  ReplayPacket/v1 is committed, pushed, open as PR #313, and green on all
  visible PR checks, while PR #310 has also been repaired and is green after
  linked-issue metadata recovery. Merge-readiness, Linear scope alignment,
  review-thread truth, Judge/PM readiness, runtime producer emission,
  delivery-truth consumption, and final closeout remain unclaimed.
- JSC-308 is related broader HE runtime-authoring/process-exhaust context. Do
  not use it as the coding-harness tracker for the 2026-05-18 assurance plan
  unless Linear is explicitly reparented or updated later.
