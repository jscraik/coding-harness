---
schema_version: 1
artifact_id: jsc-301-route-decision-contract-coding-harness-eval
artifact_type: he-eval-report
canonical_slug: jsc-301-route-decision-contract
title: JSC-301 RouteDecision/v1 Contract Eval Report
harness_stage: he-eval-report
status: draft
date: 2026-05-11
traceability_required: true
origin: .harness/plan/2026-05-11-JSC-301-route-decision-contract-plan.md
linear_issue: JSC-301
linear_parent: JSC-300
linear_status: Todo
linear_project: Harness cockpit routing
closure_recommendation: Blocked
---

<!-- markdownlint-disable MD025 -->

# JSC-301 RouteDecision/v1 Contract Eval Report

## Table Of Contents

- [Executive Eval Summary](#executive-eval-summary)
- [Evaluated Slice](#evaluated-slice)
- [Linear Definition of Done Status](#linear-definition-of-done-status)
- [Linear Backlink Map](#linear-backlink-map)
- [Source Artifact Trace](#source-artifact-trace)
- [Planned Proof Check](#planned-proof-check)
- [Functional Validation Results](#functional-validation-results)
- [Eval Gate Matrix](#eval-gate-matrix)
- [Agentic Eval Validity](#agentic-eval-validity)
- [Side-Effect Authorization](#side-effect-authorization)
- [Domain Model Integrity Check](#domain-model-integrity-check)
- [Drift Validation](#drift-validation)
- [Architecture Integrity Check](#architecture-integrity-check)
- [Routing Determinism Check](#routing-determinism-check)
- [Context Load Check](#context-load-check)
- [Agent-Native Check](#agent-native-check)
- [Governance Simplicity Check](#governance-simplicity-check)
- [Moat Protection Check](#moat-protection-check)
- [Proof Artifacts](#proof-artifacts)
- [Failures / Regressions](#failures--regressions)
- [Linear Completion Recommendation](#linear-completion-recommendation)
- [Follow-Up Work](#follow-up-work)
- [Core / ADR Update Recommendation](#core--adr-update-recommendation)
- [Evidence & Traceability Matrix](#evidence--traceability-matrix)

## Executive Eval Summary

Status: pass for staged implementation proof; closure blocked pending accepted commit strategy.
Linear Completion Recommendation: Blocked
Primary Blockers: JSC-301 is staged but not committed because the repository hook attempts to stash an unrelated unstaged `.codex/environments/environment.toml` diff and fails on an unlink permission error. User steering is still required before closure.
Confidence: high for the RouteDecision/v1 contract implementation; medium for Linear closure readiness because no commit, PR, CI, or live Linear closure update exists yet.

## Evaluated Slice

Linear Project: Harness cockpit routing.
Linear Milestone: Not assigned in local artifact evidence.
Linear Parent Issue: JSC-300.
Linear Sub-Issues: JSC-301 active slice; JSC-302, JSC-303, JSC-304, and JSC-311 remain downstream or future work.
Refactor Program: Not applicable.
Plugin Harness Engineering Spec: Harness Engineering plugin review promoted lifecycle routing into the JSC-301 contract slice.
Affected Files/Modules: `src/lib/decision/route-decision.ts`, `src/lib/decision/route-decision.test.ts`, `.harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md`, `.harness/plan/2026-05-11-JSC-301-route-decision-contract-plan.md`, `.harness/review/2026-05-11-JSC-301-route-decision-implementation-gates.md`, `.harness/linear/coding-harness-linear-plan.md`.
Affected Workflows: Internal RouteDecision/v1 validation and advisory metadata mapping only; no public CLI or `harness next` runtime behavior change.
Related ADRs: None created for this bounded internal contract slice.
Related Core Invariants: `RouteDecision/v1` is advisory metadata; `HarnessDecision/v1` remains cockpit command authority; `targetCommand` is metadata only.

## Linear Definition of Done Status

Artifact Path: `.harness/evals/2026-05-11-JSC-301-route-decision-contract-coding-harness-eval.md`.
Definition of Done Status: Implementation proof produced; closure incomplete.
Closure Safety: Blocked until the staged JSC-301 patch is committed or an approved alternative delivery path is recorded.

## Linear Backlink Map

Linear Project: Harness cockpit routing.
Linear Milestone: Not assigned in local artifact evidence.
Linear Parent Issue: JSC-300.
Linear Sub-Issues: JSC-301, with downstream references to JSC-302, JSC-303, JSC-304, and JSC-311.
Linear Status Recommendation: Keep JSC-301 open until commit or PR evidence exists; do not close from staged implementation alone.
Proof Artifact Links: `.harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md`; `.harness/plan/2026-05-11-JSC-301-route-decision-contract-plan.md`; `.harness/review/2026-05-11-JSC-301-route-decision-contract-spec-technical-review.md`; `.harness/review/2026-05-11-JSC-301-route-decision-contract-plan-technical-review.md`; `.harness/review/2026-05-11-JSC-301-route-decision-implementation-gates.md`; this eval report.
Missing Identifiers: Commit SHA and PR URL are missing because commit is currently blocked by unrelated unstaged environment-file hook handling.
Traceability Repair: After user steering, commit the staged JSC-301 files or record the approved bypass/revert path, then update Linear or PR evidence through the approved external-mutation workflow.

## Source Artifact Trace

Linear Plan: `.harness/linear/coding-harness-linear-plan.md` includes JSC-301 future-work routing and JSC-311 follow-up context.
Refactor Program: Not applicable.
Plugin HE Spec: `.harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md`.
ADRs: None required by the current bounded internal contract evidence.
Core Invariants: `HarnessDecision` top-level authority remains unchanged; lifecycle route data is nested under `meta.lifecycleRoute`; public `harness route --json` remains out of scope.
Other Source Artifacts: `.harness/plan/2026-05-11-JSC-301-route-decision-contract-plan.md`; `.harness/review/2026-05-11-JSC-301-route-decision-contract-spec-technical-review.md`; `.harness/review/2026-05-11-JSC-301-route-decision-contract-plan-technical-review.md`; `.harness/review/2026-05-11-JSC-301-route-decision-implementation-gates.md`.

## Planned Proof Check

Promised Proof From Source Artifacts: Focused RouteDecision tests, existing HarnessDecision tests, existing `harness next` regression tests, typecheck, codestyle fast, markdownlint, simplify gate, and HE code review gate.
Proof Planned Before Implementation: yes.
Proof Produced: Focused tests passed; typecheck passed; markdownlint passed; codestyle fast passed; simplify and HE code review gates were performed and recorded.
Proof Missing: Commit SHA, PR URL, CI status, and live Linear closure update are missing.
Interpretation: The implementation proof satisfies the local contract slice, but closure proof is not complete.
Blocks Closure: yes.

## Functional Validation Results

Command or Method: `pnpm test src/lib/decision/route-decision.test.ts src/lib/decision/harness-decision.test.ts src/commands/next.test.ts`.
Result: pass, 3 files, 84 tests.
Evidence: Observed local command output after direct `$simplify` patch.
Confidence: high.
Blocks Closure: no for implementation proof.

Command or Method: `pnpm typecheck`.
Result: pass.
Evidence: Observed local command output after direct `$simplify` patch.
Confidence: high.
Blocks Closure: no for implementation proof.

Command or Method: `pnpm markdownlint .harness/review/2026-05-11-JSC-301-route-decision-implementation-gates.md .harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md .harness/plan/2026-05-11-JSC-301-route-decision-contract-plan.md .harness/linear/coding-harness-linear-plan.md`.
Result: pass, 0 errors.
Evidence: Observed local command output after direct `$simplify` patch.
Confidence: high.
Blocks Closure: no for implementation proof.

Command or Method: `bash scripts/validate-codestyle.sh --fast`.
Result: pass, including related RouteDecision tests, 1 file, 44 tests.
Evidence: Observed local command output after direct `$simplify` patch.
Confidence: high.
Blocks Closure: no for implementation proof.

Command or Method: `git commit`.
Result: blocked.
Evidence: Commit hook attempted to stash unrelated unstaged `.codex/environments/environment.toml` and failed with `error: unable to unlink old '.codex/environments/environment.toml': Operation not permitted`.
Confidence: high.
Blocks Closure: yes.

## Eval Gate Matrix

Gate: RouteDecision contract implementation.
Expected: Add typed internal RouteDecision/v1 constants, interfaces, validator, type guard, and mapper.
Actual: `src/lib/decision/route-decision.ts` is staged with the required contract and mapper helpers.
Status: pass.
Evidence: Staged diff includes `src/lib/decision/route-decision.ts`; focused tests and typecheck passed.
Confidence: high.
Blocks Closure: no.
Required Action: None for implementation proof.

Gate: Fixture and regression coverage.
Expected: Cover route ids, blocker boundaries, malformed inputs, cross-field invariants, metadata collision, unsafe shell-like text, and existing cockpit regressions.
Actual: `src/lib/decision/route-decision.test.ts` is staged with 44 related tests; the combined focused command passed 84 tests.
Status: pass.
Evidence: `pnpm test src/lib/decision/route-decision.test.ts src/lib/decision/harness-decision.test.ts src/commands/next.test.ts` passed.
Confidence: high.
Blocks Closure: no.
Required Action: None for implementation proof.

Gate: Scope boundary.
Expected: No public CLI exposure, no `src/commands/next.ts` runtime integration, no external tracker mutation.
Actual: No staged `src/commands/next.ts`, `src/lib/cli`, or `src/commands` runtime diff is present; Linear mutation is future-work planning only.
Status: pass.
Evidence: `git diff -- src/commands/next.ts src/lib/cli src/commands | wc -c` previously returned `0`; staged file list excludes command runtime files.
Confidence: high.
Blocks Closure: no.
Required Action: Keep JSC-302/JSC-304 as downstream slices.

Gate: Simplify.
Expected: Run `$simplify` and account for reuse, quality, and efficiency findings.
Actual: Direct `$simplify` pass ran three reviewer lanes; safe in-scope simplifications were applied and broader shared-validator extraction was skipped as out of scope.
Status: pass.
Evidence: `.harness/review/2026-05-11-JSC-301-route-decision-implementation-gates.md` records the direct simplify pass and post-fix validation passed.
Confidence: high.
Blocks Closure: no.
Required Action: None for JSC-301.

Gate: HE code review.
Expected: Findings-first HE review of correctness, validation proof, security posture, traceability, and closure safety.
Actual: `$he-code-review` found no blocking findings; residual downstream command-metadata risk is deferred to adapter slices.
Status: pass.
Evidence: Review summary in current session and implementation-gate artifact; focused validation passed.
Confidence: medium-high because one correctness subagent returned handshake text and was not counted as completion evidence.
Blocks Closure: no for implementation proof.
Required Action: Future adapter work must preserve target-command metadata-only posture.

Gate: Commit and closure evidence.
Expected: Local commit or equivalent approved delivery evidence before recommending Linear closure.
Actual: Commit is blocked by unrelated unstaged `.codex/environments/environment.toml` hook/stash failure.
Status: fail.
Evidence: `git commit` failed while trying to stash the unrelated environment diff.
Confidence: high.
Blocks Closure: yes.
Required Action: User must approve either `--no-verify` commit with recorded validation evidence, reverting only the unrelated environment file, or pausing staged work.

## Agentic Eval Validity

Evaluated Capability / Task: Agent implements a bounded internal TypeScript contract that converts Harness Engineering lifecycle route intent into advisory RouteDecision/v1 metadata compatible with HarnessDecision/v1.
Task Validity: valid; source spec and plan define a narrow contract-only slice.
Outcome Validity: valid for local implementation proof; not valid for Linear closure until commit or PR evidence exists.
Trajectory / Transcript Evidence: Spec, plan, direct `$simplify`, `$he-code-review`, staged diff, and validation commands were observed in the local session.
Grader Coverage: focused Vitest tests, TypeScript typecheck, markdownlint, codestyle fast, simplify review, HE code review.
Trial Policy: single local implementation trial with deterministic focused regression checks; no repeated eval trial matrix required for this internal contract slice.
Pass@k / Pass^k Reporting: not applicable; this is not a benchmarked stochastic eval.
Authorization Validator: protected external side effects were not authorized or performed; local proof artifact writing is allowed by the skill boundary.
Saturation / Maintenance Signal: future gate evidence work is tracked as JSC-311; route adapter and public CLI exposure remain downstream.
Blocks Completion: yes
Required Action: Obtain user steering for commit handling and create delivery evidence before Linear closure.

## Side-Effect Authorization

Protected Action: External tracker closure, PR creation, push, merge, or public command exposure.
User Authorization Evidence: User authorized local JSC-301 implementation and local HE gates, but did not authorize closure or external mutation in this eval-report step.
Agent Justification: Eval reporting writes a local proof artifact only.
External Party Influence: None used for closure; no external comments, approvals, pushes, merges, or tracker mutations were performed.
Validator Decision: exempt
Validator Confidence: high
Suggested Next Step: Ask user to accept commit strategy, then hand off to the approved git/Linear workflow.
Blocks Completion: no

## Domain Model Integrity Check

Conclusion: pass.
Bounded Context: `coding-harness` decision contracts under `src/lib/decision`.
Aggregate Invariants: `RouteDecision/v1` answers lifecycle route; `HarnessDecision/v1` answers cockpit action; mapper writes only additive `meta.lifecycleRoute` metadata.
Translation Evidence: `RouteDecisionStatus` reuses `HarnessDecisionStatus`; route-local blocker boundaries and failure classes remain nested and advisory.
Scenario or Test Evidence: Route fixtures cover all route ids and blocker boundaries; mapper tests verify top-level cockpit fields remain unchanged.
Confidence: high.
Blocks Completion: no for implementation proof.

## Drift Validation

Architecture Drift: Improved
Routing Drift: Improved
Context Drift: Neutral
Governance Drift: Improved
Agent-Native Drift: Improved
Moat Drift: Improved

## Architecture Integrity Check

Conclusion: pass.
Evidence: Contract stays in `src/lib/decision/route-decision.ts`; mapper is pure and additive; no command runtime file is staged.
Blocks Completion: no for implementation proof.

## Routing Determinism Check

Conclusion: pass for contract slice; downstream adapter not evaluated.
Evidence: Route ids and blocker boundaries are exported as readonly constants; validation fails closed for unsupported route ids and boundary values.
Blocks Completion: no for implementation proof.

## Context Load Check

Conclusion: pass.
Evidence: Spec, plan, review, and eval artifacts keep the RouteDecision boundary durable so future JSC-302/JSC-304 work does not need to infer intent from chat.
Blocks Completion: no

## Agent-Native Check

Conclusion: pass.
Evidence: RouteDecision/v1 produces machine-readable schema, route id, status, evidence refs, warnings, redaction classes, and blocker boundary fields.
Blocks Completion: no for implementation proof.

## Governance Simplicity Check

Conclusion: pass with follow-up separated.
Evidence: JSC-301 remains contract-only; JSC-311 captures skill-backed gate work instead of widening this slice.
Blocks Completion: no for implementation proof.

## Moat Protection Check

Conclusion: pass.
Evidence: The patch improves deterministic lifecycle routing while preserving cockpit command authority and validation evidence.
Blocks Completion: no for implementation proof.

## Proof Artifacts

Produced: Spec, plan, spec technical review, plan technical review, implementation gate artifact, staged RouteDecision source/test files, and this eval report.
Required: Commit SHA or PR URL before Linear closure.
Missing: Commit SHA, PR URL, CI status, and live Linear closure update.
Planned Before Implementation: yes.
Generated Media Cache Source: not applicable.
Repository Media Path: not applicable.
Prompt Metadata Path: not applicable.
Media Sidecar Path: not applicable.
Repository Media Exists: not applicable.
Blocks Completion: yes
Attach or Link Back to Linear: Link this eval report after commit or PR creation through the approved Linear workflow.

## Failures / Regressions

Failure or Regression: Commit blocked by unrelated unstaged `.codex/environments/environment.toml` hook/stash handling.
Evidence: `git commit` failed with an unlink permission error for `.codex/environments/environment.toml` while the JSC-301 files remained staged.
Required Corrective Action: User must approve one of the safe commit paths: commit with `--no-verify` using recorded validation evidence, revert only the unrelated environment diff and rerun gates, or pause staged work.
Follow-Up Justified: no new Linear issue for JSC-301; this is a local worktree/hook handling decision unless it repeats across branches.
Blocks Closure: yes.

## Linear Completion Recommendation

Classification: Blocked
Recommended Linear Status: Keep JSC-301 open until commit or PR proof exists.
Required Linear Comment/Update: After commit/PR, summarize RouteDecision/v1 implementation, validation commands, simplify/HE review gates, and note that JSC-311 remains future work.
Issues to Close: none yet.
Issues to Reopen: none.
Issues to Leave Open: JSC-301 until commit/PR; JSC-302, JSC-303, JSC-304, and JSC-311 remain downstream/future.
New Follow-Up Issues: none from this eval; JSC-311 already exists for skill-backed phase-exit gates.
Labels to Add/Remove: none from this eval.
Milestone Completion: not applicable.
Project Status Change: none from this eval.
Status Update Needed: yes after commit or PR proof exists.
Proof Artifacts to Attach or Link: this eval report plus commit SHA/PR URL when available.

## Follow-Up Work

Classification: Do Not Create.
Target Linear Project: Harness cockpit routing.
Parent Issue or Milestone: JSC-300.
Reason: Follow-up gate work already exists as JSC-311; adapter/public route work already exists as JSC-302/JSC-304.
Agent-Safe or Human Review Required: Agent-safe for future specs; human review required before public CLI exposure or executable route behavior.

## Core / ADR Update Recommendation

Core Update: not required for JSC-301.
ADR Update: not required for JSC-301.
Reason: The slice adds an internal advisory metadata contract without changing public CLI behavior, runtime command authority, or release policy.

## Evidence & Traceability Matrix

Conclusion: implementation proof passes; closure remains blocked pending commit strategy.
Fact: Staged files include the RouteDecision/v1 source, focused tests, spec, plan, reviews, Linear plan update, and this eval report.
Interpretation: The local implementation satisfies the JSC-301 contract-only slice.
Assumption: Current Linear status remains open/Todo until updated through approved tooling.
Evidence: `git diff --cached --stat`; focused tests; typecheck; markdownlint; codestyle fast; simplify and HE code-review gate summaries.
Affected Files/Modules: `src/lib/decision/route-decision.ts`; `src/lib/decision/route-decision.test.ts`; `.harness/**` JSC-301 artifacts.
Command or Inspection Method: Local git diff/status inspection and validation commands listed above.
Confidence: high for implementation proof; medium for closure because delivery evidence is not produced yet.
Operational Impact: Adds an internal machine-readable route contract and compatibility mapper; no public CLI behavior changes.
Blocks Completion: yes, until commit or PR evidence exists.
