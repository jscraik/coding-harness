# Pull request checklist

## Summary

- What changed (brief): Added the private `delivery-truth/v1` composition module for PU-005, with receipt-backed verdicts and refusal fixtures.
- Why this change was needed: The runtime evidence cockpit plan needs a private claim-vs-evidence verifier foundation before production closeout wiring can safely compose delivery claims.
- Risk and rollback plan: Risk is limited to a new private library module and tests; no public CLI, pr-closeout behavior, or external connector is changed. Rollback is reverting this PR and its generated diagram refresh artifacts.

## Work performed

- Plan IDs: `.harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md`; associated spec `.harness/specs/2026-05-24-codex-runtime-evidence-verifier-cockpit-spec.md`.
- Phase / slice: PU-005 private delivery-truth verifier foundation.
- Session IDs: n.a. no session-collector artifact was captured in this desktop thread; live implementation notes are maintained at `.harness/implementation-notes/implementation-notes.html`.
- Trace IDs: local validation trace is captured by command output and reviewer artifacts; runtime-card/evidence-bundle trace is n.a. because this slice does not wire production runtime-card or closeout commands.
- AI session / traceability: The implementation notes file maps the PU-005 decisions, source/receipt parity correction, validation evidence, and reviewer artifact status without raw transcript content.
- Completed work: Added `src/lib/delivery-truth/types.ts`, `composition.ts`, `index.ts`, focused composition tests, freshness-policy tests, and refreshed diagram artifacts required by the pre-push guard.
- Affected surfaces: code, tests, generated architecture diagrams.
- Expected outcome alignment: Preserves the portable agent OS direction by making delivery claims receipt-backed, typed, and fail-closed before public closeout integration.
- Pattern scope inventory: Principle: source labels cannot be trusted unless they match receipt kind and ref family. Searched and changed the PU-005 delivery-truth source/claim/ref path; broader production pr-closeout/review-state/external-state integrations are intentionally deferred to later PUs.
- Meta-behavior proof: The adversarial source-spoofing finding became deterministic source-to-receipt kind/ref parity in `src/lib/delivery-truth/composition.ts` plus two refusal tests in `delivery-truth-composition.test.ts`.
- Repeated-error research: n.a. no repeated command/test error required external research; the pre-push diagram refresh was handled by the repo-prescribed `bash scripts/refresh-diagram-context.sh --force`.
- Acceptance trace: PU-005 accepts only private fixture-level verdict composition, no public command, no external connector, and refusal of missing/stale/orientation-only/mixed-head/overfresh/source-spoofed evidence; evidence refs are the 19 focused tests plus final reviewer artifacts.
- Validation evidence: `./node_modules/.bin/biome check --write src/lib/delivery-truth` -> pass; `pnpm vitest run src/lib/delivery-truth/delivery-truth-composition.test.ts src/lib/delivery-truth/delivery-truth-freshness-policy.test.ts` -> pass (19 tests); `pnpm typecheck` -> pass; `bash scripts/validate-codestyle.sh --fast` -> pass with known baseline drift warnings; `bash scripts/refresh-diagram-context.sh --force` -> pass; pre-push hook -> pass on retry after committing refreshed diagrams.
- Review artifacts: `artifacts/reviews/codex-runtime-evidence-pu-005-adversarial-final.md`; `artifacts/reviews/codex-runtime-evidence-pu-005-agent-native-final.md`.
- Runtime impact: dev-only/private library foundation; no public runtime behavior or command surface changes.
- CodeRabbit mode coverage: pending CodeRabbit analysis on this draft PR.
- Closeout state: draft stacked PR; merge blocked until CI, CodeRabbit, required checks, full PR closeout, and parent PR state are resolved.
- Learning / reinforcement: Source/receipt provenance parity added as deterministic verifier behavior in code and tests.
- Deferred work: PU-006+ root/accessibility/redaction/non-blending fixtures, PU-009 review/external-state packets, PU-010 production closeout integration, and full `harness next --json` cockpit summaries.

## Checklist

- [x] I did not push directly to `main`; this PR is from a dedicated branch.
- [x] Branch name follows policy (`codex/*` for agent-created branches).
- [ ] Required local gates run: `bash scripts/validate-codestyle.sh`, `pnpm check`, `bash scripts/run-harness-gate.sh tooling-audit --path . --json`. **(Pending)** Full `bash scripts/validate-codestyle.sh`, `pnpm check`, and tooling-audit are intentionally pending for this draft stacked PR; focused slice validation is listed below.
- [x] `scripts/validate-codestyle.sh` was treated as the enforcement point for hook env sanitization (`GIT_DIR`, `GIT_WORK_TREE`, and related `GIT_*` values are untrusted and sanitized before `pnpm run`).
- [x] Any CodeRabbit Semgrep findings were either fixed or explicitly justified when warning-level-only.
- [x] North-star learning loop considered for changed files; relevant learning gate, review-context, promotion, or feedback evidence is listed below, or marked `n.a.` with a reason.
- [x] Merge is blocked until all required checks pass.
- [x] I will delete branch/worktree after merge.

## Testing

<!-- vale off -->
- verification_commands: `./node_modules/.bin/biome check --write src/lib/delivery-truth`; `pnpm vitest run src/lib/delivery-truth/delivery-truth-composition.test.ts src/lib/delivery-truth/delivery-truth-freshness-policy.test.ts`; `pnpm typecheck`; `bash scripts/validate-codestyle.sh --fast`; `bash scripts/refresh-diagram-context.sh --force`; local pre-push hook.
- verification_outcomes: biome pass; vitest pass (19 tests); typecheck pass; fast codestyle pass with known baseline drift warnings; diagram refresh pass; pre-push pass on retry after committing refreshed diagram artifacts.
- blocked_steps_reason: full `bash scripts/validate-codestyle.sh`, `pnpm check`, `tooling-audit`, learning gates, and pr-closeout have not yet run for this draft stacked PR.
<!-- vale on -->
- Command: `bash scripts/validate-codestyle.sh` -> blocked (not yet run; fast variant passed for draft PR handoff)
- Command: `pnpm check` -> blocked (not yet run for this stacked draft)
- Command: `bash scripts/run-harness-gate.sh tooling-audit --path . --json` -> blocked (not yet run)
- Setup: `CHANGED_FILES=".diagram/agent.mmd,.diagram/events.mmd,.diagram/manifest.json,.diagram/rag.mmd,.diagram/security.mmd,.diagram/sequence.mmd,src/lib/delivery-truth/composition.ts,src/lib/delivery-truth/delivery-truth-composition.test.ts,src/lib/delivery-truth/delivery-truth-freshness-policy.test.ts,src/lib/delivery-truth/index.ts,src/lib/delivery-truth/types.ts"`
- Command: `bash scripts/run-harness-gate.sh learnings gate --source .harness/learnings/coderabbit.local.json --files "$CHANGED_FILES" --json` -> n.a. (not yet run for draft PR handoff)
- Command: `bash scripts/run-harness-gate.sh review-context --source .harness/learnings/coderabbit.local.json --files "$CHANGED_FILES" --json` -> n.a. (not yet run for draft PR handoff)
- Command: `bash scripts/run-harness-gate.sh north-star-feedback --source .harness/learnings/coderabbit.local.json --json` -> n.a. (not yet run for draft PR handoff)
- Command: `harness pr-closeout --pr <number> --gates artifacts/pr-closeout/closeout-gates.json --json` -> n.a. (PR is draft and not in closeout)
- Any other command(s): `./node_modules/.bin/biome check --write src/lib/delivery-truth` -> pass; `pnpm vitest run src/lib/delivery-truth/delivery-truth-composition.test.ts src/lib/delivery-truth/delivery-truth-freshness-policy.test.ts` -> pass; `pnpm typecheck` -> pass; `bash scripts/validate-codestyle.sh --fast` -> pass; `bash scripts/refresh-diagram-context.sh --force` -> pass; local pre-push hook -> pass on retry.

## Review artifacts

- Review status:
  - CodeRabbit review: pending completion and finding resolution or waiver.
  - Independent reviewer: complete for private PU-005 scope via adversarial and agent-native reviewer artifacts.
  - Codex review: pending completion and finding resolution or waiver.
- CodeRabbit: pending draft PR review.
- Independent reviewer evidence: `artifacts/reviews/codex-runtime-evidence-pu-005-adversarial-final.md`; `artifacts/reviews/codex-runtime-evidence-pu-005-agent-native-final.md`.
- Codex: `.harness/implementation-notes/implementation-notes.html` live implementation ledger; final Codex PR triage pending.
- CodeRabbit Semgrep: n.a. no CodeRabbit/Semgrep PR findings observed yet.
- Additional evidence (if any): pre-push hook passed after committing refreshed diagram artifacts.

## Notes

This is a deliberately private foundation PR. It creates the receipt-backed delivery-truth composition semantics needed by later lifecycle slices, but does not make any public closeout, GitHub, Linear, CI, CodeRabbit, or `harness next --json` behavior authoritative yet.
