---
doc_schema: coding-harness-doc/v1
doc_type: contributing
authority: canon
canon_class: canonical
distribution: source-only
audience:
  - human-operator
  - coding-harness-maintainer
  - codex-agent
lifecycle_state: active
owner: coding-harness-maintainers
created: 2026-06-04
last_reviewed: 2026-06-04
review_cadence: quarterly
maintenance_trigger:
  - contributor-workflow-change
  - pr-template-change
  - validation-gate-change
semver_impact: minor
validated_by:
  - pnpm docs:lifecycle
depends_on:
  - AGENTS.md
  - docs/agents/04-validation.md
  - docs/agents/08-release-and-change-control.md
---

# Contributing

## Table of Contents

- [Minimum workflow contract](#minimum-workflow-contract)
- [Why this workflow exists](#why-this-workflow-exists)
- [Branching and PR rule](#branching-and-pr-rule)
- [Branch name policy](#branch-name-policy)
- [Required pre-merge gates](#required-pre-merge-gates)
- [Required tooling baseline](#required-tooling-baseline)
- [Project Brain workflow](#project-brain-workflow)
- [Repo-local verification wrapper](#repo-local-verification-wrapper)
- [Repo-local harness wrapper](#repo-local-harness-wrapper)
- [Recommended security scanner baseline](#recommended-security-scanner-baseline)
- [North-star learning loop evidence](#north-star-learning-loop-evidence)
- [Review artifacts requirement](#review-artifacts-requirement)
- [Credential-safe evidence snippets](#credential-safe-evidence-snippets)
- [Branch protection recommendation](#branch-protection-recommendation)

## Minimum workflow contract

- Branch off `main` for every change.
- No direct push to `main`.
- Pull request required for every merge.
- Required checks must pass before merge.
- CodeRabbit + Codex review artifacts are required before merge.
- The coding agent must not approve its own PR; review must be independent.
- High-risk action-review receipts are audit artifacts only: they must prove
  reviewer independence, canonical actor identity separation, current evidence,
  and allow/block/mismatch semantics, but they must not authorize commands or
  substitute for delivery-truth, policy-gate, PR closeout, or human approval.
- Flow Ops closure-evidence changes that reroute validation or source
  classification must refresh `AI/context/diagram-context.md` and the
  docs-gate-required governance surfaces in the same PR.
- Merge only after all gates pass.
- Delete branch/worktree after merge.
- CI ownership is contractual: CircleCI owns PR governance, CodeRabbit remains an
  independent review check, CircleCI owns repo-run Semgrep and Snyk security
  checks, Semgrep Cloud remains an independent security check, and GitHub
  Actions workflows must not become automatic PR gates without an explicit
  `ciOwnership` migration.

## Why this workflow exists

This workflow keeps delivery auditable, reversible, and consistent even for solo development.

## Branching and PR rule

1. Create a dedicated branch/worktree for each task:
   - Preferred project-local helper: `bash scripts/new-task.sh <issue-key>-<short-description>`
   - Agent-created branch: `git switch -c codex/<issue-key>-<short-description>`
   - Agent-created worktree: `git worktree add ../wt-<issue-key>-<short-description> -b codex/<issue-key>-<short-description>`
   - Human-authored branch prefixes (when not using `jscraik/feature/`): `feat/`, `fix/`, `docs/`, `refactor/`, `chore/`, `test/`
   - Keep one task = one worktree = one branch = one agent thread.
2. Keep commits small and focused.
3. Open a PR to merge into `main`.
4. Do not merge until checks, reviews, and checklist items are complete.
5. After merge, delete the remote branch and remove local worktree/branch.

## Branch name policy

- Use lower-case, kebab-case slugs.
- Agent-created branches must use `codex/<issue-key>-<short-description>`.
- Human-authored branches may use: `feat/`, `fix/`, `docs/`, `refactor/`, `chore/`, `test/`.
- Avoid `main`-like names and do not include secrets or issue-pii.

## Required pre-merge gates

- bash scripts/validate-codestyle.sh
- pnpm check
- test -f memory.json && jq -e '.meta.version == "1.0" and (.preamble.bootstrap | type == "boolean") and (.preamble.search | type == "boolean") and (.entries | type == "array")' memory.json >/dev/null
- CircleCI PR governance/security checks, including repo-run Semgrep and Snyk lanes, plus the external GitHub App required check `semgrep-cloud-platform/scan`, must be green before merge.
- PR closeout evidence must use the current PR head and the branch-protection
  required check set; failed or pending `gh pr checks` output remains check
  evidence when the CLI emits parseable JSON.

## Required tooling baseline

Harness-managed repositories should keep this baseline available locally before claiming the repo is ready:

- `prek`
- `diagram`
- `ralph`
- `mise`
- `vale`
- `argos`
- `cosign`
- `cloudflared`
- `vitest`
- `ruff`
- `eslint`
- `agent-browser`
- `ctx7` (Context7 documentation retrieval)
- `mermaid-cli` (via the `mmdc` CLI)
- `markdownlint-cli2`
- `wrangler`
- `beautiful-mermaid`
- `semgrep`
- `snyk` in CircleCI through the pinned Snyk orb and `SNYK_TOKEN` environment variable
- `semver`
- `trivy`
- `rsearch` (arXiv research)
- `wsearch` (Wikidata search)

Recommended policy:

- Pin repo-managed tooling in `.mise.toml` where possible.
- Treat `scripts/codex-preflight.sh` as required project bootstrap infrastructure.
- Treat `CODESTYLE.md` and `scripts/validate-codestyle.sh` as required repo-local contract files.
- Keep `CODESTYLE.md` as a real repo-local file in generated repositories even when the harness authoring source is maintained globally.
- Scaffold `scripts/codex-enforced` and `scripts/codex-learn` together with preflight so repo-local wrappers own repo-local state.
- Keep `bash scripts/codex-preflight.sh --stack auto --mode required` as the default preflight command; only relax mode (`optional` or `off`) when the project documents why.
- Adjust preflight binary/path lists per project scope instead of deleting the script.
- Keep repo-scoped telemetry and learned overrides under `.harness/memory/`, and global telemetry under `~/.codex/`.
- Treat `scripts/verify-work.sh` as the canonical repo-facing verification command and keep it wired to repo-local preflight defaults.
- Treat `scripts/validate-codestyle.sh` as the fail-closed code style gate and require exact proof-of-pass in change summaries and PRs.
- Treat `pnpm docs:archive-candidates` and `pnpm --silent docs:archive-candidates -- --json` as advisory stale-document cleanup evidence only; they may identify review candidates and repair hints, but they must not archive, move, delete, demote, rewrite docs, update manifests, update active artifacts, or repair archive indexes without a separate reviewed decision.
- When executable behavior changes, run the smallest real code path that exercises the exact production code touched before claiming verification.
- Prefer invoking production functions, classes, CLI commands, shell scripts, validators, or routes directly. If no existing test covers the path, create a temporary reproduction harness under `codex-scripts/` and keep that directory gitignored.
- If the exact path cannot run because of unavailable credentials, external services, unsafe side effects, or missing generated state, record the blocker clearly, run the nearest meaningful validation, and do not describe production behavior as verified unless the touched path actually ran.
- Keep docs-gate required documentation surfaces updated together when validation, required-check, tooling/runtime, or architecture-context behavior changes.
- When required-check behavior moves into a deeper module, keep the command
  facade thin, document the new seam in `docs/architecture/module-boundaries.md`,
  and prove the branch-protection identity set still matches
  `harness.contract.json`, `.harness/ci-required-checks.json`, generated
  scaffolds, CircleCI, CodeRabbit, and `semgrep-cloud-platform/scan`.
- Treat `scripts/new-task.sh` as the canonical task-entry helper so each task starts with a repo-local branch/worktree boundary instead of branch switching inside a shared checkout.
- Treat `scripts/prepare-worktree.sh` as required first-push bootstrap for freshly created worktrees so local hooks run with dependencies and canonical hook wiring.
- Treat `scripts/check-environment.sh` as the local readiness gate for required tooling.
- Keep pre-push diagram freshness branch-scoped: hook callers pass the branch changed-file list to `scripts/check-diagram-freshness.sh --changed-files <path>` so unrelated local worktree dirt does not force architecture artifact refreshes.
- Block merge or promotion work when a required CLI is missing rather than silently skipping the corresponding validation lane.
- When a pinned tooling dependency has a matching generated configuration schema, update the package version, the repo config, and the scaffold template together. Biome is governed this way: the root `biome.json` schema version and generated init template must match the installed `@biomejs/biome` major line.
- For repositories with explicit `ui` / `chatgpt_apps_sdk` capabilities or matching dependency signals, install `@brainwav/design-system-guidance` and treat its absence as a readiness failure.

## Project Brain workflow

- `harness init` scaffolds a Project Brain baseline under `.harness/`:
  - `.harness/README.md` as the tracked control-plane map and selective tracking policy.
  - `knowledge/INDEX.md`, domain folders (`cli`, `ci`, `governance`, `tooling`), `decisions/`, `quality/criteria.md`, and `review-log.md`.
  - `.harness/memory/LEARNINGS.md` as the repo-scoped learned-fixes ledger.
- Track curated `.harness` Markdown and JSON contract files with the repo; keep runtime databases, backups, caches, run output, and bulk snapshots local unless a fixture or validator explicitly consumes them.
- Treat `.harness/review`, `.harness/strategy`, `.harness/triage`, `.harness/features`, `.harness/ideate`, and `.harness/brainstorm` as secondary context until an admitted `.harness/linear`, `.harness/refactors`, `.harness/specs`, or `.harness/plan` slice references them.
- Repo-local preflight treats the Project Brain scaffold as required baseline paths.
- Run `./scripts/codex-learn analyze` to generate suggestions and refresh `.harness/knowledge/tooling/codex-learn-summary.md`.
- Promote repeated patterns into `rules.md` after 3+ confirmations; keep uncertain patterns in `hypotheses.md`.

## Repo-local verification wrapper

- `harness init` scaffolds `scripts/verify-work.sh` as the canonical repo-local verification entrypoint.
- The wrapper always runs `scripts/codex-preflight.sh` in `required` Local Memory mode with scaffold-safe path and binary expectations.
- `scripts/validate-codestyle.sh` is the canonical fail-closed code style gate and is reused by `verify-work`, local hooks, and downstream repo docs.
- `scripts/new-task.sh` is the canonical task bootstrap helper. Use it to create one task = one worktree = one branch = one agent thread inside the project itself.
- `scripts/check-git-common-config.sh` guards the shared Git config before preflight, verification, and worktree bootstrap. Shared non-bare `.git/config` must not contain `core.worktree`; worktree-local values must use per-worktree config.
- Repo-local launches should prefer `./scripts/codex-enforced` so preflight failures are recorded into repo-scoped learn state.
- Use `./scripts/codex-learn analyze` and `./scripts/codex-learn apply` to inspect repo-scoped failure patterns and write override files into `.harness/memory/`.
- Start new work with `bash scripts/new-task.sh <issue-key>-<slug>`, then enter the generated worktree and continue there.
- During iteration, run `bash scripts/validate-codestyle.sh --fast` for focused code style validation.
- Treat `pnpm run quality:docstrings`, `pnpm run quality:size`, `pnpm run quality:behavior-tests`, `pnpm run quality:git-env-sanitizer`, `pnpm run harness:audit-tracking`, and `pnpm run test:related` as mandatory changed-code and control-plane gates; they are included in `pnpm check`, `bash scripts/validate-codestyle.sh --fast`, and local pre-commit hooks.
- When executable behavior changes, run the smallest real code path that exercises the exact production code touched before claiming verification.
- Prefer production functions, classes, CLI commands, shell scripts, validators, or routes directly. If no existing test covers the path, create a temporary reproduction harness under `codex-scripts/`, keep it gitignored, and import or invoke production code instead of copying implementation into the harness.
- If the exact path cannot run because of unavailable credentials, external services, unsafe side effects, or missing generated state, record the blocker clearly and run the nearest meaningful validation instead.
- Before handoff, run `bash scripts/validate-codestyle.sh` for the fail-closed code style bundle.
- For the broader verification bundle, run `bash scripts/verify-work.sh`.
- For preflight + code style fast lane coverage, run `bash scripts/verify-work.sh --fast`.
- Before the first push from a fresh worktree, run `bash scripts/prepare-worktree.sh`.

## Repo-local harness wrapper

- `harness init` also scaffolds `scripts/harness-cli.sh` for repositories that want a repo-local wrapper around the published CLI package.
- The wrapper resolves `@brainwav/coding-harness/dist/cli.js` from the current repository before running any harness command.
- `scripts/run-harness-gate.sh` treats source checkouts as fail-closed when `pnpm`/`tsx` are unavailable so gates do not silently fall back to stale binaries.
- If the wrapper cannot resolve the package, treat that as local install/bootstrap drift rather than a harness command failure.
- Repair from the repo root with:
  - `pnpm install`
  - `pnpm add -D @brainwav/coding-harness`
- After repair, rerun:
  - `bash scripts/harness-cli.sh <command>`
  - `pnpm exec harness <command>`

## Recommended security scanner baseline

For repositories that use Harness, recommend installing these scanners as project prerequisites:

- Gitleaks
- Trivy
- Semgrep

Recommended policy:

- Keep scanner binaries available in local development environments and CI runners.
- Run scanner checks in CI on pull requests and pushes to protected branches.
- Treat scanner findings as merge blockers unless explicitly waived with rationale.

## North-star learning loop evidence

Before PR handoff, use imported CodeRabbit learning evidence to check whether
the change repeats known review friction. Run the loop when
`.harness/learnings/coderabbit.local.json` exists and the changed files are in
scope:

```bash
bash scripts/run-harness-gate.sh learnings gate --source .harness/learnings/coderabbit.local.json --files <changed-files> --json
bash scripts/run-harness-gate.sh review-context --source .harness/learnings/coderabbit.local.json --files <changed-files> --json
bash scripts/run-harness-gate.sh north-star-feedback --source .harness/learnings/coderabbit.local.json --json
```

The `--files` value accepts comma-separated paths or multiple following path
tokens. Promote durable high-usage findings into Project Brain as rules,
knowledge, decisions, or explicit skip reasons; do not copy every imported CSV
row into Project Brain.

If the repo has no imported learning artifact or the change is outside learning
scope, mark the PR template entries `n.a.` with a short reason. High-usage
repeat findings should become a validator, gate, scaffold regression,
generated-artifact rule, review-context fact, or explicit exception instead of
remaining a review comment.

## Work performed ledger

Every PR must keep `## Work performed` filled in with concrete evidence:

- `Plan IDs`: Linear keys, spec paths, plan paths, or `n.a.` with reason.
- `Phase / slice`: completed phase, implementation slice, or `n.a.` with reason.
- `Session IDs`: Codex, session-collector, or Harness Engineering session IDs, or `n.a.` with reason.
- `Trace IDs`: CI, harness, eval, review, or runtime trace IDs, or `n.a.` with reason.
- `Completed work`: implementation units, docs/config changes, or evidence-only work completed in the PR.
- `Documentation impact`: root docs, governed docs, and deep-module README changes, or `n.a.` with reason.
- `Documentation lifecycle impact`: created, updated, deprecated, superseded, archived, removed, or `n.a.` with canon and distribution classification.
- `SemVer impact`: none, patch, minor, major, or `n.a.` with downstream-template or packaged-skill impact when present.
- `Acceptance trace`: completed acceptance items mapped to evidence refs, or `n.a.` with reason.
- `Validation evidence`: command outcomes, CI jobs, artifact paths, or `n.a.` with reason.
- `Review artifacts`: CodeRabbit, Codex, reviewer, or harness review artifacts, or `n.a.` with reason.
- `Learning / reinforcement`: promoted learnings, memory updates, or `none` with reason.
- `Deferred work`: follow-up work intentionally left out, or `none`.

Use this section as the compact handoff ledger. It should say what was actually done, which sessions and traces produced the evidence, what was promoted into durable learning, and what remains, not repeat the full implementation story.

## Review artifacts requirement

Each PR must include:

- CodeRabbit review artifact (URL, report, or comment reference).
- Codex review artifact (URL, report, or comment reference).
- Confirmation that reviewer agent is independent from coding agent.

If a required review artifact is missing, block merge until it is added or explicitly waived by repository policy.

## Credential-safe evidence snippets

- Never use command substitution in commit messages, PR bodies, or evidence notes for secrets.
- Do **not** use `$(gh auth token)` (or similar) inside `git commit -m ...` / `gh pr create --body ...`.
- Use placeholders in text output:
  - ✅ `$GITHUB_TOKEN`
  - ✅ `${GITHUB_TOKEN}`
  - ❌ expanded token values
- If a token value is ever exposed in commit/PR text, treat it as compromised: rotate/revoke, rewrite history where applicable, and document remediation in the issue/PR.

## Action review governance

This repository uses `action-review-receipt/v1` as a narrow guardian-style receipt contract for high-risk actions. When making changes to action-review governance:

- **High-risk action envelopes** (merge, release, destructive cleanup, external tracker mutation) must require current evidence refs and head SHA where the action touches repository or PR state
- **Reviewer independence**: reviewer identity must not match the requested actor or producer identity (no self-approval)
- **Canonical actor identity separation**: reviewer and requester canonical identity refs must differ (not just display alias differences)
- **Decision semantics**: allow, block, mismatch, unknown, not applicable; `not_applicable` is forbidden for high-risk action kinds
- **Docs-gate requirement**: these companion documentation surfaces must be updated in the same PR as any action-review governance change
- **Architecture diagrams**: reference `AI/context/diagram-context.md` for required diagrams

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
  - `pr-pipeline`
  - `security-scan`
  - `CodeRabbit`
  - `semgrep-cloud-platform/scan`
- Require branches to be up to date before merge.
- Require code quality results with severity `all`.
- In public repositories, require `CodeQL` code scanning results with `high_or_higher` security alerts and `errors` alerts thresholds.
- Allow merge commits, squash merges, and rebase merges.
- Require workflows to pin third-party actions to full commit SHAs.
- Configure required checks workflows to run on both `pull_request` and `merge_group` when using merge queue.
- Block direct pushes to `main`.
