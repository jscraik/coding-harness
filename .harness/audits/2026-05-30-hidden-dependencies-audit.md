---
date: 2026-05-30
report_type: hidden-dependencies-audit
status: advisory
repo: coding-harness
branch: codex/jsc-363-intermediary-receipt-coverage
---

# Hidden Dependencies Audit

## Table of Contents

- [Purpose](#purpose)
- [Method](#method)
- [Ranking](#ranking)
- [Cases](#cases)
- [Recommended Cross-Cutting Fix](#recommended-cross-cutting-fix)
- [Validation](#validation)

## Purpose

Find current local changes where the required file set would not have been
obvious from the original implementation task. Rank each case by future
confusion avoided if the dependency path becomes visible before the next agent
or maintainer repeats the same search.

This audit is about discoverability, not correctness. A change can be locally
reasonable and still need a better breadcrumb trail.

## Method

- Inspected the current dirty worktree on
  `codex/jsc-363-intermediary-receipt-coverage`.
- Grouped touched and untracked files by implementation intent.
- Looked for cross-file coupling that is not directly implied by the file name,
  import graph, or nearby documentation.
- Ranked cases by likely review delay, repeated-agent effort, and risk of an
  incomplete future change.

## Ranking

| Rank | Case | Future confusion avoided | Why it ranks here |
| --- | --- | --- | --- |
| 1 | Behavior-test evidence guard | Very high | A small assertion-helper idea fans out into tests, scripts, package scripts, codestyle, generated templates, hooks, and governance docs. Missing one surface silently weakens the guard. |
| 2 | Audit artifact tracking | High | Report requests naturally target `.harness/audits/`, but the repo previously ignored all `.harness/*` paths unless allowlisted. Without tracking rules, audit output can look complete locally and disappear from review. |
| 3 | Shared git environment sanitation | High | Two distant runtime evidence modules carried similar but not identical git subprocess cleanup rules. Future fixes can easily patch one and leave the other stale. |
| 4 | Command registry pass-through helper | Medium-high | The refactor touches many nearly identical command-spec files, but the sibling set is discovered by pattern recognition rather than a declared contract. |
| 5 | Project Brain presenter and rule helpers | Medium | The extracted helpers are useful, but the CLI parser, human output, and markdown rule grammar are connected through convention more than through visible ownership docs. |

## Cases

### 1. Behavior-Test Evidence Guard

#### Original Task

Inferred from the diff: require high-trust evidence-bearing tests to use
behavior-shaped assertions with `given`, `should`, `actual`, and `expected`
context, then make that requirement fail closed in local quality gates.

#### Files Touched

- `scripts/check-behavior-tests.mjs`
- `src/lib/testing/expect-behavior.ts`
- `src/lib/testing/expect-behavior.test.ts`
- `src/commands/local-memory-preflight.test.ts`
- `src/commands/policy-gate.test.ts`
- `src/commands/runtime-card.test.ts`
- `src/lib/delivery-truth/delivery-truth-composition.test.ts`
- `src/lib/delivery-truth/delivery-truth-freshness-policy.test.ts`
- `src/lib/external-state/external-state.test.ts`
- `src/lib/pr-closeout.test.ts`
- `package.json`
- `Makefile`
- `scripts/validate-codestyle.sh`
- `AGENTS.md`
- `CONTRIBUTING.md`
- `README.md`
- `docs/agents/02-tooling-policy.md`
- `docs/agents/04-validation.md`
- `docs/agents/06-security-and-governance.md`
- `codestyle/17-testing.md`
- `codestyle/CHECKSUMS.sha256`
- `src/templates/codestyle/17-testing.md`
- `src/templates/codestyle/CHECKSUMS.sha256`

#### Hidden Dependencies

- The assertion helper alone does not enforce anything. Enforcement depends on
  `scripts/check-behavior-tests.mjs`, the `quality:behavior-tests` package
  script, `pnpm check`, `make hooks-pre-commit`, and
  `scripts/validate-codestyle.sh`.
- The list of required test files is a trust-boundary inventory. It spans PR
  closeout, delivery truth, runtime-card, Local Memory preflight, policy-gate,
  and external-state tests.
- Codestyle changes require both the source codestyle module and the packaged
  template copy, plus checksum updates.
- Governance docs must stay aligned because agents choose validation from
  `AGENTS.md`, `CONTRIBUTING.md`, `README.md`, and `docs/agents/*`, not from
  `package.json` alone.

#### Missing Documentation

- No single doc says, "When adding a new evidence-bearing trust-boundary suite,
  add it to `scripts/check-behavior-tests.mjs` and include at least one
  `expectBehavior` assertion."
- The named high-trust suite inventory lives inside the checker script and in
  prose, but there is no compact owner table explaining why those suites are in
  scope and what makes a future suite eligible.
- The codestyle template checksum step is not obvious from editing
  `codestyle/17-testing.md`.

#### Missing Contracts

- No manifest defines the high-trust behavior-test suite list. The checker uses
  an embedded JavaScript array.
- No guard proves the docs, codestyle source, codestyle template, and package
  script describe the same `quality:behavior-tests` contract.
- No explicit contract defines the minimum useful shape of an
  `expectBehavior` assertion beyond a regex for the function call.

#### Missing Discoverability

- A maintainer starting from a failing trust-boundary test would likely find the
  helper import, but not the package script, Makefile hook, codestyle template,
  checksum, and governance-doc surfaces.
- A maintainer starting from `pnpm check` would see the script name but not the
  reason each test file is included.
- `src/lib/testing/` is a reasonable home, but there is no local README or
  index that marks `expectBehavior` as the approved evidence assertion helper.

#### Recommended Visibility Improvement

Create a small manifest, for example
`src/lib/testing/behavior-test-suites.json` or
`docs/testing/behavior-test-suites.md`, listing each required suite, owner
area, rationale, and proving command. Make `scripts/check-behavior-tests.mjs`
read the manifest, and add a short codestyle note: "New evidence-bearing
trust-boundary tests must be registered in the behavior-test suite manifest."

Also add a codestyle parity note that editing `codestyle/*.md` requires the
matching `src/templates/codestyle/*.md` and checksum refresh.

### 2. Audit Artifact Tracking

#### Original Task

Inferred from the diff and current request: produce audit reports under
`.harness/audits/` and make them durable repo artifacts rather than local-only
runtime output.

#### Files Touched

- `.gitignore`
- `.harness/audits/2026-05-30-shallow-modules-audit.md`
- `.harness/audits/2026-05-30-hidden-dependencies-audit.md`

#### Hidden Dependencies

- `.harness/*` is ignored by default, so adding a report under
  `.harness/audits/` is not enough for review or commit visibility.
- The repo already tracks selected Project Brain and control-plane paths under
  `.harness/`, so audit tracking has to fit that allowlist model rather than
  bypassing it.
- Future audit writers may confuse `.harness/audits/` with
  `.harness/research/audits/`, which currently holds research-oriented audit
  artifacts.

#### Missing Documentation

- `.harness/README.md` does not appear in the current diff, so the new
  `.harness/audits/` durable-artifact lane is not yet explained in the tracked
  control-plane map.
- There is no naming convention documented for audit reports requested by the
  operator, such as `YYYY-MM-DD-<type>-audit.md`.
- There is no distinction documented between `.harness/audits/` and
  `.harness/research/audits/`.

#### Missing Contracts

- No validator checks that a requested audit report path is tracked or allowed
  through `.gitignore`.
- No schema or frontmatter contract distinguishes advisory audits from
  implementation notes, research notes, or generated reports.
- No docs-gate rule ensures new durable `.harness/` allowlists update the
  `.harness` control-plane map.

#### Missing Discoverability

- The only visible signal is the `.gitignore` allowlist. Agents rarely inspect
  `.gitignore` before creating a markdown report.
- A successful local file write can falsely look like durable completion even
  though the path would remain ignored without the allowlist.
- Existing audit artifacts in `.harness/research/audits/` create a plausible
  but different destination.

#### Recommended Visibility Improvement

Update `.harness/README.md` with a tracked artifact table that includes
`.harness/audits/`, its naming convention, and how it differs from
`.harness/research/audits/`. Add a small validator or docs-gate check that
flags tracked `.harness/` allowlist additions unless the control-plane map is
updated in the same change.

### 3. Shared Git Environment Sanitation

#### Original Task

Inferred from the diff: remove duplicated git subprocess environment cleanup
from runtime-card and root-hygiene code, while preserving each caller's intended
strictness.

#### Files Touched

- `src/lib/git/safe-env.ts`
- `src/lib/git/safe-env.test.ts`
- `src/lib/root-hygiene/git-env.ts`
- `src/lib/runtime/git-environment.ts`

#### Hidden Dependencies

- `root-hygiene` drops every `GIT_*` key, while runtime-card only dropped
  caller-scoped repository keys such as `GIT_DIR`, `GIT_WORK_TREE`,
  `GIT_INDEX_FILE`, and `GIT_COMMON_DIR`.
- Preserving `GIT_AUTHOR_NAME` is correct for one policy and incorrect for the
  stricter policy. The shared helper must encode both policies instead of
  flattening them into one generic cleanup.
- The files live in different feature areas, so an agent fixing one would not
  naturally inspect the other unless prompted by repeated code shape.

#### Missing Documentation

- There is no local doc that explains when to use `policy: "strict"` versus
  `policy: "minimal"`.
- The helper comments explain what the function returns, but not why the two
  policies differ.
- No architecture or runtime evidence doc names `src/lib/git/safe-env.ts` as
  the shared git subprocess environment authority.

#### Missing Contracts

- No module-boundary ratchet prevents new feature modules from manually deleting
  git environment keys instead of using `sanitizeGitEnvironment`.
- No test searches for sibling copies of `delete env.GIT_` or
  `key.startsWith("GIT_")` outside the shared helper.
- No contract says which `GIT_*` variables are caller-scoped repository state
  versus user identity or tool configuration.

#### Missing Discoverability

- `src/lib/git/` is newly introduced and small. Without an index or usage
  mention, maintainers may continue to look inside runtime or root-hygiene
  modules for this behavior.
- Searching for `GIT_WORK_TREE` will find the shared helper, but searching for
  "git environment" may still land on the two wrapper modules first.

#### Recommended Visibility Improvement

Add a short `src/lib/git/README.md` or architecture note naming
`sanitizeGitEnvironment` as the shared helper for git subprocess environment
cleanup. Add a lightweight guard to reject manual git-env key deletion outside
`src/lib/git/safe-env.ts`, with an allowlist for tests.

### 4. Command Registry Pass-Through Helper

#### Original Task

Inferred from the diff: reduce repeated command-spec boilerplate by introducing
`defineCommandSpec` for simple registry adapters and migrating obvious
pass-through commands to it.

#### Files Touched

- `src/lib/cli/registry/define-command-spec.ts`
- `src/lib/cli/registry/define-command-spec.test.ts`
- `src/lib/cli/registry/agent-readiness-command-spec.ts`
- `src/lib/cli/registry/artifact-gate-command-spec.ts`
- `src/lib/cli/registry/decision-request-command-spec.ts`
- `src/lib/cli/registry/fleet-plan-command-spec.ts`
- `src/lib/cli/registry/gap-case-command-spec.ts`
- `src/lib/cli/registry/linear-command-spec.ts`
- `src/lib/cli/registry/memory-gate-command-spec.ts`
- `src/lib/cli/registry/observability-gate-command-spec.ts`
- `src/lib/cli/registry/plan-gate-command-spec.ts`
- `src/lib/cli/registry/prompt-gate-command-spec.ts`
- `src/lib/cli/registry/runtime-budget-command-spec.ts`
- `src/lib/cli/registry/runtime-card-command-spec.ts`
- `src/lib/cli/registry/session-context-command-spec.ts`

#### Hidden Dependencies

- The sibling set is discovered by visual repetition across many
  `*-command-spec.ts` files, not by a command registry manifest.
- The helper preserves public command metadata and dispatch behavior, so even a
  mechanical refactor is part of the agent-facing CLI contract.
- Local ESM import rules require `.js` extensions even when adding a TypeScript
  helper.
- Some command specs are intentionally not simple pass-through adapters. The
  refactor needs a visible boundary between migrated and bespoke specs.

#### Missing Documentation

- No registry doc says when to use `defineCommandSpec` versus a bespoke factory.
- No command-spec authoring checklist tells future contributors to search for
  simple sibling adapters before adding another hand-written object.
- No current doc lists which command specs are compatibility facades, registry
  adapters, or complex parsers.

#### Missing Contracts

- No ratchet prevents new simple pass-through specs from returning raw object
  literals instead of using `defineCommandSpec`.
- No test snapshots command metadata before and after migration for the touched
  commands.
- No contract marks the command name, alias, summary, error label, and example
  fields as public agent-facing metadata.

#### Missing Discoverability

- A contributor adding a new command will likely copy the nearest command-spec
  file. If that nearest file is bespoke or unmigrated, the new helper remains
  invisible.
- The helper is in the same directory but not surfaced from a README or
  registry authoring guide.
- The command registry has many files, so partial migration can look arbitrary
  without an explicit migration rule.

#### Recommended Visibility Improvement

Add a short command-registry authoring section, either in
`docs/cli-reference.md`, `docs/agents/02-tooling-policy.md`, or a local
`src/lib/cli/registry/README.md`: use `defineCommandSpec` for adapters that
only supply metadata and forward args to one runner; use bespoke factories when
they assemble options, compose runners, or own compatibility behavior. Add a
small static check for raw simple command-spec object literals after the
migration is complete.

### 5. Project Brain Presenter And Rule Helpers

#### Original Task

Inferred from untracked files: extract Project Brain value-flag handling,
human-readable presenters, and markdown rule parsing into small helpers with
focused tests.

#### Files Touched

- `src/lib/project-brain/cli-value-flags.ts`
- `src/lib/project-brain/query-presenter.ts`
- `src/lib/project-brain/rules.ts`
- `src/lib/project-brain/rules.test.ts`
- `src/lib/project-brain/stale-presenter.ts`
- `src/lib/project-brain/status-presenter.ts`

#### Hidden Dependencies

- `BRAIN_VALUE_FLAGS` is coupled to CLI argument parsing, but the file itself
  does not show the parser that consumes it.
- The presenter helpers depend on `BrainQueryResult`, `BrainStaleResult`, and
  `BrainStatusResult` shapes from `cli-types.ts`; format drift in those types
  can break human output without touching the presenter files.
- `parseBrainRules` encodes a markdown grammar for `- **R-id**: text` rule
  entries, which is a Project Brain content contract rather than a generic
  markdown utility.

#### Missing Documentation

- No Project Brain authoring doc names the supported rule ID grammar or gives
  examples of valid rule entries.
- No CLI implementation doc explains that human output rendering is split into
  per-command presenter modules.
- No local README in `src/lib/project-brain/` maps parser, presenter,
  validator, and rule helper ownership.

#### Missing Contracts

- No fixture suite proves real `.harness/knowledge/**` or Project Brain rules
  documents round-trip through `parseBrainRules`.
- No command-level test proves the new presenters are actually wired into CLI
  output paths.
- No validator rejects malformed rule entries that look close to valid but are
  skipped by the parser.

#### Missing Discoverability

- The helper files are small and named well, but they are untracked in the
  current dirty tree and not yet referenced by visible docs.
- A future maintainer changing brain CLI flags may update the parser but miss
  `BRAIN_VALUE_FLAGS`.
- A future maintainer changing Project Brain markdown may update docs but miss
  the parser grammar.

#### Recommended Visibility Improvement

Add a `src/lib/project-brain/README.md` or docs section that maps CLI parser,
value flags, presenters, rules grammar, and validators. Add one fixture-backed
test that parses an actual Project Brain rules document shape and one CLI-level
test proving at least one presenter is used by the public command path.

## Recommended Cross-Cutting Fix

Introduce a small "visibility map" convention for changes that add or alter a
repo operating-system primitive. The map can be a markdown table in the owning
docs page or a JSON manifest consumed by a guard. It should answer:

- What is the primitive?
- What files own the implementation?
- What files expose it to agents or users?
- What validators keep it from drifting?
- What generated or template copies must stay synchronized?

The behavior-test guard is the best first candidate because it already spans
implementation, tests, scripts, docs, codestyle templates, and checksums.

## Validation

Command: `git diff --check -- .harness/audits/2026-05-30-hidden-dependencies-audit.md`
-> pass (no whitespace errors)

Command: `pnpm markdownlint .harness/audits/2026-05-30-hidden-dependencies-audit.md`
-> pass (0 markdownlint errors)
