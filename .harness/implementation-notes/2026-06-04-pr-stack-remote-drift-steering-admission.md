---
schema_version: 1
lifecycle_schema: harness-document-lifecycle/v1
artifact_id: pr-stack-remote-drift-steering-admission
artifact_type: implementation-note
canonical_slug: pr-stack-remote-drift-steering-admission
title: PR Stack Remote Drift Steering Admission
harness_stage: implementation-notes
status: active
date: 2026-06-04
origin: user steering about slow stacked-PR triage and repeated remote-state drift
source_type: implementation-note
authority: execution-input
lifecycle_status: execution-input
canonical_destination: scripts/check-pr-branch-drift.py
owner: coding-harness-maintainers
created: 2026-06-04
last_reviewed: 2026-06-04
review_cadence: event-driven
validated_by:
  - python3 scripts/check-pr-branch-drift.py --json
  - bash scripts/run-harness-gate.sh docs-gate --mode required --json
depends_on:
  - docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md
  - docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl
---

# Current-Session Steering Admission

## Feedback Signal

This current-session steering admission record exists because Jamie identified slow stacked-PR triage as a system fault and said repeated corrections must become operational telemetry before ordinary feature work continues. Feedback class: stacked PR remote-truth drift and repeated PR triage recovery. Inferred principle: PR repair lanes must prove branch/upstream freshness mechanically before push, handoff, green, done, or merge-ready claims.

## Root Operational Failure

PR #331 was repaired locally while the remote PR branch advanced independently through a CodeRabbit autofix commit. The coordinator discovered the divergence only after fetching remote truth, which let a branch drift problem become another merge-conflict loop and required another human steering event.

## Failure Category

- stale state
- weak validation
- poor workflow design
- weak observability
- missing guardrails

## Searched Surfaces

- Current branch/upstream state: `git rev-list --left-right --count HEAD...@{u}` exposed the ahead/behind drift after the CodeRabbit autofix.
- Merge index state: `git diff --name-only --diff-filter=U` identified the unresolved merge paths during reconciliation.
- Existing goal freshness guard: `scripts/check-goal-audit-freshness.py` already prevents stale or unreachable goal receipt heads.
- Existing steering guard: `scripts/check-steering-feedback-contract.cjs` defines the required shape for this admission record.
- Goal tracker surfaces: `docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md`, `state.yaml`, `receipts.jsonl`, and `goal-kanban-board.html` require current route truth before closeout claims.

## Durable System Improvement

Durable destination: validator plus steering admission record. Add `scripts/check-pr-branch-drift.py` as a small PR triage guard. The guard fails when the current branch has unresolved merge entries, no readable upstream, or an upstream that is ahead of the local branch. Ahead-only branches pass because that is the expected pre-push repair state.

## Executable Guard

Before a coordinator claims a PR repair branch is ready to push or hand off, run:

```bash
python3 scripts/check-pr-branch-drift.py --json
pnpm run docs:steering:guard
```

The first guard blocks stale or conflicted PR repair branches. The second guard prevents this admission record from degrading into an unstructured note.

## Forbidden Recurrence Behavior

Do not claim a PR repair branch is ready to push, hand off, green, done, merge-ready, or goal-complete when `scripts/check-pr-branch-drift.py` fails. Do not continue ordinary feature work after repeated steering without a current-session steering admission record. Do not treat remote writer commits from CodeRabbit, another agent, or a human as stale summaries. Do not force-push over remote autofix commits without explicit approval.

## Validation

- Command: `python3 scripts/check-pr-branch-drift.py --json` -> fail while PR #331 has unresolved merge conflicts, proving the guard detects the current unsafe handoff state.
- Command: `python3 scripts/check-pr-branch-drift.py --json` -> pass after the PR #331 integration commit reports an ahead-only branch.
- Command: `pnpm run docs:steering:guard` -> pass after this current-session steering admission record uses the required guardable sections.

## Review Condition

This admission is review-ready only when the steering guard, branch-drift guard, goal-board validator, and audit-freshness validator pass after the final receipt-only commit. It does not finish PR #331, resolve PR #335 conflicts, prove CI, resolve review threads, refresh CodeRabbit, clear Snyk, establish merge readiness, or complete the parent JSC-363 goal.
