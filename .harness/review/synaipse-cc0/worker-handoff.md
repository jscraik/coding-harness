# CC0 Worker Handoff — Failure-Envelope Compatibility Boundary

**Observed:** 2026-07-19T15:39:16Z  
**Target:** `codex/synaipse-cc0-contract-boundary` at
`638dc77d470a23199b40c130d327a6aa5583b6d6`  
**Packet:** `pkt_synaipsecc0wrk` / SHA-256
`5b95b374dc4e82d325a513b81b55da0bef8f8dd23e8a7e003fb1b184798976eb`

## Instruction Attestation

I read the immutable Worker packet; the target instruction chain
`AGENTS.md`, `src/AGENTS.md`, `contracts/AGENTS.md`, and `CODESTYLE.md`; the
Coding Harness quickstart and instruction map; the CC0 handoff; and the
2026-07-19 convergence specification and plan in the isolated planning
worktree. I also read `.harness/memory/LEARNINGS.md`. The planning worktree
was reference-only and was not modified. The requested workforce runtime is
GPT-5.6-luna/xhigh; this child transport does not expose a model attestation,
so no observed model configuration is claimed.

The artifact-probe receipt was present before work at
`.harness/review/synaipse-cc0/worker-artifact-probe.json` with SHA-256
`166ed1925c79f95ded021ac47db837e4d7ef4a83fd4bace7efd551296ce11869`.

## Findings

1. **P1 — Canonical failure envelope selected.** The current state-v1 schema
   and validator reject unknown fields, but `HarnessDecision.meta` is an
   additive object. The compatible owner is therefore
   `meta.synaipseContextFailures` with
   `synaipse-context-failure-envelope/v1`, produced at the context
   normalization-to-`next` decision projection boundary. See the implementation
   brief for the required record and four-way compatibility matrix.
2. **P1 — `contextUnknowns` must remain narrow.** Current parsers require a
   `ch_context` ID and one of three legacy optional-failure reasons. Project,
   catalog, and required-transition failures cannot safely use that shape.
3. **P2 — Effect attribution is already split but not named symmetrically.**
   State `invocationEffects` is fixed pure read; top-level decision flags are
   recommendation flags. CC1 should introduce a named recommendation-effects
   projection without changing existing v1 fields.
4. **P2 — Packet self-blocks its clean-worktree route.** The immutable packet
   and probe are untracked control artifacts. Consequently, its exact required
   `next --json` command reports `worktree_state_blocked` under the default
   clean role. The Worker cannot alter those artifacts or replace the immutable
   command, so the result is correctly `blocked_validation` rather than an
   accepted result.

## Evidence

- `src/lib/synaipse/context-contract.ts` defines the legacy
  `CONTEXT_UNKNOWN_REASONS` vocabulary.
- `src/lib/synaipse/context-plane.ts` creates blockers/unknowns and deterministic
  recoveries without retrieving provider bodies.
- `src/commands/next-synaipse-context.ts` maps the first blocker to the
  decision and preserves selected/unknown state projections.
- `src/lib/synaipse/state.ts`, `state-validation.ts`, and
  `contracts/synaipse-state.schema.json` make state-v1 strict and its
  invocation effect pure read.
- `src/commands/next-runner.ts` and `src/commands/next.ts` attach state to
  normal and usage-error decision paths; `package.json` ships the CLI and
  `src/lib/**/*.ts`, leaving external deep-import consumers unknown.
- `src/commands/next-prompt-context-drift.ts` calculates top-level
  recommendation `writesFiles`; `HarnessDecision` types describe top-level
  `safeToRun`, authority, retry, and write fields as next-action attributes.

## Exact Commands

- Command: `pnpm exec vitest run src/lib/synaipse/context-contract.test.ts src/lib/synaipse/state.test.ts src/commands/next.test.ts --reporter=dot` -> pass (3 test files, 96 tests).
- Command: `node --import tsx src/cli.ts next --json` -> blocked (default clean worktree role detected the immutable Worker packet and probe as untracked control artifacts; output failure class `worktree_state_blocked`).
- Command: `node --import tsx src/cli.ts --help` -> pass (names `harness next --json` as the start route).
- Command: `node --import tsx src/cli.ts next --json --worktree-role dirty-with-justification` -> pass (read-only orientation fallback; emitted valid decision and `synaipseState.invocationEffects.writesFiles: false`).

## Required PM Action

Preserve this Worker output, then decide whether to repair the next Workforce
packet before re-dispatch: either run the required orientation command before
creating control artifacts, or make its packet-required command explicitly
use the already-authorized dirty-with-justification role. Do not treat the
fallback command as a substitute for the immutable required command.

## Claims Boundary

The mapping and focused tests establish current local source/contract evidence
only. They do not establish a new runtime implementation, schema/package
compatibility, canary behavior, hosted CI, review, acceptance, merge, release,
or readiness. CC1 and CC2 remain blocked until a fresh implementation
admission and its Worker, QA Disproof, and Adversarial Review sequence.

WROTE: .harness/review/synaipse-cc0/worker-handoff.md
