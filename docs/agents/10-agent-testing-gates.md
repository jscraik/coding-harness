---
last_validated: 2026-07-16
---

# Agent testing gates

## Table of Contents

- [Primary required gates](#primary-required-gates)
- [Optional gates](#optional-gates)
- [Exact behavior checks](#exact-behavior-checks)
- [Changed-code ratchets](#changed-code-ratchets)
- [Harness assurance layers](#harness-assurance-layers)
- [Route-driving artifact routine](#route-driving-artifact-routine)
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
4. `pnpm run audit`
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

- `pnpm run quality:docstrings` requires JSDoc for changed exported public API
  declarations in production `src/**` files and enforces an 80% per-file
  JSDoc coverage ratchet for touched function-like declarations.
- `pnpm run quality:size` enforces changed-file size limits for production `src/**` files and reports explicit legacy allowlist skips.
- `pnpm run quality:scripts` catches shell syntax regressions before broad gates spend time on docs, types, or Vitest.
- `pnpm run tooling:parity` catches stale required-tool drift across policy, environment, CI, and scaffolding surfaces.
- `pnpm run test:related` runs Vitest related mode for changed production `src/**` files without `--passWithNoTests`; missing related tests are a blocker, not a green signal.
- `bash scripts/validate-codestyle.sh --fast` and the `scripts/hook-pre-commit.sh` leaf adapter enforce the changed-code ratchets locally and in downstream harness-managed repos; `pnpm check:static` and `pnpm check` remain aggregate lanes that build on those checks. The `make hooks-pre-commit` target remains a manual wrapper around that adapter.

## Harness assurance layers

Use this matrix when reviewing the harness itself. The question is not "does
the repository have tests"; it is whether the changed harness behavior has the
right proof at the right layer.

| Layer              | What it proves                                                                                                                    | Current repo posture                                                                                                     | Required proof when touched                                                                                                                                                                                                                                      |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit               | Command logic, registry metadata, validators, and pure helpers behave as expected in isolation.                                   | Strong: broad `src/**/*.test.ts` and command-level Vitest coverage.                                                      | Targeted Vitest for the changed files, plus `pnpm run test:related` when production `src/**` changes.                                                                                                                                                            |
| Boundary           | Inputs at limits fail closed with named blocker classes.                                                                          | Medium-strong: many failure paths exist, but the taxonomy is spread across tests and solution docs.                      | Assert the specific blocker or policy class, not just that an error occurred.                                                                                                                                                                                    |
| Mock integration   | GitHub, Linear, CircleCI, CodeRabbit, Snyk, filesystem, and automation boundaries can be exercised without mutating real systems. | Strong for many command and adapter paths; new adapters must prove this explicitly.                                      | Fixture-backed adapter or command tests with mocked outbound calls and machine-readable output assertions.                                                                                                                                                       |
| End-to-end         | Full harness scenarios cross command, artifact, and external-system boundaries.                                                   | Strong but credential-gated: `e2e/**` and artifact runners classify blockers.                                            | `pnpm run test:e2e` for the runner-owned `artifacts/e2e/result.json`; `pnpm run test:artifacts:e2e` for wrapper-owned `artifacts/test/summary-e2e.json` and `artifacts/test/test-output-e2e.log`; or a recorded blocked reason when credentials are unavailable. |
| Security           | Unsafe commands, path traversal, secret exposure, branch protection, and policy refusal fail closed.                              | Strong baseline through audit, secrets, Semgrep/Snyk/CircleCI, and security tests; misuse taxonomy should stay explicit. | Targeted security tests or security gate evidence proving the unsafe sample is refused with a named policy reason.                                                                                                                                               |
| Load and stress    | High-volume command discovery, artifact writes, preflight overload, and agent-first throughput degrade predictably.               | Partial: performance, overload, and throughput tests exist, but this is the weakest harness layer.                       | A bounded-duration, bounded-output, throughput-floor, or controlled-degradation test with an explicit numeric threshold; use `pnpm test:smarter:compare` for CircleCI smarter-testing evidence and `pnpm test:deep` when runtime or artifact behavior changes.  |
| Lifecycle closeout | Green checks are not completion; PR, branch, Linear, review-thread, automation, and next-lane state are observed or classified.   | Partial but now governed by the repeated-steering and heartbeat closeout contract.                                       | Targeted closeout proof plus `pnpm run docs:steering:guard` when meta-behavior or automation rules change.                                                                                                                                                       |

Use `validateHarnessAssuranceEntries` in `src/lib/harness-assurance.ts` when a
handoff, PR body, or closeout artifact needs machine-checkable evidence for
this matrix. It rejects incomplete seven-layer matrices, entries without
evidence, load/stress pass claims without a finite numeric threshold, and
lifecycle closeout pass claims that omit PR, merge, branch/worktree, Linear,
review-thread, automation, or next-lane state.

Every layer needs an evidence reference. When a layer is not applicable, mark
it `n.a.` with evidence and the reason. When a layer is needed but cannot run,
mark it `blocked` with evidence plus the missing credential, external service,
runtime state, or waiting owner. When a layer is only partially covered, mark
it `partial` with both evidence and the remaining gap. Do not convert a missing
layer into a generic green summary.

## Route-driving artifact routine

Before a harness assurance plan, spec, or artifact index drives implementation,
run `node --import tsx src/cli.ts artifact-routine --active-index .harness/active-artifacts.md --json`
in this source checkout, or
`harness artifact-routine --active-index .harness/active-artifacts.md --json`
in installed-package repositories. Treat any failed finding as a route blocker
unless it is explicitly recorded as a tracked exception with owner and next
action in the active artifact index.

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

### `pnpm run audit`

Detects dependency risk before merge.

### `pnpm check:static`

Aggregates the non-Vitest baseline for CI and fast local confidence without
rerunning the dedicated `pnpm test:ci` lane.

### `pnpm check`

Aggregates the repo baseline contract for release-quality confidence:
`pnpm check:static`, `pnpm run test:related`, `pnpm test:ci`, and
`pnpm run audit`. The repository-owned wrapper submits the exact versions from
`pnpm-lock.yaml` to npm's bulk advisory endpoint and fails closed when the
registry response is unavailable or malformed. Scoped dependencies must also be
admitted by `scripts/npm-audit-public-scopes.json`; unknown scopes and packages
resolved from another registry origin stop before any request is sent.

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
