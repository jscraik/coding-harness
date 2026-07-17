---
schema_version: 1
lifecycle_schema: harness-document-lifecycle/v1
artifact_id: synaipse-live-canary-fitness-loop
artifact_type: implementation-note
canonical_slug: synaipse-live-canary-fitness-loop
title: SynAIpse Live Canary Fitness Loop
harness_stage: implementation-notes
status: active
date: 2026-07-17
origin: SynAIpse improvement candidate 3
source_type: implementation-note
authority: execution-input
lifecycle_status: execution-input
canonical_destination: scripts/run-harness-canary-audit.mjs
owner: coding-harness-maintainers
created: 2026-07-17
last_reviewed: 2026-07-17
review_cadence: event-driven
validated_by:
  - pnpm vitest run src/dev/run-harness-canary-audit-script.test.ts # expected outcome: pass
  - pnpm typecheck # expected outcome: pass
  - pnpm docs:lint # expected outcome: pass
depends_on:
  - dirty-lane-preservation/v1
---

# SynAIpse live canary fitness loop

## Table of contents

- [Selection decision](#selection-decision)
- [Port boundary](#port-boundary)
- [Defects converted into safeguards](#defects-converted-into-safeguards)
- [Hosted PR metadata recovery](#hosted-pr-metadata-recovery)
- [Behavior proof and residual gaps](#behavior-proof-and-residual-gaps)

## Selection decision

The clean-main reconciliation compared the preserved live-canary,
metadata-extraction, and shared-follow-up lanes. Current `main` already owns the
metadata behavior, so that artifact is a non-essential refactor. The shared
files contain stale cross-lane alternatives and are unsafe to restore whole.
The live-canary runner is the remaining product behavior from improvement
candidate 3 and therefore owns this bounded lane.

## Port boundary

This change ports the canary runner and its focused test, then adds only the
canary-specific package script, validation guidance, roadmap status, and
changelog entry. It does not restore unrelated package dependencies, audit
commands, documentation wording, metadata extraction, or historical closeout
alternatives from the preserved snapshots.

The runner executes `orient`, `next`, the existing upgrade matrix, and fitness
from existing artifacts. It records target HEAD and worktree status before and
after the probes. Any change to either makes the repository result fail. Output
may be written only when the operator supplies `--output`; target repositories
remain read-only.

## Defects converted into safeguards

The first behavior fixture exposed a macOS path-canonicalization defect. A real
Git repository could be mistaken for a non-repository, copied with its `.git`
directory, and fail fixture initialization. Repository roots now compare
realpaths, and materialized non-Git fixtures explicitly exclude `.git`.

The first live run also exposed empty failure diagnostics and collapsed missing
fitness evidence into execution failure. Structured probe failures now retain
their nested error messages. Fitness `needs_evidence` is classified as blocked
and contributes a warning unless another required probe fails.

The preserved candidate used `git commit --no-verify` while creating an isolated
fixture even though the new repository has no inherited hooks. The bypass was
removed; fixture setup now uses an ordinary commit.

## Hosted PR metadata recovery

PR #482 exposed a separate CircleCI metadata failure: an invalid GitHub token
caused `gh api` to emit a JSON 401 payload on stdout, and the PR-reference
resolver accepted any non-empty stdout as a pull-request reference. The
downstream template job therefore failed before validating the PR body.

The resolver now admits only numeric PR references or canonical GitHub pull
URLs. When authenticated lookup produces no valid reference, public-repository
CI falls back to an unauthenticated open-PR lookup by owner and branch. A
fixture reproduces JSON auth-error stdout and proves the public lookup returns
the valid PR URL instead. This changes metadata recovery only; the PR template
schema and validation rules remain unchanged.

## Behavior proof and residual gaps

The focused fixture proves that failed probes leave a real target repository's
HEAD and clean status unchanged. The live source-repository audit also preserved
the target HEAD and status while independently reporting current codestyle
parity drift from the upgrade matrix and six missing fitness-evidence lanes.

This is local/manual canary proof only. It does not prove the four-repository
matrix, scheduled execution, hosted CI, review approval, release, or merge
readiness. The roadmap remains partial until named canary repositories produce
retained current-run reports and the artifact shape is stable enough for
automation.

Command: `pnpm vitest run src/dev/run-harness-canary-audit-script.test.ts` -> pass (3 focused parsing, fail-closed, and target-Git-preservation tests).
Command: `pnpm typecheck` -> pass (TypeScript source and test types passed).
Command: `pnpm docs:lint` -> pass (governed Markdown passed markdownlint).
Command: `node scripts/run-harness-canary-audit.mjs --cli /private/tmp/coding-harness-live-canary-loop/dist/cli.js --output /private/tmp/coding-harness-live-canary-report.json --json /Users/jamiecraik/dev/coding-harness` -> fail (target HEAD and status were unchanged; the upgrade matrix reported 14 codestyle parity mismatches, and fitness was blocked because 6 lanes need evidence).
