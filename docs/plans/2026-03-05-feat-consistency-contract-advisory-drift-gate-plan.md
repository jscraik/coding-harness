---
title: "feat: Consistency Contract + Advisory Drift Gate"
type: feat
status: completed
date: 2026-04-13
plan_id: feat-consistency-contract-advisory-drift-gate
origin: docs/brainstorms/2026-03-05-consistency-contract-drift-gate-brainstorm.md
last_validated: 2026-04-18
---

# feat: Consistency Contract + Advisory Drift Gate

## Table of Contents
- [Enhancement Summary](#enhancement-summary)
- [Overview](#overview)
- [Problem Statement / Motivation](#problem-statement--motivation)
- [Research Summary](#research-summary)
- [Proposed Solution](#proposed-solution)
- [Technical Considerations](#technical-considerations)
- [System-Wide Impact](#system-wide-impact)
- [Acceptance Criteria](#acceptance-criteria)
- [Success Metrics](#success-metrics)
- [Dependencies & Risks](#dependencies--risks)
- [Implementation Scope (MVP)](#implementation-scope-mvp)
- [Implementation Steps](#implementation-steps)
- [Checkpoints Go/No-Go](#checkpoints-gono-go)
- [Verification Plan](#verification-plan)
- [Troubleshooting](#troubleshooting)
- [SpecFlow Analysis (Coverage + Edge Cases)](#specflow-analysis-coverage--edge-cases)
- [Open Questions](#open-questions)
- [Sources & References](#sources--references)

## Enhancement Summary

**Deepened on:** 2026-03-05  
**Sections enhanced:** 10  
**Research inputs used:** local repo evidence, matched skills (`cli-spec`, `docs-expert`, `agent-native-architecture`, `tech-spec`, `security-best-practices`), Context7 (`/nodejs/node`, `/vitest-dev/vitest`), web primary sources.

### Key Improvements
1. Added execution-ready phases with file-level scope, checkpoints, and verification gates.
2. Added concrete ops/performance/security guardrails (SLOs, determinism, tamper/redaction controls, resource limits).
3. Added CLI contract shape for a deterministic advisory gate surface and stable machine output expectations.

### New Considerations Discovered
- Plan schema and lifecycle vocabulary drift can undermine governance checks unless explicitly normalized.
- Baseline-vs-new contradiction handling needs integrity protection and explicit ownership to avoid policy gaming.
- Several requested parallel agents failed due model quota; smallest safe fallback was manual consolidation of completed skill outputs plus direct docs research.

## Overview

Introduce a repo-level consistency contract and advisory drift gate that continuously checks whether key governance artifacts stay aligned. This plan carries forward the brainstorm’s direction to target high-impact truth surfaces first, optimize for zero contradictions, and start in advisory mode (see brainstorm: `docs/brainstorms/2026-03-05-consistency-contract-drift-gate-brainstorm.md`).

This is an MVP reliability initiative, not a full architecture rewrite. The immediate objective is to reduce confusion and review churn caused by contradictory signals across docs, command help/indexing, status tracking, and lifecycle markers.

## Problem Statement / Motivation

Current repo state shows coherence drift across governance surfaces:

- `docs/QUALITY_SCORE.md` reports `Score: 0/100` with `Stale Docs: 35`.
- `todos/*-ready-*.md` entries include `status: complete`, creating filename/frontmatter contradiction.
- `src/cli.ts` contains manual command/help wiring with duplicate policy-gate handling paths, increasing drift risk between behavior and docs/help output.
- Several command modules have no same-name command test file, reducing confidence in command-surface consistency.

This plan addresses those contradictions using a single consistency model and recurring advisory feedback (see brainstorm origin).

## Research Summary

### Brainstorm foundation (authoritative WHAT)
- Chosen approach: **Consistency Contract + Drift Gate (advisory-first)**.
- Scope boundary: **MVP guardrails** on highest-impact surfaces, not repo-wide unification.
- Success criterion: **zero contradictions** on in-scope surfaces.
- Enforcement posture: **advisory-first**, then evaluate hard-gate promotion.
- Open questions from brainstorm: **none** (see brainstorm origin).

### Local repo findings
- Reusable planning pattern exists for origin-linked plans with strong sectioning and ToC.
- Drift and governance indicators exist already (gardener/status/docs), but are fragmented.
- Command routing/help remains centralized and manually synchronized in `src/cli.ts`.

### Institutional learnings (`docs/solutions/`)
- `docs/solutions/` directory is currently missing; no institutional learnings file set was available.

### Research execution validation
- Attempted to run required planning agents (`repo-research-analyst`, `learnings-researcher`, `spec-flow-analyzer`), but all failed due model usage cap.
- Smallest safe fix applied: complete equivalent local evidence scan and explicit manual SpecFlow-style coverage analysis in this plan.

## Proposed Solution

Create an explicit consistency contract for a defined set of truth surfaces and add an advisory drift gate that produces deterministic, actionable reports.

In MVP, the contract will govern:
1. Command surface parity (declared command set vs help/index outputs).
2. Status/document parity (status narratives and quality signals).
3. Todo lifecycle parity (filename state markers vs frontmatter status).
4. Quality score metadata integrity (expected structure and freshness signals).

The gate remains non-blocking in v1, but must publish machine-readable output and stable diagnostics to support later promotion to blocking mode (see brainstorm origin). In advisory mode, the drift command must be exit-neutral (`exitCode: 0`) and encode outcome via structured status (`success|partial|blocked`); any hard-fail behavior belongs in a separate checker-health gate.

### Research Insights

**Best Practices:**
- Use one canonical source and derive all presentation surfaces (helps eliminate split-brain docs/help behavior).
- Separate read/evaluate from mutate actions; keep mutation paths explicit and opt-in.
- Version machine-readable output schema and keep changes additive.

**Performance Considerations:**
- Scope checks to changed files when possible to keep CI latency stable.
- Keep rule evaluation deterministic on unchanged input to prevent noisy retries.

**Implementation Details (conceptual contract example):**
```text
status: success | partial | blocked
outcome: ok | error
error_class: none | evaluator | io | schema | runtime | integrity
rule_result: pass | fail | not_applicable | error
rule_id: <stable-id>
baseline_state: preexisting | new
surface: command | status | todo | quality-score
```

**Edge Cases:**
- Intentional aliases need an explicit allowlist policy.
- Missing optional artifacts should report `rule_result=not_applicable` (top-level status stays `success|partial|blocked`), not hard errors.

## Technical Considerations

- Prefer one canonical source per truth surface, then derive/read-only views from it.
- Avoid broad refactors in v1 (YAGNI); limit to contradiction-prone surfaces identified in research.
- Preserve developer velocity by starting advisory-only while measuring false-positive rate.
- Keep output deterministic and CI-friendly (stable schema, explicit rule IDs, actionable remediation text).
- Preserve compatibility with existing governance workflows and docs conventions already used in `docs/plans/`.

### Research Insights

**Best Practices:**
- Node CLI behavior should prefer deterministic error handling and explicit stdout/stderr contracts.
- CLI argument contracts should be explicit and parseable (single source for command/flag surface).

**Performance Considerations:**
- Define p95 runtime + memory budgets for advisory runs before scaling scope.
- Add stress fixtures for no-drift, known-drift, partial-edits, and alias scenarios.

**Implementation Details:**
```text
Initial operational SLO targets:
- Drift gate infra success rate >= 99.5%
- Unchanged-input deterministic output = 100%
- Advisory false-positive rate <= 5% after baseline week
```

**Edge Cases:**
- Symlink/path traversal attempts in scanned surfaces.
- Oversized files or pathological patterns causing parser slowdowns.
- Output injection (ANSI/markdown control chars) in findings summaries.

## System-Wide Impact

- **Interaction graph:** Editing governance files or command metadata triggers consistency checks, which produce advisory artifacts consumed by maintainers and CI reviewers.
- **Error propagation:** Drift detection failures should return structured diagnostics. In advisory mode, process exit remains neutral (`exitCode: 0`) and distinguishes drift findings (`status=partial`) from checker failures (`outcome=error`, `error_class=*`); optional checker-health jobs may fail independently.
- **State lifecycle risks:** Partial updates to one surface can temporarily raise advisory drift findings; the contract must support clear “source vs derived” guidance to avoid orphaned contradictory states.
- **API surface parity:** Any command index/help/readme/documented command list treated as public surfaces must remain synchronized to the canonical command declaration.
- **Integration test scenarios:** Cross-layer checks are needed for docs + command surface + todo metadata interactions that unit tests with isolated mocks won’t catch.

## Acceptance Criteria

- [x] A documented consistency contract exists with explicit MVP surface coverage and rule definitions.
- [x] Advisory drift gate runs in CI/local check flow and emits machine-readable results plus human-readable summaries.
- [x] Contradiction rules include, at minimum:
  - [x] command surface parity checks (canonical source: command metadata registry; deterministic dispatch extraction is bootstrap fallback only until registry is present; do not parse help text as canonical input),
  - [x] todo filename/frontmatter parity checks (explicit lifecycle mapping: `ready -> ready`, `complete -> complete`, `deferred -> deferred`, with alias policy documented in contract),
  - [x] quality score structure/freshness checks,
  - [x] status narrative coherence checks for canonical docs list: `README.md`, `docs/QUALITY_SCORE.md`, `docs/roadmap/agent-first-status.md`.
- [x] Rule outputs include deterministic identifiers and remediation guidance.
- [x] Advisory mode is default; no merge blocking in MVP.
- [x] Advisory-mode drift command is exit-neutral (`exitCode: 0`) for findings/evaluator failures and exposes `status: success|partial|blocked` in machine output.
- [x] Baseline run captures current drift debt and distinguishes pre-existing vs newly introduced contradictions.
- [x] Plan-source linkage remains explicit (`origin` frontmatter + source references to brainstorm decisions).
- [ ] Security controls are explicit for report redaction, path safety, resource limits, and baseline integrity.
- [x] Deterministic CLI/output expectations are explicit (stable rule IDs + stable output schema in advisory mode).
- [ ] Verification-before-completion gates are defined for all “ready/passing” claims.

## Success Metrics

- Contradictions on MVP surfaces trend to zero within 4–6 weeks (see brainstorm success definition).
- Advisory drift findings become mostly actionable (low noisy/false-positive rate).
- Reduced review churn tied to “docs/status/help mismatch” comments.
- Stable CI observability: repeated runs on unchanged inputs produce identical findings.

## Dependencies & Risks

### Dependencies
- Agreement on canonical ownership per truth surface.
- Existing command/docs maintenance workflows remain available.
- CI path to run advisory drift checks and publish outputs.
- Agreement on baseline artifact ownership and update policy.

### Risks
- **Noise risk:** early rule tuning may produce low-signal alerts.
- **Scope creep risk:** expanding beyond MVP surfaces could delay value.
- **Ownership ambiguity:** unclear source-of-truth ownership can recreate drift.
- **Trust risk:** advisory reports without clear remediation could be ignored.
- **Security risk:** report/artifact handling could leak sensitive content without explicit redaction and sanitization rules.
- **Integrity risk:** baseline artifacts could be tampered with if update controls are weak.

### Mitigations
- Start with narrow, high-value rule set.
- Publish explicit ownership mapping in contract docs.
- Track and tune false-positive rate before any blocking promotion.
- Require read-only-by-default execution and explicit mutation approvals.
- Add baseline hash/integrity checks and reviewer ownership for baseline updates.

## Implementation Scope (MVP)

### In scope
- Canonical contract definition for MVP surfaces.
- Advisory drift gate with report outputs.
- Baseline drift snapshot and delta-focused reporting.
- Initial docs updates that explain source-of-truth boundaries.

### Out of scope
- Full CLI architecture rewrite.
- Repo-wide governance unification in one phase.
- Immediate enforcement as hard merge-blocking.

## Implementation Steps

### Phase 0 — Contract boundaries and ownership lock
- Define canonical ownership matrix for each truth surface (command/status/todo/quality-score).
- Define rule ID namespace and baseline artifact ownership/update policy.
- Reference dependency plan: `docs/plans/2026-03-05-feat-command-metadata-registry-core-parity-plan.md` as prerequisite for canonical command-surface source.
- Define canonical source list explicitly:
  - command surface source: command metadata registry only; deterministic dispatch extraction output may be used as bootstrap fallback only when registry is not yet present, and must never be treated as canonical when both exist; human-authored help text is always derived.
  - status docs: `README.md`, `docs/QUALITY_SCORE.md`, `docs/roadmap/agent-first-status.md`,
  - todo lifecycle source: `todos/*.md` filename token + frontmatter `status`.
- Target files (planning/spec): `contracts/consistency-contract.schema.yaml` (new), `contracts/consistency-baseline-pointer.json` (new), command-registry source artifact, this plan.

### Phase 1 — Contract schema and deterministic rule model
- Define contract fields, rule metadata, severity, and output schema versioning.
- Ensure baseline-vs-new distinction is part of contract, not post-processing.
- Define `consistency-baseline-publish` producer workflow behavior on `main` (pinned-actions compatible) to generate and publish baseline artifacts consumed by PR jobs.
- Define baseline artifact contract:
  - latest baseline snapshot: `artifacts/consistency-gate/consistency-baseline-latest.json`,
  - baseline history: `artifacts/consistency-gate/consistency-baseline-history/<timestamp>.json`,
  - source-of-truth baseline for PR runs uses both sources with precedence:
    1) resolve pointer/snapshot metadata from the **base/default branch** version of `contracts/consistency-baseline-pointer.json` (PR-local pointer edits are ignored for that run),
    2) fallback to latest successful default-branch artifact `consistency-baseline-latest` (containing `artifacts/consistency-gate/consistency-baseline-latest.json`) when pointer target is unavailable,
  - deterministic artifact resolver for fallback source:
    - workflow: `pr-pipeline.yml` baseline-publish job on `main`,
    - branch filter: `main` only,
    - run status filter: `success`,
    - artifact name: `consistency-baseline-latest`,
    - tie-break rule: newest successful run id (or latest completion timestamp),
  - baseline bootstrap algorithm for PR runs:
    1) resolve baseline source via precedence above,
    2) fetch baseline snapshot (API/artifact download as needed),
    3) verify checksum + schemaVersion,
    4) hydrate `artifacts/consistency-gate/consistency-baseline-latest.json`,
    5) if missing/unavailable: run `initial-baseline` bootstrap behavior (non-blocking for first rollout), emit explicit warning artifact with remediation guidance, and create/refresh baseline seed from default branch,
  - schemaVersion required,
  - retention window + immutability policy + update approver role.
- Target files: contract + schema docs + test fixtures.

### Phase 2 — Rule engine and report semantics
- Implement read-only advisory evaluation path and machine-readable report output.
- Add explicit status semantics (`success|partial|blocked`) and deterministic rule ordering.
- Target files: drift-gate command/lib modules and tests.

### Phase 3 — CLI/help/docs parity and CI advisory integration
- Enforce command/help/docs parity for the new consistency surface.
- Publish advisory artifacts in CI with stable paths and deterministic naming.
- Integrate explicit CI job in `.github/workflows/pr-pipeline.yml`:
  - job name: `consistency-drift-advisory`,
  - permissions: `contents: read`, `pull-requests: read`, `actions: write`,
  - bootstrap steps: `actions/checkout`, `actions/setup-node@v4` (Node 24), `corepack enable`, `pnpm install`,
  - pre-step: `mkdir -p artifacts/consistency-gate` and hydrate `artifacts/consistency-gate/consistency-baseline-latest.json` from default-branch baseline source,
  - command: `pnpm exec tsx src/cli.ts drift-gate --mode advisory --json --out artifacts/consistency-gate/consistency-drift-advisory-latest.json` (must always emit schema-valid JSON stub on every terminal path),
  - upload step: `actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02` with `if: always()`, artifact name `consistency-drift-advisory-latest`, path `artifacts/consistency-gate/consistency-drift-advisory-latest.json`,
  - advisory guard step: validate presence/schema and emit warning summary + fallback stub metadata if invalid/missing (must not fail advisory job),
  - integrity step: compute and persist checksum for uploaded advisory artifact.
- Integrate companion CI health job in `.github/workflows/pr-pipeline.yml`:
  - job name: `consistency-drift-health`,
  - permissions: `contents: read`, `pull-requests: read`, `actions: write`,
  - bootstrap steps: `actions/checkout`, `actions/setup-node@v4` (Node 24), `corepack enable`, `pnpm install`,
  - command: `pnpm exec tsx src/cli.ts drift-gate --mode health --json --out artifacts/consistency-gate/health.json`,
  - behavior: non-zero exit on evaluator/runtime/integrity/schema/io failures,
  - first-run bootstrap: until baseline seed exists, health job emits bootstrap warning and exits 0; once seed exists, enforce normal non-zero failure behavior,
  - branch protection: require `consistency-drift-health` after baseline seed checkpoint; keep `consistency-drift-advisory` informational in MVP.
- Action pinning rule: all newly added workflow actions must use full SHA-pinned `uses:` references to satisfy `actions-pinning` policy.
- branch-protection defaults: update canonical required-check defaults used by `init` + `branch-protect` and add regression tests proving fresh bootstrap includes `consistency-drift-health` where applicable.
- Target files: CLI dispatch/help surface, README command index, `.github/workflows/pr-pipeline.yml`, baseline-publish workflow on `main`, required-check default sources used by `init`/`branch-protect`, and corresponding regression tests.
- Local artifact hygiene: add `artifacts/consistency-gate/` to `.gitignore` and define local retention/cull behavior for history artifacts.

### Phase 4 — Baseline + promotion readiness
- Capture initial baseline debt snapshot.
- Measure false-positive rate, runtime budgets, and determinism stability.
- Gate any move to blocking mode on explicit promotion criteria.

## Checkpoints Go/No-Go

- **CP0:** Ownership map approved and contract scope fixed.
- **CP1:** Schema/rule IDs deterministic and baseline-state semantics validated.
- **CP1a:** Default-branch baseline seed created and pointer metadata validated.
- **CP2:** Advisory CI run produces stable artifacts on unchanged inputs.
- **CP2a:** Health CI run is wired and fails correctly on evaluator/runtime/integrity faults.
- **CP3:** Baseline-vs-new contradiction reporting is accurate and actionable.
- **CP4:** Promotion criteria documented with measurable thresholds.

## Verification Plan

All completion claims must be backed by fresh command evidence on current HEAD.

### Verification gates
1. **V1 Claim mapping:** each claim maps to an explicit verification command.
2. **V2 Drift evidence:** fresh advisory drift run proves baseline-vs-new behavior.
3. **V3 Repo checks:** `pnpm check`; if runtime behavior changed, include `pnpm run test:deep`.
4. **V4 Claim proof:** outputs explicitly prove the claim (no stale evidence).

### Evidence requirements
- Claim id/text, timestamp (UTC), head SHA, cwd, exact command, exit code.
- Output/artifact paths and checksums for machine-verifiable replay.
- Freshness rule: invalidate evidence after relevant edits/new commits.

## Troubleshooting

1. **High false-positive rate in advisory mode**
   - Mitigation: narrow to highest-value rules, add explicit exclusions, rerun baseline.
2. **Nondeterministic outputs on unchanged input**
   - Mitigation: enforce stable sort order, eliminate non-deterministic timestamps in core findings.
3. **Baseline/new contradictions misclassified**
   - Mitigation: validate baseline integrity + schema version + explicit diff algorithm tests.

## SpecFlow Analysis (Coverage + Edge Cases)

Because automated `spec-flow-analyzer` execution failed due model quota, this section captures the manual coverage pass required for planning quality.

### Core flows
1. Maintainer changes one canonical source and derived outputs stay aligned or report precise drift.
2. Contributor changes non-canonical surface directly; gate flags contradiction with remediation pointer.
3. CI run on unchanged inputs yields stable, repeatable advisory output.

### Edge cases
- Intentional aliases (e.g., command aliasing) must not be falsely flagged as contradiction.
- Pre-existing drift debt should be identified as baseline, not mixed with newly introduced drift.
- Missing optional files/directories should produce clear “not applicable” vs error outcomes.
- Multi-file partial edits should yield coherent rule-level diagnostics, not cascading noise.

### Acceptance-criteria refinements from SpecFlow pass
- Include baseline-vs-new contradiction separation.
- Include deterministic output stability requirement.
- Include explicit alias/intentional duplication handling policy.

## Open Questions

None for this revision. Previously open items were resolved as:
- Report surfacing default: consolidated artifact + short inline summary in check output.
- Promotion threshold default: false-positive rate <= 5%, deterministic unchanged-input output = 100%, and runtime SLO compliance for 2 consecutive weeks.
- Missing optional artifact semantics: keep top-level `status` as `success|partial|blocked`; represent optional-missing as `rule_result=not_applicable`.
- Baseline artifact naming canonical: `consistency-baseline-latest.json` + `consistency-baseline-history/<timestamp>.json` (default-branch producer/consumer contract).
- Baseline pointer mutation policy: PR-time pointer edits are ignored for PR baseline resolution; only base/default-branch pointer metadata is authoritative for that run.
- Dependency default: command-metadata-registry plan is a prerequisite for canonical command-surface parity.

## Sources & References

- **Origin brainstorm:** [docs/brainstorms/2026-03-05-consistency-contract-drift-gate-brainstorm.md](../brainstorms/2026-03-05-consistency-contract-drift-gate-brainstorm.md)  
  Carried-forward decisions: MVP-only scope, zero-contradiction success target, advisory-first enforcement, truth-engine focus.
- Existing stale-doc quality signal: `docs/QUALITY_SCORE.md`
- Command dispatch/help surface: `src/cli.ts`
- Plan pattern references:
  - `docs/plans/2026-03-05-feat-command-metadata-registry-core-parity-plan.md`
  - `docs/plans/2026-02-27-feat-roadmap-cli-gap-closure-plan.md`
- Todo lifecycle examples with filename/status mismatch: `todos/*-ready-*.md`
- Node process and CLI parsing references:
  - [Node.js process docs](https://github.com/nodejs/node/blob/main/doc/api/process.md)
  - [Node.js util.parseArgs docs](https://github.com/nodejs/node/blob/main/doc/api/util.md)
- Vitest mocking/cleanup references:
  - [Vitest module mocking guide](https://github.com/vitest-dev/vitest/blob/main/docs/guide/mocking/modules.md)
  - [Vitest hooks (onTestFinished)](https://github.com/vitest-dev/vitest/blob/main/docs/api/hooks.md)
- CLI UX reference:
  - [clig.dev](https://clig.dev/)
- GitHub required-status-check guidance:
  - [GitHub rules troubleshooting: required status checks](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/troubleshooting-rules#required-status-checks)
