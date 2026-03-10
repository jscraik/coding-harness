---
title: Docs Gate for Governance Parity
type: feat
status: draft
date: 2026-03-10
origin: docs/brainstorms/2026-03-10-docs-gate-governance-parity-brainstorm.md
risk: medium
spec_depth: full
---

# Docs Gate for Governance Parity

## Table of Contents
- [Enhancement Summary](#enhancement-summary)
- [Problem Statement](#problem-statement)
- [Goals](#goals)
- [Non-Goals](#non-goals)
- [System Boundary](#system-boundary)
- [Core Domain Model](#core-domain-model)
- [Main Flow / Lifecycle](#main-flow--lifecycle)
- [Interfaces and Dependencies](#interfaces-and-dependencies)
- [Invariants / Safety Requirements](#invariants--safety-requirements)
- [Failure Model and Recovery](#failure-model-and-recovery)
- [Observability](#observability)
- [Acceptance and Test Matrix](#acceptance-and-test-matrix)
- [Open Questions](#open-questions)
- [Definition of Done](#definition-of-done)

## Enhancement Summary

**Deepened on:** 2026-03-10  
**Key areas improved:** documentation ownership, change-to-doc mapping, trusted-source precedence, failure posture, CI authority, rollout safety, and downstream scaffolding expectations.

- Defines a dedicated `docs-gate` command that determines whether a code, config, workflow, or governance change requires documentation updates.
- Establishes artifact-based enforcement: the gate validates repository truth and documentation parity, not which authoring skill or agent process produced the edits.
- Expands documentation drift coverage beyond README command parity to include governance-critical surfaces such as `AGENTS.md`, `CONTRIBUTING.md`, selected `docs/agents/*` files, and `init`-generated scaffolding.
- Makes trusted-source precedence explicit so mergeability depends on protected branch truth for contract and workflow policy, not mutable PR-branch copies.
- Makes CI authoritative for mergeability while allowing optional pre-push support for faster local feedback.
- Reuses existing harness patterns where possible: contract-backed policy, command registry integration, required-check wiring, machine-readable reports, and `init` scaffolding.

## Problem Statement

`coding-harness` currently proves that documentation is syntactically valid, but it does not reliably prove that the right documentation changed for a given implementation or governance change.

Current protections are incomplete:

- `docs:lint` verifies Markdown structure, not behavior parity.
- `drift-gate` currently focuses on a narrow set of consistency surfaces, especially CLI versus README command-table parity.
- governance truth is distributed across `harness.contract.json`, CI workflows, generated scaffolding, `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, and `docs/agents/*`.
- recent repo state already demonstrated split-brain drift where enforced CI behavior changed while contributor-facing guidance lagged behind.

This creates operator and contributor risk:

- maintainers can merge technically correct code that leaves instructions stale,
- reviewers cannot tell whether required governance docs were updated,
- downstream repositories initialized by harness may inherit stale or incomplete guidance,
- recommended authoring skills like `docs-expert` and `agents-md` help quality, but they do not give merge-safe guarantees.

The repo therefore needs a deterministic gate that answers:

1. Which documentation surfaces are required for this change?
2. Were those surfaces updated when they should have been?
3. Do those surfaces agree with the current behavior and policy?

## Goals

1. Define a dedicated `docs-gate` command with stable machine-readable output and deterministic exit behavior.
2. Map changed implementation surfaces to required documentation surfaces using explicit repo policy rather than contributor convention.
3. Enforce governance-critical documentation parity for pull requests before merge.
4. Keep CI as the authoritative merge gate while supporting optional local pre-push execution.
5. Reuse existing `drift-gate`, contract, and required-check plumbing where that architecture is already strong.
6. Support downstream repositories scaffolded by `harness init` without requiring online services or agent provenance logs.
7. Encourage use of `docs-expert` and `agents-md` as recommended authoring workflows without making mergeability depend on skill invocation.

## Non-Goals

1. Requiring proof that `docs-expert`, `agents-md`, or any other skill was invoked.
2. Performing broad semantic validation for every Markdown file in the repository.
3. Replacing `drift-gate` or collapsing all consistency checks into one command.
4. Blocking on low-value or cosmetic documentation drift in v1.
5. Turning the gate into a general documentation linter; structural Markdown quality remains the job of `docs:lint`.
6. Solving every downstream documentation shape in one release; v1 should focus on the harness repo and scaffolded defaults.

## System Boundary

### Owns

- `docs-gate` CLI behavior, exit codes, and JSON report schema.
- The policy model that maps changed files or change categories to required documentation surfaces.
- Evaluation of required doc updates for governance-critical surfaces.
- Targeted parity checks between implementation/governance truth and governed docs.
- CI integration for a required `docs-gate` status check.
- `init` scaffolding for downstream repositories that should receive docs-gate wiring by default.
- Local pre-push integration guidance or generated hook support when enabled.

### Does Not Own

- General-purpose authoring quality across every repository document.
- Proof-of-process metadata about which skill, prompt, or agent authored a doc change.
- External documentation platforms or hosted knowledge bases outside the repository.
- General risk analysis that belongs to `preflight-gate`, `risk-policy-gate`, or review policy enforcement.
- Low-level Markdown formatting checks already covered by `docs:lint`.

### Trust Boundaries

- **Trusted policy source:** contract policy loaded from the trusted base branch in CI, not the PR branch when mergeability is being determined.
- **Repo-controlled docs:** documentation files inside the repository may be changed by the PR, but their requiredness is determined by trusted policy and source-of-truth rules.
- **Generated scaffolding:** downstream `init` output is owned by harness templates and must stay aligned with the enforced policy set.
- **Author workflow guidance:** skills such as `docs-expert` and `agents-md` may be recommended, but they are advisory inputs, not trusted merge policy.

## Core Domain Model

### 1) DocsGatePolicy

Contract-backed configuration for docs-gate behavior.

Required concepts:

- `enabled` or implicit presence through the command/check
- `mode` (`advisory|required`) for rollout posture
- `rules[]` or equivalent mapping entries
- source-of-truth ownership per governed surface
- severity for each rule failure
- optional local-hook posture

Normative v1 contract decision:

- v1 introduces a new typed `docsGatePolicy` contract surface in the next minor contract schema version.
- `docsDriftRules` remains a legacy field for `drift-gate` and is explicitly out of scope for `docs-gate` v1 evaluation.
- If `docs-gate` is enabled but `docsGatePolicy` is missing:
  - harness repo required-mode CI treats this as `policy_error`,
  - downstream advisory/bootstrap repos emit `bootstrap_gap`,
  - downstream required-mode repos fail closed with `bootstrap_gap`.

Migration semantics:

- adding `docsGatePolicy` is a backward-compatible contract schema extension,
- `docs-gate` must not infer v1 rules from `docsDriftRules`,
- repos upgraded by `init --update` should receive `docsGatePolicy` defaults and matching workflow/docs wiring in the same change,
- repos on older contract versions remain supported for existing commands, but `docs-gate` cannot claim full enforcement until `docsGatePolicy` is present.

### 2) DocsTruthSource

Explicit record of which artifact is authoritative for a governed statement.

Required fields:

- `sourceId`
- `kind` (`contract|workflow|code|template|documentation`)
- `path`
- `trustLevel` (`protected_base_branch|current_checkout|generated_from_source`)
- optional `extractor`
- optional `normalizer`

Truth-source precedence in v1:

1. protected-base-branch contract and workflow truth in CI
2. generated template truth derived from harness source templates
3. current-checkout code and docs for changed-content evaluation

The command must not treat contributor-edited prose as authoritative when that prose describes a governed policy already represented by trusted contract, workflow, or generated template truth.

Normative truth-resolution algorithm:

1. Capture immutable source identifiers at evaluation start:
   - trusted base ref,
   - trusted contract SHA,
   - trusted workflow SHA,
   - current checkout SHA.
2. Load all required protected truth sources by immutable SHA, never by floating ref names after capture.
3. If a merge-authoritative trigger requires a protected truth source and that source cannot be loaded after bounded retry, emit `trust_mismatch`.
4. If two protected truth sources define the same governed statement and disagree after normalization, emit `trust_mismatch`.
5. If protected truth sources agree and a generated template disagrees, emit `drift_detected`.
6. If protected truth sources agree and contributor-facing documentation disagrees or is missing, emit `drift_detected`.
7. If a statement is defined by only one protected truth source in v1, that source is authoritative and all other surfaces are compared against it.
8. If no protected truth source exists for a statement that is expected to be governed, emit `policy_error` rather than silently treating documentation as authoritative.

### 3) DocsImpactCategory

Normalized category assigned to changed files.

Minimum v1 categories:

- `cli_surface`
- `contract_policy`
- `ci_workflow`
- `branch_protection_or_required_checks`
- `init_scaffolding`
- `agent_governance`
- `doc_only`
- `unknown_governance_change`

Purpose:

- simplify rule evaluation,
- allow multiple changed paths to collapse into one semantic category,
- ensure a consistent mapping model across the harness repo and scaffolded downstream repos.

### 4) DocsSurface

A governed documentation target that may be required for a change.

Minimum v1 governed surfaces:

- `README.md`
- `CONTRIBUTING.md`
- `AGENTS.md`
- `docs/agents/04-validation.md`
- `docs/agents/07b-agent-governance.md`
- `docs/agents/12-greptile-ai-governance.md`
- `docs/agents/13-linear-production-workflow.md`
- generated workflow/setup guidance emitted by `init`

Required fields:

- `path`
- `surfaceType` (`root_doc|governance_doc|generated_template|workflow_doc`)
- `owner` (`implementation|contract|workflow|template`)
- `requiredFor[]` categories
- `sourceOfTruth[]`
- optional parity validator identifier

### 5) DocsParityValidator

Named validator that compares a governed doc surface to one or more truth sources.

Required fields:

- `validatorId`
- `inputs[]`
- `normalizationRules[]`
- `failureMode`
- `supportsDocOnlyRuns`

Minimum v1 validator families:

- registry/help versus README command-table parity
- required-check truth versus contributor-facing governance docs
- `init` scaffold output versus source docs and template fragments
- branch-name or issue-tracking policy wording versus contract defaults

Template comparison rule:

- validators for generated templates must compare normalized rendered output, not raw template source,
- rendering must use fixed fixture inputs for variable substitutions such as package manager commands, hook bodies, and required-check lists,
- fixture inputs must be versioned with the validator tests so template parity remains deterministic across environments.

### 6) DocsRule

Declarative rule linking implementation change classes to required docs behavior.

Required fields:

- `ruleId`
- `when` (file globs and/or normalized categories)
- `requireDocs[]`
- `truthSources[]`
- `parityChecks[]`
- `severity`
- `allowDocOnly` or explicit no-op semantics where appropriate

Examples:

- workflow changes that alter required checks require updates to `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, and relevant `docs/agents/*`.
- command-registry or CLI dispatch changes require README command-table parity and any command reference docs.
- `init` template changes that alter generated guidance require the corresponding source docs and template expectations to stay aligned.

### 7) DocsGateExecutionContext

Runtime context that determines trust and fallback posture.

Required fields:

- `trigger` (`local|pull_request|merge_group|manual_ci`)
- `policyMode` (`advisory|required`)
- `mergeAuthoritative`
- `trustedBaseAvailable`
- `trustedBaseRef`
- `trustedContractSha`
- `trustedWorkflowSha`
- `evaluatedSha`
- `mergeQueueTargetRef` when `trigger=merge_group`
- `mergeQueueBaseSha` when `trigger=merge_group`
- `bootstrapState` (`fully_wired|shadow_only|missing_wiring`)
- `changedFilesSource` (`explicit_flag|git_diff|full_repo_fallback`)
- `outputRoot`

This context controls whether unknown or missing bootstrap conditions produce hard failure, advisory output, or a bootstrap-gap artifact.

### 8) DocsGateFinding

Machine-readable result describing one violated or noteworthy rule.

Required fields:

- `rule_id`
- `category`
- `surface`
- `result` (`pass|fail|not_applicable|error`)
- `severity` (`info|warning|error`)
- `message`
- `path`
- optional `details`
- optional `source_of_truth_ref`

### 9) DocsGateReport

Top-level artifact emitted by `docs-gate`.

Required fields:

- `schemaVersion`
- `command`
- `mode`
- `status`
- `outcome`
- `generated_at`
- `repo_root`
- `base_ref` or trusted contract provenance when applicable
- `execution_context`
- `changed_files[]`
- normalized `categories[]`
- `summary`
- `findings[]`

Recommended status vocabulary:

- `success`
- `partial`
- `blocked`

Recommended outcome vocabulary:

- `ok`
- `drift_detected`
- `policy_error`
- `runtime_error`
- `bootstrap_gap`
- `trust_mismatch`

Outcome mapping rule:

- `unknown_governance_change` is emitted as a finding category and maps to `drift_detected` when it blocks,
- `bootstrap_gap` is reserved for repos or triggers that lack required docs-gate wiring,
- `trust_mismatch` is reserved for missing or contradictory protected truth sources,
- `outcome` stays coarse while the finding set carries rule-level detail.

Required minimal stub-report schema on non-path-safety failures:

- all top-level report fields remain present,
- `status` must be `blocked` or `partial`,
- `outcome` must reflect the terminal failure class,
- `summary.finding_count` must be at least `1`,
- `findings[0]` must be a sentinel error finding describing why full evaluation could not complete.

## Main Flow / Lifecycle

### A. Invocation and trusted inputs

1. `docs-gate` starts with repo root, changed files input, mode, and optional output path.
2. In CI, trusted policy must come from the protected base branch or merge-queue context, not from the PR branch checkout when deciding mergeability.
3. If changed files are not explicitly provided, the command may derive them from git diff inputs, but the provenance must be captured in the report.
4. All source and output paths must be canonicalized with realpath resolution before use.
5. By default, the command may write artifacts only inside a dedicated allowlisted subtree such as `artifacts/consistency-gate/**`; writing to tracked source paths or arbitrary repo-root targets is forbidden unless an explicit non-default operator override is provided and recorded in `execution_context`.
6. The command must reject symlink escapes and path traversal before read/write and must use race-safe file handling:
   - open files with no-follow semantics or equivalent,
   - write reports through create-temp plus atomic rename inside the same trusted output directory,
   - verify the final opened path remains inside the allowlisted root after open and before rename/commit.

### B. Trusted truth materialization

7. The command loads or derives the active `DocsGateExecutionContext`.
8. In `pull_request` mode, contract and workflow truth must be read from the trusted base branch by immutable SHA when those sources affect merge policy.
9. In `merge_group` mode, governance-critical truth must also be read from an immutable target-branch baseline or equivalent protected snapshot; the merge-queue candidate checkout is not authoritative for policy comparisons.
10. `merge_group` runs must bind trust loading to explicit immutable identifiers captured from the CI event:
    - target ref,
    - target/base SHA,
    - evaluated merge-group SHA.
11. If any merge-queue identifier is missing, inconsistent with the fetched protected truth, or mismatched against `execution_context`, the command must fail with `trust_mismatch`.
12. In local mode, the current checkout is allowed as the working truth source for feedback, but the report must mark that it is not merge-authoritative unless an explicit trusted-base snapshot was supplied.
13. Protected truth retrieval must use bounded retries and timeout rules:
    - up to 2 retries after the initial attempt,
    - hard timeout per source load,
    - fail closed with `trust_mismatch` in merge-authoritative required mode if a required source still cannot be loaded.

### C. Trigger and bootstrap matrix

11. Required behavior by trigger is normative:

| Trigger | Merge authoritative | Required truth source behavior | Missing wiring behavior | Default status/outcome |
| --- | --- | --- | --- | --- |
| `pull_request` | Yes | must load protected base contract + workflow by immutable SHA | `bootstrap_gap` blocks in required mode | `success/ok` or `blocked/*` |
| `merge_group` | Yes | must load immutable target-branch baseline or protected snapshot and record target ref plus base/evaluated SHAs | `bootstrap_gap` blocks in required mode | `success/ok` or `blocked/*` |
| `manual_ci` | Only when explicit trusted base is provided | protected truth required when merge-authoritative | `bootstrap_gap` unless intentionally advisory | `success`, `partial`, or `blocked` |
| `local` | No | protected truth optional unless user explicitly requests it | may remain advisory/partial | `success`, `partial`, or `blocked` |

12. `full_repo_fallback` is allowed only when changed-file metadata is unavailable and must be bounded by:
    - maximum file count,
    - maximum bytes scanned,
    - command timeout.
13. If fallback exceeds any cap, the command must fail closed in required mode and emit `runtime_error`.

### D. Change classification

14. The command normalizes changed paths into one or more `DocsImpactCategory` values.
15. Multiple changed files may map to the same category.
16. The mapping engine should reuse existing glob-matching and path-normalization patterns already used for blast-radius style resolution where practical.
17. File operations must be classified explicitly:
    - `added`,
    - `modified`,
    - `renamed`,
    - `deleted`.
18. Deletion or rename of a governed doc surface must be treated as a blocking event unless the rule set explicitly remaps the surface and all truth references are updated consistently.
19. If a file changes in a governance-sensitive area but no rule matches, the command must emit an explicit `unknown_governance_change` finding rather than silently skipping it.

### E. Required-surface resolution

20. For each normalized category, the command resolves the set of required `DocsSurface` targets.
21. The union of required surfaces becomes the validation scope for the run.
22. `doc_only` changes must not automatically fail if no governed implementation surface changed, but they may still run parity checks if a changed doc is a governed source-of-truth surface.
23. Presence requirements and parity requirements are evaluated separately so the report can distinguish "file not touched" from "file touched but still wrong."

### F. Validation and parity

24. The command checks whether each required surface is present in the diff when presence is required.
25. The command runs targeted parity validators for governed surfaces:
    - CLI/help versus README command table.
    - required-check/workflow truth versus contributor-facing governance docs.
    - `init` scaffolding outputs versus their source documentation and enforced policy defaults.
26. Normalizers must compare semantic payloads, not raw line-level text, for fields such as required-check lists and branch-name policies where formatting may differ.
27. All untrusted path- or content-derived strings must be sanitized before they are emitted into console summaries or report payloads:
    - strip or escape ANSI sequences and other control characters,
    - normalize newlines to a single canonical form,
    - enforce maximum field lengths with deterministic truncation markers,
    - preserve the original raw value only in trusted in-memory processing, never in human-facing output.
28. If a doc changed but now contradicts trusted implementation or policy truth, the gate fails even though the file was touched.
29. If a doc did not change but the rule requires it for the change class, the gate fails with a missing-update finding.

### G. Output and exit behavior

30. The command emits a stable JSON report and a concise human-readable summary.
31. Even on policy or runtime failure, the command should attempt to emit a stub report with explicit failure classification unless path safety would be violated.
32. In `required` mode, any error-severity finding fails the command.
33. In `advisory` mode, findings are reported but do not block unless the command encounters a policy/runtime error severe enough that results are untrustworthy.
34. Output artifacts must be suitable for CI upload and local inspection, including checksum or upload-ready behavior when the surrounding workflow expects durable evidence.
35. Exit codes are normative:

| Exit code | Meaning | Required CI semantics |
| --- | --- | --- |
| `0` | `ok` with no blocking findings | pass |
| `10` | `drift_detected` | fail in required mode; pass with artifact in advisory mode |
| `11` | `bootstrap_gap` | fail in required mode; partial/advisory in bootstrap lanes |
| `12` | `trust_mismatch` | always fail in merge-authoritative required mode |
| `13` | `policy_error` | fail |
| `14` | `runtime_error` | fail |

36. Report-shape compatibility with `drift-gate` is normative:
    - share the same top-level envelope style (`schemaVersion`, `command`, `mode`, `status`, `outcome`, `generated_at`, `repo_root`, `summary`, `findings`),
    - do not use baseline fingerprinting to suppress required-mode failures,
    - allow baseline state only for advisory or shadow-rollout tuning artifacts.

### H. Rollout posture

37. v1 rollout should support a shadow or advisory period before broad required enforcement for downstream repos.
38. The harness repo may adopt required mode earlier because it owns the command and its reference docs.
39. A reasonable default rollout is:
    - Phase 1: advisory artifact lane in the harness repo
    - Phase 2: required `docs-gate` in the harness repo, advisory in downstream `init` scaffolding
    - Phase 3: required downstream mode once scaffold/update coverage is proven
40. Promotion gates are normative:
    - Phase 1 -> Phase 2 requires at least 30 evaluated harness PRs across 7 consecutive days, false-positive rate below 5 percent, no unresolved `trust_mismatch` bug, and maintainer sign-off.
    - Phase 2 -> Phase 3 requires at least 50 evaluated downstream PRs across at least 3 upgraded repos over 14 days, false-positive rate below 3 percent, bootstrap-gap rate below 10 percent, and a verified downgrade path back to advisory mode.
41. Automatic rollback to advisory mode is required if any of the following occur:
    - a verified policy-weakening bypass,
    - 2 or more verified false-positive blocking failures in 24 hours,
    - `blocking_failure_rate > 15 percent` across the most recent 20 merge-authoritative evaluations or over any rolling 24-hour window with at least 10 evaluations.

## Interfaces and Dependencies

### Internal commands

- `src/commands/drift-gate.ts`
- `src/commands/init.ts`
- `src/cli.ts`
- `src/lib/cli/command-registry.ts`

### Internal libraries and policy surfaces

- `src/lib/contract/types.ts`
- `src/lib/contract/validator.ts`
- `src/lib/blast-radius/resolver.ts`
- `src/lib/policy/required-checks.ts`
- existing doc-parity helpers under `src/lib/cli/*`

### Repository truth sources

- `harness.contract.json`
- `.github/workflows/pr-pipeline.yml`
- `README.md`
- `CONTRIBUTING.md`
- `AGENTS.md`
- relevant `docs/agents/*`

### Generated or scaffolded outputs

- files and workflow fragments written by `harness init`
- branch-protection defaults and required-check naming that downstream repos inherit

### External systems

- none required for rule evaluation

`docs-gate` must remain offline-capable so it can run deterministically in CI and local development without API calls or agent-runtime telemetry.

### Cross-cutting contract interaction

- `reviewPolicy.requiredChecks` must remain a subset of `branchProtection.requiredChecks`.
- `docs-gate` documentation claims about required checks must never describe a check set that the trusted contract marks impossible or incomplete.
- `init`-generated docs, workflows, and hook templates must be treated as a coordinated output surface, not as unrelated files.

## Invariants / Safety Requirements

1. Mergeability must be based on trusted policy, not policy content modified only within the PR branch.
2. Governance-sensitive changed files must never be silently ignored; unmatched governance changes must emit an explicit finding.
3. The gate must enforce repository truth, not authoring provenance.
4. `docs-gate` and `drift-gate` must not contradict one another on the same governed parity rule; shared validators should be reused or clearly partitioned.
5. A documentation update only counts if the resulting content is aligned; touching a file without restoring parity must still fail.
6. CI remains the authoritative required check even if local hooks are disabled or bypassed.
7. The gate must be deterministic for the same repo state, base policy, and changed-file set.
8. Path inputs and artifact writes must remain inside approved repository read locations and the dedicated allowlisted artifact output root.
9. Missing required docs must be surfaced as explicit findings, not inferred only from a nonzero exit code.
10. Unknown or unsupported governance-impact changes must fail closed in required mode.
11. Suggested skills (`docs-expert`, `agents-md`) may appear in documentation or help output, but their invocation must never be a merge invariant.
12. Base-branch contract/workflow truth must take precedence over PR-branch prose when the two disagree during mergeability evaluation.
13. A fallback stub report is required on most failure paths so CI and operators can distinguish evaluation failure from "no findings."
14. The command must not claim a repo is fully compliant if the repo is only in bootstrap or advisory rollout state.
15. Trusted contract and workflow sources must be pinned to immutable SHAs captured at workflow start.
16. Merge-queue evaluation must never treat candidate checkout policy as authoritative for governance comparisons.
17. Untrusted strings must be sanitized before entering JSON reports or console output, including ANSI/control-character stripping, newline normalization, and deterministic truncation.
18. Full-repo fallback must respect hard caps for file count, bytes scanned, and wall-clock time.

## Failure Model and Recovery

### Failure taxonomy

1. `policy_error`
   - contract invalid, missing trusted policy, or rule schema cannot be interpreted.
2. `runtime_error`
   - filesystem, parsing, or invocation failure prevents a trustworthy evaluation.
3. `drift_detected`
   - required doc surface missing, stale, or contradictory.
4. `unknown_governance_change`
   - changed file falls into a governance-sensitive area but no rule safely covers it.
5. `bootstrap_gap`
   - downstream repo or early rollout state has not yet been scaffolded with the necessary command/check wiring.
6. `trust_mismatch`
   - trusted policy or workflow truth cannot be loaded, or local-only truth was used in a context that requires protected-branch validation.

### Recovery rules

1. **Missing trusted contract or workflow truth**
   - Recovery: retry within bounded limits, then fail the run with `trust_mismatch` in merge-authoritative required mode and emit a stub report that records the missing immutable source identifiers.

2. **Required doc missing from diff**
   - Recovery: fail with a targeted finding naming the missing surface and the change category that required it.

3. **Doc changed but parity still broken**
   - Recovery: fail with contradiction details and identify the source-of-truth surface that disagrees.

4. **Unknown governance-impact file**
   - Recovery: fail closed in required mode, advisory in shadow mode, and require rule expansion before broadening rollout.

5. **Malformed downstream scaffold**
   - Recovery: surface as bootstrap gap with an actionable `init --update` or template-refresh remediation path.

6. **False-positive or noisy rule**
   - Recovery: demote the affected rule to advisory during rollout tuning, but only after preserving evidence in CI artifacts and updating policy intentionally.

7. **Local hook bypass**
   - Recovery: no special action; CI remains the final authority and must still fail if docs parity is broken.

8. **Report write failure**
   - Recovery: attempt a minimal stderr summary and nonzero exit if a safe artifact write is impossible; otherwise write a stub report that captures the write-path failure explicitly.

9. **Merge-queue versus pull-request context drift**
   - Recovery: the report must record which truth-loading mode was used so operators can distinguish a merge-group-only issue from a pull-request-only issue.

10. **Path or symlink traversal attempt**  
    Recovery: reject the path before read/write, emit `runtime_error`, and do not create artifacts outside the allowlisted output root; if a post-open path check fails, abort the write and remove any temporary artifact from the trusted directory.

11. **Full-repo fallback overrun**  
    Recovery: stop evaluation at the configured cap and fail closed in required mode with `runtime_error`.

## Observability

`docs-gate` must emit enough detail for maintainers to understand why the gate failed without re-running it interactively.

Required observability outputs:

- JSON report with stable schema and rule identifiers.
- human-readable summary with category counts and blocking findings.
- artifact path support for CI upload and audit retention.
- explicit listing of `changed_files[]` and normalized categories used during evaluation.
- provenance for trusted policy source when CI loads contract/workflow truth from the base branch.
- execution-context fields that make bootstrap/advisory/required posture visible to operators.

Recommended summary fields:

- `finding_count`
- `error_count`
- `warning_count`
- `required_surface_count`
- `missing_surface_count`
- `contradiction_count`
- `bootstrap_gap_count`
- `unknown_category_count`

Recommended metrics for rollout monitoring:

- advisory finding rate per PR
- percent of findings that become resolved before merge
- bootstrap-gap frequency in downstream repos
- rule-level false-positive review count
- top offending categories by repeated failure volume

Recommended rollout operations table:

| Metric | Owner | Cadence | Threshold | Action |
| --- | --- | --- | --- | --- |
| false-positive rate | harness maintainer | daily during rollout | > 5 percent in Phase 1, > 3 percent in Phase 2+ | freeze promotion or demote to advisory |
| bootstrap-gap rate | repo maintainer | daily | > 10 percent of downstream evaluations | prioritize `init --update` rollout |
| trust-mismatch count | harness maintainer | every CI failure | any recurring unresolved event | halt promotion and fix source loading |
| blocking docs-gate failures by category | repo maintainer | weekly | `blocking_failure_rate > 15 percent` across the most recent 20 merge-authoritative evaluations or any rolling 24-hour window with at least 10 evaluations | demote to advisory and investigate source drift before re-promoting |

Recommended post-deploy checks:

- verify `docs-gate` job name is present in required-check configuration
- verify `init` output includes expected docs-gate workflow and hook wiring
- run fixture-based validation for missing-doc, contradiction, and bootstrap-gap cases on each release
- verify rollout health at immediate, `+1h`, and `+24h` checkpoints before advancing rollout phase

Recommended operator-facing output qualities:

- one finding per distinct rule/surface violation,
- messages that name both the implementation surface and the missing/stale doc surface,
- predictable rule IDs so false positives can be tracked and tuned during rollout.

## Acceptance and Test Matrix

1. **CLI command added or renamed**
   - Change: CLI dispatch/help/registry changes.
   - Expectation: `README.md` command table and any governed command docs update.
   - Pass condition: docs-gate reports required surfaces present and parity restored.

2. **Required CI check set changes**
   - Change: `src/lib/policy/required-checks.ts`, workflow required-check logic, or contract default check list changes.
   - Expectation: `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, and relevant governance docs remain aligned.
   - Pass condition: no contradiction findings across workflow, docs, and defaults.

3. **Linear or future governance policy changes**
   - Change: contract validator/types/init templates for issue-tracking or contributor policy.
   - Expectation: contributor-facing policy docs and scaffolded outputs update together.
   - Pass condition: docs-gate reports matching governed surfaces and no stale template guidance.

4. **Init scaffolding changes**
   - Change: generated workflow or doc content emitted by `init`.
   - Expectation: source docs and scaffold expectations update together.
   - Pass condition: docs-gate validates template/source parity.

5. **Doc-only maintenance change**
   - Change: edits limited to governed docs without implementation changes.
   - Expectation: command does not fail solely because no implementation category triggered, but it still catches contradictions introduced by the doc edit.
   - Pass condition: no missing-update findings and parity checks pass.

6. **Unknown governance change**
   - Change: file in a governance-sensitive path changes without a matching rule.
   - Expectation: explicit unknown-governance finding.
   - Pass condition: advisory reports in shadow mode; required mode blocks merge.

7. **Invalid contract or rule schema**
   - Change: malformed docs-gate policy in contract.
   - Expectation: fail as policy error with actionable validation output.
   - Pass condition: operator gets exact invalid path/key and smallest safe fix.

8. **Path-safety regression**
   - Change: out-path or repo-root traversal attempt.
   - Expectation: fail closed and never write outside allowed locations.
   - Pass condition: explicit runtime or validation error, no unsafe filesystem writes.

9. **Downstream bootstrap repo without docs-gate wiring**
   - Change: scaffolded repo before upgrade.
   - Expectation: bootstrap-gap output with clear remediation path.
   - Pass condition: upgrade path documented and no silent pass that masks missing enforcement.

10. **Merge queue execution**
    - Change: same governance-affecting PR evaluated under `merge_group`.
    - Expectation: trusted execution context is recorded and parity result matches protected-branch truth.
    - Pass condition: no PR-only assumptions break merge-queue evaluation.

11. **PR attempts to weaken policy and docs together**
    - Change: PR edits `harness.contract.json` or workflow files plus docs to create internal agreement around a weaker policy.
    - Expectation: mergeability still evaluates against trusted base-branch truth where required.
    - Pass condition: docs-gate rejects the PR when current-branch prose only agrees with mutated PR policy.

12. **Doc-only contradiction on a governed surface**
    - Change: `AGENTS.md` or `CONTRIBUTING.md` is edited without implementation changes and introduces an incorrect required-check list.
    - Expectation: parity validators still run for the changed governed doc.
    - Pass condition: contradiction finding is emitted even though no code file changed.

13. **Hook template drift**
    - Change: `init` updates generated hook content or recommended local gates.
    - Expectation: source docs, generated template fragments, and any downstream guidance remain aligned.
    - Pass condition: docs-gate detects stale hook guidance and passes only when template and docs agree.

14. **Governed doc delete or rename**
    - Change: `AGENTS.md` or a governed `docs/agents/*` file is deleted, renamed, or moved.
    - Expectation: docs-gate treats the operation as blocking until rule mappings and source references are updated coherently.
    - Pass condition: no silent pass on deleted or moved governed surfaces.

15. **Trusted source retrieval failure**
    - Change: protected contract or workflow source cannot be loaded in `pull_request` or `merge_group`.
    - Expectation: bounded retries occur, then the command emits `trust_mismatch` with a stub report and nonzero exit in required mode.
    - Pass condition: failure is deterministic and artifact consumers still receive a valid stub schema.

16. **Template render parity**
    - Change: `init` template source is modified in a way that only appears after rendering fixture inputs.
    - Expectation: normalized rendered-output validator catches the drift.
    - Pass condition: raw-template formatting differences alone do not create noise, but semantic rendered drift is detected.

17. **Full repo fallback over cap**
    - Change: diff metadata is unavailable and fallback scan exceeds configured caps.
    - Expectation: evaluation stops and fails closed in required mode.
    - Pass condition: no unbounded scan or silent success.

18. **Rollout threshold crossing**
    - Change: observed false-positive or blocking-failure metrics cross a normative promotion-freeze or rollback threshold.
    - Expectation: the rollout controller freezes promotion or auto-demotes to advisory mode, and the emitted artifact records the triggering metric, evaluation window, and resulting phase/posture.
    - Pass condition: operators can prove from the report why the rollout state changed and which threshold was crossed.

## Open Questions

None. The v1 contract path, governance-doc scope, trusted-source behavior, and report-shape compatibility are all resolved in this spec.

## Definition of Done

- A spec-compliant `docs-gate` design exists with clear command/report semantics.
- The chosen contract surface for docs-gate policy is defined and validated.
- v1 governed surfaces and change categories are explicitly enumerated.
- Required CI integration for `docs-gate` is defined for PRs and merge queue where applicable.
- `init` integration expectations for downstream repos are defined.
- Failure posture, observability, and rollout model are explicit enough that `/prompts:workflow-plan` can build phases and tasks without inventing behavior.
- The design preserves the repo principle that merge policy validates artifact truth, not which skill produced it.
- The design clearly distinguishes trusted-base-branch evaluation, local feedback mode, bootstrap state, and required-mode enforcement.
- Exit behavior, stub-report schema, template comparison layer, and rollout thresholds are explicit enough that CI and operator runbooks do not have to invent semantics.
