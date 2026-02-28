# Coding Harness

Coding Harness is a TypeScript control plane for agentic development and policy-driven review workflows.

## Table of Contents

- [Quick start](#quick-start)
- [Template update workflow](#template-update-workflow)
- [Agent setup (recommended)](#agent-setup-recommended)
- [Quality checks](#quality-checks)
- [CLI command index](#cli-command-index)
- [Release flow](#release-flow)

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

## Template update workflow

Running `harness init --track` installs (in addition to policy templates):

- `.github/workflows/harness-update-check.yml`
- `.harness/restore-manifest.json`

That workflow checks for installed template drift:

1. `harness init --check-updates`
2. If updates are available, `harness init --update`
3. If files changed, it opens a maintenance PR automatically.

Manual run:

```bash
gh workflow run harness-update-check.yml
```

Notes:

- Uses the repository package-manager command detected from lockfiles (`pnpm`, `yarn`, or `npm`).
- Needs `GITHUB_TOKEN` for branch creation, push, and PR creation.
- Update checks only work after an initial `--track` install (which writes `.harness/restore-manifest.json`).

## Agent setup (recommended)

Use the machine-readable playbook:

- `docs/agents/harness-onboarding-playbook.json`

That file is the step-by-step source of truth for agents and references diagrams from
`AI/context/diagram-context.md` and `.diagram/diagrams/*.mmd` for onboarding context.

Agents should execute only the commands in the playbook that match the detected project type
(via `execution_policy.project_profiles`), skipping Node-only commands for non-Node repos
and vice-versa.  
Within that filtered set, commands marked `required: true` in the playbook are critical
and must be treated as hard-gates; `required: false` commands are best-effort and may be
skipped when tooling or environment is not available.
Recovery entries are also command objects in this playbook and now include `required`
to keep rollback behavior explicit.

When you are onboarding a repo for agent workflows, use this baseline sequence:

1. Ensure the repo is in a clean git state.
2. Verify package manager lockfiles are present (`pnpm-lock.yaml`, `yarn.lock`, or `package-lock.json`).
3. Run:

   ```bash
   pnpm exec tsx src/cli.ts init --track
   # or: harness init --track
   ```

4. Verify installation:

   ```bash
   pnpm exec tsx src/cli.ts init --check-updates
   # or: harness init --check-updates
   ls -la .github/workflows/
   cat .harness/restore-manifest.json
   ```

5. Run repo baseline checks:

   ```bash
   pnpm check
   ```

6. Commit generated files and open repo checks:

   - `harness.contract.json`
   - `.github/workflows/pr-pipeline.yml`
   - `.github/workflows/harness-update-check.yml`
   - `.harness/restore-manifest.json` (included when using `--track`)

If drift appears later, update with:

```bash
pnpm exec tsx src/cli.ts init --update
# or: harness init --update
```

For quick recovery:

```bash
pnpm exec tsx src/cli.ts init --rollback
# or: harness init --rollback
```

## Quality checks

```bash
pnpm check
```

## CLI command index

| Command | Purpose |
| --- | --- |
| `init` | Install harness files into the current repository. Includes `--check-updates` and `--update` flows for template maintenance. |
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

`blast-radius` can be run with a custom per-repo rule set in `harness.contract.json`:

```bash
harness blast-radius --files src/ui/Button.tsx --contract harness.contract.json
```

When `blastRadiusRules` is defined in the contract, those rules are used instead of the built-in defaults.

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
- After trusted publisher setup, OIDC is now the default path. Set
  repository variable `NPM_PUBLISH_AUTH=oidc` to use OIDC for tag-triggered
  releases.
- You can still force token mode in manual dispatch with
  `publish_auth: token`, and force OIDC with `publish_auth: oidc` when needed.

Example manual OIDC run (after trusted publisher is configured):

```bash
gh workflow run release-private-npm.yml \
  -f confirm=release \
  -f publish_auth=oidc
```
