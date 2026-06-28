---
doc_schema: coding-harness-doc/v1
doc_type: governance
authority: canon
canon_class: canonical
distribution: source-only
audience:
  - codex-agent
  - automation-maintainer
  - docs-reviewer
lifecycle_state: active
owner: coding-harness-maintainers
created: 2026-06-04
last_reviewed: 2026-06-28
review_cadence: quarterly
maintenance_trigger:
  - coderabbit-sweep-change
  - review-state-change
  - pr-review-workflow-change
semver_impact: minor
validated_by:
  - pnpm docs:lifecycle
depends_on:
  - docs/automations/README.md
  - docs/guardrails/review-state.md
  - docs/agents/12-ai-review-governance.md
---

# CodeRabbit review sweep runbook

## Table of Contents

- [Purpose](#purpose)
- [Machine Identity](#machine-identity)
- [Source Of Truth](#source-of-truth)
- [Pilot Cost Controls](#pilot-cost-controls)
- [Signal Budget Lanes](#signal-budget-lanes)
- [Capability Ledger](#capability-ledger)
- [Workflow](#workflow)
- [Signal Classification](#signal-classification)
- [Cost And Usefulness Metrics](#cost-and-usefulness-metrics)
- [Thread Report Acceptance](#thread-report-acceptance)
- [Stop Conditions](#stop-conditions)
- [Validation](#validation)

## Purpose

Use this runbook to classify CodeRabbit findings, unresolved review threads,
and review-ready handoff state without treating the coding agent as an
independent approver.

## Machine Identity

Automation ID: coderabbit-review-sweep.
Cursor: PR number plus review provider status.
Output lane: review state only.

## Source Of Truth

Use current PR review evidence in this order:

1. Current CodeRabbit PR status, findings, or threads.
2. Current GitHub review threads and comments.
3. Local review artifacts only when they are scoped and current.
4. Prior summaries only as supporting context.

Keep these evidence lanes separate:

- GitHub and CodeRabbit PR review threads/checks are authoritative for the
  current review state of an individual PR.
- Slack `#code-fixes` daily reports are authoritative for the existence and
  content of CodeRabbit reports received in Slack. Use them as the primary
  historical feed for recurrence patterns, cost/usefulness friction, and
  accepted or ignored finding themes.
- Authenticated CodeRabbit dashboard, account, config, or usage pages are
  authoritative for Jamie's actual plan, usage, and account configuration when
  they are accessible read-only.
- Official CodeRabbit docs and blog posts are authoritative for product
  semantics and configuration options, not for Jamie's account state.
- Discord announcements are advisory changelog and release context.

## Pilot Cost Controls

Use coding-harness as the first tuned CodeRabbit repo before copying settings
elsewhere.

- Skip draft PR auto-review. Convert the PR to ready-for-review or run
  `coderabbit review --agent` manually when early review is worth the spend.
- Pause incremental auto-review after three reviewed commits. When a branch is
  still churning, batch the next pass behind a human or agent checkpoint.
- Keep sequence diagrams and web search off by default. Re-enable them only for
  PRs where architecture flow or external API/dependency behavior is part of
  the review question.
- Filter generated, build, coverage, dependency, image, and minified artifacts
  unless the generated output itself is the product surface under review.
- Prefer local knowledge, repo guidelines, and validation artifacts over broad
  summaries. The useful review asks are blocker classification, missing proof,
  contract drift, and repeated patterns that should become tests or guardrails.

## Signal Budget Lanes

Route CodeRabbit attention by PR risk instead of treating every PR as a deep
review candidate:

- `summary`: docs-only, metadata-only, generated-output, dependency-lock, or
  low-risk changes where deterministic gates cover the behavior path.
- `targeted`: source, CLI, validation, artifact, public-doc, or workflow changes
  where CodeRabbit should inspect the changed contract surfaces.
- `deep`: security, auth, release, branch-protection, cross-module
  architecture, generated-contract, or repeated-finding changes where missed
  review has high cost.
- `learning`: repeated CodeRabbit or `#code-fixes` patterns that should become a
  validator, test, doc rule, memory entry, or tracked exception.

Use labels, PR-template fields, or a review-state artifact to record the chosen
lane. Do not infer cost savings from fewer comments alone; require accepted
finding ratio, repeated-pattern burn-down, or account usage evidence.

## Capability Ledger

Every non-trivial sweep must report which review inputs were available:

- `github_review_threads`: available, blocked, or not attempted, with PR URL,
  head SHA, unresolved-thread count, and command/tool evidence.
- `coderabbit_check`: available, blocked, or not attempted, with check status,
  target URL when present, and whether evidence matches the latest PR head.
- `slack_code_fixes`: available, blocked, or not attempted. If blocked, record
  whether channel discovery worked, whether message history read/search worked,
  and the smallest recovery path: reconnect Slack scopes, export the relevant
  channel slice, or paste report excerpts.
- `browser_coderabbit`: available, blocked, or not attempted. Distinguish public
  docs/blog reads from authenticated dashboard/account/config/usage reads.
  Mutations require separate action-time authorization.
- `discord_announcements`: available, blocked, or not attempted, with read-only
  channel or app-state evidence. Treat announcements as advisory context.
- `repo_policy`: available, blocked, or not attempted, with config/docs read and
  validation commands.

## Workflow

1. Resolve the target PR.
2. Build the capability ledger before summarizing or patching.
3. Query current CodeRabbit and GitHub review state.
4. Ingest Slack `#code-fixes` daily reports when message history is readable.
5. Read Discord announcements only as changelog context when safely accessible.
6. Compare the report feed, live PR threads, repo config, and policy docs for
   contradictions.
7. Choose the Signal Budget lane before requesting or rerunning review.
8. Report review lane status without claiming CI, tracker, or merge readiness.

## Signal Classification

Classify each CodeRabbit or `#code-fixes` item before acting:

- `actionable`: confirmed bug, contract drift, missing validation, security
  issue, or review-thread blocker on an active PR.
- `stale`: finding is resolved, outdated, or attached to an older head SHA.
- `false-positive`: finding does not apply after checking the current code.
- `gate-covered`: finding is already enforced by a deterministic local or CI
  gate; cite the gate.
- `promote-to-gate`: repeated or high-value finding that should become a test,
  validator, doc rule, memory entry, or review-state check.
- `config-ignore`: generated artifact, style-only comment, provider status
  noise, or channel summary that should be filtered or batched.

## Cost And Usefulness Metrics

Track optimization by decision quality, not raw comment volume:

- actionable finding ratio
- accepted finding ratio
- stale/noise ratio
- findings promoted to validators, tests, docs, or memory
- repeat findings after promotion
- human attention minutes per PR review lane
- CodeRabbit spend or usage per accepted finding when authenticated account
  evidence is available
- findings that local gates should have caught before review

## Thread Report Acceptance

A sweep or PM handoff reply must write a `thread-report/v1` artifact when a
thread is coordinating review state, cost optimization, or cross-thread work.
No repo-owned `thread-report/v1` writer command exists yet; until one lands,
record the artifact writer as blocked and include the current provider query,
review-state wrapper output, and PM Hub destination in the handoff evidence.
The artifact must include:

- task id, source thread id, repo path, branch, and current head SHA when known
- capability ledger
- source-of-truth map
- action queue
- decision ledger
- contradictions
- `next_gate_allowed` with rationale
- acceptance criteria for the next thread
- exact command/tool evidence with pass, fail, or blocked outcome
- remaining blockers and smallest recovery action

## Stop Conditions

Stop when all review findings are resolved or explicitly waived, the PR is
closed, the provider is unavailable after credential recovery, or a human
decision is required.

## Validation

Use the current provider query or review-state wrapper and validate any
`review-state/v1` packet with `validateReviewStatePacket` or the owning
wrapper that calls it. For runbook changes, run `pnpm docs:lifecycle` and
`bash scripts/run-harness-gate.sh docs-gate --mode required --json`.
