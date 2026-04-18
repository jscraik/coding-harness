---
last_validated: 2026-04-18
---

# Role governance

## Current state

There are no dedicated role-policy files in this repository yet. Responsibility remains explicit between human reviewers and agents.

## Role boundaries

- **Agents:** perform deterministic edits, run checks, propose follow-ups.
- **Humans:** set scope, resolve ambiguity, approve risky policy decisions, and merge.

## When to create a role doc

Create a role document only when roles become materially distinct, for example:

- Reviewer and executor responsibilities diverge by workflow.
- Different approval authority exists for releases vs routine edits.
- Human and agent authority requires explicit documentation.

## Escalation

Pause and ask for human direction when:

- A file is owned by a person/team with explicit non-agent governance.
- Policy scope crosses account/security or release permissions.
- Multiple agents operate on related tasks with overlapping ownership.

## Documentation expectations

Role documents should include:

- Scope and boundaries
- Approvals required
- Accountability and rollback owner
- Exception handling (if and when authority can be delegated)
