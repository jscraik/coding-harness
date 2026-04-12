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

Documentation surfaces:
- Use this README for product overview, installation, and common workflows.
- Use `AGENTS.md` for compact repo-operator defaults and command routing.
- Use `docs/agents/01-instruction-map.md` to route into deeper governance references.

## Table of Contents

- [Start Here](#start-here)
- [Lite Mode (Solo And Small Team)](#lite-mode-solo-and-small-team)
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
  - [Advanced Workflows](#advanced-workflows)
- [Command Reference](#command-reference)
- [Requirements](#requirements)
- [Local Development](#local-development)
- [Packaged Codex Skill](#packaged-codex-skill)
- [Issue Reporting](#issue-reporting)

## Start Here

Get from zero to a governed, agent-ready repository in five steps (standard path):

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

For CI migration, pilot evaluation, or workflow contracts, see [advanced workflows](#advanced-workflows).

## Lite Mode (Solo And Small Team)

Use lite mode when you want a low-friction setup first and governance depth later.

```bash
# 1. Minimal scaffold for solo/small-team adoption
harness init --minimal --track

# 2. Minimal policy contract (alias of minimal)
harness contract init --preset lite --force

# 3. Validate and inspect quickly
harness contract validate
harness check --json
```

Lite mode intentionally omits heavier surfaces such as docs-drift policy, diff
budget policy, evidence policy defaults, and full governance policy sections.
It keeps the contract focused on gate dispatch essentials.

Upgrade path from lite to standard:

```bash
harness contract init --preset standard --force
harness contract validate
```

That upgrade preserves your lightweight adoption start while adding the
recommended default policy layers for team-scale operation.

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

Security and governance posture details live in dedicated references:

- [`docs/security/2026-04-09-openssf-osps-baseline-status.md`](./docs/security/2026-04-09-openssf-osps-baseline-status.md)
- [`docs/agents/06-security-and-governance.md`](./docs/agents/06-security-and-governance.md)

Those docs track the OpenSSF baseline matrix, scorecard policy artifacts, and
security governance workflow expectations.

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

### Advanced Workflows

Advanced governance and rollout workflows are documented in:

- [`docs/advanced-workflows.md`](./docs/advanced-workflows.md)

That keeps this README focused on repo-facing onboarding and hero workflows.

## Command Reference

For full command coverage (including governance-heavy and advanced command families), use the dedicated reference:

- [`docs/cli-reference.md`](./docs/cli-reference.md)

For fast command discovery:

```bash
harness --help
harness commands --json
```

Most repo-facing workflows in this README are covered by these command families:

| Command | Purpose |
| --- | --- |
| `init` | Scaffold or update harness-managed repo surfaces |
| `check` | Zero-config repo health snapshot |
| `health` | Unified gate status scorecard |
| `contract` | Initialize, validate, or inspect contract schema |
| `upgrade` | Safely upgrade harness in an existing repo |
| `repo` | Grouped lifecycle entrypoint (`check`, `doctor`, `health`, `init`, `contract`, `verify`, `upgrade`, `eject`) |

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
