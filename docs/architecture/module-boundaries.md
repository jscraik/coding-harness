---
last_validated: 2026-05-22
---

# Module Boundaries

## Table of Contents

- [Purpose](#purpose)
- [Deep Module And Effect Boundaries](#deep-module-and-effect-boundaries)
- [Agent Boundary Enforcement](#agent-boundary-enforcement)
- [CLI Registry Boundaries](#cli-registry-boundaries)
- [CI Migration Command Boundary](#ci-migration-command-boundary)
- [Verify Work Command Boundary](#verify-work-command-boundary)
- [Memory Gate Command Boundary](#memory-gate-command-boundary)
- [Drift Gate Command Boundary](#drift-gate-command-boundary)
- [Observability Gate Command Boundary](#observability-gate-command-boundary)
- [Artifact Gate Command Boundary](#artifact-gate-command-boundary)
- [Plan Gate Command Boundary](#plan-gate-command-boundary)
- [Prompt Gate Command Boundary](#prompt-gate-command-boundary)
- [HE Phase-Exit Trust Boundary](#he-phase-exit-trust-boundary)
- [Output Normalisation Boundaries](#output-normalisation-boundaries)
- [Command Facade Boundaries](#command-facade-boundaries)
- [Doctor Command Boundaries](#doctor-command-boundaries)
- [Harness Next Command Boundaries](#harness-next-command-boundaries)
- [Replay Command Boundaries](#replay-command-boundaries)
- [Review Gate Command Boundaries](#review-gate-command-boundaries)
- [Review Gate Decision Packet Boundaries](#review-gate-decision-packet-boundaries)
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
  - Public command catalog schema, capability derivation, and JSON document
    builders.
- `src/lib/cli/registry/command-capability-rules.ts`
  - Static capability policy tables for category, mutability, retry behavior,
    guardrails, tiers, audience, orchestrators, agent mode, and visibility.
- `src/lib/cli/registry/fuzzy-resolution.ts`
  - Command normalization, fuzzy resolution, and suggestion scoring.
- `src/lib/cli/registry/command-specs.ts`
  - Canonical command manifest bindings to command implementations.
- `src/lib/cli/registry/command-specs-core.ts`
  - Command catalog assembler; workflow-specific parsing should stay behind
    focused command adapters.
- `src/lib/cli/registry/fleet-plan-command-spec.ts`
  - Fleet-plan delegation to the fleet-plan command.
- `src/lib/cli/registry/next-command-spec.ts`
  - Next delegation to the next command.
- `src/lib/cli/registry/runtime-card-command-spec.ts`
  - Runtime-card delegation to the runtime-card command.
- `src/lib/cli/registry/pr-closeout-command-spec.ts`
  - PR closeout delegation to the PR closeout command.
- `src/lib/cli/registry/verify-coderabbit-command-spec.ts`
  - CodeRabbit review evidence adapter; CLI option mapping and command dispatch
    stay local to the provider-specific command adapter.
- `src/lib/cli/registry/verify-work-command-spec.ts`
  - Verify-work resume, repository-root, and governance CLI option adapter stay
    local to the canonical verification adapter.
- `src/lib/cli/registry/replay-command-spec.ts`
  - Registry metadata delegates raw replay arguments through the replay-owned
    CLI args seam.
- `src/lib/cli/registry/remediate-command-spec.ts`
  - Registry metadata delegates raw remediate arguments through the
    remediate-owned CLI args seam.
- `src/lib/cli/registry/gardener-command-spec.ts`
  - Gardener docs path, dry-run, JSON, and stale-days CLI option adapter stay
    local to the docs freshness command adapter.
- `src/lib/cli/registry/memory-gate-command-spec.ts`
  - Memory gate command metadata delegates raw args through the public facade;
    memory, FORJAMIE, metrics, and JSON option projection lives behind the
    Local Memory compliance seam.
- `src/lib/cli/registry/silent-error-command-spec.ts`
  - Silent-error files, directories, strictness, suggestions, and JSON CLI
    option adapter stay local to the detector command adapter.
- `src/lib/cli/registry/brainstorm-gate-command-spec.ts`
  - Brainstorm path, topic, age, strictness, and JSON CLI option adapter stay
    local to the brainstorm compliance command adapter.
- `src/lib/cli/registry/drift-gate-command-spec.ts`
  - Thin registry metadata and command adapter; raw drift-gate argv projection
    lives in `src/lib/drift-gate/cli-args.ts`.
- `src/lib/cli/registry/observability-gate-command-spec.ts`
  - Thin registry metadata and command adapter; raw metric-label gate argv
    projection lives in `src/lib/observability-gate/cli-args.ts`.
- `src/lib/cli/registry/artifact-gate-command-spec.ts`
  - Thin registry metadata and command adapter; raw generated-artifact gate argv
    projection lives in `src/lib/artifact-gate/cli-args.ts`.
- `src/lib/cli/registry/plan-gate-command-spec.ts`
  - Thin registry metadata and command adapter; raw plan-gate argv projection
    lives in `src/lib/plan-gate/cli-args.ts`.
- `src/lib/cli/registry/prompt-gate-command-spec.ts`
  - Thin registry metadata and command adapter; raw prompt-gate argv projection
    lives in `src/lib/prompt-gate/cli-args.ts`.
- `src/lib/cli/registry/linear-command-spec.ts`
  - Small public registry seam for the Linear workflow command spec.
- `src/lib/cli/registry/linear-command-runner.ts`
  - Linear workflow action parsing, value validation, and dispatch into Linear
    action adapters.
- `src/lib/cli/registry/linear-command-actions.ts`
  - Linear claim, handoff, close, prepare, sync, and triage option builders and
    command delegation.
- `src/lib/cli/registry/linear-command-options.ts`
  - Linear workflow action and flag projection shared by the runner seam.
- `src/lib/cli/registry/linear-gate-command-spec.ts`
  - Linear gate CLI option adapter and delegation to the Linear gate command.
- `src/lib/cli/registry/pr-template-gate-command-spec.ts`
  - PR template gate CLI option adapter and delegation to the PR template gate
    command.
- `src/lib/cli/registry/rule-lifecycle-gate-command-spec.ts`
  - Rule lifecycle gate CLI option adapter and delegation to the rule lifecycle
    gate command.
- `src/lib/cli/registry/policy-gate-command-spec.ts`
  - Policy gate CLI option adapter and delegation to the policy gate command.
- `src/lib/cli/registry/branch-protect-command-spec.ts`
  - Branch protection CLI option adapter, required approval parsing, and
    delegation to the branch protection command.
- `src/lib/cli/registry/check-authz-command-spec.ts`
  - Authorization check CLI option adapter and delegation to the authorization
    command.
- `src/lib/cli/registry/check-environment-command-spec.ts`
  - Environment check CLI option adapter and delegation to the environment
    command.
- `src/lib/cli/registry/check-command-spec.ts`
  - Check CLI option adapter and delegation to the check command.
- `src/lib/cli/registry/health-command-spec.ts`
  - Health delegation to the health command.
- `src/lib/cli/registry/doctor-command-spec.ts`
  - Doctor delegation to the doctor command.
- `src/lib/cli/registry/audit-command-spec.ts`
  - Audit delegation to the audit command.
- `src/lib/cli/registry/docs-gate-command-spec.ts`
  - Docs gate CLI option adapter and delegation to the docs gate command.
- `src/lib/cli/registry/org-audit-command-spec.ts`
  - Org audit delegation to the org audit command.
- `src/lib/cli/registry/tooling-audit-command-spec.ts`
  - Tooling audit delegation to the tooling audit command.
- `src/lib/cli/registry/preset-command-spec.ts`
  - Preset delegation to the preset command.
- `src/lib/cli/registry/local-memory-preflight-command-spec.ts`
  - Local Memory preflight CLI option adapter, usage-error handling, and
    delegation to the Local Memory preflight command.
- `src/lib/cli/registry/license-gate-command-spec.ts`
  - License gate CLI option adapter and delegation to the license gate command.
- `src/lib/cli/registry/symphony-check-command-spec.ts`
  - Symphony readiness CLI option adapter and delegation to the Symphony check
    command.
- `src/lib/cli/registry/workflow-generate-command-spec.ts`
  - Workflow generation CLI option adapter and delegation to the workflow
    generator command.
- `src/lib/cli/registry/risk-tier-command-spec.ts`
  - Risk tier CLI option adapter and delegation to the risk tier command.
- `src/lib/cli/registry/evidence-verify-command-spec.ts`
  - Evidence verify CLI option adapter and delegation to the evidence verify
    command.
- `src/lib/cli/registry/preflight-gate-command-spec.ts`
  - Preflight gate CLI option adapter, admission JSON parsing, and delegation to
    the preflight gate command.
- `src/lib/cli/registry/review-gate-command-spec.ts`
  - Review gate CLI option adapter and delegation to the review gate command.

The command registry should stay a catalog and dispatch surface.
`command-specs-core.ts` remains the command catalog assembler; workflow
parsing and delegation belong in named adapters:

- Linear workflow parsing stays in `linear-command-runner.ts`; Linear
  action-specific option builders and command delegation stay in
  `linear-command-actions.ts`; Linear action and flag projection stays in
  `linear-command-options.ts`; `linear-command-spec.ts` remains the registry
  seam.
- Gate CLI option adapters stay in their matching command-spec modules:
  `linear-gate-command-spec.ts`, `pr-template-gate-command-spec.ts`,
  `rule-lifecycle-gate-command-spec.ts`, `policy-gate-command-spec.ts`,
  `branch-protect-command-spec.ts`, `check-authz-command-spec.ts`,
  `check-command-spec.ts`, `check-environment-command-spec.ts`,
  `docs-gate-command-spec.ts`, `license-gate-command-spec.ts`,
  `risk-tier-command-spec.ts`, `evidence-verify-command-spec.ts`,
  `observability-gate-command-spec.ts`, `artifact-gate-command-spec.ts`,
  `preflight-gate-command-spec.ts`, and `review-gate-command-spec.ts`.
- Workflow command adapters own their focused parsing and delegation:
  `verify-work-command-spec.ts`, `replay-command-spec.ts`,
  `remediate-command-spec.ts`,
  `gardener-command-spec.ts`, `memory-gate-command-spec.ts`,
  `silent-error-command-spec.ts`, `brainstorm-gate-command-spec.ts`,
  `verify-coderabbit-command-spec.ts`,
  `local-memory-preflight-command-spec.ts`,
  `symphony-check-command-spec.ts`, and
  `workflow-generate-command-spec.ts`.
- Pure delegation seams stay thin in `fleet-plan-command-spec.ts`,
  `next-command-spec.ts`, `runtime-card-command-spec.ts`,
  `pr-closeout-command-spec.ts`, `health-command-spec.ts`,
  `doctor-command-spec.ts`, `audit-command-spec.ts`,
  `org-audit-command-spec.ts`, `tooling-audit-command-spec.ts`, and
  `preset-command-spec.ts`.

## CI Migration Command Boundary

CI migration remains a transitional command core, but snapshot-owned control
plane state should move behind focused CI modules before the command facade
absorbs more safety policy.

- `src/commands/ci-migrate-core.ts`
  - Transitional command orchestration, action dispatch, and migration report
    assembly. It must keep moving policy-specific clusters into named CI
    modules.
- `src/lib/ci/ci-migrate-merge-queue-window.ts`
  - Signed merge-queue cutover window state, replay-binding shape validation,
    signature verification, terminal-window admission, and lifecycle-state
    writes for prepare/apply/commit flows.
- `src/lib/ci/repo-bound-paths.ts`
  - Repository-bounded configured path resolution, file URL resolution, symlink
    rejection, and allowlisted restore-path safety checks.

Executable guards in `src/lib/architecture/module-boundaries.test.ts` ratchet
the command core, merge-queue window module, and repository path-safety module
so signed lifecycle-state and path traversal policy do not grow back into the
command orchestration file.

## Verify Work Command Boundary

Verify-work is the closeout trust surface for repo-local validation. Its command
catalog adapter stays small while raw CLI parsing, wrapper execution, and
option-to-flag mapping live behind a deep module seam:

- `src/commands/verify-work.ts`
  - Command facade that preserves the existing CLI export contract and imports
    only `src/lib/verify-work.ts`.
- `src/lib/verify-work.ts`
  - Public facade for verify-work raw-argument parsing, execution, runtime
    adapter, exit codes, and CLI option types.
- `src/lib/verify-work/cli-args.ts`
  - Internal raw CLI argument validation and typed option projection seam.
- `src/lib/verify-work/args.ts`
  - Internal wrapper flag construction seam.
- `src/lib/verify-work/runner.ts`
  - Internal wrapper execution, precondition, spawn-error, signal, and exit-code
    mapping seam.
- `src/lib/verify-work/types.ts`
  - Public command option and exit-code contract.

Executable guards in `src/lib/architecture/module-boundaries.test.ts` keep the
command adapter thin, ratchet the internal modules, and fail if callers bypass
the public facade to import `src/lib/verify-work/*` internals.

## Memory Gate Command Boundary

Memory-gate is the Local Memory compliance control surface. Its callers should
not reach into validator internals directly because the validator owns schema
checks, read-first discipline, closeout checks, branch enforcement, metrics, and
terminal or JSON presentation. The public seam is deliberately small:

- `src/commands/memory-gate.ts`
  - Command facade that preserves the existing CLI export contract and imports
    only `src/lib/memory-gate.ts`.
- `src/lib/memory-gate.ts`
  - Public facade for memory-gate execution, raw CLI argument adaptation, and
    command option types.
- `src/lib/memory/cli-args.ts`
  - Internal raw CLI argument adapter for memory, FORJAMIE, metrics, and JSON
    flags before command execution.
- `src/lib/memory/validator.ts`
  - Internal Local Memory compliance validator.
- `src/lib/memory/cli.ts`
  - Internal CLI presentation, metrics persistence, trend reporting, and Codex
    branch display seam.
- `src/lib/memory/types.ts`
  - Internal schema, result, metrics, and option contract exported through the
    public facade.
- `src/lib/cli/registry/memory-gate-command-spec.ts`
  - Registry metadata adapter; delegates raw args through the public facade
    rather than owning option projection or importing memory internals.

Executable guards in `src/lib/architecture/module-boundaries.test.ts` ratchet
the command, facade, registry adapter, raw CLI argument adapter, validator, CLI
presentation seam, and type contract, and fail if callers bypass
`src/lib/memory-gate.ts` to import `src/lib/memory/*` internals.

## Drift Gate Command Boundary

Drift-gate is the consistency-drift control surface for governance artifacts.
Its current implementation still lives behind the command facade, but callers in
`src/lib/**` must enter through a stable public interface:

- `src/commands/drift-gate.ts`
  - Existing command facade and CLI export contract.
- `src/lib/drift-gate.ts`
  - Public facade for `runDriftGate`, `runDriftGateCLI`, and drift-gate result
    and option types.
- `src/lib/drift-gate/cli-args.ts`
  - Raw CLI option adapter for mode, baseline seeding, output, suppression,
    repository root, and JSON; converts argv into the typed facade contract.
- `src/lib/cli/registry/drift-gate-command-spec.ts`
  - Thin registry command adapter; delegates raw argv to the drift-gate-owned
    CLI option adapter.
- `src/lib/output/normalise-drift-gate.ts`
  - GateResult projection for drift findings and artifact evidence; imports
    drift-gate types through the public facade.
- `src/lib/architecture/module-boundaries.test.ts`
  - Ratchets the facade and fails if new `src/lib/**` callers import
    `src/commands/drift-gate.ts` directly.

## Observability Gate Command Boundary

Observability-gate is a metric-label cardinality control surface. It does not
claim full trace, dashboard, or telemetry maturity; it gates whether command
labels are safe enough for low-cardinality metrics.

- `src/commands/observability-gate.ts`
  - Compatibility command facade and CLI export contract.
- `src/lib/observability-gate.ts`
  - Public facade for `runObservabilityGate`, `runObservabilityGateCLI`, raw
    argv execution, and observability-gate result and option types.
- `src/lib/observability-gate/cli-args.ts`
  - Raw CLI option adapter for `--labels`, `--max-cardinality`, `--max-length`,
    and JSON output.
- `src/lib/observability-gate/label-cardinality.ts`
  - Metric-label JSON parsing, cardinality policy construction, and validation
    against `src/lib/policy/cardinality.ts`.
- `src/lib/observability-gate/cli.ts`
  - CLI result presentation and exit-code mapping.
- `src/lib/cli/registry/observability-gate-command-spec.ts`
  - Thin registry command adapter; delegates raw argv to the
    observability-gate-owned CLI option adapter.
- `src/lib/architecture/module-boundaries.test.ts`
  - Ratchets the command facade, public facade, registry adapter, raw CLI
    adapter, label-cardinality seam, CLI presentation seam, and type contract.

## Artifact Gate Command Boundary

Artifact-gate is the generated-artifact provenance control surface. It checks
whether generated files and their source templates move together without
turning the command registry into a provenance evaluator or CLI parser.

- `src/commands/artifact-gate.ts`
  - Compatibility command facade and CLI export contract.
- `src/lib/artifact-gate.ts`
  - Public facade for `runArtifactGate`, `runArtifactGateCLI`, raw argv
    execution, artifact-gate CLI types, and the artifact-provenance evaluator
    contract.
- `src/lib/artifact-gate/cli-args.ts`
  - Raw CLI option adapter for `--files`, `--registry`, and JSON output,
    including missing-value usage errors.
- `src/lib/artifact-gate/cli.ts`
  - Usage output, gate result presentation, and exit-code mapping.
- `src/lib/artifact-gate/types.ts`
  - Small CLI option and usage-error contract shared by command and registry
    callers.
- `src/lib/artifact-provenance.ts`
  - Registry loading, registry validation, artifact/source drift evaluation,
    and artifact-gate result construction.
- `src/lib/cli/registry/artifact-gate-command-spec.ts`
  - Thin registry command adapter; delegates raw argv to the
    artifact-gate-owned CLI option adapter.
- `src/lib/architecture/module-boundaries.test.ts`
  - Ratchets the command facade, public facade, registry adapter, raw CLI
    adapter, CLI presentation seam, and type contract.

## Plan Gate Command Boundary

Plan-gate is the planning-artifact control surface. It validates plan documents,
plan IDs, acceptance evidence, and PR traceability without turning the command
facade or registry manifest into a plan parser, result renderer, or recovery
hint table.

- `src/commands/plan-gate.ts`
  - Compatibility command facade and workflow-plan re-export contract.
- `src/lib/plan-gate/cli-args.ts`
  - Raw CLI option adapter for plan path, type, age, plan IDs, PR metadata,
    changed files, strictness, and JSON/traceability requirements.
- `src/lib/plan-gate/cli.ts`
  - Plan-gate execution, terminal/JSON presentation, recovery hints, and
    exit-code mapping.
- `src/lib/plan-gate/detector.ts`
  - Plan artifact discovery and validation behavior.
- `src/lib/plan-gate/types.ts`
  - Shared plan-gate option and exit-code contract.
- `src/lib/cli/registry/plan-gate-command-spec.ts`
  - Thin registry command adapter; delegates raw argv to the
    plan-gate-owned CLI option adapter.
- `src/lib/architecture/module-boundaries.test.ts`
  - Ratchets the command facade, registry adapter, raw CLI adapter, and CLI
    presentation seam.

## Prompt Gate Command Boundary

Prompt-gate is the prompt-template compliance surface. It validates required
prompt sections for feature, bug fix, refactor, and release prompts without
letting the command facade or registry manifest become a Markdown parser,
usage-error adapter, or terminal renderer.

- `src/commands/prompt-gate.ts`
  - Compatibility command facade and stable public export surface.
- `src/lib/prompt-gate/cli-args.ts`
  - Raw CLI option adapter for prompt type, prompt file, and JSON output.
- `src/lib/prompt-gate/cli.ts`
  - Prompt-gate execution, terminal/JSON presentation, and exit-code mapping.
- `src/lib/prompt-gate/validator.ts`
  - Prompt template section discovery, checkbox counting, file read failure
    classification, and validation-result construction.
- `src/lib/prompt-gate/types.ts`
  - Shared prompt-gate option, prompt-type, result, and exit-code contract.
- `src/lib/cli/registry/prompt-gate-command-spec.ts`
  - Thin registry command adapter; delegates raw argv to the prompt-gate-owned
    CLI option adapter.
- `src/lib/architecture/module-boundaries.test.ts`
  - Ratchets the command facade, registry adapter, raw CLI adapter, validator,
    and CLI presentation seam.

## Output Normalisation Boundaries

Output normalisation is a public facade plus focused gate adapter seams:

- `src/lib/output/normalise.ts`
  - Public export facade for gate normalisation helpers and canonical result
    types.
- `src/lib/output/normalise-core-v2.ts`
  - Compatibility export surface for focused adapter modules and canonical
    normalisation helpers.
- `src/lib/output/normalise-drift-gate.ts`
  - Drift findings, artifact evidence references, and `GateResult` projection.
- `src/lib/output/normalise-docs-gate.ts`
  - Docs findings, metadata, and `GateResult` projection.
- `src/lib/output/normalise-plan-gate.ts`
  - Plan validation findings, recovery hints, and `GateResult` projection.
- `src/lib/output/normalise-policy-gate.ts`
  - Policy tier findings, decision metadata, and `GateResult` projection.
- `src/lib/output/normalise-pr-template-gate.ts`
  - PR template validation findings and `GateResult` projection.
- `src/lib/output/normalise-renderer.ts`
  - Terminal presentation seam for normalized gate results.
- `src/lib/output/normalise-he-phase-exit.ts`
  - HE phase-exit findings, evidence references, gate summary metadata, and
    `GateResult` projection.
- `src/lib/output/normalise-linear-gate.ts`
  - Linear gate failure classification and `GateResult` projection.

The facade should stay tiny, and gate-specific classification should not grow
inside `normalise-core-v2.ts`. Agents can adjust drift artifact projection in
`normalise-drift-gate.ts`, Linear gate retry/failure
classification in `normalise-linear-gate.ts`, policy tier projection in
`normalise-policy-gate.ts`, docs metadata projection in
`normalise-docs-gate.ts`, plan validation projection in
`normalise-plan-gate.ts`, PR template projection in
`normalise-pr-template-gate.ts`, or HE phase-exit projection in
`normalise-he-phase-exit.ts`. Terminal rendering changes stay in
`normalise-renderer.ts` while callers continue importing through
`src/lib/output/normalise.ts` and seam tests preserve the public export contract.

## HE Phase-Exit Trust Boundary

HE phase-exit validation remains a public facade plus focused trust-policy seam:

- `src/lib/decision/he-phase-exit.ts`
  - Public facade for HE phase-exit contracts, validators, adapters, and validation artifact helpers.
- `src/lib/decision/he-phase-exit-core.ts`
  - Gate schemas, payload validation, aggregation, and public `validateHeGateResult` / `validateHePhaseExit` entrypoints.
- `src/lib/decision/he-gate-trust-policy.ts`
  - Internal trust-policy seam for status, execution-mode, gate-local evidence, open-finding, blocker-reason, skipped-gate, and finding evidence-reference rules.
- `src/lib/decision/he-gate-trust-policy.test.ts`
  - Direct seam tests proving summary-only evidence, `validation_only`, skipped execution modes, and findings without evidence references cannot satisfy gate trust.

The phase-exit core should stay the contract and aggregation surface. Trust rules
that decide whether a gate result is real proof live in `he-gate-trust-policy.ts`,
so agents can harden gate semantics without mixing payload schemas, aggregation,
and trust classification in one file.

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

- `src/lib/replay/cli-args.ts`
  - Raw replay CLI token projection and delegation into the typed replay
    command contract.
- `src/lib/replay/options.ts`
  - Shared replay option, trace config, and trace resolution failure contracts.
- `src/commands/replay-output.ts`
  - Terminal and JSON replay output rendering.
- `src/commands/replay-resolution.ts`
  - Trace directory validation and trace lookup before replay execution.
- `src/commands/replay.ts`
  - Public CLI entrypoint, trace listing orchestration, replay dispatch, and
    run-record outcome emission.
- `src/commands/replay-run-record.ts`
  - Canonical run-record emission for replay outcomes, including replay
    attempt-ledger metadata, recovery-event metadata, policy context hashing,
    and precondition projection.

The replay facade should stay about orchestration and replay execution. Raw argv
projection stays in `src/lib/replay/cli-args.ts`, shared replay contracts stay
in `src/lib/replay/options.ts`, output rendering stays in
`replay-output.ts`, and trace lookup stays in `replay-resolution.ts`.
Recovery ownership, retry-stop reasoning, and run-record payload construction should stay in
`replay-run-record.ts` so agents can adjust operational metadata without
changing trace replay behavior.

## Review Gate Command Boundaries

Review gate is a command facade plus focused validation and artifact seams:

- `src/commands/review-gate.ts`
  - Public compatibility facade for `review-gate-core.ts`.
- `src/commands/review-gate-core.ts`
  - Runtime orchestration for PR loading, review policy evaluation, polling,
    reviewer independence, review-context readiness, authz preflight, and
    terminal output.
- `src/lib/review-gate/required-checks.ts`
  - Required-check name resolution, alias resolution, check-run source matching,
    and check-run blocker projection.
- `src/lib/review-gate/required-check-sources.ts`
  - Provider identity normalization, explicit external-check source authority,
    and active-provider source constraint assembly.
- `src/lib/review-gate/required-check-manifest.ts`
  - Required-check manifest path resolution, JSON loading, normalization, and
    manifest-specific validation errors.

The command core should stay about orchestration and policy composition.
Required-check identity, aliases, and source-authority constraints stay in
`required-checks.ts` and `required-check-sources.ts`; manifest parsing stays in
`required-check-manifest.ts`
so agents can adjust CI provider mapping without changing the main review-gate
control flow.

## Review Gate Decision Packet Boundaries

Review-gate decision artifacts are split into an artifact assembly seam plus
focused operational metadata seams:

- `src/lib/review-gate/decision-packet.ts`
  - Public artifact emitter for `emitReviewGateDecisionArtifacts`; assembles
    the review decision packet, North Star alignment artifact, and run-record
    handoff.
- `src/lib/review-gate/decision-packet-types.ts`
  - Internal shared type seam for artifact input, decision classification, and
    emitted artifact references.
- `src/lib/review-gate/recovery.ts`
  - Attempt-ledger and recovery-event seam for review-gate retry ownership,
    failure class, stop reason, and next action.
- `src/lib/review-gate/run-record.ts`
  - Terminal run-record seam for outcome classification, event status,
    severity, policy context, and decision payload projection.

The decision-packet emitter should stay about artifact construction and durable
handoff. Agents can adjust retry ownership in `recovery.ts` or terminal
run-record semantics in `run-record.ts` without changing the artifact assembly
interface.

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
- `src/lib/cli/registry/command-capabilities.ts` must remain a command catalog
  builder seam (`<= 360` lines); static policy tables move into
  `command-capability-rules.ts`.
- `src/lib/cli/registry/command-capability-rules.ts` must remain a static
  capability policy-table seam (`<= 340` lines).
- `src/lib/cli/registry/command-specs-core.ts` must remain a command catalog
  assembler (`<= 1300` lines); workflow-specific parsing belongs in focused
  command adapters.
- `src/lib/cli/registry/drift-gate-command-spec.ts` must stay focused on
  registry metadata and command delegation (`<= 25` lines).
- `src/lib/drift-gate/cli-args.ts` must stay focused on consistency-drift CLI
  option parsing and facade delegation (`<= 120` lines).
- `src/lib/cli/registry/memory-gate-command-spec.ts` must stay focused on
  command metadata and facade delegation (`<= 20` lines).
- `src/lib/cli/registry/silent-error-command-spec.ts` must stay focused on
  silent-error detector CLI option adapter and command delegation (`<= 35`
  lines).
- `src/lib/cli/registry/brainstorm-gate-command-spec.ts` must stay focused on
  brainstorm CLI option adapter and command delegation (`<= 40` lines).
- `src/lib/cli/registry/gardener-command-spec.ts` must stay focused on docs
  freshness CLI option adapter and command delegation (`<= 35` lines).
- `src/lib/cli/registry/replay-command-spec.ts` must stay focused on replay
  command metadata and replay-owned argv delegation (`<= 20` lines).
- `src/lib/cli/registry/plan-gate-command-spec.ts` must stay focused on plan
  gate command metadata and plan-gate-owned argv delegation (`<= 20` lines).
- `src/lib/cli/registry/prompt-gate-command-spec.ts` must stay focused on
  prompt gate command metadata and prompt-gate-owned argv delegation (`<= 20`
  lines).
- `src/lib/cli/registry/fleet-plan-command-spec.ts` must stay focused on
  fleet-plan command delegation (`<= 25` lines).
- `src/lib/cli/registry/next-command-spec.ts` must stay focused on next
  command delegation (`<= 25` lines).
- `src/lib/cli/registry/runtime-card-command-spec.ts` must stay focused on
  runtime-card command delegation (`<= 25` lines).
- `src/lib/cli/registry/pr-closeout-command-spec.ts` must stay focused on PR
  closeout command delegation (`<= 25` lines).
- `src/lib/cli/registry/verify-coderabbit-command-spec.ts` must stay focused on
  CodeRabbit review evidence CLI option mapping and command dispatch (`<= 40`
  lines).
- `src/lib/cli/registry/audit-command-spec.ts` must stay focused on audit
  command delegation (`<= 25` lines).
- `src/lib/cli/registry/check-command-spec.ts` must stay focused on check
  CLI option adapter and command delegation (`<= 25` lines).
- `src/lib/cli/registry/health-command-spec.ts` must stay focused on health
  command delegation (`<= 25` lines).
- `src/lib/cli/registry/doctor-command-spec.ts` must stay focused on doctor
  command delegation (`<= 25` lines).
- `src/lib/cli/registry/docs-gate-command-spec.ts` must stay focused on docs
  gate CLI option adapter and command delegation (`<= 80` lines).
- `src/lib/cli/registry/org-audit-command-spec.ts` must stay focused on org
  audit command delegation (`<= 25` lines).
- `src/lib/cli/registry/tooling-audit-command-spec.ts` must stay focused on
  tooling audit command delegation (`<= 25` lines).
- `src/lib/cli/registry/preset-command-spec.ts` must stay focused on preset
  command delegation (`<= 25` lines).
- `src/lib/cli/registry/workflow-generate-command-spec.ts` must stay focused on
  workflow generation CLI option adapter and command delegation (`<= 40`
  lines).
- `src/lib/cli/registry/risk-tier-command-spec.ts` must stay focused on risk
  tier CLI option adapter and command delegation (`<= 30` lines).
- `src/lib/cli/registry/symphony-check-command-spec.ts` must stay focused on
  Symphony readiness CLI option adapter and command delegation (`<= 35` lines).
- `src/lib/cli/registry/license-gate-command-spec.ts` must stay focused on
  license gate CLI option adapter and command delegation (`<= 35` lines).
- `src/lib/cli/registry/local-memory-preflight-command-spec.ts` must stay
  focused on Local Memory preflight CLI option adapter, usage-error handling, and
  command delegation (`<= 60` lines).
- `src/lib/cli/registry/check-environment-command-spec.ts` must stay focused on
  environment check CLI option adapter and command delegation (`<= 40` lines).
- `src/lib/cli/registry/check-authz-command-spec.ts` must stay focused on
  authorization check CLI option adapter and command delegation (`<= 35`
  lines).
- `src/lib/cli/registry/branch-protect-command-spec.ts` must stay focused on
  branch protection CLI option adapter, required approval parsing, and command
  delegation (`<= 70` lines).
- `src/lib/cli/registry/preflight-gate-command-spec.ts` must stay focused on
  preflight CLI option adapter, admission JSON parsing, and command delegation
  (`<= 100` lines).
- `src/lib/cli/registry/review-gate-command-spec.ts` must stay focused on review
  gate CLI option adapter and command delegation (`<= 220` lines).
- `src/lib/cli/registry/linear-command-spec.ts` must stay focused on Linear
  command spec metadata (`<= 30` lines).
- `src/lib/cli/registry/linear-command-runner.ts` must stay focused on Linear
  workflow parsing and dispatch (`<= 40` lines).
- `src/lib/cli/registry/linear-command-actions.ts` must stay focused on Linear
  action-specific option builders and command delegation (`<= 145` lines).
- `src/lib/cli/registry/linear-gate-command-spec.ts` must stay focused on Linear
  gate CLI option adapter and delegation (`<= 70` lines).
- `src/lib/cli/registry/pr-template-gate-command-spec.ts` must stay focused on
  PR template gate CLI option adapter and delegation (`<= 50` lines).
- `src/lib/output/normalise.ts` must remain a public output normalisation facade
  (`<= 10` lines).
- `src/lib/output/normalise-core-v2.ts` must remain a compatibility export surface
  (`<= 30` lines); gate-specific failure classification lives in focused
  normalisation modules.
- `src/lib/output/normalise-drift-gate.ts` must remain a drift gate
  normalisation seam (`<= 100` lines) for drift findings, artifact evidence, and
  canonical `GateResult` projection.
- `src/lib/output/normalise-docs-gate.ts` must remain a docs gate normalisation
  seam (`<= 80` lines) for docs findings, metadata, and canonical `GateResult`
  projection.
- `src/lib/output/normalise-plan-gate.ts` must remain a plan gate normalisation
  seam (`<= 80` lines) for plan validation findings, recovery hints, and
  canonical `GateResult` projection.
- `src/commands/plan-gate.ts` must remain a plan-gate compatibility facade
  (`<= 25` lines); raw argv projection and result presentation live behind
  `src/lib/plan-gate/cli-args.ts` and `src/lib/plan-gate/cli.ts`.
- `src/lib/plan-gate/cli-args.ts` must remain a plan-gate argument adapter
  (`<= 65` lines).
- `src/lib/plan-gate/cli.ts` must remain a plan-gate CLI presentation and
  exit-code seam (`<= 155` lines).
- `src/commands/prompt-gate.ts` must remain a prompt-gate compatibility facade
  (`<= 25` lines); raw argv projection, validation, and result presentation
  live behind `src/lib/prompt-gate/cli-args.ts`,
  `src/lib/prompt-gate/validator.ts`, and `src/lib/prompt-gate/cli.ts`.
- `src/lib/prompt-gate/cli-args.ts` must remain a prompt-gate argument adapter
  (`<= 55` lines).
- `src/lib/prompt-gate/validator.ts` must remain a prompt-gate validation seam
  (`<= 140` lines).
- `src/lib/prompt-gate/cli.ts` must remain a prompt-gate CLI presentation and
  exit-code seam (`<= 90` lines).
- `src/lib/output/normalise-policy-gate.ts` must remain a policy gate
  normalisation seam (`<= 130` lines) for policy tier findings, decision
  metadata, and canonical `GateResult` projection.
- `src/lib/output/normalise-pr-template-gate.ts` must remain a PR template gate
  normalisation seam (`<= 100` lines) for template validation findings and
  canonical `GateResult` projection.
- `src/lib/output/normalise-renderer.ts` must remain a terminal rendering seam
  (`<= 70` lines) for normalized gate-result presentation.
- `src/lib/output/normalise-he-phase-exit.ts` must remain a HE phase-exit
  normalisation seam (`<= 230` lines) for finding projection, evidence
  references, gate summary metadata, and canonical `GateResult` projection.
- `src/lib/output/normalise-linear-gate.ts` must remain a Linear gate
  normalisation seam (`<= 240` lines) for failure classification and canonical
  `GateResult` projection.
- `src/lib/decision/he-phase-exit-core.ts` must stay below the current trust-split
  ratchet (`<= 1750` lines) while more artifact and adapter policy moves behind focused seams.
- `src/lib/decision/he-gate-trust-policy.ts` must remain the HE gate trust-policy
  seam (`<= 220` lines) for status, execution-mode, finding, blocker, and evidence-reference rules.
- `src/lib/contract/validator.ts` must remain an entrypoint (`<= 2700` lines).
- `src/commands/doctor.ts` must remain a doctor command facade (`<= 210`
  lines) and import the explicit agent-safe work areas enforced by the architecture test.
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
- `src/lib/review-gate/required-checks.ts` must remain a review-gate
  required-check resolution seam (`<= 350` lines) for check-name, alias,
  source matching, and blocker projection.
- `src/lib/review-gate/required-check-sources.ts` must remain a review-gate
  source-authority seam (`<= 220` lines) for provider identity normalization
  and active/external source constraints.
- `src/lib/review-gate/required-check-manifest.ts` must remain a review-gate
  manifest seam (`<= 95` lines) for path resolution, loading, and validation
  errors.
- `src/lib/replay/cli-args.ts` must remain a replay argument adapter (`<= 60`
  lines); raw token projection and facade delegation stay there.
- `src/lib/replay/options.ts` must remain a replay option contract (`<= 60`
  lines); option, trace config, and resolution failure contracts stay there.
- `src/commands/replay-output.ts` must remain a replay output adapter
  (`<= 115` lines); terminal and JSON rendering stay there.
- `src/commands/replay-resolution.ts` must remain a replay trace resolution
  adapter (`<= 90` lines); path validation and trace lookup stay there.
- `src/commands/replay.ts` must remain a replay command facade (`<= 170`
  lines); argv projection, output rendering, trace resolution, shared option
  contracts, and canonical run-record/recovery metadata move into named replay
  seams: `src/lib/replay/cli-args.ts`, `src/lib/replay/options.ts`,
  `replay-output.ts`, `replay-resolution.ts`, and
  `replay-run-record.ts`.
- `src/commands/replay-run-record.ts` must remain a replay run-record seam
  (`<= 235` lines) for attempt ledger, recovery event, and policy context
  emission.
- `src/lib/review-gate/decision-packet.ts` must remain a review-gate decision
  artifact assembly seam (`<= 390` lines); recovery and run-record metadata
  move into named seams.
- `src/lib/review-gate/recovery.ts` must remain a review-gate recovery seam
  (`<= 170` lines) for attempt-ledger and recovery-event construction.
- `src/lib/review-gate/run-record.ts` must remain a review-gate run-record seam
  (`<= 180` lines) for terminal run-record emission and classification.
- `src/lib/review-gate/decision-packet-types.ts` must remain a small internal
  type seam (`<= 50` lines).
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
