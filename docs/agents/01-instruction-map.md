# Instruction map

## Table of Contents
- [Purpose](#purpose)
- [Layer model](#layer-model)
- [Fast discovery order](#fast-discovery-order)
- [Task routing map](#task-routing-map)
- [Document roles](#document-roles)
- [Conflict resolution](#conflict-resolution)
- [Update policy](#update-policy)
- [Operational spec companions](#operational-spec-companions)
- [Canonical links](#canonical-links)

## Purpose

This repository keeps operational guidance layered so operators can route to the right instruction surface without loading unnecessary context. See [documentation layers](../architecture/documentation-layers.md) for the full progressive-disclosure model.

## Layer model

| Layer | Audience | Entry point |
| --- | --- | --- |
| **0 — Repo-facing** | All operators | `AGENTS.md` (auto-discovered) |
| **1 — Quickstart** | New users/agents | `quickstart.md` (3 hero workflows) |
| **2 — Core concepts** | Active contributors | Task-specific SOPs below |
| **3 — Extended reference** | Maintainers | Operational specs, rollout contracts |

Load only the layer you need. Never require a higher layer to execute a lower-layer task.

## Fast discovery order

1. Read `AGENTS.md` first.
2. For immediate execution, open [quickstart.md](./quickstart.md).
3. For a specific domain, use the task routing map below to choose the single relevant SOP.
4. For implementation-level detail, open the operational spec companion (Layer 3).
5. If guidance is unclear, stop and resolve precedence before proceeding.

## Task routing map

### Core (Layer 2) — open for domain-specific work

| Intent | Primary doc |
| --- | --- |
| Environment/setup, command selection, tool preference | [02-tooling-policy.md](./02-tooling-policy.md) |
| Memory/checkpoint workflow, per-project LEARNINGS | [03-local-memory.md](./03-local-memory.md) |
| Validation and gate planning | [04-validation.md](./04-validation.md) |
| Security and secret handling | [06-security-and-governance.md](./06-security-and-governance.md) |
| Release milestone, rollback, process change | [08-release-and-change-control.md](./08-release-and-change-control.md) |
| Linear-first intake and production tracker workflow | [13-linear-production-workflow.md](./13-linear-production-workflow.md) |

### Extended (Layer 3) — open only when deep detail is needed

| Intent | Primary doc |
| --- | --- |
| Architecture and cross-command changes | [00-architecture-bootstrap.md](./00-architecture-bootstrap.md) |
| Policy conflicts and inconsistencies | [05-contradictions-and-cleanup.md](./05-contradictions-and-cleanup.md) |
| Role/accountability changes | [07a-role-governance.md](./07a-role-governance.md) + [07b-agent-governance.md](./07b-agent-governance.md) |
| Auditability requirements | [09-audit-trail-policy.md](./09-audit-trail-policy.md) |
| Flaky tests and evidence artifacts | [11-flaky-test-artifacts.md](./11-flaky-test-artifacts.md) |
| AI review policy and CodeRabbit governance | [12-ai-review-governance.md](./12-ai-review-governance.md) |
| Docs-gate rollout and promotion | [14-docs-gate-rollout.md](./14-docs-gate-rollout.md) |
| Context-integrity control plane | [15-context-integrity-compact.md](./15-context-integrity-compact.md) |
| Linear workflow (agent-optimized compact) | [16-linear-production-compact.md](./16-linear-production-compact.md) |
| CI required checks vs branch protection | [17-ci-required-checks.md](./17-ci-required-checks.md) |
| GitHub to Linear branch and PR automation | [18-github-linear-automation.md](./18-github-linear-automation.md) |
| Linear templates and saved views | [19-linear-templates.md](./19-linear-templates.md) |
| Project Brain memory-extension rollout | [20-project-brain-memory-extension-rollout.md](./20-project-brain-memory-extension-rollout.md) |
| Planning precedence (projects/milestones/cycles) | [22-planning-precedence-policy.md](./22-planning-precedence-policy.md) |

## Document roles

| Surface | Layer | Role |
| --- | --- | --- |
| `AGENTS.md` | 0 | Compact mandatory operator baseline: defaults, startup flow, routing. |
| `quickstart.md` | 1 | Immediate execution surface: 3 hero workflows, 5 commands. |
| `docs/README.md` | 2 | Layered docs index for workflow, reference, and governance navigation. |
| `02`, `03`, `04`, `06`, `08`, `13` | 2 | Core operational SOPs. |
| All other `docs/agents/*.md` | 3 | Extended governance references and deep-dive specs. |
| `README.md` | — | Repo-facing overview, install, and primary workflows (not agent-policy). |
| `CLAUDE.md` / `GEMINI.md` | — | Mirrored tool-facing guidance aligned with `AGENTS.md`. |

## Conflict resolution

If instructions conflict:

1. Prefer repo-local evidence (`package.json`, lockfiles, `tsconfig.json`) over copied references.
2. Use the most recent layer touching the task.
3. Ask for explicit precedence resolution before behavior-changing edits.

## Update policy

- Expand or update only when behavior for an operator changes.
- Keep the map truthful by removing stale links and adding newly introduced docs.
- Prefer single-purpose updates over broad rewrites.
- Keep `docs/README.md` aligned when introducing, moving, or retiring stable docs families.
- Keep `CLAUDE.md` and `GEMINI.md` aligned with `AGENTS.md` when canonical routing changes.
- Assign new docs to exactly one layer; respect line budgets for Layer 0 (130 lines) and Layer 1 (80 lines).

## Operational spec companions

Layer 3 deep-dive specs live alongside their parent SOPs. Open only for implementation-level detail:

- [Agent testing gates ops spec](./agent-testing-gates-operational-spec.md) — companion to `10-agent-testing-gates.md`
- [Docs-gate rollout ops spec](./docs-gate-rollout-operational-spec.md) — companion to `14-docs-gate-rollout.md`
- [Linear workflow ops spec](./linear-workflow-operational-spec.md) — companion to `13-linear-production-workflow.md`
- [Release change control ops spec](./release-change-control-operational-spec.md) — companion to `08-release-and-change-control.md`
- [Review gate ops spec](./review-gate-operational-spec.md) — companion to `12-ai-review-governance.md`
- [Review gate workflow contract](./review-gate-workflow-contract.md) — companion to `12-ai-review-governance.md`

## Canonical links

- Core surfaces: [Root AGENTS](../../AGENTS.md), [Docs index](../README.md), [Quickstart](./quickstart.md), [Root CLAUDE](../../CLAUDE.md), [Root GEMINI](../../GEMINI.md)
- Reference index: [CLI reference](../cli-reference.md), [Advanced workflows](../advanced-workflows.md)
- Documentation architecture: [Documentation layers](../architecture/documentation-layers.md)
- Governance and workflow SOPs:
  [Architecture bootstrap](./00-architecture-bootstrap.md),
  [Tooling policy](./02-tooling-policy.md),
  [Local-memory workflow](./03-local-memory.md),
  [Validation and checks](./04-validation.md),
  [Contradictions and cleanup](./05-contradictions-and-cleanup.md),
  [Security and governance](./06-security-and-governance.md),
  [Role governance](./07a-role-governance.md),
  [Agent governance](./07b-agent-governance.md),
  [Release and change control](./08-release-and-change-control.md),
  [Audit trail policy](./09-audit-trail-policy.md),
  [Agent testing gates](./10-agent-testing-gates.md),
  [Flaky test artifact capture standard](./11-flaky-test-artifacts.md),
  [AI review governance](./12-ai-review-governance.md),
  [Linear production workflow](./13-linear-production-workflow.md),
  [Docs-gate rollout](./14-docs-gate-rollout.md),
  [Context-integrity compact](./15-context-integrity-compact.md),
  [Linear production compact](./16-linear-production-compact.md),
  [CI required checks vs branch protection](./17-ci-required-checks.md),
  [GitHub to Linear automation](./18-github-linear-automation.md),
  [Linear templates and saved views](./19-linear-templates.md),
  [Project Brain memory-extension rollout](./20-project-brain-memory-extension-rollout.md),
  [Planning precedence policy](./22-planning-precedence-policy.md)
