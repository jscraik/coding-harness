# Tooling Inventory

This document is the repo-local tooling inventory validated by
[`scripts/check-environment.sh`](../../scripts/check-environment.sh).
It intentionally covers only tooling that is enforced by checks in this project.

## Table of Contents

- [Purpose](#purpose)
- [Pinned Mise Tools](#pinned-mise-tools)
- [Required CLI Binaries](#required-cli-binaries)
- [Required Codex Actions](#required-codex-actions)
- [Verification](#verification)

## Purpose

Keep this file aligned with:

- [`.mise.toml`](../../.mise.toml)
- [`.codex/environments/environment.toml`](../../.codex/environments/environment.toml)
- [`scripts/check-environment.sh`](../../scripts/check-environment.sh)

If any required tool, binary, or action changes in checks, update this file in
the same change.

## Pinned Mise Tools

Required `[tools]` entries in [`.mise.toml`](../../.mise.toml):

- `node`
- `pnpm`
- `python`
- `uv`
- `cargo:prek`
- `npm:@brainwav/diagram`
- `npm:@argos-ci/cli`
- `cosign`
- `cloudflared`
- `npm:vitest`
- `ruff`
- `npm:eslint`
- `npm:agent-browser`
- `npm:agentation`
- `npm:agentation-mcp`
- `npm:@mermaid-js/mermaid-cli`
- `npm:@brainwav/rsearch`
- `npm:@brainwav/wsearch-cli`
- `npm:beautiful-mermaid`
- `npm:markdownlint-cli2`
- `npm:semver`
- `npm:wrangler`
- `semgrep`
- `trivy`
- `vale`

## Required CLI Binaries

Required binaries on `PATH` validated by
[`scripts/check-environment.sh`](../../scripts/check-environment.sh):

- `pnpm`
- `node`
- `jq`
- `make`
- `rg`
- `fd`
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
- `agentation-mcp`
- `mmdc`
- `markdownlint-cli2`
- `wrangler`
- `beautiful-mermaid`
- `semgrep`
- `semver`
- `trivy`
- `rsearch`
- `wsearch`

## Required Codex Actions

Required action and icon mappings in
[`.codex/environments/environment.toml`](../../.codex/environments/environment.toml):

- `Tools` -> `tool`
- `Run` -> `run`
- `Debug` -> `debug`
- `Test` -> `test`
- `Prek` -> `test`
- `Diagram` -> `tool`
- `Ralph` -> `debug`
- `Mise` -> `tool`
- `Vale` -> `debug`
- `Argos` -> `test`
- `Cosign` -> `debug`
- `Cloudflared` -> `run`
- `Vitest` -> `test`
- `Ruff` -> `debug`
- `ESLint` -> `debug`
- `Agent Browser` -> `tool`
- `Agentation` -> `tool`
- `Mermaid CLI` -> `tool`
- `MarkdownLint` -> `debug`
- `Wrangler` -> `run`
- `1Password` -> `tool`
- `Beautiful Mermaid` -> `tool`
- `Auth0` -> `tool`
- `Semgrep` -> `debug`
- `Semver` -> `tool`
- `Trivy` -> `debug`
- `Gitleaks` -> `debug`
- `Research` -> `tool`
- `WSearch` -> `tool`

## Verification

Run the canonical check after any tooling changes:

```bash
bash scripts/check-environment.sh
```
