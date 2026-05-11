---
schema_version: 1
artifact_id: jsc-301-route-decision-contract-plan
artifact_type: he-plan
canonical_slug: jsc-301-route-decision-contract
title: JSC-301 RouteDecision/v1 Contract Plan
harness_stage: he-plan
status: draft
date: 2026-05-11
traceability_required: true
origin: .harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md
linear_issue: JSC-301
linear_parent: JSC-300
linear_status: Todo
linear_project: coding-harness
risk: lifecycle-routing-contract
depth: deep
ui: false
linear_mutation_status: already_linked
linear_action_required: none
future_work_linear_issue: JSC-311
---

# JSC-301 RouteDecision/v1 Contract Plan

## Table Of Contents

- [Plan Decision](#plan-decision)
- [Stage Context](#stage-context)
- [Source Authority](#source-authority)
- [Linear Work Item Contract](#linear-work-item-contract)
- [Scope Guardrails](#scope-guardrails)
- [Implementation Decision Record](#implementation-decision-record)
- [Implementation Units](#implementation-units)
- [Detailed API Contract](#detailed-api-contract)
- [Validation Error Contract](#validation-error-contract)
- [IU-301-001 Route Decision Type Contract](#iu-301-001-route-decision-type-contract)
- [IU-301-002 Route Decision Validator](#iu-301-002-route-decision-validator)
- [IU-301-003 Cockpit Metadata Mapper](#iu-301-003-cockpit-metadata-mapper)
- [IU-301-004 Fixture And Regression Tests](#iu-301-004-fixture-and-regression-tests)
- [Implementation Checklist](#implementation-checklist)
- [Ownership](#ownership)
- [Phase Admission Rules](#phase-admission-rules)
- [Validation Gates](#validation-gates)
- [Observability And Evidence](#observability-and-evidence)
- [Rollback And Stop Rules](#rollback-and-stop-rules)
- [Review Gates](#review-gates)
- [Linear / Spec / Plan / PR Traceability](#linear--spec--plan--pr-traceability)
- [Future Work: HE Phase-Exit Gate Contracts](#future-work-he-phase-exit-gate-contracts)
- [Acceptance Traceability](#acceptance-traceability)
- [Test Scenarios](#test-scenarios)
- [Assumptions And Unknowns](#assumptions-and-unknowns)
- [Post-Plan Handoff](#post-plan-handoff)
- [Blackboard Delta](#blackboard-delta)

## Plan Decision

This plan admits one bounded implementation slice:

`JSC-301` / `RouteDecision/v1 contract and cockpit compatibility mapping`.

The implementation is a pure TypeScript contract slice. It may add one
production module and one focused test module. It must not wire lifecycle
routing into `harness next`, expose a public `harness route --json` command,
change CLI registry behavior, mutate external trackers, or implement resume and
automation loops.

The plan is intentionally deep because this contract creates a boundary between
two control planes:

- `RouteDecision/v1`: advisory lifecycle stage and route evidence.
- `HarnessDecision/v1`: cockpit action, command, and stop-condition authority.

The smallest proof-producing slice is contract plus tests, not runtime
integration.

## Stage Context

```yaml
schema_version: 1
stage_context:
  selected_stage: he-plan
  selected_slice: "JSC-301 RouteDecision/v1 contract and cockpit compatibility mapping"
  slice_status: resolved
  tracker_status: already_linked
  artifact_identity_status: pass
  artifact_route_status: pass
  spec_review_status: pass_after_revision
  evidence_freshness: repo_sources_fresh_linear_status_from_recent_creation
  domain_skill_status: coding_harness
  steering_status: not_needed
  validation_status: pass_for_artifacts
  blocker: null
```

## Source Authority

Primary authorities:

| Source | Role |
| --- | --- |
| `.harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md` | Approved behavior contract and acceptance source. |
| `.harness/review/2026-05-11-JSC-301-route-decision-contract-spec-technical-review.md` | Technical review gate and repaired ambiguity record. |
| `src/lib/decision/harness-decision.ts` | Existing cockpit decision contract and validation pattern. |
| `src/lib/decision/harness-decision.test.ts` | Existing decision validation test style and helper patterns. |
| `src/commands/next.ts` | Current `harness next` producer; source evidence only for this slice. |
| `src/commands/next.test.ts` | Existing cockpit behavior regression surface. |
| `docs/specs/2026-05-02-feat-agent-native-cockpit-control-loop-spec.md` | Existing `failureClass` and `blockerBoundary` design context. |

Secondary context:

- Harness Engineering plugin review findings that promoted lifecycle routing
  from eval doctrine into a runtime-compatible contract.
- Live Linear issue topology already created for `JSC-300` through `JSC-304`.

Do not expand scope from secondary context unless the spec is revised first.

## Linear Work Item Contract

| Field | Value |
| --- | --- |
| Workspace/team | `Jscraik` / `JSC` |
| Project | `coding-harness` |
| Parent issue | `JSC-300` |
| Active child issue | `JSC-301` |
| Downstream blocked issues | `JSC-302`, `JSC-303`, `JSC-304`, `JSC-311` |
| Execution route | `he-work` after this plan |
| First active unit | `IU-301-001` |
| Linear mutation status | `already_linked` |
| Linear action required | `none` |

This plan does not create or update Linear. Refresh live Linear before PR
handoff if implementation continues in a later turn.

## Scope Guardrails

In scope:

- Add `src/lib/decision/route-decision.ts`.
- Add `src/lib/decision/route-decision.test.ts`.
- Reuse `HarnessDecisionStatus` and `HarnessDecision` types through type-only
  imports.
- Add exported constants, types, validator, and pure mapper helpers.
- Add focused tests for validation, cross-field invariants, unsafe input, and
  metadata collision behavior.

Out of scope:

- `src/commands/next.ts` runtime integration.
- CLI registry changes.
- `harness route --json`.
- Resume, heartbeat, automation-runbook, or recurring automation execution.
- Generated downstream skill/package surfaces.
- GitHub, Linear, CircleCI, CodeRabbit, or PR mutation.
- Broad refactors of `HarnessDecision` validation.

## Implementation Decision Record

| Decision | Choice | Rationale | Revisit trigger |
| --- | --- | --- | --- |
| Validation style | Return `{ valid, errors }` and accumulate deterministic string errors. | Matches `validateHarnessDecision` and keeps callers from needing exception handling for untrusted packets. | Revisit only if repo adopts a schema runtime. |
| Type guard | Add `isRouteDecision(value: unknown): value is RouteDecision`. | Mirrors `isHarnessDecision` and gives downstream adapter code a narrow path. | Revisit if helper is unused after `JSC-302`. |
| Shared boundary vocabulary | Export canonical route id and blocker-boundary constants, then derive types from those constants. | Prevents validator, mapper, tests, and later cockpit adapters from forking recovery taxonomy strings. | Revisit only if a broader cockpit blocker taxonomy module is introduced. |
| Mapper invalid route behavior | Throw deterministic `Error` for invalid route input. | Mapper is a programmer-facing helper; untrusted packets should pass through validation first. | Revisit if adapter needs non-throwing batch behavior. |
| Mapper collision behavior | Throw deterministic `Error` when `decision.meta.lifecycleRoute` already exists. | Prevents silent metadata overwrite and forces explicit replacement/history design later. | Revisit in `JSC-302` if adapter needs route refresh semantics. |
| Metadata mutability | Return a new `HarnessDecision` object and preserve input objects. | Makes tests simple and avoids hidden mutation of caller-owned decisions. | Revisit only if performance data proves cloning is too costly. |
| `targetCommand` posture | Keep field but treat as metadata-only. | Preserves future expert route intent without creating command authority. | Revisit before `JSC-304` public command exposure. |
| Redaction provenance | Preserve `redactionsApplied` in the lifecycle metadata envelope. | Downstream adapters must be able to distinguish sanitized evidence from unknown redaction state. | Revisit only if redaction provenance moves into a shared evidence envelope. |

## Implementation Units

| Unit | Title | Acceptance IDs | Expected output | Agent-safe | Human review |
| --- | --- | --- | --- | --- | --- |
| `IU-301-001` | Route decision type contract. | `SA-301-001`, `SA-301-003`, `SA-301-009`, `SA-301-012` | `src/lib/decision/route-decision.ts` with exported constants/types/interfaces. | Yes | No |
| `IU-301-002` | Route decision validator. | `SA-301-002`, `SA-301-007`, `SA-301-008`, `SA-301-013` | Runtime validation helper with deterministic error messages. | Yes | No |
| `IU-301-003` | Cockpit metadata mapper. | `SA-301-004`, `SA-301-006`, `SA-301-010`, `SA-301-014` | Pure metadata mapper that preserves top-level `HarnessDecision` fields. | Yes | No |
| `IU-301-004` | Fixture and regression tests. | `SA-301-002` through `SA-301-014` | Focused test coverage plus existing decision/next regression checks. | Yes | Review if tests reveal `next` coupling |

All four units may be implemented in one small PR if the diff stays limited to
the two planned files and validation remains focused. Split before coding if
any unit pressures `src/commands/next.ts` or public CLI behavior.

## Detailed API Contract

`src/lib/decision/route-decision.ts` must expose the following public API unless
implementation testing reveals a blocker and this plan is revised before
handoff:

```ts
export const ROUTE_DECISION_SCHEMA_VERSION = "route-decision/v1" as const;

export type RouteDecisionStatus = HarnessDecisionStatus;

export const ROUTE_DECISION_IDS = [
	"review",
	"fix",
	"tdd",
	"heartbeat",
	"spec",
	"plan",
	"work",
	"human_escalation",
	"none",
] as const;

export type RouteDecisionId = (typeof ROUTE_DECISION_IDS)[number];

export const ROUTE_DECISION_BLOCKER_BOUNDARIES = [
	"none",
	"git_state",
	"network",
	"permission",
	"approval_required",
	"test_failure",
	"lint_failure",
	"missing_file",
	"timeout",
	"route_ambiguous",
	"source_unavailable",
	"contract_invalid",
] as const;

export type RouteDecisionBlockerBoundary =
	(typeof ROUTE_DECISION_BLOCKER_BOUNDARIES)[number];

export interface RouteDecisionValidationResult {
	valid: boolean;
	errors: string[];
}

export interface RouteDecision {
	schemaVersion: typeof ROUTE_DECISION_SCHEMA_VERSION;
	producer: string;
	status: RouteDecisionStatus;
	route: {
		id: RouteDecisionId;
		label: string;
		targetCommand: string | null;
		targetSkill: string | null;
	};
	sourcePath: string | null;
	safeToUse: boolean;
	requiresHuman: boolean;
	requiresNetwork: boolean;
	mutates: boolean;
	failureClass: string | null;
	blockerBoundary: RouteDecisionBlockerBoundary;
	evidenceRef: string[];
	redactionsApplied: string[];
	warnings: string[];
	meta?: Record<string, unknown>;
}

export interface HarnessDecisionLifecycleRouteMeta {
	schemaVersion: typeof ROUTE_DECISION_SCHEMA_VERSION;
	advisory: true;
	routeId: RouteDecisionId;
	routeStatus: RouteDecisionStatus;
	targetCommand: string | null;
	targetSkill: string | null;
	sourcePath: string | null;
	safeToUse: boolean;
	requiresHuman: boolean;
	requiresNetwork: boolean;
	mutates: boolean;
	failureClass: string | null;
	blockerBoundary: RouteDecisionBlockerBoundary;
	evidenceRef: string[];
	redactionsApplied: string[];
	warnings: string[];
}

export function validateRouteDecision(
	value: unknown,
): RouteDecisionValidationResult;

export function isRouteDecision(value: unknown): value is RouteDecision;

export function toHarnessDecisionLifecycleRouteMeta(
	routeDecision: RouteDecision,
): HarnessDecisionLifecycleRouteMeta;

export function withLifecycleRouteMeta(
	decision: HarnessDecision,
	routeDecision: RouteDecision,
): HarnessDecision;
```

Non-exported helpers may mirror the current `harness-decision.ts` local helper
style:

- `isRecord`.
- `validateString`.
- `validateNullableString`.
- `validateBoolean`.
- `validateEnum`.
- `validateStringArray`.
- `validateRouteConsistency`.

Do not export helper internals unless tests or downstream adapter work prove a
real need.

## Validation Error Contract

The validator should use deterministic, assertion-friendly messages. The exact
wording may vary during implementation, but the tests must lock the final
strings before handoff.

Recommended messages:

| Case | Recommended error |
| --- | --- |
| Non-object candidate | `route decision must be an object` |
| Wrong schema | `schemaVersion must be route-decision/v1` |
| Blank producer | `producer must be a non-empty string` |
| Unsupported status | `status must be pass, fail, blocked, or action_required` |
| Invalid route object | `route must be an object` |
| Unsupported route id | `route.id must be one of review, fix, tdd, heartbeat, spec, plan, work, human_escalation, none` |
| Blank route label | `route.label must be a non-empty string` |
| Invalid target command | `route.targetCommand must be a non-empty string or null` |
| Invalid target skill | `route.targetSkill must be a non-empty string or null` |
| Invalid source path | `sourcePath must be a non-empty string or null` |
| Invalid safety boolean | `<field> must be a boolean` |
| Invalid failure class | `failureClass must be a non-empty string or null` |
| Invalid blocker boundary | `blockerBoundary must be one of none, git_state, network, permission, approval_required, test_failure, lint_failure, missing_file, timeout, route_ambiguous, source_unavailable, contract_invalid` |
| Invalid evidence array | `<field> must be a string array` or `<field> entries must be non-empty strings` |
| Invalid meta | `meta must be an object when present` |
| Blocked/fail without failure class | `failureClass must be set when status is blocked or fail` |
| Pass with blocker metadata | `pass routes must use failureClass null and blockerBoundary none` |
| Action-required without blocker but with failure class | `action_required routes without blockerBoundary must use failureClass null` |
| Blocked/fail with no blocker boundary | `blocked or fail routes must use a non-none blockerBoundary` |
| Human escalation contradiction | `human_escalation routes must require human review` |
| None route contradiction | `none routes must not set targetCommand or targetSkill` |
| Mutation without human boundary | `mutating routes must require human review` |
| Safe blocked route | `safeToUse must be false when status is blocked or fail` |

Mapper errors should be similarly deterministic:

| Case | Required behavior |
| --- | --- |
| Invalid route passed to mapper | Throw `Error("routeDecision must satisfy route-decision/v1")`. |
| Existing lifecycle route metadata | Throw `Error("decision.meta.lifecycleRoute already exists")`. |

If implementation chooses a non-throwing mapper result, this plan must be
revised before coding so the review gate can verify that alternate contract.

## IU-301-001 Route Decision Type Contract

Objective:

Create the internal contract surface without runtime side effects.

Allowed file:

- `src/lib/decision/route-decision.ts`

Required exports:

- `ROUTE_DECISION_SCHEMA_VERSION`
- `ROUTE_DECISION_IDS`
- `RouteDecisionId`
- `ROUTE_DECISION_BLOCKER_BOUNDARIES`
- `RouteDecisionBlockerBoundary`
- `RouteDecision`
- `RouteDecisionValidationResult`
- `HarnessDecisionLifecycleRouteMeta`

Implementation constraints:

- Use `import type` for `HarnessDecision` and `HarnessDecisionStatus`.
- Include `.js` extension in local imports.
- Add JSDoc for every exported public API declaration.
- Keep schema version serialized as `route-decision/v1`.
- Derive `RouteDecisionId` and `RouteDecisionBlockerBoundary` from exported
  readonly constants so the validator, mapper, and tests share one vocabulary.
- Use `Record<string, unknown>` for optional metadata.
- Do not introduce `any`, double assertions, or `@ts-ignore`.

Proof:

- TypeScript compiles.
- `pnpm run quality:docstrings` accepts the new exported API.

## IU-301-002 Route Decision Validator

Objective:

Implement runtime validation for untrusted route packets.

Allowed file:

- `src/lib/decision/route-decision.ts`

Required helper:

- `validateRouteDecision(candidate: unknown): RouteDecisionValidationResult`

Recommended optional helper:

- `isRouteDecision(candidate: unknown): candidate is RouteDecision`

Validation rules:

- Reject non-object and array candidates.
- Reject wrong `schemaVersion`.
- Reject blank `producer`.
- Reject unsupported `status`, route id, and blocker boundary.
- Reject blank `route.label`.
- Reject non-null blank `targetCommand`, `targetSkill`, and `sourcePath`.
- Reject non-boolean `safeToUse`, `requiresHuman`, `requiresNetwork`, and
  `mutates`.
- Reject non-array or blank-entry `evidenceRef`, `redactionsApplied`, and
  `warnings`.
- Reject `meta` unless it is an object and not an array.
- Enforce cross-field invariants from the spec:
  `human_escalation` requires human, `none` has no targets, mutating routes
  require human, `safeToUse: true` cannot be blocked or failed, and status must
  align with `failureClass` plus `blockerBoundary`.

Error-message policy:

- Keep messages deterministic and specific.
- Prefer the existing `HarnessDecision` validator style: return all discovered
  errors in a stable array instead of failing at the first error.

Proof:

- Focused tests cover malformed shape, invalid enums, blank strings, invalid
  arrays, blocked/fail failures, and cross-field contradictions.

## IU-301-003 Cockpit Metadata Mapper

Objective:

Add a pure compatibility bridge from route decisions into cockpit metadata.

Allowed file:

- `src/lib/decision/route-decision.ts`

Required helpers:

- `toHarnessDecisionLifecycleRouteMeta(routeDecision: RouteDecision): HarnessDecisionLifecycleRouteMeta`
- `withLifecycleRouteMeta(decision: HarnessDecision, routeDecision: RouteDecision): HarnessDecision`

Mapper behavior:

- Map only into `meta.lifecycleRoute`.
- Preserve all existing top-level `HarnessDecision` fields exactly.
- Preserve existing `decision.meta` keys.
- Reject existing `decision.meta.lifecycleRoute` by default.
- Never parse or execute `targetCommand`.
- Never promote route-local `failureClass` to top-level `HarnessDecision.failureClass`.
- Preserve `safeToUse: false` only as nested advisory evidence.
- Preserve `redactionsApplied` in `meta.lifecycleRoute`; dropping redaction
  provenance is a blocker because later adapters need to know whether evidence
  was sanitized.

Return-shape decision:

- Prefer returning `HarnessDecision` and throwing a deterministic `Error` only
  for programmer misuse such as an invalid route packet or existing
  `meta.lifecycleRoute`.
- If implementation prefers non-throwing behavior, stop and revise this plan
  before coding so the review gate can verify the alternate result contract. Do
  not silently ignore collision or invalid route data.

Proof:

- Tests compare the input decision and output decision field-by-field.
- Collision test proves existing `meta.lifecycleRoute` is rejected.
- Immutability test proves the original decision object is not mutated.
- Mapper provenance test proves `evidenceRef`, `redactionsApplied`, and
  `warnings` are all preserved in nested metadata.

## IU-301-004 Fixture And Regression Tests

Objective:

Prove the contract and mapper without wiring runtime command behavior.

Allowed file:

- `src/lib/decision/route-decision.test.ts`

Required fixtures:

- Valid `plan`, `review`, `fix`, `tdd`, `heartbeat`, `spec`, `work`,
  `human_escalation`, and `none` routes.
- Ambiguous route with `action_required` and `route_ambiguous`.
- Network refresh needed with `action_required` and `network`.
- Missing source with `blocked`, `source_unavailable`, and non-empty
  `failureClass`.
- Approval needed with `blocked`, `approval_required`, and `requiresHuman`.
- Mutating route requiring human.
- Shell-like or quote-heavy text stored only as metadata or evidence.
- Invalid schema and unsupported enum cases.
- Blocked route without `failureClass`.
- `human_escalation` with `requiresHuman: false`.
- `none` route with target command or skill.
- Existing lifecycle route metadata collision.
- Mapper immutability for input decision and existing `meta` object.
- Mapper provenance for `evidenceRef`, `redactionsApplied`, and `warnings`.
- Canonical route id and blocker-boundary values exported once and reused by
  validator tests.
- Invalid route passed directly to mapper.

Regression commands:

- `pnpm test src/lib/decision/route-decision.test.ts src/lib/decision/harness-decision.test.ts src/commands/next.test.ts`

The `src/commands/next.test.ts` portion is regression evidence only. Do not edit
`src/commands/next.test.ts` unless the focused contract work reveals a real
import or type breakage.

## Implementation Checklist

Before starting code:

- Confirm branch and dirty-file scope.
- Re-read `src/lib/decision/harness-decision.ts` and its tests.
- Confirm no implementation unit requires `src/commands/next.ts`.

While coding:

- Add type contract first, with JSDoc.
- Add validation helpers before mapper helpers.
- Add tests for invalid shapes before happy-path mapper tests.
- Keep helper functions local unless a downstream consumer needs them.
- Use type-only imports and `.js` extensions.
- Avoid `Record<string, any>`, `as any`, double assertions, and `@ts-ignore`.
- Preserve test names as behavior statements.

Before review:

- Run focused tests.
- Run typecheck.
- Run `quality:docstrings` and `quality:size`.
- Run `test:related`.
- Run `validate-codestyle.sh --fast`.
- Confirm `git diff -- src/commands/next.ts src/lib/cli/registry` is empty.

## Ownership

| Area | Owner | Responsibility |
| --- | --- | --- |
| Contract decisions | `JSC-301` implementation owner | Keep `RouteDecision/v1` advisory, typed, validated, and removable. |
| Spec authority | `JSC-301` spec artifact | Own schema fields, validation invariants, mapper envelope, and non-goals for this slice. |
| Plan authority | `JSC-301` plan artifact | Own implementation order, stop rules, validation commands, and rollback sequence. |
| Downstream adapter decisions | `JSC-302` owner | Decide repeated attachment, idempotency, and `harness next` runtime integration. |
| Public route exposure | `JSC-304` owner | Decide whether `harness route --json` exists and what public schema it exposes. |
| HE phase-exit gates | `JSC-311` owner | Model skill-backed simplify, review, autofix, bug-fix, and testing gates as evidence contracts without expanding `JSC-301`. |
| Independent review | Code reviewer / CodeRabbit where available | Verify API minimality, safety posture, scope boundaries, and focused validation evidence. |

Ownership rules:

- If implementation requires a schema-field change, update the spec before
  changing source.
- If implementation requires runtime `harness next` behavior, stop and move the
  work to `JSC-302` or revise this plan and spec with explicit approval.
- If implementation requires public command exposure, stop and move the work to
  `JSC-304` or revise this plan and spec with explicit approval.

## Phase Admission Rules

| Next phase | Admission rule |
| --- | --- |
| `he-work` for `JSC-301` | This plan artifact passes identity and traceability checks. |
| `JSC-302` adapter planning | `JSC-301` implementation passes focused tests and code review. |
| `JSC-303` resume/automation fixtures | Route failure and blocker semantics are implemented and stable. |
| `JSC-304` public route command decision | Adapter and fixture slices prove route data is useful without corrupting cockpit behavior. |
| `JSC-311` HE gate planning | `JSC-301` implementation proves route metadata is advisory and cannot be mistaken for review, simplify, autofix, bug-fix, or test-review evidence. |

Stop before `JSC-302` if `JSC-301` implementation requires `src/commands/next.ts`
changes to make tests pass.

## Validation Gates

During implementation:

- `pnpm test src/lib/decision/route-decision.test.ts src/lib/decision/harness-decision.test.ts src/commands/next.test.ts`
- `pnpm typecheck`
- `pnpm run quality:docstrings`
- `pnpm run quality:size`
- `pnpm run test:related`
- `bash scripts/validate-codestyle.sh --fast`

Before PR handoff if production source changed:

- `pnpm check`
- `bash scripts/verify-work.sh --fast`

Artifact validation for this plan:

- `python3 ${AGENT_SKILLS_ROOT}/Infrastructure/scripts/validation-and-linting/he_artifact_identity_lint.py .harness/plan/2026-05-11-JSC-301-route-decision-contract-plan.md`
- `python3 ${AGENT_SKILLS_ROOT}/Infrastructure/scripts/validation-and-linting/he_linear_traceability_lint.py .harness/plan/2026-05-11-JSC-301-route-decision-contract-plan.md`
- `python3 ${AGENT_SKILLS_ROOT}/Infrastructure/scripts/validation-and-linting/he_frontmatter_safety_lint.py .harness/plan/2026-05-11-JSC-301-route-decision-contract-plan.md`
- `pnpm markdownlint .harness/plan/2026-05-11-JSC-301-route-decision-contract-plan.md`

Do not run `pnpm test:deep` for `JSC-301` unless implementation unexpectedly
changes runtime behavior or generated artifacts. If that happens, stop and
reclassify the work as crossing into `JSC-302`.

## Observability And Evidence

Implementation evidence must be local, reviewable, and non-sensitive.

Required evidence after implementation:

- Focused test output for `route-decision`, existing `harness-decision`, and
  `next` regression tests.
- Typecheck and codestyle command outcomes.
- Diff evidence that no public CLI registry or `src/commands/next.ts` runtime
  integration was introduced.
- Route fixture evidence for source path, compact evidence references,
  redaction classes, warnings, and blocker boundaries.

Runtime observability requirements for this slice:

- No new logging, metrics, traces, external calls, dashboards, or alerts are
  required because `JSC-301` introduces no runtime command behavior.
- The observable surface is the serialized `RouteDecision` packet and nested
  `HarnessDecision.meta.lifecycleRoute` metadata produced by tests.
- `redactionsApplied` must identify redaction category only. It must not store
  raw secrets, full prompt bodies, or long logs.

If implementation creates runtime behavior despite this boundary, stop and
revise the spec and plan before continuing.

## Rollback And Stop Rules

Rollback:

- Delete `src/lib/decision/route-decision.ts`.
- Delete `src/lib/decision/route-decision.test.ts`.
- Remove any exports added elsewhere if implementation later requires them.

Stop rules:

- Stop if implementation needs to alter `src/commands/next.ts`.
- Stop if tests need public CLI registry changes.
- Stop if `targetCommand` cannot stay metadata-only.
- Stop if mapper collision behavior needs replacement/history semantics instead
  of deterministic rejection.
- Stop if validation logic starts duplicating or weakening
  `HarnessDecision` top-level validation.
- Stop if mapper behavior mutates the input `HarnessDecision`.
- Stop if implementation needs exported helper internals not listed in
  [Detailed API Contract](#detailed-api-contract).
- Stop if artifact or Linear traceability checks fail after plan edits.

## Review Gates

Before `he-work`:

- This plan must pass artifact identity and Linear traceability lint.

After implementation:

- Code review must focus on:
  - exported API minimality,
  - route/cockpit authority separation,
  - cross-field invariant enforcement,
  - metadata collision behavior,
  - command-injection posture,
  - whether `JSC-302` scope leaked into `JSC-301`.

Independent review should treat any `src/commands/next.ts` or CLI registry diff
as a scope violation unless explicitly justified by a revised spec.

## Linear / Spec / Plan / PR Traceability

| Linear issue | Source acceptance IDs | Plan units | Acceptance IDs | PR evidence |
| --- | --- | --- | --- | --- |
| JSC-300 | SA-301-004, SA-301-005, SA-301-010, SA-301-011 | Parent context only | SA-301-004, SA-301-005, SA-301-010, SA-301-011 | Pending implementation PR |
| JSC-301 | SA-301-001 through SA-301-014 | IU-301-001, IU-301-002, IU-301-003, IU-301-004 | SA-301-001 through SA-301-014 | Pending implementation PR |
| JSC-302 | SA-301-004, SA-301-005, SA-301-006, SA-301-010, SA-301-014 | Deferred adapter planning | SA-301-004, SA-301-005, SA-301-006, SA-301-010, SA-301-014 | Not applicable until downstream slice |
| JSC-303 | SA-301-002, SA-301-003, SA-301-007, SA-301-008, SA-301-009, SA-301-013 | Deferred fixture planning | SA-301-002, SA-301-003, SA-301-007, SA-301-008, SA-301-009, SA-301-013 | Not applicable until downstream slice |
| JSC-304 | SA-301-011 | Deferred public exposure decision | SA-301-011 | Not applicable until downstream slice |
| JSC-311 | SA-301-010, SA-301-011 | Deferred HE phase-exit gate planning | Future `HeGateResult/v1` and `HePhaseExit/v1` acceptance | Not applicable until downstream slice |

Supporting artifacts:

- Spec: `.harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md`
- Spec review:
  `.harness/review/2026-05-11-JSC-301-route-decision-contract-spec-technical-review.md`
- Plan: `.harness/plan/2026-05-11-JSC-301-route-decision-contract-plan.md`

## Future Work: HE Phase-Exit Gate Contracts

Future work is now tracked as live `JSC-311`:

`[coding-harness] Add HE phase-exit evidence gates for skill-backed commit readiness`.

This work is intentionally downstream from `JSC-301`. A `RouteDecision/v1`
packet can recommend a lifecycle route, but it cannot prove that `$simplify`,
`@testing-reviewer`, `$he-fix-bugs`, `$he-code-review`, or `$autofix` actually
ran with enough evidence to permit commit or phase exit.

Recommended implementation units for `JSC-311`:

| Unit | Title | Scope | Validation |
| --- | --- | --- | --- |
| `IU-311-001` | `HeGateResult/v1` type contract | Define gate ids, execution modes, statuses, evidence refs, findings, actions, skipped items, validation outcomes, and blocker fields. | Typecheck and focused unit tests. |
| `IU-311-002` | Skill-modelled gate fixtures | Encode fixtures for `$simplify`, `@testing-reviewer`, `$he-fix-bugs`, `$he-code-review`, and `$autofix` without executing arbitrary prompt text from TypeScript. | Fixture tests for pass, fail, blocked, not applicable, direct skill, and proxy modes. |
| `IU-311-003` | `HePhaseExit/v1` aggregator | Combine configured gate results into `continue`, `stop`, `commit_blocked`, or `human_review_required` recommendations. | Aggregator tests proving required gates fail closed. |
| `IU-311-004` | Evidence reporting adapter | Produce compact JSON or markdown evidence suitable for heartbeat/commit gates without mutating git, Linear, GitHub, CodeRabbit, or CircleCI. | Snapshot or structured-output tests plus codestyle fast gate. |

Initial gate expectations:

| Gate | Source model | Expected gate behavior |
| --- | --- | --- |
| `simplify` | `$simplify` | Require scope evidence plus reuse, quality, and efficiency review accounting. Record fixed and skipped findings. Distinguish `direct_skill` from `subagent_proxy`. |
| `testing-reviewer` | `@testing-reviewer` | Assess test adequacy and missing edge cases. Do not mark this as bug repair and do not let it satisfy `$he-fix-bugs`. |
| `he-fix-bugs` | `$he-fix-bugs` | Be `not_applicable` when there is no failing evidence. When failing evidence exists, require reproduction, root cause, patch, regression protection, rollback note, and validation. |
| `he-code-review` | `$he-code-review` | Require findings-first output, exact file-line evidence for findings, traceability, validation summary, blocker classification, and `safe_to_continue`. |
| `autofix` | `$autofix` | Require unresolved CodeRabbit/Codex review inventory before fixes. Account for every item as fixed, reviewed, deferred, stale, blocked, or false positive with validation evidence. |

Recommended non-goals:

- Do not add public CLI exposure in the first gate-contract slice.
- Do not make TypeScript execute skill prompt bodies.
- Do not infer that a skill ran because a free-form review used similar words.
- Do not mutate external systems or git state from the first contract slice.
- Do not treat route recommendations as gate evidence.

Recommended acceptance criteria:

- `HeGateResult/v1` validates required fields, evidence refs, execution mode,
  and status/gate consistency.
- `he-fix-bugs` blocks on failing validation evidence without reproduction and
  becomes `not_applicable` when no bug evidence exists.
- `testing-reviewer` remains test-coverage evidence only.
- `autofix` blocks when review feedback is present but inventory/accounting is
  missing.
- `HePhaseExit/v1` refuses commit when a configured required gate is `fail`,
  `blocked`, or `not_run`.
- Focused tests prove `RouteDecision/v1` route labels cannot be mistaken for
  gate-run evidence.

This plan and spec remain aligned by keeping `JSC-311` future-only. If `JSC-301`
implementation starts adding gate-result or phase-exit behavior, stop and move
that work into the future issue instead of widening the active slice.

## Acceptance Traceability

| Acceptance ID | Implementation unit | Validation |
| --- | --- | --- |
| SA-301-001 | `IU-301-001` | Typecheck and docstring gate. |
| SA-301-002 | `IU-301-002`, `IU-301-004` | Focused route-decision tests. |
| SA-301-003 | `IU-301-001`, `IU-301-004` | Valid route fixture matrix. |
| SA-301-004 | `IU-301-003`, `IU-301-004` | Mapper top-level preservation tests. |
| SA-301-005 | `IU-301-004` | Existing harness-decision and next tests. |
| SA-301-006 | `IU-301-003`, `IU-301-004` | Route-local failure class regression test. |
| SA-301-007 | `IU-301-002`, `IU-301-004` | Unsafe-input fixture test. |
| SA-301-008 | `IU-301-002`, `IU-301-004` | Mutating route invariant test. |
| SA-301-009 | `IU-301-001`, `IU-301-002`, `IU-301-004` | Blocker boundary enum and validation tests. |
| SA-301-010 | `IU-301-003` | Mapper API available for later `JSC-302`. |
| SA-301-011 | All units | No CLI registry or public route command diff. |
| SA-301-012 | Plan/spec artifacts | Artifact lint and Linear traceability lint. |
| SA-301-013 | `IU-301-002`, `IU-301-004` | Cross-field validation tests. |
| SA-301-014 | `IU-301-003`, `IU-301-004` | Mapper collision test. |

## Test Scenarios

| Scenario | Input | Action | Expected outcome |
| --- | --- | --- | --- |
| Valid plan route | Complete `RouteDecision` with `route.id: "plan"`. | `validateRouteDecision`. | Valid with no errors. |
| Invalid schema | Same packet with `schemaVersion: "route-decision/v2"`. | `validateRouteDecision`. | Invalid with schema error. |
| Blocked without failure | `status: "blocked"`, `failureClass: null`. | `validateRouteDecision`. | Invalid with failure-class error. |
| Action-required without blocker but with failure | `status: "action_required"`, `blockerBoundary: "none"`, `failureClass` set. | `validateRouteDecision`. | Invalid with action-required blocker consistency error. |
| Human escalation contradiction | `route.id: "human_escalation"`, `requiresHuman: false`. | `validateRouteDecision`. | Invalid with human-required error. |
| None route contradiction | `route.id: "none"`, `targetCommand` set. | `validateRouteDecision`. | Invalid with no-targets error. |
| Mutating route contradiction | `mutates: true`, `requiresHuman: false`. | `validateRouteDecision`. | Invalid with mutation-human-boundary error. |
| Unsafe text | Shell-like text exists in metadata/evidence only. | Validate and inspect mapper output. | No executable argv derivation. |
| Metadata attach | Valid decision plus valid route. | `withLifecycleRouteMeta`. | Returns decision with only `meta.lifecycleRoute` added. |
| Metadata collision | Decision already has `meta.lifecycleRoute`. | `withLifecycleRouteMeta`. | Deterministic rejection. |
| Mapper immutability | Freeze or retain references to input decision and meta. | `withLifecycleRouteMeta`. | Original object and existing meta keys remain unchanged. |
| Mapper provenance | Route includes evidence, redactions, and warnings. | `withLifecycleRouteMeta`. | Nested metadata preserves all three arrays. |
| Canonical vocabularies | Exported constants are used by validator tests. | Validate each route id and blocker boundary. | No duplicated enum arrays in tests or mapper code. |
| Invalid route mapper input | Invalid route packet cast only inside test boundary. | `withLifecycleRouteMeta` or `toHarnessDecisionLifecycleRouteMeta`. | Throws deterministic invalid-route error. |
| Existing cockpit regression | Existing decision and next tests. | Focused vitest command. | Current cockpit behavior remains green. |

## Assumptions And Unknowns

Assumptions:

- `JSC-301` remains the selected active slice under `JSC-300`.
- The current `HarnessDecision` validator style is the preferred implementation
  pattern for `RouteDecision`.
- Throwing on mapper collision is acceptable if tests assert deterministic
  behavior.

Unknowns:

- Whether downstream `JSC-302` will need route metadata attached inside
  `harness next` by default or behind a flag.
- Whether `targetCommand` should be renamed before public route exposure.
- Whether `heartbeat` should remain in v1 after executable loop fixtures are
  implemented.

These unknowns do not block `JSC-301` because they are either downstream
adapter decisions or public exposure decisions.

## Post-Plan Handoff

```yaml
post_plan_handoff:
  state: explicit_stop
  selected_next_stage: he-work
  evidence: ".harness/plan/2026-05-11-JSC-301-route-decision-contract-plan.md"
  next_action: "Run he-work for JSC-301 only if implementation is explicitly authorized."
```

## Blackboard Delta

New execution invariant:

- `JSC-301` is contract-only. If implementation needs to touch `harness next`,
  the work has crossed into `JSC-302` and must stop or be reauthorized.

New validation invariant:

- Route decisions must prove both shape validity and semantic cross-field
  validity before they can be attached to a cockpit decision.

New rollback invariant:

- Route contract work must remain removable by deleting the route-decision
  source and test files, with no CLI behavior rollback required.
