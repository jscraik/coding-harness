# Greptile AI governance

## Purpose

This repository enforces an AI-integrated review policy for Greptile that prioritizes architectural consistency, objective validation, and auditable merge decisions.

## Table of Contents

- [Absolute grounding](#absolute-grounding)
- [Independent validation and compliance](#independent-validation-and-compliance)
- [Configuration standards and cascading governance](#configuration-standards-and-cascading-governance)
- [Required local `.greptile/` structure](#required-local-greptile-structure)
- [Merge logic for multi-scope pull requests](#merge-logic-for-multi-scope-pull-requests)
- [Confidence score policy](#confidence-score-policy)
- [Strictness and branch protection expectations](#strictness-and-branch-protection-expectations)
- [Indexing vs review warning](#indexing-vs-review-warning)
- [Feedback loops and calibration](#feedback-loops-and-calibration)
- [Custom context and pattern repositories](#custom-context-and-pattern-repositories)
- [MCP loop workflow and manual triggers](#mcp-loop-workflow-and-manual-triggers)

## Absolute grounding

This document is the repository-local grounding for Greptile interactions:

- repository indexing,
- graph/context setup,
- review and validation,
- merge decisions.

All Greptile usage in this repository must align with this policy and linked governance docs.

## Independent validation and compliance

- Coding and validation duties must remain separate.
- The coding agent must not self-approve.
- Every PR requires an independent review signal before merge.

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

Use the `grepfile` skill to set up or refresh these files.

## Merge logic for multi-scope pull requests

When a PR spans directories with different configs:

- strictness: highest restriction wins (`MAX`),
- `fileChangeLimit`: lowest value wins (`MIN`),
- comment types: union all requested types,
- booleans: enabled if any scope enables (`OR`).

## Confidence score policy

- `5/5`: merge-ready.
- `4/5`: merge after minor polish.
- `3/5`: must address findings and re-review.
- `2/5`: blocked.
- `0-1/5`: blocked.

Repository merge rule: do not merge below `4/5`.

## Strictness and branch protection expectations

- Strictness 1 (verbose): security-critical paths and initial setup.
- Strictness 2 (default): all PRs targeting `main`/production.
- Strictness 3 (critical-only): only stable, non-critical infrastructure.

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

- use `@greptileai` for draft PR reviews,
- force re-review after config changes,
- request targeted checks when needed.
