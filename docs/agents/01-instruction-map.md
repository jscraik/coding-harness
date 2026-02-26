# Instruction map

## Purpose

This repository keeps operational guidance in layers so operators can find the most relevant instructions without scanning every file.

- `AGENTS.md` gives the mandatory top-level baseline.
- `CLAUDE.md` holds conversational always-on guidance for this repo.
- `docs/agents/*.md` stores focused SOPs by task type.
- `docs/plans/*` and `todos/*` capture larger initiatives and backlog context.

## Decision map by task type

When starting a task, follow this lookup order:

1. Read `AGENTS.md` and `CLAUDE.md` first.
2. Select one or more of the following based on intent:

   - **Environment/setup, command selection, or tool preference:** `02-tooling-policy.md`
   - **Memory/checkpoint workflow:** `03-local-memory.md`
   - **Validation and gate planning:** `04-validation.md` + `10-agent-testing-gates.md`
   - **Flaky tests and evidence artifacts:** `11-flaky-test-artifacts.md`
   - **Policy conflicts/inconsistencies:** `05-contradictions-and-cleanup.md`
   - **Security or secret handling:** `06-security-and-governance.md`
   - **Role/accountability changes:** `07a-role-governance.md` + `07b-agent-governance.md`
   - **Release milestone, rollback, or process change:** `08-release-and-change-control.md`
   - **Auditability requirements:** `09-audit-trail-policy.md`

3. If guidance is unclear, pause and resolve precedence before proceeding.

## Scope by document

### `AGENTS.md`

- One-sentence repo description and non-negotiable defaults.
- Required check and package-manager command set.
- Minimal command map and workflow priorities.

### `CLAUDE.md`

- Conversational and context-specific reminders.
- Canonical imports for humans and agents.
- What to include in closeout notes.

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

## Canonical links

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
