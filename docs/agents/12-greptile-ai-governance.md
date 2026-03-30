# AI review governance

## Purpose

This repository enforces an AI-integrated review policy with CodeRabbit as the primary review authority for `coding-harness`, while preserving Greptile bridge guidance for legacy harness-managed repositories that still rely on `.greptile/` scaffolding.

## Table of Contents

- [Absolute grounding](#absolute-grounding)
- [Current repository authority](#current-repository-authority)
- [Independent validation and compliance](#independent-validation-and-compliance)
- [Configuration standards and cascading governance](#configuration-standards-and-cascading-governance)
- [Required local `.greptile/` structure](#required-local-greptile-structure)
- [Webhook and event requirements](#webhook-and-event-requirements)
- [Greptile Review bridge workflow](#greptile-review-bridge-workflow)
- [Merge logic for multi-scope pull requests](#merge-logic-for-multi-scope-pull-requests)
- [Legacy Greptile confidence score policy](#legacy-greptile-confidence-score-policy)
- [Strictness and branch protection expectations](#strictness-and-branch-protection-expectations)
- [Indexing vs review warning](#indexing-vs-review-warning)
- [Feedback loops and calibration](#feedback-loops-and-calibration)
- [Custom context and pattern repositories](#custom-context-and-pattern-repositories)
- [MCP loop workflow and manual triggers](#mcp-loop-workflow-and-manual-triggers)
- [Verification command](#verification-command)

## Absolute grounding

This document is the repository-local grounding for automated review interactions:

- CodeRabbit review and merge authority for this repository,
- Greptile repository indexing and bridge setup for legacy harness-managed repositories,
- review and validation,
- merge decisions.

All automated review usage in this repository must align with this policy and linked governance docs.

## Current repository authority

- `coding-harness` uses the native GitHub `CodeRabbit` check as its primary automated review signal.
- `.coderabbit.yaml` is the active repository-local review configuration for this repository.
- Greptile-specific files and bridge workflows remain documented because `harness init` still scaffolds them for legacy or downstream repository compatibility.

## Independent validation and compliance

- Coding and validation duties must remain separate.
- The coding agent must not self-approve.
- Every PR requires an independent review signal before merge.
- For this repository, that signal is expected to come from CodeRabbit plus the existing Codex review process unless an explicit waiver is recorded.

## Configuration standards and cascading governance

Settings precedence (highest first):

1. Org-enforced dashboard rules.
2. Directory-scoped `.greptile/` folders.
3. Legacy `greptile.json` (ignored when `.greptile/` exists in same directory).
4. Dashboard defaults.

## Required local `.greptile/` structure

This repository must maintain:

- `.greptile/config.json`
- `.greptile/rules.md`
- `.greptile/files.json`

Use the `greploop` or `check-pr` skill to set up or refresh these files.
`harness init` should distribute this baseline into harness-managed repositories.

## Webhook and event requirements

For the Greptile Review bridge workflow to function correctly, the Greptile GitHub App must subscribe to these events:

- `pull_request` - triggers on PR open/sync/reopen
- `pull_request_review` - triggers on review submission
- `pull_request_review_comment` - triggers on review comments
- `issue_comment` - triggers on PR comments (Greptile feedback)

These events are configured at the GitHub App level (not repository level). To verify setup:

1. Go to GitHub App settings: `https://github.com/apps/greptile/configurations`
2. Ensure "Pull requests", "Pull request reviews", and "Issue comments" are subscribed
3. Verify the app has "Checks: Write" permission

## Greptile Review bridge workflow

Since Greptile posts PR comments but doesn't create GitHub check runs, legacy Greptile-bridged repositories use a bridge workflow:

- `.github/workflows/greptile-review.yml` - creates "Greptile Review" check runs
- Triggers on PR events, review events, and Greptile comments
- Parses Greptile comments for confidence scores
- Uses `minMergeScore` from `.greptile/config.json` as pass threshold
- Creates a failing pending-state check when Greptile has not reviewed the current head commit yet so merge stays blocked until review evidence exists

Legacy Greptile-bridged repositories require "Greptile Review" as a passing status check.

## Merge logic for multi-scope pull requests

When a PR spans directories with different configs:

- strictness: highest restriction wins (`MAX`),
- `fileChangeLimit`: lowest value wins (`MIN`),
- comment types: union all requested types,
- booleans: enabled if any scope enables (`OR`).

## Legacy Greptile confidence score policy

- `5/5`: merge-ready.
- `4/5`: merge after minor polish.
- `3/5`: must address findings and re-review.
- `2/5`: blocked.
- `0-1/5`: blocked.

Legacy repository merge rule for Greptile-bridged repositories: do not merge below `4/5`.

## Strictness and branch protection expectations

- Strictness 1 (verbose): security-critical paths and initial setup.
- Strictness 2 (default): all PRs targeting `main`/production.
- Strictness 3 (critical-only): only stable, non-critical infrastructure.

Required status checks include:
- `pr-template`, `linear-gate`, `risk-policy-gate`
- `dependency-review`, `actions-pinning`, `consistency-drift-health`
- `docs-gate` (documentation parity)
- `lint`, `typecheck`, `test`, `audit`, `check`, `memory`
- `security-scan`, `CodeRabbit`

## Indexing vs review warning

`ignorePatterns` excludes files from review scope only; it does not prevent indexing.

Large binaries/assets and `node_modules` must be excluded at repository/dashboard indexing level.

## Feedback loops and calibration

- Use 👍/👎 on comments as primary training signal.
- Pair 👎 with a short rationale.
- Respect commit-delta learning and the 3-ignore suppression rule.
- Allow 2-3 weeks calibration for new repositories.

## Custom context and pattern repositories

Rules should be specific and measurable and include examples.

Pattern repositories should be linked via `patternRepositories` where applicable so Greptile can detect reuse opportunities and architectural drift.

## MCP loop workflow and manual triggers

Manual fix workflow:

1. Fetch unresolved comments (`addressed: false`) via `list_merge_request_comments`.
2. Apply actionable suggestions.
3. Commit and allow Greptile to resolve addressed items.

Manual trigger standards:

- use `@coderabbitai review` or `@coderabbitai full review` for `coding-harness`,
- use `@greptileai` for draft PR reviews on legacy Greptile-bridged repositories,
- force re-review after config changes,
- request targeted checks when needed.

## Verification command

Run `harness verify-greptile` to verify the legacy Greptile setup when you are working on a Greptile-bridged repository:

```bash
# Local verification only
harness verify-greptile

# Full verification including GitHub API checks
harness verify-greptile --token $GITHUB_TOKEN --owner jscraik --repo coding-harness

# Verify GitHub App installation with App JWT credentials
harness verify-greptile \
  --owner jscraik \
  --repo coding-harness \
  --app-id $GITHUB_APP_ID \
  --app-private-key-path ~/.config/github/greptile-app.pem

# Check all repos for one owner (installation check + rulesets)
gh repo list jscraik --limit 500 --json name -q '.[].name' | while read -r repo; do
  harness verify-greptile \
    --owner jscraik \
    --repo "$repo" \
    --token "$GITHUB_TOKEN" \
    --app-id "$GITHUB_APP_ID" \
    --app-private-key-path ~/.config/github/greptile-app.pem \
    --json
done

# JSON output for CI
harness verify-greptile --json

# Trigger a standard review request comment
harness request-greptile-review --owner jscraik --repo coding-harness --pr 123
```

The verification checks:

1. `.greptile/config.json` exists and has required fields
2. `.greptile/rules.md` exists and remains repository-local
3. `.greptile/files.json` exists and points to graph-review context/schema sources
4. `.github/workflows/greptile-review.yml` exists with required triggers
5. GitHub App is installed (best verified via `--app-id` + `--app-private-key-path`)
6. Legacy ruleset requires "Greptile Review" status check
7. Webhook events are properly configured
