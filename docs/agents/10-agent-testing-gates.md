---
last_validated: 2026-04-25
---

# Agent testing gates

## Table of Contents

- [Primary required gates](#primary-required-gates)
- [Optional gates](#optional-gates)
- [Exact behavior checks](#exact-behavior-checks)
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

## Exact behavior checks

Broad gates are necessary, but they are not enough on their own when
executable behavior changes. Run the smallest real executable path that
exercises the exact production code touched before claiming the change is
verified.

Prefer invoking the production function, class, CLI command, shell script,
validator, or route directly. If no existing test covers the path, create a
temporary local reproduction harness under `codex-scripts/`, keep it
gitignored, and import or invoke production code directly instead of copying
implementation into the harness.

If the exact path cannot run because it depends on unavailable credentials,
external services, unsafe side effects, or missing generated runtime state,
state that blocker explicitly and run the nearest meaningful validation
instead. Do not describe production behavior as verified unless the touched
path actually ran.

## Changed-code ratchets

- `pnpm run quality:docstrings` requires JSDoc for changed exported public API declarations in production `src/**` files.
- `pnpm run quality:size` enforces changed-file size limits for production `src/**` files and reports explicit legacy allowlist skips.
- `pnpm run test:related` runs Vitest related mode for changed production `src/**` files without `--passWithNoTests`; missing related tests are a blocker, not a green signal.
- `bash scripts/validate-codestyle.sh --fast`, `pnpm check`, and `make hooks-pre-commit` include these gates so the contract is enforced locally and in downstream harness-managed repos.

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
