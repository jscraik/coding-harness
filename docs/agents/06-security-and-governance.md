# Security and governance

## Security posture

This repository follows conservative defaults:

- Minimal command surface in docs and scripts.
- Explicitly avoid ad hoc global installs and hidden mutation.
- Preserve existing dependency and execution boundaries (`pnpm` + lockfile-driven installs).

## Secret handling

- Never place tokens, keys, or PII in docs, command output, commit text, or memory notes.
- If sensitive material appears in a file, sanitize and rotate as soon as practical.
- Keep environment-specific credentials outside repo and out of command snippets unless placeholders are explicit.

## Code and data governance

- Validate behavior changes before merge using documented gates.
- Keep audit trail artifacts (closeout outputs, validation status) in the task record.
- For high-risk edits (policy/validation gates), include rollback expectations in docs.

## Risk controls

- Do not skip required gates to save time.
- If checks fail repeatedly, stop and request decision on risk acceptance.
- Treat stale check output as non-evidence.

## Governance escalation

- Escalate to human owner for:
  - Security policy conflicts
  - Permission or secret leakage concerns
  - Any command that modifies global environment settings

## Operational check list

- Package manager consistency verified in repo files.
- No unauthorized command or toolchain mutation.
- Validation gate outputs captured.
- No secrets in docs/memory.
