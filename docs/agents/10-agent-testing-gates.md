# Agent testing gates

## Primary required gates

For any behavior-affecting change:

1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test`
4. `pnpm audit`
5. `pnpm check`

## Optional gates

- `pnpm build` when CLI output, entrypoints, or distribution artifacts change.
- Manual smoke checks for command-flow changes.
- PR-template and review-policy changes should also be checked against the current pull-request artifact contract (CodeRabbit plus Codex for this repository).

## Gate-by-gate intent

### `pnpm lint`

Catches static style and obvious correctness issues in repo code and config.

### `pnpm typecheck`

Ensures type contracts remain valid after edits.

### `pnpm test`

Validates behavioral invariants and regression coverage.

### `pnpm audit`

Detects dependency risk before merge.

### `pnpm check`

Aggregates the repo baseline contract for release-quality confidence.

## Failure policy

- Stop at first required-gate failure.
- Fix and rerun from first failed gate.
- If a gate is blocked by environment/tooling, document it clearly and do not declare complete.

## Reporting format

For each gate include:

- command,
- status (`pass` / `fail` / `blocked`),
- failure summary if applicable,
- and exact follow-up action.

## Human escalation

Escalate immediately when repeated failures indicate architectural assumptions changed or when checks cannot be executed due unavailable tooling.
