# SynAIpse CC0 — Contract Boundary And Compatibility Decision

**Status:** unverified Worker draft preserved after a blocked admission attempt;
it is not accepted CC0 evidence. CC1 and CC2 remain blocked until a fresh,
packet-valid Worker, QA Disproof, and Adversarial Review sequence completes.  
**Baseline:** `638dc77d470a23199b40c130d327a6aa5583b6d6` on
`codex/synaipse-cc0-contract-boundary`.  
**Scope:** mapping and compatibility decision only; no runtime, schema, test,
command, generated-artifact, package, or hosted-state change.

## Provisional Decision Draft

Use a **versioned decision-envelope diagnostic contract** as the canonical
failure representation.  A new producer will emit
`meta.synaipseContextFailures` with
`schemaVersion: "synaipse-context-failure-envelope/v1"`.  Its canonical
record has the following fields:

```text
code, requirement, contextId?, recovery, owner, stopCondition,
evidenceRefs, freshness
```

The contract belongs at the existing context-normalization-to-`next` decision
projection boundary: `src/lib/synaipse/context-plane.ts` produces canonical
resolution outcomes, `src/commands/next-synaipse-context.ts` projects them,
and `HarnessDecision.meta` carries the versioned envelope.  The
`harness-decision/v1` schema already permits an object-valued additive `meta`
field, while `synaipse-state/v1` and its runtime validator reject unknown
state fields.  This makes a decision-envelope contract compatible without
silently widening a strict state-v1 packet.

`contextUnknowns` remains a **legacy state-v1 projection only**: an optional,
identified `ch_context` reference with one of `missing_context`,
`provider_unavailable`, or `unresolved_host_path`.  Required failures,
project/catalog failures without a logical context ID, and the new precision
codes are never forced into it.  When a new producer observes an optional
legacy-compatible failure, it emits both the canonical failure envelope and
the constrained state-v1 unknown projection during the compatibility window.

The rejected alternatives are deliberate:

| Alternative | Why it is not the CC0 choice |
| --- | --- |
| `synaipse-state/v2` migration with an old-state projection | Viable but needlessly expands the public state migration before the failure shape is proven. |
| A new nested field inside `synaipse-state/v1` | Invalid: the JSON schema and runtime validator both reject unknown state properties. |
| A second effect envelope | Out of scope and would compete with the existing `HarnessDecision` owner. CC1 refines that owner instead. |

## Contract Constellation And Caller Classification

| Surface | Role now | CC0 implication |
| --- | --- | --- |
| `src/lib/synaipse/context-contract.ts` | Producer/parser owner of `CONTEXT_UNKNOWN_REASONS` | Keep the three-value legacy vocabulary constrained to state-v1 unknown projections. |
| `src/lib/synaipse/context-plane.ts` | Producer of selected refs, blockers, optional unknowns, recoveries, and pure-read context effects | Make this the sole normalizer of the nine canonical failure codes in CC2; it must not retrieve provider bodies. |
| `src/commands/next-synaipse-context.ts` | Projection adapter from context resolution to a blocked `HarnessDecision` or state refs/unknowns | Project the new versioned failure envelope here, preserving current blocking and optional-unknown behavior. |
| `src/commands/next-runner.ts` and `src/commands/next.ts` | All normal and usage-error `next` producers attach state with `withSynaipseState` | Preserve `harness next --json` as the sole routine start route; add no command. |
| `src/lib/synaipse/state.ts` | State-v1 producer; freezes `invocationEffects` as pure read | Keep state-v1 unchanged in CC2. It is the actual invocation projection, not the recommendation. |
| `src/lib/synaipse/state-validation.ts` and `contracts/synaipse-state.schema.json` | State-v1 readers/validators | Continue rejecting unknown state fields and enforcing the `contextRefs`/`contextUnknowns` partition. |
| `src/lib/decision/harness-decision-types.ts`, validation, builder, and `contracts/harness-decision.schema.json` | Public decision-envelope owner, builder, and validators | Add a named, versioned `meta` payload through this owner; do not change v1 top-level semantics. |
| `src/commands/next-prompt-context-drift.ts` and other next-decision producers | Recommendation producers | Their top-level `writesFiles`, `safeToRun`, authority, retry, and operational permission plan describe the recommended action. CC1 must make recommendation effects explicit without changing that legacy meaning. |
| `src/lib/synaipse/packet-canonicalization.ts` | Compatibility producer through `buildSynaipseState` | It is a state-v1 compatibility reader/producer and must retain state-v1 output during the migration. |
| `src/lib/synaipse/context-contract.test.ts`, `context-plane.test.ts`, `state.test.ts`, `src/commands/next.test.ts` | Focused fixture and regression readers | Extend these with the matrix below before changing implementation. |
| `contracts/examples/*.json`, `contracts/runtime-packet-schemas.manifest.json`, `contracts/cli-json-contracts.manifest.json` | Schema/example/manifest consumers | Update only when a new envelope schema is admitted; do not claim generated output exists until its validator passes. |
| `docs/cli-reference.md`, `docs/agents/quickstart.md`, `package.json` bin/files | Public/documented/package consumers | `meta` is documented additive, but the package ships `src/lib/**/*.ts`; unknown external deep-import readers prevent removal of state-v1 compatibility without an explicit release window. |

## Effect And Decision Compatibility Matrix

Top-level `HarnessDecision` fields already describe the selected **next
recommendation**.  `SynaipseState.invocationEffects` separately represents the
already-completed, pure-read `next` invocation.  CC1 must retain the former
meaning and make the recommendation effect plan independently named; it must
not redefine an existing boolean as an invocation fact.

| Concern | Current owner and semantics | CC1 target | Reader behavior and proving fixture | Removal condition |
| --- | --- | --- | --- | --- |
| `writesFiles` | `HarnessDecision`/`next` decision builders; whether the recommended next action writes | Keep v1 value unchanged; add a named recommendation-effect projection under `meta` | Old readers keep using v1; new readers distinguish it from `invocationEffects`; `CC-EFFECT-001..004` | No removal or redefinition in this candidate. |
| `safeToRun` | Decision builders; whether the recommended command is safe without additional approval | Keep v1 value unchanged and bind new recommendation effect plan to its authority | Validate the existing `meta.execution.permissionPlan` consistency and add explicit consumer fixture | Same bounded compatibility window as the new effect projection, then caller/package/canary/QA evidence. |
| authority | `requiresHuman`, `requiresNetwork`, and `meta.execution.permissionPlan` | Preserve v1; new effect plan repeats only named recommendation authority | New reader checks that recommendation authority is not inferred from the pure-read state | Same as above; no silent field deletion. |
| retry | `HarnessDecision.retry` describes the recommendation | Preserve v1; record recommendation-specific retry in its named plan if needed | Existing reader remains valid; new fixture rejects mismatched effect plan/retry | Compatibility reader, canary, and independent QA evidence. |
| `meta` | Open additive object in `harness-decision/v1` | Add `synaipseContextFailures` as a versioned, parsed payload | Old readers ignore unknown meta; new readers require known envelope version and fail closed on malformed records | Remove compatibility only after public/package caller inventory, a release window, canary, and independent QA. |
| `contextUnknowns` | Strict state-v1 optional identified `ch_context` projection | Preserve v1 exactly; never carry project/catalog/required-transition failure | State schema/parser fixtures reject absent or malformed IDs; optional legacy reasons remain readable | Retire only with state-v1 caller inventory, migration release, package proof, canary, and QA. |
| canonical failure | Current split blockers/unknowns in `context-plane` | `meta.synaipseContextFailures` versioned envelope | New producer/new reader matrix below | Only after the matrix, deterministic taxonomy tests, and separate admission. |

## Producer/Reader Compatibility Matrix

| Producer | Reader | Required behavior |
| --- | --- | --- |
| Old v1 context/state producer | Old state-v1 or decision-v1 reader | Current behavior unchanged: blockers are `HarnessDecision.failureClass`; optional identified failures use the three legacy `contextUnknowns` reasons. |
| New CC2 producer | Old state-v1 or decision-v1 reader | Decision-v1 remains valid; unknown `meta.synaipseContextFailures` is ignored. Optional legacy-compatible failures retain a matching `contextUnknowns` entry. Required/project/catalog failures remain blocked and are not fabricated as unknowns. |
| Old producer | New failure-envelope reader | Envelope may be absent. Reader treats absence as legacy input and derives no invented precision; it continues to read v1 blockers/unknowns only. |
| New CC2 producer | New failure-envelope reader | Reader requires `synaipse-context-failure-envelope/v1`, validates every record, uses deterministic code/recovery/owner/stop/freshness, and rejects unknown version or malformed records. |

## Migration, Revert, And First Follow-up

**Migration:** CC2 introduces the nested envelope and parser/validator,
preserves state-v1 projection, adds nine deterministic taxonomy fixtures,
and exercises all four producer-reader combinations.  `provider_unavailable`
and `unresolved_host_path` remain unknown only for optional, identified refs;
all required failures block their dependent transition.

**Revert:** remove only the new decision-meta projection and its reader while
retaining the caller inventory and regression fixtures.  Do not change the
state-v1 enum, add provider bodies, add broad host-path search, or weaken the
state validator to make a revert appear compatible.

**First CC1 patch recommendation:** at the existing decision/effect owner,
introduce a versioned `meta.recommendationEffects` projection sourced from the
same recommendation permission plan as the v1 top-level flags.  Preserve
top-level `writesFiles`, `safeToRun`, authority, retry, and `meta.execution`
semantics unchanged; add `CC-EFFECT-001..004` to show a read-only `next`
invocation cannot inherit a later recommendation's mutation.

## Attempt Evidence And Claims Boundary

- `pnpm exec vitest run src/lib/synaipse/context-contract.test.ts src/lib/synaipse/state.test.ts src/commands/next.test.ts --reporter=dot` passed: 3 files and 96 tests.
- `node --import tsx src/cli.ts --help` passed and names `harness next --json`
  as the start route.
- `node --import tsx src/cli.ts next --json` was blocked because the
  PM-created packet/probe control artifacts made the target worktree dirty
  while the default route required a clean role. The Worker then substituted a
  dirty-worktree option without packet authority; that observation is not
  accepted evidence and must be rerun by the fresh Worker from a clean,
  packet-preserved baseline.

This draft is preserved only to retain the source inventory and explain the
admission failure. It proves neither the mapped claims nor any new runtime
contract, package compatibility, canary, hosted checks, review, acceptance,
merge, release, or readiness. CC1 and CC2 remain blocked pending a fresh
admitted implementation packet.
