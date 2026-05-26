---
artifact: codex-runtime-evidence-pu-016-gap-002-mainline-skill-lenses
schema_version: 1
created_at: 2026-05-26T22:08:00Z
branch: codex/jsc-363-gap002-required-ci-proof
base: origin/main
scope: PU-016 GAP-002 required CI proof
side_effect_class: review-artifact
---

# PU-016 GAP-002 Mainline Skill-Lens Review

## Verdict

Status: conditional pass for the local code slice; not complete for lifecycle closeout until the independent reviewer delta artifacts confirm the fresh skill-lens artifact and contradictory status-payload regression resolved their findings.

This artifact answers the operator compliance question directly: the updated goal contract now requires per-slice skill-lens evidence, but the historical GAP-002 implementation did not originally include the complete named lens set. This mainline replay treats that as a proof gap to repair, not as an already-satisfied condition.

## Scope Reviewed

- src/lib/pr-closeout/evidence.ts
- src/lib/pr-closeout/claim-builders.ts
- src/lib/pr-closeout.test.ts
- .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-016-gap-002-intent.json
- docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md
- docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl
- .harness/research/deep/2026-05-26-codex-ecosystem-operational-review.md
- .harness/research/evidence-patterns.json

## improve-codebase-architecture Lens

Status: pass.

Evidence:

- src/lib/pr-closeout/evidence.ts:20 keeps provider status interpretation in the existing closeout evidence helper rather than scattering status literals through the claim builder.
- src/lib/pr-closeout/claim-builders.ts:46 continues to centralize required-check selection and freshness decisions in checkClaimOptions.
- src/lib/pr-closeout/claim-builders.ts:112 narrows ci_green to required checks, preserving the existing PR closeout module boundary instead of adding a new command or parallel verifier.

Why this matters: the patch deepens the current pr-closeout module where the false-success risk lives. It does not create a broad new runtime-truth surface or bypass the planned delivery-truth architecture.

Tradeoff: this is still a PR closeout hardening slice, not the full delivery-truth/v1 implementation. That limitation is acceptable only because the goal board keeps the remaining lifecycle work open.

## simplify Lens

Status: pass.

Evidence:

- The behavior change is a one-line status allow-list reduction in src/lib/pr-closeout/evidence.ts:24.
- The claim builder change removes optional checks from ci_green readiness without introducing a new abstraction.
- Optional checks remain diagnostic in tests at src/lib/pr-closeout.test.ts:1247 and src/lib/pr-closeout.test.ts:1332.

Why this matters: the slice fixes a precise false-readiness condition while leaving existing optional-check visibility intact.

Tradeoff: the added test matrix is somewhat verbose, but the duplication pins required-vs-optional behavior explicitly and is appropriate for closeout-truth risk.

## unslopify Lens

Status: pass with lifecycle proof caveat.

Evidence:

- The tests distinguish blocked, pass, and fail outcomes instead of using vague readiness prose:
  - blocked neutral/skipped required checks: src/lib/pr-closeout.test.ts:1199
  - optional diagnostic neutral/skipped checks: src/lib/pr-closeout.test.ts:1247
  - terminal failed required checks: src/lib/pr-closeout.test.ts:1375
- The goal receipts record earlier commit/push/PR/Linear blockers separately instead of blending them into local validation success.

Why this matters: this directly addresses the user's repeated steering that local implementation proof must not be treated as PR/CI/review/tracker truth.

Tradeoff: older GAP-002 artifacts still predate the stricter per-slice lens contract. The fresh mainline reviewer artifacts are required before this branch can be used as current complete evidence.

## testing Lens

Status: pass.

Current-mainline evidence:

- pnpm vitest run src/lib/pr-closeout.test.ts -> pass (64 tests) in /private/tmp/coding-harness-gap002-mainline-1779834383152.
- pnpm exec biome check src/lib/pr-closeout/evidence.ts src/lib/pr-closeout/claim-builders.ts src/lib/pr-closeout.test.ts .harness/research/evidence-patterns.json .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-016-gap-002-intent.json artifacts/reviews/codex-runtime-evidence-pu-016-gap-002-mainline-skill-lenses.md artifacts/reviews/codex-runtime-evidence-pu-016-gap-002-mainline-best-practices.md artifacts/reviews/codex-runtime-evidence-pu-016-gap-002-mainline-adversarial.md artifacts/reviews/codex-runtime-evidence-pu-016-gap-002-mainline-agent-native.md -> pass.
- pnpm research:evidence:validate -> pass.
- jq -c . docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl >/dev/null -> pass.
- PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-goal-board.py docs/goals/codex-runtime-evidence-verifier-cockpit -> pass.
- git diff --check -> pass.

Additional regression added after reviewer feedback:

- src/lib/pr-closeout.test.ts now pins contradictory conclusion/state precedence for required CI payloads.

## he-code-review Lens

Status: partial pass, pending independent delta ratification.

Reason: the active goal contract requires HE-style review proof for readiness claims. This artifact applies the review checklist at a self-review level, but it is not a substitute for independent reviewer artifacts or PR review state.

Required proof before done:

- Current branch artifact from agent-native-reviewer.
- Current branch artifact from adversarial-reviewer.
- Current branch artifact from best-practices-researcher.
- Non-empty artifact verification.
- Current validation rerun after those artifacts are added.

## Findings

No code-level finding requiring an implementation change was found in this skill-lens pass.

The only material finding is proof-process related: historical GAP-002 evidence did not satisfy the full current per-slice review contract. This is being repaired by fresh branch artifacts and must remain a blocker until those artifacts and validations exist.

## Status

safe_to_continue: yes, for independent delta review, receipt update, commit, push, and PR creation after all artifacts pass.

safe_to_mark_done: no, pending independent delta review that confirms the initial reviewer findings are resolved.

WROTE: artifacts/reviews/codex-runtime-evidence-pu-016-gap-002-mainline-skill-lenses.md
