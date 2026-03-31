# Instruction map

## Table of Contents
- [Purpose](#purpose)
- [Decision map by task type](#decision-map-by-task-type)
- [Scope by document](#scope-by-document)
- [Discovery sequence for ambiguous instructions](#discovery-sequence-for-ambiguous-instructions)
- [Update policy](#update-policy)
- [Operational spec companions](#operational-spec-companions)
- [Canonical links](#canonical-links)

## Purpose

This repository keeps operational guidance in layers so operators can find the most relevant instructions without scanning every file.

- `AGENTS.md` gives the mandatory top-level baseline.
- `CLAUDE.md` holds mirrored Claude-facing guidance for this repo and should stay aligned with the canonical `AGENTS.md`.
- `00-architecture-bootstrap.md` defines architecture-artifact-first intake for high-impact tasks.
- `docs/agents/*.md` stores focused SOPs by task type.
- `docs/plans/*` and `todos/*` capture larger initiatives and backlog context.

## Decision map by task type

When starting a task, follow this lookup order:

1. Read `AGENTS.md` first.
2. Inspect `CLAUDE.md` only when checking mirrored cross-tool guidance or parity work; do not treat it as an auto-discovered Codex instruction file unless fallback filenames are explicitly configured.
3. Run `00-architecture-bootstrap.md` for architecture, policy, or cross-command changes.
4. Select one or more of the following based on intent:

   - **Environment/setup, command selection, or tool preference:** `02-tooling-policy.md`
   - **Memory/checkpoint workflow or per-project LEARNINGS.md:** `03-local-memory.md`
   - **Validation and gate planning:** `04-validation.md` + `10-agent-testing-gates.md`
   - **Flaky tests and evidence artifacts:** `11-flaky-test-artifacts.md`
   - **AI review policy, CodeRabbit merge authority, and legacy `.greptile/` governance:** `12-greptile-ai-governance.md`
   - **Linear-first intake and production tracker workflow:** `13-linear-production-workflow.md`
   - **Linear workflow (agent-optimized):** `16-linear-production-compact.md`
   - **Docs-gate rollout and promotion:** `14-docs-gate-rollout.md`
   - **Context-integrity control plane (agent-optimized):** `15-context-integrity-compact.md`
   - **CI required checks vs GitHub branch protection:** `17-ci-required-checks.md`
   - **GitHub → Linear branch/PR automation:** `18-github-linear-automation.md`
   - **Policy conflicts/inconsistencies:** `05-contradictions-and-cleanup.md`
   - **Security or secret handling:** `06-security-and-governance.md`
   - **Role/accountability changes:** `07a-role-governance.md` + `07b-agent-governance.md`
   - **Release milestone, rollback, or process change:** `08-release-and-change-control.md`
   - **Auditability requirements:** `09-audit-trail-policy.md`

5. If guidance is unclear, pause and resolve precedence before proceeding.

## Scope by document

### `AGENTS.md`

- One-sentence repo description and non-negotiable defaults.
- Required check and package-manager command set.
- Minimal command map and workflow priorities.

### `CLAUDE.md`

- Mirrored Claude-facing reminders.
- Canonical imports for Claude workflows.
- Not part of Codex's default project-doc discovery unless fallback filenames are configured.

### `docs/agents/` family

- Compact but actionable workflows tailored to specific operation categories.
- Conflict triage, governance expectations, and safety checks.
- Designed for quick lookups during task execution.

## Discovery sequence for ambiguous instructions

If two instructions conflict:

1. Check source authority:
   - repo-local evidence (`package.json`, `pnpm-lock.yaml`, `tsconfig.json`) over copied references.
2. Validate with the most recent layer touching the task.
3. Ask for explicit precedence resolution before making behavior-changing edits.

## Update policy

- Expand or update only when behavior for an operator changes.
- Keep the map truthful by removing stale links and adding newly introduced docs.
- Prefer single-purpose updates over broad rewrites.

## Operational spec companions

These deep-dive specs live alongside their parent SOPs and are not auto-discovered. Open only when you need implementation-level detail:

- [Agent testing gates ops spec](./agent-testing-gates-operational-spec.md) — companion to `10-agent-testing-gates.md`
- [Docs-gate rollout ops spec](./docs-gate-rollout-operational-spec.md) — companion to `14-docs-gate-rollout.md`
- [Linear workflow ops spec](./linear-workflow-operational-spec.md) — companion to `13-linear-production-workflow.md`
- [Release change control ops spec](./release-change-control-operational-spec.md) — companion to `08-release-and-change-control.md`
- [Review gate ops spec](./review-gate-operational-spec.md) — companion to `12-greptile-ai-governance.md`
- [Review gate workflow contract](./review-gate-workflow-contract.md) — companion to `12-greptile-ai-governance.md`

## Canonical links

- [Root AGENTS](../../AGENTS.md)
- [Architecture bootstrap](./00-architecture-bootstrap.md)
- [Tooling policy](./02-tooling-policy.md)
- [Local-memory workflow](./03-local-memory.md)
- [Validation and checks](./04-validation.md)
- [Contradictions and cleanup](./05-contradictions-and-cleanup.md)
- [Security and governance](./06-security-and-governance.md)
- [Role governance](./07a-role-governance.md)
- [Agent governance](./07b-agent-governance.md)
- [Release and change control](./08-release-and-change-control.md)
- [Audit trail policy](./09-audit-trail-policy.md)
- [Agent testing gates](./10-agent-testing-gates.md)
- [Flaky test artifact capture standard](./11-flaky-test-artifacts.md)
- [AI review governance](./12-greptile-ai-governance.md)
- [Linear production workflow](./13-linear-production-workflow.md)
- [Linear production compact](./16-linear-production-compact.md)
- [Docs-gate rollout](./14-docs-gate-rollout.md)
- [Context-integrity compact](./15-context-integrity-compact.md)
- [CI required checks vs branch protection](./17-ci-required-checks.md)
- [GitHub to Linear automation](./18-github-linear-automation.md)
- [Linear templates and saved views](./19-linear-templates.md)
