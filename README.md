# Coding Harness

[![CircleCI](https://dl.circleci.com/status-badge/img/gh/jscraik/coding-harness/tree/main.svg?style=shield)](https://dl.circleci.com/status-badge/redirect/gh/jscraik/coding-harness/tree/main)
[![npm](https://img.shields.io/npm/v/@brainwav/coding-harness?label=npm)](https://www.npmjs.com/package/@brainwav/coding-harness)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

Coding Harness is a CLI control plane for repositories that use AI coding agents.
It turns repo policy, workflow docs, review gates, and rollout criteria into
things you can scaffold, validate, and enforce.

The shortest honest description of the project today is:

- it bootstraps governed agent-ready repos
- it gates risky changes with repo-local policy
- it helps migrate CI and preserve proof of parity
- it validates workflow contracts for Symphony-style automation
- it evaluates pilot safety before you expand autonomy

## Table of Contents

- [Why Teams Use It](#why-teams-use-it)
- [Current Strengths](#current-strengths)
- [Installation](#installation)
- [Repo-local Wrapper](#repo-local-wrapper)
- [Repo-local Verification](#repo-local-verification)
- [Common Workflows](#common-workflows)
- [Command Index](#command-index)
- [Requirements](#requirements)
- [Local Development](#local-development)
- [Packaged Codex Skill](#packaged-codex-skill)
- [Issue Reporting](#issue-reporting)

## Why Teams Use It

Teams usually adopt Coding Harness for one of four jobs:

- **Bootstrap a repo once, then keep it aligned.** `harness init` can scaffold
  contracts, workflow docs, CI policy surfaces, Greptile defaults, Linear-aware
  templates, and rollback metadata instead of relying on tribal knowledge.
- **Gate agent work with the same rules every time.** Commands like
  `policy-gate`, `docs-gate`, `plan-gate`, `review-gate`, and `linear-gate`
  move repo expectations out of “please remember” territory.
- **Change CI or governance without losing trust.** `ci-migrate` is built for
  staged migration, snapshots, rollback, and parity evidence rather than
  one-shot YAML replacement.
- **Roll out autonomy deliberately.** The pilot and workflow-contract tooling
  exists to answer “is this safe to expand?” with artifacts, thresholds, and
  explicit hold/freeze/demote behavior.

## Current Strengths

The code, tests, and recent history show a few strengths more clearly than the
old README did.

- **Repository bootstrap and update flows are a core surface.** The largest
  command test file in the repo is `src/commands/init.test.ts`, and `init`
  supports dry runs, tracked updates, rollback, migration, interactive review,
  and generated `WORKFLOW.md` scaffolding.
- **CI migration is more than a helper script.** `ci-migrate` has deep support
  for snapshots, parity proof packs, merge-queue cutover evidence, break-glass
  policy, and rollback. The corresponding test surface is also one of the
  largest in the repo.
- **Workflow contracts are now a real subsystem.** Recent slices added a
  markdown parser, checker, artifact registry, state normalization, gate
  bundles, operator scorecards, pilot tracking, and reusable test-harness
  utilities. This repo is no longer just “a set of gates”; it also includes
  machinery for defining and validating agent workflows.
- **Pilot rollout control has become first-class.** `pilot-evaluate`,
  `pilot-rollback`, scorecards, control-plane artifacts, decision packets, and
  scale-out pilot tracking are all active surfaces, not future ideas.

If you want the highest-confidence paths today, start with `init`,
`ci-migrate`, workflow-contract checks, `docs-gate`/`review-gate`, and
`pilot-evaluate`.

## Installation

Published package usage requires npm access to `@brainwav/coding-harness`.

```bash
npm install -g @brainwav/coding-harness
harness --help
```

If your team uses `mise`, this also works:

```bash
mise install -g npm:@brainwav/coding-harness
```

## Repo-local Wrapper

`harness init` now scaffolds `scripts/harness-cli.sh` for downstream repos that
want a repo-local wrapper around the published CLI package.

Use it like this:

```bash
bash scripts/harness-cli.sh verify-greptile
```

If the wrapper cannot resolve local `@brainwav/coding-harness`, treat that as a
repo bootstrap/install problem, not a harness command failure. In a pnpm repo,
repair it with:

```bash
pnpm install
pnpm add -D @brainwav/coding-harness
pnpm exec harness <command>
```

## Repo-local Verification

Use `bash scripts/verify-work.sh` as the canonical repo-local verification
entrypoint. It runs repo-local preflight in `required` Local Memory mode and
then executes the full verification bundle.

For a quicker local loop, use:

```bash
bash scripts/verify-work.sh --fast
```

## Common Workflows

### 1. Bootstrap a repository

Start with a preview, then write tracked changes once the diff looks right.

```bash
harness init --dry-run
harness init --track
harness symphony-check
```

Use these follow-ups when the repo already has harness material:

```bash
harness init --check-updates
harness upgrade --dry-run
harness upgrade
```

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

### 1b. Validate or export the contract

Use the built-in contract surface when you want confidence that the repo policy
file is still valid or you need a schema for editor and automation tooling.

```bash
harness contract validate
harness contract validate --json
harness contract schema > harness.contract.schema.json
```

### 2. Gate a change before review

This is the practical loop for “did we update the right things?”

```bash
harness preflight-gate --contract harness.contract.json --files src/cli.ts,README.md
harness policy-gate --contract harness.contract.json --files src/cli.ts,README.md
harness docs-gate --mode advisory --json
harness plan-gate --require-plan-id --require-traceability --json
```

When you need remote merge-readiness checks:

```bash
harness review-gate --token "$GITHUB_TOKEN" --owner <owner> --repo <repo> --pr <number> --sha <head-sha>
```

### 3. Migrate CI with rollback and proof

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

### 4. Validate a Symphony workflow contract

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

### 5. Evaluate a pilot before expanding autonomy

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
| `init` | Scaffold or update harness-managed repo surfaces (`--project-type`, `--json`, `--dry-run`, `--force`, `--track`, `--update`, `--migrate`, `--minimal`, `--issue-tracker`, `--no-greptile`) |
| `eject` | Safely remove harness-managed files and templates while preserving custom CI workflows (`--dry-run`, `--force`) |
| `doctor` | Check all gate prerequisites (tools, files, config, CI) |
| `health` | Unified gate status scorecard across all gates |
| `contract` | Validate `harness.contract.json` or print the JSON Schema (`validate`, `schema`) |
| `upgrade` | Safely upgrade harness in an existing repo (`--dry-run` supported) |
| `ci-migrate` | Stage, verify, commit, abort, sync branch protection, or promote CI mode |
| `branch-protect` | Configure GitHub branch protection rulesets |
| `verify-greptile` | Verify Greptile configuration and remote wiring |
| `request-greptile-review` | Post the standard Greptile review request comment |
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
| `search` | Run hybrid lexical and semantic search |
| `context` | Search indexed plans, specs, and brainstorms |
| `index-context` | Build the local semantic-search index |
| `evidence-verify` | Validate screenshot and evidence artifacts |
| `ui:fast` | Run a Storybook-first local UI loop |
| `ui:verify` | Run Playwright smoke verification with evidence capture |
| `ui:explore` | Run agent-browser exploratory testing |

## Requirements

- **Node.js:** `>= 24`
- **Package manager for this repo:** `pnpm@10`
- **GitHub auth:** required for commands that inspect or mutate remote GitHub
  state, including `branch-protect`, `review-gate`, and remote Greptile checks
- **Linear auth:** required for `linear*` flows and for a clean
  `symphony-check` result
- **Ollama/local embeddings:** required for the semantic side of
  `search`, `context`, and `index-context`
- **Browser automation tooling:** required for `ui:verify` and `ui:explore`
  workflows

Coding Harness does **not** create secrets for you and does **not** bypass
branch protection or review policy.

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
