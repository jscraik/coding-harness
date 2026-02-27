# Coding Harness

Coding Harness is a TypeScript control plane for agentic development and policy-driven review workflows.

## Table of Contents

- [Quick start](#quick-start)
- [Quality checks](#quality-checks)
- [CLI command index](#cli-command-index)

## Quick start

```bash
pnpm install
pnpm build
node dist/cli.js --help
```

For local iteration without building first:

```bash
pnpm exec tsx src/cli.ts --help
```

## Quality checks

```bash
pnpm check
```

## CLI command index

| Command | Purpose |
| --- | --- |
| `init` | Install harness files into the current repository. |
| `risk-tier` | Classify changed files by risk. |
| `policy-gate` | Validate policy expectations from changed files. Alias: `risk-policy-gate`. |
| `replay` | Re-run policy checks from saved snapshots. |
| `evidence-verify` | Validate screenshot/evidence artifacts. |
| `gardener` | Detect stale docs and broken links. |
| `memory-gate` | Validate local-memory workflow compliance. |
| `preflight-gate` | Run fast policy checks before expensive operations. |
| `silent-error` | Detect silent error handling anti-patterns. |
| `diff-budget` | Enforce diff budget constraints. |
| `review-gate` | Enforce review checks and SHA guardrails. |
| `brainstorm-gate` | Validate brainstorm artifacts. |
| `plan-gate` | Validate plan artifacts. |
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
| `gap-case` | Track and resolve pilot gap-cases. |
| `pilot-evaluate` | Evaluate pilot metrics and promotion readiness. |
| `pilot-rollback` | Transition pilot mode (autonomous <-> manual). |

Use `harness --help` (or `node dist/cli.js --help`) for the current global options surface.

## Documentation

- [Implementation Status Matrix](docs/roadmap/agent-first-status.md) - Roadmap claims vs current implementation status
- [Harness Implementation Plan](docs/HARNESS_IMPLEMENTATION_PLAN.md) - Architecture and phase-by-phase execution plan
