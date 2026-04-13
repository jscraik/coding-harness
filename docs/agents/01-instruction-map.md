# Instruction map

## Table of Contents
- [Purpose](#purpose)
- [Fast discovery order](#fast-discovery-order)
- [Task routing map](#task-routing-map)
- [Document roles](#document-roles)
- [Conflict resolution](#conflict-resolution)
- [Update policy](#update-policy)
- [Operational spec companions](#operational-spec-companions)
- [Canonical links](#canonical-links)

## Purpose

This repository keeps operational guidance layered so operators can route to the right instruction surface without loading unnecessary context.

- `README.md` is the product entry point (overview, install, common workflows).
- `docs/README.md` and `AGENTS.md` are the default operator discovery surfaces.
- `docs/agents/*.md` holds routed governance and workflow SOP detail.
- `CLAUDE.md` and `GEMINI.md` mirror canonical routing from `AGENTS.md`.

## Fast discovery order

1. Read `AGENTS.md` first.
2. Inspect `CLAUDE.md` or `GEMINI.md` only for parity checks; do not treat either as an auto-discovered Codex instruction file unless fallback filenames are explicitly configured.
3. Open `00-architecture-bootstrap.md` for architecture, policy, or cross-command changes.
4. Use the task routing map below to choose the task-specific SOP(s).
5. If guidance is unclear, stop and resolve precedence before proceeding.

## Task routing map

| Intent | Primary doc(s) |
| --- | --- |
| Environment/setup, command selection, tool preference | `02-tooling-policy.md` |
| Project Brain memory-extension rollout across repos | `20-project-brain-memory-extension-rollout.md` |
| Memory/checkpoint workflow, per-project LEARNINGS | `03-local-memory.md` |
| Validation and gate planning | `04-validation.md` + `10-agent-testing-gates.md` |
| Flaky tests and evidence artifacts | `11-flaky-test-artifacts.md` |
| AI review policy and CodeRabbit governance | `12-ai-review-governance.md` |
| Linear-first intake and production tracker workflow | `13-linear-production-workflow.md` |
| Linear workflow (agent-optimized) | `16-linear-production-compact.md` |
| Docs-gate rollout and promotion | `14-docs-gate-rollout.md` |
| Context-integrity control plane (agent-optimized) | `15-context-integrity-compact.md` |
| CI required checks vs GitHub branch protection | `17-ci-required-checks.md` |
| GitHub to Linear branch and PR automation | `18-github-linear-automation.md` |
| Policy conflicts and inconsistencies | `05-contradictions-and-cleanup.md` |
| Security and secret handling | `06-security-and-governance.md` |
| Role/accountability changes | `07a-role-governance.md` + `07b-agent-governance.md` |
| Release milestone, rollback, process change | `08-release-and-change-control.md` |
| Auditability requirements | `09-audit-trail-policy.md` |

## Document roles

| Surface | Role |
| --- | --- |
| `README.md` | Repo-facing overview, install, and primary workflows. |
| `docs/README.md` | Layered docs index for workflow, reference, and governance navigation. |
| `AGENTS.md` | Compact mandatory operator baseline: defaults, startup flow, and routing. |
| `CLAUDE.md` and `GEMINI.md` | Mirrored tool-facing guidance that stays aligned with canonical `AGENTS.md`; not auto-discovered by Codex unless fallback filenames are configured. |
| `docs/agents/*.md` | Extended governance references and task-specific SOP detail. |

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

## Operational spec companions

These deep-dive specs live alongside their parent SOPs and are not auto-discovered. Open only for implementation-level detail:

- [Agent testing gates ops spec](./agent-testing-gates-operational-spec.md) — companion to `10-agent-testing-gates.md`
- [Docs-gate rollout ops spec](./docs-gate-rollout-operational-spec.md) — companion to `14-docs-gate-rollout.md`
- [Linear workflow ops spec](./linear-workflow-operational-spec.md) — companion to `13-linear-production-workflow.md`
- [Release change control ops spec](./release-change-control-operational-spec.md) — companion to `08-release-and-change-control.md`
- [Review gate ops spec](./review-gate-operational-spec.md) — companion to `12-ai-review-governance.md`
- [Review gate workflow contract](./review-gate-workflow-contract.md) — companion to `12-ai-review-governance.md`

## Canonical links

- Core surfaces: [Root AGENTS](../../AGENTS.md), [Docs index](../README.md), [Root CLAUDE](../../CLAUDE.md), [Root GEMINI](../../GEMINI.md)
- Reference index: [CLI reference](../cli-reference.md), [Advanced workflows](../advanced-workflows.md)
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
  [Project Brain memory-extension rollout](./20-project-brain-memory-extension-rollout.md)
