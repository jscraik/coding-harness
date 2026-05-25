---
schema_version: 1
artifact_id: codex-runtime-evidence-verifier-cockpit-he-plan
artifact_type: he-plan
canonical_slug: codex-runtime-evidence-verifier-cockpit
title: Codex Runtime Evidence Verifier Cockpit Full Lifecycle Plan
harness_stage: he-plan
status: proposed_full_lifecycle
date: 2026-05-24
traceability_required: true
origin: .harness/specs/2026-05-24-codex-runtime-evidence-verifier-cockpit-spec.md
linear_issue: JSC-363
linear_issue_url: https://linear.app/jscraik/issue/JSC-363/coding-harness-implement-codex-runtime-evidence-verifier-cockpit-phase
linear_parent: JSC-328
linear_project: Harness cockpit routing
linear_status: Triage
linear_mutation_status: approved_small_set_created
linear_action_required: true
linear_action_required_reason: "Linear issue JSC-363 exists for the initial implementation lane; update Linear before claiming full lifecycle delivery."
cross_repo_context: /Users/jamiecraik/dev/codex
safe_to_continue: true
blocked_reason: null
lifecycle_scope: full_implementation
planning_only_delivery_allowed: false
---

# Codex Runtime Evidence Verifier Cockpit Full Lifecycle Plan

## Table of Contents

- [Command Summary](#command-summary)
- [Steering Admission](#steering-admission)
- [Objective](#objective)
- [Source Contract](#source-contract)
- [Full Lifecycle Contract](#full-lifecycle-contract)
- [Scope and Boundaries](#scope-and-boundaries)
- [Authority and Scope Boundary](#authority-and-scope-boundary)
- [Current State / Evidence](#current-state--evidence)
- [Implementation Strategy](#implementation-strategy)
- [Runtime Persistence and State](#runtime-persistence-and-state)
- [Enforcement Contract](#enforcement-contract)
- [Work Units](#work-units)
- [Dependencies and Sequencing](#dependencies-and-sequencing)
- [Validation Gates](#validation-gates)
- [Coding and Testing Lenses](#coding-and-testing-lenses)
- [Review Plan](#review-plan)
- [Rollback Plan](#rollback-plan)
- [Risk Register](#risk-register)
- [Observability and Evidence](#observability-and-evidence)
- [Visual References / Diagrams](#visual-references--diagrams)
- [Accessibility and Operator Ergonomics](#accessibility-and-operator-ergonomics)
- [Open Questions](#open-questions)
- [Final Decision](#final-decision)
- [Appendix A. Harness Metadata / Traceability](#appendix-a-harness-metadata--traceability)
- [Appendix B. Linear / Tracker Handoff](#appendix-b-linear--tracker-handoff)
- [Appendix C. Review Outcomes](#appendix-c-review-outcomes)

## Command Summary

BLUF: This plan now covers the full implementation lifecycle for the Codex Runtime Evidence Verifier Cockpit, from current-session steering admission through implementation intent, private verifier foundations, production review/external-state/delivery-truth wiring, Codex runtime evidence production, PR/CI/Linear closeout, and Judge/PM audit readiness. It matters because a planning-only or Phase 1-only artifact can otherwise be mistaken for the full fix the user requested. The execution boundary remains narrow at the unit level: make intent a first-class artifact, review that intent before implementation, scope every task to one deep module family, and automate every mechanically checkable acceptance criterion before any done claim. The main risk is false delivery: claiming implementation, green status, ROOT tidiness, merge readiness, or goal completion from plan/spec text, stale snapshots, or local validation alone. The next action is to record the steering admission, run PU-000, then implement the lifecycle units in order until delivery-truth, review-state, external-state, Codex producer, and Judge/PM audit gates have current evidence.

Decision Needed: Treat this as the full lifecycle execution contract. Route implementation through PU-000 through PU-016, with separate PR slices allowed only when each PR truthfully names the lifecycle stage it completes.

Top Risks: presenting Phase 1 as the full implementation; treating Codex SDK event fields as full permission truth; mixing orientation evidence with claim-support evidence; allowing closeout language to imply green, tidy, delivered, merged, or ready without current verdict proof; and letting manual review substitute for validators where deterministic proof is feasible.

Next Action: Create the steering admission implementation note, update Linear/JSC-363 if ownership or scope changes, then start PU-000 to create the reviewed intent artifact and acceptance-coverage guard before any runtime implementation file changes.

## Steering Admission

Feedback signal: The user clarified that a Phase 1-only plan or PR does not satisfy the specified and implied intent of this conversation. The requested outcome is the full implementation and fix lifecycle for the Codex runtime evidence verifier cockpit, including durable enforcement against repeated false-success and stale-state steering.

Root operational failure: The planning workflow allowed a reviewed HE plan to become a candidate delivery artifact while the artifact still encoded Phase 1 as the execution horizon. That made lifecycle authority ambiguous and left a path where a PR could truthfully pass plan checks while still failing the user's intended full implementation outcome.

Failure categories:

- unclear authority boundaries
- poor workflow design
- missing guardrails
- insufficient deterministic enforcement
- lack of verification
- stale-state and false-success risk

Durable system improvement:

- This plan is converted from a Phase 1 fixture plan into a full lifecycle implementation plan.
- Phase 1 remains a bounded implementation stage, but it is no longer the completion boundary.
- A PR delivery invariant is added: planning/spec/research artifacts can support implementation, but cannot be presented as full implementation or fix delivery unless the corresponding lifecycle implementation units have completed and their validation evidence is current.
- Lifecycle stages now extend through production delivery-truth, review-state, external-state, Codex producer integration, PR/CI/Linear closeout, and Judge/PM audit readiness.
- The steering admission is documented in .harness/implementation-notes/2026-05-24-runtime-evidence-full-lifecycle-steering-admission.md and in Appendix C of this plan.

## Objective

Implement the full Coding Harness lifecycle from the approved runtime evidence verifier cockpit spec.

The objective is to deliver the complete verifier cockpit capability in bounded, reviewable stages. The first stage creates a local, fixture-backed verifier foundation that lets Coding Harness ingest Codex-shaped runtime evidence, project compact runtime-card summaries, and refuse unsupported delivery claims through private delivery-truth tests. Later stages must promote those semantics into production review-state, external-state, delivery-truth, root-surface, Codex runtime producer, PR closeout, and Judge/PM audit workflows before this plan can be called implemented.

Completion is not defined by plan/spec approval, a passing Markdown validator, a local runtime-card sample, or a Phase 1 PR. Completion requires lifecycle evidence that the production claim verifier can block unsupported claims, refresh external state, separate review truth from CI/local validation/tracker state, ingest Codex runtime evidence, and produce audit-ready receipts.

## Source Contract

Primary source:

- .harness/specs/2026-05-24-codex-runtime-evidence-verifier-cockpit-spec.md

Cross-repo source evidence:

- /Users/jamiecraik/dev/codex/sdk/typescript/src/thread.ts
- /Users/jamiecraik/dev/codex/sdk/typescript/src/events.ts
- /Users/jamiecraik/dev/codex/sdk/python/src/openai_codex/_run.py
- /Users/jamiecraik/dev/codex/sdk/python/src/openai_codex/_message_router.py
- /Users/jamiecraik/dev/codex/codex-rs/app-server-protocol/src/protocol/common.rs
- /Users/jamiecraik/dev/codex/codex-rs/app-server-protocol/src/jsonrpc_lite.rs
- /Users/jamiecraik/dev/codex/codex-rs/analytics/src/reducer.rs

Selected implementation source IDs:

| Source ID | Plan Unit | Evidence Target |
| --- | --- | --- |
| FR-011 / SA-017 | PU-000 | reviewed intent artifact exists before implementation |
| FR-012 / SA-018 | PU-000 | mechanically checkable SA IDs map to tests, fixtures, commands, or schema assertions |
| FR-001 / SA-001 | PU-001 | evidence-receipt/v1 validates positive and negative fixtures |
| FR-002 / SA-002 | PU-002 | codex-runtime-evidence/v1 validates SDK-only, app-server-shaped, and analytics-derived fixtures |
| FR-003 / SA-003 | PU-002 | unsupported source fields become unknown with failureClass |
| FR-004 / SA-004 | PU-003 | Codex packet maps into runtime-evidence-bundle/v1 with provenance preserved |
| FR-005 / SA-005 | PU-004 | runtime-card/v1 projects compact Codex runtime summaries and receipt refs |
| FR-006 / SA-006 | PU-005 | stale, missing, unknown, or orientation-only evidence cannot pass delivery-truth claims |
| FR-007 / SA-007 | PU-005 | delivery-truth private fixtures represent separate root_surface_tidy, goal_ready_for_judge_pm, and merge_ready claims |
| FR-007 / SA-011 | PU-005 | delivery-truth composes existing runtime-evidence-contract/v1 and pr-closeout/v1 semantics |
| FR-007 / SA-015 | PU-005 | merge_ready cannot compose claim-support receipts from different head SHAs |
| FR-007 / SA-016 | PU-005 | verifier freshness policy overrides producer TTL |
| FR-008 / SA-008 | PU-008 | foundation non-blending fixture proves review-state and external-state refs stay separate |
| FR-010 / SA-010 | PU-008 | closeout text downgrades or blocks unsupported green, tidy, delivered, or ready claims |
| SA-012 | PU-006 | root tidy fixture cites docs/architecture/root-surface-classification.md |
| SA-013 | PU-007 | operator-facing outputs include textual status labels |
| SA-014 | PU-007 | sensitive values and bulky raw telemetry are blocked or redacted |

Lifecycle stage allocation:

| Stage | Work Units | Lifecycle Meaning | Completion Boundary |
| --- | --- | --- | --- |
| L0 Steering admission | Current-session admission | Human correction becomes repo evidence before normal implementation resumes. | Implementation note exists and this plan encodes the corrected lifecycle. |
| L1 Intent and contract control | PU-000 | Intent, review receipt, baseline, and acceptance coverage become enforceable. | No runtime implementation can be accepted without the reviewed intent artifact and frozen baseline. |
| L2 Verifier foundation | PU-001 through PU-008 | Evidence receipts, Codex packet validation, adapter projection, private delivery-truth, root, redaction, and non-blending fixtures. | Foundation tests pass; no public closeout authority is claimed. |
| L3 Production verifier surfaces | PU-009 through PU-011 | review-state/v1, external-state-snapshot/v1, delivery-truth/v1, root hygiene receipt, and closeout downgrade semantics are production code paths. | Local and PR closeout paths produce separated verdicts with current evidence refs. |
| L4 Codex producer bridge | PU-012 through PU-013 | Codex runtime evidence is generated or exported through an approved bridge and projected into runtime-card/harness next. | Codex evidence packets are produced without scraping final prose and are validated by Harness. |
| L5 Delivery closeout | PU-014 through PU-015 | PR, CI, review threads, Linear, root tidiness, and Judge/PM audit readiness become claim-verifiable. | Goal remains open until Judge/PM audit or an explicit blocked status with evidence. |
| L6 Hardening and maintenance | PU-016 | Docs, architecture context, CI, validators, and maintenance ownership are synchronized. | Broader repo gates and reviewer artifacts support ongoing operation. |

Contract freeze after review:

- The Source Contract, selected source IDs, Scope and Boundaries, Enforcement Contract, Work Units, Validation Gates, Rollback Plan, Risk Register, and Open Questions are implementation contract surfaces after this review swarm closes.
- Implementation PRs MUST NOT weaken or rewrite acceptance IDs, phase labels, forbidden paths, stop conditions, validation gates, or rollback obligations to match already-written code.
- Any needed contract change must be proposed as a separate plan/spec revision with an explicit contract-change note, reviewer receipt, and Linear comment before implementation continues.
- Appendix C may be appended with review outcomes and coordinator synthesis, but it must not silently change the execution contract above.

## Full Lifecycle Contract

This plan has one lifecycle and multiple bounded PR slices. A slice may complete a stage, but it cannot rename that stage as the whole implementation.

PR delivery invariant:

- A planning, research, or specification PR may claim planning readiness only.
- A foundation PR may claim L1 or L2 completion only when PU-000 through the claimed unit pass their required validation gates.
- A production verifier PR may claim implementation progress only for the production surfaces it actually wires and validates.
- A closeout PR may claim green, tidy, delivered, merged, Judge/PM-ready, or goal-ready only when delivery-truth can cite current claim-support evidence for each separate claim.
- No PR may blend local validation, remote CI, review threads, tracker state, root hygiene, and merge readiness into one success claim.
- No plan/spec approval, reviewer mailbox text, or stale external snapshot can substitute for a current evidence receipt.

Lifecycle claim boundaries:

| Claim | Minimum Evidence Required | Invalid Evidence |
| --- | --- | --- |
| implementation_started | PU-000 intent artifact, reviewReceiptRef, baselineRef, Linear owner | conversational instruction alone |
| foundation_complete | PU-001 through PU-008 tests and fixture outputs | Markdown/doc validation alone |
| production_verifier_complete | PU-009 through PU-011 code paths, public/private command or closeout integration tests, non-blending fixtures | private fixtures only |
| codex_bridge_complete | PU-012 through PU-013 producer/export evidence, Codex provenance, runtime-card/harness next projection | scraped final response text |
| closeout_ready | PU-014 current PR/CI/review/Linear/root snapshots with TTL and head SHA | local validation or old PR status alone |
| judge_pm_audit_ready | PU-015 audit packet, reviewer artifacts, and explicit unresolved-risk classification | self-review or missing artifact paths |
| goal_complete | Judge/PM audit or explicit authorized completion evidence | agent assertion or PR creation alone |

Issue authority map:

| Issue | Authority In This Plan | Closeout Rule |
| --- | --- | --- |
| JSC-363 | Owns the Codex runtime evidence verifier cockpit lifecycle unless PU-000 expands or splits tracker ownership. | May only be closed when the lifecycle stage claimed in Linear has matching delivery-truth and validation evidence. |
| JSC-328 | Parent/project context for the cockpit routing work. | Not closed by this plan. |
| JSC-331 | External trust-boundary goal referenced only as a non-completion guard from prior steering. | Cannot be closed by this plan unless a later authorized audit packet explicitly maps JSC-331 claims to current Judge/PM evidence. |

Claim-to-command discoverability contract:

| Claim Family | Agent-Discoverable Surface | Required JSON / Receipt Evidence | Failure Class |
| --- | --- | --- | --- |
| implementation_started | PU-000 intent validator or future harness intent-check helper | intentId, reviewReceiptRef, baselineRef, linearIssue, reviewedAt | missing_reviewed_intent |
| foundation_complete | unit-specific vitest results and runtime-card sample refs | validation receipts for PU-001 through claimed unit | incomplete_foundation_evidence |
| production_verifier_complete | pr-closeout or delivery-truth verifier integration | deliveryTruth.claims[], reviewStateRef, externalStateRef | missing_production_verifier |
| codex_bridge_complete | runtime-card --evidence or approved producer bridge | codexRuntime, provenance, receiptRefs, staleState | missing_codex_runtime_evidence |
| closeout_ready | pr-closeout JSON and external refresh receipt | PR/CI/review/Linear/root claim verdicts with fetchReceiptRef | blocked_external_refresh_authority |
| judge_pm_audit_ready | audit packet or closeout verifier output | reviewer artifact receipts, deliveryTruth refs, unresolvedRisk | missing_judge_pm_audit_packet |

## Scope and Boundaries

Allowed Coding Harness paths for L1 through L2 foundation:

- src/lib/evidence/**
- src/lib/runtime/codex-runtime-evidence.ts
- src/lib/runtime/codex-runtime-evidence-adapter.ts
- src/lib/runtime/runtime-evidence-bundle.ts
- src/lib/runtime/runtime-evidence-adapter.ts
- src/lib/runtime/runtime-card.ts
- src/lib/runtime/runtime-card-validation.ts
- src/lib/runtime/local-runtime-card.test.ts
- src/commands/runtime-card.test.ts
- src/lib/delivery-truth/**
- src/lib/plan-gate/lifecycle-intent*.ts
- tests or fixtures directly supporting PU-000 through PU-008
- docs/architecture/root-surface-classification.md as read-only citation evidence only during the foundation stage
- package.json only if a new script entry is required for validator discoverability
- .harness/intent/codex-runtime-evidence-verifier-cockpit-implementation-intent.json
- .harness/intent/codex-runtime-evidence-verifier-cockpit-contract-baseline.json
- Appendix C of .harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md for review outcome append-only updates

Allowed Coding Harness paths for later lifecycle stages:

- src/lib/review-state/**
- src/lib/external-state/**
- src/lib/delivery-truth/**
- src/lib/pr-closeout/**
- src/commands/runtime-card.ts and tests when adding evidence input or projection options
- src/commands/pr-closeout.ts and tests when wiring production delivery-truth
- src/commands/next*.ts and tests when exposing runtime-card and delivery-truth summaries
- scripts or validators only when they are the narrowest repo-owned enforcement path
- docs/architecture/root-surface-classification.md when PU-011 or a linked root hygiene slice updates classification evidence
- AGENTS.md, docs/agents/00-architecture-bootstrap.md, docs/agents/07b-agent-governance.md, docs/agents/04-validation.md, README.md, or harness.contract.json when docs-gate or governance synchronization requires them

Allowed read-only source evidence paths:

- /Users/jamiecraik/dev/codex/sdk/**
- /Users/jamiecraik/dev/codex/codex-rs/app-server-protocol/**
- /Users/jamiecraik/dev/codex/codex-rs/protocol/**
- /Users/jamiecraik/dev/codex/codex-rs/analytics/**

Forbidden paths and actions before the named lifecycle gate:

- Mutating /Users/jamiecraik/dev/codex before PU-012 has an approved bridge decision and rollback path.
- Adding public delivery-truth CLI commands before private fixture semantics pass and PU-010 names the public contract.
- Implementing full review-state, external-state connectors, or live GitHub/Linear/CodeRabbit refreshers before PU-009.
- Changing Codex app-server protocol, SDK packages, generated schemas, launcher behavior, or analytics producer code.
- Treating a runtime-card or local validation result as merge-ready, goal-ready, or Judge/PM-ready without delivery-truth claim support.
- Mutating Linear, GitHub, PR state, CI settings, or remote branches from plan text alone rather than an explicit lifecycle unit or user instruction.
- Moving root files or altering ROOT cleanup contracts before PU-011 or a linked root cleanup slice owns the change.

Out of scope:

- Direct production deployment.
- Secret access, credential extraction, or raw prompt/session transcript persistence.
- Destructive branch, worktree, or root cleanup unless separately authorized by the user.
- Marking JSC-331 or this lifecycle complete without Judge/PM audit or an explicit authorized blocked status.

## Authority and Scope Boundary

requested_depth: full_lifecycle_implementation_plan

approved_execution_boundary: This artifact authorizes plan/spec/implementation-note updates and a bounded implementation sequence in Coding Harness. It does not by itself authorize Codex upstream mutation, external service mutation, PR merge, or goal closeout.

downscope_authority: Individual PRs may complete bounded lifecycle slices, but they must name the exact PU range they complete and must not present planning, research, specification, or foundation work as full implementation.

external_mutation_boundary: Linear issue JSC-363 exists for the initial implementation lane. GitHub, CodeRabbit, CircleCI, Codex upstream, and additional Linear mutations require the relevant lifecycle unit, current evidence, and explicit authority.

freshness_required: Branch, worktree, active artifact, Linear, PR, CI, review-thread, root-surface, and Codex producer evidence must be refreshed by the lifecycle unit that consumes it for claim support.

human_acceptance_boundary: Judge/PM audit readiness and any JSC-331 completion language remain human-audit gated. Local validation and self-review cannot satisfy that boundary.

proof_boundary: This plan and its reviews prove implementation readiness only. Completion proof requires code, fixtures, validators, runtime-card output, delivery-truth verdicts, external refresh receipts, and audit artifacts produced by the relevant lifecycle units.

non_proof_sources:

- chat_summary
- plan_text_only
- spec_text_only
- mailbox_only_reviewer_status
- stale_linear_or_pr_snapshot
- local_validation_without_claim_verdict
- Codex final response prose

## Current State / Evidence

Verified in this planning pass:

- The canonical spec exists at .harness/specs/2026-05-24-codex-runtime-evidence-verifier-cockpit-spec.md.
- The spec declares SA-001 through SA-018 and marks the first implementation stage as Harness-only foundation work.
- The spec requires reviewed intent artifacts before implementation and automation-first validation for mechanically checkable acceptance criteria.
- package.json exposes validation commands including pnpm check, pnpm typecheck, pnpm test, pnpm docs:lint, pnpm research:evidence:validate, pnpm architecture:check, and bash scripts/validate-codestyle.sh.
- Existing runtime seams include src/lib/runtime/runtime-card.ts, src/lib/runtime/runtime-evidence-bundle.ts, src/lib/runtime/runtime-evidence-contract.ts, runtime-card tests, and pr-closeout claim semantics.
- Local Codex TypeScript SDK exposes Thread.id, thread.started events, turn lifecycle events, final responses, and usage, but the SDK event stream alone does not prove permission or external-state truth.
- Local Codex Python SDK _run.py collects TurnResult with id, status, timestamps, duration, final_response, items, and usage.
- Local Codex checkout is dirty and ahead of origin; foundation work MUST use it as read-only evidence and must not depend on committing or cleaning that checkout.
- Coding Harness worktree already has unrelated dirty/untracked research/spec files; implementation MUST preserve unrelated changes.

Implementation-time unknowns:

- Whether src/lib/plan-gate is the suitable existing home for lifecycle intent and acceptance-coverage validators.
- Whether delivery-truth should remain entirely private under src/lib/delivery-truth or be colocated with pr-closeout helper tests during the foundation stage.
- Whether runtime-card projection requires a version-compatible additive field or source-only projection.
- Exact fixture filenames and fixture builders.

Resolved planning decisions after review:

- The canonical lifecycle intent artifact path is .harness/intent/codex-runtime-evidence-verifier-cockpit-implementation-intent.json.
- The immutable lifecycle contract baseline path is .harness/intent/codex-runtime-evidence-verifier-cockpit-contract-baseline.json.
- Linear ownership is JSC-363 unless PU-000 records a superseding owner with a reviewer receipt and Linear comment.
- Foundation-stage root hygiene work is fixture-only and citation-only; root classification doc edits move to PU-011 or a linked docs/governance slice.
- Production parity checkpoints are required before any live closeout hook, public delivery-truth command, or Codex-native producer authority can be treated as agent-operable closeout truth.

## Implementation Strategy

Use a proof-first sequence that keeps every unit small and attached to one deep module family while still covering the full lifecycle.

PU-000 is mandatory before runtime implementation. It creates the intent artifact and automation-coverage guard so future units cannot begin as broad feature work. PU-000 must either land as the first implementation commit or produce a validator-backed ordering receipt proving the reviewed intent artifact existed before any runtime file change. PU-001 through PU-004 establish the receipt, Codex packet, adapter, and runtime-card projection path. PU-005 adds private delivery-truth composition and refusal fixtures. PU-006 through PU-008 add root hygiene, accessibility/redaction, non-blending, and closeout downgrade proof around the private verdict layer. PU-009 through PU-016 then promote those semantics through production review-state, external-state, delivery-truth, Codex producer, runtime cockpit, closeout, audit, and maintenance gates.

The Codex checkout is source evidence until PU-012. Fixture shapes may mirror observed Codex SDK, app-server, protocol, and analytics fields, but unsupported fields must be unknown rather than inferred. If implementation discovers a required field is unavailable in Codex source before PU-012, the correct result is a source-classification negative fixture, not a broader upstream patch.

## Runtime Persistence and State

runtime_state: full lifecycle plan reviewed; implementation not started.

resumption_key: .harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md plus JSC-363 plus current branch and active artifact state at implementation time.

runtime_invocation_receipt: User invoked he-plan and follow-up review loops in the current Codex thread on 2026-05-24; no external runtime-card receipt exists yet for implementation.

artifact_chain_key: codex-runtime-evidence-verifier-cockpit-full-lifecycle

persistent_artifacts:

- .harness/specs/2026-05-24-codex-runtime-evidence-verifier-cockpit-spec.md
- .harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md
- .harness/implementation-notes/2026-05-24-runtime-evidence-full-lifecycle-steering-admission.md
- artifacts/reviews/agent-native-reviewer-runtime-evidence-full-lifecycle-final.md
- artifacts/reviews/adversarial-reviewer-runtime-evidence-full-lifecycle-final.md

live_state_refresh: required before implementation, before PR handoff, before any closeout claim, and before Judge/PM audit readiness language.

session_evidence_status: useful for routing and plan confidence, but not proof of implementation, current PR state, current CI state, or production verifier behavior.

proof_boundary: This plan and its review artifacts prove only implementation readiness. Completion proof requires code, fixtures, validators, runtime-card output, delivery-truth verdicts, external refresh receipts, and audit artifacts produced by the relevant lifecycle units.

What survives resume:

- canonical spec path and plan path
- PU-000 through PU-016 lifecycle sequence
- SA-001 through SA-018 acceptance mapping
- issue authority map and Linear action requirement
- forbidden claim boundaries
- review-swarm coverage and artifact limitations

What must be refreshed:

- git branch and dirty worktree
- active artifact index
- Linear JSC-363 ownership and title/scope decision
- PR and CI state after a PR exists
- review-thread and reviewer-artifact state
- validation command availability and results

## Enforcement Contract

essential_decisions:

- L1 and L2 foundation work is Coding Harness only.
- The full lifecycle is PU-000 through PU-016, not PU-000 through PU-008.
- Intent is a first-class artifact and must be reviewed before implementation.
- Each unit is bounded to one deep module family unless PU-000 records an approved blast-radius exception.
- Runtime-card remains a cockpit summary and pointer object, not a raw evidence warehouse.
- delivery-truth remains private fixture-level until PU-010 names and validates the production surface.
- Codex source remains read-only evidence until PU-012 names and validates the producer bridge.
- Orientation evidence can guide harness next, but only claim_support evidence can support delivery claims.
- Reviewed intent must be machine-verifiable through the canonical intent artifact plus a reviewReceiptRef that resolves to an evidence receipt.
- Implementation cannot count as compliant when PU-000 evidence is created after runtime implementation files.
- A planning, research, or spec PR cannot claim implementation delivery.
- Contract-freeze validation must compare current contract surfaces to an immutable pre-implementation baseline snapshot or checksum manifest, not only current plan/spec files.
- Source-derived Codex fixtures must include immutable provenance: commit SHA when available and file checksum fallback for dirty or uncommitted source evidence.

fillable_gaps:

- Exact fixture names.
- Exact validator helper names.
- Whether runtime-card projection is additive fields or source projection only.
- Whether root hygiene receipt remains a fixture through PU-006 or becomes a production validator in PU-011.

guardrails:

- Unit 0 validator or fixture coverage for reviewed intent artifacts.
- Unit 0 ordering guard proving the intent artifact existed before runtime implementation, either through a first implementation commit or a validator-backed ordering receipt.
- Acceptance-coverage validator or fixture mapping every mechanically checkable SA ID.
- Negative tests for unknown Codex fields, stale evidence, orientation-only evidence, mixed-head evidence, producer TTL overreach, sensitive value persistence, and non-text-only status output.
- Contract-freeze validation that blocks acceptance-ID, phase-label, forbidden-path, stop-condition, validation-gate, or rollback weakening during implementation by comparing against the immutable baseline artifact.
- Codex source provenance validation that fails source-derived fixtures without commit SHA or checksum metadata.
- Artifact shape and BLUF checks for this plan before handoff.
- bash scripts/validate-codestyle.sh --fast before PR handoff.

refusal_triggers:

- Any patch mutates /Users/jamiecraik/dev/codex before PU-012 approval.
- Any implementation adds public delivery-truth command authority before private fixtures pass.
- Any closeout path claims green, tidy, delivered, merged, or ready without current delivery-truth support.
- Any receipt stores prompts, secrets, credentials, raw bulky telemetry, or unredacted sensitive payloads.
- Any implementation blends review state, external state, local validation, and merge readiness into one status.
- Any work unit starts without a reviewed intent artifact.
- Any reviewed intent artifact claims reviewStatus reviewed without reviewReceiptRef evidence.
- Any runtime implementation file is changed before PU-000 proof exists.
- Any implementation PR edits frozen contract sections without an explicit contract-change note and review receipt.
- Any PR claims full implementation while only planning, specification, research, or L2 foundation units are complete.
- Any contract-freeze check lacks an immutable baselineRef recorded before runtime implementation begins.

durable_memory:

- The implementation handoff must record that repeated steering about scope, intent, pre-implementation review, and automation became PU-000 and SA-017/SA-018 enforcement.
- If a future unit broadens scope, the reason must be captured in the intent artifact and linked to acceptance IDs.

professional_output:

- Closeout must name files changed, exact commands run, pass/fail/blocked outcomes, unresolved implementation-time unknowns, reviewer coverage, rollback posture, and next stage.
- Do not claim Judge/PM readiness until PU-015 produces the audit packet and current claim-support evidence.

## Coding and Testing Lenses

coding_lens:

- Prefer small deep modules with narrow public seams over broad command surfaces.
- Keep intent, receipt, packet, projection, verifier, and closeout responsibilities separated.
- Treat runtime-card/v1 as an advisory cockpit and pointer object, not an evidence warehouse.
- Reuse runtime-evidence-contract/v1 and pr-closeout/v1 vocabulary for status, freshness, evidence refs, head SHA, blocker class, and verification timestamps.
- Keep Codex producer work behind an explicit bridge decision and rollback path.

testing_lens:

- Add negative tests before positive command exposure for stale, missing, unknown, orientation-only, mixed-head, over-TTL, redaction, and artifact-existence cases.
- Prove every mechanically checkable SA ID with a test, fixture, command, schema assertion, or validator before marking that ID complete.
- Run the narrowest production path touched by each implementation unit; if that path cannot run, record a blocked result with owner and blocker class.
- Treat reviewer artifacts as evidence only after path, size, expected role, producer, and freshness checks pass.

## Work Units

### PU-000: Intent Artifact and Acceptance Coverage Gate

Create the pre-implementation gate that makes the user’s operating rules executable before any runtime evidence code changes.

Source trace: FR-011, FR-012, SA-017, SA-018.

Allowed paths:

- src/lib/plan-gate/lifecycle-intent*.ts
- src/lib/plan-gate/lifecycle-intent*.test.ts
- tests or fixtures for lifecycle intent, ordering, freeze, baseline, and acceptance-coverage validation
- package.json only if a discoverable script is needed
- .harness/intent/codex-runtime-evidence-verifier-cockpit-implementation-intent.json
- .harness/intent/codex-runtime-evidence-verifier-cockpit-contract-baseline.json
- Appendix C of this plan for append-only review outcome synthesis

Forbidden paths:

- Runtime evidence implementation files before the intent validator exists.
- Codex source.
- Public command surfaces unless a tiny validator command is the narrowest existing pattern.

Steps:

1. Define the intent artifact fixture shape with intentId, objective, ownedAcceptanceIds, deepModuleBoundary, inScope, outOfScope, automationPlan, reviewStatus, reviewedBy, reviewReceiptRef, baselineRef, linearIssue, createdAt, reviewedAt, and implementationStartPolicy.
2. Add validation that fails missing objective, owned acceptance IDs, deep module boundary, automation plan, reviewed status, reviewReceiptRef, baselineRef, Linear owner, or reviewedAt timestamp.
3. Require reviewReceiptRef to resolve to an evidence-receipt/v1 artifact receipt with producer, ref or path, verifiedAt, status pass, and evidenceUse claim_support or audit_trail.
4. Create the immutable contract baseline artifact before runtime implementation starts. It must record the approved plan path, source spec path, git commit or worktree state, SHA-256 checksums for frozen sections, capturedAt, producer, and reviewer receipt.
5. Add acceptance coverage validation mapping every mechanically checkable SA ID to a validator, test, fixture, command, or schema assertion.
6. Add an ordering guard that fails if any PU-001 through PU-016 lifecycle implementation path is modified before the canonical intent artifact exists and is reviewed. Preferred proof is a separate PU-000 commit before runtime code; fallback proof is a validator-backed ordering receipt that compares the baselineRef against the earliest touched implementation file in the lifecycle path set.
7. Add a contract-freeze check that compares acceptance IDs, phase labels, forbidden paths, stop conditions, validation gates, and rollback obligations against baselineRef, not only the current source spec and current plan.
8. Add a consistency check that implementation notes, Linear traceability, and acceptance criteria preserve lifecycle-stage semantics.
9. Record the lifecycle implementation intent and baseline before PU-001 begins.

Validation:

- Command: pnpm vitest run src/lib/plan-gate/lifecycle-intent-artifact-validation.test.ts -> required after PU-000.
- Command: pnpm vitest run src/lib/plan-gate/lifecycle-intent-acceptance-coverage-validation.test.ts -> required after PU-000.
- Command: pnpm vitest run src/lib/plan-gate/lifecycle-intent-ordering-guard.test.ts -> required after PU-000.
- Command: pnpm vitest run src/lib/plan-gate/lifecycle-contract-freeze-validation.test.ts -> required after PU-000.
- Command: pnpm vitest run src/lib/plan-gate/lifecycle-contract-baseline-validation.test.ts -> required after PU-000.
- Command: pnpm markdownlint .harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md -> required before handoff.

Stop condition: Stop if the validator path does not exist and no equivalent validator, fixture, or schema assertion is added in PU-000. Stop if the canonical intent artifact cannot be created, reviewed, tied to a reviewReceiptRef, and tied to an immutable baselineRef before runtime implementation begins.

Rollback note: Remove the new validator module and tests; no runtime behavior should have changed.

Handoff state: Blocks all later PU work until pass.

### PU-001: evidence-receipt/v1 Schema and Fixtures

Add the shared proof primitive used by runtime evidence, artifacts, review evidence, external state, and run records.

Source trace: FR-001, SA-001.

Allowed paths:

- src/lib/evidence/evidence-receipt.ts
- src/lib/evidence/evidence-receipt.test.ts
- supporting fixture files under src/lib/evidence/**

Forbidden paths:

- Runtime-card projection.
- delivery-truth composition.
- Codex source.

Steps:

1. Define evidence-receipt/v1 with kind, ref, producer, producedAt or verifiedAt, status, freshness, evidenceUse, blockerClass, optional headSha, optional sizeBytes, and optional checksum.
2. Validate status, freshness, and evidenceUse enums.
3. Reject missing required fields and invalid artifact receipt sizes.
4. Include fixture coverage for validation, artifact, review_artifact, external_state, runtime_card, and run_record kinds when feasible.

Validation:

- Command: pnpm vitest run src/lib/evidence/evidence-receipt.test.ts -> required after PU-001.

Stop condition: Stop if receipt status/freshness semantics fork existing runtime-evidence-contract or pr-closeout meanings.

Rollback note: Remove src/lib/evidence additions; no public command behavior should remain.

Handoff state: Enables PU-002.

### PU-002: codex-runtime-evidence/v1 Schema and Source Classification

Create the Codex-shaped input packet and make unsupported fields explicit unknowns.

Source trace: FR-002, FR-003, SA-002, SA-003.

Allowed paths:

- src/lib/runtime/codex-runtime-evidence.ts
- src/lib/runtime/codex-runtime-evidence.test.ts
- fixtures derived from read-only Codex source evidence

Forbidden paths:

- /Users/jamiecraik/dev/codex/**
- native Codex emitter code.
- delivery-truth public command surfaces.

Steps:

1. Define codex-runtime-evidence/v1 with codex identity, permission profile, MCP summary, receipts, validation results, optional externalState, optional reviewState, and staleState classification.
2. Add source-kind classification for sdk_typescript, sdk_python, app_server_protocol, analytics, wrapper, and unknown.
3. Add SDK-only fixtures proving permission and external-state claims remain unknown unless supplied by stronger verifier receipts.
4. Add app-server-shaped and analytics-derived fixtures based on the inspected Codex paths.
5. Add source-provenance metadata to every source-derived fixture: codexRepoPath, commitSha when available, dirtyState, sourceFileChecksums, capturedAt, and sourceKind.
6. Add negative fixtures for missing turnId, unknown permission profile, unavailable traceId, adjacent-field inference, and missing source provenance.

Validation:

- Command: pnpm vitest run src/lib/runtime/codex-runtime-evidence.test.ts -> required after PU-002.
- Command: pnpm vitest run src/lib/runtime/codex-runtime-source-provenance.test.ts -> required after PU-002.

Stop condition: Stop if the implementation infers permission, PR, CI, review, or Linear truth from SDK-only events. Stop if source-derived fixtures omit Codex commit SHA or checksum fallback metadata.

Rollback note: Remove codex-runtime-evidence module and fixtures.

Handoff state: Enables PU-003.

### PU-003: Runtime Evidence Bundle Adapter

Map codex-runtime-evidence/v1 into the existing runtime-evidence-bundle/v1 path without flattening provenance away.

Source trace: FR-004, SA-004.

Allowed paths:

- src/lib/runtime/codex-runtime-evidence-adapter.ts
- src/lib/runtime/runtime-evidence-bundle.ts
- src/lib/runtime/runtime-evidence-adapter.ts
- adapter tests and fixtures

Forbidden paths:

- Public CLI behavior unless existing runtime-card evidence input requires an additive parser change.
- Codex source.

Steps:

1. Add an adapter from codex-runtime-evidence/v1 into runtime-evidence-bundle/v1.
2. Preserve raw packet artifact references and source classification in provenance or sources.
3. Preserve receipt refs rather than embedding raw event streams.
4. Reject malformed packet input without discarding existing non-Codex runtime evidence.

Validation:

- Command: pnpm vitest run src/lib/runtime/codex-runtime-evidence.test.ts src/lib/runtime/runtime-evidence-adapter.test.ts -> required after PU-003.

Stop condition: Stop if existing runtime-evidence-bundle/v1 producers regress or if raw packet bodies are embedded into runtime-card.

Rollback note: Remove adapter wiring and tests; keep existing runtime evidence behavior unchanged.

Handoff state: Enables PU-004.

### PU-004: Runtime Card Projection

Project compact Codex runtime summaries and receipt refs into runtime-card/v1 while keeping runtime-card a cockpit object.

Source trace: FR-005, SA-005.

Allowed paths:

- src/lib/runtime/runtime-card.ts
- src/lib/runtime/runtime-card-validation.ts
- src/lib/runtime/local-runtime-card-assembly.ts
- src/lib/runtime/local-runtime-card.test.ts
- src/commands/runtime-card.test.ts

Forbidden paths:

- Raw event stream embedding.
- Full review body embedding.
- Public delivery-truth command surfaces.

Steps:

1. Add compact codexRuntime, capabilities, receiptRefs, externalState freshness summary, staleState summary, or equivalent source projection.
2. Keep full packet detail in referenced receipts or fixtures.
3. Add validation rejecting raw event stream and full review-body embedding.
4. Confirm runtime-card --json remains valid and source-backed.

Validation:

- Command: pnpm vitest run src/lib/runtime/runtime-card-validation.test.ts src/commands/runtime-card.test.ts -> required after PU-004.
- Command: pnpm exec tsx src/cli.ts runtime-card --json --repo . -> required after PU-004.

Stop condition: Stop if runtime-card/v1 becomes a bulk evidence store or changes existing lifecycle semantics.

Rollback note: Revert additive projection and validation changes.

Handoff state: Enables PU-005.

### PU-005: Private delivery-truth Composition Fixtures

Add private verdict composition tests that prove claim support cannot be faked by stale, missing, orientation-only, mixed-head, or producer-overfresh evidence.

Source trace: FR-006, FR-007, SA-006, SA-007, SA-011, SA-015, SA-016.

Allowed paths:

- src/lib/delivery-truth/**
- src/lib/pr-closeout/types.ts only if type reuse requires additive exports
- src/lib/runtime/runtime-evidence-contract.ts only if type reuse requires additive exports
- tests or fixtures under src/lib/delivery-truth/**

Forbidden paths:

- Public delivery-truth CLI.
- pr-closeout behavior changes that alter public closeout semantics.
- Live GitHub, Linear, CI, or CodeRabbit connectors.

Steps:

1. Define private delivery-truth fixture helpers around claim, status, source, evidenceRef, headSha, verdictHeadSha, freshness, blockerClass, verifiedAt, and evidenceUse.
2. Reuse runtime-evidence-contract/v1 and pr-closeout/v1 semantics rather than redefining equivalent enums.
3. Add negative tests for stale, missing, unknown, and orientation-only receipts.
4. Add separate claim fixtures for root_surface_tidy, goal_ready_for_judge_pm, and merge_ready.
5. Add mixed-head merge_ready refusal with stable mixed_head_evidence code.
6. Add verifier-owned freshness-policy refusal when producer TTL exceeds verifier policy or conflicts with fetchedAt/headSha recomputation.

Validation:

- Command: pnpm vitest run src/lib/delivery-truth/delivery-truth-composition.test.ts -> required after PU-005.
- Command: pnpm vitest run src/lib/delivery-truth/delivery-truth-freshness-policy.test.ts -> required after PU-005.

Stop condition: Stop if delivery-truth becomes a public command or if claim verdicts can pass without evidenceUse claim_support.

Rollback note: Remove private delivery-truth module and tests; public behavior should remain unchanged.

Handoff state: Enables PU-006 through PU-008.

### PU-006: Root Hygiene Receipt Fixture

Tie root_surface_tidy to the canonical root-surface classification through an evidence receipt.

Source trace: SA-012.

Allowed paths:

- src/lib/delivery-truth/** fixtures
- src/lib/evidence/** helper types if needed
- docs/architecture/root-surface-classification.md as read-only citation evidence only

Forbidden paths:

- Moving root files.
- Deleting legacy or drift artifacts.
- Changing ROOT cleanup policy.

Steps:

1. Add root_surface_tidy fixture that requires a receipt ref to docs/architecture/root-surface-classification.md or a root-hygiene-classification/v1 source.
2. Add negative fixture showing root tidy cannot pass without classification source.
3. Keep root cleanup implementation out of this slice.
4. If a citation anchor is missing or stale, record a deferred docs/governance follow-up instead of editing the root classification document in the foundation stage.

Validation:

- Command: pnpm vitest run src/lib/delivery-truth/delivery-truth-composition.test.ts -> required after PU-006.

Stop condition: Stop if the fixture starts moving files, editing root classification, or redefining root classification.

Rollback note: Remove root tidy fixtures only.

Handoff state: Can run after PU-005.

### PU-007: Accessibility and Redaction Fixtures

Prove operator-facing verdicts are readable and receipts do not persist sensitive or bulky raw data.

Source trace: SA-013, SA-014.

Allowed paths:

- src/lib/evidence/**
- src/lib/delivery-truth/**
- src/lib/runtime/** validation tests

Forbidden paths:

- Persisting raw prompts, credentials, secrets, or bulky event streams.
- Color-only or icon-only status output.

Steps:

1. Add fixture proving verdict outputs include textual status labels and blocker refs.
2. Add redaction/security fixture proving prompts, secrets, credentials, and bulky payloads are omitted, blocked, or represented only by safe refs.
3. Ensure any machine-readable output remains screen-reader friendly and deterministic.

Validation:

- Command: pnpm vitest run src/lib/evidence/evidence-receipt.test.ts src/lib/delivery-truth/delivery-truth-composition.test.ts -> required after PU-007.

Stop condition: Stop if a receipt stores sensitive values or if status proof depends only on color, icons, or glyphs.

Rollback note: Remove accessibility/redaction fixtures and related validation helpers.

Handoff state: Can run after PU-005.

### PU-008: Non-Blending and Closeout Downgrade Fixtures

Prove the foundation stage does not blend review, external, local validation, and closeout truth, and that unsupported closeout language is blocked or downgraded.

Source trace: FR-008, FR-010, SA-008 foundation fixture, SA-010 foundation private fixture.

Allowed paths:

- src/lib/delivery-truth/**
- src/lib/pr-closeout/** tests only if additive fixture reuse is needed
- private delivery-truth test/helpers only; no public command surfaces in PU-008

Forbidden paths:

- Full review-state/v1 implementation.
- Full external-state-snapshot/v1 implementation.
- Automated closeout hook wiring.
- Public delivery-truth or closeout command behavior.
- Production closeout rendering or final-response/PR-body text rewriting.
- Live PR, tracker, CI, or review API calls.

Steps:

1. Add foundation non-blending fixture with separate review-state and external-state refs.
2. Add negative fixture proving one blended readiness status cannot satisfy separate claims.
3. Add private closeout text fixture that downgrades or blocks green, tidy, delivered, merged, or ready language when no current claim-support verdict exists, including stale, head-SHA-mismatched, missing, or orientation-only evidence.
4. Keep automated closeout hook integration deferred.

Validation:

- Command: pnpm vitest run src/lib/delivery-truth/delivery-truth-composition.test.ts -> required after PU-008.
- Command: rg 'from "\\.\\./(review-state|external-state)/|src/lib/(review-state|external-state)|src/commands/' src/lib/delivery-truth -> must return no matches.

Stop condition: Stop if implementation requires production review-state/external-state modules, wires a live closeout hook, mutates production closeout rendering, or adds public command behavior before PU-009 and PU-010 approval.

Rollback note: Remove private non-blending and closeout downgrade fixtures.

Handoff state: Completes the foundation verifier lane and enables production verifier work.

### PU-009: review-state/v1 and external-state-snapshot/v1 Production Packets

Promote the non-blending fixture model into production packet contracts for PR review truth and live external state.

Source trace: FR-008, SA-008.

Allowed paths:

- src/lib/review-state/**
- src/lib/external-state/**
- src/lib/pr-closeout/** additive integration points
- tests and fixtures for review/external-state packet validation

Forbidden paths:

- Treating a GitHub check summary as review-thread truth.
- Treating Linear state, CI state, PR review state, and local validation as one status.
- Accepting external snapshots without fetchedAt, ttlSeconds, source, and headSha when applicable.

Steps:

1. Define review-state/v1 with PR number, URL, base, head, headSha, unresolved threads, reviewer artifacts, CodeRabbit/GitHub review status, and validation ownership classification.
2. Define external-state-snapshot/v1 with fetchedAt, ttlSeconds, source statuses, headSha, stale flag, stale reasons, and evidenceUse.
3. Add validation that stale or missing snapshots can orient harness next but cannot support merge-ready or delivery-ready claims.
4. Add fixtures for unresolved review thread, missing reviewer artifact, stale PR head SHA, stale Linear snapshot, and CodeRabbit unavailable cases.

Validation:

- Command: pnpm vitest run src/lib/review-state/*.test.ts src/lib/external-state/*.test.ts -> required after PU-009.
- Command: pnpm vitest run src/lib/pr-closeout/*.test.ts -> required after PU-009 if pr-closeout integration points change.

Stop condition: Stop if one packet or verdict blends local validation, remote checks, review threads, tracker state, and merge readiness.

Rollback note: Remove production review-state/external-state modules and restore pr-closeout imports to the previous state.

Handoff state: Enables PU-010 production delivery-truth.

### PU-010: delivery-truth/v1 Production Verifier and Closeout Integration

Promote private delivery-truth fixtures into production claim verification that can be consumed by pr-closeout flows and later projected by runtime-card and harness next in PU-013. PU-010 owns the production verifier and the narrow closeout library seam only; it does not own cockpit command wiring.

Source trace: FR-006, FR-007, FR-010, SA-006, SA-007, SA-010, SA-011, SA-015, SA-016.

Allowed paths:

- src/lib/delivery-truth/**
- src/lib/pr-closeout/**
- src/commands/pr-closeout.ts and tests when the existing command is the narrowest integration surface

Forbidden paths:

- Introducing a broad new public command surface when existing pr-closeout or runtime-card integration is sufficient.
- Marking merge_ready, root_surface_tidy, or goal_ready_for_judge_pm pass from local validation alone.
- Accepting any claim without evidenceRef, freshness, verifiedAt, source, and headSha where applicable.

Steps:

1. Define production delivery-truth/v1 claim verdicts with status, evidenceRef, source, headSha, freshness, blockerClass, verifiedAt, and evidenceUse.
2. Wire delivery-truth into pr-closeout or the narrowest existing closeout helper so unsupported closeout language is blocked or downgraded.
3. Define the compact delivery-truth summary shape that PU-013 may later project into runtime-card and harness next output, without touching `src/commands/next*.ts` in this slice.
4. Add negative fixtures for blended readiness, mixed-head evidence, producer TTL overreach, missing artifact receipt, stale external state, and unresolved review state.

Validation:

- Command: pnpm vitest run src/lib/delivery-truth/*.test.ts src/lib/pr-closeout/*.test.ts -> required after PU-010.
- Command: pnpm exec tsx src/cli.ts pr-closeout --help -> required if pr-closeout command behavior changes.

Stop condition: Stop if delivery-truth creates a false-success path, if PU-010 touches `src/commands/next*.ts`, or if any planned PU-013 cockpit summary becomes executable authority rather than advisory metadata.

Rollback note: Disable delivery-truth integration behind the prior pr-closeout behavior and keep fixture tests for the failure case.

Handoff state: Enables root hygiene and external closeout claims to become machine-verifiable.

### PU-011: ROOT Hygiene Claim and Project Scaffold Verification

Turn ROOT tidiness from conversational steering into a claim backed by root-surface classification evidence.

Source trace: SA-012 and repeated ROOT cleanup steering.

Allowed paths:

- src/lib/delivery-truth/**
- src/lib/root-hygiene/** for the classifier, verifier-owned tracked-path
  inventory projection, receipt construction, coverage digest, policy
  projection, and typed report contract
- ARCHITECTURE.md when the root-hygiene deep module is added or split
- docs/architecture/root-surface-classification.md
- docs/README.md
- docs/agents/00-architecture-bootstrap.md
- docs/agents/07b-agent-governance.md
- tests and fixtures for root-hygiene-classification/v1

Forbidden paths:

- Deleting tracked or untracked root artifacts without explicit destructive authorization.
- Moving project scaffold files without classification and reference updates.
- Claiming ROOT tidy from a file move alone.

Steps:

1. Define root-hygiene-classification/v1 or equivalent receipt fields for canonical root, should move, generated intentionally tracked, and legacy/drift.
2. Derive claim-support reports through a verifier-owned live git-tracked-path seam that reads `git ls-files` without a shell, computes root entries and complete git-tracked inventory internally, and does not expose caller-supplied path lists as the passing claim-support path.
3. Bind classifier receipts to a coverage checksum recomputed from the classified root entries, to the current root-surface policy digest, and to a non-path repository identity derived from the real git toplevel; fail closed if the computed inventory digest differs or if a caller tries to label policy-only entries as git-tracked evidence through the general classifier.
4. Require root_surface_tidy delivery-truth to verify the classifier report payload, repository identity, module-private verifier-owned runtime report token, frozen report graph, report-internal summary and coverage counts, receipt fields, checksum-bound coverage, current policy-bound receipt ref, and matching head SHA when the verdict is head-bound before passing.
5. Add fixtures proving missing classification, stale classification, unreferenced root drift, incomplete inventory, inventory digest mismatch, policy-only inventory mislabeled as git-tracked evidence, document-only refs, checksum-less receipts, stale policy-era receipt refs, stale-head receipts, synthetic tracked-path arrays, shape-valid synthetic receipts without classifier reports, post-token mutation attempts, direct-import-forged token attempts, digest-consistent copied reports not produced by the verifier seam, missing repository identity, and cross-repository replay attempts block root_surface_tidy.
6. Update root classification and governance docs only for the paths touched by the approved cleanup slice.

Validation:

- Command: pnpm vitest run src/lib/root-hygiene/*.test.ts src/lib/delivery-truth/*.test.ts src/lib/architecture/module-boundaries.test.ts -> required after PU-011.
- Command: pnpm architecture:check -> required after PU-011 when the root-hygiene deep module is added.
- Command: pnpm run docs:ubiquitous:guard -> required if AGENTS or glossary-governed terms change.
- Command: bash scripts/run-harness-gate.sh docs-gate --mode required --json -> required if docs-gate surfaces change.
- Command: bash scripts/validate-codestyle.sh --fast -> required after PU-011.

Stop condition: Stop if the implementation removes or moves root artifacts without a non-destructive classification contract.

Rollback note: Revert root-hygiene claim code and documentation updates; do not restore by destructive checkout.

Handoff state: Enables closeout claims to include root_surface_tidy without prose-only proof.

### PU-012: Codex Runtime Evidence Producer Bridge

Create the approved producer or exporter path that lets Codex runtime truth enter Coding Harness without scraping final assistant prose.

Source trace: SA-009.

Allowed paths:

- Coding Harness adapter, wrapper, or ingestion scripts under src/lib/runtime/** or scripts/**
- /Users/jamiecraik/dev/codex read-only until a separate Codex-side ADR/spec approves mutation
- cross-repo documentation only when required to record the producer boundary

Forbidden paths:

- Mutating /Users/jamiecraik/dev/codex without an approved Codex-side contract, rollback path, and validation gate.
- Inferring permission, CI, PR, review, or Linear truth from SDK events that do not contain those facts.
- Persisting prompts, secrets, credentials, or bulky raw session transcripts.

Steps:

1. Choose the bridge boundary: Harness wrapper, TypeScript SDK producer, Python SDK producer, app-server protocol producer, analytics export, or staged combination.
2. Record the decision in the intent artifact or a linked ADR/spec before implementation.
3. Produce codex-runtime-evidence/v1 packets with threadId, turnId, traceId, goal state, permission profile, MCP environment, artifact receipts, validation results, and provenance fields that are actually observable.
4. Validate source provenance through commit SHA or checksum fallback for dirty source evidence.

Validation:

- Command: pnpm vitest run src/lib/runtime/codex-runtime-evidence.test.ts src/lib/runtime/runtime-evidence-adapter.test.ts -> required after PU-012.
- Command: selected Codex-side validation command -> required only if Codex source is mutated by an approved follow-up.

Stop condition: Stop if the bridge relies on final response text, stale summaries, or unsupported Codex fields as runtime truth.

Rollback note: Disable the producer bridge and retain schema/adaptor validation.

Handoff state: Enables PU-013 cockpit projection from produced packets.

### PU-013: Runtime Cockpit Integration

Make runtime cards and harness next consume the validated Codex evidence, receipt refs, stale-state classifications, and delivery-truth summaries.

Source trace: FR-004, FR-005, FR-006, FR-007.

Allowed paths:

- src/lib/runtime/**
- src/commands/runtime-card.ts and tests
- src/commands/next*.ts and tests
- docs/agents/** only when docs-gate requires governance synchronization

Forbidden paths:

- Turning harness next into broad executable authority.
- Embedding raw review bodies, raw event streams, prompts, or bulky telemetry in runtime-card/v1.
- Claiming merge readiness from a runtime-card summary alone.

Steps:

1. Add or finalize runtime-card --evidence ingestion from codex-runtime-evidence/v1 or runtime-evidence-bundle/v1.
2. Project compact Codex runtime, capabilities, receipt refs, external-state freshness, stale-state reasons, and delivery-truth summaries.
3. Keep harness next --json narrow: one cockpit answer plus refs to runtime card and blocking claims.
4. Add smoke tests for valid packet, stale packet, missing receipt, and unsupported claim cases.

Validation:

- Command: pnpm vitest run src/lib/runtime/*.test.ts src/commands/runtime-card.test.ts src/commands/next*.test.ts -> required after PU-013.
- Command: pnpm exec tsx src/cli.ts runtime-card --json --repo . -> required after PU-013.
- Command: pnpm exec tsx src/cli.ts next --json -> required after PU-013 when harness next behavior changes.

Stop condition: Stop if runtime-card becomes the evidence warehouse or if harness next executes actions rather than recommending them.

Rollback note: Remove evidence-ingestion projection and restore prior runtime-card/harness next output contracts.

Handoff state: Enables closeout refresh and audit packet work.

### PU-014: PR, CI, Review, Linear, and Stale-State Closeout Refresh

Require live external-state refresh before merge-readiness, delivery, or closeout claims.

Source trace: FR-008, FR-010, SA-008, SA-010.

Allowed paths:

- src/lib/pr-closeout/**
- src/lib/external-state/**
- src/lib/review-state/**
- src/lib/delivery-truth/**
- docs/agents/07b-agent-governance.md and PR template guidance if docs-gate requires synchronization

Forbidden paths:

- Treating cached PR, CI, Linear, or CodeRabbit status as current without TTL and head SHA.
- Claiming remote checks, review thread resolution, tracker alignment, or merge readiness from local validation.
- Self-approving independent review requirements.

Steps:

1. Refresh GitHub PR metadata, checks, reviews, review threads, CodeRabbit state, Linear state, and required-check status before closeout claims.
2. Refresh through a repo-owned command/module or explicit connector wrapper that agents can invoke; if no such authority is available, emit blocked_external_refresh_authority rather than accepting manual or synthetic state.
3. Emit external-state-snapshot/v1 and review-state/v1 receipts with TTL, fetchedAt, headSha, source, stale-state classification, fetchReceiptRef, fetched artifact hash, and verifier identity.
4. Make pr-closeout fail or block unsupported closeout claims and report each claim separately.
5. Add failure fixtures for stale head SHA, missing CodeRabbit artifact, unresolved review thread, failing CI, stale Linear state, missing reviewer ownership, missing fetchReceiptRef, and fresh-looking metadata without verifier-owned fetch proof.

Validation:

- Command: pnpm vitest run src/lib/pr-closeout/*.test.ts src/lib/external-state/*.test.ts src/lib/review-state/*.test.ts src/lib/delivery-truth/*.test.ts -> required after PU-014.
- Command: gh pr view {pr-number} --json headRefOid,statusCheckRollup,reviewDecision -> required during live PR closeout when a PR exists.
- Command: gh pr checks {pr-number} -> required during live PR closeout when a PR exists.
- Command: repo-owned external refresh command or connector wrapper smoke -> required before any claim-support receipt from PU-014 can pass.

Stop condition: Stop if local validation, remote checks, review threads, tracker state, and merge readiness are blended into one truth.

Rollback note: Revert closeout refresh integration and preserve negative tests documenting the false-success case.

Handoff state: Enables Judge/PM audit readiness packet.

### PU-015: Judge/PM Audit Packet and Goal Closeout Gate

Prepare the audit evidence required before any goal completion claim.

Source trace: repeated JSC-331 Judge/PM audit instruction and SA-010.

Allowed paths:

- src/lib/delivery-truth/**
- src/lib/pr-closeout/**
- .harness/implementation-notes/**
- artifacts/reviews/**
- docs/goals/** only when the active goal artifact requires update

Forbidden paths:

- Marking JSC-331 or this lifecycle complete without Judge/PM audit or explicit authorized blocked status.
- Treating reviewer mailbox text as artifact evidence when an artifact was requested.
- Claiming audit readiness with missing artifact paths, zero-byte artifacts, stale snapshots, or unresolved blocker classes.

Steps:

1. Generate or define a Judge/PM audit packet containing runtime card refs, delivery-truth verdicts, review-state, external-state, Linear state, validation receipts, root hygiene, and unresolved-risk classification.
2. Require reviewer artifacts to exist, be non-empty, and match expected producer/role before audit_ready can pass.
3. Require goal status to remain active until Judge/PM audit completes or a blocked state is authorized and recorded.
4. Require the audit packet to include an issueAuthorityMap and fail when the claimed closeout issue, parent issue, or referenced external goal does not match the authorized lifecycle mapping.
5. Add fixtures for missing reviewer artifact, stale audit packet, unresolved blocker, mismatched issue ID, and missing Linear/PR linkage.

Validation:

- Command: pnpm vitest run src/lib/delivery-truth/*.test.ts src/lib/pr-closeout/*.test.ts -> required after PU-015.
- Command: test -s artifacts/reviews/{expected-reviewer}.md -> required for every expected audit reviewer artifact during live closeout.

Stop condition: Stop if a goal completion claim is possible without Judge/PM audit evidence.

Rollback note: Remove audit packet integration and restore previous goal closeout behavior only after documenting the residual risk.

Handoff state: Enables lifecycle hardening and final review.

### PU-016: Lifecycle Hardening, Documentation, CI, and Maintenance Ownership

Synchronize validators, documentation, CI expectations, architecture context, and maintenance ownership so the same steering is unnecessary in future work.

Source trace: full lifecycle steering admission and repo governance requirements.

Allowed paths:

- AGENTS.md
- README.md
- docs/agents/**
- docs/architecture/**
- AI/context/diagram-context.md
- harness.contract.json
- package.json
- scripts/**
- tests and fixtures for lifecycle validators

Forbidden paths:

- Adding prose-only requirements without a validator, fixture, schema, or explicit tracked exception.
- Updating generated artifacts without the source or refresh command.
- Declaring broader autonomy ready without reviewer and validation evidence.

Steps:

1. Add or update the smallest validator, schema, or CI gate that prevents planning-only delivery claims from passing as implementation.
2. Synchronize docs-gate required surfaces when architecture, closeout, runtime-card, or agent-governance behavior changes.
3. Refresh architecture context only when repo rules require it.
4. Record maintenance ownership, rollback path, and future follow-up boundaries in implementation notes or Linear.

Validation:

- Command: pnpm check -> required before final implementation PR handoff unless a concrete blocker is recorded.
- Command: bash scripts/validate-codestyle.sh -> required before final implementation PR handoff.
- Command: bash scripts/run-harness-gate.sh docs-gate --mode required --json -> required when docs-gate surfaces change.
- Command: pnpm test:deep -> required if runtime or artifact behavior changes beyond unit fixtures.

Stop condition: Stop if the lifecycle still relies on user memory or prompt-only reminders for a repeated steering class.

Rollback note: Revert hardening changes by file scope and keep the steering admission note as historical evidence.

Handoff state: Full lifecycle implementation can be reviewed for merge and Judge/PM audit readiness.

## Dependencies and Sequencing

~~~mermaid
flowchart TD
  PU000["PU-000 reviewed intent and automation coverage"] --> PU001["PU-001 evidence-receipt/v1"]
  PU001 --> PU002["PU-002 codex-runtime-evidence/v1"]
  PU002 --> PU003["PU-003 runtime-evidence adapter"]
  PU003 --> PU004["PU-004 runtime-card projection"]
  PU001 --> PU005["PU-005 private delivery-truth fixtures"]
  PU003 --> PU005
  PU004 --> PU005
  PU005 --> PU006["PU-006 root hygiene receipt fixture"]
  PU005 --> PU007["PU-007 accessibility and redaction fixtures"]
  PU005 --> PU008["PU-008 non-blending and closeout downgrade fixtures"]
  PU008 --> PU009["PU-009 review-state and external-state packets"]
  PU009 --> PU010["PU-010 production delivery-truth verifier"]
  PU010 --> PU011["PU-011 ROOT hygiene claim and scaffold verification"]
  PU010 --> PU012["PU-012 Codex runtime producer bridge"]
  PU012 --> PU013["PU-013 runtime cockpit integration"]
  PU011 --> PU014["PU-014 PR, CI, review, Linear closeout refresh"]
  PU013 --> PU014
  PU014 --> PU015["PU-015 Judge/PM audit packet and goal gate"]
  PU015 --> PU016["PU-016 hardening, docs, CI, maintenance"]
  PU016 --> CLOSE["Full lifecycle handoff: reviewable for merge and audit readiness"]
~~~

PU-000 is a hard predecessor for all work. PU-001 through PU-004 are sequential because each builds the evidence flow. PU-005 depends on receipt, adapter, and runtime-card semantics. PU-006 through PU-008 may proceed in parallel after PU-005 if a coordinator keeps their touched files separate and their intent artifacts distinct. PU-009 through PU-016 are the production lifecycle and closeout stages; they cannot be collapsed into the foundation PR unless their code paths, validators, external-state refresh, and audit evidence are all completed in that same PR.

## Validation Gates

Pre-implementation checks:

| Gate | Required | Command | Expected Result |
| --- | --- | --- | --- |
| Source spec shape | yes | python3 /Users/jamiecraik/dev/agent-skills/Plugins/harness-engineering/scripts/check_generated_artifact_shape.py .harness/specs/2026-05-24-codex-runtime-evidence-verifier-cockpit-spec.md --kind spec --json | pass |
| Source spec BLUF | yes | python3 /Users/jamiecraik/dev/agent-skills/Plugins/harness-engineering/scripts/check_bluf_structure.py .harness/specs/2026-05-24-codex-runtime-evidence-verifier-cockpit-spec.md --json | pass |
| Plan shape | yes | python3 /Users/jamiecraik/dev/agent-skills/Plugins/harness-engineering/scripts/check_generated_artifact_shape.py .harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md --kind plan --json | pass |
| Plan BLUF | yes | python3 /Users/jamiecraik/dev/agent-skills/Plugins/harness-engineering/scripts/check_bluf_structure.py .harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md --json | pass |
| Markdown | yes | pnpm markdownlint .harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md .harness/specs/2026-05-24-codex-runtime-evidence-verifier-cockpit-spec.md | pass |

Implementation validation commands:

~~~bash
pnpm vitest run src/lib/plan-gate/lifecycle-intent-artifact-validation.test.ts
pnpm vitest run src/lib/plan-gate/lifecycle-intent-acceptance-coverage-validation.test.ts
pnpm vitest run src/lib/plan-gate/lifecycle-intent-ordering-guard.test.ts
pnpm vitest run src/lib/plan-gate/lifecycle-contract-freeze-validation.test.ts
pnpm vitest run src/lib/plan-gate/lifecycle-contract-baseline-validation.test.ts
pnpm vitest run src/lib/evidence/evidence-receipt.test.ts
pnpm vitest run src/lib/runtime/codex-runtime-evidence.test.ts src/lib/runtime/codex-runtime-source-provenance.test.ts src/lib/runtime/runtime-evidence-adapter.test.ts
pnpm vitest run src/lib/runtime/runtime-card-validation.test.ts src/commands/runtime-card.test.ts
pnpm vitest run src/lib/delivery-truth/delivery-truth-composition.test.ts
pnpm vitest run src/lib/delivery-truth/delivery-truth-freshness-policy.test.ts
pnpm vitest run src/lib/review-state/*.test.ts src/lib/external-state/*.test.ts src/lib/pr-closeout/*.test.ts
pnpm vitest run src/commands/next*.test.ts # after PU-013 cockpit projection only; not a PU-010 validation gate
pnpm exec tsx src/cli.ts runtime-card --json --repo .
bash scripts/validate-codestyle.sh --fast
~~~

Conditional validation:

| Gate | Condition | Command |
| --- | --- | --- |
| Full repository check | Before PR handoff or when source behavior changes broadly | pnpm check |
| Deep tests | If runtime/artifact behavior changes beyond fixtures | pnpm test:deep |
| Docs gate | If docs-gate surfaces are touched | bash scripts/run-harness-gate.sh docs-gate --mode required --json |
| Codex source validation | PU-012 only if approved Codex source mutation occurs | cd /Users/jamiecraik/dev/codex && just write-app-server-schema |
| Codex Rust protocol tests | PU-012 only if approved Codex Rust protocol mutation occurs | cd /Users/jamiecraik/dev/codex && cargo test -p codex-app-server-protocol |

Do not mark implementation complete from a passing plan/spec validator. Runtime behavior must be proven by the unit-specific tests above.

Observable proof map:

| Source IDs | Observable Behavior Under Test | Required Proof |
| --- | --- | --- |
| SA-017, SA-018 | Implementation cannot start or complete from conversational intent alone or post-hoc plan/spec edits. | Intent-artifact, intent-ordering, contract-baseline, contract-freeze, and acceptance-coverage validators fail missing objective, owned acceptance IDs, deep module boundary, automation plan, reviewed status, reviewReceiptRef, baselineRef, pre-runtime ordering proof, or frozen-contract integrity. |
| SA-001 | Receipt fields are machine-validated, not implied by producer prose. | evidence-receipt fixtures pass valid status/freshness/evidenceUse records and fail missing or invalid required fields. |
| SA-002, SA-003 | Codex-shaped packets preserve observed source fields, pin fixture provenance, and mark unsupported truth unknown. | SDK-only, app-server-shaped, analytics-derived, source-provenance, and source-classification negative fixtures pass. |
| SA-004, SA-005 | Codex runtime evidence becomes runtime-evidence-bundle sources and runtime-card summary refs without bulky raw bodies. | Adapter and runtime-card validation reject lost provenance, raw event stream embedding, or full review-body embedding. |
| SA-006, SA-007, SA-011, SA-015, SA-016 | Claim-support verdicts fail when evidence is stale, missing, orientation-only, semantically forked, mixed-head, or over-fresh by producer TTL. | Private delivery-truth composition and freshness-policy tests fail with stable blocker codes. |
| SA-008, SA-010 | Foundation and production stages cannot blend review/external/local/closeout truth or claim green/tidy/ready without verdict support. | Non-blending and closeout downgrade fixtures plus production review-state, external-state, and pr-closeout tests keep refs separate and block unsupported delivery language. |
| SA-012, SA-013, SA-014 | Root tidy, accessibility, and redaction behavior are deterministic. | Root-source, textual-status, and sensitive-payload fixtures pass and fail the named negative cases. |

## Review Plan

Required review before PR handoff:

- harness-product-code-reviewer for product code and tests if available in the active runtime.
- harness-dev-tools-reviewer if validator scripts, package scripts, or internal tooling surfaces change.
- harness-doc-history-reviewer if this plan, the source spec, root classification docs, or governance docs change.
- adversarial-reviewer or project-local equivalent for any delivery-truth or closeout claim semantics that can produce false success.

Reviewer artifact expectations:

- One report per reviewer under artifacts/reviews/.
- Severity-ranked findings with file:line evidence.
- Validation ownership classification for any reported gate failure.
- Coordinator verifies artifact existence and non-empty content before synthesis.

## Rollback Plan

Rollback is stage-local and additive:

| Unit | Rollback |
| --- | --- |
| PU-000 | Remove intent and acceptance-coverage validator modules and tests; keep plan/spec unchanged unless they contain invalid command references. |
| PU-001 | Remove src/lib/evidence additions. |
| PU-002 | Remove codex-runtime-evidence schema, classifier, and fixtures. |
| PU-003 | Remove adapter wiring and restore prior runtime-evidence-bundle behavior. |
| PU-004 | Remove runtime-card projection fields and related validation; verify existing runtime-card tests still pass. |
| PU-005 | Remove private delivery-truth module and fixtures; public behavior should be unchanged. |
| PU-006 | Remove root tidy fixtures only. |
| PU-007 | Remove redaction/accessibility fixtures only. |
| PU-008 | Remove private non-blending and closeout downgrade fixtures only. |
| PU-009 | Remove production review-state and external-state modules and restore pr-closeout imports to the previous state. |
| PU-010 | Disable delivery-truth production integration and restore prior closeout behavior while keeping false-success regression fixtures. |
| PU-011 | Revert root-hygiene claim and documentation changes; do not delete or move root artifacts destructively. |
| PU-012 | Disable the producer bridge and retain schema/adaptor validation. |
| PU-013 | Remove evidence-ingestion projection and restore prior runtime-card/harness next output contracts. |
| PU-014 | Revert closeout refresh integration and preserve negative tests for stale-state false success. |
| PU-015 | Remove audit packet integration only after documenting residual goal-closeout risk. |
| PU-016 | Revert hardening changes by file scope and keep the steering admission note as historical evidence. |

No rollback may use destructive git commands. If implementation touches shared types and rollback would affect existing runtime-card or pr-closeout behavior, stop for coordinator review before reverting.

## Risk Register

| Risk | Severity | Likelihood | Mitigation | Stop Condition |
| --- | --- | --- | --- | --- |
| Foundation work is misrepresented as full implementation | Critical | Medium | Full Lifecycle Contract and PR delivery invariant forbid implementation claims without lifecycle-stage evidence. | Any PR or closeout text claims full implementation from plan/spec/research or PU-001 through PU-008 only. |
| Foundation work grows into public delivery-truth command work too early | High | Medium | PU-005 forbids public command authority; PU-010 owns production integration. | Any public command added before private fixtures pass and PU-010 names the contract. |
| Codex source fields are inferred beyond evidence | High | Medium | PU-002 source-classification negative fixtures require unknown with failureClass. | SDK-only fixture can claim permission, PR, CI, or tracker truth. |
| Runtime-card becomes a raw evidence warehouse | High | Low | PU-004 validation rejects raw event stream and full review-body embedding. | Runtime card embeds bulky packet bodies. |
| Closeout language can still overclaim | High | Medium | PU-008 private closeout downgrade fixture blocks unsupported green/tidy/ready language. | Unsupported closeout claim can pass without current verdict. |
| Acceptance coverage becomes prose-only | High | Medium | PU-000 maps mechanically checkable SA IDs to tests, fixtures, commands, or schema assertions. | SA-017 or SA-018 marked complete without mechanical proof. |
| Dirty Codex checkout contaminates Harness implementation | Medium | Medium | Treat /Users/jamiecraik/dev/codex as read-only source evidence until PU-012; do not depend on its branch cleanliness. | Foundation work requires Codex commit, branch, or generated schema mutation. |
| Existing dirty Coding Harness work overlaps implementation | Medium | Medium | Refresh git status before he-work and preserve unrelated files. | Required file has unrelated changes that cannot be safely separated. |
| Live external state is stale during closeout | High | Medium | PU-009 and PU-014 require TTL, fetchedAt, headSha, source, and stale reason fields. | Merge-ready or delivery-ready can pass from stale PR/CI/Linear/CodeRabbit data. |
| Judge/PM audit is skipped | Critical | Low | PU-015 requires audit packet and goal gate before goal_complete. | Goal completion claim is possible without Judge/PM audit evidence. |

## Observability and Evidence

Lifecycle evidence artifacts:

- Intent artifact created by PU-000.
- Acceptance coverage report or fixture output from PU-000.
- Test output for each unit-specific vitest command.
- runtime-card --json sample output after PU-004.
- Private delivery-truth negative fixture output after PU-005 and PU-008.
- Production review-state and external-state packet outputs after PU-009.
- Production delivery-truth verdict output after PU-010.
- Root-hygiene classification receipt after PU-011.
- Codex runtime producer packet after PU-012.
- Runtime-card and harness next cockpit outputs after PU-013.
- PR/CI/review/Linear stale-state closeout packet after PU-014.
- Judge/PM audit packet after PU-015.
- Reviewer artifacts under artifacts/reviews/ before PR handoff.
- PR body session or traceability reference when a PR is opened.

Evidence classification:

| Evidence | Use | Claim Support? |
| --- | --- | --- |
| Codex SDK fixture | orientation and fixture source | no unless converted into verifier receipt |
| Codex analytics-derived fixture | stronger runtime source | only for fields explicitly present and validated |
| runtime-card/v1 | cockpit summary and pointer | no by itself for merge readiness |
| evidence-receipt/v1 | proof primitive | yes when freshness, evidenceUse, and verifier policy pass |
| delivery-truth/v1 private verdict | foundation claim semantics proof | yes for test fixtures only, not public closeout |
| review-state/v1 | review-thread and reviewer artifact truth | yes only when fresh and receipt-backed |
| external-state-snapshot/v1 | PR, CI, Linear, CodeRabbit, and source-system freshness | yes only when TTL and head SHA match verifier policy |
| delivery-truth/v1 production verdict | closeout claim support | yes when all required receipts are current and separated |
| human reviewer report | review evidence | no for deterministic claims unless paired with artifact receipt |

Production parity checkpoint:

- Before any public delivery-truth command, live closeout hook, or Codex-native producer is treated as agent-operable closeout truth, PU-010 through PU-013 must name the owner, command or hook surface, validation gate, review-state/external-state integration boundary, and rollback path.
- Production stages must include a machine-readable parity artifact proving agents can discover the authority surface, produce or fetch the verdict, cite receipt refs, and block unsupported closeout claims without human-only prose.
- JSC-363 must be updated or split if Linear should track the full lifecycle beyond the initial implementation lane.

## Visual References / Diagrams

The dependency diagram in Dependencies and Sequencing is the required visual reference. It clarifies implementation order, deep-module boundaries, and the full lifecycle completion boundary. No generated image is needed for this plan because a deterministic Mermaid diagram is more maintainable and directly reviewable.

| Visual | Location | Purpose |
| --- | --- | --- |
| Mermaid dependency graph | Dependencies and Sequencing | Shows PU-000 as the hard gate, PU-001 through PU-008 as the foundation chain, and PU-009 through PU-016 as the production verifier, Codex bridge, closeout, audit, and hardening lifecycle. |

## Accessibility and Operator Ergonomics

The implementation must keep operator outputs textual, compact, and machine-readable. Status cannot rely on color, icons, or glyphs alone. JSON outputs must include stable status strings, blocker classes, evidence refs, freshness, and head SHA fields where applicable. Human output must avoid hiding blockers behind summaries.

## Open Questions

- Should runtime-card projection use additive top-level fields or source entries only to preserve compatibility?
- Should delivery-truth remain a private library until PU-010 or expose a hidden test-only helper module during the foundation stage?
- Which Codex producer boundary should be selected for PU-012: TypeScript SDK, Python SDK, app-server protocol, analytics export, Harness wrapper, or staged combination?
- Should JSC-363 be expanded to track the full lifecycle, or should PU-009 through PU-016 become child issues after PU-000 records ownership?

None of these questions block PU-000 through PU-008 foundation implementation if PU-000 records the selected local intent and forbidden paths. PU-009 through PU-016 cannot begin until the relevant ownership and contract question is resolved in the intent artifact, Linear, or a linked spec update.

## Final Decision

Proceed to implementation only after the steering admission and PU-000 intent artifact are created and reviewed. The first implementation slice is Harness-only, fixture-first, and private-verdict-only, but it is not the full implementation. Full delivery requires PU-009 through PU-016 to promote the foundation into production review-state, external-state, delivery-truth, Codex producer, runtime cockpit, closeout, Judge/PM audit, and hardening evidence. No PR may claim full implementation, green status, ROOT tidiness, merge readiness, or goal completion until the matching lifecycle claims have current delivery-truth support.

## Appendix A. Harness Metadata / Traceability

schema_version: 1
interactive_status: complete
selection_evidence: User invoked he-plan for .harness/specs/2026-05-24-codex-runtime-evidence-verifier-cockpit-spec.md and supplied ~/dev/codex as supporting cross-repo context.
route: he-plan
stage: planning
scope: Full lifecycle implementation plan for Codex runtime evidence verifier cockpit
source: .harness/specs/2026-05-24-codex-runtime-evidence-verifier-cockpit-spec.md
plan_path: .harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md
traceability: SA-001 through SA-018 mapped to PU-000 through PU-016
validation: plan/spec artifact checks required before handoff; implementation tests listed per PU
safe_to_continue: true
blocked_reason: null
linear_action_required: true
linear_mutation_status: approved_small_set_created
post_plan_handoff:
  state: ready_for_pu_000_after_steering_admission
  selected_next_stage: PU-000
  evidence: .harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md
  next_action: Create steering admission note, update ownership if needed, then implement PU-000; do not PR planning-only work as full implementation.
blackboard_delta:
  User steering about full lifecycle scope, tight task bounds, first-class intent, pre-implementation intent review, and automation-first proof is encoded in Steering Admission, Full Lifecycle Contract, PU-000, and PU-009 through PU-016.
git_staging_status: not_staged
staged_paths: []
confidence: high_plan_confidence
confidence_basis: Source spec validated, live repo seams inspected, Codex source paths read, full lifecycle plan validation passed, final agent-native and adversarial review artifacts persisted, planning-specialist mailbox post-fix review reached 0.97, and the associated spec was patched to match the full lifecycle boundary.
confidence_ceiling: 0.94 until PU-000 intent evidence, implementation tests, production verifier integration, Codex producer evidence, external refresh proof, and Judge/PM audit gates exist.

## Appendix B. Linear / Tracker Handoff

Linear issue JSC-363 was created for the initial implementation lane under the Harness cockpit routing project and parented to JSC-328. The issue is in Triage, assigned to jscraik@brainwav.io, priority High, and labeled coding-harness, Governance, Agent-Native, Reliability, and Feature. Linear action is required before full lifecycle delivery claims: PU-000 must decide whether JSC-363 expands to the full lifecycle or whether PU-009 through PU-016 become child issues before those stages begin.

Tracker link:

- https://linear.app/jscraik/issue/JSC-363/coding-harness-implement-codex-runtime-evidence-verifier-cockpit-phase

Tracker payload summary:

- Current title needing lifecycle reconciliation: [coding-harness] Implement Codex runtime evidence verifier cockpit Phase 1
- Team/project: Jscraik / Harness cockpit routing
- Parent: JSC-328
- Acceptance: SA-001 through SA-018 are now mapped across PU-000 through PU-016; the existing Linear title may need update or child issues before production stages begin.
- Scope: PU-000 through PU-008 are Harness-only foundation work; PU-009 through PU-016 complete production verifier, Codex bridge, closeout, audit, and hardening stages.

## Appendix C. Review Outcomes

This plan should be reviewed before he-work because it controls trust-boundary and closeout-claim semantics. Minimum review coverage is planning readiness, agent-native closeout parity, adversarial false-success paths, and project-local Harness dev-tools or product-code review after implementation.

Review status at creation: coordinator-authored from source spec and live repo evidence; independent review pending.

Review swarm 2026-05-24:

- Requested reviewers: planning-specialist-agent, agent-native-reviewer, adversarial-reviewer.
- Completed artifact reports: artifacts/reviews/agent-native-reviewer.md, artifacts/reviews/adversarial-reviewer.md.
- Failed artifact verification: artifacts/reviews/planning-specialist-agent.md was missing after one retry, so planning-specialist coverage remains an explicit artifact gap. Mailbox text reported two plan-text concerns, but it is not counted as artifact evidence.
- Agent-native report required machine-verifiable intent review receipts, canonical intent artifact discoverability, and a Phase 2 parity checkpoint for live closeout authority.
- Adversarial report required intent-ordering enforcement, frozen acceptance/phase contract surfaces, and Codex source fixture provenance.
- Coordinator patch response: added canonical intent path, reviewReceiptRef requirement, intent-ordering guard, contract-freeze guard, Codex source provenance validation, Phase 2 parity checkpoint, root-classification read-only boundary, and JSC-363 ownership resolution.
- Second-pass adversarial report identified a remaining freeze bypass if the plan and spec move together in the same implementation PR.
- Coordinator second patch response: added immutable contract baseline artifact, baselineRef on the intent artifact, contract-baseline validation, and contract-freeze comparison against the pre-implementation baseline rather than only current sibling docs.
- Final adversarial report artifacts/reviews/adversarial-reviewer-final.md found no further material improvements or gaps and recorded confidence_after_patch 97.
- Agent-native rerun artifacts/reviews/agent-native-reviewer-rerun.md recorded confidence_after_patch 96 with residual risk limited to implementation-evidence, not plan text.
- Planning-specialist rerun mailbox reported confidence_after_patch 96 and no further material plan-text gaps, but no planning rerun artifact was written; this remains a documented swarm artifact coverage gap rather than completion evidence.

Full lifecycle steering admission 2026-05-24:

- Feedback signal: the user clarified that Phase 1-only planning did not satisfy the specified and implied intent for full implementation and fix.
- Root operational failure: the prior plan could pass planning review while still encoding the wrong completion horizon.
- Durable patch response: converted this artifact into a full lifecycle plan, added Steering Admission and Full Lifecycle Contract sections, added PR delivery invariants, extended work units through PU-016, and moved Judge/PM audit from out-of-scope to a gated lifecycle unit.
- Implementation note: .harness/implementation-notes/2026-05-24-runtime-evidence-full-lifecycle-steering-admission.md.

Full lifecycle review swarm 2026-05-24:

- Requested reviewers: planning-specialist-agent, agent-native-reviewer, adversarial-reviewer.
- Completed artifact reports: artifacts/reviews/agent-native-reviewer-runtime-evidence-full-lifecycle.md and artifacts/reviews/adversarial-reviewer-runtime-evidence-full-lifecycle.md.
- Failed artifact verification after one retry: artifacts/reviews/planning-specialist-agent-runtime-evidence-full-lifecycle.md. Planning-specialist mailbox review reported confidence 0.95 and identified tracker/metadata consistency findings, but mailbox text is not counted as artifact evidence.
- Agent-native report recorded confidence_after_review 96 and required issue authority mapping, agent-operable external refresh fallback classification, and claim-to-command discoverability.
- Adversarial report identified PU-000 ordering bypass for PU-009 through PU-016 paths and a fresh-looking external-state spoof path without verifier-owned fetch proof.
- Coordinator patch response: added issue authority map, claim-to-command discoverability table, widened PU-000 ordering guard to all PU-001 through PU-016 lifecycle paths, required fetchReceiptRef/artifact hash/verifier identity for external-state claim support, added blocked_external_refresh_authority fallback, added mismatched issue ID audit fixture, normalized linear_action_required to true, and marked the current Linear title as needing lifecycle reconciliation.

Final full lifecycle review round 2026-05-24:

- Agent-native final artifact: artifacts/reviews/agent-native-reviewer-runtime-evidence-full-lifecycle-final.md. Result: confidence_after_review 0.97, no further material agent-native parity or operability gaps.
- Adversarial final artifact: artifacts/reviews/adversarial-reviewer-runtime-evidence-full-lifecycle-final.md. Result: confidence_after_review 96, no remaining material adversarial findings.
- Planning-specialist final artifact: unavailable because the planning-specialist role reported read-only operation and could not persist artifacts. Mailbox post-fix check reported confidence_after_review 0.97, confirmed the linear_action_required type gap fixed, and found no further material planning gaps. This remains a coverage limitation, not a plan blocker.
- Coordinator final patch response: canonicalized frontmatter linear_action_required to boolean and moved explanatory text to linear_action_required_reason.
