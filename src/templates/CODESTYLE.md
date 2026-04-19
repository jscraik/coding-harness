# CODESTYLE.md

## Purpose

This file is the codestyle front door for the `codex/` subtree.
Use it to locate the right standards module quickly.
For technical work under `codex/`, read this file before deeper instruction modules.

Detailed standards are split under [codestyle/README.md](./codestyle/README.md).

## Table of Contents
- [Baselines](#baselines)
- [Codestyle modules](#codestyle-modules)
- [Enforcement model](#enforcement-model)
- [How to use this pack](#how-to-use-this-pack)

## Baselines
- JS/TS toolchain: Biome, ESLint v9 (flat config), TypeScript typecheck, Vitest/Node test.
- Docs: Vale.
- Python: Ruff, Pyright, pytest.
- Rust: rustfmt, Clippy, cargo test.
- Security/policy: Semgrep, policy guards, supply-chain tooling.
- Node baseline: repository engine floor `>=24.0.0` from `package.json`; runtime selection follows `.mise.toml`.
- TypeScript baseline: >= 5.9 (when TS is used).
- Rust baseline: 2024 edition (rustc >= 1.85).
- Security advisories override baselines: patch immediately when a baseline dependency has a published fix.

## Codestyle modules
- [codestyle/01-foundations.md](./codestyle/01-foundations.md)
- [codestyle/02-javascript-ui.md](./codestyle/02-javascript-ui.md)
- [codestyle/03-rust-tauri.md](./codestyle/03-rust-tauri.md)
- [codestyle/04-docs-config-and-release.md](./codestyle/04-docs-config-and-release.md)
- [codestyle/05-quality-security-ops.md](./codestyle/05-quality-security-ops.md)
- [codestyle/06-appendices-and-project-overrides.md](./codestyle/06-appendices-and-project-overrides.md)
- [codestyle/07-python.md](./codestyle/07-python.md)
- [codestyle/08-typescript.md](./codestyle/08-typescript.md)
- [codestyle/09-web.md](./codestyle/09-web.md)
- [codestyle/10-shell-bash-zsh.md](./codestyle/10-shell-bash-zsh.md)
- [codestyle/11-package-managers-pnpm-npm.md](./codestyle/11-package-managers-pnpm-npm.md)
- [codestyle/12-swift.md](./codestyle/12-swift.md)
- [codestyle/13-git-workflow.md](./codestyle/13-git-workflow.md)
- [codestyle/14-patterns.md](./codestyle/14-patterns.md)
- [codestyle/15-performance.md](./codestyle/15-performance.md)
- [codestyle/16-security.md](./codestyle/16-security.md)
- [codestyle/17-testing.md](./codestyle/17-testing.md)
- [codestyle/18-code-review.md](./codestyle/18-code-review.md)
- [codestyle/19-development-workflow.md](./codestyle/19-development-workflow.md)

## Enforcement model
- Rules in this pack use RFC2119 language (`MUST`, `MUST NOT`, `SHOULD`) and are normative unless an explicit waiver exists.
- Waivers MUST include: rule ID or section, reason, tracking ticket, and expiry or ADR reference.
- Validation evidence MUST use exact command text and explicit outcomes:
  - `Command: <exact command> -> pass|fail|blocked (<reason>)`
- Commands are expected from the active instruction scope.
- For this repository, run from the repository root and use `bash scripts/...` paths.
- Contract checks for this repository:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm audit`
  - `pnpm check`
  - `bash scripts/validate-codestyle.sh`
  - `bash scripts/verify-work.sh --fast`

## How to use this pack
1. Start at this file.
2. Open only the module that matches the task surface.
3. Keep project-specific override content in `06-appendices-and-project-overrides.md`.
4. When changing standards, update the module first, then confirm this index still matches.
