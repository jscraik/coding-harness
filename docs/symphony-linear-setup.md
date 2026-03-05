# Symphony + Linear Setup for coding-harness

## Table of Contents
- [Purpose](#purpose)
- [Required values](#required-values)
- [One-time setup](#one-time-setup)
- [Verification](#verification)
- [Run Symphony](#run-symphony)
- [Notes](#notes)

## Purpose
This guide configures Linear so Symphony can dispatch coding-harness work using
the repository `WORKFLOW.md` contract.

## Required values
- `LINEAR_API_KEY`: personal API key from Linear.
- `SYMPHONY_WORKSPACE_ROOT`: absolute path for per-issue workspaces.
- Optional: `SOURCE_REPO_URL`, `CODEX_BIN`.

Linear resources provisioned via MCP (2026-03-04):
- Team: `brAInwav`
- Project: `Symphony Pilot - coding-harness` (`symphony-pilot-coding-harness-32d853352b38`)
- Label: `symphony`
- Seed issue: `BR-83`

## One-time setup
1. Create a Linear API key in Linear: **Settings → Security & access → Personal API keys**.
2. Pick the target project slug from the project URL
   (`https://linear.app/<workspace>/project/<slug>`).
3. Export environment variables:

   ```bash
   export LINEAR_API_KEY="<redacted>"
   export SYMPHONY_WORKSPACE_ROOT="/Users/jamiecraik/dev/symphony-workspaces"
   export SOURCE_REPO_URL="https://github.com/jscraik/coding-harness.git"
   export CODEX_BIN="codex"
   ```

4. Confirm repository workflow file exists:

   ```bash
   test -f WORKFLOW.md && echo "WORKFLOW.md ready"
   ```

## Verification
Run a lightweight Linear API probe:

```bash
curl -sSf https://api.linear.app/graphql \
  -H "Authorization: $LINEAR_API_KEY" \
  -H "Content-Type: application/json" \
  --data '{"query":"{ viewer { id name } }"}' | jq
```

Expected: valid JSON with `viewer.id` and `viewer.name`.

## Run Symphony
From the Symphony repo (`openai/symphony`), point to this repository workflow:

```bash
cd /path/to/symphony/elixir
mise install
mise exec -- mix setup
mise exec -- ./bin/symphony /Users/jamiecraik/dev/coding-harness/WORKFLOW.md
```

## Notes
- This repo currently uses `Todo` and `In Progress` as active execution states.
- Handoff is configured to `In Review` in the prompt contract.
- The workflow `after_create` hook now runs `mise trust` defensively to avoid `.mise.toml` trust failures in fresh workspaces.
- Keep secrets out of git; never commit live token values.
