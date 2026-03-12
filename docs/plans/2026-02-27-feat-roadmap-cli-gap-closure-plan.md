---
title: feat: Roadmap/CLI gap closure
type: feat
status: active
date: 2026-02-27
plan_id: feat-roadmap-cli-gap-closure
origin: docs/brainstorms/2026-02-27-roadmap-cli-gap-closure-brainstorm.md
---

# feat: Roadmap/CLI gap closure

## Enhancement Summary
**Deepened on:** 2026-02-27  
**Sections enhanced:** 7  
**Research agents used:** cli-spec, docs-expert, writing-plans, verification-before-completion, explorer (coverage pass), architecture review pass

### Key Improvements
1. Added stricter command-surface parity expectations (dispatch/help/README alignment).
2. Added phase gates and explicit verification commands mapped to acceptance criteria.
3. Added rollback/failure-handling guidance to keep staged rollout reversible.

### New Considerations Discovered
- Async command dispatch parity (`check-authz`, `check-environment`) must preserve exit semantics.
- Alias compatibility (`risk-policy-gate`) needs explicit equivalence tests and docs gating.
- Schema expansion (merge policy + video evidence) should be introduced in validator-first order.

## Table of Contents
- [Enhancement Summary](#enhancement-summary)
- [Overview](#overview)
- [Problem Statement / Motivation](#problem-statement--motivation)
- [Section Manifest](#section-manifest)
- [Research Summary](#research-summary)
  - [Local research (completed)](#local-research-completed)
  - [Learnings research](#learnings-research)
  - [External research decision](#external-research-decision)
- [Proposed Solution](#proposed-solution)
- [Technical Considerations](#technical-considerations)
- [System-Wide Impact](#system-wide-impact)
- [SpecFlow Analysis (coverage + edge cases)](#specflow-analysis-coverage--edge-cases)
- [Implementation Plan](#implementation-plan)
- [Phase Gates and Checkpoints](#phase-gates-and-checkpoints)
- [Validation Plan](#validation-plan)
- [Evidence Artifacts](#evidence-artifacts)
- [Rollback / Failure Handling](#rollback--failure-handling)
- [Acceptance Criteria](#acceptance-criteria)
- [Success Metrics](#success-metrics)
- [Dependencies & Risks](#dependencies--risks)
- [Non-Goals](#non-goals)
- [Open Questions](#open-questions)
- [Sources & References](#sources--references)

## Overview
Close mismatch between roadmap claims and shipped CLI/runtime surface using a truth-first staged plan: P0 command/docs/test parity, P1 capability closure with compatibility safeguards, and P2 narrative/status cleanup (see brainstorm: docs/brainstorms/2026-02-27-roadmap-cli-gap-closure-brainstorm.md).

## Problem Statement / Motivation
The repository currently has documented commands and roadmap terms that are not consistently exposed by the CLI dispatch path, which weakens the repository as the machine-legible system of record. This plan aligns runtime behavior, docs, and tests first, then addresses scoped capability gaps without breaking existing contract consumers (see brainstorm: docs/brainstorms/2026-02-27-roadmap-cli-gap-closure-brainstorm.md).

## Section Manifest
- **Overview / Problem Statement:** tighten objectives and traceability to brainstorm decisions.
- **Technical Considerations:** add CLI-contract and schema-compatibility constraints discovered in deepening review.
- **System-Wide Impact:** expand cross-layer and consumer impact analysis.
- **Implementation Plan:** improve sequencing and task-level verification ordering.
- **Acceptance Criteria:** add explicit edge-case and parity matrix checks.
- **Validation Plan / Gates:** map acceptance criteria to proof commands.
- **Rollback / Failure Handling:** define phase-level fallback path.

## Research Summary
### Local research (completed)
- CLI dispatch includes `pilot-rollback` but does not dispatch `policy-gate`, `check-authz`, `check-environment`, or `pilot-evaluate`: `/Users/jamiecraik/dev/coding-harness/src/cli.ts:240-1121`
- README command index lists commands currently not dispatched: `/Users/jamiecraik/dev/coding-harness/README.md:37-60`
- Dispatch tests explicitly skip `policy-gate` scenarios with note that command does not exist: `/Users/jamiecraik/dev/coding-harness/src/cli-dispatch.test.ts:278-684`
- Command implementations already exist and are callable:
  - `/Users/jamiecraik/dev/coding-harness/src/commands/policy-gate.ts:129`
  - `/Users/jamiecraik/dev/coding-harness/src/commands/check-authz.ts:258`
  - `/Users/jamiecraik/dev/coding-harness/src/commands/check-environment.ts:277`
  - `/Users/jamiecraik/dev/coding-harness/src/commands/pilot-evaluate.ts:228`
- `.gitignore` currently does not explicitly exclude pilot artifacts dir: `/Users/jamiecraik/dev/coding-harness/.gitignore`

### Learnings research
- No `docs/solutions/` corpus found in this repository; rely on repo-native plans/tests/patterns.

### External research decision
Skipped. Topic is internal CLI/doc parity with strong local evidence and low external dependency risk.

## Proposed Solution
Adopt staged closure:

1. **P0 (truth alignment):** wire missing command handlers and usage text, unskip/add dispatch tests, and align README + `.gitignore`.
2. **P1 (behavior parity):** add merge-policy schema compatibility normalization, add roadmap-claimed preflight checks (doc drift + head SHA), and extend evidence model for video artifacts.
3. **P2 (positioning cleanup):** publish implementation status matrix and normalize strategic docs terminology/speculation markings.

This preserves YAGNI and reduces regression risk by making currently claimed behavior true before adding new scope (see brainstorm: docs/brainstorms/2026-02-27-roadmap-cli-gap-closure-brainstorm.md).

## Technical Considerations
- **Runtime dispatch truth source:** `src/cli.ts` is the authoritative command registry; every new command must be added in one place (import, usage, and branching path) to prevent split-brain between parser and docs.
- **Backward compatibility:** merge-policy must support both legacy (`{"high": [..]}`) and roadmap (`{"high": { requiredChecks }}`) shapes with deterministic canonicalization.
- **CLI stability:** add alias `risk-policy-gate` for terminology parity while preserving all existing `policy-gate` semantics, options, and exit behavior.
- **Async/sync command parity:** `check-authz` and `check-environment` are async commands; dispatch wrappers must use promise-based completion before `process.exit` to avoid premature exit.
- **Exit-code preservation:** pass through command-specific exit codes (e.g., `PolicyGate=1`, `CheckAuthz=3`, `PilotEvaluate=0/1`) exactly as implementations already emit.
- **Error taxonomy stability:** normalize failures into existing categories (`CONTRACT_ERROR`, `VALIDATION_ERROR`, `SYSTEM_ERROR`) so downstream automation can keep filtering on stable codes.
- **Input hygiene edge control:** required-value flags should fail with explicit usage errors when values are missing (`--flag value` required; bare `--flag` invalid). If compatibility exceptions are needed, list them explicitly and time-box their deprecation.
- **Determinism and performance:** preflight checks and compatibility transforms should avoid non-deterministic network calls unless explicitly requested.
- **Validation strategy:** dispatch tests + command tests + contract/parsing tests + doc/implementation parity checks.

### Additional edge considerations
- `risk-policy-gate` should be parsed before generic unknown-command fallback and should not create duplicate command handling branches.
- Alias behavior should be smoke-tested for positional argument shifts (`harness risk-policy-gate --files a,b` and `harness policy-gate --files a,b` must be equivalent).
- Merge-policy normalization must define conflict resolution when both legacy and roadmap forms are present for the same policy key.
- Evidence schema expansion to video must remain backward-compatible with existing screenshot-only manifests.

## System-Wide Impact
- **Interaction graph:** `src/cli.ts` dispatch is the first-party contract for command UX, while README/`printUsage()` are consumer-facing mirrors. Any mismatch now blocks deterministic automation that scrapes the usage table.
- **Command module coupling:** added handlers import additional command modules, increasing cold-start graph and bundling surface for CLI runtime tests and mocks.
- **Error propagation:** async commands (`check-authz`, `check-environment`) now require explicit promise chaining in dispatch tests and production path so failures route through `handleFatalError` consistently.
- **Data shape migration impact:** merge-policy dual-shape support affects contract validation and loader consumers (`policy-gate`, `init`, preflight) beyond the CLI path.
- **Preflight and output consumers:** `preflight-gate` JSON output changes are potentially consumed by scripts/CI dashboards; added keys must remain optional and stable by default.
- **Repository/CI behavior:** expanded `.gitignore` changes alter artifact retention expectations in local runs, CI cache hygiene, and workspace size checks.
- **Test environment impact:** dispatch tests currently mock command modules; adding new dispatch branches increases spy surface and requires explicit reset between tests to avoid stale invocation bleed.
- **Documentation integrity impact:** README command index and status matrix become machine-verifiable artifacts for roadmap compliance checks.

### Cross-cutting edge cases
- Unknown command input should continue returning help/fallback while not consuming `--help` as a positional command argument.
- Duplicate commands and alias names must not conflict with namespace-style commands such as `ui:fast` / `ui:verify`.
- JSON mode flags plus alias behavior must remain stable because automation typically asserts parseable JSON payloads.
- File-system write operations for attestation (`--attest`) and artifacts must preserve atomic behavior even when command is now reachable from previously undocumented paths.

## SpecFlow Analysis (coverage + edge cases)
Identified and incorporated:
- **Flow gap:** command documented but not dispatchable.
- **Parity gap:** tests encode outdated expectation (`policy-gate` skipped).
- **Edge case:** alias command must preserve exact option parsing and exit code mapping.
- **Edge case:** contract merge-policy dual shape must normalize identically for downstream policy checks.
- **Edge case:** new preflight checks should be skippable and not break existing `--strict` semantics unexpectedly.

## Implementation Plan

### P0 - Must do now (runtime/docs/test truth)
0. **Baseline lock snapshot**
   - Capture current state for rollback reference (`harness --help`, `src/cli-dispatch.test.ts` skip list, README command index snapshot).
   - Store under `artifacts/pilot/baseline/` (ignored path).

1. **Wire command handlers + usage text**
   - File: `/Users/jamiecraik/dev/coding-harness/src/cli.ts`
   - Add imports for `runPolicyGateCLI`, `runCheckAuthzCLI`, `runCheckEnvironmentCLI`, `runPilotEvaluateCLI`.
   - Add command blocks for `policy-gate`, `check-authz`, `check-environment`, `pilot-evaluate`.
   - Add alias `risk-policy-gate` routed to same handler/options as `policy-gate`.
   - Update `printUsage()` command/options sections for these commands.

2. **Dispatch test parity**
   - File: `/Users/jamiecraik/dev/coding-harness/src/cli-dispatch.test.ts`
   - Add mocks for `check-authz`, `check-environment`, `pilot-evaluate` command modules.
   - Unskip `policy-gate` tests.
   - Add new tests for `check-authz`, `check-environment`, `pilot-evaluate`, and `risk-policy-gate` alias parsing/dispatch.

3. **README parity updates**
   - File: `/Users/jamiecraik/dev/coding-harness/README.md`
   - Ensure command index includes wired commands and `pilot-rollback`.
   - Add naming note: `risk-policy-gate` is alias of `policy-gate`.

4. **Artifact hygiene**
   - File: `/Users/jamiecraik/dev/coding-harness/.gitignore`
   - Add `artifacts/pilot/`.
   - Add `ui-explore-output/` (default output path from `ui:explore`).

### P1 - Next (capability gaps to roadmap claims)
1. **Merge policy dual-shape compatibility**
   - Files:
     - `/Users/jamiecraik/dev/coding-harness/src/lib/contract/types.ts`
     - `/Users/jamiecraik/dev/coding-harness/src/lib/contract/validator.ts`
     - `/Users/jamiecraik/dev/coding-harness/src/lib/contract/loader.ts`
     - `/Users/jamiecraik/dev/coding-harness/src/commands/init.ts`
   - Accept legacy `"high": ["check"]` and roadmap `"high": {"requiredChecks": [...]}`.
   - Normalize internally to one canonical runtime shape.
   - Update scaffold output to preferred shape (or explicit style option).

2. **Preflight parity checks**
   - Files:
     - `/Users/jamiecraik/dev/coding-harness/src/lib/preflight/validator.ts`
     - `/Users/jamiecraik/dev/coding-harness/src/lib/preflight/types.ts`
     - `/Users/jamiecraik/dev/coding-harness/src/commands/preflight-gate.ts`
     - `/Users/jamiecraik/dev/coding-harness/src/cli.ts`
     - `/Users/jamiecraik/dev/coding-harness/src/cli-dispatch.test.ts`
   - Add doc-drift check hook and optional `--head-sha` determinism check.
   - Expose `headSha` in types, CLI parsing, command wiring, and dispatch tests (valid value + missing-value behavior).
   - Expose in CLI/JSON output and maintain `--skip`/`--strict` behavior clarity.

3. **Evidence model expansion**
   - Files:
     - `/Users/jamiecraik/dev/coding-harness/contracts/browser-evidence.schema.json`
     - `/Users/jamiecraik/dev/coding-harness/src/lib/evidence/types.ts`
     - `/Users/jamiecraik/dev/coding-harness/src/lib/evidence/policy.ts`
     - `/Users/jamiecraik/dev/coding-harness/src/commands/evidence-verify.ts`
     - `/Users/jamiecraik/dev/coding-harness/src/commands/ui-loop.ts`
   - Add `video` evidence support (`mp4`, `webm`) beside screenshot types.
   - Add top-level evidence-type compatibility for video manifests.
   - Add `ui:verify` manifest output mode compatible with schema and end-to-end policy enforcement.

### P2 - Cleanup (narrative and status clarity)
1. **Implementation status matrix**
   - Pre-step: `mkdir -p /Users/jamiecraik/dev/coding-harness/docs/roadmap`
   - Files:
     - `/Users/jamiecraik/dev/coding-harness/docs/roadmap/agent-first-status.md` (new)
     - `/Users/jamiecraik/dev/coding-harness/README.md` (link)
   - Add matrix: roadmap claim vs current status (`Implemented`, `Partial`, `Planned`) with owner and target date.

2. **Strategic docs normalization**
   - Files:
     - `/Users/jamiecraik/dev/coding-harness/docs/HARNESS_IMPLEMENTATION_PLAN.md`
   - `/Users/jamiecraik/dev/coding-harness/docs/plans/2026-02-25-feat-agent-first-throughput-v1-pilot-plan.md`
   - Normalize term usage and alias note; explicitly mark planned/speculative items.

## Phase Gates and Checkpoints
- **Gate A (post-P0):** proceed only when dispatch tests, help parity checks, and docs lint pass.
- **Gate B (post-P1):** proceed only when dual-shape contract tests + preflight tests + evidence tests pass.
- **Gate C (final):** release readiness only after full baseline check passes (`pnpm check`).

## Validation Plan
Map each claim to fresh proof commands (fail-fast):

1. **CLI/help parity proof**
   - `zsh -lc 'pnpm build'`
   - `zsh -lc 'node ./dist/cli.js --help | rg -n \"policy-gate|risk-policy-gate|check-authz|check-environment|pilot-evaluate|pilot-rollback\"'`
2. **Dispatch behavior and skip removal**
   - `zsh -lc 'pnpm test -- src/cli-dispatch.test.ts'`
   - `zsh -lc '! rg -n \"it\\.skip\\(\" src/cli-dispatch.test.ts'` (enforce zero skips in entire dispatch test file)
3. **README and CLI parity**
   - `zsh -lc 'for c in policy-gate risk-policy-gate check-authz check-environment pilot-evaluate pilot-rollback; do rg -n \"$c\" README.md src/cli.ts; done'`
4. **Ignore rule verification**
   - `zsh -lc 'rg -n \"^artifacts/pilot/$\" .gitignore'`
   - `zsh -lc 'rg -n \"^ui-explore-output/$\" .gitignore'`
5. **P1 contract/evidence checks**
   - `zsh -lc 'pnpm test -- src/lib/contract/validator.test.ts src/lib/contract/loader.test.ts src/commands/init.test.ts'`
   - `zsh -lc 'pnpm test -- src/commands/evidence-verify.test.ts src/commands/ui-loop.test.ts src/lib/evidence/validator.test.ts src/lib/evidence/policy.test.ts'`
   - `zsh -lc 'jq -e ".properties.evidenceType.enum | index(\"video\")" contracts/browser-evidence.schema.json'`
   - `zsh -lc 'jq -e ".properties.files.items.properties.type.enum | index(\"mp4\") and index(\"webm\")" contracts/browser-evidence.schema.json'`
6. **Final baseline**
   - `zsh -lc 'pnpm check'`

## Evidence Artifacts
- CLI help output snapshot (post-build).
- Dispatch test output for parity paths and alias tests.
- README/CLI parity grep output.
- Contract dual-shape fixture test outputs.
- Evidence schema validation output (video + screenshot compatibility).

## Rollback / Failure Handling
- **P0 rollback:** revert CLI dispatch/help/docs parity changes together to restore previous command surface.
- **P1 rollback:** keep loader compatibility if possible; revert producers (`init`/manifest emitters) first.
- **P2 rollback:** docs-only rollback, no runtime impact.
- **Blocker protocol:** halt at failed gate; record failing command output and update plan scope before proceeding.

## Acceptance Criteria
- [x] `harness --help` includes entries for `policy-gate`, `check-authz`, `check-environment`, `pilot-evaluate`, and `risk-policy-gate` alias note.
- [x] `harness --help` output is deterministic (same ordering and text block for command list between repeated runs).
- [x] Command dispatch path is implemented for each new command and returns explicit exit code expectations:
  - [x] `policy-gate`/`risk-policy-gate` returns `0/1/10` semantics from command module where applicable.
  - [x] `check-authz` async path resolves and exits with mapped codes (`0/1/3`) even when run in sequence with other async commands.
  - [x] `check-environment` preserves exit code behavior from contract-loading and policy violation branches.
  - [x] `pilot-evaluate` supports documented outputs and keeps non-zero `hold`/`rollback` outcomes.
- [x] Dispatch tests:
  - [x] No `it.skip` remains anywhere in `src/cli-dispatch.test.ts` for P0 commands; added and asserted `check-authz`, `check-environment`, `pilot-evaluate`, and `risk-policy-gate` paths. (Pre-existing skips for unrelated commands remain as documented.)
  - [x] Tests cover alias equivalence (`policy-gate` and `risk-policy-gate`) and missing flag values for async commands.
  - [x] Negative tests assert that bare `--contract` in contract-backed commands (`policy-gate`, `check-authz`, `check-environment`) returns explicit usage errors unless a documented compatibility exception exists.
- [x] README command index equals the actual CLI dispatch table (including aliases/command names used by `harness <command>`).
- [x] `.gitignore` includes `artifacts/pilot/` and `ui-explore-output/`.
- [x] Contract load/validation supports both merge-policy shapes without warning or fixture breakage and emits canonical shape in migration/scaffold output.
- [x] Preflight checks for head-sha are exposed in CLI and JSON output; behavior is skippable via existing `--skip` and does not alter existing `--strict` semantics.
- [x] Evidence schema + verifier accept `video` manifests and continue accepting screenshot-only manifests.
- [x] `docs/roadmap/agent-first-status.md` exists, is linked from README, and includes `Implemented/Partial/Planned` status for each roadmap claim touched by this plan.
- [x] End-to-end smoke command for roadmap parity:
  - [x] `pnpm check` (or equivalent local baseline) passes with these new changes in place.

### Edge-case acceptance matrix
- [x] Command alias collision test: `harness risk-policy-gate --max-tier low --files a,b` and `harness policy-gate --max-tier low --files a,b` produce identical invocation payloads.
- [x] Error taxonomy test: contract JSON with malformed `mergePolicy` returns canonical validation error code instead of generic process abort.
- [ ] Timeout/network edge test: `check-authz --check-scopes` fails closed on transient GitHub API failures by default; any fail-open mode requires an explicit override flag and emits an audit event.
- [ ] Non-regression matrix unchanged for existing commands (`harness preflight-gate`, `harness ui:fast`, `harness gap-case`).

## Success Metrics
- 0 mismatches between README command index and CLI dispatch table.
- 100% pass rate for command dispatch tests after parity changes.
- No breaking changes for existing contract fixtures/tests.

## Dependencies & Risks
- **Dependency:** existing command modules remain stable and importable by `src/cli.ts`.
- **Risk:** broad edits to `src/cli.ts` can introduce parsing regressions.
  - **Mitigation:** add targeted dispatch tests per new command and alias path.
- **Risk:** merge-policy compatibility may create ambiguous validation behavior.
  - **Mitigation:** canonicalize in loader and assert with dual-shape fixtures.

## Non-Goals
- Full MCP orchestration rewrite.
- Renaming/removing existing command surfaces.
- Large refactors unrelated to parity and governance gaps.

## Open Questions
- None carried forward; brainstorm reported no unresolved open questions.

## Sources & References
- **Origin brainstorm:** `/Users/jamiecraik/dev/coding-harness/docs/brainstorms/2026-02-27-roadmap-cli-gap-closure-brainstorm.md` (carried forward: truth-first staging, compatibility-first schema handling, explicit capability-gap framing).
- CLI dispatch and usage surface: `/Users/jamiecraik/dev/coding-harness/src/cli.ts:60-1121`
- Dispatch parity tests: `/Users/jamiecraik/dev/coding-harness/src/cli-dispatch.test.ts:1-900`
- Command index drift evidence: `/Users/jamiecraik/dev/coding-harness/README.md:37-60`
- Existing command implementations:
  - `/Users/jamiecraik/dev/coding-harness/src/commands/policy-gate.ts:1-170`
  - `/Users/jamiecraik/dev/coding-harness/src/commands/check-authz.ts:1-320`
  - `/Users/jamiecraik/dev/coding-harness/src/commands/check-environment.ts:1-340`
  - `/Users/jamiecraik/dev/coding-harness/src/commands/pilot-evaluate.ts:1-320`
- Contract/policy surfaces:
  - `/Users/jamiecraik/dev/coding-harness/src/lib/contract/types.ts`
  - `/Users/jamiecraik/dev/coding-harness/src/lib/contract/validator.ts`
  - `/Users/jamiecraik/dev/coding-harness/src/lib/contract/loader.ts`
- Preflight and evidence surfaces:
  - `/Users/jamiecraik/dev/coding-harness/src/lib/preflight/validator.ts`
  - `/Users/jamiecraik/dev/coding-harness/contracts/browser-evidence.schema.json`
  - `/Users/jamiecraik/dev/coding-harness/src/commands/evidence-verify.ts`
  - `/Users/jamiecraik/dev/coding-harness/src/commands/ui-loop.ts`
