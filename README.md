---
doc_schema: coding-harness-doc/v1
doc_type: product
authority: canon
canon_class: canonical
distribution: source-only
audience:
  - human-operator
  - coding-harness-maintainer
  - codex-agent
lifecycle_state: active
owner: coding-harness-maintainers
created: 2026-06-04
last_reviewed: 2026-06-04
review_cadence: quarterly
maintenance_trigger:
  - product-surface-change
  - install-workflow-change
  - release-contract-change
semver_impact: minor
validated_by:
  - pnpm docs:lifecycle
depends_on:
  - ARCHITECTURE.md
  - docs/brand/README.md
  - docs/README.md
  - harness.contract.json
---

# Coding Harness

Status: [CircleCI main](https://app.circleci.com/pipelines/github/jscraik/coding-harness?branch=main) | [npm package](https://www.npmjs.com/package/@brainwav/coding-harness) | [Apache-2.0 license](LICENSE) | [OpenSSF Scorecard](https://scorecard.dev/viewer/?uri=github.com/jscraik/coding-harness)

![synAIpse AI Delivery Harness logo](./docs/brand/synaipse-logo.png)

synAIpse is the AI Delivery Harness implemented by this repository and the `@brainwav/coding-harness` package. It gives AI-assisted repositories a small command surface for orientation, local verification, review policy, CI migration, durable memory, and evidence-backed handoff.

Short version: thin surface, strong guardrails, durable memory, professional output.

Coding Harness exists to let a solo developer with limited cognitive bandwidth
orchestrate agentic software work to professional standards through compact
orientation, executable guardrails, durable memory, and evidence-based handoff.
Its primary metric is PR lead time from open to merge, and its primary
bottleneck is the review and rework loop.

## Table of Contents

- [Start Here](#start-here)
- [What It Does](#what-it-does)
- [Install](#install)
- [Use It](#use-it)
- [For Contributors](#for-contributors)
- [Where To Go Next](#where-to-go-next)

## Start Here

Pick the job that matches your situation; the reference links can wait until you need them.

| Job | First command | Then read |
| --- | --- | --- |
| Agent in an existing repo | `harness next --json` | [Use It](#use-it) |
| Human trying harness | `harness init --dry-run` | [Install](#install) |
| Solo or small-team adopter | `harness init --minimal --track` | [Lite adoption](#lite-adoption) |
| Maintainer changing this repo | `AGENTS.md` | [For Contributors](#for-contributors) |
| Expert looking for commands | `harness commands --json` | [CLI reference](./docs/cli-reference.md) |

The cockpit command is read-only and recommends an existing safe command instead of inventing a workflow:

```bash
harness next --json
```

## What It Does

Coding Harness is the control plane around AI coding agents. It is not the agent runtime and it does not replace human review.

It helps a repository answer five practical questions:

- **What should the agent do next?** `harness next --json` turns local state into a safe next-command recommendation.
- **Is this repo ready for agent work?** `init`, `check`, `doctor`, `health`, and `contract validate` expose setup gaps.
- **What must pass before handoff?** `verify-work`, `docs-gate`, `review-gate`, `plan-gate`, and related gates make proof explicit.
- **Can we change CI or policy without guessing?** `ci-migrate`, branch-protection sync, rollback metadata, and parity checks keep migration reversible.
- **Did we learn anything durable?** Project Brain, Local Memory, learning gates, and review-context tooling turn repeated steering into guardrails instead of repeated reminders.

The product bar is simple: a dropped-in agent should diagnose, bootstrap, validate, and explain blockers without the user wiring the operating system by hand.

## Install

Published package usage requires registry access to `@brainwav/coding-harness`.

```bash
pnpm add -g @brainwav/coding-harness
harness --help
```

If your team uses `mise`, install the package through the pinned npm tool flow:

```bash
mise install -g npm:@brainwav/coding-harness
```

Then preview the scaffold before writing files:

```bash
harness init --dry-run
```

Apply the standard scaffold only after the preview looks right:

```bash
harness init --track
harness contract validate
harness health --json
```

### Lite Adoption

Use lite mode when you want the smallest useful contract first.

```bash
harness init --minimal --track
harness contract init --preset lite --force
harness contract validate
harness check --json
```

Upgrade from lite to the standard policy set when the team is ready:

```bash
harness contract init --preset standard --force
harness contract validate
```

## Use It

### Bootstrap A Repository

```bash
harness init --dry-run
harness init --track
harness contract validate
harness health --json
```

Use this when a repository needs harness-managed contracts, workflow scaffolding, review policy surfaces, repo-local verification scripts, and rollback metadata.

### Start Work On An Issue

```bash
harness linear prepare --issue <KEY>
harness preflight-gate --contract harness.contract.json --files <changed-files> --admission-file artifacts/admission/declaration.json
harness policy-gate --contract harness.contract.json --files <changed-files>
harness blast-radius --files <changed-files> --json
```

Use this when you need branch context, traceability, and file-scoped gates before implementation.

### Submit A Change For Review

```bash
harness docs-gate --mode advisory --json
harness plan-gate --require-plan-id --require-traceability --json
harness review-gate --token "$GITHUB_TOKEN" --owner <owner> --repo <repo> --pr <number> --sha <head-sha>
harness verify-coderabbit --json
```

Use this when a PR needs local proof, review wiring checks, and traceability before handoff. See the operator docs for closeout rules.

### Migrate CI With Rollback

```bash
harness ci-migrate prepare --provider circleci --dry-run
harness ci-migrate prepare --provider circleci --apply
harness ci-migrate verify --snapshot <snapshot-id>
harness ci-migrate commit --snapshot <snapshot-id>
```

Use this when CI migration needs proof, parity checks, branch-protection sync, and an abort path.

## For Contributors

This README is the product front door, not the operator policy surface.

Use these files for contribution and agent-operating rules:

- [AGENTS.md](./AGENTS.md) for mandatory repo guidance, startup workflow, quality checks, and repo workflow.
- [Instruction map](./docs/agents/01-instruction-map.md) for routing into the right operator doc.
- [Tooling policy](./docs/agents/02-tooling-policy.md) for commands and environment setup.
- [Validation](./docs/agents/04-validation.md) for local proof and gate selection.
- [Security and governance](./docs/agents/06-security-and-governance.md) for secrets, policy, and trust boundaries.

## Where To Go Next

- [Quickstart](./docs/agents/quickstart.md) for the agent-native loop and local verification path.
- [CLI reference](./docs/cli-reference.md) for the full command catalog.
- [Advanced workflows](./docs/advanced-workflows.md) for deeper rollout and migration paths.
- [Docs index](./docs/README.md) for governed documentation layers.
- [Architecture](./ARCHITECTURE.md) for source boundaries and invariants.
- [AGENTS.md](./AGENTS.md) and [docs/agents/](./docs/agents/) for operator policy.
- [North star](./docs/roadmap/north-star.md) and [agent-first status](./docs/roadmap/agent-first-status.md) for product direction.
- [Trust artifact examples](./docs/examples/trust-artifacts/) for sample outputs.
- [Packaged Codex skill](./.agents/skills/coding-harness/SKILL.md) for downstream agent instructions.

Issue intake is Linear-first for this repository: use the [coding-harness project](https://linear.app/jscraik/project/coding-harness-bb735dbbda79).
