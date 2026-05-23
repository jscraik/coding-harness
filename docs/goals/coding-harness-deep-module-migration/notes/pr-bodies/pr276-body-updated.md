<!-- vale off -->

# Pull request checklist

## Summary

- What changed (brief): Split the simulate command family out of command and registry bulk into focused `src/lib/simulate/*` seams, with thin compatibility facades and a dedicated registry spec.
- Why this change was needed: Refs JSC-331 and continues the governed deep-module migration by making simulate parsing, orchestration, analysis, recommendations, and registry delegation easier to review, test, and route without loading the old monolithic command file.
- Risk and rollback plan: Risk is command behavior drift around CLI usage errors, JSON output, and simulation analysis. Roll back by reverting the T010 implementation and follow-up commits (`bb79f3cf`, `96d76649`, `8f92a7ab`, `50e633e7`, `a7e85a37`, `073b1f04`, `ef3db349`, and `2e1a817c`) if remote checks or review find behavior drift; compatibility command facades preserve current imports.

## Work performed

- Plan IDs: JSC-331; `docs/goals/coding-harness-deep-module-migration/goal.md`; `docs/goals/coding-harness-deep-module-migration/state.yaml`; receipts `R010-SIMULATE-IMPLEMENTATION-VALIDATED`, `R010-SIMULATE-COMMIT-READY`, `R010-SIMULATE-PR276-DRAFT-HANDOFF`, `R010-SIMULATE-PR276-POST-PUSH-OBSERVED`, `R010-SIMULATE-REVIEW-GAP-TESTS`, `R010-SIMULATE-PR276-GREEN-BODY-REFRESH`, `R010-SIMULATE-CODERABBIT-REVIEW-RESPONSE`, `R010-SIMULATE-CODERABBIT-IDENTICAL-HASH-RESPONSE`, and `R010-SIMULATE-STATE-REOBSERVATION-REFRESH`.
- Phase / slice: T010 simulate deep-module migration slice.
- Session IDs: Native goal `019e4a39-47f8-7ac0-b979-d52b7f02ec23`; memory-derived continuation rollout `019e3f83-bf95-7112-bbf5-26f873fcf977`.
- Trace IDs: `bash scripts/verify-work.sh --fast` run id `20260522T101418Z-55835`; implementation commit `bb79f3cf`; evidence commits `96d76649`, `8f92a7ab`, and `a7e85a37`; review-gap repair commit `50e633e7`; CodeRabbit response commits `073b1f04` and `ef3db349`; state-refresh commit `2e1a817c`; latest PR #276 observation at `2e1a817c` has remote checks still pending.
- AI session / traceability: Current Codex session implemented, validated, committed, pushed, and reobserved the T010 simulate split; goal receipts in `docs/goals/coding-harness-deep-module-migration/receipts.jsonl` preserve the implementation, validation, PR handoff, and review-gap repair evidence without raw transcript content.
- Completed work: Added `src/lib/simulate/cli.ts`, `cli-args.ts`, `analysis.ts`, and `recommendations.ts`; added `src/lib/cli/registry/simulate-command-spec.ts`; converted `src/commands/simulate*.ts` files into compatibility facades; added parser/CLI/registry/module-boundary tests; refreshed module-layout HTML, architecture context, README, AGENTS, and agent-governance docs; replaced the missing architecture/testing review artifacts with local verified artifacts and fixed the valid testing gaps.
- Affected surfaces: Code, tests, CLI registry, docs, generated diagram artifacts, architecture context, goal receipts, module-layout artifacts, and PR handoff evidence.
- Expected outcome alignment: Reduces agent context load and review/rework cost by keeping the public simulate command surface thin while moving action-specific behavior behind named internal seams with focused tests and ratchets.
- Pattern scope inventory: Principle: command-registry deep-module slices should keep command facades thin and move CLI parsing/delegation into module-owned seams. Sibling patterns checked against prompt-gate and gap-case splits; T010 follows the same registry-adapter and compatibility-facade contract. Deferred sibling work remains T011 ci-migrate and later slices in the goal board.
- Meta-behavior proof: Durable proof is the updated module-boundary ratchet in `src/lib/architecture/module-boundaries.test.ts`, docs in `docs/architecture/module-boundaries.md`, docs-gate synchronized surfaces (`README.md`, `AGENTS.md`, `docs/agents/00-architecture-bootstrap.md`, `docs/agents/07b-agent-governance.md`), and the T010 receipts named above.
- Repeated-error research: Source: local command-shape failure in the north-star learning loop; Candidate 1: pass comma-separated files directly; Candidate 2: export `CHANGED_FILES` before invoking the gate; Candidate 3: pass repeated file tokens. Chosen: export `CHANGED_FILES` and rerun the exact gates. Implemented: learning loop rerun reached `learnings-gate` warn, `review-context` success, and `north-star-feedback` success.
- Review-context learning acknowledgement: `coderabbit.coding-harness.docs-frontmatter-machine-readable` was considered. This slice preserves machine-readable frontmatter as metadata rather than prose content and does not add frontmatter entries to document bodies or tables of contents.
- Acceptance trace: T010 objective maps to implementation commit `bb79f3cf`, review-gap repair commit `50e633e7`, review-response commits `073b1f04` and `ef3db349`, state-refresh commit `2e1a817c`, the T010 receipts, module-layout artifacts, module-boundary ratchets, focused simulate/registry/recommendations tests, direct production simulate CLI proof, docs-gate pass, resolved GitHub review threads, latest-head pending remote checks, and deep-gate E2E credential blocker classification.
- Validation evidence: Local focused tests, typecheck, direct simulate CLI proof, docs-gate, validate-codestyle fast, verify-work fast, full validate-codestyle, tooling-audit, learning loop, pre-commit, pre-push, PR template/Linear gates, live PR checks, and live review-thread lookup passed or are classified below.
- Review artifacts: CodeRabbit is pending again after the latest state-refresh commit; GitHub review-thread lookup shows the previously addressed CodeRabbit/docs and identical-hash threads resolved. Local Codex product review artifact `artifacts/reviews/t010-simulate-codex-review.md` reported no actionable findings; local simplicity review artifact `artifacts/reviews/t010-simulate-simplify.md` produced classified/deferred findings; replacement local architecture artifact `artifacts/reviews/t010-architecture.md` reports only a low follow-up; replacement local testing artifact `artifacts/reviews/t010-testing.md` found valid gaps that were fixed in `50e633e7`. `artifacts/` is gitignored, so durable tracked proof is in the goal receipts/state.
- Runtime impact: Runtime-facing CLI behavior is intended to be compatible; dev/CI impact includes stronger module-boundary ratchets and generated architecture context refresh.
- CodeRabbit mode coverage: CodeRabbit check passed before later evidence commits, then reset to pending at latest head `2e1a817c`; GitHub review-thread lookup shows addressed review threads resolved. Local review gates covered simplicity, Codex product, architecture, and testing, with architecture/testing replacement artifact proof recorded in receipts/state.
- Closeout state: PR #276 is open and ready for review at head `2e1a817c`; mergeable is MERGEABLE and mergeStateStatus is BLOCKED; CodeRabbit and several CircleCI contexts are pending after the state-refresh commit; addressed review threads are resolved; Linear JSC-331 remains active; next lane T011 ci-migrate is blocked until latest-head checks and deep E2E blocker evidence are classified.
- Learning / reinforcement: North-star learning loop considered `.harness/learnings/coderabbit.local.json`; learning gate returned advisory warnings, review-context returned success, and north-star-feedback returned success with insufficient evidence for final closeout fields because CodeRabbit and CircleCI checks are pending at latest head `2e1a817c` and the broader goal is not complete.
- Deferred work: Duplicate summary filesystem scan consolidation, deeper stdout/stderr coverage beyond current boundary proof, the low architecture follow-up for remaining simulate aggregation points, credential-backed `pnpm test:deep` E2E validation, and later goal-board slices including T011 ci-migrate.

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

- verification_commands: `pnpm test src/commands/simulate.test.ts src/lib/cli/registry/command-specs.test.ts src/lib/architecture/module-boundaries.test.ts --reporter dot`; `pnpm typecheck`; `pnpm exec tsx src/cli.ts simulate --contract-a harness.contract.json --contract-b harness.contract.json --json`; `bash scripts/run-harness-gate.sh docs-gate --mode required --json`; `bash scripts/validate-codestyle.sh --fast`; `jq -c . docs/goals/coding-harness-deep-module-migration/receipts.jsonl >/dev/null`; `bash scripts/check-goal-board.sh docs/goals/coding-harness-deep-module-migration`; `git diff --check`; `git diff --cached --check`; `bash scripts/check-diagram-freshness.sh`; `bash scripts/verify-work.sh --fast`; `bash scripts/run-harness-gate.sh tooling-audit --path . --json`; `bash scripts/validate-codestyle.sh`; `pnpm test:deep`; `pnpm test src/commands/simulate.test.ts src/lib/simulate/recommendations.test.ts src/lib/cli/registry/command-specs.test.ts src/lib/architecture/module-boundaries.test.ts --reporter dot`; `gh pr checks 276 --repo jscraik/coding-harness --json name,state,bucket,workflow,link`; `gh pr view 276 --repo jscraik/coding-harness --json number,title,body,state,isDraft,mergeStateStatus,mergeable,reviewDecision,headRefName,headRefOid,url`; `mcp__codex_apps__github_list_pull_request_review_threads repo_full_name=jscraik/coding-harness pr_number=276`; learning loop commands listed below; pre-commit; pre-push.
- verification_outcomes: implementation, docs, board, diagram, hook, tooling-audit, full validate-codestyle, push gates, review-gap tests, remote PR checks, and review-thread lookup passed; `pnpm test:deep` passed `pnpm check`, `test:artifacts`, and integration before failing at E2E credential environment validation; `learnings gate` returned warn with advisory matches; `review-context` and `north-star-feedback` returned success.
- blocked_steps_reason: PR #276 is ready for review at `2e1a817c`, but CodeRabbit and several CircleCI contexts are pending after the state-refresh commit; `pnpm test:deep` E2E is blocked because the current process lacks GitHub and Linear credentials and `~/.codex/.env` is a FIFO, not a readable env file for safe source/grep recovery. GitHub review-thread lookup shows addressed threads resolved.
- Command: `bash scripts/validate-codestyle.sh` -> pass
- Command: `pnpm check` -> pass
- Command: `bash scripts/run-harness-gate.sh tooling-audit --path . --json` -> pass
- Setup: `CHANGED_FILES=".diagram/agent.mmd,.diagram/dependency.mmd,.diagram/manifest.json,.diagram/security.mmd,.harness/implementation-notes/2026-05-19-module-layout.html,AGENTS.md,AI/context/diagram-context.md,README.md,artifacts/architecture/module-layout.html,docs/agents/00-architecture-bootstrap.md,docs/agents/07b-agent-governance.md,docs/architecture/module-boundaries.md,docs/goals/coding-harness-deep-module-migration/receipts.jsonl,docs/goals/coding-harness-deep-module-migration/state.yaml,src/commands/simulate-analysis-recommendations.ts,src/commands/simulate-analysis.ts,src/commands/simulate.test.ts,src/commands/simulate.ts,src/lib/architecture/module-boundaries.test.ts,src/lib/cli/registry/command-specs-core.ts,src/lib/cli/registry/simulate-command-spec.ts,src/lib/simulate/analysis.ts,src/lib/simulate/cli-args.ts,src/lib/simulate/cli.ts,src/lib/simulate/recommendations.ts"` (set before running file-scoped gates)
- Command: `bash scripts/run-harness-gate.sh learnings gate --source .harness/learnings/coderabbit.local.json --files "$CHANGED_FILES" --json` -> fail
- Command: `bash scripts/run-harness-gate.sh review-context --source .harness/learnings/coderabbit.local.json --files "$CHANGED_FILES" --json` -> pass
- Command: `bash scripts/run-harness-gate.sh north-star-feedback --source .harness/learnings/coderabbit.local.json --json` -> pass
- Command: `harness pr-closeout --pr <number> --gates artifacts/pr-closeout/closeout-gates.json --json` -> n.a. (PR #276 is ready but not merge-ready, and the broader deep-module goal is not ready for final closeout)
- Any other command(s):
  - Command: `pnpm test src/commands/simulate.test.ts src/lib/cli/registry/command-specs.test.ts src/lib/architecture/module-boundaries.test.ts --reporter dot` -> pass
  - Command: `pnpm typecheck` -> pass
  - Command: `pnpm exec tsx src/cli.ts simulate --contract-a harness.contract.json --contract-b harness.contract.json --json` -> pass
  - Command: `bash scripts/run-harness-gate.sh docs-gate --mode required --json` -> pass
  - Command: `bash scripts/validate-codestyle.sh --fast` -> pass
  - Command: `bash scripts/verify-work.sh --fast` -> pass
  - Command: `pnpm test src/commands/simulate.test.ts src/lib/simulate/recommendations.test.ts src/lib/cli/registry/command-specs.test.ts src/lib/architecture/module-boundaries.test.ts --reporter dot` -> pass
  - Command: `gh pr checks 276 --repo jscraik/coding-harness --json name,state,bucket,workflow,link` -> blocked (latest head `2e1a817c` still has pending CodeRabbit and CircleCI contexts)
  - Command: `gh pr view 276 --repo jscraik/coding-harness --json number,title,body,state,isDraft,mergeStateStatus,mergeable,reviewDecision,headRefName,headRefOid,url` -> pass
  - Command: `mcp__codex_apps__github_list_pull_request_review_threads repo_full_name=jscraik/coding-harness pr_number=276` -> pass
  - Command: `pnpm test:deep` -> blocked (E2E credential environment validation failed after `pnpm check`, `test:artifacts`, and integration passed; `~/.codex/.env` recovery surface is a FIFO)
  - Command: `git commit` -> pass
  - Command: `git push -u origin codex/JSC-331-simulate-deep-module` -> pass

## Review artifacts

- Review status:
  - CodeRabbit review: check status pending at latest head `2e1a817c`; addressed review threads are resolved in GitHub.
  - Independent reviewer: local simplicity, architecture, and testing reviews completed; architecture has only a low follow-up, and testing gaps were fixed by `50e633e7`.
  - Codex review: local Codex product review completed with no actionable findings.
- CodeRabbit: status context pending at latest head `2e1a817c`; addressed review threads are resolved in GitHub.
- Independent reviewer evidence: `artifacts/reviews/t010-simulate-simplify.md`; replacement architecture artifact `artifacts/reviews/t010-architecture.md`; replacement testing artifact `artifacts/reviews/t010-testing.md`; durable tracked proof in T010 receipts/state because `artifacts/` is gitignored.
- Codex: `artifacts/reviews/t010-simulate-codex-review.md`
- CodeRabbit Semgrep: no unresolved CodeRabbit/Semgrep findings remain in visible PR #276 thread state; CodeRabbit is pending at latest head `2e1a817c`; security/snyk passes while CircleCI security-scan aggregate is still in progress.
- Additional evidence (if any): Goal receipts `R010-SIMULATE-IMPLEMENTATION-VALIDATED`, `R010-SIMULATE-COMMIT-READY`, `R010-SIMULATE-PR276-DRAFT-HANDOFF`, `R010-SIMULATE-PR276-POST-PUSH-OBSERVED`, `R010-SIMULATE-REVIEW-GAP-TESTS`, and `R010-SIMULATE-PR276-GREEN-BODY-REFRESH`; verify-work run id `20260522T101418Z-55835`; implementation commit `bb79f3cf`; review-gap repair commit `50e633e7`; latest state-refresh commit `2e1a817c`.

## Notes

This is the T010 simulate slice for the JSC-331 deep-module migration. It keeps the public command and compatibility imports stable while moving parsing, orchestration, analysis, recommendations, and registry delegation into focused module seams with ratchets and tests. PR #276 is ready for review at latest head `2e1a817c`; addressed review threads are resolved, but CodeRabbit and several CircleCI contexts are pending and the credential-backed E2E blocker remains classified; T011 must not start until that T010 handoff boundary is intentionally closed.

<!-- vale on -->
