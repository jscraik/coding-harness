<!-- vale off -->

# Pull request checklist

## Summary

- What changed (brief): Split ci-migrate raw argument parsing and delegated helper dispatch out of the shared command registry into focused ci-migrate adapters, then refreshed the required architecture and governance evidence.
- Why this change was needed: T011 in the deep-module migration needs the command registry to stop owning ci-migrate-specific option assembly before later CI migration slices deepen the command family.
- Risk and rollback plan: Risk is limited to ci-migrate CLI argument routing and command registration. Roll back by reverting this PR; no mutating ci-migrate prepare, commit, abort, branch-protection, or promote-mode action was executed by this change.

## Work performed

- Plan IDs: Refs JSC-331; docs/goals/coding-harness-deep-module-migration/goal.md; T011; receipts R011-CI-MIGRATE-REGISTRY-SPLIT, R011-CI-MIGRATE-HANDOFF-VALIDATION, R011-CI-MIGRATE-DOCS-GATE-SYNC, R011-CI-MIGRATE-POST-DOCS-VERIFY, R011-CI-MIGRATE-DIAGRAM-REFRESH
- Phase / slice: Deep-module migration T011 ci-migrate registry-boundary split.
- Session IDs: Codex desktop session continuing the existing deep-module goal after power-cut resume; durable trace captured in docs/goals/coding-harness-deep-module-migration/receipts.jsonl.
- Trace IDs: verify-work run id 20260522T133451Z-70931; pushed head 765cadf895825e671b022b77554254fd5eb5e462.
- AI session / traceability: The Codex session produced the ci-migrate parser/registry split, docs-gate synchronizations, generated diagram refresh, and goal-board receipts; the receipts map implementation and validation evidence without embedding transcripts.
- Completed work: Added src/lib/ci-migrate/cli-args.ts; added src/lib/cli/registry/ci-migrate-command-spec.ts; simplified src/lib/cli/registry/command-specs-core.ts; added registry/parser and module-boundary tests; refreshed module-boundary docs, README/AGENTS governance surfaces, module-layout HTML, generated diagrams, and goal receipts/state.
- Affected surfaces: Code, tests, docs, CLI registry, generated architecture artifacts, goal receipts/state.
- Expected outcome alignment: Keeps Coding Harness command families portable by leaving the public command facade thin and moving action-specific parsing into a named internal adapter that future brownfield repos can reason about.
- Pattern scope inventory: Principle: command-registry deep-module splits must keep action-specific option builders and delegated helper routing behind command-family seams. Sibling implementations checked through existing prompt-gate, gap-case, and simulate docs/tests; ci-migrate was changed, other siblings intentionally left unchanged because their slices are already closed or separately tracked.
- Meta-behavior proof: Durable guardrails are in src/lib/architecture/module-boundaries.test.ts, docs/architecture/module-boundaries.md, README.md, AGENTS.md, docs/agents/00-architecture-bootstrap.md, docs/agents/07b-agent-governance.md, and the T011 receipts.
- Repeated-error research: n.a.; no same command/test failure repeated twice. Push-time docs-gate and diagram freshness blockers were validator-driven artifact requirements, recorded in receipts, and resolved by synchronizing the required surfaces.
- Acceptance trace: T011 expected output maps to R011-CI-MIGRATE-REGISTRY-SPLIT for implementation, R011-CI-MIGRATE-HANDOFF-VALIDATION and R011-CI-MIGRATE-POST-DOCS-VERIFY for local validation, and R011-CI-MIGRATE-DIAGRAM-REFRESH for generated architecture artifact freshness.
- Validation evidence: Focused ci-migrate vitest passed; full command-specs/module-boundary vitest files passed; pnpm typecheck passed; docs-gate passed; validate-codestyle fast passed; verify-work fast passed with run id 20260522T133451Z-70931; diagram freshness passed.
- Review artifacts: CodeRabbit pending on this draft PR; independent reviewer pending; Codex implementation evidence in docs/goals/coding-harness-deep-module-migration/receipts.jsonl.
- Runtime impact: Dev-only and CLI-facing parser/dispatch impact for ci-migrate; no remote CI migration mutation was executed.
- CodeRabbit mode coverage: pending CodeRabbit analysis/validation on this draft PR.
- Closeout state: PR is draft/open at head 765cadf895825e671b022b77554254fd5eb5e462, mergeStateStatus is BLOCKED, CodeRabbit passed with zero review threads, ci/circleci: pr-template is being repaired by this body update, several CircleCI contexts remain pending, Linear state is Refs JSC-331, and T012 remains blocked until pushed-head checks and review state are current.
- Learning / reinforcement: none beyond repo-local guard/doc updates; the durable pattern change is encoded in module-boundary tests and governance docs.
- Deferred work: T012 init and later deep-module slices; full `bash scripts/validate-codestyle.sh`, `pnpm check`, `tooling-audit`, CodeRabbit, and independent review remain before merge readiness.

## Checklist

- [x] I did not push directly to `main`; this PR is from a dedicated branch.
- [x] Branch name follows policy (`codex/*` for agent-created branches).
- [ ] **(Pending)** Required local gates run: `bash scripts/validate-codestyle.sh`, `pnpm check`, `bash scripts/run-harness-gate.sh tooling-audit --path . --json`.
- [x] `scripts/validate-codestyle.sh` was treated as the enforcement point for hook env sanitization (`GIT_DIR`, `GIT_WORK_TREE`, and related `GIT_*` values are untrusted and sanitized before `pnpm run`).
- [ ] **(Pending)** Any CodeRabbit Semgrep findings were either fixed or explicitly justified when warning-level-only.
- [ ] **(Pending)** North-star learning loop considered for changed files; relevant learning gate, review-context, promotion, or feedback evidence is listed below, or marked `n.a.` with a reason.
- [ ] **(Pending)** Merge is blocked until all required checks pass.
- [ ] **(Pending)** I will delete branch/worktree after merge.

## Testing

- verification_commands: `bash scripts/codex-preflight.sh --stack auto --mode required`; `pnpm vitest run src/lib/cli/registry/command-specs.test.ts src/lib/architecture/module-boundaries.test.ts -t "ci-migrate"`; `pnpm vitest run src/lib/cli/registry/command-specs.test.ts src/lib/architecture/module-boundaries.test.ts --reporter dot`; `pnpm typecheck`; `jq -c . docs/goals/coding-harness-deep-module-migration/receipts.jsonl >/dev/null`; `bash scripts/check-goal-board.sh docs/goals/coding-harness-deep-module-migration`; `cmp -s .harness/implementation-notes/2026-05-19-module-layout.html artifacts/architecture/module-layout.html`; `git diff --check`; `pnpm exec tsx src/cli.ts docs-gate --mode required --json`; `bash scripts/validate-codestyle.sh --fast`; `bash scripts/verify-work.sh --fast`; `bash scripts/check-diagram-freshness.sh`
- verification_outcomes: all listed commands passed; `git push origin codex/JSC-331-ci-migrate-deep-module` blocked twice before final success, first on docs-gate required surfaces and then on refreshed diagram artifacts.
- blocked_steps_reason: Full pre-merge gates are intentionally pending for draft PR handoff: `bash scripts/validate-codestyle.sh`, `pnpm check`, `tooling-audit`, learning-loop gates, CodeRabbit, independent review, remote checks, and PR closeout have not completed at the PR head yet.
- Command: `bash scripts/validate-codestyle.sh` -> blocked (not yet run for this draft PR; `bash scripts/validate-codestyle.sh --fast` passed)
- Command: `pnpm check` -> blocked (not yet run for this draft PR)
- Command: `bash scripts/run-harness-gate.sh tooling-audit --path . --json` -> blocked (not yet run for this draft PR)
- Setup: `CHANGED_FILES="<comma-separated-changed-files>"` (set before running file-scoped gates)
- Command: `bash scripts/run-harness-gate.sh learnings gate --source .harness/learnings/coderabbit.local.json --files "$CHANGED_FILES" --json` -> blocked (not yet run for this draft PR)
- Command: `bash scripts/run-harness-gate.sh review-context --source .harness/learnings/coderabbit.local.json --files "$CHANGED_FILES" --json` -> blocked (not yet run for this draft PR)
- Command: `bash scripts/run-harness-gate.sh north-star-feedback --source .harness/learnings/coderabbit.local.json --json` -> blocked (not yet run for this draft PR)
- Command: `harness pr-closeout --pr <number> --gates artifacts/pr-closeout/closeout-gates.json --json` -> blocked (PR number and remote status classification pending at creation)
- Any other command(s): Command: `bash scripts/codex-preflight.sh --stack auto --mode required` -> pass; Command: `pnpm vitest run src/lib/cli/registry/command-specs.test.ts src/lib/architecture/module-boundaries.test.ts -t "ci-migrate"` -> pass; Command: `pnpm vitest run src/lib/cli/registry/command-specs.test.ts src/lib/architecture/module-boundaries.test.ts --reporter dot` -> pass; Command: `pnpm typecheck` -> pass; Command: `pnpm exec tsx src/cli.ts docs-gate --mode required --json` -> pass; Command: `bash scripts/verify-work.sh --fast` -> pass; Command: `bash scripts/check-diagram-freshness.sh` -> pass.

## Review artifacts

- Review status:
  - CodeRabbit review: status check passed at head 765cadf895825e671b022b77554254fd5eb5e462; review-thread lookup returned zero threads.
  - Independent reviewer: pending confirmation that review was performed outside the coding agent.
  - Codex review: pending completion and finding resolution or waiver.
- CodeRabbit: status check passed at head 765cadf895825e671b022b77554254fd5eb5e462; GitHub review-thread lookup returned zero threads.
- Independent reviewer evidence: pending independent review before merge readiness.
- Codex: docs/goals/coding-harness-deep-module-migration/receipts.jsonl entries for R011 implementation and validation.
- CodeRabbit Semgrep: n.a.; no CodeRabbit Semgrep findings observed yet for this PR.
- Additional evidence (if any): docs/goals/coding-harness-deep-module-migration/state.yaml and verify-work run id 20260522T133451Z-70931.

## Notes

Refs JSC-331. This draft PR delivers the T011 ci-migrate registry-boundary split and intentionally leaves merge readiness blocked until remote checks, CodeRabbit, independent review, and PR closeout evidence are current at the pushed head.

<!-- vale on -->
