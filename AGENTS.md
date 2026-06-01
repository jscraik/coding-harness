---
schema_version: 1
---

# Coding Harness - AGENTS.md

## Table of Contents
- [Project Description](#project-description)
- [Mandatory Workflow Snippet](#mandatory-workflow-snippet)
- [Required Essentials](#required-essentials)
- [Harness CLI for Agents](#harness-cli-for-agents)
- [Harness Reviewer Roles First](#harness-reviewer-roles-first)
- [Harness Tool Builder](#harness-tool-builder)
- [Codex Discovery Order](#codex-discovery-order)
- [Startup Workflow](#startup-workflow)
- [Command Preflight](#command-preflight)
- [Fresh Worktree Bootstrap](#fresh-worktree-bootstrap)
- [Quality Checks](#quality-checks)
- [Repo Workflow](#repo-workflow)
- [Instruction Routing](#instruction-routing)
- [Memory Layer](#memory-layer)
- [Shared Vocabulary](#shared-vocabulary)
- [Project Brain](#project-brain)
- [Implementation Conventions](#implementation-conventions)
- [References](#references)

## Project Description

This repository is a TypeScript control plane for agentic development and
review workflows. Its north-star mission is to let a solo developer with
limited cognitive bandwidth orchestrate agentic software work to professional
standards through compact orientation, executable guardrails, durable memory,
and evidence-based handoff. Short form: Thin surface. Strong guardrails.
Durable memory. Professional output.

Expected outcome: Coding Harness is a portable agent operating system that
makes Codex behave like a software engineer, not merely a code generator, across
greenfield and brownfield projects with zero customer integration ceremony. If a
customer must repeatedly translate expert judgment, wire setup by hand, or give
the same steering twice, the harness has failed to encode the operating system.

## Mandatory Workflow Snippet

1. Explore project first, then invoke a task-relevant skill.
2. IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for any React, Tauri, Apps-SDK-ui, Tailwind, Vite, Storybook + Chat Widget tasks.
3. Read the repo-root [CODESTYLE.md](./CODESTYLE.md) before making edits or claiming validation, then route to [codestyle/README.md](./codestyle/README.md) for module-level standards.
4. Add a Table of Contents when creating or materially restructuring docs.

## Required Essentials

- Runtime/toolchain: `pnpm@10.33.0` and Node `>=24.0.0` (see `package.json`).
- Agent engineering proof: treat steering feedback, PR comments, failing checks, benchmark-style success, workflow-skill misses, and line-level corrections as evidence about the system, not isolated patch requests. Repeated steering is a stop-the-line environment defect: do not resume ordinary feature work until the correction is admitted into the repo operating system or explicitly rejected with a tracked reason. When Jamie says the agent is not permitted to proceed, create a current-session steering admission record first: quote the feedback class, infer the principle, list searched surfaces, choose the durable destination, name the guard or tracked exception, and run the focused validation command before any feature continuation. When Jamie says a thread is planning-only, says the agent is not making changes yet, or rejects implementation as a planning conversation, stop file edits immediately and admit the execution-mode failure before resuming implementation. When the same error or command/test failure happens twice, stop local retries, research trusted web or upstream sources, list 3-5 plausible fixes, choose the most efficient repo-fit fix, implement it, and record `Repeated-error research` in PR closeout. Every correction that implies a design principle triggers a pattern-generalization pass before the agent claims the fix: infer the rule, search sibling code/tests/docs/templates/skills/gates that could share the misbehavior, update the shared pattern or matching siblings, and record intentionally unchanged siblings with reasons. Do not wait for exact trigger words: examples, single-line requests, named-function feedback, review comments, and "generally" or "across everything" language are all principle signals until proven local. This applies across implementation, review, docs, planning, validation, and closeout, not only PR-template evidence. Before closeout, convert the signal into a design principle, search for sibling patterns, check horizontal/vertical/reflected OODA horizons, choose the narrowest durable destination, and prove repo orientation, validation, maintainability, traceability, and handoff quality. Line-level design feedback requires a pattern scope inventory: principle, sibling search, siblings changed, siblings left unchanged with reason, and deferred follow-ups. PR bodies that admit repeated steering or high-signal correction must include `Meta-behavior proof` naming the durable repo/system change and the matching learning or reinforcement destination. High-level workflow skills need a capture-the-flag-style win condition, self-reflection evidence, and iterative refinement before they are trusted. PR or heartbeat closeout completion is not equivalent to green checks: before declaring a lane complete or deleting a continuation heartbeat, prove PR state, merge or auto-merge state, branch/worktree state, Linear state, next-lane routing, and any remaining blocker or waiting reason. If the wider horizon cannot be observed, mark it `Unobserved Horizon` and create a follow-up instead of pretending the local fix is complete.
- Observed fixable blockers: when an agent notices a blocker, warning, risk, flaky command, stale instruction, or validation weakness in a touched file, required validation surface, generated template, or active agent-facing instruction, the default action is to fix it in the same pass and rerun the narrowest proving command. Reporting it as residual risk is allowed only when the fix is outside the current authority, needs credentials or destructive action, would expand scope across unrelated ownership boundaries, or is recorded as a tracked exception with the exact reason and next owner.
- Tool and skill creation threshold: if the same judgment is needed twice, or a failure mode can recur across slices, the agent should promote it into the smallest durable primitive that can change future behavior: validator, guard script, CLI helper, workflow hook, fixture, or scoped skill. One-off implementation knowledge belongs in implementation notes, plan evidence, or PR closeout evidence instead of a new skill. Prefer a validator or script when the rule is deterministic, a CLI/helper when operators need a repeatable command, and a skill only when the work is a reusable routed workflow with inputs, artifacts, validation, and ownership.
- Harness Reviewer Roles First: for coding-harness review work, project-local harness roles are first-choice subagents before generic or global reviewers. Invoke them with `spawn_agent(agent_type="harness-product-code-reviewer")` or the matching role from `.codex/agents/<role>/<role>.toml` so repository-specific review categories, skill routes, and read-only posture stay enforced. If `spawn_agent` returns `unknown agent_type`, treat it as a runtime-freshness blocker and start a fresh thread rooted in this checkout before relying on the project-local role boundary.
- Harness Tool Builder: when recurring agent friction, reviewer findings, or validation gaps should become a Codex-usable harness primitive, use `spawn_agent(agent_type="harness-toolsmith")` to build the scoped CLI, validator, guard, eval fixture, generated action, or workflow tool. Do not simulate `harness-toolsmith` with a generic/default agent when the enforced boundary itself is required.
- Env-backed validation recovery: before reporting `missing credential` or `unavailable credential` for local validation, inspect the approved private env surface `~/.codex/.env` for the required variable names without printing values. If required values are present, rerun the exact validation command in a shell that loads that env file, for example `zsh -lc 'set -a; source ~/.codex/.env; set +a; pnpm test:deep'`. Only classify the lane as blocked after that probe is missing, unreadable, incomplete, or the env-loaded rerun still fails.
- Baseline gates: `pnpm codestyle:parity`, `pnpm codex:agents:guard`, `pnpm check`, `bash scripts/validate-codestyle.sh`, and `bash scripts/verify-work.sh`; `pnpm run docs:steering:guard` is included in `pnpm check` so repeated-steering rules cannot drift silently, and `pnpm codex:agents:guard` is included in `pnpm lint` so project-local Codex role inventory cannot silently disappear.
- Branch-protection defaults include the external Semgrep Cloud GitHub App check `semgrep-cloud-platform/scan`; keep it aligned across generated contracts, `.harness/ci-required-checks.json`, and required-check docs.
- CircleCI owns repo-run PR governance and security checks, including the repo-run Semgrep and Snyk lanes; GitHub Actions is reserved for release publishing, and Semgrep Cloud remains an independent external required check.
- `harness.contract.json` records this split in `ciOwnership`: CircleCI is the primary PR gate, CodeRabbit is the independent review check, Semgrep Cloud is the independent external security check, and GitHub Actions fallback/release workflows must not become automatic PR gates without an intentional contract migration.
- Tag-triggered release publishing must install `ripgrep` (`rg`) before `pnpm check` because `docs:ubiquitous:guard` depends on it in GitHub-hosted runners.
- Release packaging, Flow Ops closure-evidence, outcome-closeout classification, E2E runner, or eval artifact changes that trigger a pre-push diagram-context refresh must commit the refreshed architecture context with the docs-gate-required governance surfaces.
- Diagram refresh validation must use the repo-owned `pnpm exec diagram` path for generation and the repo-scoped `pnpm --dir "$ROOT_DIR" exec diagram --version` path for availability checks; do not require a globally installed `diagram` binary when the package-manager-scoped command is available.
- Generated diagram identity rewrites must keep dependent Mermaid references synchronized: when duplicate node IDs are renamed, selectors such as `class old_id className` must be rewritten to the current emitted node IDs and covered by a stale-reference regression.
- Generated Codex environment action changes must keep setup PATH bootstrapping, detached-worktree branch attachment, and script-derived test/eval actions synchronized with the tooling and security governance docs.
- Release readiness updates to governed north-star status surfaces must keep `docs/roadmap/agent-first-status.md` and the matching `harness.contract.json` `lastReviewedAt` entry synchronized.
- Contract-policy cadence refreshes in `harness.contract.json`, including product-surface `lastReviewedAt` updates such as `preflight-gate`, must keep docs-gate required surfaces like `README.md` and `AGENTS.md` synchronized in the same change.
- Compatibility posture: canonical-only.
- Treat repo evidence (`package.json`, lockfiles, tsconfig, scripts) as authoritative over copied instructions.

## Harness CLI for Agents

Use `harness` directly in CI and local workflows with canonical command names (`kebab-case` or explicit `:` command families). Prefer `--json` when output feeds automation; parse stdout JSON when present, and treat stderr text as fallback diagnostics for command families that still return usage/validation errors as text.

CLI contract:

- Exit code `0`: success/pass.
- Exit code `1`: fail/gate blocked/unknown command.
- Exit code `2`: usage error (missing or invalid required values).
- Some command families intentionally preserve richer process exit semantics; treat the `0/1/2` mapping as the default top-level contract unless command-specific docs state otherwise.

Common machine-readable invocations:

```bash
harness blast-radius --files src/auth.ts --json
harness policy-gate --contract harness.contract.json --json
harness pattern-scope --files src/auth.ts --feedback "same things in multiple places" --json
harness artifact-routine --active-index .harness/active-artifacts.md --json
harness risk-tier --files src/payments.ts --json
```

## Harness Reviewer Roles First

For coding-harness review work, project-local harness reviewer roles are the
first-choice subagents. Use them before generic/default/global reviewers when
the requested review matches one of their owned categories, because they encode
this repository's review taxonomy, skill routes, and read-only posture.

Invoke them from this repository with `spawn_agent(agent_type="<role>")`, for
example:

```text
spawn_agent(agent_type="harness-product-code-reviewer")
```

Runtime freshness: project-local roles are loaded into the Codex runtime, not
proved by file presence alone. If `spawn_agent` returns `unknown agent_type`,
the current thread has not loaded the project-local role inventory. Start a
fresh thread rooted in this checkout before relying on the role boundary.

Role routing:

- `harness-product-code-reviewer`: product code and tests.
- `harness-ci-release-reviewer`: CI configuration and release tooling.
- `harness-dev-tools-reviewer`: internal developer tools.
- `harness-doc-history-reviewer`: documentation and design history.
- `harness-evaluation-reviewer`: evaluation harnesses.
- `harness-review-response-auditor`: review comments and responses.
- `harness-repository-automation-reviewer`: repository-management scripts.
- `harness-dashboard-definition-reviewer`: production dashboard definitions.

Use non-harness reviewer roles only when the review surface is outside those
categories, or when the harness reviewer reports a coverage gap that needs a
more specialized follow-up.

## Harness Tool Builder

Use `harness-toolsmith` when the right response to agent friction is a tool,
not another review note. It is the coding-harness capability-building role for
small Codex-usable primitives: CLI commands, validators, guard scripts,
machine-readable outputs, generated environment actions, eval fixtures, and
workflow tools.

Invoke it from this repository with:

```text
spawn_agent(agent_type="harness-toolsmith")
```

If this returns `unknown agent_type`, stop and refresh the Codex runtime before
delegating. A generic/default agent with copied instructions is not an enforced
`harness-toolsmith` boundary.

Use it after a reviewer or human identifies a recurring gap that should become
part of the harness operating system. Keep the assignment bounded to the missing
primitive, the repo surfaces it may touch, and the validation command that must
prove the result.

Promotion threshold:

- If the same judgment is needed twice, build or request the smallest durable
  primitive that would make the third occurrence mechanical.
- If the failure mode can recur across slices, prefer a validator, guard, or
  CLI helper over another reminder.
- If the knowledge is one-off implementation context, keep it in implementation
  notes, plan evidence, or PR closeout evidence.
- Create or update a skill only for a reusable routed workflow with explicit
  inputs, artifacts, validation, ownership, and review expectations.

## Codex Discovery Order

1. `~/.codex/AGENTS.md`
2. This root `AGENTS.md`
3. Any deeper scoped `AGENTS.md` or `AGENTS.override.md`

Notes:

- `README.md` is the repo-facing product surface (overview, install, workflows), not an operator-policy file.
- `docs/agents/*.md` are progressive-disclosure governance references, not auto-discovered instruction files.
- This repo is OpenAI Codex only; no mirrored tool-specific instruction surfaces are maintained.
- If instruction precedence is unclear, stop and resolve it before editing behavior.

## Startup Workflow

1. After global discovery surfaces (`~/.codex/AGENTS.md`), read this file first in-repo, then [docs/agents/01-instruction-map.md](./docs/agents/01-instruction-map.md) to route into extension docs, and open only task-relevant linked SOPs.
2. Run `bash scripts/codex-preflight.sh --stack auto --mode required` before multi-step, destructive, or path-sensitive work.
3. Summarize repo structure, active constraints, and blockers before edits.
4. Make the smallest change that satisfies the task, then run the narrowest validation that proves it works; widen only as risk increases.

## Command Preflight

- Run shell commands with `zsh -lc`; prefer `rg`, `fd`, and `jq`.
- Before edits, confirm `pwd`, repo root, required binaries, and target paths.
- Keep `bash scripts/codex-preflight.sh --stack auto --mode required` as the bootstrap gate beneath `bash scripts/verify-work.sh`, and treat repo-root `CODESTYLE.md`, `codestyle/`, `codestyle/CHECKSUMS.sha256`, `bash scripts/check-codestyle-parity.sh`, and `bash scripts/validate-codestyle.sh` as required verification surfaces.
- Legacy positional `scripts/codex-preflight.sh` invocations are compatibility-only and must preserve that required Local Memory posture by default; pass `off` or `optional` explicitly only when a softer check is intentional and documented.
- For detailed tooling and command-selection policy, use [docs/agents/02-tooling-policy.md](./docs/agents/02-tooling-policy.md).

## Fresh Worktree Bootstrap

- Before the first push from a newly created git worktree, run `bash scripts/prepare-worktree.sh` (or `make worktree-ready`); detached Codex app worktrees are disposable by default, and this repo attaches them to a deterministic local branch only when branch-aware validation, commits, or pushes are needed.
- `scripts/check-git-common-config.sh` is a required worktree-safety guard: shared non-bare `.git/config` must not contain `core.worktree`; repair failures with `bash scripts/check-git-common-config.sh --repair`, and use per-worktree config for worktree-local values.
- `scripts/prepare-worktree.sh` and generated Codex environment bootstrap actions must check both local and reachable `origin` branch names before creating readiness branches; ambiguous remote branch lookup fails closed instead of guessing.
- `scripts/prepare-worktree.sh` may warn and continue when local `mise trust` cannot write its user trust cache, but branch-collision and reachable-`origin` checks must still fail closed before branch attachment.
- After bootstrap, run `bash scripts/verify-work.sh --fast` before pushing.
- Git hooks must be installed through `make hooks`, `make setup`, or `node scripts/setup-git-hooks.js`; the generated installer derives the repo root and `.git/hooks` directory from `git rev-parse --show-toplevel`, and `scripts/check-environment.sh` fails generated `prek` `pre-commit`, `pre-push`, or `commit-msg` shims that do not export worktree-local `PREK_HOME="${PREK_HOME:-$WORKTREE_ROOT/.cache/prek}"` from that resolved root.
- Readiness scripts must preserve caller-provided `PATH` precedence and append standard tool directories as fallbacks when `PATH` is already set, so fixture shims and repo-local wrappers are not shadowed by global tools during validation.
- Environment-only pushes that change only `.codex/environments/environment.toml` may take the narrow `scripts/check-environment.sh` pre-push lane; all other pushes must keep the full `make hooks-pre-push` governance suite.
- The full pre-push suite must pass its branch changed-file list into `scripts/check-diagram-freshness.sh` so diagram checks do not treat unrelated local worktree dirt as push scope.
- Architecture diagram freshness uses `pnpm exec diagram` as the command source so disposable worktrees do not depend on a global `diagram` binary being on PATH.

## Quality Checks

- During iteration, run the narrowest check first, then `bash scripts/validate-codestyle.sh --fast`.
- Changed production source must satisfy `pnpm run quality:docstrings`, `pnpm run quality:size`, and `pnpm run test:related`; changed tests must satisfy `pnpm run quality:self-affirming` so assertions do not use the implementation under test as their own expected oracle. Evidence-bearing trust-boundary suites must satisfy `pnpm run quality:behavior-tests`, git child-process environment changes must satisfy `pnpm run quality:git-env-sanitizer`, and durable audit-lane changes must satisfy `pnpm run harness:audit-tracking`. These are wired into `pnpm check`, `bash scripts/validate-codestyle.sh --fast`, and local pre-commit hooks.
- When executable behavior changes, run the smallest real code path that exercises the exact production code touched before claiming the change is verified.
- Prefer invoking the production function, class, CLI command, shell script, validator, or route directly. If no existing test covers the path, create a temporary reproduction harness under `codex-scripts/` and keep that directory gitignored.
- If the exact path cannot run because of unavailable credentials, external services, unsafe side effects, or missing generated state, state the blocker clearly, run the nearest meaningful validation, and do not describe production behavior as verified unless the touched path actually ran.
- Before handoff when behavior changed, run `bash scripts/validate-codestyle.sh`; use `bash scripts/verify-work.sh` as the broader readiness gate.
- If runtime or artifact behavior changed, run `pnpm test:deep`.
- When docs-gate categories are affected, run `bash scripts/run-harness-gate.sh docs-gate --mode required --json` and clear warnings before merge.
- Every implementation slice must classify documentation impact before handoff:
  update the applicable root docs (`README.md`, `SECURITY.md`,
  `CONTRIBUTING.md`, `AGENTS.md`, `ARCHITECTURE.md`), governed docs, and any
  existing deep-module README touched by the slice, or record `n.a.` with a
  concrete reason in the PR `Documentation impact` field. Use docs-expert or
  an independent reviewer for high-impact documentation changes and cite that
  evidence in the PR review artifacts.
- Repo-local skill changes under `.agents/skills/**` must keep skill
  classification, owned workflow, body-documented validation command, proof
  assets or advisory references, and overlap allowlists synchronized through
  `pnpm skill:validate`; this guard is part of agent-governance closeout, not
  a prose-only review convention.
- Rule lifecycle governance changes that alter `.harness/rule-lifecycle-manifest.json`, `docs/rule-lifecycle.schema.json`, `rule-lifecycle-gate`, or lifecycle validation behavior must keep `AGENTS.md`, `README.md`, and `docs/agents/00-architecture-bootstrap.md` synchronized when docs-gate reports contract-policy or architecture-context surfaces.
- Agent-native cockpit, generated environment action, hook setup, and architecture-artifact changes must keep the docs-gate required surfaces synchronized in the same PR so `harness next --json` recommendations, local runtime setup, and reviewer-facing evidence describe the current contract.
- RouteDecision lifecycle metadata is agent-native cockpit contract work. Governance constraints:
  - `route-decision/v1` must remain advisory/read-only
  - `route-decision/v1` is additive to `harness-decision/v1`
  - Must not promote `targetCommand` to executable authority
  - Must not introduce a public harness route command
  - Must not change runtime recommendation behavior or alter how harness next operates
  - RouteDecision labels MUST NOT be treated as gate-run evidence (reference JSC-311)
  - phase-exit logic must refuse commit when gates are fail/blocked/not_run
  - Keep `AI/context/diagram-context.md` architecture context and docs-gate-required governance surfaces synchronized in the same PR
- Validation gate graph changes that add typed gate specs, phase-exit evidence gates, `harness next --phase-exit` visibility, parity tests, or resume-checkpoint guards are architecture-artifact changes; refresh `AI/context/diagram-context.md` and keep docs-gate-required governance surfaces synchronized in the same PR.
- Root scaffold or modularity changes that add or materially refresh `ARCHITECTURE.md` must treat it as the human-authored source map for repo boundaries; refresh generated architecture context as evidence and keep `docs/agents/00-architecture-bootstrap.md` plus agent-governance docs synchronized in the same PR.
- Root-surface cleanup that moves tracked top-level files or directories must keep `docs/architecture/root-surface-classification.md`, `docs/README.md`, `docs/agents/00-architecture-bootstrap.md`, and `docs/agents/07b-agent-governance.md` synchronized, and must archive historical evidence rather than delete it unless a separate destructive cleanup decision authorizes removal and the classification contract records that deletion.
- Command-registry deep-module splits are architecture-artifact and agent-governance changes when they alter a command family boundary: keep the public command spec small, move action-specific option builders or delegation behind named internal adapter seams, refresh `AI/context/diagram-context.md`, and synchronize docs-gate-required surfaces. Prompt-gate follows this contract with `src/commands/prompt-gate.ts` as a compatibility facade, `prompt-gate-command-spec.ts` as the registry adapter, and prompt parsing/validation inside `src/lib/prompt-gate/`. Gap-case follows the same contract with `src/commands/gap-case.ts` and `src/commands/gap-case-internal.ts` as compatibility facades, `gap-case-command-spec.ts` as the registry adapter, lifecycle parsing, validation, persistence, operations, and presentation inside `src/lib/gap-case/`. Simulate follows the same contract with `src/commands/simulate.ts`, `src/commands/simulate-analysis.ts`, and `src/commands/simulate-analysis-recommendations.ts` as compatibility facades, `simulate-command-spec.ts` as the registry adapter, and CLI parsing, simulation orchestration, analysis, recommendations, and presentation inside `src/lib/simulate/`, with module-boundary ratchets covering each seam. Ci-migrate follows the same contract with `src/commands/ci-migrate.ts` as the migration orchestration facade, `ci-migrate-command-spec.ts` as the registry adapter, and raw CLI argument projection plus delegated helper routing inside `src/lib/ci-migrate/`. Init follows the same contract with `src/commands/init.ts` as the bootstrap orchestration facade, `init-command-spec.ts` as the registry adapter, and raw CLI argument projection plus issue-tracker/minimal-mode validation inside `src/lib/init/cli-args.ts`, with module-boundary ratchets enforcing the split. Upgrade follows the same contract with `src/commands/upgrade.ts` as the compatibility facade, `upgrade-command-spec.ts` as the registry adapter, raw CLI argument projection inside `src/lib/upgrade/cli-args.ts`, shared option contracts inside `src/lib/upgrade/types.ts`, contract/default migration helpers inside `src/lib/upgrade/contract.ts`, template and manifest updates inside `src/lib/upgrade/templates.ts`, and upgrade orchestration inside `src/lib/upgrade/runner.ts`, with module-boundary ratchets enforcing the split.
- Brain follows the command-registry deep-module contract with `src/commands/brain.ts` and `src/commands/brain-core.ts` as compatibility facades, `brain-command-spec.ts` as the registry adapter, raw flag projection inside `src/lib/project-brain/cli-args.ts`, the dispatcher and public export surface inside `src/lib/project-brain/cli.ts`, and subcommand behavior inside `src/lib/project-brain/*-cli.ts`, with module-boundary ratchets enforcing the split.
- Runtime-card evidence adapter changes that add or alter `--evidence`,
  normalized session evidence, or runtime-card source/blocker projection are
  architecture-adjacent changes; keep `runtime-card/v1` and
  `runtime-evidence-bundle/v1` advisory and artifact-backed, keep paths
  constrained to `--repo`, refresh architecture context when required, and
  synchronize `AGENTS.md`, `docs/agents/00-architecture-bootstrap.md`, and
  `docs/agents/07b-agent-governance.md` when docs-gate reports governance
  surfaces.
- Runtime-card evidence producer changes that add or alter `--evidence-out`,
  `runtime-evidence-bundle/v1`, or producer/adapter wiring are
  architecture-adjacent changes; refresh `AI/context/diagram-context.md` and
  keep `AGENTS.md`, `docs/agents/00-architecture-bootstrap.md`, and
  `docs/agents/07b-agent-governance.md` synchronized in the same PR when
  docs-gate reports governance surfaces.
- Replay packet changes that add or alter `replay-packet/v1`, replay seed
  refs, hook-execution provenance, normalized event summaries, stale-state
  classification, TTL/head freshness, or raw-payload leakage rejection are
  architecture-adjacent runtime cockpit changes. Keep replay packets inside
  `src/lib/replay/` as pointer-only, content-bound orientation/audit evidence;
  they must not support delivery-truth, review-state, external-state,
  root-hygiene, Judge/PM, or merge-readiness claims without an explicit future
  consumer boundary and synchronized governance update.
- Codex runtime evidence packet changes that add or alter
  `codex-runtime-evidence/v1`, source-provenance classification, packet
  validation, or evidence-reference integrity are architecture-adjacent runtime
  cockpit changes. Keep the public packet surface inside `src/lib/runtime` as
  a narrow facade over typed contract, validation, and reference-integrity
  modules; refresh `AI/context/diagram-context.md` and keep `AGENTS.md`,
  `docs/agents/00-architecture-bootstrap.md`, and
  `docs/agents/07b-agent-governance.md` synchronized when docs-gate reports
  governance surfaces.
- Browser evidence packet changes that add or alter `browser-evidence/v1`,
  screenshot presence, required viewport coverage, PNG dimension/non-blank
  checks, console policy handling, or visual-evidence CLI wiring are
  architecture-adjacent runtime cockpit changes. Keep the deep module in
  `src/lib/browser-evidence/`, expose it through the existing
  `evidence-verify` command facade, and keep it advisory orientation/audit
  evidence only. It must not support delivery-truth, review-state,
  external-state, root-hygiene, Judge/PM, merge-readiness, or command-authority
  claims without an explicit future consumer boundary and synchronized
  governance update.
- Judge/PM readiness changes that add or alter `goal_ready_for_judge_pm`,
  issue-authority checks, clean-worktree classification, local-validation
  blocker projection, or external-state eligibility are delivery-truth
  composition changes, not a new closeout command family. Keep the public PR
  closeout surface claim/evidence driven, keep the private audit logic under
  `src/lib/delivery-truth/`, and synchronize `AGENTS.md`,
  `docs/agents/00-architecture-bootstrap.md`, and
  `docs/agents/07b-agent-governance.md` when docs-gate reports governance
  surfaces.
- Runtime evidence receipt and delivery-truth changes that add or alter
  `evidence-receipt/v1`, `delivery-truth/v1`, claim-support policy,
  freshness, head-SHA, blocker-class, or source-kind rules are
  architecture-adjacent runtime cockpit changes. Keep these contracts additive,
  fixture-backed, and separated from public closeout authority until the
  production verifier surface is intentionally wired; refresh
  `AI/context/diagram-context.md` and keep `AGENTS.md`,
  `docs/agents/00-architecture-bootstrap.md`, and
  `docs/agents/07b-agent-governance.md` synchronized when docs-gate reports
  governance surfaces.
- Root-hygiene evidence changes that add or alter repository inventory,
  git-tracked path resolution, root-surface policy digestion, freeze
  classification, receipt generation, or `root_surface_tidy` claim support
  are architecture-adjacent runtime cockpit changes. Keep the deep module in
  `src/lib/root-hygiene/`, expose delivery-truth integration through
  `src/lib/delivery-truth/root-hygiene-evidence.ts`, and keep
  `ARCHITECTURE.md`, `docs/architecture/root-surface-classification.md`,
  `AI/context/diagram-context.md`, `docs/agents/00-architecture-bootstrap.md`,
  and `docs/agents/07b-agent-governance.md` synchronized when docs-gate
  reports architecture-context or agent-governance surfaces.
- Review-state and external-state packet changes that add or alter
  `review-state/v1`, `external-state-snapshot/v1`, reviewer artifact
  validation, unresolved thread classification, external-source freshness,
  TTL/head-SHA validation, or claim-support eligibility are
  architecture-adjacent runtime cockpit changes. Keep review truth in
  `src/lib/review-state/`, keep PR/CI/review/tracker freshness truth in
  `src/lib/external-state/`, and preserve separate verdicts for local
  validation, remote checks, review threads, tracker state, and merge
  readiness. Refresh `AI/context/diagram-context.md` and keep `AGENTS.md`,
  `docs/agents/00-architecture-bootstrap.md`, and
  `docs/agents/07b-agent-governance.md` synchronized when docs-gate reports
  governance surfaces.
- Action-review receipt changes that add or alter
  `action-review-receipt/v1`, high-risk action envelopes, reviewer
  independence, canonical actor identity separation, allow/block/mismatch
  semantics, current evidence freshness, or machine-readable review error codes
  are architecture-adjacent runtime cockpit changes. Keep high-risk action
  review contracts in `src/lib/action-review/`, keep packets contract-only and
  `not_yet_emitted` unless an emitted producer and consumer boundary is
  implemented and validated in the same change, and do not let them authorize
  commands, satisfy delivery-truth claims, or prove merge readiness. Refresh
  `AI/context/diagram-context.md` and keep
  `ARCHITECTURE.md`, `docs/agents/00-architecture-bootstrap.md`, and
  `docs/agents/07b-agent-governance.md` synchronized when docs-gate reports
  governance surfaces.
- Artifact runtime surface changes that add or alter
  `artifact-runtime-surface/v1`, visible implementation notes, review
  artifacts, screenshots, CSV/PDF/document outputs, runtime-card/report
  artifacts, preview refs, artifact lineage, current-head binding, checksum,
  repo-relative path containment, or artifact claim-support eligibility are
  architecture-adjacent runtime cockpit changes. Keep the deep module in
  `src/lib/artifact-runtime-surface/`, keep packet payloads pointer-only and
  content-redacting, enforce preview applicability and filesystem containment
  in validators before claim support, and preserve separate delivery-truth,
  review-state, external-state, root-hygiene, and Judge/PM verdicts. Refresh
  `AI/context/diagram-context.md` and keep
  `ARCHITECTURE.md`, `docs/agents/00-architecture-bootstrap.md`, and
  `docs/agents/07b-agent-governance.md` synchronized when docs-gate reports
  governance surfaces.
- Prompt-context drift report changes that add or alter
  `prompt-context-drift-report/v1`, prompt-context receipt freshness, Project
  Brain route/memory/knowledge freshness, runtime-card or handoff freshness,
  receipt head-SHA checks, repo-contained source refs, or context-health
  projection are architecture-adjacent agent-readiness changes. Keep the deep
  module in `src/lib/prompt-context-drift/`, keep `agent-readiness` as the
  first advisory consumer, and do not let the report authorize commands,
  satisfy delivery-truth claims, close JSC-363 acceptance criteria, or prove
  merge readiness. Refresh `AI/context/diagram-context.md` and keep
  `ARCHITECTURE.md`, `docs/agents/00-architecture-bootstrap.md`, and
  `docs/agents/07b-agent-governance.md` synchronized when docs-gate reports
  governance surfaces.
- Intermediary receipt coverage changes that add or alter
  `intermediary-receipt-coverage/v1`, realtime/browser/mailbox/stream or
  compaction source taxonomy, source-kind by claim-family policy entries,
  blocker-to-next-action mapping, mixed-source aggregation, receipt/head-SHA
  claim-support eligibility, or protected canonical-packet routing are
  architecture-adjacent runtime cockpit changes. Keep the deep module in
  `src/lib/intermediary-receipts/`, keep the packet contract-first and
  `not_yet_emitted` until a production producer is intentionally wired, and
  do not let intermediary observations support delivery-truth, review-state,
  external-state, root-hygiene, Linear, Judge/PM, or merge-readiness claims
  without a current `evidence-receipt/v1` plus the matching canonical packet
  route. Refresh `AI/context/diagram-context.md` and keep
  `ARCHITECTURE.md`, `docs/agents/00-architecture-bootstrap.md`, and
  `docs/agents/07b-agent-governance.md` synchronized when docs-gate reports
  governance surfaces.
- Steering-queue packet changes that add or alter `steering-queue/v1`,
  pending operator-steering state, instruction-source hashing, artifact
  identity checks, supersession, stale-precondition classification, or
  deterministic selected-item ordering are architecture-adjacent runtime
  cockpit changes. Keep the deep module in `src/lib/steering-queue/`, keep
  the packet advisory for orientation/audit evidence, and do not let it become
  command authority, delivery-truth claim support, or merge-readiness proof
  until a future runtime-card adapter intentionally wires that consumption
  boundary and updates governance docs in the same PR.
- Trust-boundary validator changes that add or alter script-backed evidence
  reports such as `audit-reference-report/v1` are architecture-adjacent
  agent-governance changes when they classify repository paths, git-tracked
  proof, stale artifacts, or review evidence. Refresh
  `AI/context/diagram-context.md` and keep `AGENTS.md`,
  `docs/agents/00-architecture-bootstrap.md`, and
  `docs/agents/07b-agent-governance.md` synchronized when docs-gate reports
  those surfaces.
- PR closeout evidence changes that add or alter `pr-closeout/v1`,
  `harness pr-closeout`, required PR metadata, or AI session/traceability
  evidence are agent-governance changes; keep PR template guidance,
  validation docs, CLI docs, and `docs/agents/07b-agent-governance.md`
  synchronized in the same PR.
- `pr-closeout/v1` closeout success is claim/evidence driven: required
  closeout claims must carry current evidence status, source, freshness,
  head SHA, blocker class, and verification timestamp, and missing or stale
  required evidence must classify as blocked or unknown rather than success.
- `pr-closeout/v1` delivery lifecycle snapshots are read-only handoff
  evidence. Queue, waiting-state, handoff, approval, worktree-role, Linear
  mutation availability, release-readiness, and review-artifact blockers may
  explain throughput and next action, but must not mutate external systems,
  resolve review state, update Linear, or prove merge readiness without fresh
  canonical evidence for those lanes.
- Goal-continuation or approval-plan contract changes must keep `harness next --json` safety metadata, snapshot-only state evidence, and agent-governance docs synchronized in the same PR.
- When AGENTS/vocabulary surfaces change, run `pnpm run docs:ubiquitous:guard` to ensure `AGENTS.md` keeps the glossary linkage contract.
- Before PR handoff in this source checkout, run or explicitly mark `n.a.` for the north-star learning loop when changed files can be matched against imported CodeRabbit evidence: `bash scripts/run-harness-gate.sh learnings gate --source .harness/learnings/coderabbit.local.json --files <changed-files> --json`, `bash scripts/run-harness-gate.sh review-context --source .harness/learnings/coderabbit.local.json --files <changed-files> --json`, and `bash scripts/run-harness-gate.sh north-star-feedback --source .harness/learnings/coderabbit.local.json --json`. Use plain `harness ...` for downstream or installed-package contexts only. The `--files` value accepts comma-separated paths or multiple following path tokens.
- When changing validation, required-check, tooling/runtime, or architecture-context behavior, update the docs-gate required surfaces in the same change (`README.md`, `AGENTS.md`, `CONTRIBUTING.md`, `docs/agents/02-tooling-policy.md`, `docs/agents/06-security-and-governance.md`, `docs/agents/00-architecture-bootstrap.md`).
- Report exact commands/outcomes in handoff notes and update the matching Linear issue for durable findings.
- PR bodies for AI-assisted work must include a concrete session or traceability reference: Codex thread/session ID, session-collector artifact, harness run, CI job URL, eval/runtime trace, runtime-card/evidence bundle, or a specific `n.a.` reason. Do not paste raw transcripts, prompts, secrets, or bulky telemetry into PR bodies.

## Repo Workflow

- Branch from `main` and never push directly to `main`.
- Use `codex/<linear-key>-<short-description>` when the work is tracked in Linear, and open a PR for every merge to `main`.
- PR description linking: use `Refs JSC-N` while the issue is in review; use `Closes JSC-N` only when the merge fully completes the issue.
- CodeRabbit review must remain independent; the coding agent cannot self-approve.
- If you touch tooling/runtime contract surfaces such as hooks, `Makefile`, `.mise.toml`, readiness scripts, or generated Codex environment actions, update [docs/agents/02-tooling-policy.md](./docs/agents/02-tooling-policy.md) and [docs/agents/06-security-and-governance.md](./docs/agents/06-security-and-governance.md) in the same change.
- See [docs/agents/18-github-linear-automation.md](./docs/agents/18-github-linear-automation.md) for the full GitHub to Linear automation config and known gaps.

## Instruction Routing

Docs are layered for progressive disclosure (see [documentation layers](./docs/architecture/documentation-layers.md)):

| Layer | When               | Where                                                                  |
| ----- | ------------------ | ---------------------------------------------------------------------- |
| 0     | Always (this file) | `AGENTS.md`                                                            |
| 1     | Quick execution    | [quickstart.md](./docs/agents/quickstart.md)                           |
| 2     | Domain work        | Route via [01-instruction-map.md](./docs/agents/01-instruction-map.md) |
| 3     | Deep governance    | Operational specs linked from Layer 2                                  |

Core routing (Layer 2):

- Tooling and commands: [02-tooling-policy.md](./docs/agents/02-tooling-policy.md)
- Validation gates: [04-validation.md](./docs/agents/04-validation.md)
- Security: [06-security-and-governance.md](./docs/agents/06-security-and-governance.md)
- Release: [08-release-and-change-control.md](./docs/agents/08-release-and-change-control.md)
- Linear workflow: [13-linear-production-workflow.md](./docs/agents/13-linear-production-workflow.md)
- Memory: [03-local-memory.md](./docs/agents/03-local-memory.md)
- Full map: [01-instruction-map.md](./docs/agents/01-instruction-map.md)

## Memory Layer

- At session start, read `~/.codex/instructions/Learnings.md` and `.harness/memory/LEARNINGS.md` (bootstrap via [docs/agents/03-local-memory.md](./docs/agents/03-local-memory.md) if missing).
- Repo-local telemetry/overrides live under `.harness/memory/codex-learned/` and `.harness/memory/codex-preflight-overrides.env`; store repo-specific fixes in `.harness/memory/LEARNINGS.md` and universal fixes in `~/.codex/instructions/Learnings.md`.

## Shared Vocabulary

- Use [UBIQUITOUS_LANGUAGE.md](./UBIQUITOUS_LANGUAGE.md) as the canonical glossary for project-specific operator terms, aliases, and disambiguation.
- When user wording is terse, overloaded, or informal, map requests through the glossary `Prompt translations` table before executing.
- Keep command-language and closeout wording consistent with glossary canonical terms when reporting validation, drift, swarms, blockers, and lifecycle state.

## Project Brain

- Use Project Brain files in `.harness/` with Local Memory; see [docs/agents/03-local-memory.md](./docs/agents/03-local-memory.md) for guidance.
- `.harness/README.md` is the tracked control-plane map for selective `.harness` tracking: durable Markdown and JSON contracts move with the repo, while runtime databases, backups, caches, run output, and bulk snapshots stay local unless explicitly promoted.
- `.harness/active-artifacts.md` is an `execution-input` control-plane index: it may route the next implementation slice only when entries point to tracked Linear/spec/plan artifacts and the referenced artifacts remain current.
- `.harness/review`, `.harness/strategy`, `.harness/triage`, `.harness/features`, `.harness/ideate`, and `.harness/brainstorm` are secondary context; they do not drive implementation unless an admitted `.harness/linear`, `.harness/refactors`, `.harness/specs`, or `.harness/plan` slice references them.
- Initialize Project Brain using the harness CLI (`harness brain` or `harness init` scaffolding). Run environment checks in `scripts/check-environment.sh`. See [docs/agents/20-project-brain-memory-extension-rollout.md](./docs/agents/20-project-brain-memory-extension-rollout.md) for detailed setup steps. Use `--force` only when re-initializing after backing up `.harness/memory/LEARNINGS.md`.
- When the north-star learning loop finds a repeated high-value rule, keep the imported learning artifact as operational evidence and promote the distilled durable rule, decision, or explicit skip reason into Project Brain before closeout.
- Project Brain module changes must keep `src/lib/project-brain/README.md`
  synchronized with CLI, preflight, rule-grammar, and git-environment handling
  changes so docs-gate can distinguish source updates from stale module
  guidance.

## Implementation Conventions

- Local ESM imports must include `.js` extensions.
- This repo publishes a harness skill to downstream repos via `harness init`; installed path is `.agents/skills/coding-harness/` in the target repo (not this repo's local skills tree). Keep skill eval cases and acceptance criteria synchronized with skill behavior changes.
- `harness init` emits downstream PR, workflow, and worktree scaffolding with `jscraik/feature/*` as the agent-created branch prefix; keep those generated surfaces synchronized through `AGENT_BRANCH_PREFIX`.
- CircleCI PR-context scaffolding for `pr-template` and `linear-gate` must resolve the current PR through `CIRCLE_PULL_REQUEST`, `CIRCLE_PULL_REQUESTS`, owner-qualified branch lookup, bare branch lookup, and commit-to-PR fallback before failing closed. Fresh PR pipelines must retry this resolver briefly because GitHub branch and commit-to-PR association can lag the first CircleCI job. Keep `.circleci/config.yml`, `src/templates/circleci-config.yml`, `src/templates/circleci-linear-gate.yml`, and init scaffold regression coverage synchronized when this lookup contract changes.
- Keep the repo-root code-style pack (`CODESTYLE.md` + `codestyle/`) synchronized and enforce integrity with `codestyle/CHECKSUMS.sha256` plus `bash scripts/check-codestyle-parity.sh`.
- Use repo script contracts: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm audit`, `pnpm build`, `pnpm check`, and `pnpm test:artifacts` (see [docs/agents/02-tooling-policy.md](./docs/agents/02-tooling-policy.md)).

## References

- [Docs index](./docs/README.md) · [Instruction map](./docs/agents/01-instruction-map.md) · [Quickstart](./docs/agents/quickstart.md)
- [CONTRIBUTING.md](./CONTRIBUTING.md)
- Global: `~/.codex/AGENTS.md`, `~/.codex/instructions/standards.md`, `~/.codex/instructions/rvcp-common.md`
