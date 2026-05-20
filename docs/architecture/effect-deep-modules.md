---
last_validated: 2026-05-19
---

# Effect Deep Module Boundaries

## Table of Contents
- [Purpose](#purpose)
- [Architecture Rule](#architecture-rule)
- [Layer Shape](#layer-shape)
- [Approved Boundaries](#approved-boundaries)
- [Agent Control Contract](#agent-control-contract)
- [Migration Sequence](#migration-sequence)
- [Deep Module Checklist](#deep-module-checklist)
- [Effect Usage Rules](#effect-usage-rules)
- [Non-Goals](#non-goals)
- [Validation](#validation)

## Purpose

Convert Coding Harness toward Effect-backed modules without turning Effect into
another cross-cutting dependency that leaks through command runners, CLI wiring,
or UI surfaces. The migration uses deep modules as agent control boundaries:
public interfaces stay simple, implementation can become richer behind the
boundary, and seam tests prove caller-visible behavior.

This follows the deep-module principle from *A Philosophy of Software Design*:
the best modules hide substantial implementation behind a simpler interface.
For agent work, that interface is the control surface where humans apply taste,
tests lock behavior down, and agents can safely work inside the boundary.

## Architecture Rule

Effect may only enter production code through an approved deep module boundary.
An approved boundary must have:

- A named public interface that callers use instead of reaching into internals.
- Tests at the boundary that assert caller-visible behavior.
- A clear owner and migration reason.
- No direct Effect dependency from command, UI, or app-wiring code unless the
  boundary itself is an Effect runtime or provider layer.

The current enforcement lives in
`src/lib/architecture/module-boundaries.test.ts`.

## Layer Shape

The target shape is layered domain architecture with explicit cross-cutting
boundaries:

| Layer | Role | Effect posture |
|---|---|---|
| Types | Domain contracts and public data shapes. | Keep mostly plain TypeScript. |
| Config | Parse and validate runtime configuration. | Use Effect for parse/load errors when the boundary has tests. |
| Repo | Filesystem, GitHub, Linear, CircleCI, and artifact persistence. | Use Effect services to hide external I/O and retries. |
| Service | Business rules and orchestration inside one domain. | Prefer Effect when sequencing, typed failures, or dependency injection reduce caller complexity. |
| Runtime | Runs Effects, provides layers, cancellation, and interruption. | Keep runtime wiring narrow and explicit. |
| Providers | External service adapters and test doubles. | Use Effect layers to swap live and fixture providers. |
| UI / CLI | Human-facing command and output surfaces. | Do not import Effect directly until a runtime boundary is established. |

## Approved Boundaries

Approved production Effect boundaries:

- `src/lib/missing-context/classifier.ts`
  - Routes missing closeout evidence to durable system-gap destinations.
  - Preserves the synchronous classifier while exposing an Effect seam.
- `src/lib/pr-closeout/evaluator.ts`
  - Builds `pr-closeout/v1` reports behind the stable
    `src/lib/pr-closeout.ts` public interface.
  - Preserves the synchronous report builder while exposing an Effect seam for
    future provider, retry, and runtime-evidence work.

Boundary reasons:

- The missing-context classifier has a stable public interface and seam tests in
  `src/lib/missing-context/classifier.test.ts`.
- The PR closeout evaluator has a stable public interface through
  `src/lib/pr-closeout.ts` and seam tests in `src/lib/pr-closeout.test.ts`.
- Both approved boundaries are part of the closeout-truth path where typed
  evidence, provider substitution, recovery, and Project Brain routing can grow
  behind stable caller interfaces.

The synchronous APIs remain available for existing callers. The Effect APIs sit
behind the same module boundaries so later work can move more closeout evidence
classification and report construction into typed effects without forcing
callers to understand Effect.

## Agent Control Contract

A deep module boundary is approved for agent work only when the executable
boundary is specified. For the current PR closeout module:

- Callers use `src/lib/pr-closeout.ts` only.
- `src/lib/pr-closeout/types.ts` owns the public report and claim contract.
- `src/lib/pr-closeout/evaluator.ts` is the only PR closeout file allowed to
  import Effect.
- `src/lib/pr-closeout/blockers.ts` may adapt HE phase-exit gate evidence into
  closeout blockers and may only import the declared phase-exit contract.
- `src/lib/pr-closeout/claim-helpers.ts` may classify missing context but may
  not reach into command, runtime, or provider code.
- `src/lib/pr-closeout/claim-builders.ts` composes the required claim ledger
  from normalized verifier evidence and stays inside the module.
- `src/lib/pr-closeout/claims.ts` projects claim failures into blockers and
  stays implementation-internal.
- `src/lib/pr-closeout/status.ts` owns the private closeout decision predicates
  and next-action derivation behind the public report builder.
- `src/lib/architecture/module-boundaries.test.ts` declares the allowed parent
  imports for internals; new parent imports require updating that explicit
  boundary map.
- `scripts/check-pr-closeout-truth-contract.cjs` guards the claim/report
  contract so a split cannot silently drop required evidence surfaces.

## Migration Sequence

1. Keep Effect imports constrained to approved deep modules.
2. Add an Effect API behind an existing seam while preserving the current public
   synchronous API.
3. Add or extend boundary tests proving the Effect API and current API produce
   the same caller-visible result.
4. Move only one behavior family at a time behind the boundary.
5. Add provider layers only when there is real I/O, retry, cancellation, or test
   double pressure.
6. Promote the boundary to command/runtime wiring only after tests prove the
   module is deep enough to hide the extra machinery.

## Deep Module Checklist

A module is agent-safe only when all of these are true:

- The public interface is smaller than the implementation it hides.
- Callers do not need to know implementation order, provider details, retry
  behavior, or storage representation.
- The module has seam tests that pin behavior at the public boundary.
- Blast radius for common edits stays inside the module directory.
- Failure classes are named and returned through the boundary.
- Internal helpers do not leak into unrelated command or app-wiring code.

## Effect Usage Rules

- Use Effect to pull complexity downward, not to decorate pure one-line helpers.
- Prefer plain TypeScript types for domain contracts that do not need runtime
  effects.
- Use Effect for I/O boundaries, typed failures, dependency injection, retries,
  cancellation, and resource scoping when those concerns would otherwise leak to
  callers.
- Keep Effect runtime execution at a narrow boundary. Do not scatter
  `Effect.runSync` or `Effect.runPromise` through command code.
- Do not migrate a shallow module merely to make it "use Effect"; deepen the
  module first with a stable interface and boundary tests.

## Non-Goals

- A repo-wide rewrite.
- Replacing every `Result` shape immediately.
- Moving command runners to Effect before validation, PR closeout, and runtime
  evidence modules have stable boundaries.
- Introducing broad provider layers without a tested caller-visible benefit.

## Validation

For each migration slice, run the narrowest seam tests first, then the repo
quality gates required by the touched surface. At minimum:

- `pnpm vitest run <changed-boundary-test>`
- `pnpm vitest run src/lib/architecture/module-boundaries.test.ts`
- `pnpm run test:related`
- `pnpm run quality:size`
- `pnpm typecheck`
