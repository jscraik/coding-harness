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
- CodeRabbit Semgrep for this repository is driven by `scripts/semgrep-pre-push.yml`; treat `ERROR` findings as merge blockers and record the disposition of any remaining `WARNING` findings in the PR.
- Repo-specific CodeRabbit `ast-grep` rules live under `rules/` and should stay limited to repository contracts that generic linters or vendor-essential rules do not already cover.

## Independent validation and compliance

- Coding and validation duties must remain separate.
- The coding agent must not self-approve.
- Every PR requires an independent review signal before merge.
- For this repository, that signal is expected to come from CodeRabbit plus the existing Codex review process unless an explicit waiver is recorded.

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
- External GitHub App required-check context: `CodeRabbit`

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
- use `@coderabbitai autofix` to push CodeRabbit-generated fixes onto the current PR branch when unresolved findings include actionable fix instructions,
- use `@coderabbitai autofix stacked pr` when you want CodeRabbit to open a separate stacked PR for those fixes instead of pushing to the current branch,
- on supported GitHub PR flows, the pull request review comment may also expose a beta checkbox for the same CodeRabbit-generated fix actions.

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
- Do not use `curl | sh` in this repository runbook for CodeRabbit CLI install.
- The CLI requires interactive `coderabbit auth login` or `--api-key`.
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
