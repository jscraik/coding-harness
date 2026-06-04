# Codex Runtime Evidence Verifier Cockpit Goal

## Table of Contents

- [Native Goal Prompt](#native-goal-prompt)
- [Objective](#objective)
- [Current Reconciliation Status](#current-reconciliation-status)
- [Why This Exists](#why-this-exists)
- [Source Artifacts](#source-artifacts)
- [Operating Principles](#operating-principles)
- [Scope](#scope)
- [Lifecycle Slices](#lifecycle-slices)
- [Audit Gap Enforcement Addendum](#audit-gap-enforcement-addendum)
- [Codex Ecosystem Operational Review Addendum](#codex-ecosystem-operational-review-addendum)
- [Codex-Native Current-Main Refinement Addendum](#codex-native-current-main-refinement-addendum)
- [Codex System Prompt Operational Analysis Addendum](#codex-system-prompt-operational-analysis-addendum)
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

## Current Reconciliation Status

Last updated during the 2026-06-03 current-main route-truth refresh after the
PR stack merged.

Current route truth:

- `main` and `origin/main` are synchronized at `50a6d0b5d764e35395e12190a465e854c26784fd`.
- Live GitHub reports zero open pull requests for `jscraik/coding-harness`.
- PR #321, PR #322, PR #323, PR #325, PR #326, PR #327, PR #328, PR #329, and PR #330 are merged route or foundation lanes for this goal.
- PR #330 merged into `main` at 2026-06-03T20:43:56Z as `docs(goal): promote CircleCI env recovery rule`.
- Live Linear `JSC-363` was refreshed after the PR stack merged: status is `Done`, completed at 2026-06-03T20:44:00Z, and the issue has an attachment titled `JSC-363 full lifecycle scope note`. The issue title and description still use Phase 1 wording, so Linear alignment is attachment-backed rather than field-text-current.
- Do not keep routing work as if PR #328, PR #329, or PR #330 were open stacked PRs unless a fresh GitHub query shows a reopened or new PR lane.

Outstanding goal work after conflict reconciliation:

- Do not proceed with implementation work until the owner explicitly reactivates the goal.
- Keep this goal board and the local board tracker synchronized before using either as route truth.
- Run the goal-board and audit-freshness validators after this route-truth refresh.
- Treat merged PRs as completed route/foundation evidence, not as final goal completion.
- Treat Linear `JSC-363` as tracker-aligned by current `Done` status plus the full-lifecycle scope-note attachment, with a residual field-text mismatch because the title and description still say Phase 1. Do not call Linear fields current unless those fields are updated.
- Continue implementation only from the remaining evidence-backed lifecycle gaps: runtime producer evidence, delivery-truth consumption, final review-state/external-state/root-hygiene proof, Judge/PM audit packet, historical review-coverage backfill, documentation accuracy, and final requirement-by-requirement completion audit.
- Treat the current-main Codex-native refinement addendum as next-slice intent scope. It is not completed implementation evidence until the named source modules, contracts, fixtures, validators, and receipts prove the new fields or record owner-visible blockers.
- Do not create a new duplicate goal board. Update this board, `state.yaml`, and `receipts.jsonl` as the canonical durable goal surface.

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
- `.harness/research/deep/2026-05-27-codex-system-prompt-operational-analysis.md`
- `goal-governor-output.yaml` records the imported current-main Codex-native refinement review from `/Users/jamiecraik/dev/codex` against this repository. The imported findings steer scope; they do not prove implementation.

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

| Stage | Units                                             | Completion Meaning                                                                                                                                                                                                                                                                                |
| ----- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L0    | steering admission                                | Human correction is captured as a repo artifact before normal implementation resumes.                                                                                                                                                                                                             |
| L1    | PU-000                                            | Intent, review receipt, baseline, and acceptance coverage exist before runtime implementation.                                                                                                                                                                                                    |
| L2    | PU-001 through PU-008                             | Fixture-backed verifier foundation exists, including receipts, Codex packet validation, adapter projection, private delivery-truth, root, redaction, and non-blending tests.                                                                                                                      |
| L3    | PU-009 through PU-011                             | Production review-state, external-state, delivery-truth, and root hygiene paths are wired.                                                                                                                                                                                                        |
| L4    | PU-012 through PU-013                             | Codex runtime producer bridge feeds validated runtime evidence into runtime cards and the cockpit.                                                                                                                                                                                                |
| L5    | PU-014 through PU-015                             | PR, CI, review, Linear, root tidiness, and Judge/PM audit readiness become claim-verifiable.                                                                                                                                                                                                      |
| L6    | PU-016 plus audit and operational review adoption | Documentation, architecture context, CI, validators, maintenance ownership, Project Brain memory use, Linear tracker alignment, the 2026-05-26 audit gap closure plan, the Codex ecosystem operational review adoption plan, and the Codex system-prompt operational gap matrix are synchronized. |

Each slice should be small enough for one clear branch, one PR, one primary module family, and one unambiguous validation story.

## Audit Gap Enforcement Addendum

The 2026-05-26 evidence-led audit is now part of this goal's completion contract. The goal may not be marked complete while any listed gap is merely described in research. Each gap must be implemented, explicitly blocked with owner-visible evidence, or moved to a tracked follow-up accepted by the Judge/PM audit.

| Audit Gap                                         | Required Goal Treatment                                                                                                                                                                          | Minimum Proof                                                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| GAP-001 Local Memory preflight downgrade          | P0 trust-boundary slice. Required preflight cannot silently skip Local Memory or Project Brain readiness.                                                                                        | Failing regression for old legacy downgrade plus passing required-mode preflight evidence.                                    |
| GAP-002 skipped or neutral CI credited as pass    | P0 closeout-verifier slice. Required CI conclusions other than success must block or become unknown unless an explicit exception exists.                                                         | Table-driven PR closeout/external-state tests for success, skipped, neutral, cancelled, missing, stale, and timed-out states. |
| GAP-003 public runtime packet schemas missing     | Public contract slice. Runtime-card, harness-decision, review-state, external-state, delivery-truth, decision-request, and session-context packets need schemas or documented blocked ownership. | Schema files, fixtures, and schema parity tests, or a tracked blocked decision.                                               |
| GAP-004 session and work stream traversal missing | Runtime maturity slice. Add a read-only session and work stream context command or explicitly block it with owner decision.                                                                      | CLI JSON contract, tests, and docs proving traversal without write authority.                                                 |
| GAP-005 structured decision requests partial      | Governance slice. Decision request intent, authority, human escalation, and stale-state handling must be machine-readable.                                                                       | Decision-request contract/tests or tracked follow-up accepted by Judge/PM.                                                    |
| GAP-006 policy-gate risk chain contradiction      | P0 safety slice. High-risk actions must fail closed where the contract says they block.                                                                                                          | Policy-gate tests and docs/contract sync proving no warn-only contradiction remains.                                          |
| GAP-007 architecture enforcement too local        | Mechanical enforcement slice. Critical architecture drift warnings need explicit error/warning ownership.                                                                                        | Focused architecture validator regression and refreshed architecture docs/context.                                            |
| GAP-008 stale context detection not routine       | Context-health slice. Project Brain, active artifacts, runtime cards, and memory freshness need routine stale-state classification.                                                              | `harness next` or agent-readiness metadata plus tests for stale/expired/missing context.                                      |
| GAP-009 reviewer artifact coverage not universal  | Closeout gate slice. Required reviewer artifacts must be verified by path, size, producer, head SHA, and expected role before closeout.                                                          | Reviewer-coverage tests and PR closeout/Judge audit blockers for missing or stale artifacts.                                  |
| GAP-010 browser evidence not routine              | Validation-hardening slice. Browser evidence requirements must be explicit when UI/browser surfaces change.                                                                                      | Browser smoke/visual evidence gate or documented non-applicability for non-UI slices.                                         |
| GAP-011 skill density overlap unchecked           | Skill-governance slice. Skill overlap and trigger density need a validator or accepted follow-up.                                                                                                | Skill-density check, fixtures, and docs, or tracked follow-up.                                                                |
| GAP-012 repeatable trace evidence not default     | Runtime trace slice. Runs should produce repeatable JSONL/session evidence or explicitly classify why not.                                                                                       | Trace/session output contract, tests, and closeout evidence linkage.                                                          |

Audit gap closure rules:

- P0 audit gaps are allowed to interrupt PU-016 documentation work because they reduce false-success, stale-state, unsafe-command, or missing-evidence risk.
- A gap is not closed by prose. It needs code, a validator, a schema, a receipt, a PR-truth update, or an accepted blocked decision.
- If a gap is deferred, the receipt must name the owner, follow-up artifact, risk accepted, and why it is safe to keep implementing later slices.
- If `.harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md` changes after the latest audit-adoption receipt, the next slice receipt must explicitly re-read it and either adopt, reject, or defer each new or changed gap before any done, Judge, PM, closeout, or merge-readiness claim.
- `scripts/check-goal-board.py docs/goals/codex-runtime-evidence-verifier-cockpit` must run the audit-freshness validator as a required extension for this goal so stale audit adoption is caught by the standard board gate, not only by a separately remembered command.
- The same board wrapper must fail if `.harness/active-artifacts.md` stops routing JSC-363 to this goal, plan, spec, and adopted audit. Project Brain is allowed to orient the next slice only when its active route points at the current cockpit, not stale JSC-331 context.
- Judge and PM tasks must review the audit gap matrix before any final completion claim.

## Codex Ecosystem Operational Review Addendum

The 2026-05-26 Codex ecosystem operational review is adopted as steering evidence for this goal. It does not authorize copying Codex internals into Coding Harness. It steers the implementation back toward a thin Harness verifier cockpit that ingests Codex-native runtime facts, binds them to identity, and blocks unsupported claims.

| Finding                                                                       | Required Goal Treatment                                                                                                                                                                         | Minimum Proof                                                                                                                            |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Codex runtime state is the new control plane                                  | Add or explicitly block `codex-runtime-state/v1` as an internal adapter output sourced from app-server, rollout trace, hook, SDK-shaped, or fixture packets.                                    | Adapter fixtures for direct, degraded, missing, blocked, and stale packets.                                                              |
| Identity is operational currency                                              | Promote `RuntimeIdentity/v1` or an equivalent identity spine across runtime cards, evidence bundles, verifier receipts, artifacts, PR/CI/Linear refs, and replay seeds.                         | Negative tests for missing, mismatched, unknown, and stale identity fields without blocking orientation-only use too broadly.            |
| Claim-vs-evidence must be canonical closeout                                  | Keep `ClaimIntent/v1` to required evidence to verifier receipt as the closeout model for done, merge-ready, review-addressed, root-tidy, goal-complete, and runtime-proof-valid claims.         | Fixture-backed verifier decisions that allow, downgrade, block, or return unknown with owner and next action.                            |
| Goal, permission, sandbox, approval, and environment parity are runtime truth | Project Codex goal status, permission profile, sandbox policy, approval reviewer, environment id, and runtime workspace roots into runtime-card summaries without storing secrets.              | Fixtures for paused, blocked, budget-limited, read-only, wrong environment, missing approval reviewer, and redacted env values.          |
| Queue semantics prevent stale steering                                        | Add or explicitly defer `SteeringQueue/v1` with `expectedTurnId`, `expectedHeadSha`, expiry, mode, and merge policy before autonomous continuation or delayed work depends on a prior turn.     | Replay fixtures for stale turn, stale branch head, superseded artifact, and expired queue items.                                         |
| Tool exposure planning is governance                                          | Add or explicitly defer a tool-exposure receipt that records visible, hidden, unavailable, deferred, and policy-blocked tool families for the run without becoming a second tool registry.      | Fixtures distinguish could not validate from did not validate and fail strong claims when required tool families were unavailable.       |
| Review is a runtime mode                                                      | Capture review-mode state, reviewer/subagent identity, active review threads, and review artifact lineage as runtime evidence before review-addressed or reviewer-covered claims pass.          | Review-state fixtures for stale review mode, missing reviewer identity, stale comments, unresolved active threads, and stale artifacts.  |
| Artifacts are runtime surfaces                                                | Treat implementation notes, review artifacts, screenshots, CSV/PDF/doc outputs, and runtime cards as artifact state that can be inspected, with lifecycle, lineage, preview, and verifier refs. | Artifact runtime fixtures for missing path, stale front matter, broken preview, unsupported claim, and mismatched lineage.               |
| Rollout search makes memory operational                                       | Treat rollout/session search and Project Brain recall as orientation evidence unless receipts bind the retrieved memory to current repo, branch, head SHA, and slice intent.                    | Memory/retrieval fixtures for stale rollout evidence, missing provenance, and orientation-only recall being rejected as claim support.   |
| Recovery is a first-class runtime class                                       | Classify auth recovery, blocked runtime, missing capability, stale state, degraded observability, retry exhaustion, and human-approval stops as verifier inputs rather than prose status.       | Recovery-class fixtures prove `blocked_runtime` and degraded evidence block strong closeout while still preserving audit trail value.    |
| Schema generation is anti-drift infrastructure                                | Keep public packet schemas, TypeScript contracts, fixtures, and docs synchronized for adopted runtime-state, identity, receipt, review, external-state, and delivery-truth packets.             | Schema parity tests fail when docs, fixtures, exported types, or validators drift.                                                       |
| Repeatable telemetry is the learning loop                                     | Convert repeated steering, blocked runtime, auth recovery, stale PR head, review churn, and degraded observability into replay seeds or blocked decisions.                                      | Evidence-pattern or replay-seed validation that names source event, target validator, and adoption status.                               |
| Hooks make agent work attributable                                            | Require subagent/reviewer work to bind role, subagent id/type when available, artifact path, head SHA, and producer.                                                                            | Reviewer artifact receipts fail closed when producer, role, size, head SHA, or expected artifact path is missing.                        |
| Instruction provenance is runtime safety                                      | Bind AGENTS, skill, plan, spec, Project Brain, and Linear tracker surfaces read for a slice to the runtime/evidence receipt so hidden instruction drift cannot silently support closeout.       | Instruction-provenance fixtures fail when required source surfaces are missing, stale, conflicting, or only conversationally remembered. |
| Packaged runtime is a distribution contract                                   | Preserve Codex launcher/source/package provenance when runtime evidence comes from CLI, app, SDK launcher, packaged binary, or fixture source, and downgrade unknown producers.                 | Runtime-provenance fixtures for unknown launcher source, package mismatch, fixture-only evidence, and unsupported producer fields.       |

Adoption rules:

- The ecosystem review is advisory until this section and `state.yaml` adopt specific findings; after adoption, the listed findings are goal steering constraints.
- Harness must not become a competing Codex app-server, goal store, scheduler, tool registry, or thread engine.
- Runtime cards remain cockpit summaries and pointers, not warehouses for raw prompts, raw telemetry, review bodies, secrets, or bulky artifacts.
- Linear `JSC-363` remains the tracker anchor for this goal. Current live Linear evidence records the issue as `Done` with a full-lifecycle scope-note attachment, while the title and description still say Phase 1. Future closeout may claim attachment-backed tracker alignment, but not field-text-current Linear alignment unless those fields are updated.
- Every future Worker/Judge/PM receipt should include `ecosystem_review_findings` when a slice touches runtime identity, runtime state, claim verification, queueing, tool exposure, review mode, artifacts, memory/retrieval, recovery, schemas, telemetry, hooks, instruction provenance, runtime provenance, or Codex parity.

## Codex-Native Current-Main Refinement Addendum

A 2026-06-03/2026-06-04 Codex-native review was produced from
`/Users/jamiecraik/dev/codex` against `/Users/jamiecraik/dev/coding-harness`
and imported into `goal-governor-output.yaml`. The review found that current
`main` already contains broad verifier primitives, including runtime cards,
runtime evidence contracts, stale-state detection, review-state separation,
external-state claim support, steering queues, verifier ownership, and
decision-request HILT boundaries. The missing work is narrower and more
Codex-native: identity correlation, environment-scoped permission evidence,
risk-tiered mutation authority, richer runtime-card continuity, context
authority classification, and queue application receipts.

Current-main verification at `50a6d0b5d764e35395e12190a465e854c26784fd`
supports the refinement as pending scope, not as proof of implementation:

| Refinement | Current-main evidence | Required Goal Treatment | Minimum Proof |
| --- | --- | --- | --- |
| Codex user-message correlation | PU-047/CNF-001 local slice adds `clientUserMessageId` as an explicit nullable runtime identity field and adds steering-queue expected/applied client-message correlation, stale-precondition classification, schema/example updates, and validator/test coverage. The reviewed source-capability artifact classifies live Codex Desktop extraction as unproven and forbids synthesizing the field from turn IDs, trace IDs, timestamps, PR data, or artifact paths. | Preserve the nullable producer-input contract, keep missing source evidence as `null`, reject stale or mismatched applied steering items, and keep runtime-card/closeout use orientation-only until a later slice proves live producer extraction and delivery-truth consumption. | Implemented locally in `src/lib/runtime/**`, `src/lib/steering-queue/**`, `contracts/steering-queue.schema.json`, `contracts/examples/steering-queue.example.json`, `scripts/validate-steering-queue.cjs`, and focused tests. Remaining proof requires post-implementation reviewer artifacts, goal receipts, and any future live producer extraction evidence before parent-goal closeout. |
| Environment-scoped permission evidence | PU-048/CNF-002 local slice adds `CodexRuntimeEnvironmentSnapshot` to `codex-runtime-evidence/v1`, validates stale cwd, approval-scope mismatch, missing sandbox-policy refs, missing receipt-backed sandbox refs, and current environment claims without explicit scope evidence, and projects environment refs into the compact runtime-card Codex surface. `src/lib/tool-exposure/types.ts` remains the separate exposure-summary module and is not duplicated. | Preserve explicit producer-input semantics: environment fields are nullable/unknown unless source evidence provides them, known permission claims require a sandbox-policy ref, and runtime-card projection remains pointer-only. | Implemented locally in `src/lib/runtime/**`, `src/commands/runtime-card.test.ts`, and focused runtime tests. Skill-lens evidence is recorded locally; required independent reviewer artifacts are blocked by reviewer-role artifact output failure and must be recovered before a done claim. Remaining proof also requires docs/architecture validation, commit/PR handoff, and any future live Codex Desktop producer evidence before parent-goal closeout. |
| Risk-tiered agent-native mutation authority | `src/lib/decision/route-decision.ts` still enforces that every mutating route must set `requiresHuman`; `src/lib/decision-request/types.ts` already has high/critical HILT boundary categories for destructive actions, external mutation, credentials, security, public contracts, release, permission escalation, stale claim support, merge readiness, tracker authority, and goal completion. | Replace the blanket mutating-route HILT rule with a risk-tiered policy: low-risk repo-local mutations may be agent-executable when current evidence and validator ownership are present; destructive, external, tracker, production, release, security, credential, merge, ambiguous governance, verifier-disagreement, and goal-completion paths still require HILT. | Route-decision policy tests and docs proving high-risk mutation without HILT fails, low-risk repo-local mutation can pass under evidence-backed constraints, and decision-request boundaries remain the escalation contract. |
| Runtime-card Codex continuity projection | `RuntimeCardCodexRuntimeProjection` currently projects summary refs and counts plus optional tool exposure; it does not directly project thread, turn, trace, goal, environment, client message, active queue item, approval request, or heartbeat/automation refs. | Expand the runtime-card Codex projection with compact continuity fields where available while keeping packets pointer-only and redacted. | Runtime-card schema/projection/validation tests proving the continuity fields appear when evidence exists and no raw prompts, transcripts, secrets, or bulky telemetry leak. |
| Prompt/context authority classification | Existing prompt-context, steering, and Project Brain surfaces classify freshness and route evidence, but no current-main source match was found for a canonical authority taxonomy covering `system_policy`, `developer_policy`, `repo_instruction`, `trusted_skill`, `plugin_metadata`, `artifact_data`, `review_feedback`, `telemetry`, `user_steering`, and `untrusted_external`. | Classify context authority before a source may steer agent behavior or support a closeout claim. | Validator and fixtures that reject untrusted external, telemetry, artifact data, or review feedback when presented as instruction authority without an allowed promotion path. |
| Steering queue application receipts | `SteeringQueueItem` records application and rejection timestamps, but there is no distinct current-main packet or receipt that binds queue item application to Codex message/turn identity and the resulting runtime-card update. | Add a steering application receipt or equivalent packet that connects queue item, expected/current turn or message identity, runtime-card update, and stale-precondition result. | Positive and negative fixtures for expected/current mismatch, expired steering, superseded items, missing runtime-card ref, and applied receipt head mismatch. |

Refinement adoption rules:

- These findings may re-scope the next implementation slice, but they do not
  authorize weakening existing PU, GAP, SPG, review, validation, or closeout
  requirements.
- The next activated slice must classify each refinement as implemented,
  blocked, not applicable, or accepted follow-up before claiming done.
- Any implemented refinement must update the relevant deep-module docs,
  architecture context, fixtures, validators, and receipt fields in the same
  slice when repo policy requires synchronization.
- Harness remains a verifier cockpit. It must ingest and verify Codex-native
  facts; it must not become a second Codex app server, scheduler, tool
  registry, prompt composer, or thread engine.

## Codex System Prompt Operational Analysis Addendum

The 2026-05-27 Codex system-prompt operational analysis is adopted as a goal gap source. It is advisory research until adopted here; after adoption, the listed findings are execution constraints for future Worker, Judge, and PM receipts. The goal must extract durable invariants from the analysis, not copy Codex prompt text, private runtime instructions, secrets, or app-server internals into Coding Harness.

Use these gaps to keep the implementation aligned with the mantra: small deep modules, intent as an artifact, intent review before implementation, and automation where the behavior can be made deterministic.

| Gap                                                             | Required Goal Treatment                                                                                                                                                                                                  | Minimum Proof                                                                                                                                     |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| SPG-001 PromptContextReceipt/v1 missing                         | Add prompt-layer provenance as a receipt that records instruction/source refs, hashes, selected capability surfaces, permission posture, goal context, and redaction status without storing full prompt text by default. | Schema/types, fixtures for current/missing/stale/conflicting source refs, and a validator that rejects claim support from unbound prompt context. |
| SPG-002 durable runtime-card handoff incomplete                 | Persist a durable runtime-card and paired evidence bundle path for issue/branch handoff, including expiry, freshness, head SHA, and source references.                                                                   | Runtime-card fixture or command evidence proving a future session can discover the current handoff path and classify stale/missing cards.         |
| SPG-003 GoalCompletionAuditReceipt/v1 missing                   | Add a final audit receipt that compares objective, requirement matrix, evidence refs, blockers, and verdict before goal-ready or done claims.                                                                            | Fixtures for complete, partial, stale, one-turn blocker, and repeated-blocker cases.                                                              |
| SPG-004 SteeringQueue/v1 missing                                | Model queued steering, delayed continuation, expected turn/head/artifact ids, expiry, stale-precondition checks, and applied/rejected state before autonomous continuation relies on prior human steering.               | Queue fixtures for stale turn, stale head, superseded artifact, expired queue, rejected steering, and applied steering.                           |
| SPG-005 permission and tool exposure projection incomplete      | Project sandbox, approval policy, network posture, tool exposure counts/classes, key tool names, deferred availability, hidden capability classes, and blocked permission attempts into runtime-card evidence.           | Runtime-card and verifier fixtures distinguishing tool unavailable, permission blocked, not attempted, and claim failed.                          |
| SPG-006 decision-request/v1 not limited to real HILT boundaries | Emit structured decision requests only for human-in-the-loop authority boundaries, not routine uncertainty; bind requests to stale-state and claim-support checks.                                                       | Tests proving routine uncertainty does not create decision debt, while destructive/external/security-sensitive boundaries do.                     |
| SPG-007 ReviewLifecycle/v1 missing                              | Compose review-state into a lifecycle packet with target/base/head, mode, role/tool exposure, artifact lineage, findings, selectable comments, unresolved threads, coverage, and verdict.                                | Review lifecycle fixtures for stale review mode, unresolved active threads, missing artifact lineage, and current covered review.                 |
| SPG-008 ActionReviewReceipt/v1 missing                          | Add guardian-style action review receipts for merge, release, destructive cleanup, and external tracker mutation with exact action envelope and allow/block/mismatch verdict.                                            | Allow/block/mismatch fixtures and policy-gate or delivery-truth integration evidence.                                                             |
| SPG-009 ArtifactRuntimeSurface/v1 missing                       | Treat implementation notes, review artifacts, screenshots, CSV/PDF/doc outputs, runtime cards, and reports as runtime surfaces only when they steer execution or claims.                                                 | Artifact fixtures for missing path, stale front matter, broken preview, unsupported claim, mismatched lineage, and reviewable current artifact.   |
| SPG-010 ReplayPacket/v1 and hook provenance missing             | Emit minimal replay packets for runtime identity, prompt receipt id, runtime-card id, tool events, hook events, queue decisions, validator outputs, and final claims without secrets or full transcripts.                | JSONL schema/fixtures plus replay-seed validation for hook rewrites, blocked runtime, stale PR head, and repeated steering.                       |
| SPG-011 prompt/context drift validator missing                  | Add drift detection across prompt/source refs, goal board, Project Brain, active artifacts, runtime-card evidence, and receipt head SHA where those sources support claims.                                              | Validator fails on stale prompt context, stale active route, mismatched head SHA, and missing source hash.                                        |
| SPG-012 real-time and intermediary receipt coverage incomplete  | Classify real-time/intermediary messages as orientation unless bound by receipt, source freshness, and claim-support eligibility. This may be deferred if no current slice depends on real-time evidence.                | Explicit implementation, blocked decision, or accepted P3 follow-up with owner and risk note.                                                     |

## PU-037 Intent Correction Gate

PU-037 / SPG-011 cannot proceed to a done claim from the first intent draft. The
pre-implementation adversarial and agent-native reviews found material intent
gaps, so the active slice must repair the intent before implementation is
accepted as scoped evidence.

Required PU-037 intent repairs:

1. Add deterministic negative fixtures for stale, missing, and missing-hash Project
   Brain refs.
2. Add deterministic negative fixtures for runtime-card evidence that is
   advisory-only, stale, head-mismatched, or missing hash evidence.
3. Require at least one repo-contained, hash-verified ref for each required
   local surface; external or unverifiable refs cannot satisfy required local
   surface coverage.
4. Require canonicalized realpath-under-repo containment before digest checks,
   with symlink-escape and path-alias negative fixtures.
5. Pin the agent-readable enum fields, including `overallStatus`, per-surface
   status, `blockerClass`, and `nextAction`.
6. Name the agent consumption boundary for the validator result, such as a
   runtime-card projection, `harness next --json` advisory projection, or
   receipt bridge. The boundary may be advisory in this slice, but it must be
   explicit and machine-readable.

PU-037 implementation files already present in a worktree do not prove the
slice is ready. Before PU-037 can be marked locally validated, done, PR-ready,
or Judge/PM-ready, the amended intent must be re-reviewed by
`@adversarial-reviewer` and `@agent-native-reviewer`, their artifacts must be
non-empty, and valid findings must be patched or recorded with owner-visible
blocker evidence.

System-prompt gap closure rules:

- A system-prompt gap is not closed by prose. It needs a schema, validator, receipt, fixture-backed implementation, runtime-card projection, delivery-truth integration, or accepted blocked/follow-up decision.
- Future receipts must include `system_prompt_gap_ids` when a slice touches prompt provenance, runtime cards, goal completion, steering, permissions, tools, review lifecycle, action review, artifact surfaces, replay, hook provenance, context drift, or intermediary messages.
- The Judge/PM audit must reconcile SPG-001 through SPG-012 before any full-lifecycle completion claim.
- Prompt context, Project Brain recall, browser/intermediary state, and compaction history are orientation-only unless a current receipt binds them to repo, branch, head SHA, source refs, freshness, and slice intent.
- Harness must remain the verifier cockpit. It must not become a second Codex prompt composer, app-server, scheduler, tool registry, or thread engine.

## Project Brain Memory Contract

Project Brain and repo-local memory are required operating surfaces for this goal, not optional background context.

Before each new slice or PR closeout pass:

1. Read the current goal board and `.harness/active-artifacts.md`.
2. Check `.harness/memory/LEARNINGS.md` and relevant `.harness/knowledge/**` domain pages for prior rules, blockers, or repeated-failure patterns.
3. Check `.harness/research/evidence-patterns.json` before adopting research-derived guidance.
4. Use the repo-owned Project Brain CLI path when the slice depends on indexed knowledge, and record the exact command or blocker in the receipt.
5. Promote any repeated steering, audit correction, or newly discovered invariant into Project Brain memory, `.harness/knowledge/**`, a validator, or a tracked explicit skip reason before marking the slice done.
6. Apply the tool promotion threshold before closing the slice: if the same judgment is needed twice, or the failure mode can recur across slices, promote it into the smallest durable primitive that changes future behavior. Keep one-off implementation knowledge in implementation notes, plan evidence, or PR closeout evidence; choose validators or guards for deterministic rules, CLI helpers for repeatable operator commands, and skills only for reusable routed workflows with explicit inputs, artifacts, validation, ownership, and review expectations.
7. For PR handoff and CI triage inside this goal, use safe PR body file handoff and CircleCI env-backed API triage: PR bodies with Markdown or command snippets must go through a validated `--body-file`, and CircleCI API/log evidence must load `~/.codex/.env` with bounded calls before the lane is called unavailable.

Project Brain memory is claim support only when it is current, repo-local, and referenced by a receipt. Stale or unavailable memory can orient work, but it cannot support closeout, merge readiness, or Judge/PM-ready claims.

## Slice Execution Contract

For every slice:

1. Refresh repo orientation: nearest `AGENTS.md`, `CODESTYLE.md`, plan, spec, current branch, and dirty worktree.
2. Refresh Project Brain memory: `.harness/active-artifacts.md`, `.harness/memory/LEARNINGS.md`, relevant `.harness/knowledge/**`, and adopted research patterns. Record the command or blocker in the slice receipt.
3. Create or update the slice intent artifact before implementation. It must include objective, allowed files, forbidden files, assumptions, stop conditions, validation gates, reviewer roles, PR strategy, Project Brain memory inputs, audit-gap mapping, and rollback path.
4. Review the intent before implementation. Do not write runtime code until the intent review is recorded.
   If intent review finds material gaps after code exists in the worktree, stop the
   done path, patch the intent, rerun the required intent reviews, and reconcile
   the code to the amended intent before claiming validation.
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

- `$improve-codebase-architecture`: confirm the slice stays inside the intended deep module boundary, preserves a narrow public seam, and records any architecture tradeoff in the intent or receipt.
- `$simplify`: confirm the slice did not add unnecessary abstractions, duplicate truth layers, or broad public surfaces.
- `$unslopify`: remove vague claims, placeholder wording, speculative assertions, and AI-shaped docs or PR text.
- `$he-code-review`: review the slice against Harness Engineering expectations, evidence contracts, and implementation-risk boundaries.
- `$testing`: prove the touched behavior with the narrowest meaningful tests first, then broaden according to risk.

Before marking any slice done, also run independent review with:

- `@adversarial-reviewer`
- `@agent-native-reviewer`
- `@best-practices-researcher`

Reviewer outputs must be artifact-first when a swarm is requested. Verify expected review artifacts exist and are non-empty before synthesis. Mailbox status is not enough.

`@best-practices-researcher` is required to check implementation approach, validation method, and operational pattern against current local/retrieved evidence when the slice introduces or changes a contract, validator, runtime packet, closeout rule, architecture boundary, or workflow automation. If the role is unavailable or no external/current evidence is needed for a pure local fixture/doc repair, record an explicit `blocked` or `not applicable` receipt with the reason.

Every validation report must classify results as exactly one of:

- `pass`
- `fail`
- `blocked`
- `not applicable`

Historical coverage rule:

- R064 starts the enforced per-slice skill-lens and reviewer contract for future slices.
- Pre-R064 receipts remain historical evidence, but they cannot by themselves prove the full lens/reviewer contract now required for lifecycle closeout.
- Before Judge/PM closeout, produce a historical backfill or ratification ledger for PU-001 through PU-016. Each unit must map every required skill lens and independent reviewer to `pass`, `blocked`, or `not applicable` with an evidence ref or accepted exception.
- A receipt or backfill row is incomplete if it includes only the top-level `slice_skill_lens_results` or `independent_reviewer_results` object but omits any required lens or reviewer key.
- A `pass` member is unsupported unless it carries a resolvable, current evidence reference to the relevant artifact, command result, receipt, or review report. `blocked`, `fail`, and `not applicable` members must carry a reason and owner or accepted-exception reference.
- Any required member marked `fail` blocks the slice done claim and final closeout until fixed or reclassified with accepted owner evidence.

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
- SPG-001 through SPG-012 from `.harness/research/deep/2026-05-27-codex-system-prompt-operational-analysis.md` are implemented, explicitly blocked, or tracked as accepted follow-ups by the Judge/PM audit.
- The Codex-native current-main refinement addendum items are implemented, explicitly blocked with owner-visible evidence, marked not applicable with rationale, or accepted as follow-ups by Judge/PM before final goal completion.
- `PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-goal-audit-freshness.py docs/goals/codex-runtime-evidence-verifier-cockpit --repo .` proves the latest relevant receipt acknowledges the current `.harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md` content hash after the audit file timestamp; otherwise audit-gap closeout is stale and blocked.
- `PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-goal-board.py docs/goals/codex-runtime-evidence-verifier-cockpit` also passes, proving the normal goal-board path executes audit-freshness and active-artifacts route enforcement for this goal.
- Each implemented slice has an intent artifact, validation evidence, review evidence, commit, PR truth, and receipt.
- Final closeout includes the historical review-coverage backfill or ratification ledger required by the Review and Validation Contract.
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
- continuing another slice would contaminate a PR under triage

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
5. Read the implementation plan, associated spec, the 2026-05-26 evidence-led gap audit, the 2026-05-26 ecosystem operational review, and the 2026-05-27 system-prompt operational analysis.
6. Refresh Project Brain memory inputs: `.harness/active-artifacts.md`, `.harness/memory/LEARNINGS.md`, relevant `.harness/knowledge/**`, and `.harness/research/evidence-patterns.json`.
7. Confirm whether the activation phrase is present.
8. If not activated, stop after readiness reporting.
9. If activated, begin with the active Scout task in `state.yaml`, then create/review the first slice intent artifact before implementation.
