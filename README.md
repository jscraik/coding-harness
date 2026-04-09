# Coding Harness

[![CircleCI](https://dl.circleci.com/status-badge/img/gh/jscraik/coding-harness/tree/main.svg?style=shield)](https://dl.circleci.com/status-badge/redirect/gh/jscraik/coding-harness/tree/main)
[![npm](https://img.shields.io/npm/v/@brainwav/coding-harness?label=npm)](https://www.npmjs.com/package/@brainwav/coding-harness)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/jscraik/coding-harness/badge)](https://scorecard.dev/viewer/?uri=github.com/jscraik/coding-harness)

Coding Harness is a CLI control plane for repositories that use AI coding agents.
It turns repo policy, workflow docs, review gates, and rollout criteria into
things you can scaffold, validate, and enforce.

It is best thought of as the layer around the agents, not the agent runtime
itself. It helps you make a repo safer to automate by giving it a contract,
repo-local verification scripts, review policy, CI migration tooling, and
artifact-backed rollout checks.

The shortest honest description of the project today is:

- it bootstraps governed, agent-ready repositories
- it gives downstream repos repo-local verification and preflight scripts
- it validates review, docs, plan, and authorization policy before merge
- it supports staged CI migration with rollback and parity evidence
- it evaluates pilot safety before you expand autonomy

## Table of Contents

- [Start Here](#start-here)
- [Why Teams Use It](#why-teams-use-it)
- [What It Is Best At Today](#what-it-is-best-at-today)
- [Security Posture Baseline](#security-posture-baseline)
- [Installation](#installation)
- [Repo-local Wrapper](#repo-local-wrapper)
- [Repo-local Verification](#repo-local-verification)
- [Common Workflows](#common-workflows)
  - [Hero Workflow 1: Bootstrap a repository](#hero-workflow-1-bootstrap-a-repository)
  - [Hero Workflow 2: Start work on an issue](#hero-workflow-2-start-work-on-an-issue)
  - [Hero Workflow 3: Submit a change for review](#hero-workflow-3-submit-a-change-for-review)
  - [Advanced: Migrate CI with rollback and proof](#advanced-migrate-ci-with-rollback-and-proof)
  - [Advanced: Validate a Symphony workflow contract](#advanced-validate-a-symphony-workflow-contract)
  - [Advanced: Evaluate a pilot before expanding autonomy](#advanced-evaluate-a-pilot-before-expanding-autonomy)
- [Command Index](#command-index)
- [Requirements](#requirements)
- [Local Development](#local-development)
- [Packaged Codex Skill](#packaged-codex-skill)
- [Issue Reporting](#issue-reporting)

## Start Here

Get from zero to a governed, agent-ready repository in five steps:

```bash
# 1. Install
pnpm add -g @brainwav/coding-harness

# 2. Preview what harness will scaffold (no writes)
harness init --dry-run

# 3. Apply and track the scaffold
harness init --track

# 4. Validate the contract file
harness contract validate

# 5. Check overall repo health
harness health --json
```

That is the minimum viable path. The three most common workflows beyond this are:

- **[Bootstrap a repository](#hero-workflow-1-bootstrap-a-repository)** — dry-run, init, contract validate, health, upgrade
- **[Start work on an issue](#hero-workflow-2-start-work-on-an-issue)** — linear prepare, preflight, policy gates
- **[Submit a change for review](#hero-workflow-3-submit-a-change-for-review)** — docs-gate, review-gate, linear sync

For CI migration, pilot evaluation, or workflow contracts, see the [advanced workflows](#advanced-migrate-ci-with-rollback-and-proof) below.

## Why Teams Use It

Teams usually adopt Coding Harness for one of four jobs:

- **Bootstrap a repo once, then keep it aligned.** `harness init` can scaffold
  `harness.contract.json`, `WORKFLOW.md`, PR templates, CodeRabbit defaults,
  repo-local verification scripts, and rollback metadata instead of leaving
  each repo to invent its own setup.
- **Put policy in code instead of chat reminders.** Commands like
  `docs-gate`, `plan-gate`, `review-gate`, `linear-gate`, `check-authz`, and
  `local-memory-preflight` make governance expectations runnable.
- **Change CI and review workflow without losing trust.** `ci-migrate`,
  `branch-protect`, `verify-coderabbit`, and parity-proof tooling exist for
  controlled migration rather than "edit YAML and hope".
- **Expand autonomy gradually.** Pilot evaluation, rollback, workflow-contract
  validation, remediation, and evidence verification give teams a way to ask
  "should this be automated further?" with artifacts instead of instinct.

## What It Is Best At Today

The code, tests, and recent history point to a few especially strong surfaces.

- **Governed bootstrap and upgrade.** `init`, `upgrade`, and `eject` are
  mature command families. They support dry runs, tracked updates, rollback,
  interactive review, minimal mode, and repo-specific scaffolding decisions.
- **CI migration with proof and rollback.** `ci-migrate` is one of the deepest
  tested surfaces in the repo. It supports prepare, verify, commit, abort,
  branch-protection sync, proof packs, and merge-queue cutover evidence.
- **Review and governance gates.** `review-gate`, `docs-gate`,
  `verify-coderabbit`, `linear-gate`, `check-authz`, and `doctor` are current,
  active surfaces. This repo now assumes CodeRabbit, not Greptile, as the
  primary AI review path.
- **Pilot control-plane evaluation.** `pilot-evaluate`, `pilot-rollback`,
  remediation, gap-case management, and workflow-contract scorecards are real
  product surfaces with substantial test coverage.
- **Repo-local verification and preflight.** Harness scaffolds
  `scripts/codex-preflight.sh`, `scripts/verify-work.sh`, and
  `scripts/validate-codestyle.sh` so a downstream repo has a local verification
  contract instead of a loosely documented checklist.
- **Context, search, and multi-repo audit.** `search`, `context`,
  `index-context`, `context-health`, `tooling-audit`, and `org-audit` make the
  project broader than "just repo init". It also helps teams inspect governed
  context and drift across repositories.

If you want the highest-confidence paths today, start with `init`, `upgrade`,
`ci-migrate`, `docs-gate` or `review-gate`, `verify-coderabbit`,
`local-memory-preflight`, and `pilot-evaluate`.

## Security Posture Baseline

This repository tracks baseline security posture with OpenSSF OSPS + Scorecard
artifacts that are versioned alongside code.

- Baseline status and control matrix:
  `docs/security/2026-04-09-openssf-osps-baseline-status.md`
- Scorecard floor policy:
  `security/openssf-scorecard-policy.json`
- Regression evaluator:
  `scripts/check-scorecard-regressions.mjs`
- Continuous scorecard workflow:
  `.github/workflows/openssf-scorecard.yml`

Scorecard checks run on pull requests (`warn` mode), pushes to `main` (`fail`
mode), and a weekly scheduled run (`fail` mode).

## Installation

Published package usage requires registry access to `@brainwav/coding-harness`.

```bash
pnpm add -g @brainwav/coding-harness
harness --help
```

If your team uses `mise`, this also works:

```bash
mise install -g npm:@brainwav/coding-harness
```

The package is best suited to repositories that want a governed local CLI
surface. After installation, the usual next step is not "read every command",
it is to run `harness init --dry-run` in the target repository and inspect the
scaffold plan.

## Repo-local Wrapper

`harness init` now scaffolds `scripts/harness-cli.sh` for downstream repos that
want a repo-local wrapper around the published CLI package.

Use it like this:

```bash
bash scripts/harness-cli.sh verify-coderabbit
```

If the wrapper cannot resolve local `@brainwav/coding-harness`, treat that as a
repo bootstrap/install problem, not a harness command failure. In a pnpm repo,
repair it with:

```bash
pnpm install
pnpm add -D @brainwav/coding-harness
pnpm exec harness <command>
```

This matters because downstream repos can standardize on one local command
surface even if contributors use different shells or global setups.

## Repo-local Verification

Use `bash scripts/verify-work.sh` as the canonical repo-local verification
entrypoint. It runs repo-local preflight in `required` Local Memory mode and
then executes the full verification bundle.

For a quicker local loop, use:

```bash
bash scripts/verify-work.sh --fast
```

For downstream repos, this is one of the most practical parts of harness. It
turns "what do I need to run before handoff?" into a single local command.

## Common Workflows

### Hero Workflow 1: Bootstrap a repository

Start with a preview, then write tracked changes once the diff looks right.

```bash
harness init --dry-run
harness init --track
harness contract validate
harness health --json
```

This is the best path when you want a governed starting point quickly. In the
common case, `init --track` gives you the contract, workflow scaffolding,
review policy surfaces, repo-local verification scripts, and enough metadata to
upgrade or roll back cleanly later.

Use these follow-ups when the repo already has harness material:

```bash
harness init --check-updates
harness upgrade --dry-run
harness upgrade
```

If a legacy `.harness/restore-manifest.json` is missing `ciProvider`, harness
will repair it automatically when the active provider can be inferred from
`harness.contract.json`, an unambiguous CI layout on disk, or the requested or
default init/upgrade provider.

If tracked baseline files are missing and you need to re-scaffold them:

```bash
harness init --update
harness init --interactive
```

To specify or override the detected project type during init:

```bash
harness init --project-type web       # explicit: cli | desktop | library | web
harness init --project-type cli --json  # machine-readable structured output
```

Use the contract surface when you want confidence that the repo policy file is
still valid or you need a schema for editor and automation tooling:

```bash
harness contract validate
harness contract validate --json
harness contract schema > harness.contract.schema.json
```

### Hero Workflow 2: Start work on an issue

Prepare branch context from a Linear issue, run preflight checks, then gate
each file as you work.

```bash
harness linear prepare --issue <KEY>         # pre-fill branch, PR title, closing line
harness preflight-gate --contract harness.contract.json --files <changed-files>
harness policy-gate --contract harness.contract.json --files <changed-files>
harness blast-radius --files <changed-files> --json   # see which gates apply
```

The `linear prepare` command outputs a branch name, PR title, and body fragment
so you never need to construct these by hand or from memory.

### Hero Workflow 3: Submit a change for review

Gate the change locally before pushing, then confirm review wiring is correct.

```bash
harness docs-gate --mode advisory --json
harness plan-gate --require-plan-id --require-traceability --json
harness review-gate --token "$GITHUB_TOKEN" --owner <owner> --repo <repo> --pr <number> --sha <head-sha>
harness linear sync --findings findings.json --team <TEAM>
```

For repos using CodeRabbit, pair the review-gate with:

```bash
harness verify-coderabbit --json
```

That gives you a concrete local answer for "is the repo-side review wiring
correct?" before you debug GitHub-side behavior.

### Advanced: Migrate CI with rollback and proof

```bash
harness ci-migrate prepare --provider circleci --dry-run
harness ci-migrate prepare --provider circleci --apply
harness ci-migrate verify --snapshot <snapshot-id>
harness ci-migrate commit --snapshot <snapshot-id>
```

Use `abort` or `--rollback` if parity or external control-plane checks fail.
For cutover follow-through, the same command family also supports:

```bash
harness ci-migrate sync-branch-protection
harness ci-migrate promote-mode
```

### Advanced: Validate a Symphony workflow contract

Coding Harness can scaffold a `WORKFLOW.md`, generate compact workflow specs,
and validate readiness for Symphony-style execution.

```bash
harness workflow:generate --source docs/specs/my-flow.md --output WORKFLOW.md
harness symphony-check
pnpm workflow:validate
```

To keep Linear metadata and findings aligned from the same CLI surface:

```bash
harness linear prepare --issue JSC-123
harness linear sync --findings findings.json --team JSC
```

This is one of the more understated parts of the project today: it is not only
scaffolding repo files, it also includes machinery for defining, checking, and
operating workflow contracts.

### Advanced: Evaluate a pilot before expanding autonomy

```bash
harness pilot-evaluate --artifacts artifacts/pilot --lane health --output artifacts/pilot/result.json
harness pilot-rollback --mode manual
```

This part of the CLI is designed for artifact-backed rollout decisions, not
just dashboard reporting.

## Command Index

The tables below keep README parity with the CLI while staying short. For full
flags, use `harness --help`.

### Bootstrap And Governance

| Command | Purpose |
| --- | --- |
| `init` | Scaffold or update harness-managed repo surfaces (`--project-type`, `--json`, `--dry-run`, `--force`, `--track`, `--update`, `--migrate`, `--minimal`, `--issue-tracker`) |
| `eject` | Safely remove harness-managed files and templates, including legacy Greptile artifacts, while preserving custom non-Greptile CI workflows (`--dry-run`, `--force`) |
| `check` | Zero-config repo health snapshot — works before full setup |
| `doctor` | Check all gate prerequisites (tools, files, config, CI) |
| `health` | Unified gate status scorecard across all gates |
| `contract` | Validate `harness.contract.json` or print the JSON Schema (`validate`, `schema`) |
| `upgrade` | Safely upgrade harness in an existing repo (`--dry-run` supported) |
| `ci-migrate` | Stage, verify, commit, abort, sync branch protection, or promote CI mode |
| `branch-protect` | Configure GitHub branch protection rulesets |
| `verify-work` | Run canonical repo-local verification (fresh or resume mode) |
| `verify-coderabbit` | Verify CodeRabbit configuration and remote wiring |
| `preset` | List and inspect bundled presets |
| `symphony-check` | Validate `WORKFLOW.md`, Linear config, and transition-table readiness |

### Review And Policy Gates

| Command | Purpose |
| --- | --- |
| `policy-gate` | Validate policy expectations from changed files |
| `preflight-gate` | Run fast policy checks before expensive work |
| `review-gate` | Enforce merge-readiness and SHA-linked review checks |
| `docs-gate` | Enforce documentation parity for governed changes |
| `plan-gate` | Validate plan IDs, traceability, and acceptance evidence |
| `brainstorm-gate` | Validate brainstorm artifacts |
| `prompt-gate` | Validate prompt template usage |
| `pr-template-gate` | Validate PR template completion and placeholder replacement |
| `license-gate` | Validate open-source license expectations |
| `check-authz` | Validate authorization policy for mutative operations |
| `check-environment` | Validate pilot environment governance checks |
| `local-memory-preflight` | Run the structured Local Memory preflight smoke checks |
| `blast-radius` | Determine required checks from changed files |
| `risk-tier` | Classify changed files by risk tier |
| `diff-budget` | Enforce diff budget constraints |
| `observability-gate` | Check metrics cardinality limits |
| `silent-error` | Detect silent error-handling anti-patterns |
| `memory-gate` | Validate local-memory workflow compliance |

### Linear And Workflow Operations

| Command | Purpose |
| --- | --- |
| `linear` | Claim, hand off, close, prepare, or sync Linear work from one command family |
| `linear prepare` | Pre-fill branch name, PR title, body, and closing line from a Linear issue |
| `linear sync` | Promote harness findings into Linear issues idempotently |
| `linear-gate` | Enforce Linear-first intake, branch naming, and PR linkage |
| `workflow:generate` | Generate compact workflow specs from annotated markdown |

### Pilot, Remediation, And Automation

| Command | Purpose |
| --- | --- |
| `pilot-evaluate` | Evaluate pilot metrics and determine promotion readiness |
| `pilot-rollback` | Move pilot mode between autonomous and manual states |
| `simulate` | Run counterfactual policy simulation |
| `automation-run` | Execute idempotent automation playbooks |
| `gap-case` | Manage production gap cases |
| `remediate` | Plan and run deterministic remediation for findings |
| `replay` | Re-run policy checks from saved snapshots |

### Drift, Search, And Evidence

| Command | Purpose |
| --- | --- |
| `drift-gate` | Evaluate consistency drift across governance surfaces |
| `org-audit` | Scan multi-repo governance and drift posture |
| `tooling-audit` | Audit managed repo tooling baselines |
| `gardener` | Detect stale docs and broken links |
| `context-health` | Generate advisory context-integrity scorecards |
| `search` | Run hybrid lexical and semantic search; if `--limit` or `--threshold` is omitted, `contextCompact` policy applies when present, otherwise static defaults (`DEFAULT_SEARCH_LIMIT`, `DEFAULT_SIMILARITY_THRESHOLD`) are used |
| `context` | Search indexed plans, specs, and brainstorms; if `--limit` or `--threshold` is omitted, `contextCompact` policy applies when present, otherwise static defaults (`DEFAULT_SEARCH_LIMIT`, `DEFAULT_SIMILARITY_THRESHOLD`) are used |
| `index-context` | Build the local semantic-search index |
| `evidence-verify` | Validate screenshot and evidence artifacts |
| `ui:fast` | Run a Storybook-first local UI loop |
| `ui:verify` | Run Playwright smoke verification with evidence capture |
| `ui:explore` | Run agent-browser exploratory testing |

## Requirements

- **Node.js:** `>= 24`
- **Package manager for this repo:** `pnpm@10`
- **GitHub auth:** required for commands that inspect or mutate remote GitHub
  state, including `branch-protect`, `review-gate`, and remote CodeRabbit checks
- **Linear auth:** required for `linear*` flows and for a clean
  `symphony-check` result
- **Local Memory:** required for repo-local `required` preflight mode and for
  the default `scripts/verify-work.sh` flow scaffolded into downstream repos
- **Ollama/local embeddings:** required for the semantic side of
  `search`, `context`, and `index-context`
- **Browser automation tooling:** required for `ui:verify` and `ui:explore`
  workflows

Coding Harness does **not** create secrets for you and does **not** bypass
branch protection or review policy. It also does **not** run your CI provider
or agent runtime for you. Its job is to scaffold, validate, and enforce the
control-plane layer around those systems.

## Local Development

If you are developing this repository itself:

```bash
mise trust            # activate pinned toolchain from .mise.toml
make setup            # installs deps + configures git hooks
pnpm build
pnpm exec tsx src/cli.ts --help
pnpm check
```

When you change runtime behavior or artifact formats, run the deeper validation
path as well:

```bash
pnpm test:deep
```

## Packaged Codex Skill

The npm package ships a reusable Codex skill at
`.agents/skills/coding-harness/SKILL.md`.

It covers:

- harness install and update workflows
- capability boundaries and safe usage rules
- command discovery and validation expectations

Run the packaged-skill validation lane after changing the bundle:

```bash
pnpm skill:validate
```

Repository-local skills follow the same convention:

```bash
.agents/skills/<skill-name>/SKILL.md
```

## Issue Reporting

This repository uses **Linear-first** intake. Create or update work in the
[coding-harness project](https://linear.app/jscraik/project/coding-harness-bb735dbbda79).
