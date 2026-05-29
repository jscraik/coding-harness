# PU-039 Review Coverage Backfill Simplify Lens

Status: pass

## Scope

Reviewed whether the slice adds unnecessary abstractions, broadens the command surface, duplicates existing systems, or obscures the actual completion truth.

## Findings

- No blocking findings.
- The simplest durable fix is the one implemented here: a JSON ledger plus one deterministic validator and one focused test file.
- The slice avoids creating a new public command, database table, runtime packet family, CI job, or cross-goal framework before there is a second consumer.
- Historical missing review members are represented uniformly as not applicable with owner and accepted exception receipt, rather than hand-written per-unit narratives.
- The validator uses fixed required members and fixed PU-001 through PU-016 coverage. That removes hidden interpretation from final closeout.

## Simplification Decision

Do not generalize the ledger contract in this PR. The repeated failure was specific: pre-R064 JSC-363 work lacked the post-R064 per-slice review evidence contract. Generalizing now would add configuration and schema indirection without a second concrete consumer.

## Validation Evidence

- jq -e . docs/goals/codex-runtime-evidence-verifier-cockpit/notes/review-coverage-backfill.json >/dev/null -> pass.
- pnpm vitest run src/dev/check-goal-review-backfill-script.test.ts --reporter=dot -> pass.

## Residual Risk

The ledger is verbose because it expands all 16 lifecycle units and all required members. That verbosity is useful here: it makes omissions diff-visible and validator-detectable.

WROTE: artifacts/reviews/pu-039-review-coverage-backfill-simplify.md
