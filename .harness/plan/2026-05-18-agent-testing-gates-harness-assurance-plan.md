---
schema_version: 1
title: Agent Testing Gates Harness Assurance Plan
artifact_type: he-plan
status: active
date: 2026-05-18
plan_id: agent-testing-gates-harness-assurance
linear_issue: JSC-331
linear_issue_url: https://linear.app/jscraik/issue/JSC-331/coding-harness-add-apparatus-verifier-persona-lens
linear_parent: JSC-327
related_linear_issue: JSC-308
source_spec: docs/agents/agent-testing-gates-operational-spec.md
owner: coding-harness-maintainers
risk: medium
---

# Agent Testing Gates Harness Assurance Plan

## Command Summary

Deepen the harness testing-gates contract into an implementation plan that
keeps unit, boundary, mock integration, E2E, security, load/stress, and
lifecycle closeout coverage distinct.

## Objective

Make the harness assurance model executable enough that future agents can add
or review harness behavior without flattening all test evidence into "green
checks." The plan should preserve strong existing unit, mock integration, E2E,
and security coverage while turning boundary, load/stress, and lifecycle
closeout gaps into named work units.

## Source Contract

Source spec: `docs/agents/agent-testing-gates-operational-spec.md`

Mapped acceptance:

| Source ID | Plan unit |
|-----------|-----------|
| FR-001 | PU-001, PU-002, PU-003, PU-004, PU-005, PU-006, PU-007 |
| FR-002 | PU-001, PU-007 |
| FR-003 | PU-002, PU-003, PU-004, PU-005, PU-006 |
| FR-004 | PU-007 |
| SA-001 | PU-005 |
| SA-002 | PU-004, PU-005, PU-007 |
| SA-003 | PU-004, PU-005 |
| VAC-001 | PU-001 |
| VAC-002 | PU-001 |

## Scope and Boundaries

Allowed path:

- `docs/agents/agent-testing-gates-operational-spec.md`
- `docs/agents/10-agent-testing-gates.md`
- `.harness/plan/2026-05-18-agent-testing-gates-harness-assurance-plan.md`
- Future implementation slices under `src/commands/**`, `src/lib/**`,
  `e2e/**`, and `scripts/**` only when a matching PU explicitly requires
  code changes.

Forbidden path:

- Do not edit unrelated dirty files on the current PR branch.
- Do not replace `pnpm check` or `bash scripts/verify-work.sh` as the
  aggregate readiness contract.
- Do not add external-system mutation to local tests when fixture-backed proof
  is sufficient.
- Do not delete E2E, security, or stress lanes to make validation pass.

## Current State / Evidence

- Unit coverage is strong through broad `src/**/*.test.ts` and command tests.
- Boundary coverage exists but is diffuse; many tests assert failure behavior
  without a single harness assurance taxonomy.
- Mock integration coverage is strong across command and adapter tests, but new
  adapters must keep outbound calls fixture-backed unless intentionally E2E.
- E2E coverage exists under `e2e/**` and artifact runners, but remains
  credential-gated.
- Security coverage exists through audit, secrets, Semgrep/Snyk/CircleCI, and
  security-focused tests; misuse taxonomy must remain explicit.
- Load/stress is partial through overload, performance, and throughput tests.
- Lifecycle closeout is partial and now governed by repeated-steering and stale
  heartbeat rules.

## Implementation Strategy

Keep this slice documentation-first. Use the spec and operator docs to pin the
acceptance model, then implement future test slices only where changed harness
behavior touches a layer. Start with boundary and load/stress because they are
the highest-signal gaps. Keep E2E and security credential blockers explicit
instead of converting them into local green claims.

## Enforcement Contract

- essential_decisions: Harness assurance is a seven-layer matrix, not one
  aggregate pass/fail result.
- fillable_gaps: A layer can be `n.a.` only when the touched behavior does not
  exercise that layer and the reason is recorded.
- guardrails: `pnpm check`, `bash scripts/validate-codestyle.sh --fast`,
  `pnpm test:deep`, and `pnpm run docs:steering:guard` remain the command
  controls for aggregate, fast, runtime/artifact, and meta-behavior proof.
- refusal_triggers: Refuse completion if a required layer is unobserved, if
  E2E/security/stress claims lack matching evidence, or if PR/heartbeat closeout
  skips live-state classification.
- durable_memory: Repeated steering and stale heartbeat cleanup rules are stored
  in `.harness/memory/LEARNINGS.md` and solution docs when durable.
- professional_output: Handoff reports each layer as pass, partial, blocked, or
  n.a. with exact command evidence and follow-up owner when needed.

## Artifact Handling Routine

Route-driving `.harness` artifacts must pass this routine before they can steer
implementation:

Command:

- Source checkout:
  `node --import tsx src/cli.ts artifact-routine --active-index .harness/active-artifacts.md --json`
- Installed package:
  `harness artifact-routine --active-index .harness/active-artifacts.md --json`

- linear_owner: every active spec or plan has a live `linear_issue`, or an
  explicit `linear_status: local_only` exception with owner and reason.
- tracked_state: every active artifact is tracked, or intentionally untracked
  with an owner, reason, and next action in `.harness/active-artifacts.md`.
- reference_integrity: every referenced spec, plan, eval, review, or media path
  exists, or is classified as `missing_historical`, `superseded`, or
  `external_only` with a next owner.
- stale_frontmatter_guard: historical specs/plans whose Linear issue is Done or
  archived cannot route work from `status: draft`; the active index must name
  them historical or superseded.
- closeout_refresh: any live Linear mutation, PR merge, or route-driving plan
  change refreshes `.harness/active-artifacts.md` before handoff.
- runtime_boundary: ignored runtime outputs under `artifacts/**` stay separate
  from durable `.harness` planning, evidence, and route-selection artifacts.

The current Linear owner for this routine is `JSC-331`. `JSC-308` remains
related broader HE process-exhaust and artifact-policy context, not the
coding-harness tracker for this assurance slice.

## Goal Governance Contract

This plan is the active board source for the native Codex goal:

> Complete the JSC-331 Coding Harness artifact-handling and assurance plan using
> he-phase-work, with the mandatory review stack, durable plan/index updates,
> focused validation, and no Linear or git mutation without explicit approval.

Goal continuation must follow `$goal-governor` and `$he-phase-work`:

- reconcile native goal status, this plan, `.harness/active-artifacts.md`, the
  current branch, dirty worktree state, and live JSC-331/JSC-308 read state
  before implementation;
- keep exactly one active phase unless Jamie explicitly authorizes parallel
  Workers with disjoint allowed files;
- require each active Worker handoff to declare `allowed_files`, `verify`,
  and `stop_if`;
- recover stale, missing, red, or blocked validation evidence before feature
  continuation;
- ask before Linear mutation, staging, commit, push, PR creation, merge,
  closure, or heartbeat mutation;
- treat Linear write-tool failures as `blocked_linear_write_unsupported` and
  continue only with local evidence plus proposed tracker text;
- stop with `blocked_review_stack_incomplete` if mandatory review evidence is
  missing, mailbox-only, or not artifact-backed where required.

## Work Units

| ID | Source | Work | allowed path | forbidden path | validation | stop condition | rollback | handoff |
|----|--------|------|--------------|----------------|------------|----------------|----------|---------|
| PU-001 | FR-001, FR-002, VAC-001, VAC-002 | Land the spec, operator matrix, and this plan. | `docs/agents/agent-testing-gates-operational-spec.md`; `docs/agents/10-agent-testing-gates.md`; this plan | unrelated dirty branch files | shape checker, `pnpm run docs:lint`, `pnpm run docs:steering:guard` | all docs checks pass or blocker recorded | remove only new assurance sections and plan | changed docs plus validation outcomes |
| PU-002 | FR-001, FR-003 | Add boundary tests that assert named blocker or policy classes. | `src/commands/*.test.ts`; `src/lib/**/*.test.ts` | production rewrites unrelated to boundary classification | targeted Vitest, `pnpm run quality:self-affirming`, `pnpm run test:related` when production changes | named blocker class asserted | restore previous blocker behavior with compatibility note | files, blocker classes, test commands |
| PU-003 | FR-001, FR-003 | Keep external adapters fixture-backed or mocked outside E2E. | adapter tests, command fixtures, process-runner tests | unmanaged real GitHub/Linear/CircleCI/CodeRabbit/Snyk mutation | targeted adapter tests, `pnpm check` before merge | outbound calls mocked or classified E2E | restore last fixture and keep failing sample | adapter contract evidence |
| PU-004 | FR-001, FR-003, SA-002, SA-003 | Preserve credential-gated E2E scenarios and artifact result classification. | `e2e/**`; `scripts/test-with-artifacts.sh`; artifact docs | deleting E2E lanes to avoid blockers | `pnpm run test:e2e` or blocked reason; `pnpm run test:artifacts:e2e` when wrapper artifact proof is required | terminal pass or classified blocker in runner-owned `artifacts/e2e/result.json` or wrapper-owned `artifacts/test/summary-e2e.json` plus `artifacts/test/test-output-e2e.log` | disable only scenario behind tracked blocker | E2E result path or blocker owner |
| PU-005 | FR-001, FR-003, SA-001, SA-002, SA-003 | Make security and misuse tests fail closed with named policy reasons. | security tests, policy-gate fixtures, audit/secrets docs | exposing secrets or weakening policy gates | targeted security tests, `pnpm audit`, `pnpm run secrets:staged`, CI security evidence | unsafe sample refused with named reason | revert unsafe allowance and keep sample | security command evidence |
| PU-006 | FR-001, FR-003 | Add bounded load, stress, or throughput assertions where harness runtime behavior changes. | existing overload, performance, throughput tests; future `test:stress` script | making expensive stress required for all docs-only changes | targeted stress/performance tests with numeric thresholds, `pnpm test:deep` for runtime/artifact changes | bounded duration, output, throughput floor, or degradation budget asserted with explicit threshold | move expensive check to opt-in lane with documented pass condition | stress metric and threshold |
| PU-007 | FR-002, FR-004, SA-002 | Prove lifecycle closeout before completing PR or heartbeat lanes. | PR closeout tests, automation docs, solution docs, `.harness/memory/LEARNINGS.md` | deleting heartbeats without stop-condition proof | targeted closeout tests when code changes, `pnpm run docs:steering:guard` for policy changes | PR/branch/Linear/review/automation/next-lane state observed or `Unobserved Horizon` recorded | restore heartbeat only with live owner/blocker evidence | closeout matrix and follow-up owner |

## Validation Gates

For this documentation/spec pass:

- `rg -n "AC-HAG|FR-|SA-|VAC-|essential_decisions|refusal_triggers" docs/agents/agent-testing-gates-operational-spec.md .harness/plan/2026-05-18-agent-testing-gates-harness-assurance-plan.md`
- `python3 "$HARNESS_ENGINEERING_SKILL_DIR/scripts/check_generated_artifact_shape.py" docs/agents/agent-testing-gates-operational-spec.md --kind spec --json`
- `python3 "$HARNESS_ENGINEERING_SKILL_DIR/scripts/check_generated_artifact_shape.py" .harness/plan/2026-05-18-agent-testing-gates-harness-assurance-plan.md --kind plan --json`
- `pnpm run docs:lint`
- `pnpm run docs:steering:guard`
- `bash scripts/validate-codestyle.sh --fast`

For future code work, run the PU-specific validation and widen to `pnpm check`
or `pnpm test:deep` when runtime, artifact, or security behavior changes.
Set `HARNESS_ENGINEERING_SKILL_DIR` to the local harness-engineering skill root
before running the external shape checker; if the skill is unavailable, record
the checker as blocked and run the repo-local gates that still apply.

## Review Plan

### Mandatory Review And Hardening Phase

The plan is not complete until the review stack has either passed, produced
fixes that were rerun through validation, or produced explicit blocked/tracked
follow-ups with artifact evidence.

Run this bounded review stack after each meaningful implementation slice and
before final closeout when code, tests, instructions, plans, gates, or
artifact-handling behavior changed:

1. `$he-code-review`
   - Mode: `review-only` unless Jamie explicitly authorizes repair/autofix.
   - Scope: current diff, this plan, JSC-331, related JSC-308 context,
     validation evidence, and changed artifact-handling surfaces.
   - Purpose: find introduced risk, missing traceability, weak validation
     proof, unsafe closure claims, stale Linear/spec/plan linkage, and blockers
     that should be fixed rather than reported.
   - Output: severity-ranked findings first, exact `file:line` evidence,
     remediation, and verdict.
   - If the verdict is `request_changes`, `autofix_candidate`, or
     `non_mutating_action_plan`, route back to `he-work` before proceeding.
2. `@testing-reviewer`
   - Spawn only after an implementation diff exists.
   - Scope: changed source, changed tests, artifact-handling checks,
     command/gate behavior, and new plan/index validation.
   - Required artifact: `artifacts/reviews/testing-reviewer.md`.
   - Artifact content: missing test coverage, weak assertions,
     implementation-coupled tests, untested failure modes, and the smallest
     proving test/gate.
   - The artifact must end with
     `WROTE: artifacts/reviews/testing-reviewer.md`.
   - The coordinator, per `UBIQUITOUS_LANGUAGE.md`, must verify
     `artifacts/reviews/testing-reviewer.md` exists and is non-empty, retry once
     via automated artifact-write request, else mark `testing-reviewer` failed
     and record the coverage gap.
3. `$simplify`
   - Scope: current diff only.
   - Purpose: behavior-preserving cleanup, dedupe, naming clarity, helper reuse,
     and test tightening.
   - Do not broaden into architecture redesign.
   - Do not remove code without reference/import evidence and behavior proof.
   - Output: actions taken, skipped items, equivalence evidence, and validation
     commands.
4. `$unslopify`
   - Scope: targeted stale/dead/sloppy artifacts related to this plan only:
     stale `.harness` routes, orphaned artifact references, unused or duplicated
     artifact-handling code, stale front matter or Linear ownership metadata,
     and obsolete generated/reference artifacts touched by the active slice.
   - Purpose: build a cleanup ledger before edits.
   - Do not run broad repo-wide deletion passes.
   - Do not delete dynamic entry points, generated projections, public APIs,
     migrations, or runtime mirrors without explicit approval.
   - Output: cleanup ledger with each item classified as `implement_now`,
     `needs_human_review`, `out_of_scope`, `no_action`, or
     `tracked_follow_up`.
5. `$improve-codebase-architecture`
   - Use the coding-harness project-local architecture lens when available.
   - Scope: changed modules/surfaces and their direct callers, tests, and docs.
   - Purpose: catch repeated-failure shapes: same fix needed in multiple places,
     shallow/pass-through guard modules, scattered policy glue, missing shared
     interfaces for artifact checks, or unclear ownership between plan, Linear,
     gate, and `.harness/active-artifacts.md`.
   - Return candidates first unless this plan already authorizes the refactor.
   - Output: complexity symptoms, files/evidence, patch design vs interface
     design, recommended first move, tracer proof, and decision surface.
   - High-confidence local deepening moves that remove repeated manual glue and
     stay inside the active phase route back to `he-work`; larger opportunities
     become tracked follow-ups.
6. `$ubiquitous-language`
   - Scope: this plan, `.harness/active-artifacts.md`, changed command/docs
     text, and `UBIQUITOUS_LANGUAGE.md`.
   - Purpose: verify overloaded phrases such as "artifact routine",
     "route-driving artifact", "active artifact index", "review stack", and
     "done" have canonical definitions, aliases, and prompt translations where
     they affect execution.
   - Output: glossary changes or explicit no-change rationale, plus the
     validation command that proves `AGENTS.md` still points at the glossary.

Review synthesis rules:

- Do not treat green validation as sufficient when a review reports missing
  behavior proof, missing traceability, or unsafe closure state.
- Classify every review finding as `fixed_now`, `intentionally_unchanged`,
  `blocked`, `tracked_follow_up`, or `false_positive` with evidence.
- Any repeated pattern found in two or more places triggers a
  pattern-generalization pass: infer the rule, search sibling
  code/tests/docs/templates/skills/gates, update the shared pattern or matching
  siblings, and list intentionally unchanged siblings with reasons.
- Any blocker, warning, risk, flaky command, stale instruction, or validation
  weakness found in a touched required surface should be fixed in the same pass
  unless outside authority, credential-bound, destructive, or explicitly tracked
  as an exception.

Final closeout must include:

```yaml
review_stack:
  he_code_review:
    status: pass|request_changes|blocked|not_applicable
    verdict: approve|request_changes|autofix_candidate|non_mutating_action_plan|follow_up_lane
    findings_fixed: []
    findings_deferred: []
  testing_reviewer:
    status: pass|blocked|failed_artifact_verification|not_applicable
    artifact: artifacts/reviews/testing-reviewer.md
    coverage_gaps: []
  simplify:
    status: pass|changed|blocked|not_applicable
    actions: []
    skipped: []
  unslopify:
    status: pass|changed|blocked|not_applicable
    cleanup_ledger: []
  improve_codebase_architecture:
    status: pass|candidate_found|blocked|not_applicable
    recommended_first_move: text
    tracked_followups: []
pattern_generalization:
  triggered: true|false
  principle: text
  sibling_searches: []
  siblings_changed: []
  siblings_left_unchanged: []
  reason: text
```

## Rollback Plan

- Documentation rollback: remove the assurance sections and this plan while
  preserving unrelated branch work.
- Test implementation rollback: revert only the failing PU slice and keep the
  failing example as a skipped or blocked regression case with owner and reason.
- Closeout rollback: restore automation only with live evidence that the lane is
  still open and has a waiting owner or blocker.

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Boundary tests assert generic errors | False confidence | Require named blocker or policy class in PU-002 |
| Load/stress remains partial | Runtime bottlenecks can hide | Prioritize PU-006 after documentation pass |
| E2E credentials unavailable | Full-path proof blocked | Record blocker and nearest local validation |
| Dirty branch work overlaps | Accidental revert risk | Limit edits to allowed paths and report scope |
| Lifecycle closeout skipped | Stale heartbeats waste tokens | Enforce PU-007 and stale-heartbeat learned fix |

## Visual References / Diagrams

| Assurance family | Units | Primary proof |
|------------------|-------|---------------|
| Logic | PU-002 | Unit and boundary tests |
| Interaction | PU-003, PU-004 | Mock integration and E2E tests |
| Safety | PU-005 | Security and policy refusal tests |
| Operations | PU-006, PU-007 | Stress metrics and lifecycle closeout evidence |

## Final Decision

Proceed with the documentation/spec pass now. Treat PU-002 and PU-006 as the
next implementation priorities because they address the weakest current harness
coverage posture. Do not claim the harness is fully covered until the handoff
classifies all seven layers with evidence or explicit blockers.

## Implementation Receipt

Implemented PU-002, PU-006, and PU-007 in the current phase:

- Seven-layer completeness proof: `src/lib/harness-assurance.ts` rejects
  matrices that omit any required harness assurance layer.
- PU-002 boundary proof: `src/lib/harness-assurance.test.ts` asserts named
  blocker classes for missing evidence, missing reason, and missing follow-up.
- PU-006 load/stress proof: `src/lib/harness-assurance.ts` rejects
  load/stress pass claims unless a finite numeric threshold with non-blank
  metric/unit and an allowed operator is present.
- PU-007 lifecycle closeout proof: `src/lib/harness-assurance.ts` rejects
  lifecycle closeout pass claims unless PR, merge, branch/worktree, Linear,
  review-thread, automation, and next-lane state are present; it also rejects
  pass claims that admit an `Unobserved Horizon`.

Targeted validation run:

- `pnpm vitest run src/lib/harness-assurance.test.ts` -> pass (1 file, 13
  tests).
- `pnpm check` -> pass.
