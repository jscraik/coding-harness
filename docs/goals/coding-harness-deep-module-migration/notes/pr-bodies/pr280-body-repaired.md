<!-- vale off -->

# Pull request checklist

## Summary

- What changed (brief): Split the Project Brain CLI out of the Brain command/registry surface into focused project-brain modules, with registry delegation, module-boundary ratchets, focused regressions, architecture docs, diagrams, report mirrors, and goal receipts.
- Why this change was needed: This completes the active T014 non-Effect deep-module migration slice so the command facade and command registry stay thin while Project Brain behavior is owned by its module.
- Risk and rollback plan: Risk is Brain CLI flag parsing or dispatch drift. Roll back by reverting this PR. Focused command, registry, module-boundary, production status, full local handoff gates, and diagram/report checks cover the changed paths.

## Work performed

- Plan IDs: Refs JSC-331; `docs/goals/coding-harness-deep-module-migration/goal.md`; `docs/goals/coding-harness-deep-module-migration/state.yaml`
- Phase / slice: T014 Brain deep-module migration, final non-Effect slice before PR green-sweep/final audit.
- Session IDs: Goal receipts `R014-BRAIN-FOCUSED-PROOF-REVIEW-REPAIRED`, `R014-BRAIN-BROAD-LOCAL-GATES-VERIFY-WORK-PASS`, `R014-BRAIN-BROWSER-LAUNCHED-LOCAL-CLOSEOUT-READY`, `R014-BRAIN-FULL-LOCAL-HANDOFF-GATES`, and `R014-BRAIN-PR280-OPENED-BODY-REPAIRED`; verify-work run `20260522T215354Z-27231`.
- Trace IDs: Browser/report evidence `http://127.0.0.1:8767/artifacts/architecture/module-layout.html?v=20260522-r026-t014-broad-local`; review artifacts `artifacts/reviews/t014-brain-architecture.md`, `artifacts/reviews/t014-brain-codex-review.md`, and `artifacts/reviews/t014-brain-simplify.md`.
- AI session / traceability: Goal receipts map the Codex implementation/review/validation sequence to T014; no raw transcript or secret-bearing telemetry is included.
- Completed work: Kept `src/commands/brain-core.ts` as a compatibility facade; added `src/lib/cli/registry/brain-command-spec.ts`; split Project Brain CLI dispatch, args, result types, and add/preflight/query/stale/status subcommands into `src/lib/project-brain/*`; added command/regression/module-boundary tests; refreshed architecture docs, diagrams, report mirrors, and goal receipts.
- Affected surfaces: CLI source, registry tests, Brain command tests, architecture boundary tests, architecture docs, governance docs, generated diagram context/artifacts, report HTML mirrors, and goal-board receipts/state.
- Expected outcome alignment: Preserves Coding Harness as a portable agent operating system by keeping agent-facing command surfaces compact, searchable, and ratcheted while moving real behavior into named internal seams.
- Pattern scope inventory: Principle: command-registry deep-module splits keep facades and registry specs thin while action-specific parsing and behavior live behind named modules. Searched sibling migration patterns: prompt-gate, gap-case, simulate, ci-migrate, init, and upgrade. Brain changed in this PR; siblings were intentionally left unchanged because they are already merged slices with their own receipts/ratchets.
- Meta-behavior proof: High-signal env-backed validation steering was admitted into `docs/solutions/integration-issues/2026-05-19-env-backed-validation-admission.md` and `scripts/check-steering-feedback-contract.cjs`; the goal-board scratchpad records T014 ownership and keeps CODEX-NATIVE HARNESS MEMORY BASELINE separate.
- Repeated-error research: n.a. no identical command/test failure repeated twice during this slice; the E2E credential blocker was classified after the approved env probe path reached a runtime FIFO limitation.
- Acceptance trace: T014 acceptance is mapped to `R014-BRAIN-FULL-LOCAL-HANDOFF-GATES`, `R014-BRAIN-PR280-OPENED-BODY-REPAIRED`, the focused Brain/registry/module-boundary test suite, production `brain status --json`, full local handoff gates, diagram freshness, and this PR handoff.
- Validation evidence: See Testing section and `docs/goals/coding-harness-deep-module-migration/receipts.jsonl`.
- Review artifacts: Local architecture/Codex/simplify artifacts exist under `artifacts/reviews/`; testing and unslopify artifact retries failed to write files after mailbox findings were fixed/classified; CodeRabbit completed and returned seven valid review threads, with local repairs pending push and re-observation.
- Runtime impact: Dev/runtime-facing CLI internal refactor for `harness brain`; no public command rename or behavior removal intended.
- CodeRabbit mode coverage: Pending CodeRabbit analysis/validation/gate/closeout on this PR; local learning gate, review-context, and north-star-feedback were run before PR creation.
- Closeout state: PR opened from `codex/JSC-331-brain-deep-module`; implementation commit `2078c1a8` and observed evidence head `98508daa`; Linear state is `Refs JSC-331`; merge is blocked until the CodeRabbit review-response patch is pushed, remote checks rerun, review threads are re-observed, PR body gates pass, and final closeout evidence is current.
- Learning / reinforcement: No new memory update; learning loop ran and produced warn-only advisory matches plus pre-PR external evidence gaps.
- Deferred work: Effect layers remain explicitly out of scope for this goal. `pnpm test:deep` remains blocked at E2E credential validation in this runtime after check, unit, and integration phases pass. Remote PR checks/review-thread closeout remains pending because it requires this PR to exist first.

## Checklist

- [x] I did not push directly to `main`; this PR is from a dedicated branch.
- [x] Branch name follows policy (`codex/*` for agent-created branches).
- [x] Required local gates run: `bash scripts/validate-codestyle.sh`, `pnpm check`, `bash scripts/run-harness-gate.sh tooling-audit --path . --json`.
- [x] `scripts/validate-codestyle.sh` was treated as the enforcement point for hook env sanitization (`GIT_DIR`, `GIT_WORK_TREE`, and related `GIT_*` values are untrusted and sanitized before `pnpm run`).
- [x] Any CodeRabbit Semgrep findings were either fixed or explicitly justified when warning-level-only.
- [x] North-star learning loop considered for changed files; relevant learning gate, review-context, promotion, or feedback evidence is listed below, or marked `n.a.` with a reason.
- [x] Merge is blocked until all required checks pass.
- [x] I will delete branch/worktree after merge.

## Testing

- verification_commands: `pnpm typecheck`; `pnpm vitest run src/commands/brain.test.ts src/lib/cli/registry/command-specs.test.ts src/lib/architecture/module-boundaries.test.ts --reporter dot`; `node --import tsx src/cli.ts brain status --json`; `git diff --check`; `bash scripts/check-goal-board.sh docs/goals/coding-harness-deep-module-migration`; `jq -c . docs/goals/coding-harness-deep-module-migration/receipts.jsonl >/dev/null`; `cmp -s .harness/implementation-notes/2026-05-19-module-layout.html artifacts/architecture/module-layout.html`; `bash scripts/validate-codestyle.sh --fast`; `bash scripts/verify-work.sh --fast`; `zsh -lc 'set -a; source ~/.codex/.env >/dev/null; set +a; pnpm test:deep'`; `bash scripts/validate-codestyle.sh`; `bash scripts/run-harness-gate.sh tooling-audit --path . --json`; learning loop commands; `bash scripts/check-diagram-freshness.sh`.
- verification_outcomes: focused/typecheck/production status/board/receipt/report/fast/full/local learning/diagram gates passed; `pnpm test:deep` blocked at E2E credential validation after check, unit, and integration phases passed.
- blocked_steps_reason: `pnpm test:deep` cannot complete E2E because the bounded approved env probe times out on the current `~/.codex/.env` FIFO surface; the CodeRabbit review-response patch, remote check rerun, and review-thread closeout are pending from observed head `98508daa`.
- Command: `bash scripts/validate-codestyle.sh` -> pass
- Command: `pnpm check` -> pass
- Command: `bash scripts/run-harness-gate.sh tooling-audit --path . --json` -> pass
- Setup: `CHANGED_FILES=".diagram/agent.mmd,.diagram/database.mmd,.diagram/dependency.mmd,.diagram/manifest.json,.diagram/rag.mmd,.diagram/security.mmd,.harness/implementation-notes/2026-05-19-module-layout.html,AGENTS.md,AI/context/diagram-context.md,README.md,artifacts/architecture/module-layout.html,docs/agents/00-architecture-bootstrap.md,docs/agents/07b-agent-governance.md,docs/architecture/module-boundaries.md,docs/goals/coding-harness-deep-module-migration/receipts.jsonl,docs/goals/coding-harness-deep-module-migration/state.yaml,docs/solutions/integration-issues/2026-05-19-env-backed-validation-admission.md,scripts/check-steering-feedback-contract.cjs,src/commands/brain-core.ts,src/commands/brain.test.ts,src/lib/architecture/module-boundaries.test.ts,src/lib/cli/parse-utils.ts,src/lib/cli/registry/brain-command-spec.ts,src/lib/cli/registry/command-specs-core.ts,src/lib/cli/registry/command-specs.test.ts,src/lib/project-brain/add-cli.ts,src/lib/project-brain/cli-args.ts,src/lib/project-brain/cli-types.ts,src/lib/project-brain/cli.ts,src/lib/project-brain/preflight-cli.ts,src/lib/project-brain/query-cli.ts,src/lib/project-brain/stale-cli.ts,src/lib/project-brain/status-cli.ts"` (set before running file-scoped gates)
- Command: `bash scripts/run-harness-gate.sh learnings gate --source .harness/learnings/coderabbit.local.json --files "$CHANGED_FILES" --json` -> pass
- Command: `bash scripts/run-harness-gate.sh review-context --source .harness/learnings/coderabbit.local.json --files "$CHANGED_FILES" --json` -> pass
- Command: `bash scripts/run-harness-gate.sh north-star-feedback --source .harness/learnings/coderabbit.local.json --json` -> pass
- Command: `harness pr-closeout --pr <number> --gates artifacts/pr-closeout/closeout-gates.json --json` -> n.a. (PR number was not available before create; will run during PR closeout)
- Any other command(s): `bash scripts/check-diagram-freshness.sh` -> pass; `bash scripts/verify-work.sh --fast` -> pass (run id `20260522T215354Z-27231`); `zsh -lc 'set -a; source ~/.codex/.env >/dev/null; set +a; pnpm test:deep'` -> blocked at E2E credential validation after earlier phases passed.

## Review artifacts

- Review status:
  - CodeRabbit review: completed with seven valid review threads; local repairs are pending push and re-observation.
  - Independent reviewer: local architecture/Codex/simplify artifacts exist; testing and unslopify artifact-file retries failed after mailbox findings were handled, so merge remains blocked until PR review state is observed.
  - Codex review: local artifact exists and found no required follow-up.
- CodeRabbit: seven valid review threads repaired locally; pending push/re-observation.
- Independent reviewer evidence: `artifacts/reviews/t014-brain-architecture.md`, `artifacts/reviews/t014-brain-simplify.md`; testing/unslopify mailbox findings are summarized in `R014-BRAIN-BROAD-LOCAL-GATES-VERIFY-WORK-PASS`.
- Codex: `artifacts/reviews/t014-brain-codex-review.md`.
- CodeRabbit Semgrep: n.a. pending this PR.
- Additional evidence (if any): evidence head `98508daa`; `docs/goals/coding-harness-deep-module-migration/receipts.jsonl`, `docs/goals/coding-harness-deep-module-migration/state.yaml`, `artifacts/architecture/module-layout.html`, `.harness/implementation-notes/2026-05-19-module-layout.html`.

## Notes

This PR should merge only after remote checks, CodeRabbit, Semgrep status, review-thread observation, PR body gates, and final closeout evidence are current. The implementation work is complete locally for T014; the remaining work is review and delivery truth, not deferred feature implementation.

<!-- vale on -->
