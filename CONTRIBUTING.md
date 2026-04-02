# Contributing

## Table of Contents

- [Minimum workflow contract](#minimum-workflow-contract)
- [Why this workflow exists](#why-this-workflow-exists)
- [Branching and PR rule](#branching-and-pr-rule)
- [Branch name policy](#branch-name-policy)
- [Required pre-merge gates](#required-pre-merge-gates)
- [Required tooling baseline](#required-tooling-baseline)
- [Repo-local verification wrapper](#repo-local-verification-wrapper)
- [CodeRabbit setup baseline](#coderabbit-setup-baseline)
- [CodeRabbit configuration hierarchy](#coderabbit-configuration-hierarchy)
- [CodeRabbit review policy for multi-scope pull requests](#coderabbit-review-policy-for-multi-scope-pull-requests)
- [CodeRabbit score interpretation policy](#coderabbit-score-interpretation-policy)
- [CodeRabbit strictness policy](#coderabbit-strictness-policy)
- [CodeRabbit training and feedback loop](#coderabbit-training-and-feedback-loop)
- [Recommended security scanner baseline](#recommended-security-scanner-baseline)
- [Review artifacts requirement](#review-artifacts-requirement)
- [Credential-safe evidence snippets](#credential-safe-evidence-snippets)
- [Branch protection recommendation](#branch-protection-recommendation)

## Minimum workflow contract

- Branch off `main` for every change.
- No direct push to `main`.
- Pull request required for every merge.
- Required checks must pass before merge.
- CodeRabbit + Codex review artifacts are required before merge for this repository.
- The coding agent must not approve its own PR; review must be independent.
- Merge only after all gates pass.
- Delete branch/worktree after merge.

## Why this workflow exists

This workflow keeps delivery auditable, reversible, and consistent even for solo development.

## Branching and PR rule

1. Create a dedicated branch/worktree for each task:
   - Agent-created branch: `git switch -c codex/<short-description>`
   - Agent-created worktree: `git worktree add ../tmp-worktree -b codex/<short-description>`
   - Human-authored branch prefixes (when not using `codex/`): `feat/`, `fix/`, `docs/`, `refactor/`, `chore/`, `test/`
2. Keep commits small and focused.
3. Open a PR to merge into `main`.
4. Do not merge until checks, reviews, and checklist items are complete.
5. After merge, delete the remote branch and remove local worktree/branch.

## Branch name policy

- Use lower-case, kebab-case slugs.
- Agent-created branches must use `codex/<short-description>`.
- Human-authored branches may use: `feat/`, `fix/`, `docs/`, `refactor/`, `chore/`, `test/`.
- Avoid `main`-like names and do not include secrets or issue-pii.

## Required pre-merge gates

- pnpm lint
- pnpm typecheck
- pnpm test
- pnpm audit
- pnpm check
- test -f memory.json && jq -e '.meta.version == "1.0" and (.preamble.bootstrap | type == "boolean") and (.preamble.search | type == "boolean") and (.entries | type == "array")' memory.json >/dev/null

## Required tooling baseline

Harness-managed repositories should keep this baseline available locally before claiming the repo is ready:

- `prek`
- `diagram`
- `mise`
- `vale`
- `argos`
- `cosign`
- `cloudflared`
- `vitest`
- `ruff`
- `eslint`
- `agent-browser`
- `agentation` (backed by the `agentation-mcp` CLI)
- `mermaid-cli` (via the `mmdc` CLI)
- `markdownlint-cli2`
- `wrangler`
- `beautiful-mermaid`
- `semgrep`
- `semver`
- `trivy`
- `rsearch` (arXiv research)
- `wsearch` (Wikidata search)

Recommended policy:

- Pin repo-managed tooling in `.mise.toml` where possible.
- Treat `scripts/codex-preflight.sh` as required project bootstrap infrastructure.
- Scaffold `scripts/codex-enforced` and `scripts/codex-learn` together with preflight so repo-local wrappers own repo-local state.
- Keep `preflight_repo` in `required` mode by default; only relax mode (`optional` or `off`) when the project documents why.
- Adjust preflight binary/path lists per project scope instead of deleting the script.
- Keep repo-scoped telemetry and learned overrides under `.harness/memory/`, and global telemetry under `~/.codex/`.
- Treat `scripts/verify-work.sh` as the canonical repo-local verification command and keep it wired to repo-local preflight defaults.
- Treat `scripts/check-environment.sh` as the local readiness gate for required tooling.
- Block merge or promotion work when a required CLI is missing rather than silently skipping the corresponding validation lane.
- For repositories with explicit `ui` / `chatgpt_apps_sdk` capabilities or matching dependency signals, install `@brainwav/design-system-guidance` and treat its absence as a readiness failure.

## Repo-local verification wrapper

- `scripts/verify-work.sh` is the canonical repo-local verification entrypoint.
- The wrapper always runs `scripts/codex-preflight.sh` in `required` Local Memory mode with scaffold-safe path and binary expectations.
- Repo-local launches should prefer `./scripts/codex-enforced` so preflight failures are recorded into repo-scoped learn state.
- Use `./scripts/codex-learn analyze` and `./scripts/codex-learn apply` to inspect repo-scoped failure patterns and write override files into `.harness/memory/`.
- Use `bash scripts/verify-work.sh` for the full verification bundle.
- Use `bash scripts/verify-work.sh --fast` for preflight + lint + typecheck + focused test coverage.

## CodeRabbit setup baseline

- `coding-harness` uses `CodeRabbit` as the primary automated review check.
- `.coderabbit.yaml` enables `reviews.request_changes_workflow`, so CodeRabbit may request changes for blocking findings and auto-approve once its comment state is clean again.
- `harness init` scaffolds `.coderabbit.yaml` into harness-managed repositories.
- Verify setup with:
  - `harness verify-coderabbit`
  - `harness verify-coderabbit --token $GITHUB_TOKEN --owner <owner> --repo <repo>`
- Trigger or refresh a review with:
  - `@coderabbitai review`
  - `@coderabbitai full review`
  - `@coderabbitai resolve`
  - `@coderabbitai autofix`

## CodeRabbit configuration hierarchy

1. Org-enforced dashboard rules.
2. Repository `.coderabbit.yaml` settings.
3. Pull-request comment triggers for review/autofix actions.

## CodeRabbit review policy for multi-scope pull requests

- repository policy remains fail-closed: merge only after required checks pass.
- unresolved CodeRabbit findings are blockers unless explicitly waived with rationale.
- CodeRabbit may approve a clean PR automatically after its findings are resolved, but the coding agent must still not self-approve and the PR must still carry independent review evidence.
- review artifacts should be recorded in the PR body for traceability.

## CodeRabbit score interpretation policy

- blocking findings: must be addressed or explicitly waived.
- advisory findings: may remain only with documented rationale.

## CodeRabbit strictness policy

- security-critical and governance-critical surfaces should stay in strict review posture.
- stable non-critical internal surfaces can use narrower review prompts when appropriate.

## CodeRabbit training and feedback loop

- use targeted prompts for scoped follow-up checks.
- provide rationale when dismissing or waiving findings.
- re-run review after substantial config or policy changes.

## Recommended security scanner baseline

For repositories that use Harness, recommend installing these scanners as project prerequisites:

- Gitleaks
- Trivy
- Semgrep

Recommended policy:

- Keep scanner binaries available in local development environments and CI runners.
- Run scanner checks in CI on pull requests and pushes to protected branches.
- Treat scanner findings as merge blockers unless explicitly waived with rationale.

## Review artifacts requirement

Each PR must include:

- CodeRabbit review artifact (URL, report, or comment reference).
- Codex review artifact (URL, report, or comment reference).
- Confirmation that reviewer agent is independent from coding agent.

If either artifact is missing, block merge until it is added or explicitly waived by repository policy.

## Credential-safe evidence snippets

- Never use command substitution in commit messages, PR bodies, or evidence notes for secrets.
- Do **not** use `$(gh auth token)` (or similar) inside `git commit -m ...` / `gh pr create --body ...`.
- Use placeholders in text output:
  - ✅ `$GITHUB_TOKEN`
  - ✅ `${GITHUB_TOKEN}`
  - ❌ expanded token values
- If a token value is ever exposed in commit/PR text, treat it as compromised: rotate/revoke, rewrite history where applicable, and document remediation in the issue/PR.

## Branch protection recommendation

Configure GitHub branch protection (or rulesets) on `main`:

- Bootstrap baseline via harness:
  - `harness branch-protect --owner <owner> --repo <repo>`
- Token resolution for `branch-protect`:
  - `--token <PAT>` or env `GITHUB_TOKEN` / `GITHUB_PERSONAL_ACCESS_TOKEN`
- Require pull request before merge.
- Allow `0` required reviewers for solo-maintainer repositories.
- Dismiss stale approvals when new commits are pushed.
- Require conversation resolution before merge.
- Restrict branch deletions.
- Block force pushes.
- Require linear history.
- Require status checks:
  - `pr-template`
  - `linear-gate`
  - `risk-policy-gate`
  - `dependency-scan`
  - `orb-pinning`
  - `consistency-drift-health`
  - `docs-gate`
  - `lint`
  - `typecheck`
  - `test`
  - `audit`
  - `check`
  - `memory`
  - `security-scan`
  - `CodeRabbit`
- Require branches to be up to date before merge.
- Require code quality results with severity `all`.
- In public repositories, require `CodeQL` code scanning results with `high_or_higher` security alerts and `errors` alerts thresholds.
- Allow merge commits, squash merges, and rebase merges.
- Require workflows to pin third-party actions to full commit SHAs.
- Configure required checks workflows to run on both `pull_request` and `merge_group` when using merge queue.
- Block direct pushes to `main`.
