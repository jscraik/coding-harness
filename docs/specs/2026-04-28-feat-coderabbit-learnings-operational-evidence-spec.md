---
schema_version: 1
title: CodeRabbit Learnings as Operational Evidence
type: feat
status: draft
date: 2026-04-28
deepened: 2026-04-28
origin: /Users/jamiecraik/Downloads/learnings.csv
risk: high
spec_depth: full
ui_required: false
---

# CodeRabbit Learnings as Operational Evidence

Status: deepened draft specification for turning exported CodeRabbit learnings into load-bearing coding-harness guardrails.

Purpose: make repeated review learnings reduce PR lead time by converting them into importable evidence, gates, review-context facts, scaffold defaults, validation plans, provenance rules, and measurable north-star feedback.

## Deepening Summary

**Deepened on:** 2026-04-28
**Mode:** targeted-confidence
**Key areas improved:** lifecycle states, interface shape selection, promotion semantics, failure handling, rollout gates

- Added an explicit learning lifecycle so import, classification, matching, promotion, enforcement, and feedback states are deterministic.
- Compared alternative caller-facing interface shapes and selected a command-family architecture that keeps the first slice small while preserving provider extensibility.
- Tightened promotion and severity rules so usage count informs enforcement without accidentally blocking on weak fuzzy matches.
- Added source-trust, stale-data, provenance, security, and rollback behavior so implementation can fail safely.
- Added planning readiness gates and phase-specific acceptance criteria so `he-plan` can split the work without inventing missing requirements.
- Added Phase 1A/1B boundaries, artifact persistence defaults, output envelopes, and frontmatter rule scope so the first implementation slice can stay small.
- Clarified Phase 1 command names, repository filtering, optional CSV field normalization, absolute local source handling, deterministic ID generation, and the boundary between first gate support and later promotion.

## Table of Contents

- [Problem Statement](#problem-statement)
- [Goals](#goals)
- [Non-Goals](#non-goals)
- [System Boundary](#system-boundary)
- [Phase 1 Scope Guardrail](#phase-1-scope-guardrail)
- [Artifact Persistence Defaults](#artifact-persistence-defaults)
- [Phase 1 Import Normalization Rules](#phase-1-import-normalization-rules)
- [Domain Language](#domain-language)
- [Core Domain Model](#core-domain-model)
- [Source and Provenance Contract](#source-and-provenance-contract)
- [Command Surface](#command-surface)
- [Learning Classification](#learning-classification)
- [Lifecycle State Model](#lifecycle-state-model)
- [Matching and Enforcement Semantics](#matching-and-enforcement-semantics)
- [Interface Shape Alternatives](#interface-shape-alternatives)
- [Selected Caller-Facing Contract](#selected-caller-facing-contract)
- [Promotion Lifecycle](#promotion-lifecycle)
- [Review Context Pack](#review-context-pack)
- [Validation Plan Contract](#validation-plan-contract)
- [Artifact Provenance Registry](#artifact-provenance-registry)
- [CI Ownership Contract](#ci-ownership-contract)
- [Scaffold and Downstream Project Behavior](#scaffold-and-downstream-project-behavior)
- [North-Star Feedback Metrics](#north-star-feedback-metrics)
- [Interfaces and Integration Points](#interfaces-and-integration-points)
- [Failure Model and Recovery](#failure-model-and-recovery)
- [Security and Privacy](#security-and-privacy)
- [Acceptance Criteria](#acceptance-criteria)
- [Test Matrix](#test-matrix)
- [Rollout Plan](#rollout-plan)
- [Open Questions](#open-questions)
- [Definition of Done](#definition-of-done)

## Problem Statement

`coding-harness` is becoming the harness for all Jamie projects, but repeated review knowledge still enters the system as exported notes or reviewer memory. The current state creates review-loop drag:

- CodeRabbit learnings are useful but static after export.
- Agents can miss high-usage learnings unless the CSV is manually inspected.
- The same review comments can recur because the learning is not converted into a gate, scaffold default, or regression test.
- Validation command selection is spread across docs and memory rather than generated from changed files.
- Generated artifacts, policy docs, CI ownership, and package-manager contracts can be misinterpreted during review.

The north-star risk is that coding-harness accumulates more policy prose while PR lead time still suffers from repeated clarification and rework. The system needs to convert reviewer learnings into operational evidence that agents and gates consume before review.

## Goals

1. Import CodeRabbit learning exports into a stable, provider-neutral harness learning format.
2. Preserve source provenance, row identity, usage count, repository, affected file, PR reference, and live-data capability status.
3. Classify each learning into a destination class: guardrail, validation contract, source-of-truth rule, generated-artifact rule, scaffold default, CI ownership rule, review-context fact, or memory-only note.
4. Add `harness learnings gate` to match changed files against relevant learnings and emit standard `GateResult` JSON.
5. Add promotion analysis so high-usage learnings become permanent validators, tests, scaffold rules, or explicit non-goals.
6. Generate a review context pack that CodeRabbit, Codex, and humans can use to see applicable learned constraints for a PR.
7. Generate validation plans from changed files and learned command-selection rules.
8. Add artifact provenance and CI ownership contracts for repeated generated/source and CI-provider learnings.
9. Feed scaffold defaults so `harness init` carries high-confidence learnings into downstream projects.
10. Track north-star feedback metrics showing whether repeated learning hits and review rework are decreasing.

## Non-Goals

1. Building a live CodeRabbit learning API integration before CodeRabbit exposes a supported CLI/API surface.
2. Treating `coderabbit stats` as row-level learning data.
3. Blocking all low-usage learnings by default.
4. Replacing CodeRabbit review, Codex review, CircleCI, Semgrep, or human approval.
5. Importing secrets or private token values from local machines or browser caches.
6. Rewriting all existing validation gates in the first slice.
7. Creating ADRs for every promoted learning; Linear comments or spec updates are preferred for durable decision capture.

## System Boundary

### Owns

- Provider-neutral learning import schema.
- CodeRabbit CSV provider.
- Learning classification and matching rules.
- `harness learnings gate` output and severity semantics.
- Promotion candidate generation and promotion status tracking.
- PR review context artifact generation.
- Validation plan recommendations derived from changed files and learned rules.
- Artifact provenance registry contract.
- CI ownership contract shape and gate semantics.
- North-star learning feedback metrics.

### Does Not Own

- CodeRabbit internal learning database or UI.
- GitHub review-thread storage outside imported or queried evidence.
- CircleCI execution internals.
- Project-specific secrets, credentials, or auth creation.
- Human decision to accept or reject promotion candidates.

## Phase 1 Scope Guardrail

Phase 1 is intentionally split into two implementation slices so planning does not accidentally build the entire learning ecosystem at once.

### Phase 1A: Import-only foundation

Phase 1A includes only:

- normalized learning schema,
- CodeRabbit CSV parser,
- deterministic ID generation,
- import result JSON envelope,
- atomic local artifact write,
- import summary and warnings,
- fixture tests for the supplied CodeRabbit CSV shape.

Phase 1A explicitly excludes:

- gate enforcement,
- fuzzy matching,
- classification overrides,
- promotion workflow,
- review-context generation,
- validation-plan generation,
- artifact provenance enforcement,
- CI ownership schema migration,
- north-star feedback dashboard,
- live CodeRabbit provider or `coderabbit stats` integration.

### Phase 1B: Exact-file gate

Phase 1B includes only:

- exact-file learning matcher,
- high-confidence path/prefix matching where the path is explicit in the imported learning,
- `GateResult` output for `harness learnings gate`,
- the first mandatory frontmatter learning fixture,
- stale-source warnings for imported artifacts.

Phase 1B excludes fuzzy keyword-only blocking. Keyword-only hits may emit `warning` or `info` after Phase 1B, but they must not fail the gate until a later measured false-positive pass.

## Artifact Persistence Defaults

The first implementation must distinguish local import artifacts from shareable snapshots.

Local artifact:

```text
.harness/learnings/coderabbit.local.json
```

- Default output for `harness learnings import`.
- Intended to be gitignored.
- May preserve absolute local CSV source URIs for operator traceability.
- May include local import timestamps.

Shareable snapshot:

```text
.harness/learnings/coderabbit.snapshot.json
```

- Explicit output only; never produced accidentally.
- Must not contain machine-specific absolute paths.
- Should use `sourceLabel`, synthesized GitHub URLs, and sanitized provider metadata.
- Suitable for committed evidence if the repo later chooses to share imported learning state.

Phase 1A should implement the local artifact default and reserve the snapshot path by rejecting explicit `.harness/learnings/coderabbit.snapshot.json` output with a clear usage error. Snapshot sanitization is deferred until the snapshot artifact is planned as a committed/shareable output.

## Phase 1 Import Normalization Rules

Phase 1A must normalize the supplied CodeRabbit CSV without making later enforcement decisions.

Required repository filter behavior:

- `--repo <name>` filters imported items to rows whose `Repository` value matches `<name>` after case-insensitive slug normalization.
- `summary.totalRows` counts physical CSV data rows after the header.
- `summary.imported` counts rows included in the output artifact.
- `summary.skipped` counts syntactically valid rows excluded by the repository filter.
- Repository-filtered rows do not emit `unsupported_repository` warnings.
- `unsupported_repository` is reserved for malformed or unsupported repository values when no explicit repository filter explains the skip.

Required optional-field behavior:

- Blank `File` becomes absent and does not warn by default.
- Blank `Pull Request` becomes absent and does not warn by default.
- Blank `URL` plus a valid repository and pull request synthesizes the canonical GitHub pull request URL.
- Blank `URL` without a pull request remains absent and does not warn by default.
- `Usage` parses as a non-negative integer. Blank usage parses as `0`.
- `Last Used` equal to `Never` normalizes to `null`.
- Date-like CSV fields are preserved as source strings in Phase 1A; parsed timestamps can be added later without changing the source record.

Required absolute-source behavior:

- `coderabbit-csv` imports may read an explicitly supplied absolute `--source` path for local operator evidence, including `/Users/jamiecraik/Downloads/learnings.csv`.
- Local artifacts may preserve the absolute source URI with `source.live=false`.
- Shareable snapshot artifacts must not preserve absolute machine-local source paths. In Phase 1A, explicit `--output .harness/learnings/coderabbit.snapshot.json` must be rejected instead of writing an unsafe partial snapshot. When snapshot output is implemented in a later phase, source details must be sanitized into `sourceLabel`, provider metadata, row numbers, and public GitHub URLs where available.

Required deterministic ID behavior:

- IDs use the shape `coderabbit.<repository-slug>.<topic-slug>`.
- Repository slugs are lowercase, punctuation-normalized, and path-separator-free.
- Topic slugs are derived from an explicit target path or the first stable learning topic phrase, then lowercase and punctuation-normalized.
- Collisions append a short stable hash derived from provider, repository, CSV row number, and normalized learning text.
- The highest-signal frontmatter fixture must produce `coderabbit.coding-harness.docs-frontmatter-machine-readable`.

Required embedded target behavior:

- Phase 1A should extract deterministic target patterns only from learning text that starts with `Applies to <path-or-glob> :`.
- Extracted values are stored as `targetPatterns: string[]`.
- Phase 1B may match exact changed files against both `file` and `targetPatterns`.
- Keyword-only or fuzzy target inference remains out of scope for Phase 1B.

Required classification behavior:

- Phase 1A classification is provisional and non-blocking.
- Parser correctness, provenance, stable IDs, deterministic ordering, and import envelope correctness take priority over perfect classification.
- `enforcement.severity` may be provisional until a later promotion or gate-specific implementation proves the rule.

## Domain Language

Canonical terms for this feature:

- `Learning`: a single reviewer-derived rule, warning, exception, or operational fact.
- `Learning source`: the system or artifact that supplied learnings, such as a CodeRabbit CSV export.
- `Learning item`: the normalized harness representation of a learning.
- `Learning hit`: a learning matched to a changed file or repo surface.
- `Promotion`: the process of turning a learning into a permanent validator, gate rule, scaffold default, regression test, or explicit non-goal.
- `Operational evidence`: imported data that gates and review artifacts can cite.
- `Review context pack`: generated PR-scoped artifact containing applicable learnings and validation guidance.
- `Artifact provenance`: machine-readable relationship between generated files, source templates, sync commands, and review policy.
- `CI ownership`: machine-readable statement of which provider owns PR governance, fallback workflows, review checks, and security checks.

Avoided aliases:

- Do not call imported learnings merely `notes`; they are evidence when provenance is preserved.
- Do not call CodeRabbit CSV data `live` unless a supported live API or CLI endpoint produced it during the run.
- Do not call promotion candidates `implemented` until a code/test/scaffold rule records `promotionStatus: enforced`.

Domain consistency decision:

- `Learning` is the durable user-facing term because it matches the CodeRabbit export and Jamie's wording.
- `Operational evidence` is the governance role the learning plays inside coding-harness.
- `Promotion` is not implementation by itself; it is the transition from imported evidence to an enforceable harness surface.
- No root `CONTEXT.md` or `CONTEXT-MAP.md` exists for this repository at the time of drafting, so these terms should be treated as local to this spec until a future context file adopts them.

Memory boundary:

- `.harness/memory/LEARNINGS.md` remains the human/agent-written repo-local gotcha memory surface.
- `.harness/learnings/*.json` is provider-imported structured evidence.
- Provider imports do not replace repo memory.
- Promotion may convert either imported learnings or human memory into gates/tests/scaffold defaults, but the two sources must remain distinguishable in provenance.

## Core Domain Model

### `LearningSourceRef`

```ts
export type LearningSourceKind =
  | "coderabbit_csv"
  | "coderabbit_cli_stats"
  | "coderabbit_live"
  | "harness_memory"
  | "github_review_threads";

export interface LearningSourceRef {
  kind: LearningSourceKind;
  uri: string;
  importedAt: string;
  live: boolean;
  provenance: {
    tool?: string;
    version?: string;
    command?: string;
  };
}
```

### `LearningItem`

```ts
export interface LearningItem {
  id: string;
  provider: "coderabbit" | "harness" | "github";
  source: LearningSourceRef & { row?: number };
  repository: string;
  file?: string;
  pullRequest?: string;
  githubUrl?: string;
  usage: number;
  learning: string;
  createdBy?: string;
  lastUsed?: string | null;
  createdAt?: string;
  updatedAt?: string;
  classification: LearningClassification;
  enforcement: LearningEnforcement;
  promotionStatus: LearningPromotionStatus;
  enforcedBy?: string[];
}
```

### `LearningImportArtifact`

```ts
export interface LearningImportArtifact {
  schemaVersion: "harness-learnings/v1";
  repository?: string;
  generatedAt: string;
  source: LearningSourceRef;
  liveCompanions?: LearningSourceRef[];
  summary: {
    totalRows: number;
    imported: number;
    skipped: number;
    byClassification: Record<LearningClassification, number>;
    byPromotionStatus: Record<LearningPromotionStatus, number>;
  };
  items: LearningItem[];
  warnings: LearningImportWarning[];
}
```

### `LearningImportWarning`

```ts
export interface LearningImportWarning {
  row?: number;
  code:
    | "missing_optional_field"
    | "invalid_usage"
    | "unsupported_repository"
    | "malformed_row"
    | "duplicate_learning";
  message: string;
}
```

### Command result envelopes

Import command output:

```ts
export interface LearningImportResult {
  schemaVersion: "learnings-import-result/v1";
  status: "success" | "partial" | "fail";
  artifactPath?: string;
  source: LearningSourceRef;
  summary: LearningImportArtifact["summary"];
  warnings: LearningImportWarning[];
  error?: {
    code: string;
    message: string;
    fix?: string;
  };
}
```

Promotion command output:

```ts
export interface LearningPromotionCandidatesResult {
  schemaVersion: "learning-promotion-candidates/v1";
  status: "success" | "fail";
  promotionCandidates: LearningPromotionCandidate[];
  summary: {
    totalCandidates: number;
    minUsage: number;
    highUsageUnenforced: number;
  };
  error?: {
    code: string;
    message: string;
    fix?: string;
  };
}
```

Promotion candidate output:

```ts
export interface LearningPromotionCandidate {
  id: string;
  usage: number;
  classification: LearningClassification;
  recommendedTarget: string;
  recommendedSeverity: "error" | "warning" | "info";
  recommendedTest?: string;
  reason: string;
  evidenceRef: string[];
}
```

### `LearningClassification`

Allowed values:

- `guardrail`
- `validation_contract`
- `source_of_truth`
- `generated_artifact`
- `scaffold_default`
- `ci_ownership`
- `review_context`
- `memory_only`

### `LearningEnforcement`

```ts
export interface LearningEnforcement {
  severity: "error" | "warning" | "info";
  minUsageReason: string;
  destination: string;
  suppressible: boolean;
  fix?: {
    manual?: string;
    command?: string;
  };
}
```

### `LearningPromotionStatus`

Allowed values:

- `unreviewed`
- `candidate`
- `accepted`
- `enforced`
- `rejected`
- `deferred`
- `non_goal`

## Source and Provenance Contract

The first supported source is the CodeRabbit CSV export with columns:

- `Learning`
- `Repository`
- `File`
- `Pull Request`
- `URL`
- `Created By`
- `Usage`
- `Last Used`
- `Created At`
- `Updated At`

The importer must preserve the original source reference and normalize row numbers using the physical CSV row number, including header offset.

When the CSV `URL` field is blank and `Repository` plus `Pull Request` are available, the importer should synthesize a GitHub PR URL:

```text
https://github.com/jscraik/<repository>/pull/<pull-request>
```

The importer must mark CodeRabbit CSV sources as `live: false`.

`coderabbit stats` may be recorded as a live companion source for coarse evidence only. It must not be used as row-level learning evidence.

Phase 1 must not call or parse `coderabbit stats`. Live companion metadata is deferred until a later phase with a stable JSON-producing source or a deliberately tested parser.

Import artifact ordering must be deterministic:

- `items` sorted by repository, file, usage descending, then ID;
- `warnings` sorted by row, then code, then message;
- `byClassification` and `byPromotionStatus` emitted with stable key ordering;
- `byClassification` and `byPromotionStatus` include every known enum key with explicit `0` counts, not only keys present in the imported CSV.

## Command Surface

### `harness learnings import`

Purpose: convert provider exports into normalized harness learning artifacts.

Example:

```bash
harness learnings import \
  --provider coderabbit-csv \
  --source /Users/jamiecraik/Downloads/learnings.csv \
  --repo coding-harness \
  --output .harness/learnings/coderabbit.local.json \
  --json
```

Required behavior:

- Validate CSV headers.
- Filter by repository when `--repo` is provided.
- Generate stable deterministic IDs.
- Preserve raw learning text in the local artifact for evidence traceability, but never echo full learning text, `createdBy`, local source paths, or provenance command fields into human-readable command output.
- Detect obvious sensitive-token patterns in imported free-text fields and emit a warning without printing the sensitive value; Phase 1A must not implement shareable snapshot writing as a workaround for redaction.
- Infer initial classification and enforcement from content, file path, and usage count.
- Emit an import summary with counts by classification and usage threshold.
- Emit `LearningImportResult` JSON when `--json` is passed.
- Write `.harness/learnings/coderabbit.local.json` by default unless `--output` is supplied.
- Write artifacts atomically by writing a temporary file in the same directory and renaming it into place.

### `harness learnings gate`

Purpose: match changed files or explicit files against imported learnings and emit a `GateResult`.

Example:

```bash
harness learnings gate \
  --source .harness/learnings/coderabbit.local.json \
  --files docs/ai-assistant-security-policy.md \
  --json
```

Required behavior:

- Load normalized learning items.
- Phase 1B must match by exact file, extracted target pattern, path prefix, and repository.
- Phase 1B must not block on classified keyword-only matches; keyword-only matching is reserved for advisory output or a later phase with measured false-positive behavior.
- Weight findings by usage count.
- Emit standard `GateResult` JSON.
- Include evidence references to the source CSV row and synthesized GitHub PR URL where available.
- In Phase 1B, support exact file matching only plus explicit path/prefix matches inferred from structured file fields.
- Emit a clear validation error with the expected import command when the learning artifact is missing.

### `harness learnings promote`

Purpose: produce a promotion queue for high-value learnings.

Example:

```bash
harness learnings promote \
  --source .harness/learnings/coderabbit.local.json \
  --min-usage 25 \
  --json
```

Required behavior:

- Sort candidates by usage count descending.
- Recommend target surface, severity, and test path.
- Distinguish permanent rule candidates from review-context-only candidates.
- Exclude `promotionStatus: enforced` unless `--include-enforced` is passed.
- Emit `LearningPromotionCandidatesResult` JSON when `--json` is passed.

### `harness review-context`

Purpose: generate PR-scoped learned context for agents, reviewers, and PR bodies.

Example:

```bash
harness review-context \
  --source .harness/learnings/coderabbit.local.json \
  --files <changed-files> \
  --json
```

Required behavior:

- Include applicable learning summaries.
- Include matching confidence and usage counts.
- Include validation plan entries when available.
- Write `artifacts/review-context/pr-context.json` when `--output` is provided.

### `harness validation-plan`

Purpose: recommend exact validation commands from changed files, contract rules, and learned command-selection rules.

Example:

```bash
harness validation-plan --files <changed-files> --json
```

Required behavior:

- Recommend narrow checks first.
- Recommend `pnpm test:ci` for CircleCI parity and migration surfaces.
- Recommend `pnpm test:deep` when runtime or artifact behavior changes.
- Classify network-required commands such as `pnpm audit` separately.
- Emit blocked reasons when environment capabilities are missing.

### `harness artifact-gate`

Purpose: enforce generated/source provenance rules.

Example:

```bash
harness artifact-gate --files scripts/codex-preflight.sh --json
```

Required behavior:

- Load artifact provenance registry.
- Flag generated artifacts changed without corresponding source/template changes.
- Tell agents which source file and sync command to use.

### `harness ci-ownership-gate`

Purpose: enforce machine-readable CI ownership rules.

Example:

```bash
harness ci-ownership-gate --json
```

Required behavior:

- Validate primary PR gate ownership.
- Preserve fallback workflow trigger expectations.
- Preserve external required checks such as Semgrep Cloud.
- Preserve independent review requirements such as CodeRabbit.

### `harness north-star-feedback`

Purpose: summarize whether learning operations are reducing repeated review/rework loops.

Example:

```bash
harness north-star-feedback --source .harness/learnings/coderabbit.json --json
```

Required behavior:

- Count learning hits, warnings, blocks, promotion candidates, promoted learnings, and unenforced high-usage learnings.
- Write `.harness/metrics/north-star-feedback.json` when requested.

## Learning Classification

Initial automatic classification should use deterministic heuristics:

| Classification | Signals | Destination |
| --- | --- | --- |
| `guardrail` | must, never, should not, known bad review pattern, high usage | gate rule |
| `validation_contract` | command names, `pnpm`, `test:ci`, `test:deep`, preflight, audit | validation planner |
| `source_of_truth` | source of truth, canonical, package manager, repo script | tooling gate |
| `generated_artifact` | generated, artifact, template, mirror, byte-identical, symlink | artifact gate |
| `scaffold_default` | scaffold, `harness init`, `.npmrc`, `environment.toml`, template | scaffold tests |
| `ci_ownership` | CircleCI, CodeRabbit, GitHub Actions, Semgrep, required checks | CI ownership gate |
| `review_context` | contextual facts useful to reviewers but not enforceable | review context pack |
| `memory_only` | low-usage or ambiguous notes | imported memory only |

Manual classification overrides should be supported in a later phase through a small JSON override file.

## Lifecycle State Model

The feature must use explicit states so downstream planning can separate import mechanics from enforcement behavior.

### Import lifecycle

1. `source_detected`: a CSV path or future provider source was supplied.
2. `source_validated`: the source exists and required headers are present.
3. `rows_normalized`: rows are converted into `LearningItem` candidates.
4. `items_classified`: classification and initial enforcement are attached.
5. `artifact_written`: normalized artifact is written atomically.
6. `artifact_ready`: artifact can be consumed by gates.

Blocking transitions:

- `source_detected -> source_validated` blocks on missing file or invalid headers.
- `rows_normalized -> items_classified` does not block on individual malformed rows unless all rows are invalid.
- `items_classified -> artifact_written` blocks on write failure.

### Enforcement lifecycle

1. `artifact_ready`: imported learning data exists.
2. `changes_supplied`: explicit files or changed files are available.
3. `hits_computed`: matcher produced learning hits.
4. `findings_emitted`: hits were converted to `GateResult` findings.
5. `decision_recorded`: pass, warn, fail, or blocked outcome is recorded in command output.

Blocking transitions:

- `artifact_ready -> changes_supplied` blocks only when no files are provided and changed-file discovery is unavailable.
- `hits_computed -> findings_emitted` must preserve all high-confidence exact matches.
- Fuzzy matches can warn but must not fail without high usage and classification confidence.

### Promotion lifecycle

Promotion states are defined in [Promotion Lifecycle](#promotion-lifecycle). A learning may be imported and matched before it is promoted. Promotion exists to make the rule durable in code, tests, scaffold defaults, or explicit non-goals.

## Matching and Enforcement Semantics

Matching order:

1. Exact file path match.
2. Path prefix or glob match inferred from learning text.
3. Repository-wide keyword match for high-usage source-of-truth or validation learnings.
4. Classification-specific matcher.

Severity defaults by usage:

| Usage | Default treatment |
| ---: | --- |
| `>= 100` | `error` unless classified `review_context` or `memory_only` |
| `25-99` | `warning` with promotion candidate |
| `5-24` | `info` in review context |
| `< 5` | memory-only unless exact file match and explicit normative language exists |

`harness learnings gate` must not block on low-confidence keyword-only matches. It should emit warnings or info findings unless the learning has high usage and a precise path/classification match.

## Interface Shape Alternatives

The spec introduces multiple CLI and module boundaries. Planning must use one coherent interface shape rather than independently inventing each command.

### Shape A: One command with subactions

Caller shape:

```bash
harness learnings import --provider coderabbit-csv --source learnings.csv --repo coding-harness --json
harness learnings gate --source .harness/learnings/coderabbit.json --files docs/example.md --json
harness learnings promote --source .harness/learnings/coderabbit.json --min-usage 25 --json
```

Caller usage example:

```bash
harness learnings import --provider coderabbit-csv --source /Users/jamiecraik/Downloads/learnings.csv --repo coding-harness --json
harness learnings gate --files docs/ai-assistant-security-policy.md --json
```

Hidden complexity:

- Provider-specific import parsing.
- Default artifact path discovery.
- Classification and matching logic.
- Shared output schemas for import, gate, and promotion.

Tradeoffs:

- Simplicity: high, because related behavior is grouped.
- Flexibility: medium, because non-learning commands such as validation-plan still live elsewhere.
- Implementation efficiency: high for the first slice.
- Ease of correct use: high; callers discover the lifecycle under one namespace.
- Misuse risk: low; import/gate/promote are visibly separate subactions.

### Shape B: Separate top-level commands

Caller shape: rejected for Phase 1A and Phase 1B. Do not introduce top-level learning aliases; use `harness learnings <subcommand>`.

Caller usage example:

```bash
harness learnings gate --source .harness/learnings/coderabbit.json --files src/commands/foo.ts --json
```

Hidden complexity:

- Same parsing and matching internals as Shape A.
- Command registry must expose more top-level names.

Tradeoffs:

- Simplicity: medium; individual commands are direct but command surface expands quickly.
- Flexibility: high; each command can evolve independently.
- Implementation efficiency: medium; more registry and docs updates.
- Ease of correct use: medium; users must learn more command names.
- Misuse risk: medium; import/promote/gate relationship is less obvious.

### Shape C: Extend existing gates only

Caller shape:

```bash
harness preflight-gate --learnings-source .harness/learnings/coderabbit.json --files docs/example.md --json
harness review-gate --review-context artifacts/review-context/pr-context.json --json
```

Caller usage example:

```bash
harness preflight-gate --contract harness.contract.json --files docs/ai-assistant-security-policy.md --learnings-source .harness/learnings/coderabbit.json --json
```

Hidden complexity:

- Learning import still needs a command or external step.
- Existing gates must absorb new responsibility.
- Review-context and promotion behavior become less discoverable.

Tradeoffs:

- Simplicity: low for implementation because existing gates gain unrelated concerns.
- Flexibility: low initially; learning lifecycle is buried inside other gates.
- Implementation efficiency: low for first slice.
- Ease of correct use: medium for users already running preflight/review gates.
- Misuse risk: high; skipped import or stale learning artifacts can be hard to diagnose.

## Selected Caller-Facing Contract

Select Shape A for the learning lifecycle and keep adjacent command families separate.

Canonical command family:

```bash
harness learnings import ...
harness learnings gate ...
harness learnings promote ...
```

Adjacent standalone commands remain separate because they are useful without CodeRabbit learnings:

```bash
harness review-context ...
harness validation-plan ...
harness artifact-gate ...
harness ci-ownership-gate ...
harness north-star-feedback ...
```

Rationale:

- The `learnings` namespace reflects the lifecycle and reduces top-level command sprawl.
- Import, gate, and promote share the same artifact schema and should be discoverable together.
- `validation-plan`, `artifact-gate`, and `ci-ownership-gate` are broader harness capabilities that can consume learnings but should not require them.
- This shape is easiest for agents to use correctly: import once, gate changed files, promote high-value rows.

Planning constraint:

- `he-plan` should implement the `learnings` command namespace first and must not add top-level compatibility aliases in Phase 1A or Phase 1B.
- Before locking this shape, `he-plan` must inspect the current CLI registry and dispatch code to confirm nested command-family support.
- If nested command-family support is absent or materially increases Phase 1A scope, implementation must stop and re-plan the command seam instead of substituting top-level aliases.

## Promotion Lifecycle

Promotion states:

1. `unreviewed`: imported but not analyzed.
2. `candidate`: recommended by `harness learnings promote`.
3. `accepted`: human or maintainer accepted it for implementation.
4. `enforced`: code, tests, scaffold, or gate rule records enforcement.
5. `rejected`: explicitly not useful or invalid.
6. `deferred`: useful but intentionally not scheduled.
7. `non_goal`: explicitly documented as outside harness responsibility.

Promotion must record:

- target surface,
- reason,
- enforcing files,
- test files,
- validation command,
- status.

High-usage learnings must not stay indefinitely as `unreviewed` without appearing in north-star feedback metrics.

### Promotion decision rules

- `usage >= 100`: must become `candidate` on promotion analysis unless explicitly classified as `non_goal` or `rejected`.
- `usage >= 25`: should become `candidate` when the classification has a concrete destination.
- `usage < 25`: may stay `unreviewed` or `memory_only` unless exact file path and normative language make it actionable.
- A learning cannot become `enforced` without at least one concrete enforcing file or generated scaffold surface.
- A learning cannot become `non_goal` without a short reason that future agents can understand.

### First mandatory promotion

The first promotion implementation slice, currently Phase 2, must promote the highest-signal learning from the supplied CSV:

```text
YAML frontmatter fields in coding-harness policy docs are machine-readable metadata and must not be represented as prose sections or Table of Contents entries.
```

Expected target:

- classification: `guardrail`
- destination: docs-surface validator or docs-gate rule
- severity: `error` for exact file/surface matches
- regression test: fixture policy doc where frontmatter keys are incorrectly listed in headings or TOC

Scope:

- Applies when a Markdown file contains YAML frontmatter with one or more of `schema_version`, `status`, or `applies_to`.
- Applies when that file is under `docs/**` or is an instruction/governance surface that opts into policy-doc validation.
- Fails when those frontmatter key names appear as body headings or generated Table of Contents entries representing metadata as prose sections.

Out of scope:

- Documents intentionally explaining frontmatter schema format.
- Escaped examples or fenced code blocks containing frontmatter keys.
- Generated API/reference docs unless explicitly opted in.

Required fixture:

```text
tests/fixtures/learnings/coderabbit-frontmatter-policy.csv
```

Phase 1A/1B must not mark this learning as `enforced`. Phase 1A must import it deterministically and Phase 1B must be able to emit the exact-file gate finding. The durable promotion to validator, regression test, and `promotionStatus: enforced` belongs to the first promotion slice.

Expected first imported ID:

```text
coderabbit.coding-harness.docs-frontmatter-machine-readable
```

### Suppression and override contract

The first implementation does not need full override evaluation, but the spec must reserve the shape so high-usage false positives have a safe path.

```json
{
  "schemaVersion": "learning-override/v1",
  "learningId": "coderabbit.coding-harness.docs-frontmatter-machine-readable",
  "scope": "docs/example.md",
  "decision": "suppress",
  "reason": "This document intentionally explains metadata format as user-facing documentation.",
  "reviewer": "jscraik",
  "expires": "2026-05-28"
}
```

Rules:

- Overrides require a reason.
- Overrides should be scoped as narrowly as possible.
- Overrides must never execute commands from learning text.
- Phase 1B may report `suppressible: false` or `overrideSupport: "reserved"` until override evaluation is implemented.

## Skillify Promotion Path

Some learnings describe repeatable operator workflows rather than static rules.
Those learnings are eligible for `operator_skill` promotion and should be
converted into in-house skills with `$skillify` instead of being forced into
gates.

Use `operator_skill` only when all of the following are true:

- The learning describes a multi-step agent or operator workflow.
- The workflow has repeated review, validation, or delivery value.
- The behavior cannot be fully enforced by a deterministic gate or test.
- The workflow has clear inputs, outputs, constraints, and validation evidence.
- The workflow can be generalized without embedding private session data,
  credentials, raw transcripts, or machine-local account details.

Do not use `operator_skill` for atomic rules. Single-rule learnings such as
nullable fields, package-manager boundaries, docs-gate command selection, or
shareable-artifact path privacy should become validators, tests, scaffold
defaults, or review-context facts.

Promotion output for an `operator_skill` candidate must include:

- Proposed skill name.
- Destination category and canonical source location.
- Source evidence references.
- Required inputs.
- Deliverables.
- Constraints and failure boundaries.
- Validation or audit command.
- Runtime projection expectation when the skill must be available outside the
  source repository.

Example promotion candidate:

```json
{
  "id": "learnings.review.feedback-verification",
  "recommendedTarget": "operator_skill",
  "recommendedSkill": {
    "name": "verify-and-fix-review-feedback",
    "destination": "/Users/jamiecraik/dev/agent-skills/Skills/agent-ops/verify-and-fix-review-feedback/SKILL.md",
    "reason": "Repeated workflow verifies CodeRabbit/Codex findings against current evidence before patching.",
    "requiredInputs": [
      "review findings",
      "target files or PR",
      "repo validation contract"
    ],
    "deliverables": [
      "validity decision per finding",
      "minimal fixes for valid findings",
      "validation evidence",
      "response plan for stale or invalid feedback"
    ]
  }
}
```

Initial skillification candidates:

- `verify-and-fix-review-feedback` for repeated CodeRabbit/Codex review-thread
  verification and remediation.
- `coding-harness-learning-promotion` for turning imported learning evidence
  into gates, tests, scaffold rules, review context, or skills.
- `coding-harness-pr-thread-burndown` for PR-level review-thread, CI, and
  validation closure loops.

## Review Context Pack

The review context pack must be deterministic and safe to attach to PR workflows.

Canonical output shape:

```json
{
  "schemaVersion": "review-context/v1",
  "repo": "coding-harness",
  "changedFiles": [],
  "generatedAt": "2026-04-28T00:00:00.000Z",
  "applicableLearnings": [],
  "validationPlan": [],
  "ciOwnership": {},
  "artifactProvenance": []
}
```

The pack should prioritize concise summaries over full learning text. Full text remains available through evidence references.

Review-context generation must be deterministic:

- Sort applicable learnings by severity, usage descending, then ID.
- Include at most one concise summary per learning ID.
- Include evidence references, not full external raw exports, unless `--verbose` is passed.
- Mark stale or local-only sources clearly so PR artifacts do not pretend they are live CodeRabbit links.

## Validation Plan Contract

`validation-plan` must prefer repository-defined commands and must not invent npm defaults.

Required recommendation examples:

- Source or policy files changed: `bash scripts/validate-codestyle.sh --fast`.
- CircleCI parity or migration surface changed: `pnpm test:ci`.
- Runtime or artifact behavior changed: `pnpm test:deep`.
- Package/security/audit surface changed: `pnpm audit`, classified as network-required.

The output must distinguish:

- `required`: should run before handoff,
- `recommended`: useful but not blocking,
- `networkRequired`: cannot be proven offline,
- `blocked`: command could not run due environment capability.

Validation-plan must not claim a command passed. It only recommends commands and classifies environment needs. Actual command outcomes remain validation evidence from the runner.

## Artifact Provenance Registry

Add a registry surface, either in `.harness/artifact-provenance.json` or inside `harness.contract.json` if the contract schema is extended.

Initial shape:

```json
{
  "schemaVersion": "artifact-provenance/v1",
  "artifacts": [
    {
      "path": "scripts/codex-preflight.sh",
      "source": "src/templates/codex-preflight.sh",
      "checkCommand": "node scripts/sync-codex-preflight.cjs --check",
      "writeCommand": "node scripts/sync-codex-preflight.cjs --write",
      "reviewPolicy": "review-source-and-sync-generated-copy"
    }
  ]
}
```

The registry must support generated outputs, runtime mirrors, captured artifacts, and gitignored artifact classes.

Provenance rule classes:

- `runtime_mirror`: committed file mirrors a template and must be byte-identical after sync.
- `generated_snapshot`: generated output should be regenerated, not hand-edited.
- `captured_artifact`: may contain recording-specific paths or data and should not be treated as runtime config.
- `gitignored_artifact`: should not be committed; review should rely on CI logs or uploaded artifacts.

`artifact-gate` should start as advisory unless a registry entry declares `enforcement: "required"`.

## CI Ownership Contract

CI ownership should become machine-readable so agents and reviewers do not re-litigate provider responsibility.

Proposed contract block:

```json
{
  "ciOwnership": {
    "primaryPrGate": "circleci",
    "reviewProvider": "coderabbit",
    "securityChecks": ["semgrep-cloud-platform/scan"],
    "fallbackWorkflows": [
      {
        "path": ".github/workflows/pr-pipeline-bridge.yml",
        "trigger": "workflow_dispatch",
        "purpose": "emergency fallback only"
      }
    ]
  }
}
```

`ci-ownership-gate` must flag attempts to:

- turn fallback workflows into primary automatic PR gates without a contract update,
- remove external required checks from required-check manifests,
- collapse independent CodeRabbit review into self-review,
- misclassify GitHub Actions as primary PR governance when CircleCI owns the PR lane.

The CI ownership contract must support consumer repositories that choose different providers. The coding-harness repo may default to CircleCI, but scaffolded repos must either inherit explicit harness defaults or declare their own provider contract.

## Scaffold and Downstream Project Behavior

High-confidence learnings should improve `harness init` and downstream templates.

Initial scaffold promotion targets:

- Prefer `pnpm` where the repo contract says pnpm.
- Scaffold `scripts/harness-cli.sh` as a repo-local wrapper when appropriate.
- Keep `.npmrc` scope-only and auth-free.
- Package `CODESTYLE.md` as a real checked-in template, not a developer-home symlink.
- Make `scripts/check-environment.sh` prefer repo-local CLI before global fallback.
- Persist `toolingPolicy` in `harness.contract.json`.
- Keep project type detection pure and read-only.
- Sync `.codex/environments/environment.toml` from project scripts only when harness owns the generated block.

A later implementation plan should add fixture consumer repos for `cli-ts`, `vite`, `library`, `tauri`, and `unknown` project types.

## North-Star Feedback Metrics

The feature must produce metrics that show whether learning operations reduce review/rework loops.

Canonical artifact:

```text
.harness/metrics/north-star-feedback.json
```

Initial shape:

```json
{
  "schemaVersion": "north-star-feedback/v1",
  "learningHits": 0,
  "learningGateBlocks": 0,
  "learningGateWarnings": 0,
  "highUsageLearningsUnenforced": 0,
  "promotedLearnings": 0,
  "reviewThreadCount": null,
  "validationReruns": null
}
```

Metrics should be additive and safe when GitHub/CodeRabbit live data is unavailable.

## Interfaces and Integration Points

### Existing gates

- `drift-gate` may consume learning-derived durable guardrail summaries in a later phase.
- `review-gate` may require review context pack evidence for governed north-star surfaces.
- `doctor` may report missing or stale learning import artifacts.
- `preflight-gate` may call `validation-plan` or `harness learnings gate` in a later phase.

Integration order:

1. `learnings import` and `learnings gate` operate standalone.
2. `review-context` can consume learning artifacts after Phase 1.
3. `review-gate` can require review context only after the review-context artifact is stable.
4. `preflight-gate` integration should wait until false-positive behavior is measured.
5. `drift-gate` should consume only promoted/enforced learning summaries, not raw CSV rows.

### Existing contract surfaces

- `harness.contract.json` may need schema extensions for `ciOwnership`, `artifactProvenance`, and learning-source configuration.
- `productSurface.surfaces` should include these new command/gate surfaces with north-star contribution statements when implemented.

### External tools

- `coderabbit` CLI is live for auth/review/stats, but current CLI version does not expose row-level learnings.
- GitHub PR URLs can be synthesized from CSV fields.
- Future CodeRabbit live provider can implement the same `LearningSourceRef` contract.

## Failure Model and Recovery

| Failure | Classification | Required behavior |
| --- | --- | --- |
| CSV missing | validation error | return non-zero with path and fix hint |
| CSV headers invalid | validation error | list missing headers |
| CSV row malformed | partial import | skip row, report warning, continue unless all rows invalid |
| source path outside cwd where unsafe | validation error | reject unless explicit absolute path allowed |
| learning source stale | warning | mark `live: false`, continue |
| CodeRabbit CLI unavailable | info/warning | CSV provider still works; live companion unavailable |
| no matching learnings | pass | emit empty finding list |
| high-usage learning unclassified | warning | include in promotion candidates |
| artifact provenance registry missing | warning initially | do not fail until registry is adopted by contract |
| CI ownership contract missing | warning initially | fail only after schema/contract phase promotes it |

### Phase 1A failure semantics

| Scenario | Command | Exit code | Status | Error code | Retry guidance |
| --- | --- | ---: | --- | --- | --- |
| Missing CSV source | `harness learnings import` | `1` | `fail` | `learnings.source_missing` | Fix `--source` and rerun import. |
| Invalid CSV headers | `harness learnings import` | `1` | `fail` | `learnings.invalid_headers` | Export the expected CodeRabbit CSV columns and rerun import. |
| All rows invalid | `harness learnings import` | `1` | `fail` | `learnings.no_importable_rows` | Fix source rows or repository filter before retrying. |
| Partial import with warnings | `harness learnings import` | `0` | `pass_with_warnings` | `learnings.partial_import` | Review warnings; rerun with corrected CSV when needed. |
| Explicit snapshot output | `harness learnings import` | `2` | `usage_error` | `learnings.snapshot_deferred` | Use `.harness/learnings/coderabbit.local.json` until snapshot writing is planned. |
| Deferred gate subcommand in Phase 1A | `harness learnings gate` | `2` | `usage_error` | `learnings.gate_deferred` | Run import only; gate belongs to Phase 1B. |
| Missing learning artifact in gate phase | `harness learnings gate` | `1` | `fail` | `learnings.artifact_missing` | Run the expected import command first. |

### Rollback behavior

- Import artifacts are replaceable generated evidence; rollback means restoring the previous artifact or deleting the generated artifact.
- Gate behavior must remain deterministic if the learning artifact is absent: follow the Phase 1A failure semantics matrix for the command context, not a crash.
- Promotion status changes are policy-affecting and must be reviewed like code when committed.
- Scaffold default promotions must include fixture tests before they are treated as enforced.

### Staleness policy

- CSV imports older than a configurable freshness window should warn, not fail.
- Freshness warnings must include the source import timestamp and recommended refresh action.
- Stale CSV data can still enforce already-promoted learnings because the enforced rule lives in code/tests, not the CSV.

## Security and Privacy

- Do not import token values, secrets, browser caches, or local auth state.
- Redact absolute local paths in shareable artifacts unless the artifact is explicitly local-only.
- Preserve CSV source URI in local artifacts; use repo-relative or synthesized GitHub URLs in committed artifacts.
- Do not read CodeRabbit browser IndexedDB caches as a data source.
- Treat imported learning text as untrusted input; escape or encode when rendering markdown/JSON output.
- Do not execute commands embedded in learning text.

Shareable or committed artifacts must not contain machine-specific absolute source paths. Local-only artifacts may preserve absolute CSV paths for traceability, but PR-ready artifacts must use repo-relative paths, synthesized GitHub URLs, or a sanitized `sourceLabel`.

## Acceptance Criteria

### Import

- Given a valid CodeRabbit CSV, `harness learnings import --provider coderabbit-csv --repo coding-harness --json` emits normalized learning items and import summary.
- The top coding-harness frontmatter learning preserves usage `516`, file path, PR `148`, and synthesized GitHub URL.
- CSV sources are marked `live: false`.
- `coderabbit stats` may be recorded only as live companion metadata and not as row-level evidence.
- Re-importing the same CSV is idempotent: generated IDs and item ordering remain stable.
- Import writes atomically so interrupted writes do not leave partial JSON.
- Phase 1A does not call `coderabbit stats`.
- Default import output is `.harness/learnings/coderabbit.local.json`.
- When `--output` resolves to `.harness/learnings/coderabbit.snapshot.json`, Phase 1A returns a usage error and writes nothing.
- Import output uses the `learnings-import-result/v1` envelope.

### Gate

- `harness learnings gate --files docs/ai-assistant-security-policy.md --json` emits a finding for the high-usage frontmatter metadata learning.
- The finding uses `GateResult` shape and includes CSV row plus GitHub PR evidence references.
- Low-usage fuzzy matches do not fail the gate by default.
- Missing source artifacts produce a clear validation error with the expected import command.
- Phase 1B exact-file matching does not block on keyword-only fuzzy matches.

### Promotion

- `harness learnings promote --min-usage 25 --json` returns promotion candidates sorted by usage.
- The frontmatter learning recommends a docs-surface validator and regression test.
- Validation command-selection learnings recommend `validation-plan` rules.
- Generated artifact learnings recommend artifact provenance rules.
- The first mandatory promotion is identified as the frontmatter metadata docs-surface rule.
- Promotion work is not required for Phase 1A or Phase 1B.
- Promotion output uses the `learning-promotion-candidates/v1` envelope.

### Review context

- `harness review-context --files <changed-files> --json` includes applicable learnings and validation plan entries.
- The output avoids dumping full CSV text when concise summaries and evidence references are enough.

### Validation plan

- `harness validation-plan --files <changed-files> --json` recommends repo-canonical commands.
- Network-dependent commands are classified separately.
- The output can explain partial validation when tests pass but audit is blocked by registry access.

### Artifact and CI ownership

- Artifact provenance can identify generated/runtime mirror files and point to source plus sync commands.
- CI ownership can identify CircleCI as primary PR gate and GitHub Actions fallback workflows as manual-only where configured.

### Metrics

- `harness north-star-feedback --json` reports high-usage unenforced learnings and promoted learning counts.
- Metrics do not require live CodeRabbit learning access.

### Planning readiness

- The first implementation plan can be split into Phase 1A import schema/parser and Phase 1B exact-file gate without needing further product decisions.
- Later phases remain explicitly deferred and do not block the Phase 1 implementation slice.

## Test Matrix

### Unit tests

- CSV parser validates headers and preserves row numbers.
- ID generation is deterministic.
- Usage parsing handles blank and numeric values.
- Optional field normalization handles blank `File`, blank `Pull Request`, blank `URL`, `Usage=0`, and `Last Used=Never`.
- Repository filtering distinguishes skipped rows from unsupported repository warnings.
- GitHub PR URL synthesis is correct for `jscraik/<repo>`.
- Embedded `Applies to <path-or-glob> :` targets populate `targetPatterns`.
- Classification heuristics route known examples correctly.
- Matching prioritizes exact file path over keyword-only matches.
- Severity thresholds match the usage table.
- Promotion candidates sort by usage and exclude enforced items by default.

### Command tests

- `learnings import` succeeds on fixture CSV.
- `learnings import` fails on missing file.
- `learnings gate` emits `pass` for no matches.
- `learnings gate` emits `fail` for high-usage exact guardrail match.
- `learnings promote` returns expected target recommendations.
- `review-context` writes the requested output artifact.
- `validation-plan` classifies audit as network-required.
- `learnings import` is idempotent across repeated runs.
- `learnings gate` reports stale source warnings without blocking exact promoted rules.
- `learnings import` defaults to `.harness/learnings/coderabbit.local.json`.
- `learnings import --repo coding-harness` counts non-matching repository rows as skipped without warning spam.
- `learnings import` accepts an explicit absolute CSV source path for local artifacts.
- `learnings import` rejects explicit snapshot output in Phase 1A; when snapshot writing is implemented later, it must produce no absolute local paths.
- frontmatter fixture fails only when metadata keys appear as headings or TOC entries outside code fences.

### Integration tests

- Fixture CSV containing the top CodeRabbit frontmatter learning produces the expected gate finding.
- Fixture changed-file set containing CI files produces CircleCI parity validation recommendations.
- Fixture generated artifact path produces provenance warning once registry is configured.

### Scaffold tests

- Consumer fixture repos prove `.npmrc`, local harness wrapper, `CODESTYLE.md`, and `environment.toml` defaults are generated correctly after promotions land.

## Rollout Plan

### Phase 1A: Import foundation

- Implement normalized learning schema.
- Implement CodeRabbit CSV importer.
- Implement `harness learnings import`.
- Implement deterministic ID generation and stable artifact ordering.
- Implement local artifact default at `.harness/learnings/coderabbit.local.json`.
- Implement atomic artifact writes.
- Add fixture tests using the supplied CodeRabbit CSV shape.

### Phase 1B: Exact-file gate

- Implement `harness learnings gate` for exact file and high-confidence matches.
- Add fixture tests using the frontmatter learning.
- Emit advisory warnings for stale source metadata.
- Do not implement keyword-only blocking.

### Phase 2: Promotion queue

- Implement `harness learnings promote`.
- Add promotion status fields.
- Promote the top frontmatter learning into a permanent docs-surface rule.

### Phase 3: Review context and validation plan

- Implement `review-context`.
- Implement `validation-plan` from changed files and learned command rules.
- Integrate with PR handoff docs or review-gate evidence.
- Keep review-gate enforcement advisory until the review-context artifact has stable tests.

### Phase 4: Provenance, CI ownership, and scaffold defaults

- Add artifact provenance registry and `artifact-gate`.
- Add CI ownership contract and `ci-ownership-gate`.
- Add scaffold fixture coverage for high-confidence defaults.
- Keep consumer-repo provider defaults configurable, not hardcoded to coding-harness' CircleCI posture.

### Phase 5: North-star feedback

- Implement feedback metrics artifact.
- Track high-usage unenforced learnings and promoted count.
- Add optional GitHub/CodeRabbit live companion data where available.

## Open Questions

1. Should `.harness/learnings/coderabbit.json` be committed for shared repo evidence, or should committed artifacts use a sanitized `.snapshot.json` while local imports remain gitignored?
2. Should `harness learnings gate` be advisory by default until at least one promotion is enforced, or should high-usage exact matches fail immediately?
3. Should learning classification overrides live in `harness.contract.json`, `.harness/learnings/overrides.json`, or both?
4. Should synthesized GitHub PR URLs assume `jscraik/<repository>` for all imported rows, or should owner be configurable?
5. How should cross-repo learnings from Agent-Skills or X-writer be promoted into global scaffold defaults without overfitting coding-harness?
6. Should `validation-plan` become part of `verify-work.sh`, or remain a CLI advisory command first?
7. Should the first import artifact be gitignored by default, with only promoted summaries committed?
8. Should `harness learnings gate` discover changed files from git by default, or require explicit `--files` in Phase 1 to avoid git dependency surprises?
9. Should classification overrides be allowed before Phase 2, or deferred until real false positives appear?
10. Should the command namespace be implemented first, or should top-level aliases be used if the CLI registry does not support nested command families cleanly?

## Definition of Done

- CodeRabbit CSV learnings can be imported into normalized harness learning data.
- High-usage learnings can produce deterministic gate findings for changed files.
- Promotion candidates identify target enforcement surfaces and tests.
- Review context generation exposes applicable learnings for a PR.
- Validation planning recommends exact repo-canonical commands and network blockers.
- Artifact provenance and CI ownership have clear contract shapes for follow-on implementation.
- North-star feedback metrics can report repeated-learning pressure and promotion progress.
- Documentation explains that repeated learnings should become guardrails, context facts, scaffold defaults, regression tests, or explicit non-goals.

## Planning Readiness Recommendation

Ready for `he-plan` with Phase 1A scope only.

Do not plan all phases as one implementation batch. The planning slice should start with Phase 1A only:

1. Normalized learning schema.
2. CodeRabbit CSV parser/importer.
3. `harness learnings import`.
4. Deterministic IDs and stable ordering.
5. Atomic local artifact writes.
6. Import result JSON envelope.
7. Fixture tests for the CodeRabbit CSV shape.
8. Minimal docs for local CSV provenance and non-live CodeRabbit limitations.

Phase 1B should be planned only after Phase 1A is stable:

1. Exact-path matcher.
2. `harness learnings gate`.
3. `GateResult` output.
4. Fixture tests for the high-usage frontmatter learning.
5. Missing-artifact and stale-source behavior.

Planning should explicitly defer:

- live CodeRabbit learning provider,
- review-gate mandatory integration,
- scaffold fixture matrix,
- CI ownership schema migration,
- north-star feedback dashboard,
- artifact provenance enforcement beyond contract shape.
