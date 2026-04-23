---
last_validated: 2026-04-23
---

# Agent testing gates

## Table of Contents

- [Primary required gates](#primary-required-gates)
- [Optional gates](#optional-gates)
- [Verify-work orchestration and resume](#verify-work-orchestration-and-resume)
- [Review-gate north-star evidence](#review-gate-north-star-evidence)
- [Gate-by-gate intent](#gate-by-gate-intent)
- [Failure policy](#failure-policy)
- [Reporting format](#reporting-format)
- [Human escalation](#human-escalation)

## Primary required gates

For any behavior-affecting change:

1. `pnpm lint`
2. `pnpm typecheck`
3. `pnpm test`
4. `pnpm audit`
5. `pnpm check`

## Optional gates

- `pnpm build` when CLI output, entrypoints, or distribution artifacts change.
- Manual smoke checks for command-flow changes.

## Verify-work orchestration and resume

`bash scripts/verify-work.sh` is the canonical orchestrated gate runner for repo-local validation. Run-state is written to `.harness/runs/<run-id>/` as:

- `run.json` (run metadata and resume compatibility keys),
- `gates/<gate-id>.json` (per-gate results),
- `summary.json` (terminal status).

Fast-mode orchestration uses `read_only_parallel` for safe parallel checks and `serial_guarded` for fail-closed gates. Resume with `bash scripts/verify-work.sh --resume-from <gate-id>` only when the latest compatible run matches `repoRoot`, `providerClass`, `schemaVersion`, `contractVersion`, and `contractFingerprint`, and reused gates are already `passed`. Resume is blocked when the current environment cannot compute a deterministic `contractFingerprint` (requires one of `node`, `shasum`, or `openssl`).

## Review-gate north-star evidence

For repositories that declare `northStar` governance in `harness.contract.json`,
`review-gate` requires PR-body decisions when governed
`productSurface.surfaces[].ownedPaths` are changed:

- `lead_time_path: yes. Evidence: <ref>`
- `manual_glue: yes. Evidence: <ref>`
- `agent_reliability: yes. Evidence: <ref>`
- `safety_floor: yes. Evidence: <ref>`

Missing decision lines or missing `Evidence:` references fail with
`review_evidence_incomplete`; non-`yes` answers fail with
`review_evidence_contradiction`. Repos without declared `northStar` governance
or without touched governed surfaces keep legacy review-gate behavior.

## Gate-by-gate intent

### `pnpm lint`

Catches static style and obvious correctness issues in repo code and config.

### `pnpm typecheck`

Ensures type contracts remain valid after edits.

### `pnpm test`

Validates behavioral invariants and regression coverage.

### `pnpm audit`

Detects dependency risk before merge.

### `pnpm check`

Aggregates the repo baseline contract for release-quality confidence.

## Failure policy

- Stop at first required-gate failure.
- Fix and rerun from first failed gate.
- If a gate is blocked by environment/tooling, document it clearly and do not declare complete.

## Reporting format

For each gate include:

- command,
- status (`pass` / `fail` / `blocked`),
- failure summary if applicable,
- and exact follow-up action.

## Human escalation

Escalate immediately when repeated failures indicate architectural assumptions changed or when checks cannot be executed due unavailable tooling.
