/**
 * Repository document scaffold template rendering for downstream repositories.
 *
 * This module owns the long-form documentation and hook-runner config templates
 * emitted by `harness init`.
 *
 * @module lib/init/scaffold-doc-templates
 */

import {
	REQUIRED_PREK_HOOKS,
	REQUIRED_PREK_INSTALL_HOOK_TYPES,
} from "../policy/tooling-baseline.js";

type ContributingTemplateOptions = {
	addCommand: string;
	agentBranchPrefix: string;
	checkCommand: string;
	codestyleCommand: string;
	installCommand: string;
	isCircleCI: boolean;
	localExecCommand: string;
	memoryValidateCommand: string;
	requiredChecksList: string;
};

type PullRequestTemplateOptions = {
	agentBranchPrefix: string;
	checkCommand: string;
	codestyleCommand: string;
	memoryValidateCommand: string;
};

/**
 * Render the downstream `CONTRIBUTING.md` scaffold.
 *
 * @param options - Commands and policy-derived text to embed in the document.
 * @returns Markdown contents for `CONTRIBUTING.md`.
 */
export function renderContributingTemplate(
	options: ContributingTemplateOptions,
): string {
	const testArtifactTocEntry = options.isCircleCI
		? "- [Test runner artifact configuration](#test-runner-artifact-configuration)\n"
		: "";
	return `${renderContributingWorkflowContract(options, testArtifactTocEntry)}
${renderRequiredToolingBaseline()}
${renderContributingProjectBrainAndWrappers(options)}
${renderContributingSecurityAndReview(options)}`;
}

function renderContributingWorkflowContract(
	options: ContributingTemplateOptions,
	testArtifactTocEntry: string,
): string {
	return `# Contributing

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
${testArtifactTocEntry}- [Review artifacts requirement](#review-artifacts-requirement)
- [Credential-safe evidence snippets](#credential-safe-evidence-snippets)
- [Branch protection recommendation](#branch-protection-recommendation)

## Minimum workflow contract

- Branch off \`main\` for every change.
- No direct push to \`main\`.
- Pull request required for every merge.
- Required checks must pass before merge.
- CodeRabbit + Codex review artifacts are required before merge.
- The coding agent must not approve its own PR; review must be independent.
- Merge only after all gates pass.
- Delete branch/worktree after merge.

## Why this workflow exists

This workflow keeps delivery auditable, reversible, and consistent even for solo development.

## Branching and PR rule

1. Create a dedicated branch/worktree for each task:
   - Agent-created branch: \`git switch -c ${options.agentBranchPrefix}/<issue-key>-<short-description>\`
   - Agent-created worktree: \`git worktree add ../tmp-worktree -b ${options.agentBranchPrefix}/<issue-key>-<short-description>\`
   - Human-authored branch prefixes (when not using \`${options.agentBranchPrefix}/\`): \`feat/\`, \`fix/\`, \`docs/\`, \`refactor/\`, \`chore/\`, \`test/\`
2. Keep commits small and focused.
3. Open a PR to merge into \`main\`.
4. Do not merge until checks, reviews, and checklist items are complete.
5. After merge, delete the remote branch and remove local worktree/branch.

## Branch name policy

- Use lower-case, kebab-case slugs.
- Agent-created branches must use \`${options.agentBranchPrefix}/<issue-key>-<short-description>\`.
- Human-authored branches may use: \`feat/\`, \`fix/\`, \`docs/\`, \`refactor/\`, \`chore/\`, \`test/\`.
- Avoid \`main\`-like names and do not include secrets or issue-pii.

## Required pre-merge gates

- ${options.codestyleCommand}
- ${options.checkCommand}
- ${options.memoryValidateCommand}
`;
}

function renderRequiredToolingBaseline(): string {
	return `
## Required tooling baseline

Harness-managed repositories should keep this baseline available locally before claiming the repo is ready:

- \`prek\`
- \`diagram\`
- \`mise\`
- \`vale\`
- \`argos\`
- \`cosign\`
- \`cloudflared\`
- \`vitest\`
- \`ruff\`
- \`eslint\`
- \`agent-browser\`
- \`agentation\` (backed by the \`agentation-mcp\` CLI)
- \`mermaid-cli\` (via the \`mmdc\` CLI)
- \`markdownlint-cli2\`
- \`wrangler\`
- \`beautiful-mermaid\`
- \`semgrep\`
- \`semver\`
- \`trivy\`
- \`rsearch\` (arXiv research)
- \`wsearch\` (Wikidata search)

Recommended policy:

- Pin repo-managed tooling in \`.mise.toml\` where possible.
- Treat \`scripts/codex-preflight.sh\` as required project bootstrap infrastructure.
- Treat \`CODESTYLE.md\`, \`codestyle/\`, \`codestyle/CHECKSUMS.sha256\`, and \`scripts/validate-codestyle.sh\` as required repo-local contract files.
- Keep the full codestyle pack as real repo-local files in generated repositories, including \`CODESTYLE.md\` plus all \`codestyle/*.md\` modules.
- Scaffold \`scripts/codex-enforced\` and \`scripts/codex-learn\` together with preflight so repo-local wrappers own repo-local state.
- Keep \`bash scripts/codex-preflight.sh --stack auto --mode required\` as the default preflight command; only relax mode (\`optional\` or \`off\`) when the project documents why.
- Adjust preflight binary/path lists per project scope instead of deleting the script.
- Keep repo-scoped telemetry and learned overrides under \`.harness/memory/\`, and global telemetry under \`~/.codex/\`.
- Treat \`scripts/verify-work.sh\` as the canonical repo-facing verification command and keep it wired to repo-local preflight defaults.
- Treat \`scripts/check-codestyle-parity.sh\` as the fail-closed codestyle parity gate and require exact proof-of-pass in change summaries and PRs.
- Treat \`scripts/validate-codestyle.sh\` as the fail-closed codestyle validation gate and require exact proof-of-pass in change summaries and PRs.
- When executable behavior changes, run the smallest real code path that exercises the exact production code touched before claiming verification.
- Prefer invoking production functions, classes, CLI commands, shell scripts, validators, or routes directly. If no existing test covers the path, create a temporary reproduction harness under \`codex-scripts/\` and keep that directory gitignored.
- If the exact path cannot run because of unavailable credentials, external services, unsafe side effects, or missing generated state, record the blocker clearly, run the nearest meaningful validation, and do not describe production behavior as verified unless the touched path actually ran.
- Treat \`scripts/new-task.sh\` as the canonical task-entry helper so each task starts with a repo-local branch/worktree boundary instead of branch switching inside a shared checkout.
- Treat \`scripts/new-task.sh\` as an upstream-sync helper that fetches \`origin/<base>\` only when local refs do not already resolve the requested base.
- Treat \`scripts/prepare-worktree.sh\` as required first-push bootstrap for freshly created worktrees so local hooks run with dependencies, canonical hook wiring, and detached-head fast-forwarding to latest \`origin/main\`.
- Treat \`scripts/check-git-common-config.sh\` as the shared Git config guard; shared non-bare \`.git/config\` must not contain \`core.worktree\`.
- Treat \`scripts/check-environment.sh\` as the local readiness gate for required tooling.
- Block merge or promotion work when a required CLI is missing rather than silently skipping the corresponding validation lane.
- For repositories with explicit \`ui\` / \`chatgpt_apps_sdk\` capabilities or matching dependency signals, install \`@brainwav/design-system-guidance\` and treat its absence as a readiness failure.
`;
}

function renderContributingProjectBrainAndWrappers(
	options: ContributingTemplateOptions,
): string {
	return `
## Project Brain workflow

- \`harness init\` scaffolds a Project Brain baseline under \`.harness/\`:
  - \`.harness/README.md\` as the tracked control-plane map and selective tracking policy.
  - \`knowledge/INDEX.md\`, domain folders (\`cli\`, \`ci\`, \`governance\`, \`tooling\`), \`decisions/\`, \`quality/criteria.md\`, and \`review-log.md\`.
  - \`.harness/memory/LEARNINGS.md\` as the repo-scoped learned-fixes ledger.
- Track curated Markdown and JSON contract files under \`.harness\`; ignore runtime, backup, database, cache, and bulk snapshot output.
- Treat \`.harness/review\`, \`.harness/strategy\`, \`.harness/triage\`, \`.harness/features\`, \`.harness/ideate\`, and \`.harness/brainstorm\` as secondary context until an admitted \`.harness/linear\`, \`.harness/refactors\`, \`.harness/specs\`, or \`.harness/plan\` slice references them.
- Repo-local preflight treats the Project Brain scaffold as required baseline paths.
- Run \`./scripts/codex-learn analyze\` to generate suggestions and refresh \`.harness/knowledge/tooling/codex-learn-summary.md\`.
- Promote repeated patterns into \`rules.md\` after 3+ confirmations; keep uncertain patterns in \`hypotheses.md\`.

## Repo-local verification wrapper

- \`harness init\` scaffolds \`scripts/verify-work.sh\` as the canonical repo-local verification entrypoint.
- The wrapper always runs \`scripts/codex-preflight.sh\` in \`required\` Local Memory mode with scaffold-safe path and binary expectations.
- \`scripts/check-codestyle-parity.sh\` is the canonical codestyle parity gate and is reused by \`verify-work\`, local hooks, and downstream repo docs.
- \`scripts/validate-codestyle.sh\` is the canonical fail-closed codestyle validation gate and is reused by \`verify-work\`, local hooks, and downstream repo docs.
- \`scripts/new-task.sh\` is the canonical task bootstrap helper. Use it to create one task = one worktree = one branch = one agent thread inside the project itself.
- \`scripts/check-git-common-config.sh\` guards shared Git config before preflight, verification, and worktree bootstrap. Shared non-bare \`.git/config\` must not contain \`core.worktree\`; worktree-local values must use per-worktree config.
- Repo-local launches should prefer \`./scripts/codex-enforced\` so preflight failures are recorded into repo-scoped learn state.
- \`scripts/codex-enforced\` should guard \`main\` by auto-creating a dedicated task worktree (via \`scripts/new-task.sh --bootstrap\`) before launching Codex for feature work.
- Use \`./scripts/codex-learn analyze\` and \`./scripts/codex-learn apply\` to inspect repo-scoped failure patterns and write override files into \`.harness/memory/\`.
- Start new work with \`bash scripts/new-task.sh <issue-key>-<slug>\`, then enter the generated worktree and continue there.
- Use \`bash scripts/new-task.sh --bootstrap <issue-key>-<slug>\` when you want to create and bootstrap the worktree in one command.
- Use \`bash scripts/validate-codestyle.sh --fast\` during iteration for focused codestyle validation.
- When executable behavior changes, run the smallest real code path that exercises the exact production code touched before claiming verification.
- Prefer production functions, classes, CLI commands, shell scripts, validators, or routes directly. If no existing test covers the path, create a temporary reproduction harness under \`codex-scripts/\`, keep it gitignored, and import or invoke production code instead of copying implementation into the harness.
- If the exact path cannot run because of unavailable credentials, external services, unsafe side effects, or missing generated state, record the blocker clearly and run the nearest meaningful validation instead.
- Use \`bash scripts/validate-codestyle.sh\` before handoff for the fail-closed codestyle bundle.
- Use \`bash scripts/verify-work.sh\` for the broader verification bundle.
- Use \`bash scripts/verify-work.sh --fast\` for preflight + codestyle fast lane coverage.
- Before the first push from a fresh worktree, run \`bash scripts/prepare-worktree.sh\` to ensure detached checkouts are attached and fast-forwarded to latest \`origin/main\`.
- Generated \`.codex/environments/environment.toml\` setup and \`Tools\` actions should invoke \`scripts/prepare-worktree.sh\` when available so Codex app bootstrap matches manual worktree setup.

## Repo-local harness wrapper

- \`harness init\` also scaffolds \`scripts/harness-cli.sh\` for repositories that want a repo-local wrapper around the published CLI package.
- The wrapper resolves \`@brainwav/coding-harness/dist/cli.js\` from the current repository before running any harness command.
- \`scripts/run-harness-gate.sh\` treats source checkouts as fail-closed when \`pnpm\`/\`tsx\` are unavailable so gates do not silently fall back to stale binaries.
- If the wrapper cannot resolve the package, treat that as local install/bootstrap drift rather than a harness command failure.
- Repair from the repo root with:
  - \`${options.installCommand}\`
  - \`${options.addCommand}\`
- After repair, rerun:
  - \`bash scripts/harness-cli.sh <command>\`
  - \`${options.localExecCommand} <command>\`
`;
}

function renderContributingSecurityAndReview(
	options: ContributingTemplateOptions,
): string {
	const reviewArtifactsLines = `- CodeRabbit review artifact (URL, report, or comment reference).
- Codex review artifact (URL, report, or comment reference).
- Confirmation that reviewer agent is independent from coding agent.
`;
	return `
## Recommended security scanner baseline

For repositories that use Harness, recommend installing these scanners as project prerequisites:

- Gitleaks
- Trivy
- Semgrep

Recommended policy:

- Keep scanner binaries available in local development environments and CI runners.
- Run scanner checks in CI on pull requests and pushes to protected branches.
- Treat scanner findings as merge blockers unless explicitly waived with rationale.
${
	options.isCircleCI
		? `
## Test runner artifact configuration

CI pipelines collect test results and artifacts from the \`artifacts/test-results\` directory. Your test framework must be configured to emit JUnit XML reports (or other supported formats) to this location.

Example configurations:

- **Vitest**: \`vitest --reporter=junit --outputFile=artifacts/test-results/junit.xml\`
- **Jest**: Configure \`jest.config.js\` with \`reporters: [['jest-junit', { outputDirectory: 'artifacts/test-results', outputName: 'junit.xml' }]]\`
- **Mocha**: \`mocha --reporter mocha-junit-reporter --reporter-options mochaFile=artifacts/test-results/junit.xml\`

Ensure \`artifacts/test-results\` is created before running tests (CI scaffolds include a step for this).
`
		: ""
}
## Review artifacts requirement

Each PR must include:

${reviewArtifactsLines}
If a required review artifact is missing, block merge until it is added or explicitly waived by repository policy.

## Credential-safe evidence snippets

- Never use command substitution in commit messages, PR bodies, or evidence notes for secrets.
- Do **not** use \`$(gh auth token)\` (or similar) inside \`git commit -m ...\` / \`gh pr create --body ...\`.
- Use placeholders in text output:
  - ✅ \`$GITHUB_TOKEN\`
  - ✅ \`\${GITHUB_TOKEN}\`
  - ❌ expanded token values
- If a token value is ever exposed in commit/PR text, treat it as compromised: rotate/revoke, rewrite history where applicable, and document remediation in the issue/PR.

## Branch protection recommendation

Configure GitHub branch protection (or rulesets) on \`main\`:

- Bootstrap baseline via harness:
  - \`harness branch-protect --owner <owner> --repo <repo>\`
- Token resolution for \`branch-protect\`:
  - \`--token <PAT>\` or env \`GITHUB_TOKEN\` / \`GITHUB_PERSONAL_ACCESS_TOKEN\`
- Require pull request before merge.
- Allow \`0\` required reviewers for solo-maintainer repositories.
- Dismiss stale approvals when new commits are pushed.
- Require conversation resolution before merge.
- Restrict branch deletions.
- Block force pushes.
- Require linear history.
- Require status checks:
${options.requiredChecksList}
- Require branches to be up to date before merge.
- Require code quality results with severity \`all\`.
- In public repositories, require \`CodeQL\` code scanning results with \`high_or_higher\` security alerts and \`errors\` alerts thresholds.
- Allow merge commits, squash merges, and rebase merges.
- Require workflows to pin third-party actions to full commit SHAs.
- Configure required checks workflows to run on both \`pull_request\` and \`merge_group\` when using merge queue.
- Block direct pushes to \`main\`.
`;
}

/**
 * Render the downstream GitHub pull request template scaffold.
 *
 * @param options - Commands to embed in the verification checklist.
 * @returns Markdown contents for `.github/PULL_REQUEST_TEMPLATE.md`.
 */
export function renderPullRequestTemplate(
	options: PullRequestTemplateOptions,
): string {
	const codeRabbitChecklist = `- [ ] CodeRabbit review completed and findings handled (or explicitly waived).
- [ ] CodeRabbit review was performed by an independent reviewer (not the coding agent).
`;
	const codeRabbitArtifacts = `- CodeRabbit: <link / artifact path / comment ID>
- Independent reviewer evidence: <reviewer + link>
`;
	return `# Pull request checklist

## Summary

- What changed (brief):
- Why this change was needed:
- Risk and rollback plan:

## Checklist

- [ ] I did not push directly to \`main\`; this PR is from a dedicated branch.
- [ ] Branch name follows policy (\`${options.agentBranchPrefix}/*\` for agent-created branches).
- [ ] Required local gates run: \`${options.codestyleCommand}\`, \`${options.checkCommand}\`, \`${options.memoryValidateCommand}\`.
${codeRabbitChecklist}- [ ] Codex review completed and findings handled (or explicitly waived).
- [ ] Any CodeRabbit Semgrep findings were either fixed or explicitly justified when warning-level-only.
- [ ] Merge is blocked until all required checks pass.
- [ ] I will delete branch/worktree after merge.

## Testing

- verification_commands: list exact commands run here
- verification_outcomes: record pass/fail/blocked for each command here
- blocked_steps_reason: none if all planned steps ran
- Command: \`${options.codestyleCommand}\` -> pass/fail
- Command: \`${options.checkCommand}\` -> pass/fail
- Command: \`${options.memoryValidateCommand}\` -> pass/fail
- Any other command(s):

## Review artifacts

${codeRabbitArtifacts}- Codex: <link / artifact path / comment ID>
- CodeRabbit Semgrep: fixed / waived with rationale / n.a.
- Additional evidence (if any):

## Notes

Add one-paragraph merge rationale here.
`;
}

/**
 * Render the downstream `prek.toml` scaffold.
 *
 * @returns TOML contents for `prek.toml`.
 */
export function renderPrekConfigTemplate(): string {
	return `# Prek configuration (Rust-based pre-commit replacement)
# Install prek: mise install cargo-prek || cargo install prek
# Run: prek install --overwrite && prek run --all-files

default_install_hook_types = [${REQUIRED_PREK_INSTALL_HOOK_TYPES.map((hookType) => `"${hookType}"`).join(", ")}]

[[repos]]
repo = "local"

[[repos.hooks]]
id = "pre-commit"
name = "${REQUIRED_PREK_HOOKS["pre-commit"].name}"
entry = "${REQUIRED_PREK_HOOKS["pre-commit"].entry}"
language = "${REQUIRED_PREK_HOOKS["pre-commit"].language}"
pass_filenames = ${String(REQUIRED_PREK_HOOKS["pre-commit"].pass_filenames)}

[[repos.hooks]]
id = "pre-push"
name = "${REQUIRED_PREK_HOOKS["pre-push"].name}"
entry = "${REQUIRED_PREK_HOOKS["pre-push"].entry}"
language = "${REQUIRED_PREK_HOOKS["pre-push"].language}"
pass_filenames = ${String(REQUIRED_PREK_HOOKS["pre-push"].pass_filenames)}
stages = ${JSON.stringify(REQUIRED_PREK_HOOKS["pre-push"].stages)}
`;
}
