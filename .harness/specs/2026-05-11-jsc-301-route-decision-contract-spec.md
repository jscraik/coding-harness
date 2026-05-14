---
schema_version: 1
artifact_id: jsc-301-route-decision-contract-spec
artifact_type: he-spec
canonical_slug: jsc-301-route-decision-contract
title: JSC-301 RouteDecision/v1 Contract And Cockpit Compatibility Mapping Spec
harness_stage: he-spec
status: draft
date: 2026-05-11
traceability_required: true
origin: Linear JSC-301 plus harness-engineering plugin review findings
linear_issue: JSC-301
linear_parent: JSC-300
linear_status: Todo
linear_project: coding-harness
risk: lifecycle-routing-contract
depth: full
ui: false
linear_mutation_status: not_needed
linear_action_required: none
future_work_linear_issue: JSC-311
---

# JSC-301 RouteDecision/v1 Contract And Cockpit Compatibility Mapping Spec

## Table Of Contents

- [Mode Decision](#mode-decision)
- [Problem](#problem)
- [Goals](#goals)
- [Non-Goals](#non-goals)
- [Linear Contract](#linear-contract)
- [Linear Work Item Contract](#linear-work-item-contract)
- [Boundary](#boundary)
- [Baseline](#baseline)
- [Domain Model](#domain-model)
- [Route Decision Contract](#route-decision-contract)
- [Cockpit Compatibility Mapping](#cockpit-compatibility-mapping)
- [Safety Contract](#safety-contract)
- [Cross-Field Invariants](#cross-field-invariants)
- [Lifecycle](#lifecycle)
- [Interfaces](#interfaces)
- [Fixture Contract](#fixture-contract)
- [Invariants](#invariants)
- [Failure And Recovery](#failure-and-recovery)
- [Observability](#observability)
- [Validation Plan](#validation-plan)
- [Review Gate](#review-gate)
- [Acceptance Matrix](#acceptance-matrix)
- [Linear Acceptance Traceability](#linear-acceptance-traceability)
- [Future Work: Skill-Modelled Gate Contracts](#future-work-skill-modelled-gate-contracts)
- [First Slice](#first-slice)
- [Open Questions](#open-questions)
- [Done](#done)
- [he-plan Handoff](#he-plan-handoff)
- [Blackboard Delta](#blackboard-delta)
- [Evidence](#evidence)

## Mode Decision

Spec mode: Linear-backed standard behavior contract.

Selected slice:

- Type: child issue.
- Linear issue: `JSC-301`.
- Parent issue: `JSC-300`.
- Title: `RouteDecision/v1 contract and cockpit compatibility mapping`.
- Project: `coding-harness`.
- Source: Harness Engineering plugin review, `he-strategy`, `he-refactor`, and
  `he-linear-plan` routing sequence.

This spec owns only the contract freeze. It makes lifecycle routing representable
inside `coding-harness` without shipping a public `harness route --json` command
and without changing the default `harness next --json` recommendation behavior.

## Problem

The Harness Engineering plugin has a useful lifecycle router shape: classify the
current work into stages such as review, fix, spec, plan, work, heartbeat, or
human escalation, and carry source-path and blocker evidence alongside the
route. `coding-harness` already has a cockpit decision envelope in
`HarnessDecision`, but that envelope is action-centric: it tells the agent what
command or remediation to run next.

The missing contract is the bridge between these two questions:

- Lifecycle question: what stage or route is this work in?
- Cockpit question: what command or stop condition should the agent follow now?

Without a typed route contract, lifecycle routing can only exist as eval prose,
plugin doctrine, or ad hoc `meta` payloads. That makes later work risky because
`harness next` could accidentally treat a route label as executable command
authority, overwrite top-level cockpit status, or create a second incompatible
failure taxonomy.

## Goals

- Define a stable internal `RouteDecision/v1` TypeScript contract.
- Define validation rules for route decisions before any cockpit integration.
- Define an additive compatibility mapping into `HarnessDecision.meta`.
- Preserve `HarnessDecision` top-level semantics in this slice.
- Align route blockers with the existing `failureClass` and `blockerBoundary`
  cockpit vocabulary.
- Encode argv-safe and task-file-safe handling for free-form request text.
- Provide fixture cases that make `JSC-302` adapter work mechanical rather than
  interpretive.

## Non-Goals

- Do not implement `harness route --json`.
- Do not expose lifecycle routing as a public CLI surface.
- Do not change `harness next --json` output for normal callers.
- Do not attach route metadata inside `harness next` in `JSC-301`; that runtime
  adapter decision belongs to `JSC-302`.
- Do not make route decisions merge-blocking.
- Do not add resume, heartbeat, or automation-runbook loop execution.
- Do not mutate Linear, GitHub, CircleCI, or CodeRabbit state.
- Do not replace `HarnessDecision` with `RouteDecision`.
- Do not introduce plugin hook enforcement in this slice.

## Linear Contract

Workspace/team: `Jscraik` / `JSC`.

Project: `coding-harness`.

Parent issue: `JSC-300`.

Child issue: `JSC-301`.

Downstream blocked issues:

- `JSC-302`: Advisory lifecycle route adapter for `harness next`.
- `JSC-303`: Executable resume and automation loop eval fixtures.
- `JSC-304`: Decide expert exposure for `harness route --json`.
- `JSC-311`: HE phase-exit evidence gates for skill-backed commit readiness.

Execution route:

- `he-spec` for this artifact.
- `he-plan` for implementation sequencing.
- `he-work` only after this spec and technical review pass.

Human review required before:

- Public CLI exposure.
- Top-level `HarnessDecision` status changes from route data.
- Treating route output as command authority.
- Adding hook-enforced lifecycle behavior.

## Linear Work Item Contract

`JSC-301` owns the contract freeze for lifecycle route decisions. It does not
own runtime command integration or public CLI exposure.

Required work item behavior:

- Keep implementation scoped to typed contract, validation, fixtures, and pure
  metadata mapping.
- Preserve `JSC-302` as the adapter issue that wires route metadata into
  `harness next`.
- Preserve `JSC-303` as the executable resume and automation-loop fixture issue.
- Preserve `JSC-304` as the explicit public `harness route --json` exposure
  decision.
- Block closure if implementation mutates `src/commands/next.ts` in a way that
  changes top-level cockpit behavior without moving that work to `JSC-302`.
- Block closure if `targetCommand` is treated as executable command authority.

Recommended implementation title if `he-plan` creates sub-slices:

- `[coding-harness] Define RouteDecision/v1 contract and cockpit metadata mapper`

Required review posture:

- Technical review before `he-work`.
- Code review after implementation with focus on schema authority, mapper
  additivity, and unsafe command construction.

## Boundary

In scope:

- `src/lib/decision/**` for the internal contract and pure helpers.
- `src/lib/decision/*.test.ts` for validation and mapper tests.
- `src/commands/next.test.ts` only to prove no unexpected cockpit behavior
  regression when route metadata exists.
- `docs/specs/2026-05-02-feat-agent-native-cockpit-control-loop-spec.md` as
  source evidence for cockpit terminology and blocker-boundary concepts.
- `.harness/specs/**` and `.harness/review/**` for HE artifacts.

Out of scope:

- Public CLI registry changes.
- `src/commands/next.ts` runtime integration.
- Generated downstream skill content.
- Release packaging.
- External tracker or PR mutation.

## Baseline

Current cockpit contract:

- `HARNESS_DECISION_SCHEMA_VERSION` is `harness-decision/v1`.
- `HarnessDecisionStatus` is `pass`, `fail`, `blocked`, or
  `action_required`.
- `HarnessDecisionPhase` is `orient`, `verify`, `review`, `repair`, or
  `handoff`.
- `HarnessDecision` carries `nextAction`, `nextCommand`, `safeToRun`,
  `requiresHuman`, `requiresNetwork`, `writesFiles`, `evidenceRef`,
  `failureClass`, `retry`, `riskTier`, and optional `meta`.
- `HarnessDecisionOperationalMeta` already reserves structured operational
  metadata for friction, delay, and execution permission planning.
- Existing validation requires `failureClass` for `blocked` and `fail` states,
  and allows `failureClass: null` otherwise.

Current `harness next` behavior:

- Produces decisions via `buildHarnessDecision("harness next", ...)`.
- Chooses command recommendations from changed files, command catalog, risk
  tier, and source error state.
- Uses `failureClass` values such as `files_override_empty`,
  `git_state_unavailable`, `network_unavailable`, `learning_missing`,
  `run_head_mismatch`, `contract_blocked`, `invalid_mode`, and
  `unknown_argument`.
- Stores command argv details under metadata such as `nextCommandArgv` rather
  than treating arbitrary request text as shell source.

Existing cockpit design already identifies `blockerBoundary` as the preferred
aggregate grouping concept because it preserves detailed `failureClass` values
while giving multiple commands a common recovery vocabulary.

## Domain Model

`RouteDecision/v1` is an advisory lifecycle classification packet.

It answers:

- Which lifecycle route is recommended?
- What evidence caused that route?
- Is the route safe to use automatically?
- What boundary blocks route confidence, if any?
- Which source path produced or justified the route?

It does not answer:

- Which shell command should execute now?
- Whether a top-level cockpit decision has passed or failed.
- Whether the agent may mutate repo, git, or external tracker state.
- Whether the lifecycle route has enough proof to become public CLI behavior.

Terms:

| Term | Meaning |
| --- | --- |
| `route decision` | Advisory lifecycle classification packet. |
| `cockpit decision` | Existing `HarnessDecision` command/action envelope. |
| `route id` | Stable lifecycle route identifier. |
| `blocker boundary` | Cross-command recovery grouping for route blockers. |
| `source path` | Canonical file, module, issue, or artifact that produced the route. |
| `target command` | Human-readable command suggestion stored as data, not authority. |
| `target skill` | Skill or route name for the next HE stage, stored as data. |

## Route Decision Contract

The public concept is `RouteDecision/v1`. The serialized schema version should
be `route-decision/v1` to match the repository's existing lower-case schema
version convention.

Recommended TypeScript contract:

```ts
/** Schema version for advisory lifecycle route decisions. */
export const ROUTE_DECISION_SCHEMA_VERSION = "route-decision/v1" as const;

/** Stable advisory lifecycle route identifiers. */
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

/** Stable advisory lifecycle route identifier. */
export type RouteDecisionId = (typeof ROUTE_DECISION_IDS)[number];

/** Stable recovery grouping for route blockers. */
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

/** Stable recovery grouping for route blockers. */
export type RouteDecisionBlockerBoundary =
	(typeof ROUTE_DECISION_BLOCKER_BOUNDARIES)[number];

/** Advisory lifecycle route decision. */
export interface RouteDecision {
	/** Schema version for this route packet. */
	schemaVersion: typeof ROUTE_DECISION_SCHEMA_VERSION;
	/** Producer that emitted the route packet. */
	producer: string;
	/** Route-local status; advisory until mapped into a cockpit decision. */
	status: HarnessDecisionStatus;
	/** Stable lifecycle route. */
	route: {
		id: RouteDecisionId;
		label: string;
		targetCommand: string | null;
		targetSkill: string | null;
	};
	/** Canonical source file, issue, artifact, or module path when known. */
	sourcePath: string | null;
	/** Whether route metadata can be consumed without extra approval. */
	safeToUse: boolean;
	/** Whether human judgment is required before following the route. */
	requiresHuman: boolean;
	/** Whether live network data is required to trust or refresh the route. */
	requiresNetwork: boolean;
	/** Whether following the route would write local or external state. */
	mutates: boolean;
	/** Route-local failure class for blocked or failed classifications. */
	failureClass: string | null;
	/** Cross-command blocker grouping. */
	blockerBoundary: RouteDecisionBlockerBoundary;
	/** Evidence references used to justify the route. */
	evidenceRef: string[];
	/** Redaction classes applied to source material before routing. */
	redactionsApplied: string[];
	/** Non-fatal route warnings. */
	warnings: string[];
	/** Producer-specific metadata. */
	meta?: Record<string, unknown>;
}
```

Validation requirements:

- `schemaVersion` must equal `route-decision/v1`.
- `producer` must be a non-empty string.
- `status` must reuse the existing `HarnessDecisionStatus` vocabulary.
- `route.id` must be one of the declared `ROUTE_DECISION_IDS` values.
- `route.label` must be a non-empty human-readable string.
- `targetCommand` must be `null` or a descriptive string. It must not be parsed
  or executed by the contract layer.
- `targetSkill` must be `null` or a descriptive skill/route string.
- `sourcePath` must be `null` or a non-empty string.
- `safeToUse`, `requiresHuman`, `requiresNetwork`, and `mutates` must be
  booleans.
- `blocked` and `fail` route statuses must set a non-empty `failureClass`.
- `pass` and `action_required` route statuses may set `failureClass: null`.
- `blockerBoundary` must be one of the declared
  `ROUTE_DECISION_BLOCKER_BOUNDARIES` values and follow the status and boundary
  truth table in [Cross-Field Invariants](#cross-field-invariants).
- `evidenceRef`, `redactionsApplied`, and `warnings` must always be arrays.
- `meta` must be `Record<string, unknown>` when present; `Record<string, any>`
  and unsafe double assertions are forbidden.

## Cockpit Compatibility Mapping

The compatibility mapper must be pure and additive.

Attachment policy:

- Valid route decisions may be attached even when `safeToUse: false`, but only
  as advisory evidence under `meta.lifecycleRoute`.
- `safeToUse: false` means the route must not change top-level cockpit action,
  command, safety, retry, or failure fields.
- Invalid route decisions must not be attached. The caller must either return a
  validation error or attach a separately reviewed invalid-route diagnostic in a
  future spec.
- The mapper must reject a `HarnessDecision` that already contains
  `meta.lifecycleRoute` unless the caller explicitly opts into replacement with
  a named helper. Silent overwrite is forbidden.
- `JSC-301` should implement the default helper as `withLifecycleRouteMeta`,
  which rejects existing lifecycle route metadata. A future helper may add
  replacement or history behavior only with tests.

Recommended metadata envelope:

```ts
export interface HarnessDecisionLifecycleRouteMeta {
	schemaVersion: typeof ROUTE_DECISION_SCHEMA_VERSION;
	advisory: true;
	routeId: RouteDecisionId;
	routeStatus: HarnessDecisionStatus;
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
```

Mapping rules:

- Map `RouteDecision` into `HarnessDecision.meta.lifecycleRoute`.
- Preserve existing `HarnessDecision.meta` keys.
- Reject existing `HarnessDecision.meta.lifecycleRoute` by default instead of
  silently overwriting it.
- Never overwrite top-level `HarnessDecision.status` in `JSC-301`.
- Never overwrite top-level `HarnessDecision.nextAction` in `JSC-301`.
- Never overwrite top-level `HarnessDecision.nextCommand` in `JSC-301`.
- Never overwrite top-level `HarnessDecision.safeToRun` in `JSC-301`.
- Never overwrite top-level `HarnessDecision.requiresHuman` in `JSC-301`.
- Never overwrite top-level `HarnessDecision.requiresNetwork` in `JSC-301`.
- Never overwrite top-level `HarnessDecision.writesFiles` in `JSC-301`.
- Never overwrite top-level `HarnessDecision.failureClass` in `JSC-301`.
- Route-local `failureClass` remains nested under `meta.lifecycleRoute` unless a
  later adapter slice deliberately promotes it with tests.
- Metadata must be serializable as JSON.
- Preserve `redactionsApplied` in nested lifecycle metadata so downstream
  adapters can distinguish sanitized evidence from unknown redaction state.

Compatibility example:

```json
{
	"schemaVersion": "harness-decision/v1",
	"producer": "harness next",
	"status": "action_required",
	"nextCommand": "harness validation-plan --json --files src/foo.ts",
	"failureClass": null,
	"meta": {
		"lifecycleRoute": {
			"schemaVersion": "route-decision/v1",
			"advisory": true,
			"routeId": "plan",
			"routeStatus": "pass",
			"targetCommand": null,
			"targetSkill": "he-plan",
			"sourcePath": ".harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md",
			"safeToUse": true,
			"requiresHuman": false,
			"requiresNetwork": false,
			"mutates": false,
			"failureClass": null,
			"blockerBoundary": "none",
			"evidenceRef": ["linear:JSC-301"],
			"redactionsApplied": [],
			"warnings": []
		}
	}
}
```

## Safety Contract

Route decisions are not command authority.

The implementation must preserve these safety rules:

- `targetCommand` is metadata only.
- Free-form user text is never shell-interpolated.
- Quote-heavy, newline-heavy, or secret-like text must be stored through task
  files, redacted evidence, or fixture data rather than argv strings.
- Route validators must reject malformed packets rather than coerce unsafe
  values.
- A route with `mutates: true` must also set `requiresHuman: true` unless a
  future spec defines an explicit automation approval boundary.
- A route with `requiresNetwork: true` must not be treated as fresh unless the
  consuming command has actually refreshed the live source.
- A route with `safeToUse: false` must not be attached to a cockpit decision as
  top-level actionable guidance. It may be attached only as nested advisory
  evidence.
- `human_escalation` must set `requiresHuman: true`.

## Cross-Field Invariants

The validator must enforce these invariants, not leave them as implementation
notes:

| Condition | Required invariant |
| --- | --- |
| `route.id === "human_escalation"` | `requiresHuman === true` |
| `route.id === "none"` | `targetCommand === null` and `targetSkill === null` |
| `mutates === true` | `requiresHuman === true` |
| `safeToUse === true` | `status !== "blocked"` and `status !== "fail"` |
| `status === "pass"` | `failureClass === null` and `blockerBoundary === "none"` |
| `status === "blocked"` | `failureClass` is non-empty and `blockerBoundary !== "none"` |
| `status === "fail"` | `failureClass` is non-empty and `blockerBoundary !== "none"` |
| `status === "action_required"` with no route blocker | `failureClass === null` and `blockerBoundary === "none"` |
| `status === "action_required"` with route blocker | `blockerBoundary !== "none"` and `failureClass` may remain `null` when the condition is recoverable by user selection or refresh |

Status and boundary truth table:

| Status | `failureClass` | `blockerBoundary` | Example |
| --- | --- | --- | --- |
| `pass` | `null` | `none` | Valid `plan` route from current spec. |
| `action_required` | `null` | `route_ambiguous` | More than one route could apply; user must select. |
| `action_required` | `null` | `network` | Live refresh is needed before trusting route freshness. |
| `blocked` | Non-empty string | Non-`none` boundary | Source artifact missing or approval absent. |
| `fail` | Non-empty string | Non-`none` boundary | Route packet is internally invalid after production. |

## Lifecycle

`JSC-301` lifecycle:

1. Define route contract and validation helpers.
2. Define route-to-cockpit metadata mapper.
3. Add fixtures for valid, blocked, ambiguous, mutating, and unsafe-input
   routes.
4. Prove existing cockpit decision tests do not regress.
5. Hand off to `JSC-302` for advisory integration into `harness next`.

Allowed route ids:

| Route id | Meaning | Typical target skill | Runtime authority |
| --- | --- | --- | --- |
| `review` | Review current artifact, diff, plan, or implementation. | `he-code-review` or domain review | Advisory only |
| `fix` | Repair a found issue. | `he-work` | Advisory only |
| `tdd` | Write failing/proving tests before implementation. | `he-work` | Advisory only |
| `heartbeat` | Resume or continue long-running state. | heartbeat automation | Out of scope for `JSC-301` |
| `spec` | Create or deepen a bounded spec. | `he-spec` | Advisory only |
| `plan` | Produce an implementation plan from accepted spec. | `he-plan` | Advisory only |
| `work` | Implement accepted plan. | `he-work` | Advisory only |
| `human_escalation` | Stop for user approval or missing authority. | none | Stop only |
| `none` | No lifecycle route available. | none | No-op |

## Interfaces

Recommended files for implementation:

- `src/lib/decision/route-decision.ts`
- `src/lib/decision/route-decision.test.ts`

Recommended exports:

- `ROUTE_DECISION_SCHEMA_VERSION`
- `ROUTE_DECISION_IDS`
- `RouteDecisionId`
- `ROUTE_DECISION_BLOCKER_BOUNDARIES`
- `RouteDecisionBlockerBoundary`
- `RouteDecision`
- `RouteDecisionValidationResult`
- `validateRouteDecision(candidate: unknown): RouteDecisionValidationResult`
- `toHarnessDecisionLifecycleRouteMeta(routeDecision: RouteDecision): HarnessDecisionLifecycleRouteMeta`
- `withLifecycleRouteMeta(decision: HarnessDecision, routeDecision: RouteDecision): HarnessDecision`

Implementation notes:

- Use local `.js` extensions in imports.
- Use `import type` for type-only imports.
- Add JSDoc to exported APIs.
- Derive route id and blocker-boundary types from exported readonly constants
  so implementation, validators, tests, and downstream adapters share one
  source of vocabulary truth.
- Prefer explicit guard functions over unsafe assertions.
- Keep mapper tests independent of `src/commands/next.ts` so `JSC-302` can wire
  the adapter later without redefining the contract.

## Fixture Contract

Minimum fixtures:

| Fixture | Expected classification |
| --- | --- |
| Valid plan route | `status: pass`, `route.id: plan`, `blockerBoundary: none`, `failureClass: null` |
| Review route from source path | `status: pass`, `route.id: review`, `sourcePath` set, evidence includes source artifact |
| Ambiguous route | `status: action_required`, `route.id: none`, `blockerBoundary: route_ambiguous` |
| Missing source | `status: blocked`, `failureClass: source_unavailable`, `blockerBoundary: source_unavailable` |
| Network refresh needed | `status: action_required`, `requiresNetwork: true`, `blockerBoundary: network` |
| Approval needed | `status: blocked`, `requiresHuman: true`, `blockerBoundary: approval_required` |
| Mutating route | `mutates: true`, `requiresHuman: true`, not auto-actionable |
| Human escalation route | `route.id: human_escalation`, `requiresHuman: true` |
| No route | `route.id: none`, `targetCommand: null`, `targetSkill: null` |
| Shell-like request text | Stored as metadata/evidence only, no executable argv derivation |
| Invalid schema | validation fails with deterministic error |
| Invalid blocked route without `failureClass` | validation fails with deterministic error |
| Existing lifecycle metadata | default mapper rejects rather than overwriting `meta.lifecycleRoute` |

Regression fixtures:

- Existing `HarnessDecision` payload remains byte-for-byte equivalent when no
  lifecycle route is attached.
- Existing `HarnessDecision` top-level control fields remain unchanged when a
  lifecycle route is attached.
- Existing `nextCommandArgv` metadata remains separate from lifecycle route
  metadata.

## Invariants

- `RouteDecision/v1` is advisory in `JSC-301`.
- `HarnessDecision` remains the cockpit envelope.
- Route metadata is nested under `meta.lifecycleRoute`.
- Route metadata must not affect top-level cockpit fields in this slice.
- Route blocker vocabulary must align with cockpit recovery concepts.
- Blocked and failed route decisions must have a non-empty route-local
  `failureClass`.
- Public command exposure is blocked until `JSC-304` or a replacement decision
  admits it.
- Resume and automation loops are blocked until `JSC-303` or a replacement
  decision admits them.
- Validation must fail closed for malformed route packets.

## Failure And Recovery

| Failure | Required behavior | Recovery |
| --- | --- | --- |
| Unknown schema version | Validation fails. | Update producer or schema migration. |
| Unknown route id | Validation fails. | Add route id through a reviewed spec or fix producer. |
| Blocked route without `failureClass` | Validation fails. | Add stable route-local failure class. |
| Invalid blocker boundary | Validation fails. | Map to approved boundary or extend through reviewed spec. |
| Route tries to mutate without human boundary | Validation fails or returns blocked. | Add human approval boundary or mark route non-mutating. |
| `human_escalation` without human requirement | Validation fails. | Set `requiresHuman: true`. |
| `none` route with command or skill target | Validation fails. | Remove target hints or select a real route. |
| Shell-like request text appears as target command authority | Validation fails or test fails. | Store text as evidence/task-file data only. |
| Cockpit mapper overwrites top-level fields | Test fails. | Restrict mapper to `meta.lifecycleRoute`. |
| Cockpit mapper sees existing lifecycle route metadata | Default mapper rejects. | Use a future explicit replacement/history helper if reviewed. |
| Route source unavailable | Route returns blocked with `source_unavailable`. | Refresh source or ask for source artifact. |
| Route ambiguous | Route returns `action_required` with `route_ambiguous`. | Ask for selected slice or route context. |

## Observability

Route decisions must expose enough evidence for review without bloating cockpit
output:

- `producer` identifies the route source.
- `sourcePath` identifies the canonical file, issue, artifact, or module where
  the route came from.
- `evidenceRef` carries compact references such as `linear:JSC-301`,
  `.harness/specs/...`, or `src/lib/decision/harness-decision.ts`.
- `redactionsApplied` records redaction categories such as `secret_like`,
  `long_log`, or `quote_heavy_input` when applicable.
- `warnings` records non-fatal uncertainty.

Do not log raw secrets, long command output, or full user prompt bodies in route
metadata.

## Validation Plan

Required during implementation:

- `pnpm test src/lib/decision/route-decision.test.ts src/lib/decision/harness-decision.test.ts src/commands/next.test.ts`
- `pnpm typecheck`
- `pnpm run quality:docstrings`
- `pnpm run quality:size`
- `pnpm run test:related`
- `bash scripts/validate-codestyle.sh --fast`

Required before PR handoff if production source changes:

- `pnpm check`
- `bash scripts/verify-work.sh --fast`

Run `pnpm test:deep` only if `JSC-302` or a later implementation changes
runtime behavior or generated artifacts.

Spec artifact validation:

- `python3 ${AGENT_SKILLS_ROOT}/Infrastructure/scripts/validation-and-linting/he_artifact_identity_lint.py .harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md`
- `python3 ${AGENT_SKILLS_ROOT}/Infrastructure/scripts/validation-and-linting/he_linear_traceability_lint.py .harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md`
- `python3 ${AGENT_SKILLS_ROOT}/Infrastructure/scripts/validation-and-linting/he_frontmatter_safety_lint.py .harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md`
- `pnpm markdownlint .harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md`

## Review Gate

Technical review must check:

- Contract fields are minimal and typed.
- Route decision status does not create a second cockpit authority plane.
- Mapper is additive and cannot overwrite top-level cockpit fields.
- Validation covers malformed, blocked, ambiguous, mutating, and shell-like
  inputs.
- Blocker boundary names align with existing cockpit recovery terminology.
- Public CLI exposure remains out of scope.
- `JSC-302` has enough detail to implement adapter wiring without inventing
  schema semantics.

## Acceptance Matrix

| ID | Acceptance criterion | Proof |
| --- | --- | --- |
| SA-301-001 | `RouteDecision/v1` schema version, route id constants, blocker-boundary constants, and exported types are defined with public JSDoc. | TypeScript source and docstring quality gate. |
| SA-301-002 | `validateRouteDecision` rejects missing schema version, unknown route ids, invalid blocker boundaries, invalid arrays, and blocked/failed routes without `failureClass`. | Focused route-decision tests. |
| SA-301-003 | Valid route fixtures cover `review`, `fix`, `tdd`, `heartbeat`, `spec`, `plan`, `work`, `human_escalation`, and `none`. | Fixture matrix in route-decision tests. |
| SA-301-004 | Compatibility mapper stores route data only under `HarnessDecision.meta.lifecycleRoute`. | Mapper tests comparing top-level fields before and after attach. |
| SA-301-005 | Existing `HarnessDecision` behavior remains unchanged when no route metadata is attached. | Existing harness-decision and next tests pass. |
| SA-301-006 | Route-local `failureClass` does not overwrite top-level cockpit `failureClass`. | Mapper regression test. |
| SA-301-007 | Shell-like or quote-heavy request text is handled as data/evidence and never becomes executable command authority. | Unsafe-input fixture test. |
| SA-301-008 | Mutating lifecycle routes require a human boundary. | Validation test for `mutates: true`. |
| SA-301-009 | `blockerBoundary` vocabulary aligns with cockpit recovery concepts and includes `route_ambiguous`, `source_unavailable`, and `contract_invalid` for route-specific failures. | Type tests and review evidence. |
| SA-301-010 | `JSC-302` can consume the mapper without redefining route schema semantics. | he-plan handoff references source file, tests, and mapper API. |
| SA-301-011 | Public `harness route --json` exposure remains blocked by this spec. | Non-goal and review gate evidence. |
| SA-301-012 | Linear traceability ties the spec to `JSC-301` and parent `JSC-300`. | Artifact frontmatter and traceability lint. |
| SA-301-013 | Validator enforces cross-field invariants for `human_escalation`, `none`, mutating routes, safe-use posture, status, `failureClass`, and `blockerBoundary`. | Cross-field validation tests. |
| SA-301-014 | Default mapper rejects an existing `meta.lifecycleRoute` instead of silently overwriting it. | Mapper collision test. |

## Linear Acceptance Traceability

| Linear issue | Acceptance IDs | Notes |
| --- | --- | --- |
| JSC-300 | SA-301-004, SA-301-005, SA-301-010, SA-301-011 | Parent integration remains advisory until child slices prove adapter and eval loops. |
| JSC-301 | SA-301-001, SA-301-002, SA-301-003, SA-301-004, SA-301-005, SA-301-006, SA-301-007, SA-301-008, SA-301-009, SA-301-010, SA-301-011, SA-301-012, SA-301-013, SA-301-014 | This slice owns contract freeze and compatibility mapping. |
| JSC-302 | SA-301-004, SA-301-005, SA-301-006, SA-301-010 | Downstream advisory adapter must consume, not redefine, the contract. |
| JSC-303 | SA-301-002, SA-301-003, SA-301-007, SA-301-008, SA-301-009 | Downstream resume/automation fixtures depend on stable route failure semantics. |
| JSC-304 | SA-301-011 | Public CLI exposure remains a later explicit decision. |
| JSC-311 | SA-301-010, SA-301-011 | Future phase-exit gate contracts must consume route metadata as context only; they must not reinterpret route labels as proof that review, simplify, autofix, or bug-fix gates actually ran. |

## Future Work: Skill-Modelled Gate Contracts

`JSC-301` does not implement HE phase-exit gates. It exposes the downstream
need by separating lifecycle routing from execution evidence:

- `RouteDecision/v1` answers: which lifecycle route is recommended?
- A future `HeGateResult/v1` contract should answer: what review, validation,
  skill, or subagent evidence exists for one required gate?
- A future `HePhaseExit/v1` contract should answer: may the agent continue,
  commit, stop, or request human review from the current gate evidence?

Live downstream issue:

| Field | Value |
| --- | --- |
| Linear issue | `JSC-311` |
| Title | `[coding-harness] Add HE phase-exit evidence gates for skill-backed commit readiness` |
| Parent | `JSC-300` |
| Project | `Harness cockpit routing` |
| Depends on | `JSC-301`; optionally `JSC-302` for cockpit display context |
| Route | `he-spec -> he-plan -> he-work` |
| Status | Future work; not part of `JSC-301` completion |

Recommended contract relationship:

| Contract | Question answered | Authority boundary |
| --- | --- | --- |
| `RouteDecision/v1` | What lifecycle route is recommended? | Advisory route metadata only. |
| `HeGateResult/v1` | What evidence exists for one required gate? | Evidence classification only; not command authority. |
| `HePhaseExit/v1` | Do collected gates permit continue, stop, or commit? | Phase-exit recommendation; commit remains blocked until configured gates pass. |
| `HarnessDecision/v1` | What should the agent do next? | Existing cockpit action envelope. |

Initial gate set:

| Gate | Canonical source | Required future behavior |
| --- | --- | --- |
| `simplify` | `$simplify` | Distinguish `direct_skill` from `subagent_proxy` or `manual_review`; require scope evidence, reuse/quality/efficiency review lanes, fixed/skipped findings, and validation outcome. |
| `testing-reviewer` | `@testing-reviewer` | Classify test adequacy and missing edge cases; do not treat it as bug repair or as a replacement for `$he-fix-bugs`. |
| `he-fix-bugs` | `$he-fix-bugs` | Require concrete failing evidence before it is applicable; mark `not_applicable` when validation passes and no bug evidence exists; require reproduction, root cause, patch, regression protection, and validation when applicable. |
| `he-code-review` | `$he-code-review` | Require findings-first review posture, exact file-line evidence for findings, traceability, validation summary, blocker classification, and `safe_to_continue` evidence. |
| `autofix` | `$autofix` | Require review-feedback inventory and accounting for unresolved CodeRabbit and Codex findings before repair; record fixed, reviewed, stale, deferred, blocked, and false-positive items with validation outcomes. |

Recommended `HeGateResult/v1` fields:

| Field | Purpose |
| --- | --- |
| `schemaVersion` | Serialized version such as `he-gate-result/v1`. |
| `gateId` | Stable gate id, for example `simplify`, `testing-reviewer`, `he-fix-bugs`, `he-code-review`, or `autofix`. |
| `executionMode` | `direct_skill`, `subagent_proxy`, `manual_review`, `validation_only`, `not_applicable`, or `not_run`. |
| `status` | `pass`, `fail`, `blocked`, `action_required`, or `not_applicable`. |
| `sourceRefs` | Skill path, subagent type, command, artifact, or review source references. |
| `evidenceRefs` | Compact local or external evidence references; no raw secrets or long logs. |
| `findings` | Normalized findings or review items when applicable. |
| `actions` | Fixed or accepted actions when the gate repairs issues. |
| `skipped` | Explicit skipped, deferred, stale, false-positive, or blocked items. |
| `validation` | Exact commands or checks run with pass/fail/blocked outcomes. |
| `requiresHuman` | Whether human review is required before continuing. |
| `safeToContinue` | Whether the gate evidence permits the next phase. |
| `blockedReason` | Deterministic blocker when the gate is blocked. |

Recommended non-goals for `JSC-311`:

- Do not execute arbitrary skill prompts from TypeScript.
- Do not infer a direct skill run from generic prose that only resembles the
  skill output.
- Do not make `testing-reviewer` a substitute for `$he-fix-bugs`.
- Do not make `$he-fix-bugs` mandatory when there is no failing evidence.
- Do not mutate GitHub, Linear, CodeRabbit, CircleCI, or git state in the first
  contract slice.
- Do not expose a public CLI until the internal contract and fixtures prove the
  gate evidence shape.

Recommended acceptance criteria for `JSC-311`:

- Gate fixtures distinguish direct skill evidence from proxy review evidence.
- `simplify` fails or blocks when required scope evidence or review-lane
  accounting is missing.
- `testing-reviewer` reports test adequacy independently from bug repair.
- `he-fix-bugs` is `not_applicable` when there is no failing evidence and
  blocked when failing evidence exists without reproduction or repair proof.
- `he-code-review` requires findings-first output, traceability, validation
  evidence, and `safeToContinue` classification.
- `autofix` requires review-feedback inventory before fixes and accounts for
  every unresolved CodeRabbit or Codex item in scope.
- A phase-exit result cannot allow commit when any configured required gate is
  `fail`, `blocked`, or `not_run`.
- Tests cover the JSC-301 ambiguity: a route recommendation is not evidence
  that a gate ran.

## First Slice

The first implementation unit should be pure contract work only:

- Add `src/lib/decision/route-decision.ts`.
- Add `src/lib/decision/route-decision.test.ts`.
- Export validation and mapper helpers only if needed by tests or later adapter
  work.
- Run focused tests and codestyle gates.

Do not modify `src/commands/next.ts` in the first unit unless the plan proves a
no-runtime-effect seam is necessary.

## Open Questions

- Should `heartbeat` be admitted as a route id now even though executable
  heartbeat loops are `JSC-303`? Current spec says yes, as advisory vocabulary
  only, because the downstream fixture slice needs stable terminology.
- Should `targetCommand` be removed to avoid command-authority confusion?
  Current spec keeps it nullable and metadata-only so future expert command
  exposure can preserve intent without shell parsing.
- Should route metadata use `safeToUse` or reuse `safeToRun`? Current spec uses
  `safeToUse` to avoid implying command execution authority.

## Done

This spec is done when:

- The spec artifact and technical review exist.
- Artifact identity and Linear traceability checks pass or blockers are
  recorded.
- A technical review finds no blocking issues or this spec is revised to
  address them.
- `he-plan` can produce a bounded implementation plan without inventing schema
  semantics.

## he-plan Handoff

Plan `JSC-301` as a pure TypeScript contract slice.

Required implementation order:

1. Add route-decision types and constants.
2. Add route-decision validator.
3. Add compatibility metadata mapper.
4. Add fixture tests.
5. Run focused validation.
6. Only then consider whether `JSC-302` should attach metadata inside
   `harness next`.

Do not expose public CLI behavior in `JSC-301`.

## Blackboard Delta

New invariant:

- Lifecycle routing is advisory metadata until the adapter and eval slices prove
  it safe. `harness next --json` remains the default cockpit entrypoint and must
  not surrender top-level command authority to route metadata.

New reusable boundary:

- `RouteDecision/v1` answers lifecycle stage. `HarnessDecision/v1` answers
  cockpit action. The only approved bridge in this slice is additive
  `meta.lifecycleRoute`.

## Evidence

- `src/lib/decision/harness-decision.ts` defines the current cockpit decision
  envelope and operational metadata contract.
- `src/commands/next.ts` emits `HarnessDecision` for `harness next` and stores
  argv details as metadata.
- `src/commands/next.test.ts` covers existing `harness next` failure classes.
- `src/lib/decision/harness-decision.test.ts` covers `failureClass` validation.
- `docs/specs/2026-05-02-feat-agent-native-cockpit-control-loop-spec.md`
  records the `blockerBoundary` design direction for stable recovery grouping.
- `JSC-301` is the live Linear child issue for this contract slice under
  `JSC-300`.
