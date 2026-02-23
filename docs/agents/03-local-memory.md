# Local-memory workflow

## Intent

Local memory is for durable continuity, not raw scratchpad logs. Use it for repository-level decisions, conventions, and recurring process knowledge.

## Required preamble before durable capture

Run both in the target session:

- `bootstrap(mode="minimal", include_questions=true, session_id="repo:<name>:task:<id>")`
- `search(query="...", session_id="repo:<name>:task:<id>")`

Do not write durable notes before this pre-check.

## Canonical capture pattern

Use `observe(...)` with:

- `level`: `observation` for raw capture, `learning` for interpreted takeaways.
- `content`: factual sentence with direct evidence path.
- `tags`: stable taxonomy (`coding-harness`, `policy`, `validation`).
- Optional `source`: command, log, or file path.

### Example

- **Level:** `observation`
- **Content:** `AGENTS.md currently requires `pnpm check` as mandatory validation gate for repo changes.`
- **Tags:** `["coding-harness","validation","policy"]`
- **Session ID:** `repo:coding-harness:task:agent-docs`

## What counts as durable

- Decision outcomes when instructions are resolved.
- Contradiction resolutions that affect behavior.
- Verification policy changes.

## What should not be durable

- Raw command output dumps.
- Single-session debugging noise.
- Speculative interpretations without evidence.

## Data minimization

- Exclude secrets, tokens, API keys, credentials, and PII.
- If any sensitive value appears in local notes, sanitize before persist.

## Conflict and correction process

When global or local guidance differs:

1. Verify in current `session_id` and repository evidence.
2. Record the conflict and chosen precedence.
3. Update docs or memory only after resolution.
4. Do not overwrite older durable entries without rationale.

## Maintenance cadence

Review memory notes when:

- A recurring ambiguity appears during repeated tasks.
- New validation gates or release rules are adopted.
- Policy ownership changes.
