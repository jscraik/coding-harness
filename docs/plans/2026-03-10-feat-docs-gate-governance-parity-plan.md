---
title: feat: Docs Gate Governance Parity
type: feat
status: draft
date: 2026-03-10
origin: docs/brainstorms/2026-03-10-docs-gate-governance-parity-brainstorm.md
spec: docs/specs/2026-03-10-feat-docs-gate-governance-parity-spec.md
---

# feat: Docs Gate Governance Parity

## Table of Contents
- [Enhancement Summary](#enhancement-summary)
- [Overview](#overview)
- [Problem Statement / Motivation](#problem-statement--motivation)
- [Scope and Non-Goals](#scope-and-non-goals)
- [Planning Inputs](#planning-inputs)
- [Implementation Steps](#implementation-steps)
- [Dependencies and Risks](#dependencies-and-risks)
- [Test and Validation Strategy](#test-and-validation-strategy)
- [Rollout / Migration / Monitoring](#rollout--migration--monitoring)
- [Acceptance Criteria](#acceptance-criteria)
- [Acceptance Checklist](#acceptance-checklist)
- [Sources & References](#sources--references)

## Enhancement Summary

**Deepened on:** 2026-03-10  
**Key areas improved:** phase gating, dependency clarity, rollout controls, downstream migration detail, and validation depth.

- Adds cross-phase execution rules so contract, command, CI, init, and governed-doc updates land in a deterministic order.
- Makes each implementation phase carry explicit dependencies, outputs, and verification slices rather than relying on implied handoff.
- Tightens rollout guidance with advisory-to-required promotion gates, demotion triggers, and downstream adoption sequencing.
- Expands validation to cover dual-run coexistence, merge-queue trust loading, init idempotency, and policy-driven hook generation.

## Overview

Implement a dedicated `docs-gate` command and rollout path that enforces governance-document parity without changing the behavior contract already defined in the spec.

This plan treats [2026-03-10-feat-docs-gate-governance-parity-spec.md](../specs/2026-03-10-feat-docs-gate-governance-parity-spec.md) as authoritative. The work is sequenced to avoid policy drift during implementation:

1. land the contract surface and validator first,
2. implement the command/report engine against that contract,
3. wire CI and required-check identity,
4. propagate stable defaults into `init` and downstream upgrade paths,
5. update governed docs only after the true policy surfaces are final,
6. rollout in advisory-first stages with explicit promotion and rollback evidence.

Release expectation for v1:

- the harness repo should adopt the final `docs-gate` required-check identity itself,
- the same release should also update downstream emission paths that materialize required checks and workflow defaults,
- downstream repositories pick up that behavior when you install or upgrade the released harness package and run the relevant scaffold/update commands,
- required posture in downstream repos is therefore release-driven and adoption-driven, not magically retroactive.

## Problem Statement / Motivation

The repository already has a narrow advisory `drift-gate` and a growing set of governance surfaces, but it still cannot reliably answer whether the right documentation changed for a code, contract, workflow, or scaffolding change.

That creates a split-brain failure mode across:

- contract truth in `harness.contract.json`,
- workflow truth in `.github/workflows/pr-pipeline.yml`,
- generated defaults in `src/commands/init.ts`,
- contributor-facing docs in `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, and `docs/agents/*`.

The spec resolves what `docs-gate` must own. This plan describes how to land that behavior safely without breaking the existing `drift-gate` advisory lane or downstream repositories that have not yet been upgraded.

## Scope and Non-Goals

### In scope

- Add `docsGatePolicy` to the contract type/default/validation path.
- Implement `docs-gate` CLI entrypoints, report envelope, exit behavior, and artifact writing.
- Add the v1 mapping engine, truth-source loading, parity validators, and governed-surface rules defined by the spec.
- Wire `docs-gate` into PR and merge queue CI with a staged rollout posture.
- Add `init --update` and fresh-init support for downstream `docs-gate` policy, workflow, and optional hook generation.
- Update governed docs to describe enforcement, remediation, and rollout posture.
- Add unit, integration, and workflow-facing validation that proves the spec invariants.

### Non-goals

- Replacing `drift-gate` or collapsing all consistency checking into one command.
- Requiring proof that `docs-expert` or `agents-md` was invoked.
- Expanding v1 beyond the governed surfaces named in the spec.
- Shipping broad repo-wide semantic docs validation unrelated to governance parity.

## Planning Inputs

### Authoritative product contract

- [2026-03-10-feat-docs-gate-governance-parity-spec.md](../specs/2026-03-10-feat-docs-gate-governance-parity-spec.md)
- [2026-03-10-docs-gate-governance-parity-brainstorm.md](../brainstorms/2026-03-10-docs-gate-governance-parity-brainstorm.md)

### Existing implementation patterns to follow

- `drift-gate` report envelope, baseline artifact lane, and output safety model in [src/commands/drift-gate.ts](/Users/jamiecraik/dev/coding-harness/src/commands/drift-gate.ts)
- contract typing and strict validation in [src/lib/contract/types.ts](/Users/jamiecraik/dev/coding-harness/src/lib/contract/types.ts) and [src/lib/contract/validator.ts](/Users/jamiecraik/dev/coding-harness/src/lib/contract/validator.ts)
- hybrid CLI wiring in [src/lib/cli/command-registry.ts](/Users/jamiecraik/dev/coding-harness/src/lib/cli/command-registry.ts) and [src/cli.ts](/Users/jamiecraik/dev/coding-harness/src/cli.ts)
- workflow job staging and trusted-base loading in [.github/workflows/pr-pipeline.yml](/Users/jamiecraik/dev/coding-harness/.github/workflows/pr-pipeline.yml)
- downstream scaffolding and migration mechanics in [src/commands/init.ts](/Users/jamiecraik/dev/coding-harness/src/commands/init.ts)

### Planning constraints that must be preserved

- `reviewPolicy.requiredChecks` remains a subset of `branchProtection.requiredChecks`.
- `docs-gate` must coexist with `drift-gate` during rollout without contradicting shared parity rules.
- `pull_request` and `merge_group` behavior must both be supported from day one.
- Report artifacts must stay machine-diffable and live under the allowlisted artifact subtree.
- Governed docs should update after policy/workflow truth is stable, not before.

### Public check identity contract

- `docs-gate` is a public required-check name once introduced; its job name, branch-protection identity, contract references, generated scaffolding, and contributor docs should all use the same stable label.
- Internal command structure, helper modules, artifact contents, and rollout posture may evolve, but the named check contract should not drift silently.
- Any future rename or split should be treated as a separate governance change with explicit migration planning, not an incidental implementation detail.
- v1 should update both the harness repo and the downstream emission paths exposed by the released package, including scaffolded workflow defaults and branch-protection application paths, so newly upgraded repos inherit the same check identity.

### Execution guardrails for the implementation plan

- Keep `docsGatePolicy`, required-check identity, workflow job names, and governed-doc wording in lockstep; do not land any one of those surfaces in isolation.
- Prefer additive coexistence over replacement: `docs-gate` owns new required parity behavior, while `drift-gate` keeps its existing health/advisory responsibilities until overlap has been proven stable.
- Treat merge-authoritative truth loading as a first-class dependency for both `pull_request` and `merge_group`; if protected truth cannot be loaded deterministically, the feature is not rollout-ready.
- Land downstream `init`/`init --update` support before expecting external repos to pass required posture.
- Do not broaden v1 governed surfaces during implementation unless the spec is revised first.

## Implementation Steps

### Cross-phase execution rules

The phases below should be executed as bounded slices with explicit handoff checks:

1. Freeze the contract and required-check vocabulary before adding any governed-doc copy.
2. Make the evaluator and report schema stable before wiring CI or hooks.
3. Add CI and required-check identity before updating downstream scaffolding, so `init` emits the true final posture.
4. Update governed docs only after command flags, workflow job names, and remediation text are stable.
5. Keep rollout promotion as a separate completion gate after implementation-complete validation passes.

### Phase 0 - Contract shape and migration boundary

Goal: establish the `docsGatePolicy` surface before any command logic depends on it.

Primary files:

- [src/lib/contract/types.ts](/Users/jamiecraik/dev/coding-harness/src/lib/contract/types.ts)
- [src/lib/contract/validator.ts](/Users/jamiecraik/dev/coding-harness/src/lib/contract/validator.ts)
- [src/lib/contract/validator.test.ts](/Users/jamiecraik/dev/coding-harness/src/lib/contract/validator.test.ts)
- [harness.contract.json](/Users/jamiecraik/dev/coding-harness/harness.contract.json)

Tasks:

- Introduce typed `docsGatePolicy` interfaces for mode, rules, truth sources, governed surfaces, and optional local-hook posture.
- Add strict validator support with remediation text and cross-field invariants, including:
  - no inferred v1 behavior from `docsDriftRules`,
  - valid required-check references,
  - consistent severity and outcome vocabulary,
  - safe defaults for bootstrap/advisory repos.
- Add default harness-repo `docsGatePolicy` entries in `harness.contract.json`.
- Preserve `docsDriftRules` as a legacy `drift-gate` surface and document the coexistence boundary in code comments/tests.

Phase dependencies:

- depends on the spec’s final `docsGatePolicy` choice remaining unchanged,
- should finish before any command parsing, CI wiring, or governed-doc edits begin.

Verification slice:

- targeted contract validator tests for happy-path, unknown-key, invalid-shape, missing-policy, and subset-invariant cases,
- snapshot or fixture coverage for harness defaults and legacy `docsDriftRules` coexistence.

Exit criteria:

- contract loading/validation accepts valid `docsGatePolicy`,
- invalid policy shapes fail deterministically with actionable errors,
- current harness contract includes the new surface without violating existing invariants.

### Phase 1 - Command/report core and reusable evaluator primitives

Goal: build the `docs-gate` engine with deterministic input, output, and failure behavior before wiring CI.

Primary files:

- `src/commands/docs-gate.ts` (new)
- `src/commands/docs-gate.test.ts` (new)
- [src/lib/input/validator.ts](/Users/jamiecraik/dev/coding-harness/src/lib/input/validator.ts) or shared path-safety helpers
- optional shared library files under `src/lib/docs-gate/` for:
  - policy loading,
  - changed-file classification,
  - truth-source loading,
  - parity validators,
  - report shaping

Tasks:

- Define the typed report envelope aligned with `drift-gate` top-level fields while honoring the spec’s richer outcomes.
- Implement execution-context capture for:
  - `pull_request`,
  - `merge_group`,
  - `manual_ci`,
  - `local`.
- Implement safe artifact output under `artifacts/consistency-gate/**`, including:
  - allowlisted output roots,
  - race-safe writes,
  - stub-report fallback behavior,
  - deterministic sanitization/truncation for untrusted strings.
- Build the change classifier and required-surface resolver for the spec’s v1 categories.
- Implement a truth-resolution and conflict matrix as executable code, not informal branching logic.
- Add the first validator families:
  - required-check/workflow truth versus governed docs,
  - generated scaffold/rendered template parity,
  - command/help surface parity where applicable.

Phase dependencies:

- requires Phase 0 contract types and validator semantics to be settled,
- should not yet change required CI posture or downstream templates.

Sequencing note:

- If command-surface parity is reused from `drift-gate`, factor it toward registry-aware extraction instead of relying only on legacy `src/cli.ts` regex parsing.

Verification slice:

- direct evaluator fixtures for added, modified, deleted, renamed, moved, symlinked, and case-only path changes,
- report-schema snapshot tests for success, partial, blocked, `bootstrap_gap`, `trust_mismatch`, and stub-report paths,
- filesystem safety tests that prove out-of-tree writes, path traversal, and unsafe output roots are rejected.

Exit criteria:

- `docs-gate` runs offline and emits stable JSON plus human-readable summaries,
- exit codes and `status/outcome` combinations match the spec,
- malformed policy, missing trusted truth, and path-safety failures all produce deterministic artifacts.

### Phase 2 - CLI wiring and user-facing command surface

Goal: make `docs-gate` a first-class harness command without introducing command/help drift.

Primary files:

- [src/lib/cli/command-registry.ts](/Users/jamiecraik/dev/coding-harness/src/lib/cli/command-registry.ts)
- [src/cli.ts](/Users/jamiecraik/dev/coding-harness/src/cli.ts)
- [README.md](/Users/jamiecraik/dev/coding-harness/README.md)

Tasks:

- Register `docs-gate` in the registry-first path with explicit flags for mode, changed-file source, trusted-base inputs, and output path.
- Update `src/cli.ts` help/usage output so `docs-gate` appears consistently in the hybrid command surface.
- Add CLI-focused tests proving:
  - flag parsing is stable,
  - help text and registry entries stay aligned,
  - JSON output remains machine-readable.
- Update the README command index once the command surface is stable.

Phase dependencies:

- requires Phase 1 command behavior and report vocabulary to be stable,
- should finish before governed-doc wording is updated broadly.

Verification slice:

- `--help` output assertions,
- registry/legacy dispatch parity coverage,
- explicit JSON-mode smoke tests for both success and failure paths.

Exit criteria:

- the new command is discoverable through `--help`,
- CLI/help/docs do not introduce new parity drift,
- registry-only and legacy command paths are both handled safely.

### Phase 3 - CI integration, required-check identity, and dual-run coexistence

Goal: add CI enforcement without breaking the existing advisory drift lanes.

Primary files:

- [.github/workflows/pr-pipeline.yml](/Users/jamiecraik/dev/coding-harness/.github/workflows/pr-pipeline.yml)
- [src/lib/policy/required-checks.ts](/Users/jamiecraik/dev/coding-harness/src/lib/policy/required-checks.ts)
- [src/commands/branch-protect.ts](/Users/jamiecraik/dev/coding-harness/src/commands/branch-protect.ts)
- [src/commands/branch-protect.test.ts](/Users/jamiecraik/dev/coding-harness/src/commands/branch-protect.test.ts)
- [harness.contract.json](/Users/jamiecraik/dev/coding-harness/harness.contract.json)

Tasks:

- Add a dedicated `docs-gate` job that runs on both `pull_request` and `merge_group`.
- Reuse the trusted-base loading pattern already used for policy gating so mergeability is based on immutable base-branch truth.
- Keep `drift-gate` jobs in place during rollout and define overlap explicitly:
  - `drift-gate` continues advisory/health responsibilities,
  - `docs-gate` owns required documentation parity.
- Add required-check identity updates to contract defaults and any required-check helper constants.
- Update downstream required-check emitters in the same bounded phase:
  - `harness branch-protect`,
  - ecosystem/profile defaults,
  - any preset or helper surfaces that materialize required checks for adopters.
- Ensure job names, artifact names, and expected check names are immutable across workflow/docs/contract surfaces.

Phase dependencies:

- requires Phase 1 stub-report and exit-code behavior so CI can fail predictably,
- requires Phase 2 command flags to be final,
- should finish before `init` emits new downstream workflow templates.

Verification slice:

- workflow job tests or fixture assertions for `pull_request` and `merge_group`,
- trusted-base smoke checks proving protected truth comes from immutable source identifiers,
- artifact upload assertions for advisory/shadow and required-mode runs,
- required-check parity checks across `harness.contract.json`, `src/lib/policy/required-checks.ts`, workflow job names, `branch-protect` output, and governed docs,
- branch-protection dry-run or fixture coverage proving upgraded repos receive the intended stable `docs-gate` check identity when policy enables it.

Exit criteria:

- `docs-gate` job can run in advisory/shadow mode without regressing current CI,
- `pull_request` and `merge_group` both produce valid artifacts,
- required-check naming is consistent across workflow, contract, ecosystem profile defaults, and downstream branch-protection emission paths.

### Phase 4 - Init/update scaffolding and downstream bootstrap path

Goal: make the feature installable and upgradable in downstream repos without manual guesswork.

Primary files:

- [src/commands/init.ts](/Users/jamiecraik/dev/coding-harness/src/commands/init.ts)
- [src/commands/init.test.ts](/Users/jamiecraik/dev/coding-harness/src/commands/init.test.ts)
- generated template fragments within `init` templates

Tasks:

- Add `docsGatePolicy` defaults and migration behavior to `init` and `init --update`.
- Generate downstream workflow wiring for `docs-gate` with bootstrap-safe posture.
- Add contract-aware optional pre-push hook generation or regeneration tied to policy, not ad hoc template state.
- Reuse the existing init safety rails so multi-file updates can recover cleanly when contract, workflow, hook, or template writes fail partway through.
- Validate the release-shaped adoption path by exercising the packaged harness artifact, not only the source tree, so downstream repos receive the same docs-gate behavior after NPM upgrade/install.
- Ensure dry-run and update output shows exact changes for:
  - contract additions,
  - workflow changes,
  - hook changes,
  - policy-facing docs/templates.
- Add idempotency coverage so repeated init/update runs do not oscillate files.

Phase dependencies:

- requires the final required-check name and workflow job shape from Phase 3,
- should land before downstream docs claim support for required posture.

Verification slice:

- fresh-init fixtures,
- `init --update` fixtures from legacy `docsDriftRules`-only repos,
- dry-run diff assertions,
- hook-generation fixtures for enabled versus disabled policy posture,
- repeated-run idempotency coverage against the same repo snapshot,
- rollback or partial-write recovery coverage proving downstream repos can recover cleanly if `init --update` fails mid-flight,
- packaged-install smoke coverage that:
  - packs the release artifact,
  - installs it into a fresh fixture repo and an upgrade fixture repo,
  - runs `harness init` and `harness init --update`,
  - verifies emitted workflow defaults, `docsGatePolicy`, and required-check/branch-protection wiring match the release contract.

Exit criteria:

- fresh init receives the expected docs-gate scaffolding,
- `init --update` upgrades older repos cleanly from legacy `docsDriftRules`-only state,
- bootstrap-gap behavior is intentional and documented,
- failed downstream updates have an explicit recovery path rather than leaving repos in mixed contract/workflow/check states,
- the packaged release artifact proves the same downstream behavior that source-tree tests expect.

### Phase 5 - Governed docs and operator guidance

Goal: update all v1 governed docs against the final policy and workflow truth.

Primary files:

- [README.md](/Users/jamiecraik/dev/coding-harness/README.md)
- [CONTRIBUTING.md](/Users/jamiecraik/dev/coding-harness/CONTRIBUTING.md)
- [AGENTS.md](/Users/jamiecraik/dev/coding-harness/AGENTS.md)
- [docs/agents/04-validation.md](/Users/jamiecraik/dev/coding-harness/docs/agents/04-validation.md)
- [docs/agents/07b-agent-governance.md](/Users/jamiecraik/dev/coding-harness/docs/agents/07b-agent-governance.md)
- [docs/agents/12-greptile-ai-governance.md](/Users/jamiecraik/dev/coding-harness/docs/agents/12-greptile-ai-governance.md)
- [docs/agents/13-linear-production-workflow.md](/Users/jamiecraik/dev/coding-harness/docs/agents/13-linear-production-workflow.md)

Tasks:

- Update contributor and operator docs with:
  - what `docs-gate` enforces,
  - what it does not enforce,
  - exit-code and remediation expectations,
  - advisory versus required posture,
  - downstream bootstrap/update instructions.
- Keep `docs-expert` and `agents-md` framed as recommended authoring routes, not merge prerequisites.
- Add examples for missing-doc, contradiction, and bootstrap-gap outcomes.
- Add a concise upgrade note for adopters explaining:
  - what changes after installing the new harness release,
  - which scaffold/update command they must run,
  - which new required checks or remediation prompts they should expect.

Phase dependencies:

- requires Phases 2 through 4 to freeze command names, CI posture, and init behavior,
- should be the final product-facing change before rollout promotion decisions.

Verification slice:

- targeted parity assertions between workflow/contract truth and governed-doc wording,
- markdown lint for each touched doc,
- one manual remediation walkthrough from failing artifact to doc fix to passing rerun.

Exit criteria:

- governed docs match contract/workflow/init truth,
- contributor remediation paths are explicit,
- there is no remaining split between enforced checks and contributor-facing guidance.

### Phase 6 - Rollout hardening and promotion readiness

Goal: move from implementation-complete to rollout-safe in the harness repo, then prepare downstream adoption.

Tasks:

- Start with advisory/shadow evidence collection in the harness repo if needed to establish baseline quality and noise.
- Track the metrics named in the spec:
  - false-positive rate,
  - bootstrap-gap rate,
  - trust-mismatch count,
  - blocking-failure rate.
- Add operator runbook notes for:
  - rollout promotion,
  - advisory demotion,
  - rollback triggers,
  - artifact interpretation.
- Only promote to required posture once the spec thresholds are demonstrated from collected evidence.

Rollout checkpoints:

1. Shadow mode in the harness repo:
   - `docs-gate` runs in CI,
   - artifacts are uploaded on every terminal path,
   - failures are reviewed without merge blocking.
2. Advisory mode in the harness repo:
   - findings become visible as actionable debt,
   - false positives and trust-loading issues are measured,
   - operator runbook text is validated against real artifacts.
3. Required mode in the harness repo:
   - promotion only after the spec threshold window is met,
   - demotion path is rehearsed and documented,
   - required-check naming and branch-protection expectations are frozen.
4. Downstream adoption:
   - `init --update` is available first,
   - upgraded repos can stay bootstrap/advisory until wiring is complete,
   - required posture is opt-in until evidence shows low-noise behavior outside the harness repo.

Rollout controller:

| Phase | Primary evidence | Threshold / condition | Action |
| --- | --- | --- | --- |
| Shadow | artifact completeness + stub-report correctness | every run emits a valid artifact on terminal paths | continue to advisory only after artifact reliability is proven |
| Advisory | false-positive rate + trust-mismatch count | spec promotion thresholds satisfied for the full observation window | promote harness repo to required mode |
| Advisory | blocking-failure rate | sustained breach of the spec rollback threshold | freeze promotion and investigate before any posture increase |
| Required | trust loading + required-check stability | any unresolved trust-loading regression or check-name drift | demote to advisory and restore stable identity |
| Downstream adoption | bootstrap-gap rate + upgrade success rate | `init --update` remediation is succeeding with acceptable noise | allow broader required-mode rollout |

Rollback and freeze controls:

- Freeze promotion immediately on any unresolved `trust_mismatch` regression, unexpected required-check rename drift, or sustained blocking-failure-rate breach against the spec threshold.
- Demote back to advisory if artifact upload, protected-truth loading, or governed-doc requiredness becomes unreliable in real CI.
- Keep `drift-gate` health coverage intact until docs-gate-specific rollout evidence is stable for at least one full promotion window.

Exit criteria:

- rollout evidence proves the configured threshold logic,
- the harness repo can enable required posture without hand-waving,
- downstream rollout can be staged by `init --update` adoption rather than surprise breakage.

## Dependencies and Risks

### Dependencies

- Existing hybrid CLI wiring in `src/cli.ts` must be updated together with registry entries to avoid help/docs drift.
- Existing `drift-gate` artifact consumers under `artifacts/consistency-gate` must keep working during coexistence.
- `init` migration/update behavior must stay idempotent and dry-run friendly.
- CI trusted-base loading must be available on both `pull_request` and `merge_group`.
- Required-check helpers, ecosystem profiles, contract defaults, and workflow job names must move together to preserve stable branch-protection semantics.
- Human review is needed before promotion from advisory to required posture because rollout evidence thresholds are policy decisions, not just test outcomes.

### Risks

- Hybrid CLI command discovery can create false positives if `docs-gate` reuses legacy regex extraction unchanged.
- Required-check identity can drift if workflow job names, contract defaults, and governed docs are not updated in one bounded phase.
- Downstream repos can get noisy `bootstrap_gap` results if init/update work is treated as an afterthought.
- Path normalization, rename/delete handling, and generated-template comparison are easy places for false negatives or false positives.
- A premature required rollout could create contributor friction before artifact evidence proves rule quality.

### Mitigations

- Keep the contract and command/report schema ahead of CI enforcement.
- Treat `drift-gate` coexistence as an explicit compatibility phase.
- Add failure-oriented tests for rename/delete/symlink/case-change/large-diff/output-write cases.
- Keep rollout advisory-first until spec thresholds are satisfied.

## Test and Validation Strategy

### Unit and contract validation

- extend contract validator tests for valid/invalid `docsGatePolicy` shapes and cross-field invariants
- add evaluator tests for:
  - change classification,
  - required-surface resolution,
  - truth-source precedence,
  - `trust_mismatch`,
  - `bootstrap_gap`,
  - `policy_error`,
  - `runtime_error`
- add path/output safety tests mirroring `drift-gate` patterns
- add required-check helper coverage so ecosystem-profile defaults, contract defaults, and job names stay aligned

### Command and artifact validation

- add CLI tests for flag parsing and help output
- snapshot JSON report shape and stub-report compatibility
- verify deterministic exit codes for advisory, required, and merge-authoritative contexts
- verify artifact names and output roots remain stable across advisory, health-style coexistence, and required runs
- verify schema parity between command-emitted reports, CI fallback stubs, and any init-generated workflow stub output

### Init and migration validation

- add fresh-init, update, dry-run, and idempotency tests
- verify legacy repos without `docsGatePolicy` upgrade cleanly
- verify optional hook generation is policy-driven and reproducible
- add package-level install/upgrade smoke tests so NPM-delivered templates and command wiring match source-repo expectations

### CI and workflow validation

- validate job behavior for both `pull_request` and `merge_group`
- verify required-check name parity across contract, workflow, and docs
- verify artifact upload paths and fallback stub behavior
- verify advisory/shadow coexistence with `drift-gate` does not break current health artifact consumers

### Manual operator verification

- run one harness-repo PR-shaped smoke path that changes policy/workflow truth and confirms the expected docs surfaces become required
- run one doc-only path that proves unaffected governed surfaces do not block unnecessarily
- run one downstream `init --update` smoke path to confirm bootstrap-gap behavior is intentional and remediation text is sufficient
- run one packaged-release smoke path using the built/published artifact shape to confirm downstream adoption behavior matches the release notes

### Repo-level verification before completion

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm check`
- `pnpm test:deep`
- `pnpm build`

Docs validation for this plan and follow-on doc updates:

- `pnpm markdownlint docs/plans/2026-03-10-feat-docs-gate-governance-parity-plan.md`

## Rollout / Migration / Monitoring

### Harness-repo rollout

1. Implement `docs-gate` with advisory/required modes available from the start.
2. Run the command in a non-breaking CI lane until artifact quality and noise are understood.
3. Promote the harness repo to required mode when the spec’s promotion gates are met.
4. Capture promotion evidence in a dated artifact bundle before changing required-check expectations.

### Downstream rollout

1. Ship `init`/`init --update` support before expecting downstream compliance.
2. Treat missing wiring as `bootstrap_gap`, not silent success.
3. Promote downstream repos only after upgraded repos demonstrate acceptable false-positive and bootstrap-gap rates.
4. Keep hook generation optional and policy-driven; CI remains the source of truth for mergeability.
5. Publish an upgrade note alongside the release so adopters know which command to run and which new enforcement surfaces to expect after upgrade.

### Monitoring and rollback

- Publish metrics and artifact evidence from CI for each rollout phase.
- Use the spec thresholds for:
  - freeze promotion,
  - demote to advisory,
  - investigate trust-loading regressions.
- Keep `drift-gate` health/advisory lanes alive until the overlap areas are operationally proven.
- Record the specific threshold window and decision evidence used for each posture change so later required-check regressions can be audited cleanly.

## Acceptance Criteria

- A dated plan artifact exists that is explicitly linked to the docs-gate brainstorm and spec.
- The plan sequences work contract-first, command-second, CI/init third, docs fourth, rollout last.
- The plan includes explicit coexistence with `drift-gate` rather than assuming a silent replacement.
- The plan covers `pull_request`, `merge_group`, local/advisory, and downstream bootstrap cases.
- The plan names concrete file/module targets for contract, command, workflow, init, and governed-doc changes.
- The plan includes validation work for negative cases, not only happy paths.
- The plan preserves the spec’s invariants and does not invent new merge-policy behavior.
- The plan makes phase dependencies and rollout promotion controls explicit enough that `/prompts:workflow-work` does not need to infer ordering or ownership.
- The plan makes it explicit that the release should update both the harness repo and the downstream emitted defaults that adopters receive when they upgrade/install the package.
- The plan proves the packaged release path, not just source-tree behavior, for downstream adoption.

## Acceptance Checklist

- [x] `docsGatePolicy` is added to the typed contract, validator, and harness defaults.
- [x] `docs-gate` command exists with stable CLI/report semantics and safe artifact writes.
- [x] Required-surface mapping and truth-source precedence are implemented as deterministic code paths.
- [x] `docs-gate` and `drift-gate` coexist without contradictory overlap during rollout.
- [x] PR and merge queue workflow jobs are wired with stable required-check identity.
- [x] `pull_request` and `merge_group` both prove the same merge-authoritative truth-loading behavior.
- [x] `init` and `init --update` scaffold or migrate downstream repos to docs-gate-capable state.
- [x] `harness branch-protect` and related required-check emitters produce the same stable `docs-gate` identity that CI and contract surfaces expect.
- [x] Governed docs are updated to match the final enforcement behavior and remediation model.
- [x] Unit, integration, workflow, and migration tests cover the spec’s critical scenarios.
- [x] Rollout evidence and thresholds are operationalized before required-mode promotion.
- [x] Fallback stub artifacts stay schema-compatible across runtime CI, init-generated workflow templates, and command JSON output.
- [x] Release and upgrade notes explain the new downstream enforcement path and required adopter commands.

## Sources & References

- [2026-03-10-feat-docs-gate-governance-parity-spec.md](../specs/2026-03-10-feat-docs-gate-governance-parity-spec.md)
- [2026-03-10-docs-gate-governance-parity-brainstorm.md](../brainstorms/2026-03-10-docs-gate-governance-parity-brainstorm.md)
- [2026-03-05-feat-consistency-contract-advisory-drift-gate-plan.md](./2026-03-05-feat-consistency-contract-advisory-drift-gate-plan.md)
- [2026-02-24-refactor-contract-surface-runtime-parity-plan.md](./2026-02-24-refactor-contract-surface-runtime-parity-plan.md)
- [src/commands/drift-gate.ts](/Users/jamiecraik/dev/coding-harness/src/commands/drift-gate.ts)
- [src/commands/drift-gate.test.ts](/Users/jamiecraik/dev/coding-harness/src/commands/drift-gate.test.ts)
- [src/commands/init.ts](/Users/jamiecraik/dev/coding-harness/src/commands/init.ts)
- [src/lib/contract/types.ts](/Users/jamiecraik/dev/coding-harness/src/lib/contract/types.ts)
- [src/lib/contract/validator.ts](/Users/jamiecraik/dev/coding-harness/src/lib/contract/validator.ts)
- [src/lib/cli/command-registry.ts](/Users/jamiecraik/dev/coding-harness/src/lib/cli/command-registry.ts)
- [src/cli.ts](/Users/jamiecraik/dev/coding-harness/src/cli.ts)
- [.github/workflows/pr-pipeline.yml](/Users/jamiecraik/dev/coding-harness/.github/workflows/pr-pipeline.yml)
- [docs/architecture/blast-radius.md](/Users/jamiecraik/dev/coding-harness/docs/architecture/blast-radius.md)
- [docs/agents/04-validation.md](/Users/jamiecraik/dev/coding-harness/docs/agents/04-validation.md)
