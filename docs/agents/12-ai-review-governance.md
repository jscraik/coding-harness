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
- [Local CodeRabbit CLI](#local-coderabbit-cli)
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
- CodeRabbit Semgrep for this repository is driven by `scripts/semgrep-pre-push.yml`; treat `ERROR` findings as merge blockers and record the disposition of any remaining `WARNING` findings in the PR.
- Repo-specific CodeRabbit `ast-grep` rules live under `rules/` and should stay limited to repository contracts that generic linters or vendor-essential rules do not already cover.
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

For this repository, branch protection should use the canonical required-check
contexts declared in `harness.contract.json`, `.harness/ci-required-checks.json`,
and [17-ci-required-checks.md](./17-ci-required-checks.md).

Use these names as branch-protection check contexts, not as shorthand for local
commands:

- CI-emitted required-check contexts: `pr-template`, `linear-gate`,
  `risk-policy-gate`, `dependency-scan`, `orb-pinning`,
  `consistency-drift-health`, `docs-gate`, `lint`, `typecheck`, `test`,
  `audit`, `check`, `memory`, `security-scan`
- External GitHub App required-check context: `CodeRabbit`

Local commands such as `pnpm lint` or `pnpm check` are validation evidence only
unless they correspond to one of the required check contexts above.

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
- use `@coderabbitai autofix` to push CodeRabbit-generated fixes onto the current PR branch when unresolved CodeRabbit findings include actionable fix instructions,
- use `@coderabbitai autofix stacked pr` when you want CodeRabbit to open a separate stacked PR for those fixes instead of pushing to the current branch,
- on supported GitHub PR flows, the pull request review comment may also expose a beta checkbox for the same CodeRabbit-generated fix actions,
- use `@greptileai` for draft PR reviews on legacy Greptile-bridged repositories,
- force re-review after config changes,
- request targeted checks when needed.

## Local CodeRabbit CLI

The local CodeRabbit CLI is optional for `coding-harness`. It is useful for
drafting or previewing review prompts, but it does not replace the GitHub App
check that branch protection enforces on this repository.

Recommended pinned local flow for this repository:

```bash
CODERABBIT_VERSION="0.3.11"
CODERABBIT_OS="darwin"
CODERABBIT_ARCH="arm64"
CODERABBIT_ARCHIVE_URL="https://cli.coderabbit.ai/releases/${CODERABBIT_VERSION}/coderabbit-${CODERABBIT_OS}-${CODERABBIT_ARCH}.zip"
CODERABBIT_ARCHIVE_SHA256="1c23eda82e4283a64e35b9826372951a486bd8b81973d327f7310eb6ba112c01"
TMP_DIR="$(mktemp -d)"
ARCHIVE_PATH="${TMP_DIR}/coderabbit-${CODERABBIT_OS}-${CODERABBIT_ARCH}.zip"

curl -fsSL "${CODERABBIT_ARCHIVE_URL}" -o "${ARCHIVE_PATH}"
echo "${CODERABBIT_ARCHIVE_SHA256}  ${ARCHIVE_PATH}" | shasum -a 256 -c -
install -d "${HOME}/.local/bin"
unzip -q "${ARCHIVE_PATH}" -d "${TMP_DIR}"
install -m 0755 "${TMP_DIR}/coderabbit" "${HOME}/.local/bin/coderabbit"
ln -sf "${HOME}/.local/bin/coderabbit" "${HOME}/.local/bin/cr"

coderabbit auth login
coderabbit review --base main --cwd /path/to/coding-harness -c .coderabbit.yaml
```

Notes:

- The example above is pinned to CodeRabbit CLI `0.3.11` for `darwin-arm64`.
  If you use another platform artifact, pin the matching release asset and
  update the expected checksum before install.
- Do not use `curl | sh` in this repository's runbooks for CodeRabbit CLI
  installation.
- The CLI requires interactive `coderabbit auth login` or `--api-key`.
- Use `.coderabbit.yaml` as the repo-local instruction source.
- Treat local CLI output as advisory; merge authority still comes from the
  GitHub `CodeRabbit` check on the PR head SHA.

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
6. Ruleset requires "Greptile Review" status check
7. Webhook events are properly configured
