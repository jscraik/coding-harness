---
schema_version: 1
artifact_id: jsc-301-route-decision-implementation-gates
artifact_type: he-code-review-implementation-gates
canonical_slug: jsc-301-route-decision-implementation-gates
title: JSC-301 RouteDecision/v1 Implementation Gates
harness_stage: he-code-review
status: pass
created_at: 2026-05-11T17:45:00+01:00
traceability_required: true
origin: src/lib/decision/route-decision.ts
linear_issue: JSC-301
linear_parent: JSC-300
linear_status: Todo
linear_project: Harness cockpit routing
review_mode: manual_artifact_after_subagent_timeout
simplify_mode: direct_skill_with_parallel_reviewers
simplify_rerun_at: 2026-05-11T18:00:37+01:00
---

# JSC-301 RouteDecision/v1 Implementation Gates

## Table Of Contents

- [Review Target](#review-target)
- [Verdict](#verdict)
- [Simplify Gate](#simplify-gate)
- [Testing-Reviewer Gate](#testing-reviewer-gate)
- [HE Code Review / Correctness Gate](#he-code-review--correctness-gate)
- [HE Fix Bugs Gate](#he-fix-bugs-gate)
- [Validation Evidence](#validation-evidence)
- [Scope Evidence](#scope-evidence)
- [Residual Risks](#residual-risks)
- [Commit Readiness](#commit-readiness)

## Review Target

Implementation files:

- `src/lib/decision/route-decision.ts`
- `src/lib/decision/route-decision.test.ts`

Planning and traceability files:

- `.harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md`
- `.harness/plan/2026-05-11-JSC-301-route-decision-contract-plan.md`
- `.harness/linear/coding-harness-linear-plan.md`
- `.harness/review/2026-05-11-JSC-301-route-decision-contract-spec-technical-review.md`
- `.harness/review/2026-05-11-JSC-301-route-decision-contract-plan-technical-review.md`

Review note:

- Subagent review gates were attempted twice and timed out or returned only instruction-handshake responses.
- This artifact records the replacement manual gate evidence requested before commit.
- `$simplify` was rerun directly through the canonical skill contract with
  three parallel reviewer lanes: code reuse, code quality, and efficiency.

## Verdict

Status: pass after simplification.

No blocker or high findings were found in the JSC-301 implementation gate pass.
The direct `$simplify` rerun found maintainability opportunities, applied the
safe in-scope fixes, and skipped one broader extraction that would widen
JSC-301 beyond the approved contract boundary.

The implementation remains aligned with the JSC-301 contract-only boundary:

- `RouteDecision/v1` is typed and advisory.
- Runtime validation fails closed for malformed route packets.
- Mapper output is nested under `HarnessDecision.meta.lifecycleRoute`.
- Existing top-level `HarnessDecision` authority fields are preserved.
- `targetCommand` remains metadata only.
- `src/commands/next.ts` and public CLI surfaces are unchanged.

## Simplify Gate

Status: pass after fixes.

Review lanes:

- Code reuse reviewer: found duplicated validator primitives and status
  allowlists that overlap existing decision/session validation helpers.
- Code quality reviewer: found duplicated lifecycle field declarations,
  repeated blocked/fail predicates, and one duplicated test fixture call.
- Efficiency reviewer: no actionable efficiency findings; noted array cloning
  allocation is acceptable for current small route payloads.

Applied fixes:

- Added an internal shared lifecycle-fields interface so `RouteDecision` and
  `HarnessDecisionLifecycleRouteMeta` do not duplicate the shared advisory
  fields.
- Reused one `isBlockedOrFail` predicate inside route consistency validation.
- Hoisted one repeated test fixture instance in the unsupported enum/schema
  validation test.

Skipped findings:

- Did not extract shared validation helpers from `harness-decision.ts`,
  `session-closeout.ts`, or a new shared module. That would modify existing
  decision/session contracts and broaden JSC-301 beyond the approved
  RouteDecision-only implementation slice. Track this as future cleanup only if
  a later decision-domain refactor admits shared validator primitives.

Reuse review:

- The implementation mirrors the local validation style used by `src/lib/decision/harness-decision.ts` without adding a new schema dependency.
- Route ids and blocker boundaries are exported once as readonly constants in `src/lib/decision/route-decision.ts`, avoiding duplicated string unions across implementation and tests.
- The mapper reuses the existing `HarnessDecision` type through type-only imports rather than redefining cockpit authority fields.

Quality review:

- Public exports have JSDoc.
- Helper functions are local and not prematurely exported.
- `Record<string, unknown>` is used for producer metadata instead of `any`.
- Collision behavior is deterministic: existing `meta.lifecycleRoute` is rejected instead of overwritten.
- The future HE gate work is separated into `JSC-311`, so JSC-301 does not accumulate unrelated gate behavior.

Efficiency review:

- Validation is simple in-memory shape checking.
- Mapper copies only small evidence arrays to avoid aliasing caller-owned arrays.
- No filesystem, network, process, or command execution paths were introduced.

## Testing-Reviewer Gate

Status: pass.

Findings: none.

Coverage reviewed:

- Non-object candidates and schema mismatch.
- Valid route id fixture coverage for every `ROUTE_DECISION_IDS` value.
- Valid blocker boundary fixture coverage for every `ROUTE_DECISION_BLOCKER_BOUNDARIES` value.
- Invalid primitive fields, route shape, arrays, and metadata shape.
- Blocked and failed status invariants.
- Pass and action-required blocker consistency.
- `human_escalation`, `none`, and mutating route cross-field invariants.
- Unsafe shell-like input stored as data/task-file evidence only.
- Mapper provenance for evidence refs, redactions, and warnings.
- Mapper rejection for invalid route input.
- Mapper immutability and metadata collision behavior.
- Existing `harness-decision` and `harness next` regression tests were included in the focused validation command.

Residual testing risk:

- `JSC-302` must add adapter-specific tests when route metadata is actually attached inside `harness next`.
- That is intentionally outside JSC-301.

## HE Code Review / Correctness Gate

Status: pass.

Findings: none.

Correctness checks:

- `validateRouteDecision` returns `{ valid, errors }` and accumulates deterministic validation messages.
- `isRouteDecision` delegates to the validator.
- `toHarnessDecisionLifecycleRouteMeta` validates input before mapping.
- `withLifecycleRouteMeta` returns a new `HarnessDecision` object and does not mutate caller-owned metadata.
- Route-local `failureClass` stays nested under lifecycle metadata and does not overwrite the cockpit-level `failureClass`.
- `safeToUse: true` is rejected for blocked or failed routes.
- Mutating routes require human review.
- `human_escalation` requires human review.
- `none` routes cannot carry target command or target skill hints.

Scope checks:

- No `src/commands/next.ts` diff exists.
- No public CLI command was introduced.
- No external tracker mutation is part of the implementation.
- HE phase-exit gate work is tracked separately in live Linear as `JSC-311`.

Security and safety checks:

- No shell execution or command parsing was introduced.
- `targetCommand` is preserved only as metadata.
- Shell-like prompt text is represented as metadata/task-file evidence in tests, not as argv.
- Redaction provenance is preserved in nested lifecycle metadata.

## HE Fix Bugs Gate

Status: not_applicable.

Reason:

- Focused tests, typecheck, markdownlint, and codestyle fast all passed.
- No failing behavior, reproduced bug, or validation error exists that would trigger `$he-fix-bugs`.

## Validation Evidence

Commands run in this pass:

- `pnpm test src/lib/decision/route-decision.test.ts src/lib/decision/harness-decision.test.ts src/commands/next.test.ts` -> pass, 3 files, 84 tests.
- `pnpm typecheck` -> pass.
- `bash scripts/validate-codestyle.sh --fast` -> pass.
- `pnpm test src/lib/decision/route-decision.test.ts --coverage.enabled false` -> pass, 1 file, 44 tests.
- `pnpm markdownlint .harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md .harness/plan/2026-05-11-JSC-301-route-decision-contract-plan.md .harness/linear/coding-harness-linear-plan.md` -> pass, 0 errors.
- `git diff -- src/commands/next.ts src/lib/cli src/commands | wc -c` -> pass, output `0`.

Commands to rerun after the direct `$simplify` patch:

- `pnpm test src/lib/decision/route-decision.test.ts src/lib/decision/harness-decision.test.ts src/commands/next.test.ts`
- `pnpm typecheck`
- `bash scripts/validate-codestyle.sh --fast`
- `pnpm markdownlint .harness/review/2026-05-11-JSC-301-route-decision-implementation-gates.md .harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md .harness/plan/2026-05-11-JSC-301-route-decision-contract-plan.md .harness/linear/coding-harness-linear-plan.md`

## Scope Evidence

Allowed JSC-301 implementation files:

- `src/lib/decision/route-decision.ts`
- `src/lib/decision/route-decision.test.ts`

Allowed JSC-301 artifact files:

- `.harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md`
- `.harness/plan/2026-05-11-JSC-301-route-decision-contract-plan.md`
- `.harness/review/2026-05-11-JSC-301-route-decision-contract-spec-technical-review.md`
- `.harness/review/2026-05-11-JSC-301-route-decision-contract-plan-technical-review.md`
- `.harness/review/2026-05-11-JSC-301-route-decision-implementation-gates.md`

Linear planning artifact updated for future work:

- `.harness/linear/coding-harness-linear-plan.md`

Explicitly unchanged by JSC-301 implementation:

- `src/commands/next.ts`
- `src/lib/cli/**`
- public CLI registry surfaces

## Residual Risks

| Risk | Handling |
| --- | --- |
| Adapter refresh/idempotency may need a richer lifecycle metadata history model. | Deferred to `JSC-302`; JSC-301 rejects collisions deterministically. |
| Public `harness route --json` may need a stricter external schema. | Deferred to `JSC-304`; no public command is introduced here. |
| Skill-backed commit gates need typed evidence before they become real stop rules. | Tracked as live Linear issue `JSC-311`; not part of JSC-301. |

## Commit Readiness

Status: ready after validation rerun.

The JSC-301 implementation and direct `$simplify` replacement review gates pass.
The local commit must include only the JSC-301 files and must leave the
unrelated `.codex/environments/environment.toml` diff unstaged unless separately
approved.
