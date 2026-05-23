<!-- vale off -->

# Pull request checklist

## Summary

- What changed (brief): Split the `gap-case` command family into focused lib seams for CLI args, lifecycle operations, policy/store access, validators, and command-registry wiring while preserving the existing command facade and legacy internal compatibility exports.
- Why this change was needed: T009 of the deep-module migration needs `gap-case` to follow the same thin-command boundary established by the plan-gate and prompt-gate slices, reducing command-module depth while keeping public behavior stable.
- Risk and rollback plan: Main risk is a behavior mismatch in gap-case open/resolve routing or policy validation; rollback is to revert this commit and restore the previous monolithic command module while retaining the goal-board evidence for rework.

Refs JSC-331

## Work performed

- Plan IDs: `docs/goals/coding-harness-deep-module-migration/goal.md`, `docs/goals/coding-harness-deep-module-migration/state.yaml`, T009 gap-case slice.
- Phase / slice: T009 `gap-case` deep-module implementation; T010 was not started.
- Session IDs: `n.a.` because this Codex Desktop continuation did not expose a stable session artifact path in the current turn; supporting traceability is implementation commit `beb169174c6dfcfbfa6401c52dbf670f636ea7f2`, PR-handoff evidence commit `b1d5a1e9`, and harness run `20260522T084418Z-84629`.
- Trace IDs: `bash scripts/verify-work.sh --fast` run `20260522T084418Z-84629`; goal receipts `R009-GAP-CASE-IMPLEMENTATION-VALIDATION` and `R009-GAP-CASE-FINAL-LOCAL-VALIDATION`.
- AI session / traceability: Commit `beb169174c6dfcfbfa6401c52dbf670f636ea7f2` maps to the T009 gap-case split, validation receipts, and the local review-artifact classification; commit `b1d5a1e9` maps to PR #275 handoff evidence in `docs/goals/coding-harness-deep-module-migration/receipts.jsonl`.
- Completed work: Extracted gap-case CLI parsing, store policy, validators, and lifecycle operations into `src/lib/gap-case/**`; moved registry command-spec wiring to `src/lib/cli/registry/gap-case-command-spec.ts`; kept `src/commands/gap-case.ts` and `src/commands/gap-case-internal.ts` as compatibility facades; added focused CLI, registry, facade, and module-boundary coverage; refreshed architecture docs, diagrams, and goal receipts.
- Affected surfaces: Code, tests, docs, diagrams, architecture context, generated module-layout artifacts, goal board, and receipts.
- Expected outcome alignment: This keeps Coding Harness portable by making another command family easier for agents to inspect, validate, and evolve through named internal seams instead of a deep command module.
- Pattern scope inventory: Principle: command-family entrypoints stay thin and delegate behavior to named lib seams. Searched sibling command splits from plan-gate/prompt-gate, registry command specs, CLI routing tests, module-boundary tests, and architecture docs. Changed gap-case siblings for command facade, internal facade, registry adapter, lib seams, and tests; left already-completed plan-gate/prompt-gate slices unchanged; deferred T010 because it is the next goal-board slice.
- Meta-behavior proof: Durable repo change is the ratcheted module-boundary coverage in `src/lib/architecture/module-boundaries.test.ts` plus architecture docs in `docs/architecture/module-boundaries.md` so gap-case cannot silently regress to a deep command module.
- Repeated-error research: `n.a.` because no identical command or test failure recurred twice during this slice.
- Acceptance trace: T009 split completed via `src/lib/gap-case/**`, registry adapter, compatibility facades, focused tests, `docs/goals/coding-harness-deep-module-migration/state.yaml`, and receipts `R009-GAP-CASE-IMPLEMENTATION-VALIDATION` / `R009-GAP-CASE-FINAL-LOCAL-VALIDATION`.
- Validation evidence: Local validation passed for focused gap-case tests, direct source CLI open/resolve proof, docs-gate, diagram freshness, `bash scripts/verify-work.sh --fast`, `pnpm check`, tooling-audit, learning gates with advisory warnings, and full `bash scripts/validate-codestyle.sh`.
- Review artifacts: `artifacts/reviews/t009-architecture.md` and `artifacts/reviews/t009-simplify.md` exist locally; testing reviewer feedback was addressed but no written artifact was produced after retry; correctness reviewer produced no artifact. CodeRabbit and remote review are pending for this draft PR.
- Runtime impact: Runtime-facing CLI behavior should remain compatible for `harness gap-case open` and `harness gap-case resolve`; implementation shape changed behind the facade.
- CodeRabbit mode coverage: Pending CodeRabbit analysis after draft PR creation; local learning-gate/review-context/north-star-feedback ran against imported CodeRabbit learning evidence.
- Closeout state: PR state is draft; merge/auto-merge not enabled; branch `codex/JSC-331-gap-case-deep-module` is pushed at PR-handoff commit `b1d5a1e9`; worktree has untracked local-only `Untitled.canvas` and `codex/FORJAMIE.md`; Linear/goal state remains active for the wider deep-module goal; next lane is remote checks and review-comment classification for this PR, not T010.
- Learning / reinforcement: No new promoted learning; imported CodeRabbit learning loop returned advisory warnings that were reviewed as non-blocking because this slice already synchronized diagrams and governed docs.
- Deferred work: Remote CI/check classification, CodeRabbit review, review-thread classification, merge readiness, and T010 after T009 PR handoff is settled.

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

- verification_commands: `pnpm typecheck`; `pnpm test src/commands/gap-case.test.ts src/lib/cli/registry/command-specs.test.ts src/lib/architecture/module-boundaries.test.ts src/cli.test.ts --reporter dot`; direct `node --import tsx src/cli.ts gap-case open/resolve` proof with temporary contract/store; `bash scripts/run-harness-gate.sh docs-gate --mode required --json`; `bash scripts/validate-codestyle.sh --fast`; `pnpm run docs:style:changed`; `bash scripts/check-diagram-freshness.sh`; `bash scripts/verify-work.sh --fast`; `pnpm check`; `bash scripts/run-harness-gate.sh tooling-audit --path . --json`; learning loop commands; `bash scripts/validate-codestyle.sh`.
- verification_outcomes: all listed commands passed; learning loop produced advisory warnings reviewed as non-blocking; docs-gate passed after README/AGENTS required-surface synchronization.
- blocked_steps_reason: none for local validation; remote checks, CodeRabbit, and PR review classification are pending after PR creation.
- Command: `bash scripts/validate-codestyle.sh` -> pass
- Command: `pnpm check` -> pass
- Command: `bash scripts/run-harness-gate.sh tooling-audit --path . --json` -> pass
- Setup: `CHANGED_FILES=".diagram/agent.mmd,.diagram/dependency.mmd,.diagram/manifest.json,.diagram/rag.mmd,.diagram/security.mmd,.harness/implementation-notes/2026-05-19-module-layout.html,AGENTS.md,AI/context/diagram-context.md,README.md,artifacts/architecture/module-layout.html,docs/agents/00-architecture-bootstrap.md,docs/agents/07b-agent-governance.md,docs/architecture/module-boundaries.md,docs/goals/coding-harness-deep-module-migration/receipts.jsonl,docs/goals/coding-harness-deep-module-migration/state.yaml,src/cli.test.ts,src/commands/gap-case-internal.ts,src/commands/gap-case.test.ts,src/commands/gap-case.ts,src/lib/architecture/module-boundaries.test.ts,src/lib/cli/registry/command-specs-core.ts,src/lib/cli/registry/command-specs.test.ts,src/lib/cli/registry/gap-case-command-spec.ts,src/lib/gap-case/cli-args.ts,src/lib/gap-case/cli.ts,src/lib/gap-case/operations.ts,src/lib/gap-case/store.ts,src/lib/gap-case/validators.ts"` (set before running file-scoped gates)
- Command: `bash scripts/run-harness-gate.sh learnings gate --source .harness/learnings/coderabbit.local.json --files "$CHANGED_FILES" --json` -> pass
- Command: `bash scripts/run-harness-gate.sh review-context --source .harness/learnings/coderabbit.local.json --files "$CHANGED_FILES" --json` -> pass
- Command: `bash scripts/run-harness-gate.sh north-star-feedback --source .harness/learnings/coderabbit.local.json --json` -> pass
- Command: `harness pr-closeout --pr <number> --gates artifacts/pr-closeout/closeout-gates.json --json` -> n.a. (draft PR creation; closeout gate belongs after remote checks and review artifacts are available)
- Any other command(s): `bash scripts/verify-work.sh --fast` -> pass; `bash scripts/check-diagram-freshness.sh` -> pass; `bash scripts/run-harness-gate.sh docs-gate --mode required --json` -> pass; `pnpm test src/commands/gap-case.test.ts src/lib/cli/registry/command-specs.test.ts src/lib/architecture/module-boundaries.test.ts src/cli.test.ts --reporter dot` -> pass; direct `node --import tsx src/cli.ts gap-case open/resolve` proof -> pass.

## Review artifacts

- Review status:
  - CodeRabbit review: pending completion and finding resolution or waiver.
  - Independent reviewer: pending confirmation that review was performed outside the coding agent.
  - Codex review: local architecture and simplicity review artifacts exist; testing reviewer feedback was fixed but artifact write failed after retry; correctness artifact missing.
- CodeRabbit: pending draft PR review
- Independent reviewer evidence: pending remote/independent review confirmation
- Codex: `artifacts/reviews/t009-architecture.md`, `artifacts/reviews/t009-simplify.md`; coverage gap for missing testing/correctness written artifacts
- CodeRabbit Semgrep: n.a. pending CodeRabbit/Semgrep review on this PR
- Additional evidence (if any): `docs/goals/coding-harness-deep-module-migration/receipts.jsonl`, `docs/goals/coding-harness-deep-module-migration/state.yaml`

## Notes

This draft PR completes only the T009 gap-case implementation slice. It should stay blocked until remote checks, CodeRabbit/Semgrep, independent review, and missing-review-artifact classification are complete; the wider deep-module goal remains open and T010 has not started.

<!-- vale on -->
