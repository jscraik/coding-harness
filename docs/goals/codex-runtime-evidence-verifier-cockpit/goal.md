# Codex Runtime Evidence Verifier Cockpit Goal

## Table of Contents

- [Native Goal Prompt](#native-goal-prompt)
- [Objective](#objective)
- [Why This Exists](#why-this-exists)
- [Source Artifacts](#source-artifacts)
- [Operating Principles](#operating-principles)
- [Scope](#scope)
- [Lifecycle Slices](#lifecycle-slices)
- [Slice Execution Contract](#slice-execution-contract)
- [Review and Validation Contract](#review-and-validation-contract)
- [GitHub and PR Triage Contract](#github-and-pr-triage-contract)
- [Documentation Accuracy Gate](#documentation-accuracy-gate)
- [Completion Contract](#completion-contract)
- [Blocked Stop Conditions](#blocked-stop-conditions)
- [Activation Boundary](#activation-boundary)
- [Startup Checklist](#startup-checklist)

## Native Goal Prompt

Use this exact native prompt when starting or restoring the goal:

```text
/goal Follow docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md
```

`/goal Follow <path>` is a prompt convention. The agent must read this file, `state.yaml`, and `receipts.jsonl` before acting. Native goal state is live runtime context; this board is the durable repo-owned coordination surface.

## Objective

Implement the full lifecycle described by `.harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md` so Coding Harness can ingest Codex runtime evidence, project it into runtime cards, verify delivery claims against current evidence, keep PR/CI/review/Linear truth separated, and block unsupported closeout claims.

This is not a Phase 1-only prompt. Phase 1 is only the first implementation stage. The goal is complete only when the plan's lifecycle units through hardening, documentation accuracy, PR triage, and Judge/PM-ready evidence are finished or explicitly blocked with current evidence.

## Why This Exists

Repeated steering in this thread showed that planning artifacts, local validation, review state, tracker state, and merge readiness can be accidentally blended into a false-success claim. This goal exists to turn that correction into an execution system: small scoped slices, intent before implementation, deterministic validation after every slice, and PR truth that keeps moving while the coordinator prepares the next safe slice.

## Source Artifacts

Primary implementation plan:

- `.harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md`

Associated specification:

- `.harness/specs/2026-05-24-codex-runtime-evidence-verifier-cockpit-spec.md`

Steering admission:

- `.harness/implementation-notes/2026-05-24-runtime-evidence-full-lifecycle-steering-admission.md`

Supporting audit:

- `.harness/research/audits/2026-05-24-evidence-led-codebase-gap-audit.md`

Tracker:

- Linear issue `JSC-363`

Cross-repo context, read-only unless explicitly authorized:

- `/Users/jamiecraik/dev/codex`

## Operating Principles

- Scope AI tasks tightly to small bounds and deep modules.
- Make implementation intent a first-class artifact before code changes.
- Review intent before implementation.
- Automate every check that can be made deterministic.
- Prefer validators over reminders.
- Prefer runtime truth over summaries.
- Prefer structured evidence over conversational memory.
- Keep `harness next --json` as a narrow cockpit; add evidence-backed metadata instead of broad new agent surfaces.
- Do not treat final prose, mailbox text, local validation, or stale external snapshots as delivery proof.

## Scope

Primary writable repo:

- `/Users/jamiecraik/dev/coding-harness`

Implementation scope:

- evidence receipts
- Codex runtime evidence schemas and adapters
- runtime-card projection
- delivery-truth verifier
- review-state and external-state packets
- root hygiene evidence
- Codex runtime producer bridge
- PR/CI/review/Linear closeout refresh
- Judge/PM audit packet
- documentation, validation, and CI hardening required by the plan

Protected or constrained scope:

- Do not edit `/Users/jamiecraik/dev/codex` unless Jamie explicitly expands write authority.
- Preserve unrelated dirty worktree changes.
- Do not weaken plan, spec, acceptance IDs, stop conditions, or validation gates to fit already-written code.
- Do not claim goal completion from plan/spec/research changes alone.

## Lifecycle Slices

Execute the plan's PU units in lifecycle order unless a reviewed intent artifact proves a safer split:

| Stage | Units | Completion Meaning |
| --- | --- | --- |
| L0 | steering admission | Human correction is captured as a repo artifact before normal implementation resumes. |
| L1 | PU-000 | Intent, review receipt, baseline, and acceptance coverage exist before runtime implementation. |
| L2 | PU-001 through PU-008 | Fixture-backed verifier foundation exists, including receipts, Codex packet validation, adapter projection, private delivery-truth, root, redaction, and non-blending tests. |
| L3 | PU-009 through PU-011 | Production review-state, external-state, delivery-truth, and root hygiene paths are wired. |
| L4 | PU-012 through PU-013 | Codex runtime producer bridge feeds validated runtime evidence into runtime cards and the cockpit. |
| L5 | PU-014 through PU-015 | PR, CI, review, Linear, root tidiness, and Judge/PM audit readiness become claim-verifiable. |
| L6 | PU-016 | Documentation, architecture context, CI, validators, and maintenance ownership are synchronized. |

Each slice should be small enough for one clear branch, one PR, one primary module family, and one unambiguous validation story.

## Slice Execution Contract

For every slice:

1. Refresh repo orientation: nearest `AGENTS.md`, `CODESTYLE.md`, plan, spec, current branch, and dirty worktree.
2. Create or update the slice intent artifact before implementation. It must include objective, allowed files, forbidden files, assumptions, stop conditions, validation gates, reviewer roles, PR strategy, and rollback path.
3. Review the intent before implementation. Do not write runtime code until the intent review is recorded.
4. Implement the smallest deep-module change that satisfies the slice.
5. Add or update deterministic tests, fixtures, schemas, validators, or receipts for the behavior changed.
6. Run the slice validation contract.
7. Fix valid findings and rerun the narrowest proving checks.
8. Record a receipt in `receipts.jsonl` after each completed slice.
9. Commit the slice atomically, push it, and open or update the matching GitHub PR.
10. Launch PR triage with `$pr-green-sweep` and continue to the next safe slice while triage runs.

Parallel continuation rule:

- Continue to the next slice only when dependency order and branch state allow it. If the next slice depends on the PR under triage, perform non-mutating prep, intent drafting, or review instead of contaminating the active PR branch.
- If parallel code work is safe, use an explicit branch or worktree strategy and record which PR branch each agent owns.

## Review and Validation Contract

After each slice, validate with these skill lenses or their repo-owned deterministic equivalents:

- `$simplify`: confirm the slice did not add unnecessary abstractions, duplicate truth layers, or broad public surfaces.
- `$unslopify`: remove vague claims, placeholder wording, speculative assertions, and AI-shaped docs or PR text.
- `$he-code-review`: review the slice against Harness Engineering expectations, evidence contracts, and implementation-risk boundaries.
- `$testing`: prove the touched behavior with the narrowest meaningful tests first, then broaden according to risk.

Before marking any slice done, also run independent review with:

- `@adversarial-reviewer`
- `@agent-native-reviewer`

Reviewer outputs must be artifact-first when a swarm is requested. Verify expected review artifacts exist and are non-empty before synthesis. Mailbox status is not enough.

Every validation report must classify results as exactly one of:

- `pass`
- `fail`
- `blocked`
- `not applicable`

## GitHub and PR Triage Contract

When the coordinator is happy with a slice:

1. Commit only the slice's intended files.
2. Push the branch to GitHub.
3. Open or update a PR with truthful lifecycle scope.
4. Launch a subagent to run `$pr-green-sweep` against that PR until faults are fixed or explicitly blocked.
5. While the PR triage subagent works, continue to the next safe slice under the parallel continuation rule.

The PR may claim only the lifecycle unit it actually completes. A PR cannot claim green, tidy, delivered, merged, goal-ready, or merge-ready unless delivery-truth has current claim-support evidence for each separate claim.

## Documentation Accuracy Gate

Before cleanup, closeout, or final handoff:

- Run `$docs-expert` to check that docs, specs, plans, architecture context, and user-facing explanations match the implementation.
- Run `$agents-md` when agent instructions, workflow policy, validation commands, or operating rules changed.
- Update required docs and instruction surfaces in the same slice when repo rules require it.
- Do not treat documentation cleanup as a cosmetic final step; stale docs are an implementation risk for this goal.

## Completion Contract

The goal is complete only when all of the following are true:

- PU-000 through PU-016 are implemented, explicitly marked not applicable with evidence, or explicitly blocked with owner-visible evidence.
- Each implemented slice has an intent artifact, validation evidence, review evidence, commit, PR truth, and receipt.
- Delivery-truth separates local validation, remote checks, review threads, tracker state, root hygiene, and merge readiness.
- Runtime cards can cite Codex runtime evidence without scraping final response prose.
- External-state snapshots include freshness, TTL, and head SHA where required.
- Review-state packets capture reviewer artifacts, comments, unresolved threads, and validation ownership.
- PR triage has either fixed or explicitly classified all faults.
- Documentation and agent instruction surfaces are accurate.
- A final Judge/PM-ready audit packet exists, or the goal is marked blocked with current evidence.

## Blocked Stop Conditions

Stop and report before continuing if:

- the goal board fails validation
- slice intent is missing or has not passed review
- dirty worktree overlap would absorb unrelated user changes
- a required validator cannot run and no meaningful proxy exists
- the same failure repeats twice without research and a durable correction
- reviewer artifacts are missing after one focused retry
- GitHub, PR, CI, review, or Linear state is stale where claim support requires current truth
- a slice would require write authority outside the approved scope
- continuing a later slice would contaminate a PR under triage

## Activation Boundary

This package is prepared for later kickoff. Do not begin Worker implementation until Jamie explicitly says:

```text
KICK OFF CODEX RUNTIME EVIDENCE VERIFIER COCKPIT GOAL
```

Before that phrase appears, allowed work is limited to setup validation, board repair, native goal reconciliation, answering questions, and refining this goal prompt.

## Startup Checklist

1. Read nearest `AGENTS.md`, `CODESTYLE.md`, this `goal.md`, `state.yaml`, and `receipts.jsonl`.
2. Reconcile native goal state against this board.
3. Check current branch, worktree dirt, and uncommitted user changes.
4. Run the Goal Governor board validator.
5. Read the implementation plan and associated spec.
6. Confirm whether the activation phrase is present.
7. If not activated, stop after readiness reporting.
8. If activated, begin with the active Scout task in `state.yaml`, then create/review the first slice intent artifact before implementation.
