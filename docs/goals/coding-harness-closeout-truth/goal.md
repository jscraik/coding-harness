# Make Coding Harness Closeout Truth Deterministic Before Adding Autonomy

## Table of Contents

- [Objective](#objective)
- [North Star](#north-star)
- [Source Artifacts](#source-artifacts)
- [Repository Constraints](#repository-constraints)
- [Operating Model](#operating-model)
- [Review Gate Contract](#review-gate-contract)
- [Phase Queue](#phase-queue)
- [Browser Notes](#browser-notes)
- [Stop Conditions](#stop-conditions)
- [Final Completion Audit](#final-completion-audit)
- [Continuation Prompt](#continuation-prompt)

## Objective

Implement the recommendation-evaluation roadmap as a sequence of small,
provable PR-ready phases. Do not treat this as one broad architecture rewrite.
The core objective is to make false-success mechanically impossible in
`pr-closeout`, then build the supporting missing-context, replay-eval,
recovery, and invariant layers around existing Coding Harness primitives.

## North Star

Coding Harness should become more deterministic before it becomes more
autonomous. Every accepted change must reduce PR lead time, review rework,
closeout ambiguity, brownfield install risk, or repeated human steering.

## Source Artifacts

- Strategy:
  `.harness/strategy/2026-05-18-coding-harness-recommendation-evaluation.md`
- Required repo instructions:
  - `AGENTS.md`
  - `CODESTYLE.md`
  - task-relevant `codestyle/*.md`
  - the strategy file above
- Notes artifact:
  `docs/goals/coding-harness-closeout-truth/notes/implementation-notes.html`

## Repository Constraints

- Target repo: `/Users/jamiecraik/dev/coding-harness`
- Use repo-native command contracts.
- Preserve unrelated dirty worktree changes and do not revert user work.
- Use `apply_patch` for manual edits.
- Use one branch/PR-sized phase at a time.
- Git add as work is proven, but only stage files intentionally changed for the
  current phase.
- Keep `implementation-notes.html` current with decisions, tradeoffs, touched
  files, validation outcomes, review gate outcomes, scope changes, blockers, and
  anything Jamie should know before review.

## Operating Model

Use this goal board as the durable state machine.

- Keep exactly one active implementation phase unless Jamie explicitly requests
  parallel workers.
- Each phase must declare explicit allowed files or directories, exact
  acceptance criteria, exact validation commands, review gates, a
  `receipts.jsonl` entry, and staged-file evidence after successful validation.
- Do not mark a phase complete until validation and review gates are recorded.
- Do not mark the overall goal complete until a final Judge or PM audit says
  `decision: complete`.

## Review Gate Contract

Every implementation phase must be reviewed with:

- `$simplify`: check whether the diff can be smaller, clearer, or reuse
  existing patterns while preserving behavior and scope.
- `$unslopify`: check for stale code, duplicate artifacts, dead branches,
  placeholder scaffolding, and cleanup opportunities introduced by the phase.
- `$improve-codebase-architecture`: check module boundaries, interface shape,
  local reasoning, testability, and whether complexity moved sideways.
- `$ubiquitous-language`: check that new terms match
  `UBIQUITOUS_LANGUAGE.md`, `AGENTS.md`, docs, and existing harness
  vocabulary.
- `$codex-review`: run a code-review-style pass for bugs, regressions, missing
  tests, false-success paths, and unsafe assumptions.

Each review gate records exactly one outcome:

- `pass`
- `pass_with_followups`
- `blocked`
- `skipped_with_reason`

Accepted and rejected findings must be recorded in the HTML notes and the phase
receipt.

## Phase Queue

### Phase 0: Standards Baseline Confirmation

Purpose: Treat the already-completed standards absorption as the baseline, not
an endless standards-writing lane.

Known baseline:

- Evidence redaction improved.
- Evidence-bearing test rules added.
- Size ratchet added.
- Template codestyle pack synced.
- `pnpm check` previously passed.

Allowed files are read-only unless a small correction is required. If correction
is required, limit edits to:

- `codestyle/**`
- `src/templates/codestyle/**`
- `scripts/check-code-size.mjs`
- `src/lib/replay/trace-normalizer.ts`
- `src/lib/replay/trace-normalizer.test.ts`

Validation:

- `pnpm run quality:size`
- `bash scripts/validate-codestyle.sh --fast`
- `pnpm check` if any baseline correction is made

Completion condition:

- Baseline is recorded.
- Any remaining size warnings are classified as advisory, not blockers.
- No new generic standards are added without implementation evidence.

### Phase 1: PR Closeout Claim-vs-Evidence Contract

Purpose: Make `pr-closeout` unable to report done unless each closeout claim
has evidence.

Implement a `pr-closeout/v1` claim/evidence model where each claim has:
`claim`, `status`, `evidenceRef`, `source`, `headSha`, `freshness`,
`blockerClass`, and `verifiedAt`.

Required status values:

- `pass`
- `fail`
- `blocked`
- `unknown`
- `not_applicable`

Rules:

- Model-written summaries may reference verifier output but cannot override it.
- Missing required evidence must become `blocked` or `unknown`, never success.
- Stale evidence must not count as current success.
- Required closeout claims include tests passed, CI green, review threads
  resolved, PR metadata ready, branch current with base, Linear/tracker state
  aligned, CodeRabbit or independent review status known, required checks match
  current HEAD, and rollback path named or explicitly not applicable.

Likely files:

- `src/commands/pr-closeout.ts`
- `src/lib/pr-closeout.ts`
- `src/lib/pr-closeout.test.ts`
- `src/commands/pr-closeout.test.ts`
- any existing schema or docs surface for `pr-closeout/v1`

Acceptance fixtures:

- missing tests
- stale SHA
- unresolved review
- unknown CI state
- missing Linear/tracker state

Validation:

- `pnpm vitest run src/lib/pr-closeout.test.ts src/commands/pr-closeout.test.ts`
- `pnpm run quality:size`
- `bash scripts/validate-codestyle.sh --fast`

Completion condition:

- Closeout cannot emit success for missing or stale required evidence.
- Fixtures prove blocked or unknown behavior.
- Notes and receipt are updated.
- Relevant files are staged.

### Phase 2: Refactor PR Closeout Along Real Boundaries

Purpose: Reduce `pr-closeout` complexity while implementing the truth layer.
Do not refactor for aesthetics alone.

Suggested module split:

- `src/lib/pr-closeout/claims.ts`
- `src/lib/pr-closeout/evidence.ts`
- `src/lib/pr-closeout/freshness.ts`
- `src/lib/pr-closeout/blockers.ts`
- `src/lib/pr-closeout/output.ts`

Allowed files:

- `src/commands/pr-closeout.ts`
- `src/lib/pr-closeout.ts`
- `src/lib/pr-closeout/**`
- `src/lib/pr-closeout.test.ts`
- `src/commands/pr-closeout.test.ts`
- related exports/imports only when necessary

Validation:

- `pnpm vitest run src/lib/pr-closeout.test.ts src/commands/pr-closeout.test.ts`
- `pnpm run quality:size`
- `pnpm run test:related`
- `bash scripts/validate-codestyle.sh --fast`

Completion condition:

- Size pressure is reduced or explicitly explained if not fully below target.
- Behavior equivalence is proven by tests.
- New module boundaries reduce local reasoning cost.
- Notes and receipt are updated.
- Relevant files are staged.

### Phase 3: Missing-Context Classifier

Purpose: When a run cannot prove something, it must classify what kind of
system gap exists.

Initial classes:

- `missing_repo_instruction`
- `stale_docs_or_command_reference`
- `missing_verifier`
- `missing_recovery_handler`
- `missing_fixture`
- `missing_permission_or_auth_explanation`
- `hidden_provider_behavior`
- `unmodeled_current_state_dependency`
- `ambiguous_ownership_boundary`

Durable destinations:

- validator
- fixture/eval
- Project Brain learning
- roadmap exception
- cold research reference

Likely files:

- `src/lib/missing-context/classifier.ts`
- `src/lib/missing-context/classifier.test.ts`
- `src/lib/pr-closeout/**`
- `src/lib/decision/he-phase-exit-core.ts` only if phase-exit shares blocked
  or unknown semantics
- relevant docs/schema only if required by docs-gate

Validation:

- `pnpm vitest run src/lib/missing-context/classifier.test.ts src/lib/pr-closeout.test.ts src/commands/pr-closeout.test.ts`
- `pnpm run test:related`
- `bash scripts/validate-codestyle.sh --fast`

Completion condition:

- Missing-context output is typed, tested, and connected to closeout.
- Notes and receipt are updated.
- Relevant files are staged.

### Phase 4: Local Replay Eval Runner

Purpose: Turn closeout and recovery failure modes into local replay fixtures
before adopting any external eval platform.

Start with only two evals:

- `false-success-closeout`: model says done, evidence is missing, and harness
  must refuse success.
- `recovery-denied`: recovery would require authority, secret, or unsafe
  mutation, so harness must stop safely and preserve evidence.

Likely files:

- `src/lib/replay/trace-normalizer.ts`
- `src/lib/replay/trace-normalizer.test.ts`
- `src/lib/replay/**`
- `src/commands/replay*.test.ts`
- fixture directory under a repo-approved test or artifact location

Validation:

- `pnpm vitest run src/lib/replay/trace-normalizer.test.ts`
- replay runner tests added for new fixtures
- `pnpm run test:related`
- `bash scripts/validate-codestyle.sh --fast`

Completion condition:

- Two local replay evals exist and pass.
- Secret redaction is asserted.
- Notes and receipt are updated.
- Relevant files are staged.

### Phase 5: Recovery Handler Contract

Purpose: Define the boring deterministic recovery contract before implementing
a broad recovery system.

Handler contract fields:

- `id`
- `trigger`
- `authority`
- `verifyBefore`
- `recover`
- `verifyAfter`
- `rollback`
- `stopCondition`
- `traceFields`
- `retirementCondition`

Rules:

- No open-ended retry loops.
- No recovery without verify-before and verify-after.
- No secret-dependent recovery without explicit secret boundary.
- No state mutation without authority classification.
- No handler that hides original failure text.
- No handler without trace emission.
- No handler without a retirement rule.
- Recovery is allowed to stop.

Likely files:

- `src/lib/recovery/**`
- `src/lib/recovery/*.test.ts`
- integration into closeout/replay only if narrow and necessary

Validation:

- recovery unit tests
- `pnpm run test:related`
- `bash scripts/validate-codestyle.sh --fast`

Completion condition:

- Recovery contract exists.
- Stop/deny behavior is tested.
- Notes and receipt are updated.
- Relevant files are staged.

### Phase 6: First Safe Recovery Handler

Purpose: Prove the recovery registry with one low-risk deterministic handler:
missing generated artifact parent directory.

Avoid in this phase:

- browser login recovery
- GitHub auth mutation
- merge conflict resolution
- anything credential-dependent
- anything requiring external service mutation

Validation:

- recovery handler tests
- path-safety tests
- `pnpm run test:related`
- `bash scripts/validate-codestyle.sh --fast`

Completion condition:

- One safe recovery handler is implemented and tested.
- Notes and receipt are updated.
- Relevant files are staged.

### Phase 7: Architecture Invariant Gates

Purpose: Mechanically protect the new truth layer and existing Coding Harness
authority boundaries.

Initial invariant gates:

- command registry, README, CLI docs, and dispatch stay synchronized
- `pr-closeout` cannot report success without current-head proof
- `route-decision/v1` remains advisory/read-only
- `runtime-card/v1` and `runtime-evidence-bundle/v1` remain artifact-backed
- `.harness/research/**` stays cold unless promoted into invariant, fixture,
  validator, recovery handler, command behavior, or decision
- CI ownership remains CircleCI for PR governance, GitHub Actions for release,
  and Semgrep Cloud as external security check

Validation:

- targeted gate tests
- `bash scripts/run-harness-gate.sh docs-gate --mode required --json`
- `bash scripts/validate-codestyle.sh --fast`
- `pnpm check`

Completion condition:

- One or more critical invariants are mechanically protected.
- Notes and receipt are updated.
- Relevant files are staged.

### Phase 8: Skill Audit And Compression

Purpose: Only touch skills after truth, missing-context, replay, recovery, and
invariant work show what repeated steering remains.

Rules:

- Do not create the generic six-skill set by default.
- A skill earns hot-path status only if it reduces repeated steering or improves
  a capture-the-flag outcome.
- Otherwise it remains cold, is folded into existing command/gate behavior, or
  gets deleted.
- Prefer improving existing Coding Harness skill surfaces over creating new
  named skills.

Likely files:

- `.agents/skills/coding-harness/**`
- skill eval fixtures if existing
- docs only if required by docs-gate

Validation:

- `pnpm skill:validate`
- `bash scripts/validate-codestyle.sh --fast`
- `pnpm check`

Completion condition:

- Skill changes are implemented and validated, or intentionally rejected with
  evidence.
- Notes and receipt are updated.
- Relevant files are staged.

## Browser Notes

Maintain
`docs/goals/coding-harness-closeout-truth/notes/implementation-notes.html`.
Open it with `$browser:browser` when the browser connector is available, then
reload and verify it after each phase.

Minimum sections:

- Current phase
- Decisions not in spec
- Tradeoffs
- Files changed
- Validation ledger
- Review gate ledger
- Staged files
- Blockers and residual risk
- Next safe action

## Stop Conditions

Stop and ask Jamie or record a blocked receipt if:

- native goal state and board state disagree
- validation is red and not caused by the current phase
- a review gate finds a correctness or safety issue that requires scope
  expansion
- a required named skill cannot be resolved and no approved fallback exists
- implementation needs credentials, external service mutation, or browser login
  automation
- a change requires destructive git or filesystem operations
- a phase needs to touch files outside its allowed scope
- `pnpm check` fails for reasons not understood
- the work would add a new framework, observability platform, build graph tool,
  external eval platform, database, or broad dependency graph tool before the
  strategy acceptance conditions are met

## Final Completion Audit

Before marking the goal complete:

- Run `pnpm check` with required network access for `pnpm audit` if needed.
- Run `bash scripts/run-harness-gate.sh docs-gate --mode required --json`.
- Confirm all phase receipts exist.
- Confirm implementation notes are current.
- Confirm staged/committed state is intentional.
- Confirm no false-success path remains in closeout fixtures.
- Confirm no recovery handler mutates state without authority and verification.
- Run final `$codex-review` or available code-review fallback.
- Produce final Judge or PM receipt with `decision: complete` or
  `decision: blocked`.

## Continuation Prompt

```text
/goal Follow docs/goals/coding-harness-closeout-truth/goal.md
```

This is a prompt convention. Agents must read this file, `state.yaml`, the
receipts ledger, implementation notes, and the source strategy before acting.
