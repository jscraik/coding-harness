# Coding Harness

[![CI](https://github.com/jscraik/coding-harness/actions/workflows/pr-pipeline.yml/badge.svg)](https://github.com/jscraik/coding-harness/actions/workflows/pr-pipeline.yml)
[![Security](https://github.com/jscraik/coding-harness/actions/workflows/security-scan.yml/badge.svg)](https://github.com/jscraik/coding-harness/actions/workflows/security-scan.yml)
[![npm](https://img.shields.io/npm/v/@brainwav/coding-harness?label=npm)](https://www.npmjs.com/package/@brainwav/coding-harness)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

A TypeScript control plane for agentic development that enforces policy-driven review workflows, documentation parity, and governance-as-code.

## Table of Contents

- [What it does](#what-it-does)
- [Quick start](#quick-start)
- [Packaged Codex skill](#packaged-codex-skill)
- [Core capabilities](#core-capabilities)
- [CLI command index](#cli-command-index)
- [Quality checks](#quality-checks)
- [Release flow](#release-flow)
- [Contributing](#contributing)

## What it does

Coding Harness provides executable governance for repositories using AI coding agents. It bridges the gap between policy documents and enforced behavior through:

- **Repository scaffolding** (`init`) — Install harness contracts, Greptile baselines, GitHub workflows, and PR governance templates
- **Policy enforcement** (`policy-gate`, `risk-tier`, `docs-gate`) — Validate that code changes meet documentation, risk classification, and traceability requirements
- **Plan traceability** (`plan-gate`, `review-gate`) — Ensure PRs map to durable plan IDs with acceptance evidence
- **Drift detection** (`drift-gate`) — Monitor consistency between governance surfaces (contract, docs, CI)
- **Evidence capture** (`evidence-verify`, `ui:explore`) — Validate screenshot artifacts and browser-based workflows
- **Context search** (`context`, `index-context`) — Semantic search across brainstorms, plans, and specs via local SQLite+vectors

## Quick start

```bash
# Install dependencies
pnpm install

# Build the CLI
pnpm build

# See all commands
node dist/cli.js --help

# Initialize harness in another repository
node dist/cli.js init
```

For local iteration without building:

```bash
pnpm exec tsx src/cli.ts --help
```

## Packaged Codex skill

The npm package includes a reusable Codex skill bundle at `.agents/skills/coding-harness/SKILL.md`. This skill provides:

- Install/setup/update workflows for harness-managed repositories
- Capability-boundary guidance for safe harness usage
- Command discovery and best-practice patterns

After installing the package in another project:

```bash
# The skill is available at:
node_modules/@brainwav/coding-harness/.agents/skills/coding-harness/
```

## Core capabilities

- **Repository initialization** (`init`) — Scaffolds complete governance baselines including contracts, Greptile config, GitHub workflows, and documentation templates
- **Policy gates** (`policy-gate`, `risk-tier`, `docs-gate`, `linear-gate`, `plan-gate`, `review-gate`, `drift-gate`) — Validate code changes against risk tiers, documentation requirements, and traceability rules
- **Evidence and remediation** (`evidence-verify`, `remediate`, `replay`) — Validate artifacts, auto-fix scanner findings, and replay policy checks
- **Context and search** (`context`, `index-context`, `blast-radius`) — Semantic search across project documents and determine required checks from changes
- **UI and automation** (`ui:explore`, `automation-run`, `check-authz`) — Browser-based workflows and authorization validation
- **Repository maintenance** (`gardener`, `preflight-gate`, `tooling-audit`, `silent-error`, `observability-gate`) — Detect stale docs, audit tooling drift, and find anti-patterns
- **Pilot mode** (`pilot-evaluate`, `pilot-rollback`, `gap-case`) — Evaluate autonomous operation readiness and manage rollback procedures

See [detailed capability reference](#detailed-capability-reference) for command tables.

## CLI command index

Run `harness --help` for current global options. Commands by category:

| Category | Commands |
|----------|----------|
| **Governance** | `init`, `policy-gate`, `risk-tier`, `docs-gate`, `linear-gate`, `plan-gate`, `review-gate`, `drift-gate`, `branch-protect` |
| **Validation** | `evidence-verify`, `remediate`, `replay`, `blast-radius`, `preflight-gate`, `memory-gate`, `observability-gate` |
| **Search** | `context`, `index-context`, `search` |
| **UI/Automation** | `ui:explore`, `automation-run`, `check-authz` |
| **Maintenance** | `gardener`, `tooling-audit`, `silent-error`, `verify-greptile`, `request-greptile-review` |
| **Pilot** | `pilot-evaluate`, `pilot-rollback`, `gap-case` |

---

## Detailed capability reference

### Repository initialization (`init`)

Scaffolds a complete governance baseline into any repository:

- Harness contract file (`harness.contract.json`)
- Greptile configuration (`.greptile/config.json`, `.greptile/rules.md`, `.greptile/files.json`)
- GitHub Actions workflows (security scans, PR pipeline, Greptile bridge)
- Branch protection rules enforcement
- Required tooling baseline (`.mise.toml`, `Makefile`, `scripts/check-environment.sh`)
- Documentation templates (`AGENTS.md`, `CONTRIBUTING.md`)

### Governance commands

| Command | Purpose |
| --- | --- |
| `init` | Install harness contract, Greptile baseline, and PR governance templates into the current repository. |
| `risk-tier` | Classify changed files by risk. |
| `policy-gate` | Validate policy expectations from changed files. Alias: `risk-policy-gate`. |
| `replay` | Re-run policy checks from saved snapshots. |
| `evidence-verify` | Validate screenshot/evidence artifacts. |
| `gardener` | Detect stale docs and broken links. |
| `memory-gate` | Validate local-memory workflow compliance. |
| `preflight-gate` | Run fast policy checks before expensive operations. |
| `silent-error` | Detect silent error handling anti-patterns. |
| `diff-budget` | Enforce diff budget constraints. |
| `drift-gate` | Evaluate consistency drift across governance surfaces (advisory/health). |
| `review-gate` | Enforce review checks and SHA guardrails. |
| `branch-protect` | Configure/maintain branch protection rulesets and required status checks. |
| `tooling-audit` | Audit cross-repo tooling baseline drift against contract and generated repo surfaces. |
| `verify-greptile` | Verify required Greptile files, bridge workflow, ruleset wiring, and app/ruleset readiness. |
| `request-greptile-review` | Post the standard `@greptileai` review trigger comment on a PR. |
| `brainstorm-gate` | Validate brainstorm artifacts. |
| `plan-gate` | Validate plan artifacts, plan IDs, acceptance evidence, and PR traceability back to plans. |
| `prompt-gate` | Validate prompt template usage. |
| `blast-radius` | Determine required checks from changed files. |
| `observability-gate` | Check metrics cardinality limits. |
| `ui:fast` | Run Storybook-first local UI loop. |
| `ui:verify` | Run Playwright smoke tests with evidence. |
| `ui:explore` | Run exploratory browser workflow. |
| `context` | Search indexed brainstorm/plan context. |
| `index-context` | Bulk index docs for semantic search. |
| `remediate` | Apply automated fixes for findings. |
| `check-authz` | Validate authorization policy for mutative operations. |
| `check-environment` | Validate pilot environment governance checks. |
| `docs-gate` | Enforce documentation parity for governance, tooling/runtime, architecture-context, tracked workflow-authority docs (including routing, validation, release, and testing-gate runbooks), and tracked compound-workflow artifacts such as ADRs, specs, plans, and brainstorms. |
| `linear` | Prepare Linear-aware branch/PR metadata and move issues through claim, handoff, and close workflow states. |
| `linear-gate` | Enforce Linear-first intake, branch naming, and PR linkage rules from the contract. |
| `pr-template-gate` | Validate PR template sections, checklist status markers, and placeholder replacement before merge. |
| `gap-case` | Track and resolve pilot gap-cases. |
| `pilot-evaluate` | Evaluate pilot metrics and promotion readiness. |
| `pilot-rollback` | Transition pilot mode (autonomous <-> manual). |

### Policy gates

| Gate | Purpose |
|------|---------|
| `policy-gate` | Validate changed files against risk-tier rules in the contract |
| `risk-tier` | Classify files by risk (high: auth/api, medium: lib, low: tests) |
| `docs-gate` | Enforce documentation parity — code changes require matching doc updates |
| `linear-gate` | Verify Linear-first intake compliance (branch naming, PR linkage) |
| `plan-gate` | Validate plan IDs and acceptance evidence traceability |
| `review-gate` | Enforce independent review requirements and SHA guardrails |
| `drift-gate` | Detect governance consistency drift across contract, docs, and CI |

### Evidence and remediation

| Command | Purpose |
|---------|---------|
| `evidence-verify` | Validate screenshot/evidence artifacts against policy |
| `remediate` | Apply automated fixes for findings from scanners (CodeQL, Greptile, Codex) |
| `replay` | Re-run policy checks from saved snapshots for debugging |

### Context and search

| Command | Purpose |
|---------|---------|
| `context` | Semantic search across indexed brainstorms, plans, and specs |
| `index-context` | Bulk index documents for local semantic search (SQLite + sqlite-vec) |
| `blast-radius` | Determine required checks from changed files |

### UI and automation

| Command | Purpose |
|---------|---------|
| `ui:explore` | Run exploratory browser workflows with Playwright |
| `automation-run` | Execute automation playbooks with idempotency checks |
| `check-authz` | Validate authorization policy for mutative operations |

### Repository maintenance

| Command | Purpose |
|---------|---------|
| `gardener` | Detect stale docs, broken links, and documentation debt |
| `preflight-gate` | Fast policy checks before expensive operations |
| `tooling-audit` | Audit cross-repo tooling baseline drift |
| `silent-error` | Detect silent error handling anti-patterns |
| `observability-gate` | Check metrics cardinality limits |
| `check-environment` | Validate development environment setup |

### Pilot mode commands

| Command | Purpose |
|---------|---------|
| `pilot-evaluate` | Evaluate pilot metrics and promotion readiness |
| `pilot-rollback` | Transition pilot mode (autonomous ↔ manual) |
| `gap-case` | Track and resolve pilot gap cases |

---

## Quality checks

The baseline check bundle runs all gates:

```bash
pnpm check        # lint + docs:lint + typecheck + test + audit
```

Individual checks:

```bash
pnpm lint         # Biome linting
pnpm docs:lint    # Markdown linting
pnpm typecheck    # TypeScript type checking
pnpm test         # Vitest test suite
pnpm audit        # Security audit
```

Deep validation (with artifacts):

```bash
pnpm test:deep    # Full check bundle + artifact generation
```

## Security scanner baseline

Repositories using Harness should install:

- **Gitleaks** — Secret scanning
- **Trivy** — Vulnerability scanning
- **Semgrep** — Static analysis

Harness `init` enforces this baseline via the required `security-scan` check.

## Benchmark track (SWE)

Benchmark setup and run scripts live in [`docs/benchmarks/README.md`](docs/benchmarks/README.md).

Recommended cadence:

- Weekly benchmark run on `main`
- Pre-release benchmark run before cutting tags

## Issue reporting

This repository uses **Linear-first** intake. Create or update work in the [coding-harness project](https://linear.app/jscraik/project/coding-harness-bb735dbbda79).

Internal agents can create Linear work directly when `LINEAR_API_KEY` is available. GitHub issue forms are retired; issues route to Linear, docs, or private security disclosure.

## Release flow

Publishes as a private npm package from tagged releases:

```bash
# Update changelog
pnpm changelog

# Cut release commit and tag
pnpm release

# Push to trigger CI publish
git push --follow-tags
```

The GitHub workflow `release-private-npm.yml` handles publishing. Supports:

- Token auth (`NPM_TOKEN`)
- OIDC trusted publisher (`NPM_PUBLISH_AUTH=oidc`)

## Documentation

- [Implementation Status Matrix](docs/roadmap/agent-first-status.md) — Roadmap vs implementation
- [Harness Implementation Plan](docs/HARNESS_IMPLEMENTATION_PLAN.md) — Architecture and execution plan
- [Architecture Bootstrap](docs/agents/00-architecture-bootstrap.md) — Architecture-sensitive task intake
- [Instruction Map](docs/agents/01-instruction-map.md) — Navigate all documentation

## Contributing

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) for:

- Branch naming (`codex/<linear-key>-<short-description>`)
- Required pre-merge gates
- Greptile setup and review workflow
- Branch protection settings
- Solo-developer friendly review setup

---

**Key principle**: Branch protection is the non-negotiable merge gate. `diff-budget` is a review-shaping signal, not a substitute for required status checks.
