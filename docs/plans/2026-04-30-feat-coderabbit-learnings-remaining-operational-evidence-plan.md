---
schema_version: 1
title: CodeRabbit Learnings Remaining Operational Evidence Plan
type: feat
status: active
date: 2026-04-30
plan_id: feat-coderabbit-learnings-remaining-operational-evidence
source_spec: docs/specs/2026-04-28-feat-coderabbit-learnings-operational-evidence-spec.md
source_plan: docs/plans/2026-04-28-feat-coderabbit-learnings-operational-evidence-phase-1a-plan.md
route: fresh
plan_depth: deep
deepened_on: 2026-04-30
run_type: planning-artifact
---

# CodeRabbit Learnings Remaining Operational Evidence Plan

## Enhancement Summary

**Planned on:** 2026-04-30  
**Mode:** `deep-plan`  
**Route:** `fresh`  
**Source spec:** [CodeRabbit Learnings as Operational Evidence](../specs/2026-04-28-feat-coderabbit-learnings-operational-evidence-spec.md)  
**Prior plan:** [Phase 1A plan](./2026-04-28-feat-coderabbit-learnings-operational-evidence-phase-1a-plan.md)  
**Implementation slice:** Remaining spec work after import, exact-file gate, promotion report, review context, validation plan, artifact gate, CI ownership gate, and scaffold-default promotion tests.

The earlier implementation now covers the first operational-evidence surfaces. This follow-on plan focuses only on the remaining load-bearing spec work:

- durable promotion enforcement state,
- permanent frontmatter docs-surface validation,
- sanitized shareable snapshots,
- sensitive-text handling,
- learning overrides and suppression policy,
- complete CI ownership fallback-workflow semantics,
- downstream scaffold fixture matrix,
- north-star feedback metrics,
- optional live companion metadata,
- measured fuzzy/keyword advisory matching,
- mandatory review-gate integration for generated review-context artifacts.

The CodeRabbit review finding `[P1] Artifact gate misses source-only drift` is treated as a prerequisite that is already fixed in the current branch by the reciprocal source-only artifact-gate path. This plan does not reopen that fixed bug.

## Table of Contents

- [Overview](#overview)
- [Current Completed Baseline](#current-completed-baseline)
- [Baseline Anchor and Run Evidence](#baseline-anchor-and-run-evidence)
- [Run Classification](#run-classification)
- [Bootstrap and Setup Contract](#bootstrap-and-setup-contract)
- [Problem Frame](#problem-frame)
- [North-Star Execution Alignment](#north-star-execution-alignment)
- [Linear Alignment Spine](#linear-alignment-spine)
- [Planning Decision](#planning-decision)
- [Requirements Trace](#requirements-trace)
- [Scope Boundaries](#scope-boundaries)
- [Execution Checkpoints](#execution-checkpoints)
- [Dependency Graph](#dependency-graph)
- [Stop Conditions](#stop-conditions)
- [Implementation Units](#implementation-units)
- [Validation Plan](#validation-plan)
- [Risks and Mitigations](#risks-and-mitigations)
- [Rollback and Recovery](#rollback-and-recovery)
- [Execution Ledger](#execution-ledger)
- [Handoff to HE Work](#handoff-to-he-work)
- [Sources and References](#sources-and-references)

## Overview

Finish the remaining CodeRabbit learnings operational-evidence system without duplicating work that has already landed.

The existing branch already includes the core command surfaces and the Phase 4 artifact/CI/scaffold promotion start. The next work should make those surfaces durable, measurable, shareable, and safe across downstream repos.

The key transition is:

```text
imported and matched learnings
  -> explicit promotion/enforcement ledger
  -> durable validators/tests/scaffold defaults
  -> review-gate and north-star feedback evidence
```

## Current Completed Baseline

Treat these surfaces as already implemented unless live verification proves drift:

| Surface                     | Current state                                                        |
| --------------------------- | -------------------------------------------------------------------- |
| `harness learnings import`  | Implemented with CodeRabbit CSV import and local artifact output     |
| `harness learnings gate`    | Implemented for exact-file and structured target matching            |
| `harness learnings promote` | Implemented as promotion-candidate reporting                         |
| `harness review-context`    | Implemented as advisory review-context generation                    |
| `harness validation-plan`   | Implemented as advisory validation command guidance                  |
| `harness artifact-gate`     | Implemented with generated/source reciprocal drift checks            |
| `harness ci-ownership-gate` | Implemented for primary provider and required review/security checks |
| Scaffold-default promotions | Regression-tested for highest-signal generated-repo defaults         |

Known validation evidence from the prior slice:

- `node_modules/.bin/vitest run src/commands/artifact-gate.test.ts` -> pass.
- `node_modules/.bin/vitest run src/lib/cli/registry/command-specs.test.ts src/commands/ci-ownership-gate.test.ts src/lib/init/scaffold-default-promotions.test.ts` -> pass.
- `bash scripts/run-harness-gate.sh docs-gate --mode required --json` -> pass.
- `bash scripts/validate-codestyle.sh --fast` -> pass.
- `pnpm build && bash scripts/harness-cli.sh artifact-gate --files src/templates/codex-preflight.sh --json` -> build passed; artifact gate returned the expected source-only drift failure.
- `bash scripts/harness-cli.sh artifact-gate --files scripts/codex-preflight.sh,src/templates/codex-preflight.sh --json` -> pass.

## Baseline Anchor and Run Evidence

P0 must replace prose baseline claims with machine-verifiable evidence before P1-P10 start.

Required baseline anchor:

- Record the current branch name and `HEAD` SHA used for remaining-work execution.
- Record the merge-base SHA against `origin/main`.
- Record the expected changed-file manifest for the completed Phase 1A/artifact-gate/CI-ownership/scaffold-default baseline.
- Confirm the source-only artifact-gate fix exists in both implementation and tests by checking for `artifact-gate.source_without_generated` in `src/lib/artifact-provenance.ts` and `src/commands/artifact-gate.test.ts`.
- Re-run or attach fresh command artifacts for every validation command claimed by the completed baseline.

Required run evidence artifact:

```text
artifacts/autoresearch/coderabbit-learnings-remaining-baseline/run.json
```

Minimum fields:

```json
{
	"schemaVersion": "harness-run-evidence/v1",
	"runType": "planning-artifact",
	"branch": "codex/north-star-artifact-surfaces",
	"headSha": "<filled-by-P0>",
	"mergeBaseSha": "<filled-by-P0>",
	"changedFileManifestSha256": "<filled-by-P0>",
	"commands": [
		{
			"command": "node_modules/.bin/vitest run src/commands/artifact-gate.test.ts",
			"status": "pass",
			"exitCode": 0,
			"artifact": "artifacts/autoresearch/coderabbit-learnings-remaining-baseline/artifact-gate-test.log"
		}
	]
}
```

P0 must fail fast if the baseline anchor is absent, stale, or does not contain the source-only artifact-gate fix. Later units must reference this run evidence instead of relying on stale prose pass claims.

## Run Classification

This plan is a feature implementation planning artifact.

Applicable validation:

- Repo docs validation.
- Focused Vitest coverage for changed command/library behavior.
- Typecheck, docstring, size, related-test, codestyle, and verify-work gates when implementation changes require them.
- Docs-gate when docs-agent, validation, tooling, governance, or docs-gate-covered documentation changes.

Not applicable unless a later plan revision changes scope to skill/plugin package hardening:

- `python3 plugins/skill-factory/skills/skill-creator/scripts/quick_validate.py <skill-path>`
- `./bin/ask skills audit <skill-path> --level strict --robot`
- `./bin/ask plugins doctor --robot`
- `./bin/ask plugins harden <plugin-path> --robot`

## Bootstrap and Setup Contract

P0 must create or verify the deterministic roots that later units depend on.

Committed example/config roots:

- `.harness/learnings/`
- `.harness/metrics/`
- `tests/fixtures/consumer-repos/`

Runtime artifact roots:

- `artifacts/autoresearch/`
- `artifacts/reviews/`

Rules:

- Example files may be committed when they define operator-facing defaults or schema examples.
- Runtime outputs must be written under `artifacts/` and excluded from product logic unless a command explicitly consumes them.
- Tests that depend on generated output directories must create temporary directories or call the bootstrap helper first.
- Missing setup roots must produce actionable setup errors, not silent empty metrics or skipped validation.

## Problem Frame

The spec is not finished when commands exist. The remaining risk is that learnings can still become another advisory report that agents read once and forget.

The unresolved product gap is durable promotion:

```text
promotion candidate
  -> accepted or rejected
  -> enforced by a named validator/test/scaffold rule
  -> measured by north-star feedback
```

Without this lifecycle, high-usage learnings can be repeatedly rediscovered, local artifacts cannot be safely shared, and review-context output remains disconnected from merge-readiness gates.

## North-Star Execution Alignment

This plan is complete only if the learning flow strengthens the north-star loop:

```text
repeated review learning
  -> imported evidence
  -> promotion decision
  -> durable enforcement state
  -> validator, gate, test, scaffold rule, or explicit non-goal
  -> review-gate or validation evidence
  -> north-star feedback metric
```

The plan must not expand into a general governance backlog. New work is in scope
only when it does at least one of these:

- reduces repeated PR review or rework comments,
- removes manual glue work between review, remediation, validation, and merge,
- makes acceptable agent output easier to produce reliably,
- preserves evidence, privacy, rollback, or independent-review safety for the
  learning flow.

Work that cannot show one of those links is deferred until the learning loop has
measured evidence that it reduces review-loop cost.

## Linear Alignment Spine

The remaining governance around this flow should stay as one parent lane
with a small set of child lanes, not as a broad backlog. The local
lane mapping below is canonical for future planning and PR closeout.

Linear sync status:

- `prohibited-by-policy`: external Linear issue creation was not completed
  because the runtime approval policy forbids sending these non-public repo
  planning details to Linear, even after user approval.
- Next safe action: use this local lane table as the alignment source
  unless a future governance decision explicitly changes the data-sharing
  boundary.

| Lane | Local owner | Plan scope | North-star outcome | Status |
| --- | --- | --- | --- | --- |
| Learning guardrails spine | Product/HE | Make CodeRabbit learnings into durable harness guardrails | Repeated review feedback becomes enforced and measurable instead of advisory | local-source-of-truth |
| Enforcement ledger | P1 | Durable learning promotion enforcement ledger | Promotion decisions survive runs and are cited by gates/tests | completed-local |
| Frontmatter validator | P2 | Frontmatter metadata learning validator | Highest-usage learning becomes a permanent regression guardrail | completed-local |
| Review-gate integration | P10 | Review-gate integration for generated review context | Blocking learning context affects readiness instead of being optional prose | completed-local |
| North-star metrics | P7 | North-star feedback metrics | The harness can measure learning hits, promotions, and unenforced risk | completed-local |
| Scaffold fixture proof | P6 | Downstream scaffold fixture proof | Learning-backed defaults work across Jamie project shapes | completed-local |
| Safe expansion layer | P3-P4, P8-P9 | Safe snapshots, exception rules, live companion metadata, and advisory fuzzy matching | Broader learning use remains privacy-safe, auditable, and non-noisy | completed-local |

Do not create additional Linear children for live CodeRabbit API integration,
dashboards, broad fuzzy blocking, or extra learning categories until this spine
has shipped and the north-star feedback output shows a concrete gap.

## Planning Decision

### Route

`fresh`

The prior Phase 1A plan has been closed out and intentionally exceeded. The remaining work should not be appended to that plan because it spans multiple later spec sections and needs a clean execution boundary.

### Depth

`deep`

The remaining work touches:

- persisted learning state,
- gate behavior,
- docs validation,
- snapshot privacy,
- downstream scaffold fixtures,
- review-gate integration,
- metrics artifacts,
- optional live provider evidence.

A lightweight plan would hide too many sequencing and rollback risks.

### Interface readiness

Mostly ready.

The spec defines caller-facing contracts for:

- `harness north-star-feedback`,
- sanitized snapshots,
- learning overrides,
- promotion status,
- review-context artifacts,
- validation-plan output,
- artifact provenance,
- CI ownership.

The one interface that should be tightened before implementation is promotion enforcement state. The spec defines `promotionStatus` and `enforcedBy`, but the implementation needs one canonical writeable ledger rather than hardcoded enforcement constants.

Recommended ledger:

```text
.harness/learnings/enforcement-status.json
```

Ledger ownership contract:

- `harness learnings promote --write-enforcement-status` is the only command allowed to mutate the ledger.
- Import, gate, review-context, validation-plan, snapshot, and north-star-feedback commands must treat the ledger as read-only input.
- Manual edits are allowed only for reviewed example files or explicit break-glass changes documented in PR notes.
- Writes must be atomic: write to a temporary file in the same directory, validate schema, then rename into place.
- Stale-write conflicts must fail with an actionable error instead of overwriting existing enforcement decisions.
- Unknown fields must be rejected unless a future schema version explicitly preserves extension fields.

Schema sketch:

```json
{
	"schemaVersion": "learning-enforcement-status/v1",
	"items": [
		{
			"learningId": "coderabbit.coding-harness.docs-frontmatter-machine-readable",
			"promotionStatus": "enforced",
			"enforcedBy": [
				"src/lib/docs-surface/frontmatter-metadata-gate.ts",
				"src/lib/docs-surface/frontmatter-metadata-gate.test.ts"
			],
			"reason": "High-usage frontmatter metadata learning promoted to a permanent validator."
		}
	]
}
```

## Requirements Trace

| Requirement                                                                         | Source spec area                         | Plan unit |
| ----------------------------------------------------------------------------------- | ---------------------------------------- | --------- |
| Mark promoted learnings as enforced by concrete files/tests                         | Promotion lifecycle                      | P1        |
| Add durable frontmatter metadata validator                                          | Promotion lifecycle, frontmatter rule    | P2        |
| Preserve local/shareable artifact boundary                                          | Artifact persistence defaults            | P3        |
| Detect sensitive-token patterns in imported text                                    | Import command behavior, security        | P3        |
| Add classification overrides and suppression path                                   | Suppression and override contract        | P4        |
| Validate fallback workflow trigger expectations                                     | CI ownership contract                    | P5        |
| Prove scaffold behavior across downstream repo shapes                               | Scaffold and downstream project behavior | P6        |
| Report learning hits, blocks, warnings, promotions, and unenforced high-usage items | North-star feedback metrics              | P7        |
| Add live companion metadata without replacing CSV evidence                          | Source and provenance contract           | P8        |
| Add measured keyword/fuzzy advisory matching without blocking                       | Matching and enforcement semantics       | P9        |
| Make review-context artifacts load-bearing in review-gate                           | Review context pack, interfaces          | P10       |

## Scope Boundaries

In scope:

- Canonical learning enforcement-status ledger.
- Frontmatter metadata validator for policy docs.
- Sanitized shareable snapshot output.
- Sensitive-token warning and redaction behavior for imports/snapshots.
- Override and suppression file loading.
- CI ownership fallback-workflow trigger validation.
- Downstream scaffold fixture matrix.
- `harness north-star-feedback`.
- Optional live companion metadata recording where evidence is coarse and clearly non-row-level.
- Keyword/fuzzy advisory matching with false-positive measurement.
- Review-gate integration for generated review-context artifacts.

Out of scope:

- Replacing CodeRabbit review or human approval.
- Using `coderabbit stats` as row-level learning evidence.
- Blocking on keyword-only matches before measured false-positive acceptance.
- Writing secrets or absolute local paths into shareable snapshots.
- Reopening the already fixed artifact-gate source-only drift bug.
- Rewriting existing command surfaces without a specific contract gap.

Deepened execution rule:

- Treat the current staged branch as the prerequisite baseline. Do not start P1-P10 until the already-fixed artifact-gate reciprocal source-only behavior and Phase 1A completion docs have either landed or been explicitly carried forward as the baseline diff.
- Treat `.harness/learnings/enforcement-status.json` as an overlay ledger, not a replacement for imported learning evidence. Imported rows remain historical evidence; the ledger records local enforcement decisions.
- Treat shareable snapshots as export artifacts with privacy constraints. They must not become the canonical local source for gates while local provider evidence exists.

## Execution Checkpoints

Use these checkpoints to keep `he-work` from drifting into broad implementation. Stop at the end of each checkpoint, record exact validation, then continue only when the checkpoint is green or the blocker is classified.

| Checkpoint                        | Units | Required proof                                                                                                                 | Stop trigger                                                                            |
| --------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| A: Baseline freeze                | P0    | Inventory maps completed surfaces to live files and confirms the artifact-gate source-only fix is in the baseline              | Current branch is not landed or baseline files disagree with the plan                   |
| B: Enforcement lifecycle          | P1-P2 | Ledger can mark a learning enforced and the frontmatter validator proves at least one enforced learning with a regression test | Ledger duplicates imported evidence instead of overlaying local enforcement state       |
| C: Privacy boundary               | P3-P4 | Snapshot export and overrides preserve local/private evidence boundaries and redact sensitive text                             | Shareable output contains absolute local paths, secrets, or raw sensitive learning text |
| D: Portability contracts          | P5-P6 | CI ownership fallback semantics and downstream scaffold fixtures pass independently                                            | A downstream fixture needs repo-specific assumptions that cannot generalize             |
| E: Measurement before enforcement | P7-P9 | North-star metrics can count hits/promotions before fuzzy matching is allowed to warn                                          | Keyword/fuzzy matching produces unmeasured blocking behavior                            |
| F: Load-bearing review            | P10   | Review-gate consumes review-context artifacts without weakening existing approval/current-head checks                          | Review-gate integration bypasses freshness or independent-review requirements           |

## Dependency Graph

Execution order is constrained as follows:

```text
current staged baseline
  -> P0 baseline reconciliation
  -> P1 enforcement-status ledger
  -> P2 frontmatter validator
  -> P7 north-star feedback
  -> P9 measured advisory matching
  -> P10 review-gate integration
```

Independent but baseline-dependent lanes:

- P3 sanitized snapshots can start after P1 defines enforcement status fields, because snapshot export must know how to represent enforcement state safely.
- P4 overrides can start after P1, because override decisions must reference canonical learning ids and promotion states.
- P5 CI ownership fallback semantics can start after the current baseline lands; it should not depend on learning ledger internals.
- P6 downstream scaffold fixtures can start after the current baseline lands; it should prove portability without waiting for metrics.
- P8 live companion metadata can start only after P3 proves sanitized provenance boundaries, because live metadata must not blur provider evidence with local CSV rows.

Do not reorder these dependencies unless a later plan update records the reason and the replacement validation proof.

## Stop Conditions

Stop and re-plan instead of improvising if any of these occur:

- The current Phase 1A branch is not the baseline for the remaining work, or the plan target changes.
- The enforcement ledger starts replacing imported learning rows instead of annotating them.
- Snapshot redaction cannot prove that secrets, tokens, absolute local paths, and private file URIs are absent from shareable output.
- A suppression rule can hide an error-level gate finding without a machine-readable reason, owner, expiry, and audit trail.
- CI ownership changes would make GitHub Actions the primary PR governance gate contrary to the repo contract.
- Review-gate integration would weaken CodeRabbit independence, current-head validation, or existing approval requirements.
- Fuzzy or keyword matching is proposed as blocking before false-positive measurement exists.

## Implementation Units

### P0: Reconcile the current baseline before new code

Files:

- `docs/plans/2026-04-28-feat-coderabbit-learnings-operational-evidence-phase-1a-plan.md`
- `docs/specs/2026-04-28-feat-coderabbit-learnings-operational-evidence-spec.md`
- `src/commands/learnings.ts`
- `src/lib/learnings/**`
- `src/commands/review-context.ts`
- `src/commands/validation-plan.ts`
- `src/commands/artifact-gate.ts`
- `src/commands/ci-ownership-gate.ts`

Work:

- Confirm the completed baseline from live code and tests.
- Create a short implementation inventory mapping spec sections to existing files.
- Identify any stale doc claims that still describe completed work as deferred.
- Write `artifacts/autoresearch/coderabbit-learnings-remaining-baseline/run.json` with branch, `HEAD`, merge-base, changed-file manifest hash, command outcomes, and artifact paths.
- Verify `.harness/learnings`, `.harness/metrics`, `tests/fixtures/consumer-repos`, and `artifacts/autoresearch` setup behavior before dependent units run.
- Do not change behavior in P0 unless the inventory exposes a safety contradiction.

Validation intent:

```bash
pnpm docs:lint
bash scripts/run-harness-gate.sh docs-gate --mode required --json
```

Deepening note:

- P0 must explicitly confirm whether `artifact-gate.source_without_generated` is present in live code/tests before treating the CodeRabbit P1 as closed for the remaining-plan baseline.

Completion criteria:

- The repo has one current source of truth for what remains.
- Existing completed command surfaces are not planned again.
- Remaining-work execution has an immutable baseline anchor and machine-readable run evidence.
- Required committed and runtime artifact roots have deterministic setup behavior.

Rollback:

- Revert inventory/doc-only edits.

### P1: Add learning enforcement-status ledger

Files:

- `src/lib/learnings/enforcement-status.ts`
- `src/lib/learnings/enforcement-status.test.ts`
- `src/lib/learnings/normalise.ts`
- `src/lib/learnings/promote.ts`
- `src/lib/learnings/promote.test.ts`
- `src/lib/learnings/types.ts`
- `.harness/learnings/enforcement-status.example.json`

Work:

- Add a versioned `learning-enforcement-status/v1` loader.
- Implement the ledger ownership contract: only `harness learnings promote --write-enforcement-status` writes, all other commands read.
- Support `promotionStatus` values from the spec: `unreviewed`, `candidate`, `accepted`, `enforced`, `rejected`, `deferred`, and `non_goal`.
- Merge imported item state with enforcement-status entries by learning ID.
- Populate `enforcedBy` from the ledger instead of hardcoded learning ID constants.
- Add atomic write and stale-write conflict handling for ledger updates.
- Keep missing ledger behavior non-blocking.
- Reject malformed ledger entries with actionable errors in commands that explicitly opt into strict mode.
- Add `src/lib/learnings/promote.test.ts` regression coverage that proves enforced learnings are excluded by default, included with `--include-enforced`, and retain their concrete `enforcedBy` file/test references.

Validation intent:

```bash
pnpm vitest run src/lib/learnings/enforcement-status.test.ts src/lib/learnings/normalise.test.ts src/lib/learnings/promote.test.ts
pnpm typecheck
```

Completion criteria:

- Promotion output excludes enforced learnings by default unless `--include-enforced` is passed.
- Enforced status is traceable to concrete files/tests.
- No hardcoded enforcement status remains for promoted learnings.

Rollback:

- Remove ledger loading and restore imported artifact-only promotion status.

### P2: Promote the high-usage frontmatter learning into a durable validator

Files:

- `src/lib/docs-surface/frontmatter-metadata-gate.ts`
- `src/lib/docs-surface/frontmatter-metadata-gate.test.ts`
- `src/lib/learnings/enforcement-status.ts`
- `src/lib/learnings/promote.test.ts`
- `.harness/learnings/enforcement-status.example.json`
- `docs/agents/04-validation.md`

Work:

- Implement the durable rule: YAML frontmatter fields are machine-readable metadata and must not be duplicated as prose headings or Table of Contents entries.
- Scope the validator to policy/docs surfaces where the frontmatter learning applies.
- Add fixture docs with valid frontmatter-only metadata and invalid body/TOC duplication.
- Add `enforcement-status` entry for `coderabbit.coding-harness.docs-frontmatter-machine-readable`.
- Ensure `harness learnings promote` reports the learning as enforced and references the validator/test path.
- Extend `src/lib/learnings/promote.test.ts` so the frontmatter promotion fixture asserts the promoted learning resolves through the enforcement-status ledger rather than a hardcoded constant.

Validation intent:

```bash
pnpm vitest run src/lib/docs-surface/frontmatter-metadata-gate.test.ts src/lib/learnings/promote.test.ts
bash scripts/run-harness-gate.sh docs-gate --mode required --json
```

Completion criteria:

- The frontmatter learning is no longer just a candidate.
- The rule has executable regression coverage.
- The validator produces actionable path-specific findings.

Rollback:

- Remove the validator and enforcement-status entry.

### P3: Implement sanitized shareable snapshots and sensitive-text handling

Files:

- `src/lib/learnings/artifact-io.ts`
- `src/lib/learnings/artifact-io.test.ts`
- `src/lib/learnings/sensitive-text.ts`
- `src/lib/learnings/sensitive-text.test.ts`
- `src/commands/learnings.ts`
- `src/lib/learnings/overrides.ts`
- `src/lib/learnings/live-companion.ts`
- `docs/agents/02-tooling-policy.md`

Work:

- Add sensitive-token pattern detection for imported free-text fields.
- Use one shared redaction utility for CSV imports, local artifacts, sanitized snapshots, overrides, live companion metadata, and command diagnostics.
- Emit warnings without printing sensitive values.
- Keep local artifacts allowed to preserve local provenance, but never print raw sensitive text in command output.
- Implement explicit sanitized snapshot output at `.harness/learnings/coderabbit.snapshot.json`.
- Ensure snapshots do not include absolute local paths, local source URIs, local commands, or sensitive raw values.
- Add `sourceLabel` and public GitHub URLs where available.

Validation intent:

```bash
pnpm vitest run src/lib/learnings/artifact-io.test.ts src/lib/learnings/sensitive-text.test.ts src/commands/learnings.test.ts
```

Completion criteria:

- Explicit snapshot output no longer returns `learnings.snapshot_deferred`.
- Snapshot fixtures prove no `/Users/...` paths are written.
- Sensitive strings are detected and redacted in snapshot output.
- Overrides, live companion metadata, and diagnostics use the same redaction path as imports and snapshots.

Rollback:

- Re-disable snapshot output with the prior usage error.

### P4: Add learning override and suppression support

Files:

- `src/lib/learnings/overrides.ts`
- `src/lib/learnings/overrides.test.ts`
- `src/lib/learnings/gate.ts`
- `src/lib/learnings/gate.test.ts`
- `src/commands/learnings.ts`
- `.harness/learnings/overrides.example.json`

Work:

- Implement `learning-override/v1` file loading.
- Support controlled overrides by learning ID, path pattern, reason, owner, expiry, and replacement action.
- Make expired overrides fail closed in strict mode and warn in advisory mode.
- Add `overrideSupport` or equivalent metadata to gate findings.
- Preserve `suppressible: false` for rules that the spec treats as non-suppressible.
- Add `src/lib/learnings/gate.test.ts` cases for expired overrides, non-suppressible findings ignoring override attempts, and valid overrides retaining audit metadata.

Validation intent:

```bash
pnpm vitest run src/lib/learnings/overrides.test.ts src/lib/learnings/gate.test.ts src/commands/learnings.test.ts
```

Completion criteria:

- High-usage false positives have a controlled path.
- Overrides are auditable and expiry-aware.
- Direct gate regression coverage proves expired overrides, non-suppressible findings, and valid override metadata behavior.
- Overrides cannot silently hide non-suppressible findings.

Rollback:

- Remove override loading and return to unsuppressed gate behavior.

### P5: Complete CI ownership fallback-workflow semantics

Files:

- `src/lib/ci/ownership-gate.ts`
- `src/commands/ci-ownership-gate.test.ts`
- `.harness/ci-required-checks.json`
- `harness.contract.json`
- `src/lib/contract/types-core.ts`
- `src/lib/contract/validator.test.ts`
- `README.md`
- `CONTRIBUTING.md`
- `AGENTS.md`
- `docs/agents/06-security-and-governance.md`

Work:

- Add or validate a machine-readable `ciOwnership` contract block if the current contract shape is insufficient.
- Define contract evolution rules for `ciOwnership`: schema/version bump behavior, defaulting for legacy downstream contracts, and backward-compatible parser behavior.
- Preserve CircleCI as primary PR gate.
- Preserve CodeRabbit as independent review check.
- Preserve Semgrep Cloud as independent security check.
- Validate fallback GitHub Actions workflows as manual/emergency-only where configured.
- Fail when fallback workflows are configured as automatic primary PR gates without an intentional contract update.
- Keep `.harness/ci-required-checks.json`, generated contract/default surfaces, and required-check docs aligned with the CI ownership contract.

Validation intent:

```bash
pnpm vitest run src/commands/ci-ownership-gate.test.ts src/lib/contract/validator.test.ts
pnpm run docs:ubiquitous:guard
bash scripts/run-harness-gate.sh docs-gate --mode required --json
```

Completion criteria:

- CI ownership covers primary, review, security, and fallback workflow roles.
- The gate explains exactly which workflow/check violates ownership policy.
- Required-check parity surfaces and docs remain aligned.
- Legacy contracts without `ciOwnership` have deterministic default behavior.

Rollback:

- Revert to required-check-only ownership validation.

### P6: Build the downstream scaffold fixture matrix

Files:

- `tests/fixtures/consumer-repos/**`
- `src/lib/init/scaffold-default-promotions.test.ts`
- `src/dev/test-harness-upgrade-matrix-script.test.ts`
- `scripts/test-harness-upgrade-matrix.mjs`
- `docs/agents/02-tooling-policy.md`

Work:

- Add minimal consumer repo fixtures for `cli-ts`, `vite`, `library`, `tauri`, and `unknown`.
- Prove `harness init` and update/dry-run flows preserve promoted defaults.
- Assert auth-free `.npmrc`, repo-local `scripts/harness-cli.sh`, real `CODESTYLE.md`, wrapper-first environment checks, first-class `toolingPolicy`, and Codex environment action sync.
- Keep fixture repos minimal and deterministic.

Validation intent:

```bash
pnpm vitest run src/lib/init/scaffold-default-promotions.test.ts src/dev/test-harness-upgrade-matrix-script.test.ts
pnpm test:harness-upgrade-matrix -- tests/fixtures/consumer-repos/cli-ts tests/fixtures/consumer-repos/vite tests/fixtures/consumer-repos/library tests/fixtures/consumer-repos/tauri tests/fixtures/consumer-repos/unknown
```

Completion criteria:

- Scaffold defaults are proven across representative downstream project shapes.
- Upgrade/dry-run does not mutate fixture git status unexpectedly.

Rollback:

- Remove fixture matrix and keep single-template regression tests.

### P7: Implement `harness north-star-feedback`

Files:

- `src/commands/north-star-feedback.ts`
- `src/commands/north-star-feedback.test.ts`
- `src/lib/learnings/north-star-feedback.ts`
- `src/lib/learnings/north-star-feedback.test.ts`
- `src/lib/cli/registry/command-specs-core.ts`
- `src/lib/cli/registry/command-specs.test.ts`
- `docs/cli-reference.md`
- `.harness/metrics/north-star-feedback.example.json`

Work:

- Add command registration and JSON output.
- Count learning hits, warnings, blocks, promotion candidates, promoted learnings, high-usage unenforced learnings, review-thread count when supplied, and validation reruns when supplied.
- Write `.harness/metrics/north-star-feedback.json` when `--output` is provided.
- Include source artifact fingerprint and generated timestamp.
- Keep missing optional inputs as `insufficient_evidence`, not as silent zeroes.

Validation intent:

```bash
pnpm vitest run src/commands/north-star-feedback.test.ts src/lib/learnings/north-star-feedback.test.ts src/lib/cli/registry/command-specs.test.ts
bash scripts/run-harness-gate.sh docs-gate --mode required --json
```

Completion criteria:

- `harness north-star-feedback --json` reports high-usage unenforced learnings and promoted counts.
- Metrics distinguish true zero from missing evidence.

Rollback:

- Remove command registration and metrics writer.

### P8: Add optional live companion metadata

Files:

- `src/lib/learnings/live-companion.ts`
- `src/lib/learnings/live-companion.test.ts`
- `src/commands/learnings.ts`
- `docs/agents/02-tooling-policy.md`

Work:

- Add an optional `--live-companion` input for coarse provider metadata.
- Define a shared `live-companion/v1` schema and validate all live companion inputs through one module.
- Keep CodeRabbit CSV rows as the only row-level learning source.
- Reject non-JSON or ambiguous live companion data unless a parser is explicitly implemented and tested.
- Store live companions separately from `source`.
- Make output state clear that live companion metadata is not row-level evidence.

Validation intent:

```bash
pnpm vitest run src/lib/learnings/live-companion.test.ts src/commands/learnings.test.ts
```

Completion criteria:

- Live metadata can enrich freshness context without changing imported row identity.
- `coderabbit stats` cannot be mistaken for the learning source.
- All live companion producers and consumers use the shared schema module.

Rollback:

- Remove live companion parsing and retain CSV-only provenance.

### P9: Add measured keyword/fuzzy advisory matching

Files:

- `src/lib/learnings/fuzzy-match.ts`
- `src/lib/learnings/fuzzy-match.test.ts`
- `src/lib/learnings/gate.ts`
- `src/lib/learnings/gate.test.ts`
- `src/lib/learnings/review-context.ts`

Work:

- Add keyword/fuzzy matching only for advisory `warning` or `info` findings.
- Require exact path/classification confidence before any fail severity.
- Emit match confidence and match reason.
- Add fixtures that prove low-confidence keyword-only matches do not fail the gate.
- Track false-positive candidates for north-star feedback.
- Add `src/lib/learnings/gate.test.ts` coverage proving keyword-only matches stay `warning` or `info`, never escalate to blocking severity, and emit confidence/reason metadata for north-star measurement.

Validation intent:

```bash
pnpm vitest run src/lib/learnings/fuzzy-match.test.ts src/lib/learnings/gate.test.ts src/commands/review-context.test.ts
```

Completion criteria:

- Keyword-only matches are useful in context but cannot block merges.
- Gate regression coverage fails if keyword-only matching becomes blocking before measured false-positive acceptance.
- Match confidence is machine-readable.

Rollback:

- Disable fuzzy matching and fall back to exact-file/path-prefix matches.

### P10: Integrate review-context with review-gate

Files:

- `src/commands/review-gate.ts`
- `src/commands/review-gate.test.ts`
- `src/lib/review-gate/**`
- `src/lib/learnings/review-context.ts`
- `docs/agents/04-validation.md`

Work:

P10a advisory integration:

- Add review-gate input for generated review-context artifacts.
- Validate review-context schema, source fingerprint, changed-file coverage, and freshness.
- Emit findings when high-severity learning context was generated but not acknowledged.
- Preserve existing review-gate approval-state and current-head checks.

P10b mandatory integration:

- Add a repo policy flag that makes review-context required under named conditions.
- Define mandatory conditions explicitly before enabling them. Candidate conditions are: review-context artifact exists for the PR, learnings gate emitted high-severity context, or the repo contract enables strict learned-context review.
- Missing or stale review-context artifacts may block only when the policy flag and conditions are both satisfied.
- Advisory integration alone does not satisfy the “mandatory review-gate integration” goal.

Validation intent:

```bash
pnpm vitest run src/commands/review-gate.test.ts src/commands/review-context.test.ts src/lib/review-gate/decision-packet.test.ts
bash scripts/run-harness-gate.sh docs-gate --mode required --json
```

Completion criteria:

- Review-context artifacts can become load-bearing without weakening existing merge-readiness checks.
- P10a proves advisory consumption and schema/freshness validation.
- P10b proves mandatory behavior under an explicit repo policy flag.
- Missing or stale artifacts fail only when configured strict mode and mandatory conditions apply.

Rollback:

- Remove review-context review-gate input and keep review-context advisory.

## Validation Plan

Validation should widen by checkpoint, not by habit. Every implementation unit needs one focused proof for the touched behavior plus the repo-required gate for any changed surface.

Minimum validation ladder:

| Change surface                                             | Narrow proof                                                            | Required wider proof                                                             |
| ---------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Learning parser, ledger, overrides, snapshots, metrics     | Focused `vitest` file for the touched module/command                    | `pnpm typecheck` and `bash scripts/validate-codestyle.sh --fast` before handoff  |
| CLI command registry or wrapper routing                    | Command-spec tests plus wrapper smoke where the built CLI path matters  | `pnpm build` when wrapper behavior depends on `dist/cli.js`                      |
| Docs-agent, validation, tooling, or docs-gate-covered docs | `pnpm docs:lint`                                                        | `bash scripts/run-harness-gate.sh docs-gate --mode required --json`              |
| Runtime/artifact provenance behavior                       | Focused command test plus real wrapper invocation for the exact gate    | `pnpm test:deep` if artifact/runtime behavior expands beyond the gate path       |
| Review-gate behavior                                       | Focused review-gate regression covering stale/missing/current artifacts | Existing review-gate validation plus `bash scripts/validate-codestyle.sh --fast` |

Before a PR handoff, run `bash scripts/validate-codestyle.sh --fast`. Before merge readiness, run the repository aggregate gate named by the current repo contract and report any environment blocker exactly.

Focused validation should run after each implementation unit.

Pre-handoff validation for the full remaining-work slice:

```bash
pnpm typecheck
pnpm run quality:docstrings
pnpm run quality:size
pnpm run test:related
bash scripts/run-harness-gate.sh docs-gate --mode required --json
bash scripts/validate-codestyle.sh --fast
```

Broader readiness validation before PR handoff:

```bash
pnpm check
bash scripts/verify-work.sh --fast
```

Deep validation when runtime/artifact behavior changes:

```bash
pnpm test:deep
```

Validation notes:

- Snapshot output tests must assert that no absolute `/Users/...` paths appear.
- Sensitive-text tests must assert values are not printed.
- Fuzzy matching tests must assert keyword-only hits do not fail the gate.
- Review-gate integration must preserve existing approval and current-head safety checks.
- CI ownership tests must include fallback workflow trigger fixtures.

## Risks and Mitigations

| Risk                                                       | Mitigation                                                                                                               |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Promotion state becomes another stale artifact             | Make the enforcement-status ledger small, schema-versioned, and validated by promotion output tests.                     |
| Snapshot output leaks local paths or sensitive text        | Block snapshot writes until sanitization tests pass; assert no absolute paths or token-like strings appear.              |
| Overrides hide real high-severity findings                 | Require owner, reason, expiry, and suppressible checks; fail expired overrides in strict mode.                           |
| Fuzzy matching creates noisy blockers                      | Keep fuzzy/keyword matches advisory until measured false-positive behavior justifies escalation.                         |
| CI ownership overfits this repo                            | Keep provider/check names configurable through contract fields, but preserve default CircleCI/CodeRabbit/Semgrep policy. |
| Scaffold matrix becomes slow or brittle                    | Use minimal fixture repos and dry-run/update tests before widening to real downstream repos.                             |
| Review-gate integration weakens existing merge safety      | Add review-context checks as an additive layer; do not remove approval/current-head/plan-traceability checks.            |
| Live companion metadata is mistaken for row-level evidence | Store it separately from source and label it coarse/freshness-only.                                                      |

## Rollback and Recovery

Rollback should happen by unit:

- P1 rollback: remove enforcement-status loader and use imported artifact status only.
- P2 rollback: remove frontmatter validator and enforcement-status entry.
- P3 rollback: re-disable snapshot writes and keep local artifacts only.
- P4 rollback: ignore override files and remove suppression metadata from findings.
- P5 rollback: return CI ownership gate to provider plus required-check validation.
- P6 rollback: remove downstream fixture matrix and keep single-template tests.
- P7 rollback: remove `north-star-feedback` command registration and metrics writer.
- P8 rollback: remove live companion metadata support.
- P9 rollback: disable fuzzy matching.
- P10 rollback: remove review-context input from review-gate.

Recovery rules:

- Failed snapshot writes must not leave partial snapshot files.
- Failed metrics writes must not overwrite prior metrics.
- Malformed override files must produce actionable errors.
- Missing optional live companion metadata must not fail CSV import.
- Strict review-gate mode must distinguish missing, stale, and schema-invalid review-context artifacts.

## Execution Ledger

STEP_ID | status (pending|in_progress|completed) | owner | evidence
P0 | completed | codex | Baseline evidence recorded in `artifacts/autoresearch/coderabbit-learnings-remaining-baseline/run.json`; docs-gate returned 0 errors and 4 non-blocking warnings for the broader dirty branch diff.
P1 | completed | codex | Enforcement-status ledger implemented with overlay loading, atomic stale-write protection, promotion filtering, and focused validation: `pnpm vitest run src/lib/learnings/enforcement-status.test.ts src/lib/learnings/normalise.test.ts src/lib/learnings/promote.test.ts && pnpm typecheck`.
P2 | completed | codex | Frontmatter metadata validator extracted to `src/lib/docs-surface/frontmatter-metadata-gate.ts`, enforcement-status ledger entry added, and focused validation passed: `pnpm vitest run src/lib/docs-surface/frontmatter-metadata-gate.test.ts src/lib/learnings/promote.test.ts`, `bash scripts/run-harness-gate.sh docs-gate --mode required --json` returned 0 errors/4 non-blocking warnings, and `pnpm typecheck` passed.
P3 | completed | codex | Sanitized snapshot and sensitive-text handling implemented with shared redaction utilities, snapshot output at `.harness/learnings/coderabbit.snapshot.json`, and focused validation passed: `pnpm vitest run src/lib/learnings/artifact-io.test.ts src/lib/learnings/sensitive-text.test.ts src/commands/learnings.test.ts`; `pnpm typecheck` passed; `bash scripts/run-harness-gate.sh docs-gate --mode required --json` returned 0 errors/4 non-blocking warnings for the broader dirty branch diff.
P4 | completed | codex | Override/suppression contract implemented with audited `learning-override/v1` loading, strict/advisory expiry handling, non-suppressible artifact findings, and focused validation passed: `pnpm vitest run src/lib/learnings/overrides.test.ts src/lib/learnings/gate.test.ts src/commands/learnings.test.ts`; `pnpm typecheck` passed.
P5 | completed | codex | CI ownership fallback workflow semantics covered with `ciOwnership` contract validation, gate checks for primary/review/security/fallback roles, docs alignment, and validation passed: `pnpm vitest run src/commands/ci-ownership-gate.test.ts src/lib/contract/validator.test.ts`; `pnpm typecheck`; `pnpm run docs:ubiquitous:guard`; `bash scripts/run-harness-gate.sh docs-gate --mode required --json` returned pass with 0 errors/0 warnings.
P6 | completed | codex | Downstream scaffold fixtures added for `cli-ts`, `vite`, `library`, `tauri`, and `unknown`; matrix runner now materializes fixtures as tracked installs before update dry-run; validation passed: `pnpm vitest run src/lib/init/scaffold-default-promotions.test.ts src/dev/test-harness-upgrade-matrix-script.test.ts`; `pnpm test:harness-upgrade-matrix -- tests/fixtures/consumer-repos/cli-ts tests/fixtures/consumer-repos/vite tests/fixtures/consumer-repos/library tests/fixtures/consumer-repos/tauri tests/fixtures/consumer-repos/unknown`; `pnpm typecheck`.
P7 | completed | codex | `harness north-star-feedback` implemented with nullable evidence metrics, command registration, CLI docs, and example metrics artifact; validation passed: `pnpm vitest run src/commands/north-star-feedback.test.ts src/lib/learnings/north-star-feedback.test.ts src/lib/cli/registry/command-specs.test.ts`; `pnpm typecheck`; `bash scripts/run-harness-gate.sh docs-gate --mode required --json` returned pass with 0 errors/0 warnings.
P8 | completed | codex | Optional live companion metadata implemented as coarse `live-companion/v1` provider context that stays separate from row-level CSV evidence; validation passed: `pnpm vitest run src/lib/learnings/live-companion.test.ts src/commands/learnings.test.ts`; `pnpm typecheck`; `bash scripts/run-harness-gate.sh docs-gate --mode required --json` returned pass with 0 errors/0 warnings.
P9 | completed | codex | Fuzzy/keyword advisory matching implemented with confidence, reason, advisory-only, and false-positive-candidate metadata; keyword-only matches are capped at warning/info and review-context applies enforcement-status overlays; validation passed: `pnpm vitest run src/lib/learnings/fuzzy-match.test.ts src/lib/learnings/gate.test.ts src/commands/review-context.test.ts`; `pnpm typecheck`.
P10 | completed | codex | Review-context artifact integration added to review-gate. Validation: `pnpm vitest run src/commands/review-gate.test.ts src/commands/review-context.test.ts src/lib/review-gate/decision-packet.test.ts src/lib/cli/registry/command-specs.test.ts` passed with 4 files and 163 tests; `pnpm typecheck` passed; `bash scripts/run-harness-gate.sh docs-gate --mode required --json` passed with 0 errors, 0 warnings, and 15 info findings.

## Handoff to HE Work

Recommended next stage: `he-code-review`.

Readiness: implementation complete locally; final readiness now depends on PR
review and required checks. External Linear sync remains out of scope unless a
future governance decision changes the data-sharing boundary.

Closeout constraints:

- Do not reopen P0-P10 implementation unless live code or PR review proves drift.
- Do not create a wider learning-platform backlog until the local spine above is
  accepted as the control boundary or explicitly replaced by an approved tracker
  mapping.
- Do not start live CodeRabbit API work, dashboards, or blocking fuzzy matching
  until north-star feedback shows a concrete need.
- Treat the branch as the current implementation boundary; new scope requires a
  plan update that explains how it reduces repeated review or rework cost.

Recommended closeout sequence:

1. Run final PR readiness review with `he-code-review`.
2. Resolve any remaining CodeRabbit/Codex comments against the current code.
3. Confirm required checks are green.
4. Keep the local alignment spine updated unless external tracker sync becomes
   permitted by policy.
5. Merge only after independent review and required checks remain green.

## Sources and References

- Source spec: [docs/specs/2026-04-28-feat-coderabbit-learnings-operational-evidence-spec.md](../specs/2026-04-28-feat-coderabbit-learnings-operational-evidence-spec.md)
- Prior plan: [docs/plans/2026-04-28-feat-coderabbit-learnings-operational-evidence-phase-1a-plan.md](./2026-04-28-feat-coderabbit-learnings-operational-evidence-phase-1a-plan.md)
- Learning command: `src/commands/learnings.ts`
- Learning library: `src/lib/learnings/`
- Review context command: `src/commands/review-context.ts`
- Validation plan command: `src/commands/validation-plan.ts`
- Artifact gate command: `src/commands/artifact-gate.ts`
- CI ownership gate command: `src/commands/ci-ownership-gate.ts`
