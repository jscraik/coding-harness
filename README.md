# Coding Harness

Coding Harness is a TypeScript control plane for agentic development and policy-driven review workflows.

## Table of Contents

- [Quick start](#quick-start)
- [Quality checks](#quality-checks)
- [Recommended security scanner baseline](#recommended-security-scanner-baseline)
- [Issue reporting (internal)](#issue-reporting-internal)
- [CLI command index](#cli-command-index)
- [Release flow](#release-flow)
- [Contributing](#contributing)

## Quick start

```bash
pnpm install
pnpm build
node dist/cli.js --help
```

For local iteration without building first:

```bash
pnpm exec tsx src/cli.ts --help
```

## Quality checks

```bash
pnpm check
```

## Recommended security scanner baseline

When Harness is installed in a repository, recommend installing these scanners in that project:

- Gitleaks
- Trivy
- Senvar (if your organization uses it)
- Semgrep

These should be available in local dev and CI to keep security checks consistent.
Harness `init` templates enforce this via a required `security-scan` PR check.

## Issue reporting (internal)

This package and repository are private. Report bugs at:

- <https://github.com/jscraik/coding-harness/issues>

Internal agents may create issues directly when `GITHUB_PERSONAL_ACCESS_TOKEN` is loaded from `~/.claude.env` and/or `~/.codex/.env`.
If a tool expects `GITHUB_TOKEN`, map it from `GITHUB_PERSONAL_ACCESS_TOKEN` in your shell/session environment.

## CLI command index

| Command | Purpose |
| --- | --- |
| `init` | Install harness contract + PR governance templates into the current repository. |
| `risk-tier` | Classify changed files by risk. |
| `policy-gate` | Validate policy expectations from changed files. Alias: `risk-policy-gate`. |
| `replay` | Re-run policy checks from saved snapshots. |
| `evidence-verify` | Validate screenshot/evidence artifacts. |
| `gardener` | Detect stale docs and broken links. |
| `memory-gate` | Validate local-memory workflow compliance. |
| `preflight-gate` | Run fast policy checks before expensive operations. |
| `silent-error` | Detect silent error handling anti-patterns. |
| `diff-budget` | Enforce diff budget constraints. |
| `review-gate` | Enforce review checks and SHA guardrails. |
| `branch-protect` | Configure/maintain branch protection rulesets and required status checks. |
| `brainstorm-gate` | Validate brainstorm artifacts. |
| `plan-gate` | Validate plan artifacts. |
| `prompt-gate` | Validate prompt template usage. |
| `blast-radius` | Determine required checks from changed files. |
| `observability-gate` | Check metrics cardinality limits. |
| `ui:fast` | Run Storybook-first local UI loop. |
| `ui:verify` | Run Playwright smoke tests with evidence. |
| `ui:explore` | Run exploratory browser workflow. |
| `context` | Search indexed brainstorm/plan context. |
| `index-context` | Bulk index docs for semantic search. |
| `remediate` | Apply automated fixes for findings. |
| `check-authz` | Validate authorization policy for mutative operations. |
| `check-environment` | Validate pilot environment governance checks. |
| `gap-case` | Track and resolve pilot gap-cases. |
| `pilot-evaluate` | Evaluate pilot metrics and promotion readiness. |
| `pilot-rollback` | Transition pilot mode (autonomous <-> manual). |

Use `harness --help` (or `node dist/cli.js --help`) for the current global options surface.

## Documentation

- [Implementation Status Matrix](docs/roadmap/agent-first-status.md) - Roadmap claims vs current implementation status
- [Harness Implementation Plan](docs/HARNESS_IMPLEMENTATION_PLAN.md) - Architecture and phase-by-phase execution plan

## Release flow

The package publishes as a private npm package from tagged releases:

1. Update changelog and versioned release notes with:

   ```bash
   pnpm changelog
   ```

2. Cut the release commit and tag with:

   ```bash
   pnpm release
   ```

   This runs `standard-version` using `CHANGELOG.md` conventions.

3. Push the tag to trigger CI publish:

   ```bash
   git push --follow-tags
   ```

4. The GitHub workflow `release-private-npm.yml` publishes to npm.

### Publish auth modes

- Bootstrap: use `NPM_TOKEN` secret via `publish_auth: token`.
- OIDC trusted publisher: set repo variable `NPM_PUBLISH_AUTH=oidc`
  (or run manual dispatch with `publish_auth: oidc`).
- Current workflow defaults: automatic tag releases now use OIDC by default.

Example manual OIDC run (after trusted publisher is configured):

```bash
gh workflow run release-private-npm.yml \
  -f confirm=release \
  -f publish_auth=oidc
```

## Contributing

- Read `CONTRIBUTING.md` before making code changes.
- Branching + PR workflow, required gates, and review expectations are documented there.
