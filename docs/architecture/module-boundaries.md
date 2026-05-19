---
last_validated: 2026-05-19
---

# Module Boundaries

## Table of Contents
- [Purpose](#purpose)
- [Deep Module And Effect Boundaries](#deep-module-and-effect-boundaries)
- [Agent Boundary Enforcement](#agent-boundary-enforcement)
- [CLI Registry Boundaries](#cli-registry-boundaries)
- [Command Facade Boundaries](#command-facade-boundaries)
- [Doctor Command Boundaries](#doctor-command-boundaries)
- [Harness Next Command Boundaries](#harness-next-command-boundaries)
- [Replay Command Boundaries](#replay-command-boundaries)
- [Runtime Card Command Boundaries](#runtime-card-command-boundaries)
- [Runtime Card Runtime Boundaries](#runtime-card-runtime-boundaries)
- [Contract Validator Boundaries](#contract-validator-boundaries)
- [Enforcement](#enforcement)

## Purpose

Define the bounded module layout for high-change control-plane surfaces so command growth and policy evolution do not reintroduce single-file concentration risk.

## Deep Module And Effect Boundaries

Effect adoption is governed by [Effect Deep Module Boundaries](./effect-deep-modules.md).
New Effect imports must start inside an approved deep module boundary with a
stable public interface and seam tests before command, UI, or app-wiring code
can depend on them directly.

## Agent Boundary Enforcement

Approved deep modules are agent control surfaces, not just folders. The
boundary contract is:

- Callers import the public facade, not implementation files.
- Internal files may import sibling internals freely inside the same module.
- Parent-directory imports from internals must be declared in
  `src/lib/architecture/module-boundaries.test.ts`.
- Effect imports must stay inside approved Effect boundary files.
- Contract tests must fail if the public facade, contract file, evaluator, or
  required seam tests are removed.

The current PR closeout boundary is:

- Public facade: `src/lib/pr-closeout.ts`
- Contract: `src/lib/pr-closeout/types.ts`
- Effect evaluator: `src/lib/pr-closeout/evaluator.ts`
- Internal recovery metadata seam: `src/lib/pr-closeout/recovery.ts`
- Internal gate blocker adapter: `src/lib/pr-closeout/blockers.ts`
- Internal claim helpers: `src/lib/pr-closeout/claim-helpers.ts`
- Internal claim builders: `src/lib/pr-closeout/claim-builders.ts`
- Internal blocker projection: `src/lib/pr-closeout/claims.ts`
- Internal status decision predicates: `src/lib/pr-closeout/status.ts`
- Seam tests: `src/lib/pr-closeout.test.ts`

## CLI Registry Boundaries

CLI registry modules are split into a loader plus focused policy modules:

- `src/lib/cli/command-registry.ts`
  - Thin orchestration layer for dispatch/index/help output.
- `src/lib/cli/registry/command-capabilities.ts`
  - Command catalog schema and capability metadata (category, mutability, retry behavior, guardrails).
- `src/lib/cli/registry/fuzzy-resolution.ts`
  - Command normalization, fuzzy resolution, and suggestion scoring.
- `src/lib/cli/registry/command-specs.ts`
  - Canonical command manifest bindings to command implementations.

## Command Facade Boundaries

PR closeout command wiring is being split into a command facade boundary:

- `src/commands/pr-closeout.ts`
  - Public command entrypoint; keeps `runPrCloseoutCLI` and output behavior.
- `src/commands/pr-closeout/args.ts`
  - Pure argument parser and `PrCloseoutCLIOptions` contract.
- `src/commands/pr-closeout/env.ts`
  - Env-file loader seam for `~/.codex/.env` credentials and `codex_env`
    evidence projection.
- `src/commands/pr-closeout/live.ts`
  - Live evidence collector seam for PR metadata, check proof, review threads,
    tool evidence, branch cleanliness, rollback, and traceability.
- `src/commands/pr-closeout/types.ts`
  - Shared command-runner contract for live evidence adapters.

The command facade should stay thin: argument parsing, environment loading,
live input collection, and output rendering should move into named command
submodules while callers keep using `runPrCloseoutCLI`.

Current next pressure points:

- `src/commands/pr-closeout.ts` still owns normalized-input parsing and output
  rendering; split only if those grow or start mixing runtime concerns.
- The visual reference in `artifacts/architecture/module-layout.html` must be
  updated after each command-facade split. Browser verification is only complete
  after the in-app Browser shows the updated artifact. Prefer
  `http://127.0.0.1:4179/module-layout.html` for verification because the
  Browser plugin may block inspection or reload of `file://` tabs.

## Doctor Command Boundaries

The doctor command is a command facade plus focused seams:

- `src/commands/doctor.ts`
  - Public command entrypoint, report construction, CLI dispatch, and JSON output.
- `src/commands/doctor-renderer.ts`
  - Human-readable terminal renderer for `DoctorReport`.
- `src/commands/doctor-checks.ts`
  - Thin check catalogue that composes check families.
- `src/commands/doctor-*-checks.ts`
  - Check-family modules for tools, files, config, and CI.
- `src/commands/doctor-github-tool-checks.ts`
  - Provider-specific GitHub CLI availability and authentication checks.
- `src/commands/doctor-roadmap-file-checks.ts`
  - Roadmap governance document presence checks for north-star and agent-first
    status surfaces.
- `src/commands/doctor-ci-check-alignment.ts`
  - Required-check identity and branch-protection check-name alignment.
- `src/commands/doctor-north-star-contract-checks.ts`
  - North-star contract readiness and governed product-surface ownership checks.
- `src/commands/doctor-artifacts.ts`
  - North-star surface classification artifact writer.
- `src/commands/doctor-recovery.ts`
  - Recovery guidance attachment and rendering helpers.

The doctor facade must stay report-oriented. Agents can work inside check
families, artifact writing, recovery guidance, or the renderer, but caller
behavior remains locked through `runDoctor`, `runDoctorCLI`, and the doctor
tests. Provider-specific tool checks should sit behind named tool seams instead
of growing the generic tool-check catalogue. Roadmap governance document checks
should sit behind named file seams instead of growing the baseline file-check
catalogue. Required-check identity checks should sit behind named CI seams
instead of growing the provider config-check catalogue. North-star contract
readiness checks should sit behind named config seams instead of growing the
generic contract key-presence catalogue.

## Harness Next Command Boundaries

Harness next is a command facade plus decision producer:

- `src/commands/next.ts`
  - Public command entrypoint, decision production, evidence gating, artifact
    loading, and CLI output.
- `src/commands/next-args.ts`
  - Pure CLI token parser for `--mode`, `--files`, `--evidence`,
    `--phase-exit`, and `--runtime-card`.
- `src/commands/next-runner.ts`
  - Decision producer seam for source checks, evidence blockers, changed-file
    resolution, fleet-matrix detection, and recommendation selection.
- `src/commands/next-decisions.ts`
  - Public decision seam re-exporting the stable harness-next decision interface
    while keeping decision internals private to focused modules.
- `src/commands/next-blocked-decisions.ts`
  - Blocked-decision builders for invalid modes, source blockers, git
    inspection failures, HE phase-exit blockers, and runtime-card blockers.
- `src/commands/next-decision-meta.ts`
  - Shared decision metadata assembly for normalized source, HE phase-exit, and
    runtime-card evidence.
- `src/commands/next-recommendation-decisions.ts`
  - Recommendation builders for no-change, changed-file, and fleet-matrix
    decisions.
- `src/commands/next-usage-errors.ts`
  - Usage-error decision seam that translates parser failures into blocked
    `HarnessDecision` values.

The `runHarnessNext` decision path should stay separate from token parsing.
Agents can evolve CLI flags inside `next-args.ts`, source orchestration inside
`next-runner.ts`, decision metadata inside `next-decision-meta.ts`, blocked
decision copy inside `next-blocked-decisions.ts`, recommendations inside
`next-recommendation-decisions.ts`, and usage-error copy inside
`next-usage-errors.ts` while the runtime decision surface remains locked
through `runHarnessNext`, `runNextCLI`, and next tests. Future splits should
prefer evidence-loading seams before adding more branches to
`src/commands/next.ts`.

## Replay Command Boundaries

Replay is a command facade plus a canonical run-record seam:

- `src/commands/replay.ts`
  - Public CLI entrypoint, trace directory validation, trace listing, trace
    loading, replay dispatch, and terminal/JSON output.
- `src/commands/replay-run-record.ts`
  - Canonical run-record emission for replay outcomes, including replay
    attempt-ledger metadata, recovery-event metadata, policy context hashing,
    and precondition projection.

The replay facade should stay about operator input, trace selection, and replay
execution. Recovery ownership, retry-stop reasoning, and run-record payload
construction should stay in `replay-run-record.ts` so agents can adjust
operational metadata without changing trace replay behavior.

## Runtime Card Command Boundaries

Runtime card is a command facade plus artifact/evidence safety surface:

- `src/commands/runtime-card.ts`
  - Public CLI entrypoint, runtime-card building, artifact confinement,
    evidence-bundle writing, and human/JSON output.
- `src/commands/runtime-card-args.ts`
  - Pure CLI token parser and `RuntimeCardCLIOptions` contract for `--repo`,
    `--context`, `--issue`, `--phase-exit`, `--evidence`, `--out`,
    `--evidence-out`, `--json`, and `--live`.

Runtime-card artifact path safety should stay in the command facade until it
has its own tested filesystem boundary. Parser changes should stay inside
`runtime-card-args.ts` so runtime evidence behavior remains reviewable through
`runRuntimeCardCLI` and runtime-card tests.

## Runtime Card Runtime Boundaries

Runtime-card state is a public contract plus focused validation seams:

- `src/lib/runtime/runtime-card.ts`
  - Public contract for runtime-card/v1 types, schema version, blocker
    predicate, and normalized metadata projection.
- `src/lib/runtime/runtime-card-validation.ts`
  - Runtime-card shape validation seam for core card fields, source freshness,
    tracker state, artifact state, and phase-exit state.
- `src/lib/runtime/runtime-card-recovery-validation.ts`
  - Runtime-card recovery validation seam for attempt-ledger and recovery-event
    metadata.

Local runtime-card generation is a runtime evidence facade plus focused seams:

- `src/lib/runtime/local-runtime-card.ts`
  - Public builder entrypoint for `buildLocalRuntimeCard` and
    `buildLiveRuntimeCard`; collects git, active artifact, phase-exit, imported
    evidence-bundle, and optional live-provider snapshots before delegating
    card construction.
- `src/lib/runtime/local-runtime-card-assembly.ts`
  - Runtime-card assembly seam for lifecycle derivation, blocker/source
    merging, fallback tracker state, next-safe-action text, and schema
    validation.
- `src/lib/runtime/local-runtime-card-attempts.ts`
  - Runtime-card attempt seam for retry ownership, recovery-event shape, and
    source evidence references.
- `src/lib/runtime/local-runtime-card-artifacts.ts`
  - Active artifact index seam for `.harness/active-artifacts.md` parsing,
    spec/plan extraction, issue-key derivation, and stale reference
    classification.
- `src/lib/runtime/local-runtime-card-phase-exit.ts`
  - Phase-exit evidence seam for HePhaseExit/v1 artifact reading, validation,
    required-evidence blocker classification, and runtime-card status collapse.
- `src/lib/runtime/local-runtime-card-live.ts`
  - Live provider seam for bounded GitHub PR and Linear issue refresh, including
    provider timeouts, credential-missing classification, and live blocker
    projection.

Agents can work inside the live-provider seam without changing the local
runtime-card interface. Local evidence composition should stay in
`local-runtime-card.ts`; card construction policy should stay in
`local-runtime-card-assembly.ts`; retry/recovery metadata should stay in
`local-runtime-card-attempts.ts`; filesystem artifact behavior should stay in
`local-runtime-card-artifacts.ts`; externally owned provider behavior should
stay in `local-runtime-card-live.ts`; HePhaseExit/v1 collapse should stay in
`local-runtime-card-phase-exit.ts` unless a new evidence seam is added with
tests and an explicit architecture guard.

## Contract Validator Boundaries

Contract validation is split by responsibility:

- `src/lib/contract/validator.ts`
  - Entrypoint orchestration and cross-field validation checks.
- `src/lib/contract/validator-helpers.ts`
  - Primitive shape guards, forbidden-key protections, and reusable scalar/list validators.
- `src/lib/contract/policy-validators.ts`
  - Policy-domain validators for docs/context/pilot/remediation surfaces.

## Enforcement

Module boundaries and file-size thresholds are enforced by:

- `src/lib/architecture/module-boundaries.test.ts`

Threshold policy:

- `src/lib/cli/command-registry.ts` must remain a thin loader (`<= 220` lines).
- `src/lib/contract/validator.ts` must remain an entrypoint (`<= 2600` lines).
- `src/commands/doctor.ts` must remain a doctor command facade (`<= 210`
  lines) and import the explicit doctor seams enforced by the architecture test.
- `src/commands/doctor-tool-checks.ts` must remain a generic tool-check
  catalogue (`<= 170` lines); provider-specific tool checks move into named
  seams such as `doctor-github-tool-checks.ts`.
- `src/commands/doctor-file-checks.ts` must remain a baseline file-check
  catalogue (`<= 200` lines); roadmap governance document checks move into
  `doctor-roadmap-file-checks.ts`.
- `src/commands/doctor-ci-checks.ts` must remain a provider config-check
  catalogue (`<= 80` lines); required-check identity checks move into
  `doctor-ci-check-alignment.ts`.
- `src/commands/doctor-config-checks.ts` must remain a contract key-presence
  catalogue (`<= 90` lines); north-star contract readiness checks move into
  `doctor-north-star-contract-checks.ts`.
- `src/commands/next.ts` must remain a harness-next command facade (`<= 160`
  lines); CLI token parsing and decision production move into named seams.
- `src/commands/next-usage-errors.ts` must remain a harness-next usage-error
  decision seam (`<= 160` lines).
- `src/commands/next-runner.ts` must remain a harness-next decision producer
  seam (`<= 250` lines).
- `src/commands/replay.ts` must remain a replay command facade (`<= 330`
  lines); canonical run-record and recovery metadata moves into
  `replay-run-record.ts`.
- `src/commands/replay-run-record.ts` must remain a replay run-record seam
  (`<= 230` lines) for attempt ledger, recovery event, and policy context
  emission.
- `src/commands/runtime-card.ts` must remain a runtime-card command facade
  (`<= 300` lines); CLI token parsing moves into `runtime-card-args.ts`.
- `src/lib/runtime/runtime-card.ts` must remain a runtime-card public contract
  (`<= 260` lines); validation internals move into named validation seams.
- `src/lib/runtime/runtime-card-validation.ts` must remain a runtime-card
  validation seam (`<= 300` lines) for core shape validation.
- `src/lib/runtime/runtime-card-recovery-validation.ts` must remain a
  runtime-card recovery validation seam (`<= 220` lines) for attempt ledger and
  recovery-event checks.
- `src/lib/runtime/local-runtime-card.ts` must remain a local runtime-card
  evidence facade (`<= 180` lines); assembly, artifact inspection, phase-exit
  collapse, and live provider refresh move into focused seams.
- `src/lib/runtime/local-runtime-card-assembly.ts` must remain a runtime-card
  assembly seam (`<= 175` lines) for lifecycle, blocker/source merging,
  fallback tracker state, next-safe-action text, and schema validation.
- `src/lib/runtime/local-runtime-card-attempts.ts` must remain a runtime-card
  attempt seam (`<= 120` lines) for retry ownership, recovery-event shape, and
  evidence references.
- `src/lib/runtime/local-runtime-card-artifacts.ts` must remain an active
  artifact inspection seam (`<= 160` lines) for spec/plan extraction and stale
  reference classification.
- `src/lib/runtime/local-runtime-card-phase-exit.ts` must remain a phase-exit
  evidence seam (`<= 150` lines) for HePhaseExit/v1 validation and status
  collapse.
- `src/lib/runtime/local-runtime-card-live.ts` must remain a bounded live
  provider seam (`<= 270` lines) for GitHub and Linear refresh behavior.
- Effect imports are only allowed in approved deep module boundaries until a
  wider migration decision updates the invariant.
- PR closeout callers must import through `src/lib/pr-closeout.ts`; internal
  evidence builder modules stay behind that public boundary.
