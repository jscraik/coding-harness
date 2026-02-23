# Agent governance

## Operating model

Agents are expected to be deterministic and auditable. Recommended execution loop:

1. Read instructions in scope.
2. Apply minimal patch.
3. Run required checks.
4. Report outcomes and risks.
5. Stop on blocked checks and request next decision.

## Mandatory gates (when behavior changes)

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm audit`
- `pnpm check`

## Evidence and communication

Every agent handoff should include:

- exact command list + result,
- file-level summary,
- remaining risks and assumptions,
- clear next step.

## Fail-safe rules

- If any required gate fails: stop, fix, and rerun from first failure.
- If command tooling is unavailable: mark check as blocked and escalate environment dependency.
- If instructions conflict: resolve precedence before further edits.

## Optional quality expectations

- Keep docs changes focused.
- Avoid unnecessary rewording.
- Prefer reproducible evidence over assertions.
