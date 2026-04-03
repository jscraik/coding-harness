# Agent governance

## Table of Contents

- [Operating model](#operating-model)
- [Mandatory gates (when behavior changes)](#mandatory-gates-when-behavior-changes)
- [Evidence and communication](#evidence-and-communication)
- [Fail-safe rules](#fail-safe-rules)
- [Optional quality expectations](#optional-quality-expectations)

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
- `docs-gate` (CI check for documentation parity)
- Code-review pass-through via PR workflow (no direct `main` commits).

When agent work changes tooling/runtime contract surfaces or architecture-context refresh behavior, the matching docs are part of the required gate, not optional polish:
- tooling/runtime changes should update `docs/agents/02-tooling-policy.md` and `docs/agents/06-security-and-governance.md`
- architecture-context refresh changes should update `docs/agents/00-architecture-bootstrap.md`
- workflow-authority routing and validation behavior changes should update `docs/agents/04-validation.md`, `docs/agents/08-release-and-change-control.md`, `docs/agents/10-agent-testing-gates.md`, and `docs/agents/14-docs-gate-rollout.md`

## Evidence and communication

Every agent handoff should include:

- exact command list + result,
- file-level summary,
- remaining risks and assumptions,
- clear next step.
- CodeRabbit Semgrep disposition when findings were raised: fixed, explicitly waived with rationale, or not applicable.

## Fail-safe rules

- If any required gate fails: stop, fix, and rerun from first failure.
- If command tooling is unavailable: mark check as blocked and escalate environment dependency.
- If instructions conflict: resolve precedence before further edits.
- Agent-created branches must use `codex/<linear-key>-<short-description>` naming when the work is tracked in Linear.
- CodeRabbit review must be independent from code authorship (coding agent cannot act as approving review agent).
- Legacy review bridge workflows may exist in downstream repositories, but they are not the primary review authority for this repository.
- If a reproducible coding-harness bug, policy gap, workflow regression, automation task, or release follow-up is found: create or update a Linear issue with repro + evidence before handoff.
- If PR review artifacts are missing (CodeRabbit/Codex for this repo): do not merge; complete reviews or explicitly escalate the exception.
- If the `CodeRabbit` check is absent, pending, or failing for the current head SHA: do not merge.
- If CodeRabbit reports Semgrep findings: fix all `ERROR` findings before merge. `WARNING` findings may remain only when the PR records the rationale and containment.
- After merge completion: clean up branch/worktree to keep an auditable branch lifecycle.

## Optional quality expectations

- Keep docs changes focused.
- Avoid unnecessary rewording.
- Prefer reproducible evidence over assertions.
