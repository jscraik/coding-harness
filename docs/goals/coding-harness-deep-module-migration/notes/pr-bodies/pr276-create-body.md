<!-- vale off -->

# Pull request checklist

## Summary

- What changed (brief): Split the simulate command family out of command and registry bulk into focused `src/lib/simulate/*` seams, with thin compatibility facades and a dedicated registry spec.
- Why this change was needed: Refs JSC-331 and continues the governed deep-module migration by making simulate parsing, orchestration, analysis, and recommendations easier to review, test, and route without loading the old monolithic command file.
- Risk and rollback plan: Risk is command behavior drift around CLI usage errors, JSON output, and simulation analysis. Roll back by reverting `bb79f3cf` if remote checks or review find behavior drift; compatibility command facades preserve current imports.

## Work performed

- Plan IDs: JSC-331; `docs/goals/coding-harness-deep-module-migration/goal.md`; `docs/goals/coding-harness-deep-module-migration/state.yaml`; receipts `R010-SIMULATE-IMPLEMENTATION-VALIDATED` and `R010-SIMULATE-COMMIT-READY`.
- Phase / slice: T010 simulate deep-module migration slice.
- Session IDs: Native goal `019e4a39-47f8-7ac0-b979-d52b7f02ec23`; memory-derived continuation rollout `019e3f83-bf95-7112-bbf5-26f873fcf977`.
- Trace IDs: `bash scripts/verify-work.sh --fast` run id `20260522T101418Z-55835`; commit `bb79f3cf`; draft PR checks pending after creation.
- AI session / traceability: Current Codex session implemented, validated, committed, and pushed the T010 simulate split; goal receipts in `docs/goals/coding-harness-deep-module-migration/receipts.jsonl` preserve the implementation and validation evidence without raw transcript content.
- Completed work: Added `src/lib/simulate/cli.ts`, `cli-args.ts`, `analysis.ts`, and `recommendations.ts`; added `src/lib/cli/registry/simulate-command-spec.ts`; converted `src/commands/simulate*.ts` files into compatibility facades; added parser/CLI/registry/module-boundary tests; refreshed module-layout HTML, architecture context, README, AGENTS, and agent-governance docs.
- Affected surfaces: Code, tests, CLI registry, docs, generated diagram artifacts, architecture context, goal receipts, and module-layout artifacts.
- Expected outcome alignment: Reduces agent context load and review/rework cost by keeping the public simulate command surface thin while moving action-specific behavior behind named internal seams with focused tests and ratchets.
- Pattern scope inventory: Principle: command-registry deep-module slices should keep command facades thin and move CLI parsing/delegation into module-owned seams. Sibling patterns checked against prompt-gate and gap-case splits; T010 follows the same registry-adapter and compatibility-facade contract. Deferred sibling work remains T011 ci-migrate and later slices in the goal board.
- Meta-behavior proof: Durable proof is the updated module-boundary ratchet in `src/lib/architecture/module-boundaries.test.ts`, docs in `docs/architecture/module-boundaries.md`, docs-gate synchronized surfaces (`README.md`, `AGENTS.md`, `docs/agents/00-architecture-bootstrap.md`, `docs/agents/07b-agent-governance.md`), and receipts `R010-SIMULATE-IMPLEMENTATION-VALIDATED` / `R010-SIMULATE-COMMIT-READY`.
- Repeated-error research: Source: local command-shape failure in the north-star learning loop; Candidate 1: pass comma-separated files directly; Candidate 2: export `CHANGED_FILES` before invoking the gate; Candidate 3: pass repeated file tokens. Chosen: export `CHANGED_FILES` and rerun the exact gates. Implemented: learning loop rerun reached `learnings-gate` warn, `review-context` success, and `north-star-feedback` success.
- Review-context learning acknowledgement: `coderabbit.coding-harness.docs-frontmatter-machine-readable` was considered. This slice preserves machine-readable frontmatter as metadata rather than prose content and does not add frontmatter entries to document bodies or tables of contents.
- Acceptance trace: T010 objective maps to commit `bb79f3cf`, receipts `R010-SIMULATE-IMPLEMENTATION-VALIDATED` and `R010-SIMULATE-COMMIT-READY`, module-layout artifacts, module-boundary ratchets, focused simulate/registry tests, direct production simulate CLI proof, docs-gate pass, and deep-gate E2E credential blocker classification.
- Validation evidence: Local focused tests, typecheck, direct simulate CLI proof, docs-gate, validate-codestyle fast, verify-work fast, full validate-codestyle, tooling-audit, learning loop, pre-commit, and pre-push passed or are classified below.
- Review artifacts: CodeRabbit pending; local Codex product review artifact `artifacts/reviews/t010-simulate-codex-review.md` reported no actionable findings; local simplicity review artifact `artifacts/reviews/t010-simulate-simplify.md` produced classified/deferred findings; architecture and testing reviewer artifact writes failed after retry and are merge blockers until waived or replaced.
- Runtime impact: Runtime-facing CLI behavior is intended to be compatible; dev/CI impact includes stronger module-boundary ratchets and generated architecture context refresh.
- CodeRabbit mode coverage: Gate and closeout pending CodeRabbit on this draft PR; local review gates covered simplify and Codex product review, with architecture/testing artifact gaps recorded.
- Closeout state: PR is draft/pending creation; local branch `codex/JSC-331-simulate-deep-module` pushed at `bb79f3cf`; remote checks and review threads pending observation; Linear JSC-331 remains active; next lane T011 ci-migrate is blocked until this PR has remote check and review-thread evidence.
- Learning / reinforcement: North-star learning loop considered `.harness/learnings/coderabbit.local.json`; learning gate returned advisory warnings, review-context returned success, and north-star-feedback returned success with insufficient evidence for final closeout fields because remote review/check evidence is still pending.
- Deferred work: Duplicate summary filesystem scan consolidation, deeper stdout/stderr coverage for `--json` / `--ci-soft`, focused analysis/recommendation tests beyond current boundary proof, missing architecture/testing reviewer artifacts, and E2E credential-backed deep validation.

## Checklist

- [x] I did not push directly to `main`; this PR is from a dedicated branch.
- [x] Branch name follows policy (`codex/*` for agent-created branches).
- [x] Required local gates run: `bash scripts/validate-codestyle.sh`, `pnpm check`, `bash scripts/run-harness-gate.sh tooling-audit --path . --json`.
- [x] `scripts/validate-codestyle.sh` was treated as the enforcement point for hook env sanitization (`GIT_DIR`, `GIT_WORK_TREE`, and related `GIT_*` values are untrusted and sanitized before `pnpm run`).
- [x] Any CodeRabbit Semgrep findings were either fixed or explicitly justified when warning-level-only.
- [x] North-star learning loop considered for changed files; relevant learning gate, review-context, promotion, or feedback evidence is listed below, or marked `n.a.` with a reason.
- [x] Merge is blocked until all required checks pass.
- [ ] **(Pending)** I will delete branch/worktree after merge.

## Testing

- verification_commands: `pnpm test src/commands/simulate.test.ts src/lib/cli/registry/command-specs.test.ts src/lib/architecture/module-boundaries.test.ts --reporter dot`; `pnpm typecheck`; `pnpm exec tsx src/cli.ts simulate --contract-a harness.contract.json --contract-b harness.contract.json --json`; `bash scripts/run-harness-gate.sh docs-gate --mode required --json`; `bash scripts/validate-codestyle.sh --fast`; `jq -c . docs/goals/coding-harness-deep-module-migration/receipts.jsonl >/dev/null`; `bash scripts/check-goal-board.sh docs/goals/coding-harness-deep-module-migration`; `git diff --check`; `git diff --cached --check`; `bash scripts/check-diagram-freshness.sh`; `bash scripts/verify-work.sh --fast`; `bash scripts/run-harness-gate.sh tooling-audit --path . --json`; `bash scripts/validate-codestyle.sh`; `pnpm test:deep`; learning loop commands listed below; pre-commit; pre-push.
- verification_outcomes: implementation, docs, board, diagram, hook, tooling-audit, full validate-codestyle, and push gates passed; `pnpm test:deep` passed `pnpm check`, `test:artifacts`, and integration before failing at E2E credential environment validation; `learnings gate` returned warn with advisory matches; `review-context` and `north-star-feedback` returned success.
- blocked_steps_reason: Remote PR checks, CodeRabbit, Semgrep Cloud, and review-thread classification pending after draft PR creation; architecture/testing reviewer artifact writes failed after retry and need replacement or waiver before merge; `pnpm test:deep` E2E is blocked because the current process lacks GitHub and Linear credentials and `~/.codex/.env` is a FIFO, not a readable env file for safe source/grep recovery.
- Command: `bash scripts/validate-codestyle.sh` -> pass
- Command: `pnpm check` -> pass
- Command: `bash scripts/run-harness-gate.sh tooling-audit --path . --json` -> pass
- Setup: `CHANGED_FILES=".diagram/agent.mmd,.diagram/dependency.mmd,.diagram/manifest.json,.diagram/security.mmd,.harness/implementation-notes/2026-05-19-module-layout.html,AGENTS.md,AI/context/diagram-context.md,README.md,artifacts/architecture/module-layout.html,docs/agents/00-architecture-bootstrap.md,docs/agents/07b-agent-governance.md,docs/architecture/module-boundaries.md,docs/goals/coding-harness-deep-module-migration/receipts.jsonl,docs/goals/coding-harness-deep-module-migration/state.yaml,src/commands/simulate-analysis-recommendations.ts,src/commands/simulate-analysis.ts,src/commands/simulate.test.ts,src/commands/simulate.ts,src/lib/architecture/module-boundaries.test.ts,src/lib/cli/registry/command-specs-core.ts,src/lib/cli/registry/simulate-command-spec.ts,src/lib/simulate/analysis.ts,src/lib/simulate/cli-args.ts,src/lib/simulate/cli.ts,src/lib/simulate/recommendations.ts"` (set before running file-scoped gates)
- Command: `bash scripts/run-harness-gate.sh learnings gate --source .harness/learnings/coderabbit.local.json --files "$CHANGED_FILES" --json` -> fail
- Command: `bash scripts/run-harness-gate.sh review-context --source .harness/learnings/coderabbit.local.json --files "$CHANGED_FILES" --json` -> pass
- Command: `bash scripts/run-harness-gate.sh north-star-feedback --source .harness/learnings/coderabbit.local.json --json` -> pass
- Command: `harness pr-closeout --pr <number> --gates artifacts/pr-closeout/closeout-gates.json --json` -> n.a. (draft PR not ready for closeout; remote checks/reviews pending)
- Any other command(s):
  - Command: `pnpm test src/commands/simulate.test.ts src/lib/cli/registry/command-specs.test.ts src/lib/architecture/module-boundaries.test.ts --reporter dot` -> pass
  - Command: `pnpm typecheck` -> pass
  - Command: `pnpm exec tsx src/cli.ts simulate --contract-a harness.contract.json --contract-b harness.contract.json --json` -> pass
  - Command: `bash scripts/run-harness-gate.sh docs-gate --mode required --json` -> pass
  - Command: `bash scripts/validate-codestyle.sh --fast` -> pass
  - Command: `bash scripts/verify-work.sh --fast` -> pass
  - Command: `pnpm test:deep` -> blocked (E2E credential environment validation failed after `pnpm check`, `test:artifacts`, and integration passed; `~/.codex/.env` recovery surface is a FIFO)
  - Command: `git commit` -> pass
  - Command: `git push -u origin codex/JSC-331-simulate-deep-module` -> pass

## Review artifacts

- Review status:
  - CodeRabbit review: pending completion and finding resolution or waiver.
  - Independent reviewer: local simplicity review completed; architecture and testing reviewer artifact writes failed after retry, so merge remains blocked until replaced or waived.
  - Codex review: local Codex product review completed with no actionable findings; remote Codex/CodeRabbit review pending after draft PR creation.
- CodeRabbit: pending draft PR review.
- Independent reviewer evidence: `artifacts/reviews/t010-simulate-simplify.md`; architecture reviewer feedback addressed in tests but `artifacts/reviews/t010-simulate-architecture.md` missing; testing reviewer artifact missing after retry.
- Codex: `artifacts/reviews/t010-simulate-codex-review.md`
- CodeRabbit Semgrep: n.a. until CodeRabbit/Semgrep runs on the draft PR.
- Additional evidence (if any): Goal receipts `R010-SIMULATE-IMPLEMENTATION-VALIDATED` and `R010-SIMULATE-COMMIT-READY`; verify-work run id `20260522T101418Z-55835`; commit `bb79f3cf`.

## Notes

This is the T010 simulate slice for the JSC-331 deep-module migration. It keeps the public command and compatibility imports stable while moving parsing, orchestration, analysis, recommendations, and registry delegation into focused module seams with ratchets and tests. Merge should wait for remote checks, CodeRabbit/Semgrep, review-thread classification, replacement or explicit waiver for the missing architecture/testing review artifacts, and credential-backed E2E deep validation.

<!-- vale on -->
