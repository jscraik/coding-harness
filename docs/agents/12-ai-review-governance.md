---
last_validated: 2026-04-18
---

# AI review governance

## Purpose

This repository enforces an AI-integrated review policy with CodeRabbit as the primary automated review authority.

## Table of Contents

- [Absolute grounding](#absolute-grounding)
- [Current repository authority](#current-repository-authority)
- [Independent validation and compliance](#independent-validation-and-compliance)
- [Configuration standards and governance](#configuration-standards-and-governance)
- [Branch protection expectations](#branch-protection-expectations)
- [Feedback loops and calibration](#feedback-loops-and-calibration)
- [MCP loop workflow and manual triggers](#mcp-loop-workflow-and-manual-triggers)
- [Local CodeRabbit CLI](#local-coderabbit-cli)
- [Verification command](#verification-command)

## Absolute grounding

This document is the repository-local grounding for automated review interactions:

- CodeRabbit review and merge authority for this repository,
- review and validation responsibilities,
- merge decisions and required evidence.

All automated review usage in this repository must align with this policy and linked governance docs.

## Current repository authority

- `coding-harness` uses the native GitHub `CodeRabbit` check as its primary automated review signal.
- `.coderabbit.yaml` is the active repository-local review configuration for this repository.
- `reviews.request_changes_workflow` is disabled in this repository baseline (`false`) so CodeRabbit feedback stays advisory while branch-protection checks and independent reviewer evidence remain the merge gate.
- CodeRabbit Semgrep for this repository is driven by `scripts/semgrep-pre-push.yml`; treat `ERROR` findings as merge blockers and record the disposition of any remaining `WARNING` findings in the PR.
- Repo-specific CodeRabbit `ast-grep` rules live under `rules/` and should stay limited to repository contracts that generic linters or vendor-essential rules do not already cover.

## Independent validation and compliance

- Coding and validation duties must remain separate.
- The coding agent must not self-approve.
- Every PR requires an independent review signal before merge.
- For this repository, that signal is expected to come from CodeRabbit plus the existing Codex review process unless an explicit waiver is recorded.
- Any review workflow that runs `harness linear*` commands must provide `LINEAR_API_KEY` in the runtime environment (or pass `--token` explicitly).
- If Linear secrets are stored in `~/.codex/.env`, load them into the active shell/session before running `harness linear*` commands, and use `harness symphony-check` when validating discovery behavior.

## Configuration standards and governance

Settings precedence (highest first):

1. Org-enforced dashboard rules.
2. Repository `.coderabbit.yaml`.
3. Dashboard defaults.

## Branch protection expectations

For this repository, branch protection should use the canonical required-check contexts declared in `harness.contract.json`, `.harness/ci-required-checks.json`, and [17-ci-required-checks.md](./17-ci-required-checks.md).

Use these names as branch-protection check contexts, not as shorthand for local commands:

- CI-emitted required-check contexts: `pr-template`, `linear-gate`,
  `risk-policy-gate`, `dependency-scan`, `orb-pinning`,
  `consistency-drift-health`, `docs-gate`, `lint`, `typecheck`, `test`,
  `audit`, `check`, `memory`, `security-scan`
- External GitHub App required-check contexts: `CodeRabbit`,
  `semgrep-cloud-platform/scan`

Local commands such as `pnpm lint` or `pnpm check` are validation evidence only
unless they correspond to one of the required check contexts above.

## Feedback loops and calibration

- Use thumbs up and thumbs down on comments as primary training signal.
- Pair negative feedback with a short rationale.
- Re-run review after substantial policy or prompt changes.

## MCP loop workflow and manual triggers

Manual fix workflow:

1. Fetch unresolved comments (`addressed: false`) via your PR tooling.
2. Apply actionable suggestions.
3. Commit and allow CodeRabbit to re-evaluate the PR head SHA.

Manual trigger standards:

- use `@coderabbitai review` or `@coderabbitai full review` for normal review loops,
- use `@coderabbitai resolve` to mark all CodeRabbit review comments resolved after the underlying fixes land,
- on request-changes workflow repositories, use a top-level `@coderabbitai approve` or `@coderabbitai resolve` command when you need CodeRabbit to re-evaluate a now-clean PR state after comments are addressed,
- use `@coderabbitai autofix` to push CodeRabbit-generated fixes onto the current PR branch when unresolved findings include actionable fix instructions,
- use `@coderabbitai autofix stacked pr` when you want CodeRabbit to open a separate stacked PR for those fixes instead of pushing to the current branch,
- on supported GitHub PR flows, the pull request review comment may also expose a beta checkbox for the same CodeRabbit-generated fix actions.

## Local CodeRabbit CLI

The local CodeRabbit CLI is optional for `coding-harness`. It is useful for
drafting or previewing review prompts, but it does not replace the GitHub App
check that branch protection enforces on this repository.

Recommended local CLI flow for this repository:

```bash
coderabbit --version
coderabbit auth status --agent || coderabbit auth login --agent
coderabbit review --agent --base main -c .coderabbit.yaml
```

Notes:

- Use `coderabbit update` before review runs when the local CLI is stale.
- Do not use `curl | sh` in this repository runbook for CodeRabbit CLI install.
- Agent workflows should use `coderabbit auth login --agent` (or `--api-key` for non-interactive runs).
- Use `.coderabbit.yaml` as the repo-local instruction source.
- Treat local CLI output as advisory; merge authority still comes from the
  GitHub `CodeRabbit` check on the PR head SHA.

## Verification command

Run `harness verify-coderabbit` to verify repository-local CodeRabbit setup:

```bash
harness verify-coderabbit
harness verify-coderabbit --token $GITHUB_TOKEN --owner jscraik --repo coding-harness
harness verify-coderabbit --json
```
