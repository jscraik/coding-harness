<!-- vale off -->

# Pull request checklist

## Summary

- What changed (brief): Split init command raw argument projection out of the shared command registry, added a focused init registry adapter, refreshed the architecture/governance surfaces, and repaired the PR #278 body/report handoff with tracked evidence.
- Why this change was needed: T012 of the deep-module migration keeps the command registry thin by moving init-specific option parsing, minimal-mode conflict handling, issue-tracker validation, and target-dir detection behind the init module seam before later upgrade and brain slices begin.
- Risk and rollback plan: Risk is limited to init CLI argument projection and registry dispatch. Roll back by reverting this PR; no real downstream repository bootstrap or mutating init scaffolding action was executed by this change.

## Work performed

- Plan IDs: Refs JSC-331; docs/goals/coding-harness-deep-module-migration/goal.md; T012; receipts R012-INIT-REGISTRY-SPLIT-LOCAL-VALIDATED, R012-INIT-IMPLEMENTATION-VALIDATION, R012-INIT-VALIDATION-HANDOFF, R012-PR278-BODY-REPORT-REPAIR, R012-PR278-BROWSER-LAUNCHED, R012-PR278-BROWSER-RELOAD-RUNTIME-BLOCKED, R012-PR278-BROWSER-LAUNCHED-8767, R012-PR278-BROWSER-REVERIFY-RUNTIME-BLOCKED, R012-PR278-BROWSER-LAUNCHED-8767-RECHECK, R012-PR278-BROWSER-R018-RUNTIME-BLOCKED, R012-PR278-BROWSER-LAUNCHED-8767-R019, R012-PR278-CODERABBIT-INIT-PARSER-FIX.
- Phase / slice: Deep-module migration T012 init registry-boundary split and PR #278 delivery-surface repair.
- Session IDs: Codex desktop goal continuation 019e4a39-47f8-7ac0-b979-d52b7f02ec23; durable trace captured in docs/goals/coding-harness-deep-module-migration/receipts.jsonl.
- Trace IDs: verify-work run id 20260522T160456Z-59419; PR #278 https://github.com/jscraik/coding-harness/pull/278; original failing CircleCI pr-template job https://circleci.com/gh/jscraik/coding-harness/16563; live report URL http://127.0.0.1:8767/artifacts/architecture/module-layout.html.
- AI session / traceability: The Codex session produced the init parser/registry split, governance documentation sync, generated HTML report refresh, goal-board receipts/state, and this tracked PR-body artifact; receipts map the work without embedding raw transcripts.
- Completed work: Added src/lib/init/cli-args.ts; added src/lib/init/flag-values.ts; added src/lib/cli/registry/init-command-spec.ts; simplified src/lib/cli/registry/command-specs-core.ts; added registry parser, malformed-value, invalid-project-type, and module-boundary tests; refreshed module-boundary docs, README.md, AGENTS.md, docs/agents/00-architecture-bootstrap.md, docs/agents/07b-agent-governance.md, module-layout HTML, goal state/receipts, and the tracked PR #278 body artifact.
- Affected surfaces: Code, tests, docs, CLI registry, generated architecture artifacts, goal receipts/state, PR body artifact, and Browser-requested HTML report.
- Expected outcome alignment: Keeps Coding Harness portable by making init behavior a focused agent-safe work area with a small registry-facing adapter, so future greenfield and brownfield bootstrap changes do not sprawl through the shared command catalog.
- Pattern scope inventory: Principle: command-registry deep-module splits must keep action-specific option builders and delegated helper routing behind command-family seams. Siblings prompt-gate, gap-case, simulate, and ci-migrate were checked through prior closed slices and ratchets; init changed in this PR; upgrade and brain remain queued as later goal slices after PR #278 is clean.
- Meta-behavior proof: The red pr-template check was admitted as a delivery-surface defect and repaired through docs/goals/coding-harness-deep-module-migration/notes/pr-bodies/pr278-body.md, local pr-template-gate validation, live body validation, state/receipt updates, and a Jamie-facing HTML report refresh so stale handoff wording does not hide the active blocker.
- Repeated-error research: n.a.; the PR #278 pr-template failure reproduced once in this slice and had a known repo-fit fix from the PR #277 tracked-body pattern. It is still recorded as a delivery-surface correction rather than ignored.
- Acceptance trace: T012 expected output maps to R012-INIT-REGISTRY-SPLIT-LOCAL-VALIDATED for implementation, R012-INIT-VALIDATION-HANDOFF for local validation, and R012-PR278-BODY-REPORT-REPAIR for PR/body/report handoff repair.
- Validation evidence: Focused registry/module-boundary vitest passed with 158 tests after the malformed-value fixtures; pnpm typecheck passed; validate-codestyle fast passed; docs-gate passed; verify-work fast passed with run id 20260522T160456Z-59419; pnpm check passed; tooling-audit passed; receipts parse; goal board passes; git diff check passes; tracked and live PR body pr-template-gate and linear-gate pass; learning loop gates were considered; the report static server serves HTTP 200 at http://127.0.0.1:8767/artifacts/architecture/module-layout.html; latest recorded Browser proof is R012-PR278-BROWSER-LAUNCHED-8767-R019, which observed the in-app Browser visible on the report with title Coding Harness Module Layout.
- Review artifacts: CodeRabbit review completed after PR #278 was marked ready; current CodeRabbit init parser findings are addressed in code and tests, with thread state pending latest-head reobservation; independent review is pending; Codex implementation evidence is in docs/goals/coding-harness-deep-module-migration/receipts.jsonl.
- Runtime impact: Dev-only and CLI-facing init argument parsing/dispatch impact; no downstream init scaffolding mutation was run.
- CodeRabbit mode coverage: CodeRabbit completed on PR #278 after the ready-for-review transition; the malformed-input fixture and explicit project-type validation findings are fixed locally and need pushed-head thread reobservation before closeout.
- Closeout state: PR #278 is open/ready for review on codex/JSC-331-init-deep-module, mergeStateStatus remains BLOCKED while latest pushed-head checks settle, unrelated untracked Untitled.canvas and codex/ are preserved, Linear state is Refs JSC-331, and upgrade/brain remain next-lane work only after this PR is current and merge-ready.
- Learning / reinforcement: The durable pattern is the tracked PR-body artifact plus local pr-template-gate before handoff; no memory update was requested.
- Deferred work: T013 upgrade and brain slices; full required pre-merge gates, CodeRabbit real review, independent review, PR closeout evidence, and merge readiness remain after this delivery-surface repair.

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

- verification_commands: `pnpm typecheck`; `pnpm vitest run src/lib/cli/registry/command-specs.test.ts src/lib/architecture/module-boundaries.test.ts --reporter dot`; `bash scripts/validate-codestyle.sh --fast`; `bash scripts/run-harness-gate.sh docs-gate --mode required --json`; `bash scripts/check-goal-board.sh docs/goals/coding-harness-deep-module-migration`; `pnpm run docs:style:changed`; `bash scripts/verify-work.sh --fast`; `pnpm check`; `bash scripts/run-harness-gate.sh tooling-audit --path . --json`; `jq -c . docs/goals/coding-harness-deep-module-migration/receipts.jsonl >/dev/null`; `git diff --check`; `PR_TEMPLATE_BODY="$(gh pr view 278 --json body -q .body)" bash scripts/run-harness-gate.sh pr-template-gate --json` before repair; `PR_TEMPLATE_BODY="$(cat docs/goals/coding-harness-deep-module-migration/notes/pr-bodies/pr278-body.md)" bash scripts/run-harness-gate.sh pr-template-gate --json`; `PR_TITLE="refactor(init): split registry parser into init module seam" PR_BODY="$(cat docs/goals/coding-harness-deep-module-migration/notes/pr-bodies/pr278-body.md)" bash scripts/run-harness-gate.sh linear-gate --json`; HTTP report check for `http://127.0.0.1:8767/artifacts/architecture/module-layout.html`; Browser launch to `http://127.0.0.1:8767/artifacts/architecture/module-layout.html`.
- verification_outcomes: typecheck pass; focused vitest pass with 158 tests after the CodeRabbit init validation expansion; validate-codestyle fast pass with only baseline non-blocking drift-gate warnings; docs-gate pass; goal board pass; docs style pass; verify-work fast pass with run id 20260522T160456Z-59419; pnpm check pass with 282 standard test files and ci-migrate suite passing; tooling-audit pass with zero findings; receipts parse pass; git diff check pass; live PR body pr-template-gate failed before this repair with missing template sections; repaired tracked body pr-template-gate pass; repaired tracked body linear-gate pass; HTTP report server pass on port 8767; latest recorded Browser proof R012-PR278-BROWSER-LAUNCHED-8767-R019 pass.
- blocked_steps_reason: PR closeout remains blocked by pending latest-head remote checks, independent review evidence, pushed-head review-thread reobservation, and final merge-readiness evidence.
- Command: `bash scripts/validate-codestyle.sh` -> pass
- Command: `pnpm check` -> pass
- Command: `bash scripts/run-harness-gate.sh tooling-audit --path . --json` -> pass
- Setup: `CHANGED_FILES=".harness/implementation-notes/2026-05-19-module-layout.html,AGENTS.md,README.md,artifacts/architecture/module-layout.html,docs/agents/00-architecture-bootstrap.md,docs/agents/07b-agent-governance.md,docs/architecture/module-boundaries.md,docs/goals/coding-harness-deep-module-migration/receipts.jsonl,docs/goals/coding-harness-deep-module-migration/state.yaml,docs/goals/coding-harness-deep-module-migration/notes/pr-bodies/pr278-body.md,src/lib/architecture/module-boundaries.test.ts,src/lib/cli/registry/command-specs-core.ts,src/lib/cli/registry/command-specs.test.ts,src/lib/cli/registry/init-command-spec.ts,src/lib/init/cli-args.ts"`
- Command: `bash scripts/run-harness-gate.sh learnings gate --source .harness/learnings/coderabbit.local.json --files "$CHANGED_FILES" --json` -> pass
- Command: `bash scripts/run-harness-gate.sh review-context --source .harness/learnings/coderabbit.local.json --files "$CHANGED_FILES" --json` -> pass
- Command: `bash scripts/run-harness-gate.sh north-star-feedback --source .harness/learnings/coderabbit.local.json --json` -> pass
- Command: `harness pr-closeout --pr <number> --gates artifacts/pr-closeout/closeout-gates.json --json` -> blocked (PR #278 is not at closeout; checks/review remain pending after body repair)
- Any other command(s): `pnpm typecheck` -> pass; `pnpm vitest run src/lib/cli/registry/command-specs.test.ts src/lib/architecture/module-boundaries.test.ts --reporter dot` -> pass; `bash scripts/validate-codestyle.sh --fast` -> pass; `bash scripts/run-harness-gate.sh docs-gate --mode required --json` -> pass; `bash scripts/check-goal-board.sh docs/goals/coding-harness-deep-module-migration` -> pass; `pnpm run docs:style:changed` -> pass; `bash scripts/verify-work.sh --fast` -> pass; `jq -c . docs/goals/coding-harness-deep-module-migration/receipts.jsonl >/dev/null` -> pass; `git diff --check` -> pass; `PR_TEMPLATE_BODY="$(gh pr view 278 --json body -q .body)" bash scripts/run-harness-gate.sh pr-template-gate --json` -> fail before repair; `PR_TEMPLATE_BODY="$(cat docs/goals/coding-harness-deep-module-migration/notes/pr-bodies/pr278-body.md)" bash scripts/run-harness-gate.sh pr-template-gate --json` -> pass; `PR_TITLE="refactor(init): split registry parser into init module seam" PR_BODY="$(cat docs/goals/coding-harness-deep-module-migration/notes/pr-bodies/pr278-body.md)" bash scripts/run-harness-gate.sh linear-gate --json` -> pass; `PR_TEMPLATE_BODY="$(gh pr view 278 --json body -q .body)" bash scripts/run-harness-gate.sh pr-template-gate --json` -> pass after live body update; `PR_TITLE="$(gh pr view 278 --json title -q .title)" PR_BODY="$(gh pr view 278 --json body -q .body)" bash scripts/run-harness-gate.sh linear-gate --json` -> pass after live body update.

## Review artifacts

- Review status:
  - CodeRabbit review: Completed after PR #278 was marked ready; findings/review threads require explicit current classification before merge readiness.
  - Independent reviewer: Pending; this PR remains blocked until review is performed outside the coding agent or explicitly waived by repo policy.
  - Codex review: Implementation and handoff evidence are recorded in docs/goals/coding-harness-deep-module-migration/receipts.jsonl; no self-approval is claimed.
- CodeRabbit: https://github.com/jscraik/coding-harness/pull/278 (review completed after ready-for-review transition)
- Independent reviewer evidence: pending
- Codex: docs/goals/coding-harness-deep-module-migration/receipts.jsonl
- CodeRabbit Semgrep: n.a.; no Semgrep CodeRabbit findings are known from the completed status check at this observation point.
- Additional evidence (if any): docs/goals/coding-harness-deep-module-migration/notes/pr-bodies/pr278-body.md; artifacts/architecture/module-layout.html; .harness/implementation-notes/2026-05-19-module-layout.html; live PR body gate checks at 2026-05-22T16:30:44Z and 2026-05-22T16:30:45Z.

## Notes

This PR should stay blocked until the report receipt is pushed, the latest pushed-head checks finish green, current review threads are classified, and independent review evidence exists or is explicitly waived. The implementation slice itself is the init registry-boundary split; upgrade and brain are intentionally not started in this PR.

<!-- vale on -->
