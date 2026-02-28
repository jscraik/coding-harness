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
- Agent-created branches must use `codex/<short-description>` naming.
- If a reproducible coding-harness bug/policy gap is found: create or update a GitHub issue with repro + evidence before handoff.
- If PR review artifacts are missing (Greptile/Codex for this repo): do not merge; complete reviews or explicitly escalate the exception.
- After merge completion: clean up branch/worktree to keep an auditable branch lifecycle.
- Triage in strict order: issue search/reuse → PR comments by current head SHA only → smallest-root-cause fix → rerun required gates.
- Use `harness review-gate` for SHA-bound validity, `harness remediate run/apply` for low/medium deterministic fixes, and `harness gap-case` for high-risk/manual escalation.
- Review score policy default: OPR >= 4/5 and Greptile = 5/5 unless an explicit waiver is documented.

## Optional quality expectations

- Keep docs changes focused.
- Avoid unnecessary rewording.
- Prefer reproducible evidence over assertions.
