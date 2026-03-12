---
title: "refactor: Close loop parity governance gaps"
type: refactor
status: active
date: 2026-03-04
plan_id: refactor-loop-parity-governance-gaps
origin: docs/brainstorms/2026-02-28-code-factory-loop-parity-brainstorm.md
deepened_on: 2026-03-04
deepened_mode: power-enhancement
---

# ♻️ refactor: Close loop parity governance gaps

## Table of Contents
- [Enhancement Summary](#enhancement-summary)
- [Section Manifest](#section-manifest)
- [Overview](#overview)
- [Decisions & Non-goals](#decisions--non-goals)
- [Problem Statement / Motivation](#problem-statement--motivation)
- [Research Summary](#research-summary)
- [Context7 Documentation Additions](#context7-documentation-additions)
- [Proposed Solution](#proposed-solution)
- [SpecFlow Analysis (Manual Fallback)](#specflow-analysis-manual-fallback)
- [Technical Considerations](#technical-considerations)
- [System-Wide Impact](#system-wide-impact)
- [Implementation Phases](#implementation-phases)
- [Acceptance Criteria](#acceptance-criteria)
- [Success Metrics](#success-metrics)
- [Performance Budgets & Guardrails](#performance-budgets--guardrails)
- [Dependencies & Risks](#dependencies--risks)
- [Deployment Go/No-Go, Rollback & Monitoring](#deployment-gono-go-rollback--monitoring)
- [Evidence Contract](#evidence-contract)
- [AI-Era Delivery Notes](#ai-era-delivery-notes)
- [Validation Plan](#validation-plan)
- [Sources & References](#sources--references)

## Enhancement Summary
**Deepened on:** 2026-03-04  
**Plan file:** `/Users/jamiecraik/dev/coding-harness/docs/plans/2026-03-04-refactor-loop-parity-governance-gaps-plan.md`  
**Research modes used:** local repo research, Context7 docs retrieval, targeted web/doc verification, arXiv via `rsearch`, parallel skill-driven and review-driven subagents.

### Key Improvements Added
1. Added explicit decision gate + non-goals to prevent scope drift.
2. Added governance parity controls (single source-of-truth direction, check-name stability, merge-group parity).
3. Added performance SLOs, deployment go/no-go gates, rollback triggers, and post-deploy monitoring.
4. Added stronger evidence contract (timestamp, SHA, exit code, artifact paths, parity proof requirements).
5. Expanded benchmark engineering guidance (freshness cadence, decontamination labeling, reproducibility envelope).

### New Considerations Discovered
- Specialized non-default subagent roles intermittently fail in this environment with model parameter incompatibility; this deepening used default-role parallel subagents as fallback.
- Required check identity drift (name-level coupling) is a major hidden risk and now treated as a first-class planning concern.
- `scripts/codex-preflight.sh` portability risk includes both `BASH_SOURCE` and Bash-specific shell features when sourced from zsh.

## Section Manifest
1. **Governance defaults and review independence** — enforce-by-default strategy, migration safety, exception protocol.
2. **Security scan parity** — scanner baseline decision, policy alignment across workflow/docs/templates, permission model.
3. **Workflow tooling hygiene** — `grep`→`rg` semantic parity and shell declaration consistency.
4. **Shell portability** — zsh sourcing + bash execution compatibility with fail-fast guarantees.
5. **Benchmark evidence** — freshness, decontamination, reproducibility, artifact schema, and reporting.

## Overview
Close remaining governance and evidence gaps so the harness loop stays deterministic and auditable across Codex + Claude clients (see brainstorm: `docs/brainstorms/2026-02-28-code-factory-loop-parity-brainstorm.md`).

Scope in this plan:
1. Set reviewer-independence enforcement default to `true` in generated contract/scaffold while preserving hard-fail review-gate behavior.
2. Reconcile `security-scan` docs vs workflow implementation (either implement Trivy/Semgrep in workflow or adjust docs to exact enforced checks).
3. Replace policy-inconsistent `grep` usage with `rg` where feasible in automation/workflow scripts.
4. Make `/Users/jamiecraik/dev/coding-harness/scripts/codex-preflight.sh` safe when sourced from zsh.
5. Add benchmark track (SWE-bench Live / SWE-rebench style freshness + decontamination) to support harness claims with repeatable evidence.

## Decisions & Non-goals
### Decision gate (blocking before implementation)
- **Decision D1:** Security baseline path for `security-scan` must be chosen once before Phase 1 execution.
  - **Option A (recommended):** implement Trivy + Semgrep in workflow to match current policy/docs expectations.
  - **Option B:** narrow docs/contracts to secrets-only baseline while keeping check identity stable for branch protection.
  - **Owner:** `jamiecraik`
  - **Decision deadline:** before first implementation PR merge.
  - **Identity rule:** required check name remains `security-scan` for this refactor; only internal scanner composition may change.
  - **Decision locked:** ✅ 2026-03-04, **Option A selected** (workflow now enforces `gitleaks + trivy + semgrep`).

### Non-goals (kept from brainstorm intent)
- No product UI expansion (voice/dictation/diff UX remains out of scope).
- No speculative platform-specific rewrites beyond parity-required adapters.
- No benchmark leaderboard optimization work without reproducibility/decontamination controls first.

## Problem Statement / Motivation
The selected parity approach is a shared deterministic loop with thin client adapters (see brainstorm: `docs/brainstorms/2026-02-28-code-factory-loop-parity-brainstorm.md`). Current repo state still has governance drifts that reduce trust:

- Reviewer independence is implemented but default-disabled.
- Security scan docs assert scanner coverage not reflected in active workflow.
- Workflow scripts still include `grep` despite repo command policy preferring `rg`.
- Preflight helper assumes Bash internals (`BASH_SOURCE`) and is brittle when sourced from zsh.
- Benchmark proof for harness engineering claims is not yet formalized as a reproducible track.

## Research Summary
### Local repository findings
- Reviewer independence default is off in root contract:
  - `/Users/jamiecraik/dev/coding-harness/harness.contract.json:13`
- Review-gate enforces reviewer independence when contract flag is enabled:
  - `/Users/jamiecraik/dev/coding-harness/src/commands/review-gate.ts:338-347`
- Init scaffold still writes `enforceReviewerIndependence: false`:
  - `/Users/jamiecraik/dev/coding-harness/src/commands/init.ts:533`
- Docs claim `security-scan` is `gitleaks + trivy + semgrep`:
  - `/Users/jamiecraik/dev/coding-harness/CONTRIBUTING.md:85`
- Actual workflow runs gitleaks + trufflehog today:
  - `/Users/jamiecraik/dev/coding-harness/.github/workflows/secret-scan.yml:25-40`
- `grep` usage still appears in CI workflows:
  - `/Users/jamiecraik/dev/coding-harness/.github/workflows/branch-cleanup.yml:41`
  - `/Users/jamiecraik/dev/coding-harness/.github/workflows/auto-release-npm.yml:137`
  - `/Users/jamiecraik/dev/coding-harness/.github/workflows/release-private-npm.yml:97`
- zsh-sourcing risk in preflight helper:
  - `/Users/jamiecraik/dev/coding-harness/scripts/codex-preflight.sh:30`
  - `/Users/jamiecraik/dev/coding-harness/scripts/codex-preflight.sh:119`

### Institutional learnings lookup
- No `docs/solutions/` directory exists in this repository at plan time.

### External research decision
External research was included because this scope touches:
- security/governance check integrity,
- and benchmark-claim validity/decontamination methodology.

## Context7 Documentation Additions
These additions are anchored to current GitHub Actions, Semgrep, and Trivy documentation retrieved via Context7.

### GitHub Actions governance hardening additions
- Add a workflow/job permissions matrix and enforce least-privilege `permissions` per job, not just workflow-wide defaults.
- Add explicit shell defaults (`defaults.run.shell: bash`) for jobs that rely on Bash regex/pipefail semantics, instead of relying on unspecified runner shell behavior.
- Keep action pinning to full commit SHAs as a required invariant for all security-sensitive workflows.

### Scanner implementation additions (if Option A is selected)
- **Semgrep:** implement `semgrep ci` in GitHub Actions with required permissions for SARIF upload (`security-events: write`, plus repo-read permissions as needed) and upload SARIF for code scanning visibility.
- **Trivy:** use filesystem scanning for the repository path with explicit scanner coverage (`vuln,misconfig,secret`) and explicit severity policy (`HIGH,CRITICAL` or agreed baseline).
- Normalize scanner result publication format (SARIF where feasible) so branch-protection and review-gate evidence are traceable in a single surface.

### Shell portability additions
- For workflow `run` steps that are regex-sensitive or use strict mode, explicitly set `shell: bash` (or job-level `defaults.run.shell: bash`) to avoid implicit fallback to `sh`.
- For `scripts/codex-preflight.sh`, replace direct Bash-only self-path assumptions with a shell-aware resolver (Bash + zsh-safe) and preserve executable-mode behavior.
- Add shell portability linting/checks (for example `shellcheck` plus zsh source test) in validation so regressions are caught before merge.

## Proposed Solution
Adopt a five-workstream plan aligned to parity decisions from the origin brainstorm:

1. **Governance default alignment (P0)**
   - Switch default reviewer independence to `true` in scaffold + contract defaults.
   - Keep review-gate hard fail on independence violations (no relaxation).

2. **Security-scan parity (P0)**
   - Pick one explicit baseline and enforce it consistently:
     - **Option A (preferred):** update workflow to include Trivy + Semgrep (keep Gitleaks; evaluate TruffleHog role separately), or
     - **Option B:** update docs/contracts to state exactly what workflow enforces now.
   - **Security-scan design (deepened target for Option A):**
    1. **Canonical policy schema fields (`securityScanPolicy`)**
       - `schemaVersion`, `policyId`, `requiredCheckName` (`security-scan`), `mode` (`report-only|enforce`), `events` (`pull_request|merge_group|push`).
       - `scanners[]` with: `id`, `category` (`secret|sast|dependency|misconfig`), `enabled`, `command`, `timeoutMinutes`, `severityThreshold`, `sarifPath`, `sarifCategory`, `permissionsProfile`.
       - `aggregation` with: `jobId` (`security-scan`), `needs`, `passRule`, `artifactManifestPath`.
       - `failPolicy` with: `onFinding`, `onInfraError`, `forkSarifUploadMode`.
       - `parityTargets` with exact file list that must stay aligned (workflow, `README.md`, `CONTRIBUTING.md`, init output text, branch-protect defaults).
    2. **Workflow job topology and stable check identity**
       - Fan-out jobs: `gitleaks`, `semgrep`, `trivy` (and optional `trufflehog` if retained), each emits `status/<scanner>.json`.
       - Fan-in aggregator job id + displayed check name are both `security-scan`; branch protection requires only this check identity.
       - Aggregator runs with `if: always()`, reads all per-scanner status files, and decides final pass/fail deterministically.
       - Required check parity must be identical on `pull_request` and `merge_group`.
    3. **Exact permission model by job type**
       - Workflow default: `permissions: { contents: read }`.
       - `gitleaks`/`trufflehog` scanner jobs: `contents: read` only.
       - `semgrep` and `trivy` jobs with SARIF upload: `contents: read`, `security-events: write`.
       - Aggregator job (`security-scan`): `contents: read` only.
       - No `pull-requests: write`, no broad `write-all`, and no extra scopes unless a scanner explicitly requires them.
    4. **SARIF publishing and categorization rules**
       - One SARIF file per scanner (no merged SARIF), artifact path: `artifacts/sarif/<scanner>.sarif`.
       - Fixed category naming: `security-scan/<scanner>` (for example `security-scan/semgrep`, `security-scan/trivy`).
       - Severity normalization for gate logic: `CRITICAL|HIGH => fail`, `MEDIUM => warn`, `LOW|INFO => note`.
       - Fork PR rule: if `security-events: write` is unavailable, retain SARIF as workflow artifact and mark upload as `skipped_fork_token`, not infra-fail.
    5. **Fail policy (findings vs infrastructure errors)**
       - `finding`: scanner completed and reported findings at/above threshold; aggregator fails in `enforce`, records blocker in `report-only`.
       - `infra_error`: scanner crash, timeout, action runtime failure, corrupted output, or missing required status artifact; aggregator always fails.
       - Final aggregator rule: fail if any `infra_error`; else apply finding policy by mode; pass only when all scanners are `clean` or below threshold.
    6. **Parity validation commands (must be green before merge)**
       - `pnpm check`
       - `pnpm run test:deep`
       - `pnpm exec tsx /Users/jamiecraik/dev/coding-harness/src/cli.ts branch-protect --owner <owner> --repo <repo> --dry-run --json`
       - `pnpm exec tsx /Users/jamiecraik/dev/coding-harness/src/cli.ts verify-greptile --owner <owner> --repo <repo> --json`
       - `rg -n "security-scan|gitleaks|semgrep|trivy|security-events|permissions:" /Users/jamiecraik/dev/coding-harness/.github/workflows/secret-scan.yml /Users/jamiecraik/dev/coding-harness/README.md /Users/jamiecraik/dev/coding-harness/CONTRIBUTING.md /Users/jamiecraik/dev/coding-harness/src/commands/init.ts`
       - `pnpm exec actionlint`
   - Decision must be made once and reflected in docs, templates, checks, and branch-protection required-check snapshots.

3. **Tooling policy hygiene (P1)**
   - Replace feasible `grep` invocations in workflows with equivalent `rg` usage.
   - Add targeted tests/CI checks only where replacement changes behavior.

4. **Preflight shell portability (P1)**
   - Remove reliance on Bash-only runtime assumptions when script is sourced from zsh.
   - Preserve fail-fast behavior and path validation guarantees.

5. **Benchmark evidence track (P2)**
   - Define repeatable benchmark protocol with freshness/decontamination controls inspired by SWE-bench Live and SWE-rebench.
   - Add benchmark runbook + artifact schema so claims are auditable over time.

6. **Required-check model split + invariant (P0)**
   - Define two explicit check sets:
     - `reviewGate.requiredChecks` (runtime verification subset),
     - `branchProtection.requiredChecks` (full repository required checks).
   - Enforce invariant: `reviewGate.requiredChecks` must always be a subset of `branchProtection.requiredChecks`.
   - Keep stable shared identity for security aggregation: `security-scan`.

### Research Insights
**Best Practices**
- Prefer one canonical policy source for scanner/check definitions, then generate docs/template guidance from it to eliminate drift.
- Keep required check identity stable (`security-scan`) even if internals fan out into multiple scanner jobs.
- Enforce least-privilege GitHub Action permissions and immutable SHA pinning for third-party actions.

**Performance Considerations**
- Security scanner expansion needs explicit CI budgets (`p95`, `p99`, cache-hit targets, flake-rate guardrails) before enforcement hardening.
- Roll out scanner changes in report-only shadow mode first, then enforce once false-positive/runtime thresholds are stable.

**Implementation Details**
```yaml
# Example pattern: stable required check identity with fan-out jobs
jobs:
  gitleaks: { ... }
  semgrep:  { ... }
  trivy:    { ... }
  security-scan:
    needs: [gitleaks, semgrep, trivy]
    runs-on: ubuntu-latest
    steps:
      - run: echo "Aggregate status for required check identity"
```

**Edge Cases**
- Single-maintainer repositories may require an explicit, auditable reviewer-independence exception path with expiry.
- Duplicate check-runs with identical names require deterministic `review-gate` selection rules.
- Merge-queue (`merge_group`) event coverage must match required-check policy to avoid silent bypass.

## SpecFlow Analysis (Manual Fallback)
`spec-flow-analyzer` agent invocation failed in this environment (model parameter incompatibility), so analysis was completed manually.

### User-flow gaps identified
1. Missing migration guidance for repos generated with old `enforceReviewerIndependence=false` defaults.
2. No single source of truth describing `security-scan` composition and precedence when docs/workflows disagree.
3. No explicit acceptance gate that checks workflow command policy conformance (`grep` vs `rg`).
4. No benchmark publication contract (inputs, environment hash, decontamination report, result schema).

### Edge cases
1. Reviewer-independence checks on single-maintainer repos where independent reviewer is impossible.
2. Security scanner runtime/cost explosion on merge queues if Trivy/Semgrep are added without tuned scope.
3. `rg` replacement differences in regex dialect/exit behavior vs `grep -E` in release scripts.
4. zsh sourcing where `${BASH_SOURCE[0]}` is unset and script exits before preflight logic runs.
5. Benchmark drift from changing benchmark task sets and model versions over time.

### Acceptance criteria additions from analysis
- Contract scaffold change must include backward-compatible migration note.
- `security-scan` definition must match workflow implementation exactly in docs and generated templates.
- Replacement of `grep` must preserve existing pass/fail semantics in release workflows.
- Preflight helper must work in both bash execution and zsh sourcing contexts.
- Benchmark outputs must include decontamination evidence and reproducibility metadata.

### Cross-layer test scenario additions
1. `init` scaffold → generated contract → `review-gate` enforcement path validates independence default behavior end-to-end.
2. Workflow status naming (`security-scan`) → branch protection required checks → `review-gate` blocker resolution path.
3. Release workflow version-extraction logic after `grep`→`rg` replacement with malformed release text.
4. zsh sourced preflight called from docs instructions with missing binaries and missing paths.
5. Benchmark pipeline run producing machine-readable artifact bundle consumed by docs/report automation.

## Technical Considerations
- **Architecture impacts:** These changes affect contract defaults, CI behavior, and governance docs; they must remain adapter-neutral (Codex + Claude parity).
- **Performance implications:** Additional scanners or benchmark jobs may increase CI duration and cost; bounded scope and staged rollout required.
- **Security implications:** Misaligned scan docs can produce false confidence; enforced scanner policy must be explicit and testable.
- **Compatibility:** Existing repos using prior scaffold defaults need migration guidance and non-breaking upgrade path.

## System-Wide Impact
- **Interaction graph:** `harness.contract.json` + scaffold defaults → `loadContract`/defaults → `review-gate` enforcement; workflow `security-scan` result names feed merge gates and review-gate blockers.
- **Error propagation:** Contract mismatch or missing checks surfaces as review-gate blockers; workflow command regressions surface as failed release jobs.
- **State lifecycle risks:** Benchmark artifacts without fixed schema can produce incomparable historical claims; must version schema and capture env metadata.
- **API surface parity:** CLI init templates, runtime commands, docs, and workflows must all expose the same governance truth.
- **Integration test scenarios:** see SpecFlow section (five scenarios).

## Implementation Phases
### Checkpoints (Go/No-Go)
| Checkpoint | Gate | Exit condition |
|---|---|---|
| CP0 | Security baseline decision locked | Option A or B chosen, owner/date recorded, no mixed mode |
| CP1 | Reviewer default parity | contract + scaffold + runtime defaults aligned to intended value |
| CP2 | Security-scan + required-check parity | workflow/docs/template/check names aligned; review-gate set is subset of branch-protection set |
| CP3 | Tooling/runtime parity | `grep`→`rg` equivalence tests pass; preflight works in bash + zsh |
| CP4 | Benchmark contract readiness (non-blocking for governance merge) | schema + runner + metadata envelope present and validated |
| CP5 | Final governance validation | CP0–CP3 pass and evidence packet complete |

### Phase 0 — Preconditions & Decision Lock (new, blocking)
- [x] Run preflight before edits:
  - `zsh -lc 'bash -lc "source /Users/jamiecraik/dev/coding-harness/scripts/codex-preflight.sh && preflight_repo /Users/jamiecraik/dev/coding-harness"'`
- [x] Lock **Decision D1** (Option A vs B) with owner/date and record in PR description + plan update.
- [ ] Capture current branch-protection/ruleset required checks snapshot for drift comparison. *(Blocked locally: requires repository token + live API query against branch rulesets.)*

### Phase 1 — P0 Governance Parity (blocking)
- [x] Update defaults and scaffold behavior in:
  - `/Users/jamiecraik/dev/coding-harness/harness.contract.json`
  - `/Users/jamiecraik/dev/coding-harness/src/commands/init.ts`
  - `/Users/jamiecraik/dev/coding-harness/src/lib/contract/types.ts`
- [x] Ensure review-gate tests assert enforcement path remains hard-fail:
  - `/Users/jamiecraik/dev/coding-harness/src/commands/review-gate.test.ts`
- [x] Add migration semantics for legacy repos (explicit value preserved, missing field gets new default) and document behavior.
- [x] Reconcile and freeze `security-scan` baseline across:
  - `/Users/jamiecraik/dev/coding-harness/.github/workflows/secret-scan.yml`
  - `/Users/jamiecraik/dev/coding-harness/README.md`
  - `/Users/jamiecraik/dev/coding-harness/CONTRIBUTING.md`
  - `/Users/jamiecraik/dev/coding-harness/src/commands/init.ts` (generated docs text)
- [ ] Add scanner-claims inventory task across docs/templates and fail parity checks if any file diverges from locked baseline.
- [ ] Create one canonical required-check + scanner policy source (manifest/module) and have workflow/docs/init/workflow/branch-protect consume it. *(Partial: required-check canonical source added; scanner composition source still pending.)*
- [x] Define and enforce explicit required-check split model:
  - `reviewGate.requiredChecks` (runtime subset),
  - `branchProtection.requiredChecks` (full required set),
  - subset invariant test.
- [x] Add/verify least-privilege workflow permissions for each security-related job and document rationale inline in workflow YAML comments.
- [x] If Semgrep SARIF upload is enabled, include required permissions for SARIF publication and validate branch-protection compatibility with `security-scan`. *(N/A in this implementation: SARIF upload not enabled.)*
- [x] Add deterministic rule for duplicate check-run names used by `review-gate` evaluation.
- [ ] Add explicit solo-maintainer exception model design:
  - contract shape,
  - validator constraints,
  - review-gate enforcement,
  - audited expiry behavior.

### Phase 2 — P1 Tooling/Runtime Hygiene
- [x] Replace workflow `grep` with `rg` where equivalent and safe:
  - `/Users/jamiecraik/dev/coding-harness/.github/workflows/branch-cleanup.yml`
  - `/Users/jamiecraik/dev/coding-harness/.github/workflows/auto-release-npm.yml`
  - `/Users/jamiecraik/dev/coding-harness/.github/workflows/release-private-npm.yml`
- [x] Add CI runner availability guard for `rg` in workflows (explicit install step or documented fallback policy where replacement is unsafe).
- [ ] Add fixture-based equivalence tests for version parsing + branch filtering before and after replacement.
- [x] Make preflight helper shell-safe for zsh sourcing while preserving bash execution:
  - `/Users/jamiecraik/dev/coding-harness/scripts/codex-preflight.sh`
- [ ] Normalize shell declaration for regex/strict-mode workflow steps via `shell: bash` or `defaults.run.shell: bash` where Bash semantics are required.
- [x] Add command-policy drift guard (no new `grep` in targeted workflows/scripts unless explicitly allowed).

### Phase 3 — P2 Benchmark Evidence Track
- [x] Add benchmark protocol and runbook doc:
  - `/Users/jamiecraik/dev/coding-harness/docs/benchmarks/README.md` (new)
- [x] Add benchmark artifact schema:
  - `/Users/jamiecraik/dev/coding-harness/docs/benchmarks/schema/benchmark-run.schema.json` (new)
- [x] Add benchmark execution helper definition:
  - `/Users/jamiecraik/dev/coding-harness/scripts/benchmarks/run-swe-track.sh` (new)
- [x] Add cadence/reporting policy linking benchmark freshness + contamination checks:
  - `/Users/jamiecraik/dev/coding-harness/docs/agents/08-release-and-change-control.md`
- [ ] Include dual-track methodology (static comparability + live freshness), contamination labeling, and multi-run statistics policy.

### Phase 4 — Validation, Handoff, and Readiness
- [x] Run full required validation suite + targeted parity checks (see Validation Plan).
- [x] Produce execution evidence packet (commands, exit codes, artifacts, SHA, timestamps).
- [ ] Confirm merge-readiness conditions:
  - required checks aligned,
  - review artifacts present,
  - rollback path documented,
  - monitoring plan attached.

#### Execution evidence snapshot (2026-03-04)
- ✅ `pnpm check`
- ✅ `pnpm run test:deep`
- ✅ `pnpm build`
- ✅ `pnpm exec actionlint .github/workflows/secret-scan.yml .github/workflows/branch-cleanup.yml .github/workflows/auto-release-npm.yml .github/workflows/release-private-npm.yml`
- ⚠️ `pnpm exec actionlint` (global) fails on pre-existing shellcheck findings in unrelated workflows:
  - `.github/workflows/diagram-refresh.yml`
  - `.github/workflows/gardener.yml`
  - `.github/workflows/preview-release.yml`
- ✅ `zsh -lc 'source scripts/codex-preflight.sh && preflight_repo'`
- ✅ `bash scripts/codex-preflight.sh`

## Acceptance Criteria
- [x] `enforceReviewerIndependence` default is `true` in root contract + scaffold defaults.
- [x] `review-gate` fails when independence requirement is violated and policy is enabled.
- [x] Migration behavior is deterministic:
  - explicit legacy value remains unchanged,
  - missing value gets new default.
- [x] `security-scan` docs, generated guidance, and GitHub workflow all describe/enforce the same scanner set.
- [ ] A single canonical policy source defines required checks + scanner composition and is consumed by docs/init/workflow/branch-protect.
- [x] Required-check model is split and validated: `reviewGate.requiredChecks` is a subset of `branchProtection.requiredChecks`.
- [x] Required-check definitions are synchronized across contract, init output, branch-protect defaults, docs, and workflow check names.
- [x] Required check identity remains stable as `security-scan` throughout this refactor.
- [x] Merge-gating behavior is equivalent on `pull_request` and `merge_group` for required checks.
- [ ] `security-scan` behavior differentiates scanner findings vs scanner infrastructure failure with documented fail policy.
- [x] Security workflow jobs declare explicit least-privilege permissions aligned to their actual write/read needs.
- [x] Third-party GitHub Actions in touched workflows are pinned to full commit SHAs.
- [ ] Workflow `grep` replacements with `rg` preserve behavior and exit semantics in tested paths.
- [x] `scripts/codex-preflight.sh` works when executed in bash and when sourced from zsh in documented usage.
- [ ] Solo-maintainer policy decision is explicit (allowed or disallowed) and documented.
- [ ] If allowed, solo-maintainer override is implemented end-to-end (contract + validator + review-gate enforcement + tests), auditable, and expiry-bound.
- [x] Benchmark track exists with reproducible protocol, decontamination/freshness metadata, and machine-readable artifacts.
- [ ] Benchmark artifacts include schema version, run ID, dataset snapshot hash, contamination policy version, model/version, timestamp, and integrity hashes.

## Success Metrics
- Governance drift count = **0** across contract/scaffold/docs/workflow/ruleset parity checks.
- `review-gate` independence violations are caught before merge with false-positive rate below agreed threshold.
- Security scan composition is unambiguous and machine-verifiable (parity check passes on each run).
- Benchmark claims are reproducible (artifact schema validation pass rate = 100% for published runs).
- Required security/workflow checks remain stable with no branch-protection deadlocks post rollout.

## Performance Budgets & Guardrails
| Area | Budget target | Guardrail |
|---|---|---|
| `security-scan` runtime | p95 ≤ 12 min, p99 ≤ 15 min | parallel scanner jobs + per-job `timeout-minutes` |
| Required-check wall-time delta | ≤ +20% vs 14-day baseline | shadow phase, then enforce |
| Scanner flake rate | < 2% weekly | retry only transient network-class failures |
| Preflight runtime | `preflight_repo` p95 ≤ 2s | micro-benchmark check in bash + zsh |
| Benchmark PR smoke | ≤ 10 min | full benchmark runs scheduled, not PR-blocking by default |
| Benchmark scheduled run | ≤ 120 min | artifact size caps + retention policy |

### Research Insights
- Add workflow `concurrency` with `cancel-in-progress: true` to avoid duplicate compute on same ref.
- Track cache-hit metrics for scanner dependencies (e.g., Trivy DB) to reduce runtime variance.

## Dependencies & Risks
### Dependencies
- GitHub Actions runner compatibility for any added security scanners.
- Maintainer agreement on scanner baseline (keep TruffleHog? add Trivy/Semgrep? both?).
- Stable benchmark task inventory and repeatable environment capture.

### Risks
- **False confidence risk:** docs claim checks that are not actually executed.
- **Split-brain policy risk:** contract/scaffold/workflow/docs drift reappears after partial updates.
- **CI duration risk:** scanner expansion increases queue time.
- **Behavioral regression risk:** `grep`→`rg` swap may change regex behavior if not tested.
- **Check identity risk:** required check names drift from branch-protection expectations.
- **Single-maintainer deadlock risk:** strict reviewer independence blocks valid repos without explicit exception flow.
- **Artifact integrity risk:** benchmark outputs are reproducible but tamper-prone without checksum/provenance policy.
- **Benchmark validity risk:** stale or contaminated tasks overstate harness progress.

### Mitigations
- Add one machine-verifiable parity gate that compares contract/scaffold/docs/workflow/ruleset definitions.
- Pilot scanner changes on PR scope first, then enforce on merge queue.
- Add fixture-based tests for release/version parsing after command replacement.
- Add stable required-check naming policy and deterministic handling of duplicate check runs.
- Add audited break-glass policy for reviewer-independence exceptions (reason, owner, expiry).
- Add benchmark artifact checksum manifest + provenance metadata + retention/access controls.
- Require benchmark run metadata: task snapshot hash, model/version, execution timestamp, contamination policy version.

## Deployment Go/No-Go, Rollback & Monitoring
### Go / No-Go
Ship governance parity changes only if CP0–CP3 and CP5 pass and required checks are aligned with branch protection.  
CP4 benchmark readiness is tracked as a non-blocking follow-up lane.

### Immediate rollback triggers
- Required check names stop matching produced check runs (`security-scan` identity drift).
- `review-gate` false positives spike after default enforcement change.
- Release workflow version parsing regresses after `grep`→`rg`.
- zsh/bash preflight compatibility regresses in documented invocation paths.

### Post-deploy monitoring (first 7 days)
- Required check pass-rate trend (`security-scan`, `review-gate`, `check`).
- Security-scan runtime p95/p99 vs baseline budget.
- Review-gate block reasons distribution (policy vs infra vs evidence).
- Benchmark artifact schema validation + metadata completeness.

## Evidence Contract
For each validation/quality gate, capture:
- exact command,
- execution timestamp,
- git SHA,
- exit code,
- status (`pass|fail|blocked`),
- artifact/log path.

Additional required evidence:
- required-check parity proof across contract/docs/workflow/ruleset,
- reviewer-independence enforcement/exception evidence,
- `grep`→`rg` equivalence fixture results,
- shell compatibility checks (bash execute + zsh source),
- benchmark metadata + artifact integrity hashes.

## AI-Era Delivery Notes
- AI tools used in research/planning: Codex, local `rsearch` CLI.
- Human review is mandatory for governance defaults and scanner policy decisions.
- Any AI-generated workflow/script edits must be validated with targeted command and CI checks before merge.

## Validation Plan
Planned validation commands after implementation (for execution phase):
- `pnpm check`
- `pnpm run test:deep`
- `pnpm build`
- `actionlint` (or equivalent workflow lint wired through project scripts)
- Targeted tests (expected to be added/updated):
  - `pnpm test -- src/commands/review-gate.test.ts src/commands/init.test.ts src/commands/branch-protect.test.ts`
  - `pnpm test -- src/lib/contract/validator.test.ts`
- Parity and policy checks:
  - `rg -n "\\bgrep\\b" /Users/jamiecraik/dev/coding-harness/.github/workflows /Users/jamiecraik/dev/coding-harness/scripts` (targeted scope should be zero after migration)
  - `pnpm test -- src/commands/branch-protect.test.ts src/commands/review-gate.test.ts` (subset invariant + check identity behavior)
  - `pnpm exec tsx /Users/jamiecraik/dev/coding-harness/src/cli.ts branch-protect --owner <owner> --repo <repo> --dry-run --json`
  - `pnpm exec tsx /Users/jamiecraik/dev/coding-harness/src/cli.ts verify-greptile --owner <owner> --repo <repo> --json`
- Shell portability checks:
  - `zsh -lc 'bash -lc "source /Users/jamiecraik/dev/coding-harness/scripts/codex-preflight.sh && preflight_repo"'`
  - `bash /Users/jamiecraik/dev/coding-harness/scripts/codex-preflight.sh`

## Sources & References
### Origin
- **Brainstorm document:** [`docs/brainstorms/2026-02-28-code-factory-loop-parity-brainstorm.md`](../brainstorms/2026-02-28-code-factory-loop-parity-brainstorm.md)
  - Carried-forward decisions: shared deterministic loop core, adapter parity, low-risk-first automation posture, governance+runtime parity as v1 completion criteria.

### Internal references
- `/Users/jamiecraik/dev/coding-harness/harness.contract.json:13`
- `/Users/jamiecraik/dev/coding-harness/src/commands/review-gate.ts:338-347`
- `/Users/jamiecraik/dev/coding-harness/src/commands/init.ts:529-533`
- `/Users/jamiecraik/dev/coding-harness/src/commands/branch-protect.ts:12-24`
- `/Users/jamiecraik/dev/coding-harness/CONTRIBUTING.md:85`
- `/Users/jamiecraik/dev/coding-harness/README.md:54-64`
- `/Users/jamiecraik/dev/coding-harness/.github/workflows/secret-scan.yml:25-40`
- `/Users/jamiecraik/dev/coding-harness/.github/workflows/branch-cleanup.yml:41`
- `/Users/jamiecraik/dev/coding-harness/.github/workflows/auto-release-npm.yml:137`
- `/Users/jamiecraik/dev/coding-harness/.github/workflows/release-private-npm.yml:97`
- `/Users/jamiecraik/dev/coding-harness/scripts/codex-preflight.sh:30,119`

### External references (official docs / benchmark literature)
- GitHub protected branches / required checks: [About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- GitHub Actions hardening (pinning actions): [Security hardening for GitHub Actions](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions)
- GitHub Actions secure use guidance: [Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)
- GitHub Actions workflow syntax (`permissions`, `defaults.run.shell`): [Workflow syntax for GitHub Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
- GitHub Actions pinning to commit SHAs: [Find and customize actions](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/find-and-customize-actions)
- Required status-check troubleshooting: [Troubleshooting required status checks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks)
- Gitleaks Action: [gitleaks/gitleaks-action](https://github.com/gitleaks/gitleaks-action)
- Trivy Action: [aquasecurity/trivy-action](https://github.com/aquasecurity/trivy-action)
- Semgrep CI for GitHub Actions: [Semgrep CI sample config](https://semgrep.dev/docs/semgrep-ci/sample-ci-configs/#github-actions)
- Semgrep SARIF upload permission guidance: [Upload findings in GitHub security dashboard](https://github.com/semgrep/semgrep-docs/blob/main/docs/kb/semgrep-ci/github-upload-findings-in-security-dashboard.md)
- SARIF upload to GitHub code scanning: [Uploading a SARIF file](https://docs.github.com/en/code-security/how-tos/scan-code-for-vulnerabilities/integrate-with-existing-tools/uploading-a-sarif-file-to-github)
- Trivy scanner coverage and SARIF reporting:
  - [Trivy getting started (fs scan)](https://github.com/aquasecurity/trivy/blob/main/docs/getting-started/index.md)
  - [Trivy misconfiguration scanner guide](https://github.com/aquasecurity/trivy/blob/main/docs/guide/scanner/misconfiguration/index.md)
  - [Trivy reporting formats (SARIF)](https://github.com/aquasecurity/trivy/blob/main/docs/guide/configuration/reporting.md)
- Shell portability references:
  - [GNU Bash manual (`BASH_SOURCE`)](https://www.gnu.org/software/bash/manual/bash.html)
  - [zsh prompt expansion (`%x`, `%N`)](https://zsh.sourceforge.io/Doc/Release/Prompt-Expansion.html)
- ripgrep reference: [BurntSushi/ripgrep](https://github.com/BurntSushi/ripgrep)

### Academic references (via `rsearch` CLI)
- SWE-bench (2023): [arXiv:2310.06770](https://arxiv.org/abs/2310.06770)
- SWE-bench Goes Live! (2025): [arXiv:2505.23419](https://arxiv.org/abs/2505.23419)
- SWE-rebench (2025): [arXiv:2505.20411](https://arxiv.org/abs/2505.20411)
- SWE-Gym (2024): [arXiv:2412.21139](https://arxiv.org/abs/2412.21139)
- SWE-agent (2024): [arXiv:2405.15793](https://arxiv.org/abs/2405.15793)
- AutoCodeRover (2024): [arXiv:2404.05427](https://arxiv.org/abs/2404.05427)
- SWE-ABS (2026): [arXiv:2603.00520](https://arxiv.org/abs/2603.00520)
