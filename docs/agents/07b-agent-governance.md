---
last_validated: 2026-05-18
---

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
- `bash scripts/validate-codestyle.sh`
- `docs-gate` (CI check for documentation parity)
- Code-review pass-through via PR workflow (no direct `main` commits).

When agent work changes tooling/runtime contract surfaces or architecture-context refresh behavior, the matching docs are part of the required gate, not optional polish:

- tooling/runtime changes should update `docs/agents/02-tooling-policy.md` and `docs/agents/06-security-and-governance.md`
- architecture-context refresh changes should update `docs/agents/00-architecture-bootstrap.md`; Flow Ops closure-evidence, E2E runner, or eval artifact changes that trigger that refresh should keep `AGENTS.md` and this guide synchronized when docs-gate reports the agent-governance category
- Flow Ops closure-evidence and outcome-closeout validation changes should keep
  the agent-governance handoff and closeout expectations in this guide
  synchronized with the implementation and required documentation surfaces so
  docs-gate does not pass with stale operator guidance.
- validation gate graph changes that add typed gate specs, phase-exit evidence gates, `harness next --phase-exit` visibility, parity tests, or resume-checkpoint guards should refresh `AI/context/diagram-context.md` and keep `AGENTS.md`, `docs/agents/00-architecture-bootstrap.md`, and this guide synchronized when docs-gate reports architecture-context or agent-governance surfaces
- runtime-card evidence adapter changes that add `--evidence` ingestion,
  normalized session evidence, or runtime-card source/blocker projection should
  keep `runtime-card/v1` advisory, artifact-backed, and constrained to
  `--repo`; refresh architecture context and synchronize `AGENTS.md`,
  `docs/agents/00-architecture-bootstrap.md`, and this guide when docs-gate
  reports governance surfaces
- runtime-card evidence producer changes that add or alter `--evidence-out`,
  `runtime-evidence-bundle/v1`, or producer/adapter wiring should refresh
  `AI/context/diagram-context.md` and keep `AGENTS.md`,
  `docs/agents/00-architecture-bootstrap.md`, and this guide synchronized
  when docs-gate reports architecture-context or agent-governance surfaces
- rule lifecycle governance changes that alter rule metadata validation, `.harness/rule-lifecycle-manifest.json`, `docs/rule-lifecycle.schema.json`, or `rule-lifecycle-gate` should keep this guide synchronized with `AGENTS.md`, `README.md`, and `docs/agents/00-architecture-bootstrap.md` when docs-gate reports agent-governance, contract-policy, or architecture-context surfaces
- workflow-authority routing and validation behavior changes should update `docs/agents/04-validation.md`, `docs/agents/08-release-and-change-control.md`, `docs/agents/10-agent-testing-gates.md`, and `docs/agents/14-docs-gate-rollout.md`
- agent-governance/category updates should keep `AGENTS.md` and this guide synchronized in the same PR
- north-star contract/scaffold updates that affect architecture context should update `docs/agents/00-architecture-bootstrap.md` and this guide in the same PR
- north-star artifact contract changes should keep the README command evidence
  surface, AGENTS shared-vocabulary guidance, and this guide synchronized in
  the same PR
- Project Brain or Harness Engineering control-plane changes should keep `.harness/README.md`, AGENTS, CONTRIBUTING, tooling policy, and security/governance guidance synchronized so agents know which `.harness` files are durable authority, secondary context, or generated runtime state.
- Tracked secondary `.harness` context is not enough to authorize implementation; agent execution should still route through admitted `.harness/linear`, `.harness/refactors`, `.harness/specs`, or `.harness/plan` slices.
- agent-native cockpit changes should keep next-action safety evidence, generated environment action contracts, and docs-gate-required operator surfaces synchronized before the PR can be considered merge-ready
- RouteDecision lifecycle metadata is part of the agent-native cockpit contract: `route-decision/v1` must remain additive to `harness-decision/v1`, must not make target commands executable authority by itself, and must keep architecture-context plus docs-gate-required governance surfaces synchronized
- generated hook setup or readiness changes should keep agent setup evidence synchronized: `scripts/setup-git-hooks.js` must install generated `prek` shims with repo-local `PREK_HOME`, and `scripts/check-environment.sh` must fail drift across installed `pre-commit`, `pre-push`, and `commit-msg` shims
- worktree bootstrap and generated Codex environment action changes should keep
  the shared Git common-config guard, detached-worktree branch attachment, and
  canonical tooling baseline synchronized across source scripts, scaffold
  templates, environment actions, AGENTS, README, tooling policy, and
  security/governance guidance
- worktree readiness may tolerate a local `mise trust` cache-write warning only
  when the remaining Git safety checks still run; ambiguous local or
  reachable-`origin` branch state must remain a hard stop before attachment
- generated readiness and environment setup changes should preserve caller-provided `PATH` precedence before adding standard tool fallbacks, so local wrappers, fixture shims, and branch-scoped validation evidence remain auditable
- environment-only push behavior is a narrow governance exception: if the branch diff contains only `.codex/environments/environment.toml`, `make hooks-pre-push` may run only `scripts/check-environment.sh`; any other changed file must use the full pre-push suite
- full pre-push diagram freshness must be branch-scoped: `make hooks-pre-push` passes the branch changed-file list into `scripts/check-diagram-freshness.sh --changed-files <path>` so agents do not refresh architecture artifacts for unrelated local worktree dirt
- goal-continuation and approval-plan contract changes should keep explicit
  authorization, fail-closed reviewer resolution, and snapshot-only state
  evidence visible through the same agent-native cockpit surfaces before PR
  handoff
- packaged coding-harness skill changes should keep AGENTS, README, skill
  eval cases, and this guide synchronized so downstream agent behavior,
  validation expectations, and anti-overfit criteria remain governed together
- PR-template contract changes should keep local validation, GitHub PR body
  structure, and reviewer handoff evidence synchronized so the work-performed
  ledger remains enforceable before closeout
- PR closeout evidence changes that add or alter `pr-closeout/v1`,
  `harness pr-closeout`, required PR metadata, or AI session/traceability
  evidence should stay read-only, tool-evidence-backed, secret-redacting, and
  synchronized with the PR template, validation docs, CLI docs, and AGENTS
- `pr-closeout/v1` success must come from current structured
  claim/evidence status rather than model-written summary text. Missing or
  stale required evidence should resolve to blocked or unknown with source,
  freshness, head SHA, blocker class, and verification timestamp retained for
  review.
- repeated steering feedback is an agent-governance signal, not a one-line
  patch request. PRs that encode steering feedback should record the broader
  design principle, search sibling implementations, update every required
  governance surface or durable destination, and list unchanged or deferred
  siblings in the PR template pattern scope inventory
- observed fixable blockers are also agent-governance evidence. When an agent
  notices a stale artifact, stale instruction, failing hook, flaky repeated
  command, or validation weakness in the active surface, it should fix the
  blocker in the same pass unless authority, credentials, destructive scope, or
  an explicitly tracked exception prevents the fix
- artifact-routine and pattern-scope command output should be treated as
  closeout evidence only when it is produced from the current repo state and the
  active Project Brain artifact still points at current Linear/spec/plan input
- same-error-twice troubleshooting is also an agent-governance signal. When
  the same command, test, or runtime error happens twice, the PR should record
  Repeated-error research: trusted web or upstream research, 3-5 candidate
  fixes, the chosen efficient fix, and the implementation that made the error
  class less likely to recur
- green required checks are not enough to declare closeout complete. Before an
  agent deletes a heartbeat, closes a lane, or starts the next slice, it should
  classify PR state, merge or auto-merge state, branch/worktree state, Linear
  state, next-lane routing, and any waiting owner or blocker. If the PR is open
  but blocked on review, merge, or approval, the correct status is waiting, not
  complete
- AI-assisted PRs should cite a concrete Codex/session-collector/harness run
  reference and, when available, CI, eval, runtime-card, evidence-bundle, or
  review trace references. Use `n.a.` only with a concrete reason, and keep raw
  transcripts, prompts, secrets, and bulky telemetry out of PR bodies.

## Evidence and communication

Every agent handoff should include:

- exact command list + result,
- file-level summary,
- remaining risks and assumptions,
- clear next step.
- CodeRabbit Semgrep disposition when findings were raised: fixed, explicitly waived with rationale, or not applicable.
- Exact behavior evidence whenever executable behavior changed, or a clear blocker note when the touched production path could not run safely.
- Canonical north-star artifact references when commands emit them; for
  example `drift-gate` writes
  `.harness/guardrails/north-star/drift-findings.json`, `doctor` writes
  `.harness/guardrails/north-star/surface-classification-snapshot.json`, and
  review-gate alignment decisions live at
  `.harness/guardrails/north-star/alignment-decision.json`.

When executable behavior changes, broad gates are necessary but not sufficient
on their own. Run the smallest real executable path that exercises the exact

production code touched whenever feasible, and run the changed-source ratchets:
`pnpm run quality:docstrings`, `pnpm run quality:size`, and
`pnpm run test:related`.

Prefer invoking the production function, class, CLI command, shell script,
validator, or route directly. If no existing test covers the path, create a
temporary local reproduction harness under `codex-scripts/`, keep it
gitignored, and import or invoke production code directly instead of copying
implementation into the harness.

## Fail-safe rules

- If any required gate fails: stop, fix, and rerun from first failure.
- If command tooling is unavailable: mark check as blocked and escalate environment dependency.
- If instructions conflict: resolve precedence before further edits.
- For this repository, agent-created branches must use `codex/<linear-key>-<short-description>` naming when the work is tracked in Linear.
- For downstream scaffold output, repositories scaffolded by `harness init` receive generated PR, workflow, and worktree guidance that uses `jscraik/feature/*` for agent-created branches; keep those emitted surfaces synchronized through the init scaffold prefix constant.
- CodeRabbit review must be independent from code authorship (coding agent cannot act as approving review agent).
- Legacy review bridge workflows may exist in downstream repositories, but they are not the primary review authority for this repository.
- CI ownership is enforced by `harness.contract.json` `ciOwnership`: CircleCI owns the primary PR gate, CodeRabbit remains the independent review check, Semgrep Cloud remains the independent external security check, and GitHub Actions workflows are release/fallback surfaces only unless an intentional contract migration says otherwise.
- Rollback expectation for CI-ownership changes: restore the previous `harness.contract.json` `ciOwnership` mapping and matching check-identity docs in the same PR, then re-run required governance/docs gates before merge.
- If a reproducible coding-harness bug, policy gap, workflow regression, automation task, or release follow-up is found: create or update a Linear issue with repro + evidence before handoff.
- If PR review artifacts are missing (CodeRabbit/Codex for this repo): do not merge; complete reviews or explicitly escalate the exception.
- If the `CodeRabbit` check is absent, pending, or failing for the current head SHA: do not merge.
- If `docs-gate` reports warning findings for required surfaces on the current head SHA: do not merge until those warnings are resolved in the PR.
- If CodeRabbit reports Semgrep findings: fix all `ERROR` findings before merge. `WARNING` findings may remain only when the PR records the rationale and containment.
- Any run of `harness linear*` commands must have `LINEAR_API_KEY` available in the runtime environment (or supplied with `--token`); if secrets are kept in `~/.codex/.env`, load it into the active shell/session first.
- When Linear secret discovery behavior changes, include `harness symphony-check` evidence so the runtime secret-loading path is auditable.
- After merge completion: clean up branch/worktree to keep an auditable branch lifecycle.

## Optional quality expectations

- Keep docs changes focused.
- Avoid unnecessary rewording.
- Prefer reproducible evidence over assertions.
