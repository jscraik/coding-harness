# PR #331-#338 Green-Sweep Triage

## Scope

Coordinator fallback artifact for the JSC-363 stacked PR lane after two
subagent artifact attempts completed without writing the required report.
This artifact records live GitHub state gathered from
`/private/tmp/coding-harness-cnf004-runtime-card-continuity-1780540044` and
keeps PR state, CI state, CodeRabbit state, Snyk state, mergeability, Linear,
and parent-goal readiness separate.

## Live Fetch Evidence

- `git fetch origin` -> pass.
- Fetch observed remote advancement on
  `origin/codex/jsc-363-cnf-002-env-permissions` from `1905ce86` to
  `4e4582b9`.
- `gh pr list --repo jscraik/coding-harness --state open --json ...` -> pass.
- `gh pr checks 331..338 --repo jscraik/coding-harness --json ...` -> pass
  for each PR.
- PR #338 current head at collection time:
  `e19d27527970fd021e42248a0990aa0b1243c5e1`.

## Per-PR Lane Table

| PR | Head | Draft | Mergeability | CodeRabbit | CI / Checks | External Snyk | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| #331 | `3b7e49b` | no | MERGEABLE | Review completed | `ci/circleci: pr-template` fails; aggregate `pr-pipeline` fails; other visible CircleCI lanes pass | ERROR: private-test limit | Triage `pr-template` failure first, then rerun pipeline; keep Snyk separate. |
| #332 | `4e4582b` | no | MERGEABLE | Review skipped | `ci/circleci: lint`, `typecheck`, `test`, and `check` fail; aggregate `pr-pipeline` fails | ERROR: private-test limit | Highest implementation blocker: fetch current head in an isolated PR worktree and repair failing local gates before retesting. |
| #333 | `4ac3659` | yes | UNKNOWN | Review completed | `ci/circleci: pr-template` fails; aggregate `pr-pipeline` fails; other visible CircleCI lanes pass | ERROR: private-test limit | Repair PR body/template evidence after #332 stabilizes; refresh mergeability. |
| #334 | `cbd9d38` | yes | MERGEABLE | Review completed | `ci/circleci: pr-template` fails; aggregate `pr-pipeline` fails; other visible CircleCI lanes pass | ERROR: private-test limit | Repair PR body/template evidence after predecessor stack is stable. |
| #335 | `0cdd9e8` | yes | MERGEABLE | Review completed | `ci/circleci: pr-template` fails; aggregate `pr-pipeline` fails; other visible CircleCI lanes pass | ERROR: private-test limit | Repair PR body/template evidence after predecessor stack is stable. |
| #336 | `3b811d3` | yes | MERGEABLE | Review completed | All visible CircleCI and aggregate `pr-pipeline` checks pass | ERROR: private-test limit | Blocked by draft state, predecessor stack, Snyk disposition, and review-thread truth. |
| #337 | `f765ecd` | yes | MERGEABLE | Review completed | All visible CircleCI and aggregate `pr-pipeline` checks pass | ERROR: private-test limit | Blocked by draft state, predecessor stack, Snyk disposition, and review-thread truth. |
| #338 | `e19d275` | no | MERGEABLE / UNSTABLE | Review completed after current-head manual trigger | Most visible CircleCI lanes pass; `ci/circleci: check`, `ci/circleci: orb-pinning`, and aggregate `pr-pipeline` were still pending at collection time | ERROR: private-test limit | Wait for remaining CircleCI lanes, then resolve Snyk/error disposition and review-thread truth. |

## Failing Or Blocked Lanes

- PR #332 is the first implementation-looking blocker in the stack because its
  current remote head fails `lint`, `typecheck`, `test`, and `check`.
- PR #331, #333, #334, and #335 have deterministic PR-template failures that
  should be repaired before merge claims.
- PR #336 and #337 are CircleCI-green at the visible check layer but remain
  draft and stack-blocked.
- PR #338 has current-head CodeRabbit completion and mostly green CircleCI, but
  it still has pending CircleCI lanes at collection time.
- Every open PR #331 through #338 has external `security/snyk (jscraik)`
  reporting `You have used your limit of private tests`; this is external
  check truth, not local implementation proof.
- Review-thread truth was not fully inspected in this fallback artifact; no PR
  should be marked review-resolved from CodeRabbit check state alone.

## Systemic Pre-PR Gate Findings

- Repeated `pr-template` failures across PR #331, #333, #334, and #335 are a
  systemic pre-PR gate miss. The deterministic surface is
  `bash scripts/run-harness-gate.sh pr-template-gate --pr-body-file ... --json`
  against the live PR body after each push.
- PR #332 failing `lint`, `typecheck`, `test`, and aggregate `check`
  indicates the remote head advanced beyond the previously recorded route truth.
  The fix must start with `git fetch origin` and an isolated PR worktree before
  editing so the coordinator checkout is not polluted.
- Manual `@coderabbitai review this pr` trigger comments are necessary for
  stacked PRs, but they are request evidence only. CodeRabbit completion and
  review-thread resolution must be refreshed separately.
- The repeated missing subagent artifact is its own workflow defect: mailbox
  completion is not review evidence. Future PR-sweep assignments need an
  artifact existence probe before the coordinator trusts completion.

## Recommended Coordinator Actions

1. Let PR #338 pending CircleCI lanes finish, then record a fresh receipt if the
   status materially changes.
2. Start repair work at PR #332 because it has the deepest current failing
   implementation gates and its branch advanced during the sweep.
3. Repair live PR-template failures for PR #331, #333, #334, and #335 with the
   repo `pr-template-gate` against each live body.
4. Keep Snyk private-test quota/error status as a separate external governance
   lane that requires owner/tooling disposition; do not claim PR green while the
   required external check is ERROR.
5. Before marking any PR lane complete, refresh review threads, CodeRabbit
   completion, Codex review state, draft state, mergeability, Linear linkage,
   and branch head SHA in the same closeout window.

## Coverage Gaps

- This artifact is coordinator-produced because both subagent artifact attempts
  failed to write the required file.
- Review-thread GraphQL state was not exhaustively captured here.
- CircleCI PR #338 had pending lanes when collected, so this artifact is a
  route-truth snapshot, not final PR #338 CI truth.
- Linear mutation/linkage was not refreshed in this artifact.

WROTE: artifacts/reviews/pr331-338-green-sweep-triage.md
