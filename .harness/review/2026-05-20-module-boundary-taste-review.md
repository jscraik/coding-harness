# 2026-05-20 Module Boundary Taste Review

## Table of Contents

- [1. Inputs Reviewed](#1-inputs-reviewed)
- [2. Boundary Taste Review](#2-boundary-taste-review)
- [3. Next Boundary Priority](#3-next-boundary-priority)
- [4. Visual Understandability Review](#4-visual-understandability-review)
- [5. Term Audit](#5-term-audit)
- [6. Effect Cut Line](#6-effect-cut-line)
- [7. PR And Issue Coordination Signal](#7-pr-and-issue-coordination-signal)
- [8. Ubiquitous-Language Follow-Ups](#8-ubiquitous-language-follow-ups)

## 1. Inputs Reviewed

- Reviewed the browser visual at /private/tmp/coding-harness-pr265-comments-1779257607/.harness/implementation-notes/2026-05-19-module-layout.html.
- Reviewed docs/architecture/module-boundaries.md for term alignment and boundary language.
- Checked local branch state with git status --short --branch.
- Checked GitHub PR 265 metadata, checks, and review-comment signal with gh pr view, gh pr checks, and the PR review-comments API.
- Did not edit the active conflict-zone files:
  - src/lib/cli/registry/command-specs-core.ts
  - src/lib/architecture/module-boundaries.test.ts
  - docs/architecture/module-boundaries.md
  - artifacts/architecture/module-layout.html
  - .harness/implementation-notes/2026-05-19-module-layout.html

## 2. Boundary Taste Review

Overall read: the visual is directionally right as a control map, but too many boxes still read like implementation inventory. It tells an engineer what files exist. It does not always tell an agent what authority the module owns or where a human should apply taste.

Best current language:

- "Callers stay on small facades; agents work inside deeper modules; tests guard the boundary" is the right one-sentence architecture.
- "Public facade", "internal module", "Effect boundary", and "executable guard" are useful legend concepts.
- "Command catalog seams" is better than "CLI registry boundaries" for visual comprehension.
- "Deep module boundary" is useful when it is paired with the owned control surface.
- "Review public facades and tests first. Only inspect internals when tests fail, behavior changes, or a seam becomes too generic" is exactly the right review instruction.

Names or phrases that feel wrong, vague, or too implementation-shaped:

- command-specs-core.ts should not be presented as the core thing. In the visual, call it "command catalog assembler" or "command manifest assembler". The filename can remain technical; the diagram label should name the control surface it assembles.
- "command spec seam" is accurate but over-repeated. It starts to become wallpaper. Prefer "command adapter" for a one-command box, and reserve "command catalog boundary" for the aggregate.
- "registry seam" is too mechanical. Use "command catalog interface" or "command registration boundary" depending on whether the box owns caller imports or command binding.
- "option projection" is implementation-shaped. Use "CLI option adapter" or "flag adapter" unless the point is specifically mapping one contract into another.
- "delegation" is too generic when repeated across many boxes. Use "routes to runner", "dispatches command", or "command runner adapter" so the reader sees the behavior.
- "doctor seam" in the legend is misleading because the green boxes now cover much more than doctor. Rename the legend item to "agent-safe work area" or "focused command work area".
- verify-coderabbit-command-spec.ts is provider-shaped. The control surface should probably be "review evidence adapter", with CodeRabbit as the first provider-specific implementation.
- runtime-card-command-spec.ts and pr-closeout-command-spec.ts are separate boxes, but the visual should show their relationship: runtime-card produces current-state evidence; PR closeout consumes evidence to classify handoff readiness.
- local-runtime-card-live.ts is a good internal name but a risky visual label. In the visual, call it "live PR and tracker evidence adapter" so the box says what it owns.
- local-runtime-card-artifacts.ts should be "active artifact evidence adapter" in the visual.
- local-runtime-card-phase-exit.ts should be "phase-exit evidence adapter" in the visual.
- normalise-* files are currently clear to engineers but weak for agents. In visual labels, use "gate result adapter" for each gate-specific normaliser.
- "manifest assembler" is good for the aggregate command catalog. Do not use it for every command file; that would hide which command owns which behavior.
- "seam" is useful but should not be the only noun. A seam is a boundary shape, not the domain responsibility.

Boxes that look too broad to trust an agent inside:

- command-specs-core.ts still looks too broad even after many splits because it is described as a manifest assembler for everything. It needs a visible list of what it is no longer allowed to own: workflow parsing, provider logic, command execution, and option-specific validation.
- src/lib/contract/validator.ts remains too large by threshold and probably needs its own visual lane if it is going to remain a broad entrypoint.
- review-gate-command-spec.ts at <= 220 lines looks suspiciously broad compared with the 25 to 80 line command adapters. It may be correct, but the visual should explain why review gate needs wider parsing authority.
- linear-command-runner.ts at <= 230 lines is a broad workflow runner. It needs sub-boundaries or an explicit reason it is allowed to own multiple Linear actions.
- local-runtime-card-live.ts is allowed to touch GitHub and Linear. That makes it a human-review box unless tests prove timeout behavior, missing-provider behavior, and no-secret output.
- normalise-he-phase-exit.ts at <= 230 lines is broad enough that an agent may over-edit it unless the specific evidence projection responsibility is highlighted.

Good names to keep:

- doctor-renderer.ts is understandable. It names a presentation responsibility and helps keep the doctor facade small.
- doctor-ci-check-alignment.ts is good. It says the domain concern: required-check identity alignment.
- runtime-card-validation.ts and runtime-card-recovery-validation.ts are good because they separate core shape validation from recovery metadata.
- replay-run-record.ts is good. It names the durable artifact it owns.
- remediate-findings.ts and remediate-run-record.ts are better than one broad remediate module.
- command-capability-rules.ts is good if it stays static policy. It should not silently become command behavior.

Where humans apply taste:

- Naming boundaries and deciding whether a box is a control surface or just a mechanical helper.
- Choosing which provider-specific names become generic boundaries.
- Reviewing public facades, test ratchets, and any module that owns live external evidence.
- Deciding whether a broad threshold is justified or just a postponed split.

Where agents can work locally:

- Inside focused command adapters once the public facade and import guard are fixed.
- Inside gate result adapters when the GateResult contract is unchanged and tests cover projection.
- Inside run-record, parser, and renderer seams when the artifact schema and facade remain stable.
- Inside internal runtime-card evidence adapters when live-provider behavior is mocked and validation fixtures prove missing/stale evidence behavior.

## 3. Next Boundary Priority

Use this priority order:

1. verify-work
2. memory-gate
3. drift-gate
4. replay
5. remediate

Reasoning:

- verify-work should become canonical first because it is the closeout trust surface. If it stays broad or implicit, every other boundary can be locally correct while the final handoff remains fuzzy.
- memory-gate is next because durable memory is part of the north star, and stale or contradictory memory creates repeated steering.
- drift-gate follows because canonicity depends on generated artifacts, docs, contract files, and architecture visuals staying aligned.
- replay should come before more action-oriented commands because it turns mistakes into repeatable evidence and internal evals.
- remediate should come after those proof surfaces, because remediation is only trustworthy when it can classify evidence, know memory state, and replay failure cases.

Do not prioritize init, upgrade, or ci-migrate before these unless they are blocking downstream adoption. They are important product surfaces, but the current risk is the harness control plane failing to prove or remember its own behavior.

The next 6 to 10 after that should probably be:

1. observability-gate
2. artifact-gate
3. plan-gate
4. prompt-gate
5. gap-case
6. simulate
7. ci-migrate
8. init
9. upgrade
10. brain

Taste note: observability-gate, gap-case, and simulate need sharper names before they become canonical. They sound like capabilities, not control surfaces.

## 4. Visual Understandability Review

The visual currently explains the architecture better than it explains progress. It shows many splits, but it does not make it easy to answer "what is done, what is in progress, what is enforced, and what should I review next?"

Visual must show:

- Completed splits.
- Current split.
- Remaining splits.
- Enforced boundaries.
- Boundaries that are only documented, not yet enforced.
- Files agents can edit safely.
- Files humans should review carefully.
- Public facades.
- Internal modules.
- Effect-approved files.
- Provider-specific adapters.
- Latest slice changed since the previous visual.

Specific improvements:

- Add progress state badges: complete, current, next, remaining, blocked, Effect later.
- Add enforcement badges: size ratchet, import guard, contract test, fixture coverage, not enforced.
- Show public facades as larger stable entrypoints, and internal modules as smaller boxes beneath them. The facade/internal relationship matters more than the raw file list.
- Reduce line noise by using lanes instead of many edges:
  - Command catalog.
  - Output adapters.
  - Runtime evidence.
  - PR closeout.
  - Replay and remediation.
  - Tests and ratchets.
- For command catalog boxes, group the many one-command adapters under a single "command adapters" cluster and show only exceptions or broad boxes in detail.
- Use a separate "latest slice" panel instead of a massive paragraph. The paragraph is accurate but too dense to help an agent orient quickly.
- Make provider-specific boxes visibly different from portable boundaries. verify-coderabbit should read as a provider adapter under a generic review evidence surface.
- Add a "human taste review" marker for broad or externally coupled modules such as live provider evidence and broad command runners.
- Add an "agent-local edit zone" marker for narrow adapters with facade and tests already enforced.
- Show runtime-card to PR-closeout as an evidence flow, not just two command-spec boxes.
- Show replay as a flywheel/eval surface, not just a command facade. This is where internal evals and observability become useful.
- The visual should say when Effect is intentionally not part of a split. Purple should mean "approved now", while grey or a badge should mean "Effect later, sync facade preserved".

Current visual verdict:

- Technically updated: yes.
- Understandable as an agent operating map: partially.
- Understandable as a progress map: not yet.
- Clear about tests enforcing boundaries: only partly. Amber boxes exist, but enforcement type and coverage strength are not visible.
- Clear about public facade versus internal module: yes in legend, inconsistent in dense command catalog areas.
- Clear about latest slice: no. The latest-changes paragraph is too dense and should become a grouped diff summary.
- Too much line/noise risk: yes, mainly from repeating "focused command-spec seam" across dozens of boxes.

## 5. Term Audit

Approved:

- control surface: approve. This is the most important term because it names what the module owns from an agent-native perspective.
- deep module: approve. Keep using it for a public interface that hides richer internals and reduces agent context.
- public facade: approve for architecture docs. In visuals, consider "public interface" if "facade" feels too pattern-heavy.
- agent-safe boundary: approve if it has criteria: stable facade, bounded internals, import guard, test ratchet, and clear owner.
- manifest assembler: approve for command-specs-core.ts or equivalent command catalog assembly. Do not apply it to every small command adapter.
- executable guard: approve. It connects the boundary to tests rather than prose.

Conditional:

- command spec: acceptable in filenames and low-level docs. Too weak as a visual/domain label unless paired with the command it adapts.
- registry seam: acceptable only when the subject is actually registration. Prefer "command catalog interface" in user-facing or agent-routing docs.
- review gate: acceptable as a command name, but provider-specific review evidence should live under a more generic review evidence boundary.
- runtime-card: approve as a product term, but the relationship needs to be explicit: runtime-card is current-state evidence; PR closeout is readiness classification.
- seam: useful as a boundary descriptor, weak as a standalone noun. Always pair it with a domain responsibility.

Reject or rename:

- option projection: too implementation-shaped for canonical language. Prefer "CLI option adapter" or "flag adapter".
- delegation: too vague when repeated. Prefer "routes to runner", "dispatches command", or "runner adapter".
- doctor seam: too narrow now that the visual uses the same color for non-doctor work. Rename to "focused command work area" or "agent-safe work area".
- verify-coderabbit: too provider-specific as a canonical boundary. Prefer "review evidence adapter" with CodeRabbit as a provider implementation.
- observability-gate: too broad until it states what it gates: telemetry completeness, trace freshness, claim/evidence coverage, or dashboard publication.
- gap-case: vague. Prefer "evidence gap case" or "gap case registry".
- simulate: vague. Prefer "policy simulation" or "gate simulation".
- pilot-rollback and pilot-evaluate: understandable as rollout commands, but the canonical boundary should be "pilot rollout control" with rollback/evaluate as actions.

## 6. Effect Cut Line

Effect later means:

- Do not introduce Effect imports in current CLI splits.
- Preserve the sync command-spec facade.
- Later add Effect builders behind module boundaries.
- Only approved Effect import surfaces should exist.
- Keep Effect out of command catalog wiring, command adapters, and top-level CLI facades until the migration decision changes.
- Add or preserve module-boundary tests that fail when Effect imports appear outside approved deep module files.
- Convert one or two real modules end-to-end as exemplars before declaring the migration complete.
- Keep the first Effect exemplars boring: typed failure, resource/layer construction, test provider, sync facade.

Effect should not become a new global style. The target shape is:

- CLI facade stays sync and small.
- Public module interface stays stable.
- Internal builder or evaluator can use Effect.
- Tests prove the sync facade and Effect builder behavior.
- Import guards prove Effect has not leaked into unrelated modules.

Approved current posture:

- PR closeout can remain the primary approved Effect boundary.
- Additional Effect boundaries should be named deliberately and ratcheted in module-boundaries.test.ts.
- Command-spec extraction work should continue without preparing Effect-shaped command plumbing.

## 7. PR And Issue Coordination Signal

GitHub PR checked:

- PR: https://github.com/jscraik/coding-harness/pull/265
- Title: feat(pr-closeout): make closeout truth deterministic
- Head: codex/jsc-328-closeout-truth
- Base: main
- Draft: false
- Mergeable: MERGEABLE
- Merge state: BLOCKED
- Review decision: empty from gh pr view
- Checks: all reported checks pass, including CodeRabbit, CircleCI lanes, Socket, and Snyk.

Local branch state:

- Current branch: codex/jsc-328-closeout-truth
- Local branch is ahead of origin by 15 commits.
- Active dirty worktree includes the module-layout implementation note, visual, architecture doc, boundary test, command-specs-core.ts, the audit file, and untracked src/lib/cli/registry/verify-coderabbit-command-spec.ts.

Review-comment signal:

- The REST review-comments API returned 147 inline comments.
- A simple "no addressed marker" filter still shows multiple comments without an obvious Addressed marker. This does not prove they are unresolved, but it is a strong coordination signal.
- Fresh/high-priority comments to triage before closeout:
  - P1: src/lib/pr-closeout/claim-helpers.ts - derive tests_passed from required check results, not a name regex.
  - P2: src/lib/pr-closeout/claims.ts - mark non-check missing claims as Codex-fixable when the missing claim is PR-body metadata such as rollback.
  - P2: src/commands/pr-closeout/live.ts - accept angle-bracketed evidence values from PR body.
  - P2: src/lib/pr-closeout/claim-builders.ts - recognize live CodeRabbit checks as review evidence.
  - P2: src/lib/pr-closeout/blockers.ts - treat BEHIND merge state as a branch cleanup blocker.
  - Major CodeRabbit: .harness/research/deep/2026-05-19-ryan-lopopolo-evidence.md - complete provenance placeholders with actual values.

Linear signal:

- PR comment body links JSC-328, "Add PR closeout evidence classifier".
- CodeRabbit context reported JSC-328 as In Progress, high priority, with this PR and related PRs 259, 260, and 261 attached.
- I did not mutate Linear state from this review pass.

Coordination recommendation:

- Do not merge based only on green checks. The PR is still BLOCKED and has fresh review signals.
- Before next closeout attempt, run a focused review-thread triage and classify each fresh comment as fixed, still valid, duplicate, or intentionally deferred.
- Push or reconcile the local ahead-15 state before relying on remote PR evidence.
- Treat provider-specific review evidence issues as part of the same boundary smell noted above: CodeRabbit should be an adapter under a generic review evidence surface, not a special case scattered through closeout claims.

## 8. Ubiquitous-Language Follow-Ups

Promote these preferred terms:

- "command catalog assembler" for the aggregate command manifest builder.
- "command adapter" for one command's CLI binding.
- "CLI option adapter" for flag and argument mapping.
- "runner adapter" for code that dispatches to command implementation.
- "review evidence adapter" for provider-backed review signals.
- "live evidence adapter" for GitHub, Linear, or other live provider reads.
- "gate result adapter" for normalise-* modules.
- "runtime evidence packet" as the explanation of runtime-card.
- "readiness classification" as the explanation of PR closeout.
- "agent-safe work area" for narrow internal modules guarded by facade and tests.

Add these distinctions to the ubiquitous-language pass:

- A file name can remain implementation-shaped; the visual label should name the control surface.
- A seam is a boundary shape; it is not enough to explain ownership.
- Provider names belong inside adapter implementations, not in canonical boundary names unless the product surface is intentionally provider-specific.
- A module is "agent-safe" only when tests enforce its boundary and callers use the public interface.
- Effect is a bounded internal implementation strategy, not a repo-wide migration until exemplars and import guards prove the shape.
