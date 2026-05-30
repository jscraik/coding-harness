---
date: 2026-05-30
report_type: shallow-modules-audit
status: advisory
repo: coding-harness
branch: codex/jsc-363-intermediary-receipt-coverage
---

# Shallow Modules Audit

## Table of Contents

- [Purpose](#purpose)
- [Method](#method)
- [Ranking](#ranking)
- [Findings](#findings)
- [Implementation Follow-up](#implementation-follow-up)
- [Lower-priority Intentional Facades](#lower-priority-intentional-facades)
- [Validation](#validation)

## Purpose

Find modules whose interface makes callers or maintainers learn more concepts
than the implementation hides. Rank them by likely cognitive-load reduction,
not by aesthetic neatness or file size alone.

The north-star frame is PR lead time: a deeper module should reduce review or
rework loops, manual glue, or repeated navigation through many thin files.

## Method

- Read the repo guidance, CODESTYLE front door, architecture skill, north-star
  contract, agent-first status, and relevant codestyle modules.
- Scanned production TypeScript under `src/commands` and `src/lib` for small
  exported modules, re-export-only modules, duplicated command-spec shapes, and
  pass-through wrappers.
- Inspected the highest-signal candidates by line reference.
- Treated existing module-boundary ratchets as evidence when a shallow facade is
  intentionally preserved for compatibility.

Scoring:

- `1/5`: very shallow. Interface surface is comparable to, or larger than, the
  functionality hidden.
- `2/5`: shallow but possibly justified by compatibility or migration pressure.
- `3/5`: moderate depth. Interface hides some useful behavior, but leaks enough
  orchestration/configuration to slow callers.
- `4/5`: deep enough for now.
- `5/5`: very deep. Small coherent interface hides substantial behavior.

## Ranking

| Rank | Module | Score | Cognitive-load reduction | Why it ranks here |
| --- | --- | --- | --- | --- |
| 1 | `src/lib/contract/types-core.ts` | `1/5` | Very high | A single schema/type module exports a large policy universe and hides almost no behavior. |
| 2 | `src/lib/cli/registry/*-command-spec.ts` plus `command-specs-core.ts` | `2/5` | High | Dozens of command adapters repeat the same interface and require manual registry wiring. |
| 3 | `src/lib/preflight/validator-core.ts` | `3/5` | High | The public entrypoint is useful, but check construction, policy hooks, path handling, and rendering-adjacent diagnostics live in one large orchestration module. |
| 4 | `src/lib/evidence/loader.ts` | `1/5` | Medium | The module name promises evidence loading but exports generic filesystem helpers. |
| 5 | `src/lib/runtime/git-environment.ts` and `src/lib/root-hygiene/git-env.ts` | `1/5` | Medium | Two modules encode overlapping git-environment sanitation rules with different semantics. |
| 6 | `src/lib/init/scaffold-*-templates.ts` aggregation layer | `2/5` | Medium | Scaffold template ownership is split between pure barrels and template renderers, so callers still need to know file-family layout. |
| 7 | `src/lib/project-brain/*-presenter.ts` | `2/5` | Low-medium | Human rendering modules are small and cohesive, but duplicate the same line-buffer/presentation pattern. |
| 8 | `src/lib/output/normalise-core-v2.ts` and `normalise.ts` | `2/5` | Low | These are shallow by design and ratcheted as compatibility export surfaces, so deepening should be minimal. |

## Findings

### 1. Contract Type Core

Files:

- `src/lib/contract/types-core.ts:1`
- `src/lib/contract/index.ts:31`
- `src/lib/contract/types.ts:1`

Interface surface:

- Exported functions: none in the inspected opening slice; the module is mostly
  constants, types, interfaces, and default contract data.
- Public types: very large. The scan found `1776` lines and `159` exported
  public declarations in `types-core.ts`.
- Configuration: embeds contract policy domains such as risk tier, docs gate,
  UI loop, runtime, memory, observability, package manager, CI ownership, and
  more.
- Dependencies: imports shared required-check and tooling-baseline policy
  constants at `types-core.ts:1`.

Hidden functionality:

- Low. The module mostly names and groups schema/configuration concepts. It does
  not encapsulate parsing, validation, migration, or policy decision behavior.

Evidence of shallowness:

- `src/lib/contract/types.ts:1` is a direct re-export of `types-core.ts`.
- `src/lib/contract/index.ts:31` starts a very broad public type export block
  that exposes callers to policy-family internals rather than a smaller
  contract interface.
- The interface is so wide that understanding a contract change requires
  scanning a global type ledger instead of the affected policy family.

Deepness score:

- `1/5`. Interface complexity is extremely high while hidden behavior is low.
  The module is a schema dumping ground more than a leverage point.

Better design:

- Split `types-core.ts` into policy-family modules under `src/lib/contract/`
  such as `docs-gate-types.ts`, `tooling-policy-types.ts`,
  `ci-policy-types.ts`, and `runtime-policy-types.ts`.
- Keep `src/lib/contract/types.ts` as the stable compatibility facade, but make
  it re-export family modules. This preserves imports while giving maintainers a
  locality map.
- Move default policy objects beside the family type they configure, then keep
  `DEFAULT_CONTRACT` composition in one explicit assembly module.

North-star link:

- Reduces review navigation for contract-policy changes and lowers the chance
  that agents touch unrelated contract families while fixing one policy surface.

Testing effect:

- Existing contract tests can keep importing from `src/lib/contract/types.js`.
  Add module-boundary ratchets that prevent the family files from becoming new
  dumping grounds.

Risk:

- Medium. This is a public type surface, so the refactor should be
  compatibility-first with no emitted schema change.

Tracking:

- Needs a Linear follow-up if pursued because the change is broad and should be
  reviewed as an architecture/decomposition slice.

### 2. Command Spec Adapter Family

Files:

- `src/lib/cli/registry/command-specs-core.ts:38`
- `src/lib/cli/registry/prompt-gate-command-spec.ts:5`
- `src/lib/cli/registry/plan-gate-command-spec.ts:5`
- `src/lib/cli/registry/gap-case-command-spec.ts:5`
- `src/lib/cli/registry/observability-gate-command-spec.ts:5`
- `src/lib/cli/registry/verify-work-command-spec.ts:5`
- `src/lib/cli/registry/types.ts:1`

Interface surface:

- Exported functions: one factory per command adapter, commonly
  `create<Name>CommandSpec(): CommandSpec`.
- Public types: a small `CommandSpec` interface with name, aliases, summary,
  error label, optional example, and `execute`.
- Configuration: command name, summary, aliases, examples, error label, and
  argument forwarding.
- Dependencies: each small adapter imports a command runner or CLI parser. The
  registry imports all factories and manually assembles `COMMAND_SPECS`.

Hidden functionality:

- Low to moderate. Each adapter hides only a few lines of command metadata and
  direct forwarding to a runner. The aggregate registry hides dispatch,
  capability catalog generation, fuzzy matching, and help rows.

Evidence of shallowness:

- There are `51` `*-command-spec.ts` files under `src/lib/cli/registry`.
- Many files repeat the same shape: import runner, return `{ name, summary,
  errorLabel, execute }`.
- `command-specs-core.ts:38` through `command-specs-core.ts:90` imports dozens
  of factories, then `command-specs-core.ts:92` manually assembles the command
  list.
- Simple adapters like `prompt-gate-command-spec.ts:5`,
  `plan-gate-command-spec.ts:5`, and `gap-case-command-spec.ts:5` expose an
  entire module per four-field object.

Deepness score:

- `2/5`. The registry as a whole is useful, but the per-command modules are
  often thinner than the concept cost they add.

Better design:

- Add a small `defineCommandSpec` helper for simple pass-through commands:
  `defineCommandSpec({ name, summary, errorLabel, runner })`.
- Keep bespoke modules only where parsing or composition is non-trivial, such as
  `upgrade`, `preflight-gate`, `doctor`, or UI commands.
- Replace the import-and-call boilerplate in `command-specs-core.ts` with a
  grouped registry table for simple commands plus explicit entries for complex
  commands.

North-star link:

- Reduces command-addition and command-review cost. Agents can inspect one
  registry pattern instead of hopping through dozens of nearly identical files.

Testing effect:

- Command registry tests can assert the same command catalog. Add one test for
  `defineCommandSpec` forwarding and one fixture proving metadata for a simple
  command remains unchanged.

Risk:

- Medium-low. The behavior is mostly metadata and forwarding, but the command
  catalog is a public agent-facing surface.

Tracking:

- Track as a refactor follow-up if more command migrations are planned. The
  highest leverage is before adding more CLI commands.

### 3. Preflight Validator Core

Files:

- `src/lib/preflight/validator-core.ts:35`
- `src/lib/preflight/validator-core.ts:71`
- `src/lib/preflight/validator-core.ts:89`
- `src/lib/preflight/validator.ts:1`
- `src/lib/contract/validator.ts:6`

Interface surface:

- Exported functions/types: public entrypoint through `validator.ts` and
  compatibility re-export through `contract/validator.ts`; `validator-core.ts`
  exports the preflight options type and the preflight runner.
- Public types: `PreflightGateOptions`, `PreflightCheck`, hook decision and
  result types from `types.ts`.
- Configuration: check registry, optional files, contract path, max tier,
  required/optional mode, hook extension policy, and admission declarations.
- Dependencies: filesystem reads, contract loading, risk-tier policy,
  harness-version coherence, and preflight type contracts.

Hidden functionality:

- High in volume but mixed in locality. The file contains many checks and the
  orchestration that runs them.

Evidence of shallowness:

- The public runner is valuable, but the module leaks check-family details into
  one 1056-line file.
- Individual checks such as `fileSizeCheck` at `validator-core.ts:35`,
  `contractExistsCheck` at `validator-core.ts:71`, and `riskTierCheck` at
  `validator-core.ts:89` are local implementation details embedded beside the
  runner instead of registered through a deeper check-family interface.
- `src/lib/preflight/validator.ts:1` and `src/lib/contract/validator.ts:6` are
  compatibility re-exports, so callers may reach the same behavior through
  multiple shallow paths.

Deepness score:

- `3/5`. The top-level runner hides meaningful behavior, but the module itself
  is too broad for maintainers. It is deeper than a pass-through file, yet still
  leaks orchestration structure and check implementation locality.

Better design:

- Keep `runPreflightGate` as the public interface.
- Move check definitions into `src/lib/preflight/checks/` grouped by concern:
  filesystem, contract, git, version, policy, and hook extension checks.
- Introduce a `buildPreflightCheckRegistry(options)` module that owns check
  ordering and mode-specific inclusion.

North-star link:

- Preflight is a common closeout and bootstrap lane. Making checks local to
  concern reduces review time when one check changes and lowers accidental
  breakage across unrelated checks.

Testing effect:

- Existing preflight tests should continue through `runPreflightGate`.
  Add focused tests for registry composition and one representative check module.

Risk:

- Medium. Preflight behavior is a repo bootstrap gate. Refactor in small steps
  and keep output snapshots or JSON result fixtures stable.

Tracking:

- Good candidate for a dedicated Linear issue because it touches a required
  validation path.

### 4. Evidence Loader Filesystem Helpers

Files:

- `src/lib/evidence/loader.ts:8`
- `src/lib/evidence/loader.ts:19`
- `src/lib/evidence/loader.ts:31`
- `src/lib/evidence/loader.ts:39`
- `src/lib/evidence/loader.ts:51`

Interface surface:

- Exported functions: `fileExists`, `getFileSize`, `resolvePath`,
  `getRealPath`, `getParentRealPath`.
- Public types: none.
- Configuration: caller provides raw paths and base directories.
- Dependencies: `node:fs` and `node:path`.

Hidden functionality:

- Very low. The module wraps `existsSync`, `statSync`, `resolve`, `normalize`,
  `realpathSync`, and `dirname` with catch-and-null behavior.

Evidence of shallowness:

- Function names mirror underlying Node APIs with little added domain policy.
- `resolvePath` normalizes and resolves, but does not encode the repo-contained
  evidence invariant expected elsewhere in runtime/evidence work.
- The module name says `evidence/loader`, but the interface exposes generic
  filesystem primitives rather than loading or validating an evidence object.

Deepness score:

- `1/5`. Interface surface is five helper functions; hidden functionality is
  essentially standard library forwarding.

Better design:

- Replace or deepen this module into an `EvidencePathResolver` that returns a
  typed result such as `{ status, absolutePath, realPath, sizeBytes, blocker }`.
- Encode repo containment, parent existence, symlink behavior, and display-path
  sanitation in one call.
- Keep small private helpers inside that module rather than exporting generic
  wrappers.

North-star link:

- Runtime evidence and receipt work repeatedly depends on path safety. A deeper
  path resolver would reduce repeated reviewer questions about local path,
  symlink, and missing-file handling.

Testing effect:

- Add table tests for missing file, missing parent, symlink, outside-repo path,
  and valid file cases. Callers test one typed result instead of mocking five
  helper functions.

Risk:

- Low-medium. The behavior is small, but path semantics are security-adjacent.

Tracking:

- Track with runtime evidence or artifact-surface follow-up work.

### 5. Duplicate Git Environment Sanitizers

Files:

- `src/lib/runtime/git-environment.ts:2`
- `src/lib/root-hygiene/git-env.ts:2`
- `src/lib/runtime/local-runtime-card.ts:2`
- `src/lib/root-hygiene/git-tracked-paths.ts:3`
- `src/lib/root-hygiene/repository-identity.ts:5`

Interface surface:

- Exported functions: `gitEnvironmentForRepoRoot()` and
  `rootHygieneGitEnv(env = process.env)`.
- Public types: `NodeJS.ProcessEnv`.
- Configuration: one function accepts no env parameter; one accepts an env
  source.
- Dependencies: process environment only.

Hidden functionality:

- Low. Both modules sanitize git-related environment variables before spawning
  git subprocesses.

Evidence of shallowness:

- `gitEnvironmentForRepoRoot` deletes only `GIT_COMMON_DIR`, `GIT_DIR`,
  `GIT_INDEX_FILE`, and `GIT_WORK_TREE`.
- `rootHygieneGitEnv` drops every key starting with `GIT_`.
- The same policy question, "which git environment is safe for repo-scoped git
  commands?", is answered twice with different semantics.

Deepness score:

- `1/5`. Two small interfaces hide little behavior and force maintainers to
  choose between subtly different sanitizers.

Better design:

- Create one shared `src/lib/git/safe-env.ts` module with an explicit mode:
  `sanitizeGitEnvironment(env, { policy: "minimal" | "strict" })`.
- Re-export compatibility functions from the old modules while delegating to
  the shared implementation.
- Document which policy runtime-card and root-hygiene need.

North-star link:

- Reduces repeated environment-drift bugs and review comments around git command
  safety in worktrees and hooks.

Testing effect:

- One shared test matrix can cover all `GIT_*` variables, minimal-vs-strict
  behavior, undefined values, and preservation of non-git env.

Risk:

- Low if compatibility wrappers remain; medium if call sites change semantics.

Tracking:

- Can be a small opportunistic refactor when touching either runtime-card or
  root-hygiene git execution.

### 6. Init Scaffold Template Aggregation

Files:

- `src/lib/init/scaffold-ci-templates.ts:1`
- `src/lib/init/scaffold.ts:14`
- `src/lib/init/scaffold.ts:28`
- `src/lib/init/scaffold-root-templates.ts:38`
- `src/lib/init/scaffold-doc-templates.ts:34`

Interface surface:

- Exported functions: a mixture of pure re-exports in
  `scaffold-ci-templates.ts`, packaging/file renderers in
  `scaffold-root-templates.ts`, and long-form Markdown renderers in
  `scaffold-doc-templates.ts`.
- Public types: template render input types, `Template`, `TemplateRenderContext`,
  and `CIProvider`.
- Configuration: provider selection, required checks, package metadata,
  codestyle file list, generated doc text, commands, branch prefix, and tooling
  policy text.
- Dependencies: filesystem reads, project type detection, policy constants, and
  generated template registry.

Hidden functionality:

- Moderate, but split unevenly. Some modules are just barrels; others contain
  hundreds of lines of embedded template text.

Evidence of shallowness:

- `scaffold-ci-templates.ts:1` through `scaffold-ci-templates.ts:20` is pure
  re-export forwarding.
- `scaffold.ts:28` re-exports types and template registry values for
  convenience while also owning package-json probing and init helper logic.
- Callers need to understand file-family names (`ci`, `root`, `doc`) and the
  underlying render function names rather than one cohesive scaffold plan.

Deepness score:

- `2/5`. The scaffold subsystem does real work, but the aggregation layer is
  shallow and leaks template organization.

Better design:

- Add a `ScaffoldPlan` builder that returns typed template groups:
  `rootFiles`, `ciFiles`, `docFiles`, `scriptFiles`, and `policyFiles`.
- Make the current `scaffold-*-templates.ts` files private implementation
  modules behind that plan.
- Keep `scaffold.ts` focused on target inspection and plan construction.

North-star link:

- Brownfield installability is a core product canary. A deeper scaffold plan
  would make init changes easier to review and reduce drift between generated
  docs, scripts, checks, and policy files.

Testing effect:

- Replace scattered template assertions with plan-level tests:
  given project/provider/options, expected emitted file set and policy-derived
  values.

Risk:

- Medium. Init scaffolding is public product behavior and downstream template
  diffs can be noisy.

Tracking:

- Track under portable installability or init-scaffold roadmap work.

### 7. Project Brain Human Presenters

Files:

- `src/lib/project-brain/status-presenter.ts:4`
- `src/lib/project-brain/query-presenter.ts:4`
- `src/lib/project-brain/stale-presenter.ts:4`
- `src/lib/project-brain/cli.ts:72`

Interface surface:

- Exported functions: `renderBrainStatusHuman`, `renderBrainQueryHuman`,
  `renderBrainStaleHuman`.
- Public types: each function consumes one result type.
- Configuration: none beyond result shape.
- Dependencies: result types from `cli-types.ts`.

Hidden functionality:

- Low. Each presenter builds line arrays and joins them.

Evidence of shallowness:

- The three modules duplicate the same human-rendering pattern: initialize
  `lines`, push headers/details, return `lines.join("\\n")`.
- `project-brain/cli.ts:72` dispatches subcommands and leaves each subcommand to
  own presentation. That keeps command handling simple but spreads rendering
  conventions across small files.

Deepness score:

- `2/5`. The modules are cohesive, but they do not yet hide a reusable
  presentation model.

Better design:

- Add a tiny `BrainHumanReport` helper or `renderBrainReport({ title, rows,
  sections })` utility.
- Keep result-specific logic in each presenter, but centralize headings,
  spacing, empty sections, and severity rendering.

North-star link:

- Lowers small but recurring review cost for Project Brain output changes and
  keeps agent-facing CLI text consistent.

Testing effect:

- Snapshot or string tests can target the shared renderer and one presenter per
  result family.

Risk:

- Low. Human output may be snapshot-sensitive, but behavior is localized.

Tracking:

- Opportunistic cleanup only. Do not prioritize over command registry,
  contract, or preflight work.

## Implementation Follow-up

Implemented in the same working pass:

- Made `.harness/audits/**/*.md` a durable Markdown lane in `.gitignore`, so
  this report can stay at the requested path and still be tracked.
- Deepened duplicate git environment sanitation by adding
  `src/lib/git/safe-env.ts` with explicit `minimal` and `strict` policies.
  Existing compatibility functions now delegate to that shared policy module:
  `gitEnvironmentForRepoRoot()` uses `minimal`; `rootHygieneGitEnv()` uses
  `strict`.
- Reduced repeated simple command-spec adapter shape by adding
  `src/lib/cli/registry/define-command-spec.ts` and converting simple
  pass-through registry adapters to it. Bespoke parser adapters remain explicit.
- Deepened `src/lib/evidence/loader.ts` by adding `resolveEvidencePath()`,
  a typed one-call resolver for repo-contained evidence paths, parent/file
  existence, symlink resolution, size metadata, and blocker classification.
  Existing helper exports remain available for compatibility.

Remaining larger follow-up:

- `src/lib/contract/types-core.ts` should be decomposed in a dedicated
  compatibility-first slice because it is a broad public type/schema surface.
- `src/lib/preflight/validator-core.ts` should be split by check family in a
  dedicated validation-gate slice because preflight is a bootstrap and closeout
  gate.
- Init scaffold planning and Project Brain presenter cleanup remain lower-risk
  follow-ups after the two larger modules are scheduled or explicitly deferred.

## Lower-priority Intentional Facades

These modules are shallow, but current repo evidence says they are deliberate
compatibility surfaces. They should be deepened only by improving the behavior
behind them, not by deleting the facade first.

### Output Normalisation Compatibility Surface

Files:

- `src/lib/output/normalise.ts:1`
- `src/lib/output/normalise-core-v2.ts:1`
- `src/lib/architecture/module-boundaries.test.ts:126`
- `src/lib/architecture/module-boundaries.test.ts:135`

Score:

- `2/5`, intentionally shallow.

Evidence:

- `normalise.ts` is a one-line re-export facade.
- `normalise-core-v2.ts:1` explicitly describes itself as a compatibility
  export surface.
- The module-boundary ratchet says `normalise.ts` must stay a public export
  surface and `normalise-core-v2.ts` must stay a compatibility export surface.

Smallest better design:

- Keep the facades. Add a normaliser registry behind them only if another gate
  normaliser adds duplicated routing or metadata.

### Command Compatibility Facades

Files:

- `src/commands/linear-gate.ts:1`
- `src/commands/brain.ts:1`
- `src/commands/upgrade.ts:1`
- `src/commands/prompt-gate.ts:1`
- `src/commands/gap-case.ts:1`
- `AGENTS.md:392`

Score:

- `2/5`, intentionally shallow.

Evidence:

- Many top-level command files are one-line re-exports.
- Repo guidance explicitly describes command-registry deep-module splits and
  compatibility facades for command families.

Smallest better design:

- Do not remove the facades. Instead, ensure every facade has one deeper module
  where parsing, validation, persistence, and presentation actually live, plus a
  module-boundary ratchet so behavior does not creep back into the facade.

## Validation

Command: `bash scripts/codex-preflight.sh --mode optional` -> pass (provided by
session startup context before this audit)

Command: static inspection with `rg`, `find`, `nl`, and a Node export/size scan
-> pass (audit evidence gathered; no production code executed)

Command:
`pnpm vitest run src/lib/git/safe-env.test.ts src/commands/runtime-card.test.ts src/lib/root-hygiene/root-hygiene.test.ts`
-> pass (3 files, 50 tests)

Command:
`pnpm vitest run src/lib/cli/registry/define-command-spec.test.ts src/lib/cli/command-registry.test.ts src/lib/cli/legacy-dispatch-guard.test.ts src/cli-dispatch.test.ts`
-> pass (4 files, 279 tests)

Command:
`pnpm vitest run src/lib/cli/registry/command-specs.test.ts src/lib/cli/registry/define-command-spec.test.ts src/lib/cli/command-registry.test.ts src/lib/cli/legacy-dispatch-guard.test.ts src/cli-dispatch.test.ts`
-> pass (5 files, 386 tests)

Command:
`pnpm exec markdownlint-cli2 .harness/audits/2026-05-30-shallow-modules-audit.md .harness/refactors/2026-05-30-contract-preflight-deepening-follow-up.md && pnpm run quality:docstrings && pnpm run quality:size`
-> pass (markdownlint 0 errors; docstrings passed; size gate passed with
existing ratchet warnings outside this slice)

Command: `pnpm run test:related` -> pass (32 files, 1125 tests passed, 1
skipped; drift-gate emitted non-blocking baseline warnings)

Command: `pnpm vitest run src/lib/evidence/loader.test.ts` -> pass (1 file,
5 tests)

Command: `pnpm run test:related` -> pass after the evidence-loader deepening
(34 files, 1144 tests passed, 1 skipped; drift-gate emitted non-blocking
baseline warnings)

Command: `pnpm typecheck` -> pass

Command: targeted `pnpm exec biome check <touched TypeScript files>` -> pass
(22 files checked)

Command: `pnpm exec markdownlint-cli2 .harness/audits/2026-05-30-shallow-modules-audit.md .harness/refactors/2026-05-30-contract-preflight-deepening-follow-up.md`
-> pass (2 files, 0 errors)

Command: `bash scripts/validate-codestyle.sh --fast` -> blocked (unrelated
dirty `.memory-metrics.json` formatting error in the local worktree; touched
TypeScript and Markdown were checked directly)
