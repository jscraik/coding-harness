---
last_validated: 2026-04-18
---

# Workflow Consistency Enforcer Prompt

## Table of Contents
- [Prompt](#prompt)
- [Output Contract](#output-contract)

## Prompt

Transform the workflow(s) below into `workflow-contract-v1` format.

Goals:
- minimize ambiguity,
- maximize execution reliability,
- keep output token-efficient.

Required method:
1. Use compact abbreviations where useful.
2. Represent workflow with a state machine plus a canonical transition table.
3. Transition table MUST use `S | E | G | A | N`.
4. Include executor pseudocode using first-match transition semantics.
5. Include at least one explicit blocked/fail path and unblock behavior.
6. Preserve existing policy constraints and DoD gates.
7. Prefer deterministic language over advisory prose.

Scope:
- Apply to all active workflow docs/files I provide.
- If a workflow is already close to contract, normalize only what is inconsistent.

Guardrails:
- Do not invent new runtime behavior.
- Do not remove required checks.
- Keep naming stable unless clarity requires rename.

## Output Contract

Return in this order:
1. `Normalized Workflows`: file-by-file changes in compact form.
2. `Transition Risks`: any ambiguous transitions or missing guards discovered.
3. `Validation Notes`: checks run, pass/fail status, and exact failing rule names.
