# SynAIpse CC0 — Confirmed Contract Boundary

**Status:** Worker-confirmed compatibility decision; CC1 and CC2 remain
blocked pending fresh QA Disproof and Adversarial Review.  
**Target:** `6a022f6d805139bebb18d16776b6a041445c1522` on
`codex/synaipse-cc0-contract-boundary`, based on
`638dc77d470a23199b40c130d327a6aa5583b6d6`.  
**Scope:** contract mapping and decision only. No runtime, schema, test,
command, package, generated-artifact, or hosted-state change is made here.

## Canonical decision

Adopt a **versioned decision-envelope diagnostic contract**. The first
implementation, if separately admitted, adds
`meta.synaipseContextFailures` with
`schemaVersion: "synaipse-context-failure-envelope/v1"` to the existing
`harness-decision/v1` owner. Each canonical failure record must carry a stable
code, requirement, optional `contextId`, deterministic recovery, owner, stop
condition, evidence references, and freshness.

This is the narrowest compatible option. `contracts/harness-decision.schema.json`
permits an additive object-valued `meta`, while `synaipse-state/v1` rejects
unknown top-level state properties. A nested decision envelope therefore does
not silently widen strict state-v1. The rejected alternatives are a
state-v2 migration (premature public-state migration) and a nested state-v1
field (invalid under its strict schema and runtime validator).

`contextUnknowns` remains strictly a state-v1 projection for an **optional,
identified** `ch_context` failure with exactly one current legacy reason:
`missing_context`, `provider_unavailable`, or `unresolved_host_path`. Project,
catalog, malformed-input, required-transition, access, freshness, and
supersession failures are never fabricated as unknowns. During a future
compatibility window, an optional legacy-compatible failure emits both the new
canonical diagnostic and its constrained state-v1 unknown projection.

## Producer and reader map

| Surface | Present role | CC1/CC2 compatibility consequence |
| --- | --- | --- |
| `src/lib/synaipse/context-contract.ts` | Defines the three-reason legacy unknown vocabulary and strict context metadata parsers. | Retain the vocabulary only for the state-v1 compatibility projection. |
| `src/lib/synaipse/context-projection.ts` | Parses `contextRefs` and `contextUnknowns`; requires a `ch_context` ID and rejects unknown fields. | Remains the strict old-reader boundary; no project or required failure enters it. |
| `src/lib/synaipse/context-plane.ts` | Resolves catalog/context metadata into selected refs, optional unknowns, or blockers with pure-read effects. | Is the sole normalizer for the future nine-code failure taxonomy; it must not retrieve provider bodies. |
| `src/commands/next-synaipse-context.ts` | Converts resolution blockers into a `HarnessDecision` and passes refs/unknowns onward. | Projects the versioned diagnostic through the decision owner while preserving current blockers and optional unknowns. |
| `src/commands/next-runner.ts` and `src/lib/synaipse/state.ts` | All `next` outcomes pass through `withSynaipseState`; state records the invocation’s pure-read effects. | Preserve state-v1 unchanged; invocation effects must never inherit recommendation effects. |
| `src/lib/synaipse/state-validation.ts` and `contracts/synaipse-state.schema.json` | Strict state-v1 readers; `contextUnknowns` needs `contextId` and one legacy reason. | Continue to reject widened state-v1 packets. |
| `src/lib/decision/harness-decision-types.ts`, validation, builder, and `contracts/harness-decision.schema.json` | Own the public v1 decision, including open `meta` and consistency between top-level flags and `meta.execution.permissionPlan`. | Own and validate the named versioned diagnostic; retain v1 top-level semantics. |
| `src/commands/next-*-decision.ts` and `next-support.ts` | Emit recommendation `safeToRun`, authority, retry, and `writesFiles`. | CC1 adds a separately named recommendation-effect projection; it must not relabel an existing boolean as an invocation fact. |
| `src/lib/synaipse/*.test.ts`, `src/commands/next.test.ts`, contract examples/manifests, docs, and package `files` | Regression, public/package, and emitted-source consumers. | Add deterministic old/new fixtures before implementation; package inventory must precede any removal of state-v1 compatibility. |

## Producer/reader compatibility matrix

| Producer | Reader | Required behaviour | Removal condition |
| --- | --- | --- | --- |
| Old context/state producer | Old state-v1 or decision-v1 reader | Current blockers and three legacy optional unknowns remain unchanged. | n.a. |
| New CC2 producer | Old state-v1 or decision-v1 reader | Decision stays v1-valid; additive `meta.synaipseContextFailures` is ignorable. Optional legacy-compatible failure retains its matching unknown. Required/project/catalog failure stays blocked. | A public caller/package inventory, migration release window, canary, and independent QA. |
| Old producer | New failure-envelope reader | Missing envelope is legacy input; do not invent precision from old blockers or unknowns. | n.a. |
| New CC2 producer | New failure-envelope reader | Require known `synaipse-context-failure-envelope/v1`; validate every record and fail closed on unknown version or malformed data. | The same compatibility evidence plus a separately admitted removal decision. |

## Effect compatibility matrix

| Concern | Current owner/meaning | Required next representation |
| --- | --- | --- |
| `SynaipseState.invocationEffects` | `buildSynaipseState` records the already-completed `next` invocation as pure read with all mutation booleans false. | Preserve unchanged. |
| `writesFiles`, `safeToRun`, authority, retry | `HarnessDecision` and `meta.execution.permissionPlan` describe the recommended next action; validation currently requires flag consistency. | Preserve v1 meaning and add a separately named recommendation-effect projection, sourced from the same permission plan. |
| `meta` | Additive object in `harness-decision/v1`. | Carry the versioned failure envelope and, in CC1, named recommendation effects; old readers ignore unknown additive members. |

## Migration and revert

CC2, if admitted, introduces the nested envelope/parser/validator, preserves
state-v1, adds deterministic fixtures for the nine taxonomy codes, and tests
all four producer/reader combinations. Required failures block their
transition; only optional identified legacy-compatible failures project into
`contextUnknowns`.

Revert removes only the added decision-meta projection and its parser/reader.
It must retain the caller inventory and regression tests. Do not weaken the
state-v1 validator, add provider bodies, add broad host-path search, or change
the legacy unknown enum merely to simplify rollback.

## First CC1 recommendation

At the existing decision/effect owner, introduce a versioned
`meta.recommendationEffects` projection derived from the same recommendation
permission plan as the v1 top-level fields. Preserve current top-level
`writesFiles`, `safeToRun`, authority, retry, and `meta.execution` semantics.
Add fixtures proving a read-only `harness next --json` invocation cannot claim
the mutation of its later recommended command. Do not implement this in CC0.

## Evidence and claims boundary

- `pnpm exec vitest run src/lib/synaipse/context-contract.test.ts src/lib/synaipse/state.test.ts src/commands/next.test.ts --reporter=dot` passed: 3 files and 96 tests.
- `node --import tsx src/cli.ts next --json --worktree-role dirty-with-justification` passed: emitted a v1 decision with `writesFiles: false`, an execution permission plan with `writesFiles: false`, and nested state invocation effects all false.
- The second result proves only this local command’s current dirty-role path and the shape observed at target SHA. It does not prove runtime compatibility after CC1/CC2, package compatibility, canary behaviour, hosted CI, review, acceptance, merge, release, or readiness.
