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
- Code-review pass-through via PR workflow (no direct `main` commits).

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
- Agent-created branches must use `codex/<linear-key>-<short-description>` naming when the work is tracked in Linear.
- Greptile must be configured with all required files via the `greploop` or `check-pr` skill before relying on Greptile review artifacts (`.greptile/config.json`, `.greptile/rules.md`, `.greptile/files.json`).
- Greptile review must be independent from code authorship (coding agent cannot act as approving review agent).
- If a reproducible coding-harness bug, policy gap, workflow regression, automation task, or release follow-up is found: create or update a Linear issue with repro + evidence before handoff.
- If PR review artifacts are missing (Greptile/Codex for this repo): do not merge; complete reviews or explicitly escalate the exception.
- If Greptile confidence score is below `4/5`: do not merge.
- After merge completion: clean up branch/worktree to keep an auditable branch lifecycle.

## Optional quality expectations

- Keep docs changes focused.
- Avoid unnecessary rewording.
- Prefer reproducible evidence over assertions.
