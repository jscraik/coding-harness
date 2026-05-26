# Codex Runtime Evidence Verifier Cockpit Goal

## Table of Contents

- [Native Goal Prompt](#native-goal-prompt)
- [Objective](#objective)
- [Why This Exists](#why-this-exists)
- [Source Artifacts](#source-artifacts)
- [Operating Principles](#operating-principles)
- [Scope](#scope)
- [Lifecycle Slices](#lifecycle-slices)
- [Audit Gap Enforcement Addendum](#audit-gap-enforcement-addendum)
- [Codex Ecosystem Operational Review Addendum](#codex-ecosystem-operational-review-addendum)
- [Project Brain Memory Contract](#project-brain-memory-contract)
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
- `.harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md`

Supporting operational review:

- `.harness/research/deep/2026-05-26-codex-ecosystem-operational-review.md`

Project Brain and memory authority:

- `.harness/README.md`
- `.harness/active-artifacts.md`
- `.harness/memory/LEARNINGS.md`
- `.harness/knowledge/**`
- `.harness/research/evidence-patterns.json`

Tracker:

- Linear issue `JSC-363`: <https://linear.app/jscraik/issue/JSC-363/coding-harness-implement-codex-runtime-evidence-verifier-cockpit-phase>

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
- Use Project Brain and repo-local memory before slice work; if those surfaces are unavailable, record the blocker before proceeding.
- Treat Linear as planning and ownership truth, not runtime proof; every closeout claim that mentions tracker alignment must refresh `JSC-363` and record status/freshness separately from code, CI, review, and runtime evidence.
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
| L6 | PU-016 plus audit and ecosystem review adoption | Documentation, architecture context, CI, validators, maintenance ownership, Project Brain memory use, Linear tracker alignment, the 2026-05-26 audit gap closure plan, and the Codex ecosystem operational review adoption plan are synchronized. |

Each slice should be small enough for one clear branch, one PR, one primary module family, and one unambiguous validation story.

## Audit Gap Enforcement Addendum

The 2026-05-26 evidence-led audit is now part of this goal's completion contract. The goal may not be marked complete while any listed gap is merely described in research. Each gap must be implemented, explicitly blocked with owner-visible evidence, or moved to a tracked follow-up accepted by the Judge/PM audit.

| Audit Gap | Required Goal Treatment | Minimum Proof |
| --- | --- | --- |
| GAP-001 Local Memory preflight downgrade | P0 trust-boundary slice. Required preflight cannot silently skip Local Memory or Project Brain readiness. | Failing regression for old legacy downgrade plus passing required-mode preflight evidence. |
| GAP-002 skipped or neutral CI credited as pass | P0 closeout-verifier slice. Required CI conclusions other than success must block or become unknown unless an explicit exception exists. | Table-driven PR closeout/external-state tests for success, skipped, neutral, cancelled, missing, stale, and timed-out states. |
| GAP-003 public runtime packet schemas missing | Public contract slice. Runtime-card, harness-decision, review-state, external-state, delivery-truth, decision-request, and session-context packets need schemas or documented blocked ownership. | Schema files, fixtures, and schema parity tests, or a tracked blocked decision. |
| GAP-004 session and work stream traversal missing | Runtime maturity slice. Add a read-only session and work stream context command or explicitly block it with owner decision. | CLI JSON contract, tests, and docs proving traversal without write authority. |
| GAP-005 structured decision requests partial | Governance slice. Decision request intent, authority, human escalation, and stale-state handling must be machine-readable. | Decision-request contract/tests or tracked follow-up accepted by Judge/PM. |
| GAP-006 policy-gate risk chain contradiction | P0 safety slice. High-risk actions must fail closed where the contract says they block. | Policy-gate tests and docs/contract sync proving no warn-only contradiction remains. |
| GAP-007 architecture enforcement too local | Mechanical enforcement slice. Critical architecture drift warnings need explicit error/warning ownership. | Focused architecture validator regression and refreshed architecture docs/context. |
| GAP-008 stale context detection not routine | Context-health slice. Project Brain, active artifacts, runtime cards, and memory freshness need routine stale-state classification. | `harness next` or agent-readiness metadata plus tests for stale/expired/missing context. |
| GAP-009 reviewer artifact coverage not universal | Closeout gate slice. Required reviewer artifacts must be verified by path, size, producer, head SHA, and expected role before closeout. | Reviewer-coverage tests and PR closeout/Judge audit blockers for missing or stale artifacts. |
| GAP-010 browser evidence not routine | Validation-hardening slice. Browser evidence requirements must be explicit when UI/browser surfaces change. | Browser smoke/visual evidence gate or documented non-applicability for non-UI slices. |
| GAP-011 skill density overlap unchecked | Skill-governance slice. Skill overlap and trigger density need a validator or accepted follow-up. | Skill-density check, fixtures, and docs, or tracked follow-up. |
| GAP-012 repeatable trace evidence not default | Runtime trace slice. Runs should produce repeatable JSONL/session evidence or explicitly classify why not. | Trace/session output contract, tests, and closeout evidence linkage. |

Audit gap closure rules:

- P0 audit gaps are allowed to interrupt PU-016 documentation work because they reduce false-success, stale-state, unsafe-command, or missing-evidence risk.
- A gap is not closed by prose. It needs code, a validator, a schema, a receipt, a PR-truth update, or an accepted blocked decision.
- If a gap is deferred, the receipt must name the owner, follow-up artifact, risk accepted, and why it is safe to keep implementing later slices.
- Judge and PM tasks must review the audit gap matrix before any final completion claim.

## Codex Ecosystem Operational Review Addendum

The 2026-05-26 Codex ecosystem operational review is adopted as steering evidence for this goal. It does not authorize copying Codex internals into Coding Harness. It steers the implementation back toward a thin Harness verifier cockpit that ingests Codex-native runtime facts, binds them to identity, and blocks unsupported claims.

| Finding | Required Goal Treatment | Minimum Proof |
| --- | --- | --- |
| Codex runtime state is the new control plane | Add or explicitly block `codex-runtime-state/v1` as an internal adapter output sourced from app-server, rollout trace, hook, SDK-shaped, or fixture packets. | Adapter fixtures for direct, degraded, missing, blocked, and stale packets. |
| Identity is operational currency | Promote `RuntimeIdentity/v1` or an equivalent identity spine across runtime cards, evidence bundles, verifier receipts, artifacts, PR/CI/Linear refs, and replay seeds. | Negative tests for missing, mismatched, unknown, and stale identity fields without blocking orientation-only use too broadly. |
| Claim-vs-evidence must be canonical closeout | Keep `ClaimIntent/v1` to required evidence to verifier receipt as the closeout model for done, merge-ready, review-addressed, root-tidy, goal-complete, and runtime-proof-valid claims. | Fixture-backed verifier decisions that allow, downgrade, block, or return unknown with owner and next action. |
| Goal, permission, sandbox, approval, and environment parity are runtime truth | Project Codex goal status, permission profile, sandbox policy, approval reviewer, environment id, and runtime workspace roots into runtime-card summaries without storing secrets. | Fixtures for paused, blocked, budget-limited, read-only, wrong environment, missing approval reviewer, and redacted env values. |
| Queue semantics prevent stale steering | Add or explicitly defer `SteeringQueue/v1` with `expectedTurnId`, `expectedHeadSha`, expiry, mode, and merge policy before autonomous continuation or delayed work depends on a prior turn. | Replay fixtures for stale turn, stale branch head, superseded artifact, and expired queue items. |
| Artifacts are runtime surfaces | Treat implementation notes, review artifacts, screenshots, CSV/PDF/doc outputs, and runtime cards as artifact state that can be inspected, with lifecycle, lineage, preview, and verifier refs. | Artifact runtime fixtures for missing path, stale front matter, broken preview, unsupported claim, and mismatched lineage. |
| Repeatable telemetry is the learning loop | Convert repeated steering, blocked runtime, auth recovery, stale PR head, review churn, and degraded observability into replay seeds or blocked decisions. | Evidence-pattern or replay-seed validation that names source event, target validator, and adoption status. |
| Hooks make agent work attributable | Require subagent/reviewer work to bind role, subagent id/type when available, artifact path, head SHA, and producer. | Reviewer artifact receipts fail closed when producer, role, size, head SHA, or expected artifact path is missing. |

Adoption rules:

- The ecosystem review is advisory until this section and `state.yaml` adopt specific findings; after adoption, the listed findings are goal steering constraints.
- Harness must not become a competing Codex app-server, goal store, scheduler, tool registry, or thread engine.
- Runtime cards remain cockpit summaries and pointers, not warehouses for raw prompts, raw telemetry, review bodies, secrets, or bulky artifacts.
- Linear `JSC-363` remains the tracker anchor for this goal. If the Linear issue title or description still says Phase 1, future closeout must record that mismatch and either update Linear or add an accepted scope note before claiming full-lifecycle tracker alignment.
- Every future Worker/Judge/PM receipt should include `ecosystem_review_findings` when a slice touches runtime identity, runtime state, claim verification, queueing, artifacts, telemetry, hooks, or Codex parity.

## Project Brain Memory Contract

Project Brain and repo-local memory are required operating surfaces for this goal, not optional background context.

Before each new slice or PR closeout pass:

1. Read the current goal board and `.harness/active-artifacts.md`.
2. Check `.harness/memory/LEARNINGS.md` and relevant `.harness/knowledge/**` domain pages for prior rules, blockers, or repeated-failure patterns.
3. Check `.harness/research/evidence-patterns.json` before adopting research-derived guidance.
4. Use the repo-owned Project Brain CLI path when the slice depends on indexed knowledge, and record the exact command or blocker in the receipt.
5. Promote any repeated steering, audit correction, or newly discovered invariant into Project Brain memory, `.harness/knowledge/**`, a validator, or a tracked explicit skip reason before marking the slice done.

Project Brain memory is claim support only when it is current, repo-local, and referenced by a receipt. Stale or unavailable memory can orient work, but it cannot support closeout, merge readiness, or Judge/PM-ready claims.

## Slice Execution Contract

For every slice:

1. Refresh repo orientation: nearest `AGENTS.md`, `CODESTYLE.md`, plan, spec, current branch, and dirty worktree.
2. Refresh Project Brain memory: `.harness/active-artifacts.md`, `.harness/memory/LEARNINGS.md`, relevant `.harness/knowledge/**`, and adopted research patterns. Record the command or blocker in the slice receipt.
3. Create or update the slice intent artifact before implementation. It must include objective, allowed files, forbidden files, assumptions, stop conditions, validation gates, reviewer roles, PR strategy, Project Brain memory inputs, audit-gap mapping, and rollback path.
4. Review the intent before implementation. Do not write runtime code until the intent review is recorded.
5. Implement the smallest deep-module change that satisfies the slice.
6. Add or update deterministic tests, fixtures, schemas, validators, or receipts for the behavior changed.
7. Run the slice validation contract.
8. Fix valid findings and rerun the narrowest proving checks.
9. Record a receipt in `receipts.jsonl` after each completed slice.
10. Commit the slice atomically, push it, and open or update the matching GitHub PR.
11. Launch PR triage with `$pr-green-sweep` and continue to the next safe slice while triage runs.

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
- GAP-001 through GAP-012 from `.harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md` are implemented, explicitly blocked, or tracked as accepted follow-ups by the Judge/PM audit.
- Each implemented slice has an intent artifact, validation evidence, review evidence, commit, PR truth, and receipt.
- Each slice receipt records Project Brain memory inputs or a blocker for unavailable memory.
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
- Project Brain or Local Memory is required for the slice and unavailable without an explicit optional-mode receipt
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
5. Read the implementation plan, associated spec, and the 2026-05-26 evidence-led gap audit.
6. Refresh Project Brain memory inputs: `.harness/active-artifacts.md`, `.harness/memory/LEARNINGS.md`, relevant `.harness/knowledge/**`, and `.harness/research/evidence-patterns.json`.
7. Confirm whether the activation phrase is present.
8. If not activated, stop after readiness reporting.
9. If activated, begin with the active Scout task in `state.yaml`, then create/review the first slice intent artifact before implementation.
