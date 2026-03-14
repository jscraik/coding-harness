# Coding Harness

[![CI](https://github.com/jscraik/coding-harness/actions/workflows/pr-pipeline.yml/badge.svg)](https://github.com/jscraik/coding-harness/actions/workflows/pr-pipeline.yml)
[![Security](https://github.com/jscraik/coding-harness/actions/workflows/security-scan.yml/badge.svg)](https://github.com/jscraik/coding-harness/actions/workflows/security-scan.yml)
[![npm](https://img.shields.io/npm/v/@brainwav/coding-harness?label=npm)](https://www.npmjs.com/package/@brainwav/coding-harness)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

Executable governance for repositories using AI coding agents. Coding Harness bridges the gap between policy documents and enforced behavior through a contract-driven control plane.

## What it does

| Capability | Commands | Value |
|------------|----------|-------|
| **Repository scaffolding** | `init` | Install harness contracts, Greptile baselines, GitHub workflows, branch protection, and PR templates in one command |
| **Policy enforcement** | `policy-gate`, `docs-gate`, `plan-gate`, `review-gate`, `license-gate`, `linear-gate` | Validate code changes meet documentation parity, risk classification, plan traceability, Linear issue state, and license requirements |
| **CI migration** | `ci-migrate` | Phased migration between CI providers (GitHub Actions ↔ CircleCI) with snapshots, rollback, and parity validation |
| **Linear workflow** | `linear`, `linear-gate` | Automate Linear issue lifecycle with state transitions, PR attachment, and DoD handoff validation |
| **Drift detection** | `drift-gate`, `org-audit` | Detect governance drift across contract, docs, CI; scan multi-repo orgs for baseline deviations |
| **Evidence capture** | `evidence-verify`, `ui:explore`, `ui:verify` | Validate screenshot artifacts and run browser-based verification workflows |
| **Semantic search** | `context`, `search`, `index-context` | Hybrid lexical + semantic search across brainstorms, plans, and specs using local SQLite + embeddings |
| **Automation execution** | `automation-run`, `simulate` | Run idempotent automation playbooks (Pulse, Upskill, Green PRs) with counterfactual simulation |
| **Workflow generation** | `workflow:generate` | Generate compact operational specs from annotated markdown with SEGAPRN format |

## Quick start

```bash
# Install and build
pnpm install
pnpm build

# Initialize harness in a repository
node dist/cli.js init

# See all commands
node dist/cli.js --help
```

For local development without rebuilding:

```bash
pnpm exec tsx src/cli.ts --help
```

## The contract system

Coding Harness centers on `harness.contract.json` — a single declarative file that defines governance policy for your repository. The contract supports:

- **Preset inheritance** — Extend bundled, local, or remote presets with merge strategies
- **15+ policy domains** — Branch protection, CI provider, docs gates, evidence, remediation, context integrity, control-plane overrides, and more
- **SRI verification** — Remote presets can be integrity-verified

Example contract structure:

```json
{
  "version": "1.5.0",
  "riskTierRules": {
    "src/auth/**": "high",
    "src/api/**": "high",
    "src/lib/**": "medium",
    "**/*.test.ts": "low"
  },
  "branchProtection": {
    "requiredChecks": ["lint", "test", "security-scan"],
    "requirePullRequest": true,
    "requireConversationResolution": true
  },
  "docsGatePolicy": {
    "enabled": true,
    "mode": "advisory",
    "rules": [
      { "ruleId": "cli-surface-docs", "when": { "categories": ["cli_surface"] }, "requireDocs": ["README.md"], "severity": "error" }
    ]
  }
}
```

## CLI command index

### Governance

| Command | Purpose |
|---------|---------|
| `init` | Install harness contract, Greptile baseline, GitHub workflows, branch protection, and templates |
| `ci-migrate` | Phased CI provider migration with prepare/commit/abort, snapshots, and parity proof packs |
| `branch-protect` | Configure and maintain GitHub branch protection rulesets and required status checks |
| `risk-tier` | Classify files by risk tier (high/medium/low) |
| `policy-gate` | Validate policy expectations from changed files |

### Linear workflow

| Command | Purpose |
|---------|---------|
| `linear` | Automate Linear issue lifecycle with state transitions, PR attachment, and DoD handoff validation |
| `linear-gate` | Gate PRs on Linear issue state requirements and DoD pre-review checks |

### Documentation gates

| Command | Purpose |
|---------|---------|
| `docs-gate` | Enforce documentation parity for governance, tooling, architecture, and workflow docs |
| `gardener` | Detect stale docs and broken links |
| `verify-greptile` | Verify Greptile configuration, bridge workflow, and ruleset wiring |
| `request-greptile-review` | Post the standard `@greptileai` review trigger comment on a PR |

### Plan and review gates

| Command | Purpose |
|---------|---------|
| `plan-gate` | Validate plan IDs, acceptance evidence, and PR traceability to plans |
| `review-gate` | Enforce independent review requirements and SHA guardrails |
| `brainstorm-gate` | Validate brainstorm artifacts |
| `prompt-gate` | Validate prompt template usage |
| `pr-template-gate` | Validate PR template sections and placeholder replacement |

### Drift and consistency

| Command | Purpose |
|---------|---------|
| `drift-gate` | Evaluate consistency drift across contract, docs, and CI surfaces |
| `org-audit` | Multi-repo governance visibility and drift detection across an organization |
| `tooling-audit` | Multi-repo tooling baseline audit for managed repo surfaces |
| `context-health` | Generate advisory context-integrity scorecards with contradiction detection |

### Search and context

| Command | Purpose |
|---------|---------|
| `search` | Hybrid lexical (ripgrep) + semantic (embeddings) search with Ollama |
| `context` | Semantic search across indexed brainstorms, plans, and specs |
| `index-context` | Bulk index documents for local semantic search |
| `blast-radius` | Determine required checks from changed files |

### UI and evidence

| Command | Purpose |
|---------|---------|
| `ui:fast` | Storybook-first local development loop |
| `ui:verify` | Playwright smoke suite with evidence capture |
| `ui:explore` | Agent browser exploratory testing |
| `evidence-verify` | Validate screenshot/evidence artifacts against policy |

### Automation and simulation

| Command | Purpose |
|---------|---------|
| `automation-run` | Execute idempotent automation playbooks (Pulse, Upskill, Green PRs, Drift Check) |
| `simulate` | Run counterfactual policy simulation before enforcement |
| `remediate` | Auto-plan and execute deterministic remediation for scanner findings |
| `replay` | Re-run policy checks from saved snapshots for debugging |

### Pilot mode

| Command | Purpose |
|---------|---------|
| `pilot-evaluate` | Evaluate pilot metrics and determine promotion readiness |
| `pilot-rollback` | Transition pilot mode (autonomous ↔ manual) |
| `gap-case` | Track and resolve production gap cases with SLA enforcement |

### Issue tracking

| Command | Purpose |
|---------|---------|
| `linear-gate` | Enforce Linear-first intake, branch naming, and PR linkage |
| `linear-workflow` | Prepare Linear-aware branch/PR metadata and workflow state transitions |

### Workflow generation

| Command | Purpose |
|---------|---------|
| `workflow:generate` | Generate compact operational spec (`S/E/G/A/P/R/N` format) from annotated markdown |

### Utility

| Command | Purpose |
|---------|---------|
| `license-gate` | Validate open-source license compliance |
| `diff-budget` | Enforce diff budget constraints |
| `memory-gate` | Validate local-memory workflow compliance |
| `observability-gate` | Check metrics cardinality limits |
| `silent-error` | Detect silent error handling anti-patterns |
| `preflight-gate` | Fast policy checks before expensive operations |
| `check-authz` | Validate authorization policy for mutative operations |
| `check-environment` | Validate development environment setup |
| `preset` | List and inspect bundled presets |

## Quality checks

```bash
pnpm check        # lint + docs:lint + workflow:validate + typecheck + test + audit
pnpm lint         # Biome linting
pnpm docs:lint    # Markdown linting
pnpm typecheck    # TypeScript strict mode
pnpm test         # Vitest test suite
pnpm audit        # Security audit (moderate threshold)
pnpm test:deep    # Full check + artifact generation
```

## Security scanner baseline

Repositories using Harness should install:

- **Gitleaks** — Secret scanning
- **Trivy** — Vulnerability scanning
- **Semgrep** — Static analysis

Harness `init` enforces this baseline via the required `security-scan` check.

## Packaged Codex skill

The npm package includes a reusable Codex skill at `.agents/skills/coding-harness/SKILL.md`:

- Install/setup/update workflows for harness-managed repositories
- Capability-boundary guidance for safe harness usage
- Command discovery and best-practice patterns

```bash
# After installing the package
node_modules/@brainwav/coding-harness/.agents/skills/coding-harness/
```

## CI migration workflow

The `ci-migrate` command supports phased migration between GitHub Actions and CircleCI:

```bash
# Prepare migration (dry-run by default)
harness ci-migrate prepare --provider circleci

# Commit migration with snapshot continuity
harness ci-migrate commit --snapshot abc123

# Abort and rollback if issues found
harness ci-migrate abort --snapshot abc123
```

Features:
- Parity proof packs with scenario validation (pull_request, merge_queue, fork_pr, etc.)
- External control plane path tracking (rulesets, contexts, app installations)
- HMAC-signed snapshots for migration integrity
- Signed merge-queue orchestration evidence ingestion via `--merge-queue-evidence` (`ci-migrate-merge-queue-evidence/v2`, with repo/policy binding)
- Optional orchestration hook via `--merge-queue-orchestrator` (or default `.harness/control-plane/merge-queue-cutover-orchestrator` when present) to emit signed pause/drain/revalidate evidence during apply/commit
- Signed break-glass governance policy enforcement at `.harness/control-plane/ci-migrate-break-glass-policy.json` for rollback weakening approvals (allowlist, TTL, dual-approval)
- Required-mode CircleCI promotion fail-closes without signed merge-queue evidence at `.harness/control-plane/merge-queue-cutover-evidence.json` (or an explicit override path)
- Signed artifact-index bootstrap (`.harness/ci-parity-proof-artifact-index.json`) for provenance/proof-pack auto-generation

## Issue reporting

This repository uses **Linear-first** intake. Create or update work in the [coding-harness project](https://linear.app/jscraik/project/coding-harness-bb735dbbda79).

Internal agents can create Linear work directly when `LINEAR_API_KEY` is available. GitHub issues route to Linear, docs, or private security disclosure.

## Release flow

Publishes as a private npm package from tagged releases:

```bash
pnpm changelog     # Update CHANGELOG.md
pnpm release       # Cut release commit and tag
git push --follow-tags  # Trigger CI publish
```

Supports token auth (`NPM_TOKEN`) and OIDC trusted publisher (`NPM_PUBLISH_AUTH=oidc`).

## Documentation

- [Architecture Bootstrap](docs/agents/00-architecture-bootstrap.md) — Architecture-sensitive task intake
- [Instruction Map](docs/agents/01-instruction-map.md) — Navigate all documentation
- [Tooling Policy](docs/agents/02-tooling-policy.md) — Required tooling baseline
- [Validation](docs/agents/04-validation.md) — Check and gate reference
- [Security and Governance](docs/agents/06-security-and-governance.md) — Security baseline
- [Agent Governance](docs/agents/07b-agent-governance.md) — AI agent rules
- [Release and Change Control](docs/agents/08-release-and-change-control.md) — Release workflow
- [Agent Testing Gates](docs/agents/10-agent-testing-gates.md) — Testing requirements
- [Greptile AI Governance](docs/agents/12-greptile-ai-governance.md) — Review automation
- [Docs-Gate Rollout](docs/agents/14-docs-gate-rollout.md) — Documentation parity enforcement

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for:
- Branch naming (`codex/<linear-key>-<short-description>`)
- Required pre-merge gates
- Greptile setup and review workflow
- Branch protection settings
- Solo-developer friendly review setup

---

**Key principle**: Branch protection is the non-negotiable merge gate. `diff-budget` is a review-shaping signal, not a substitute for required status checks.
