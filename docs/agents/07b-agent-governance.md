---
last_validated: 2026-05-31
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

Recurring judgment should become a small operating primitive. If an agent needs
the same judgment twice, or a failure mode can recur across slices, promote it
into the smallest durable tool that changes future behavior: validator, guard
script, CLI helper, workflow hook, fixture, or scoped skill. Keep one-off
implementation knowledge in implementation notes, plan evidence, or PR closeout
evidence. Use skills only for reusable routed workflows with explicit inputs,
artifacts, validation, ownership, and review expectations.

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

- Every implementation slice must complete PR `Documentation impact` classification before handoff: update applicable root docs (`README.md`, `SECURITY.md`, `CONTRIBUTING.md`, `AGENTS.md`, `ARCHITECTURE.md`), governed docs, and existing deep-module README files, or record `n.a.` with a reason in the PR `Documentation impact` field
- tooling/runtime changes should update `docs/agents/02-tooling-policy.md` and `docs/agents/06-security-and-governance.md`
- preflight or Local Memory enforcement changes should keep `AGENTS.md`, `README.md`, `docs/agents/02-tooling-policy.md`, `docs/agents/03-local-memory.md`, `docs/agents/06-security-and-governance.md`, and this guide synchronized; legacy positional `scripts/codex-preflight.sh` invocations must default to required Local Memory mode unless `off` or `optional` is explicitly supplied
- architecture-context refresh changes should update `docs/agents/00-architecture-bootstrap.md`; Flow Ops closure-evidence, E2E runner, or eval artifact changes that trigger that refresh should keep `AGENTS.md` and this guide synchronized when docs-gate reports the agent-governance category
- diagram refresh tooling should validate and run through the repo-owned `pnpm exec diagram` path rather than requiring a global `diagram` binary on PATH, so disposable worktrees and hook execution use the same dependency contract
- generated diagram identity rewrites should update every dependent Mermaid reference, including class selectors, and keep AGENTS, the architecture bootstrap guide, this guide, generated diagram artifacts, and regression coverage synchronized when docs-gate reports architecture-context or agent-governance surfaces
- Flow Ops closure-evidence and outcome-closeout validation changes should keep
  the agent-governance handoff and closeout expectations in this guide
  synchronized with the implementation and required documentation surfaces so
  docs-gate does not pass with stale operator guidance.
- validation gate graph changes that add typed gate specs, phase-exit evidence gates, `harness next --phase-exit` visibility, parity tests, or resume-checkpoint guards should refresh `AI/context/diagram-context.md` and keep `AGENTS.md`, `docs/agents/00-architecture-bootstrap.md`, and this guide synchronized when docs-gate reports architecture-context or agent-governance surfaces
- root scaffold or modularity changes that add or materially refresh `ARCHITECTURE.md` should treat that file as the human-authored source map, refresh generated architecture context as evidence, and keep `AGENTS.md`, `docs/agents/00-architecture-bootstrap.md`, and this guide synchronized when docs-gate reports architecture-context or agent-governance surfaces
- root-surface cleanup that moves tracked top-level files or directories should use `docs/architecture/root-surface-classification.md` as the classification contract, preserve historical evidence under `docs/archive/root-cleanup/` or a domain docs surface, delete tracked root evidence only under explicit destructive-cleanup authority recorded in that contract, and keep `AGENTS.md`, `docs/README.md`, `docs/agents/00-architecture-bootstrap.md`, and this guide synchronized when docs-gate reports governance surfaces
- command-registry deep-module splits should preserve one small public command
  facade while moving action-specific option builders and delegation behind
  named internal adapter seams. Treat those seams as agent-governance surfaces:
  update boundary tests, refresh architecture context, and keep docs-gate
  required surfaces synchronized when the command family boundary changes.
  Prompt-gate follows this pattern with `src/commands/prompt-gate.ts` as the
  compatibility facade, `prompt-gate-command-spec.ts` as the registry adapter,
  and prompt-template parsing/validation inside `src/lib/prompt-gate/`.
  Gap-case follows the same pattern with `src/commands/gap-case.ts` as the
  compatibility facade, `gap-case-command-spec.ts` as the registry adapter,
  and lifecycle parsing, validation, persistence, and presentation inside
  `src/lib/gap-case/`.
  Simulate follows the same pattern with `src/commands/simulate.ts`,
  `src/commands/simulate-analysis.ts`, and
  `src/commands/simulate-analysis-recommendations.ts` as compatibility
  facades, `simulate-command-spec.ts` as the registry adapter, and CLI
  parsing, simulation orchestration, analysis, recommendations, and
  presentation inside `src/lib/simulate/`.
  Ci-migrate follows the same pattern with `src/commands/ci-migrate.ts` as
  the migration orchestration facade, `ci-migrate-command-spec.ts` as the
  registry adapter, and raw CLI argument projection plus delegated helper
  routing inside `src/lib/ci-migrate/`.
  Init follows the same pattern with `src/commands/init.ts` as the bootstrap
  orchestration facade, `init-command-spec.ts` as the registry adapter, and
  raw CLI argument projection plus issue-tracker/minimal-mode validation inside
  `src/lib/init/cli-args.ts`, with module-boundary ratchets preserving the
  adapter seam.
  Upgrade follows the same pattern with `src/commands/upgrade.ts` as the
  compatibility facade, `upgrade-command-spec.ts` as the registry adapter,
  raw CLI argument projection inside `src/lib/upgrade/cli-args.ts`,
  contract/default migration helpers inside `src/lib/upgrade/contract.ts`,
  shared option contracts inside `src/lib/upgrade/types.ts`, template and
  manifest updates inside `src/lib/upgrade/templates.ts`, and upgrade
  orchestration inside `src/lib/upgrade/runner.ts`, with
  module-boundary ratchets preserving the adapter seam.
  Brain follows the same pattern with `src/commands/brain.ts` and
  `src/commands/brain-core.ts` as compatibility facades,
  `brain-command-spec.ts` as the registry adapter, raw Project Brain flag
  projection inside `src/lib/project-brain/cli-args.ts`, the dispatcher and
  public export surface inside `src/lib/project-brain/cli.ts`, and subcommand
  behavior inside `src/lib/project-brain/*-cli.ts`, with module-boundary
  ratchets preserving the adapter seam.
- runtime-card evidence adapter changes that add `--evidence` ingestion,
  normalized session evidence, or runtime-card source/blocker projection should
  keep `runtime-card/v1` advisory, artifact-backed, and constrained to
  `--repo`; refresh architecture context and synchronize `AGENTS.md`,
  `docs/agents/00-architecture-bootstrap.md`, and this guide when docs-gate
  reports governance surfaces
- phase-exit required evidence must come from gate-backed evidence; summary-only
  runtime evidence may be retained as context, but must not satisfy required
  phase-exit gates.
- runtime-card evidence producer changes that add or alter `--evidence-out`,
  `runtime-evidence-bundle/v1`, or producer/adapter wiring should refresh
  `AI/context/diagram-context.md` and keep `AGENTS.md`,
  `docs/agents/00-architecture-bootstrap.md`, and this guide synchronized
  when docs-gate reports architecture-context or agent-governance surfaces
- runtime-card trace-out changes should keep trace persistence in
  `src/lib/runtime-trace/`, reuse canonical run-record append/manifest
  helpers, constrain `--trace-out` to
  `artifacts/agent-runs/<runId>/events.jsonl`, require a fresh run id with a
  pre-append claim so repeated executions cannot share a replay stream, and
  treat emitted trace records as replay-ready audit/orientation evidence only,
  not closeout, CI, review, Linear, or merge-readiness proof
- replay-packet changes should keep replay seeds and replay evidence in
  `src/lib/replay/` as pointer-only, content-bound orientation/audit evidence.
  Validators must prove source refs, seed refs, hook file provenance, resolved
  command provenance, normalized event summaries, stale-state semantics,
  SHA-256 integrity, and raw-payload or secret leakage rejection. Replay packets
  must not become delivery-truth, review-state, external-state, root-hygiene,
  Judge/PM, or merge-readiness claim support without a future explicit consumer
  boundary and synchronized governance update
- prompt-context receipt changes should keep prompt, instruction, permission,
  capability, and goal-context source refs inside `src/lib/prompt-context/`.
  Validators must prove pointer-only payloads, raw prompt/transcript/secret
  rejection, required authority layers, and instruction-source authority
  restrictions. System policy, developer policy, repo instruction, trusted
  skill, and user steering may be instruction authority; plugin metadata,
  artifact data, review feedback, telemetry, and untrusted external input are
  orientation/audit context only unless a future promotion path is implemented
  and validated. Prompt-context receipts must not become command authority,
  delivery-truth claim support, review-state support, external-state support,
  Linear truth, merge-readiness proof, Judge/PM proof, or goal-completion proof
  while the packet remains contract-only and `not_yet_emitted`.
- codex-runtime-evidence packet changes should stay inside the existing
  `src/lib/runtime` deep module as a narrow public facade plus typed contract,
  source-classification, validation, and reference-integrity internals before
  any runtime-card adapter consumes them; refresh architecture context and this
  guide when those packet or validator modules change
- codex-runtime-evidence permission changes should scope known permission facts
  to explicit environment evidence. Keep environment id, cwd, expected cwd,
  executor kind, approval scope, expected approval scope, sandbox policy refs,
  state, and failure class in the runtime evidence packet, require receipt
  backing for sandbox policy refs when permission facts are known, and project
  only compact `environmentRefs` into runtime-card summaries
- runtime-card Codex continuity changes should keep thread, turn, trace, goal,
  client-message, queue, approval, and heartbeat/automation refs inside
  `src/lib/runtime` as compact producer-supplied pointers. Validators must
  prove continuity refs are source-backed and receipt-backed, reject unknown
  continuity fields and payload-like refs, and keep continuity advisory only:
  no command authority, delivery-truth support, review-state support,
  external-state support, merge-readiness proof, Judge/PM proof, or
  goal-completion proof without a separately implemented and validated
  consumer boundary.
- runtime evidence receipt and delivery-truth changes that add or alter
  `evidence-receipt/v1`, `delivery-truth/v1`, claim-support policy,
  freshness, head-SHA, blocker-class, or source-kind rules should stay additive,
  fixture-backed, and separated from public closeout authority until the
  production verifier surface is intentionally wired; refresh architecture
  context and keep `AGENTS.md`, `docs/agents/00-architecture-bootstrap.md`,
  and this guide synchronized when docs-gate reports architecture-context or
  agent-governance surfaces
- Judge/PM readiness is a delivery-truth composition rule, not a separate
  public closeout rail. Changes to `goal_ready_for_judge_pm`,
  issue-authority blockers, clean-worktree evidence, local-validation evidence,
  or external-state eligibility should keep the private audit logic under
  `src/lib/delivery-truth/`, preserve PR closeout as the claim/evidence
  consumer, and synchronize `AGENTS.md`,
  `docs/agents/00-architecture-bootstrap.md`, and this guide when docs-gate
  reports architecture-context or agent-governance surfaces
- root-hygiene evidence changes should keep repository inventory,
  git-tracked path resolution, root-surface policy digestion, freeze
  classification, and receipt generation inside `src/lib/root-hygiene/`;
  delivery-truth should consume that evidence only through
  `src/lib/delivery-truth/root-hygiene-evidence.ts`, and changes to
  `root_surface_tidy` claim support should synchronize `ARCHITECTURE.md`,
  `docs/architecture/root-surface-classification.md`, generated architecture
  context, `AGENTS.md`, `docs/agents/00-architecture-bootstrap.md`, and this
  guide when docs-gate reports architecture-context or agent-governance surfaces
- review-state and external-state packet changes should keep review truth in
  `src/lib/review-state/` and live PR/CI/review/tracker freshness truth in
  `src/lib/external-state/`; validators must keep reviewer artifact receipts,
  unresolved review threads, source completeness, TTL freshness, head SHA, and
  claim-support eligibility separate before delivery-truth composition consumes
  those packet families; any `src/lib/pr-closeout/` bridge that derives these
  packets from normalized closeout input must stay read-only and
  validator-backed, not a merge/readiness authority; refresh architecture
  context and keep `AGENTS.md`, `docs/agents/00-architecture-bootstrap.md`, and
  this guide synchronized when docs-gate reports architecture-context or
  agent-governance surfaces
- action-review receipt changes should keep high-risk action review evidence in
  `src/lib/action-review/` as contract-only, `not_yet_emitted` governance
  packets for merge, release, destructive cleanup, and external tracker
  mutation decisions. Validators must prove reviewer independence, canonical
  identity separation, current evidence freshness, action-envelope matching,
  allow/block/mismatch semantics, and stable machine-readable error codes. The
  packet must not become command authority, delivery-truth claim support, or
  merge-readiness proof unless an emitted producer and consumer boundary is
  implemented, validated, and reflected in governance docs in the same PR.
- steering-queue packet changes should keep pending operator steering and
  steering-application receipts in `src/lib/steering-queue/` as advisory
  orientation/audit evidence. Validators must prove instruction-source hash
  integrity, artifact identity, supersession, stale-precondition
  classification, deterministic selected-item ordering, client user-message
  correlation for expected and applied same-thread steering, terminal state
  consistency, expected/current context matching, runtime-card update-reference
  presence for applied receipts, and head-SHA freshness. The packets must not
  become command authority, delivery-truth claim support, Judge/PM proof,
  tracker mutation evidence, or merge-readiness proof until a future
  runtime-card adapter intentionally wires that boundary and updates the
  governance docs in the same PR.
- trust-boundary validator changes that add script-backed evidence reports
  such as `audit-reference-report/v1` should keep output machine-readable,
  path classification repo-scoped, and proof based on current tracked
  artifacts; refresh architecture context and keep `AGENTS.md`,
  `docs/agents/00-architecture-bootstrap.md`, and this guide synchronized
  when docs-gate reports architecture-context or agent-governance surfaces
- CircleCI PR-context scaffold changes for `pr-template` or `linear-gate`
  should keep the live `.circleci/config.yml`, generated CircleCI templates,
  init scaffold regression coverage, `AGENTS.md`, and this guide synchronized.
  The resolver should try `CIRCLE_PULL_REQUEST`, `CIRCLE_PULL_REQUESTS`,
  owner-qualified branch lookup, bare branch lookup, and commit-to-PR fallback
  before failing closed.
- rule lifecycle governance changes that alter rule metadata validation, `.harness/rule-lifecycle-manifest.json`, `docs/rule-lifecycle.schema.json`, or `rule-lifecycle-gate` should keep this guide synchronized with `AGENTS.md`, `README.md`, and `docs/agents/00-architecture-bootstrap.md` when docs-gate reports agent-governance, contract-policy, or architecture-context surfaces
- workflow-authority routing and validation behavior changes should update `docs/agents/04-validation.md`, `docs/agents/08-release-and-change-control.md`, `docs/agents/10-agent-testing-gates.md`, and `docs/agents/14-docs-gate-rollout.md`
- agent-governance/category updates should keep `AGENTS.md` and this guide synchronized in the same PR
- project-local Codex role inventory changes should keep `.codex/agents/README.md`,
  `AGENTS.md`, this guide, and `pnpm codex:agents:guard` synchronized.
  Treat `.codex/agents/<role>/<role>.toml` files and the guard as repo
  inventory evidence only: an already-open Codex thread can still return
  `unknown agent_type` until the runtime is refreshed. Do not substitute a
  generic/default subagent when the project-local role boundary is required.
  Start a fresh thread rooted in this checkout before relying on that boundary.
- north-star contract/scaffold updates that affect architecture context should update `AGENTS.md`, `docs/agents/00-architecture-bootstrap.md`, and this guide in the same PR
- north-star artifact contract changes should keep the README command evidence
  surface, AGENTS shared-vocabulary guidance, and this guide synchronized in
  the same PR
- Project Brain or Harness Engineering control-plane changes should keep `.harness/README.md`, AGENTS, CONTRIBUTING, tooling policy, and security/governance guidance synchronized so agents know which `.harness` files are durable authority, secondary context, or generated runtime state.
- Tracked secondary `.harness` context is not enough to authorize implementation; agent execution should still route through admitted `.harness/linear`, `.harness/refactors`, `.harness/specs`, or `.harness/plan` slices.
- agent-native cockpit changes should keep next-action safety evidence, generated environment action contracts, and docs-gate-required operator surfaces synchronized before the PR can be considered merge-ready
- RouteDecision lifecycle metadata is part of the agent-native cockpit contract: `route-decision/v1` must remain additive to `harness-decision/v1`, must not make target commands executable authority by itself, and must keep architecture-context plus docs-gate-required governance surfaces synchronized
- RouteDecision risk-tiered mutation authority remains advisory and
  non-executable: low-risk repo-local mutation routes may set
  `requiresHuman=false` only when current evidence and validator ownership are
  present, while destructive, external, tracker, production, release, security,
  credential, merge, public-contract, goal-completion, verifier-disagreement,
  ambiguous-governance, unknown, or network-dependent mutation still requires
  human review and must route through the decision-request or action-review
  authority surface where applicable.
- generated hook setup or readiness changes should keep agent setup evidence synchronized: `scripts/setup-git-hooks.js` must install generated `prek` shims that derive `WORKTREE_ROOT` with `git rev-parse --show-toplevel` and default `PREK_HOME` to `$WORKTREE_ROOT/.cache/prek`, and `scripts/check-environment.sh` must fail drift across installed `pre-commit`, `pre-push`, and `commit-msg` shims
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
- full pre-push diagram freshness must use the same package-manager-scoped diagram CLI as manual refreshes; a missing global binary is not a valid blocker when `pnpm --dir "$ROOT_DIR" exec diagram --version` succeeds
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
- PR-template linked-issue evidence must separate traceability from closure:
  `Linear reference` records issue refs such as `Refs JSC-363`,
  `Fixes JSC-363`, or `Closes JSC-363`, while
  `Linked issue relationship` records whether the PR closes specific
  acceptance IDs, only prepares/enables the parent issue, is standalone, or is
  not applicable
- PR closeout evidence changes that add or alter `pr-closeout/v1`,
  `harness pr-closeout`, required PR metadata, or AI session/traceability
  evidence should stay read-only, tool-evidence-backed, secret-redacting, and
  synchronized with the PR template, validation docs, CLI docs, and AGENTS
- artifact runtime surface changes should keep visible artifact truth in
  `src/lib/artifact-runtime-surface/`, with pointer-only payloads, typed claim
  refs, preview applicability, current-head and lineage matching,
  repo-relative path containment, checksum/size checks, and value-level leakage
  rejection before any artifact supports delivery, review, root, external-state,
  merge-readiness, or Judge/PM claims
- browser evidence changes should keep visual runtime evidence in
  `src/lib/browser-evidence/`, with manifest path containment, screenshot file
  existence, required viewport coverage, PNG dimension and non-blank checks,
  console policy validation, sanitized messages, and stable error codes before
  `evidence-verify` reports the packet as passing. Browser evidence may orient
  agents and audit visual proof, but it must not become delivery-truth,
  review-state, external-state, root-hygiene, Linear, Judge/PM,
  merge-readiness, or command-authority proof without a future typed consumer
  boundary and governance update
- prompt-context drift report changes should keep context freshness truth in
  `src/lib/prompt-context-drift/`, with pointer-only payloads, repo-contained
  SHA-256 source refs, prompt-context receipt freshness, Project Brain route
  and memory/knowledge freshness, runtime-card or handoff freshness, receipt
  head-SHA checks, symlink/realpath containment, stale-state classification,
  closed enum validation, and value-level leakage rejection before the report
  can support any advisory context-health projection. `agent-readiness` may
  expose `prompt_context_drift` for orientation, but the report must not become
  command authority, delivery-truth claim support, JSC-363 acceptance closure,
  or merge-readiness proof
- intermediary receipt coverage changes should keep real-time and intermediary
  source truth in `src/lib/intermediary-receipts/`, with pointer-only source
  refs, complete source-kind taxonomy coverage, deny-by-default
  source-kind/claim-family policy entries, deterministic blocker-to-next-action
  mapping, most-restrictive-wins summary aggregation, current receipt/head-SHA
  claim-support checks, canonical-packet routing for protected review,
  external-state, delivery-truth, Linear, Judge/PM, and merge-readiness
  families, and value-level leakage rejection. Unbound browser, stream,
  mailbox, compaction, visual, operator, and subagent observations may orient
  agents, but they must not become delivery-truth, review-state,
  external-state, root-hygiene, Linear, Judge/PM, or merge-readiness proof
  without a current `evidence-receipt/v1` plus the matching canonical packet
  route. If the same slice changes `harness next` worktree-role gates or PR
  closeout snapshot lane projection, keep the governance wording evidence-bound:
  dirty/fresh role state can block a recommendation, and snapshot classes can
  describe PR lanes, but neither can authorize delivery or merge readiness by
  itself
- `pr-closeout/v1` success must come from current structured
  claim/evidence status rather than model-written summary text. Missing or
  stale required evidence should resolve to blocked or unknown with source,
  freshness, head SHA, blocker class, and verification timestamp retained for
  review.
- `pr-closeout/v1` delivery lifecycle snapshots are read-only throughput and
  handoff evidence. They may summarize queue growth, waiting states, handoffs,
  approvals, worktree role, Linear mutation availability, release readiness,
  and review artifact status, but they must not mutate external systems,
  satisfy review-state or external-state truth, or prove merge readiness without
  fresh canonical evidence for those lanes.
- `pr-closeout` live evidence inputs must stay evidence-bounded: shell-style
  env files may populate local credentials, but closeout gate paths must remain
  repo-scoped and outside-repo paths should block rather than expand the trust
  boundary.
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
- artifact-routine and pattern-scope must stay visible in the command
  capability catalog as advanced, agent-facing commands: `artifact-routine`
  is verification evidence for route-driving Project Brain artifacts, while
  `pattern-scope` is review evidence for sibling-pattern steering signals
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
- A tracked Linear branch or PR issue reference must not imply parent-goal closure by itself; agents must keep the PR body's linked-issue relationship current and name completed acceptance IDs or `none`.
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
