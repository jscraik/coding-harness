# CODESTYLE.md

## Purpose

This file is the codestyle front door for the coding-harness repository and for
the codestyle pack emitted into harness-managed downstream repositories.
Use it to locate the right standards module quickly.
For technical work in this repository, read this file before deeper instruction modules.

Detailed standards are split under [codestyle/README.md](./codestyle/README.md).

## Table of Contents
- [Baselines](#baselines)
- [Toolchain config](#toolchain-config)
- [Codestyle modules](#codestyle-modules)
- [Enforcement model](#enforcement-model)
- [How to use this pack](#how-to-use-this-pack)

## Baselines
- JS/TS toolchain: Biome, TypeScript `tsc --noEmit`, Vitest/Node test, and ESLint only where a downstream project configures it.
- Docs: markdownlint plus Vale for the staged authoritative docs set.
- Python: Ruff, Pyright, pytest.
- Rust: rustfmt, Clippy, cargo test.
- Go: gofmt, go vet where configured, go test.
- Security/policy: Semgrep, policy guards, supply-chain tooling.
- Node baseline: repository engine floor `>=24.0.0` from `package.json`; runtime selection follows `.mise.toml`.
- TypeScript baseline: 5.9.x with NodeNext module semantics when TS is used.
- Rust baseline: 2024 edition (rustc >= 1.85).
- Security advisories override baselines: patch immediately when a baseline dependency has a published fix.

## Toolchain config
- `.mise.toml` is the canonical runtime and global CLI pin surface for this repository.
- `package.json` `packageManager` plus `pnpm-lock.yaml` are the canonical package-manager and dependency lock surfaces.
- `biome.json` is the canonical Biome formatter, assist, and style-lint configuration; run it through `pnpm lint`.
- `scripts/check-environment.sh` and `docs/agents/tooling.md` MUST stay aligned with `.mise.toml` whenever managed CLIs change.
- For this repository, `biome check` intentionally excludes the root `CODESTYLE.md` path; downstream packages should ship a real checked-in `CODESTYLE.md` file.

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
- [codestyle/20-go.md](./codestyle/20-go.md)

## Enforcement model
- Rules in this pack use RFC2119 language (`MUST`, `MUST NOT`, `SHOULD`) and are normative unless an explicit waiver exists.
- Waivers MUST include: rule ID or section, reason, tracking ticket, and expiry or ADR reference.
- Design corrections MUST be generalized before closeout when they imply a broader principle. If feedback says one boolean success/failure API should instead return a named sentinel error, the agent MUST search sibling APIs and tests in the same command core, adapter family, and affected docs/templates; then either update the shared pattern or record why each sibling is intentionally different.
- Specific implementation-detail feedback MUST be treated as systemic until proven isolated. Before finalizing the fix, classify the correction as local or systemic, search equivalent patterns in the same module family and affected governance surfaces, identify the underlying engineering preference, and decide whether the rule belongs in a validator, lint rule, schema constraint, shared utility, repository convention, CI check, documented invariant, or tracked exception.
- Validation evidence MUST use exact command text and explicit outcomes:
  - `Command: <exact command> -> pass|fail|blocked (<reason>)`
- Commands are expected from the active instruction scope and the repository root.
- Contract checks for this repository:
  - `pnpm codestyle:parity`
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
3. If user/review feedback corrects one line but implies a codebase rule, run the pattern-generalization pass before editing or claiming done.
4. Keep project-specific override content in `06-appendices-and-project-overrides.md`.
5. When changing standards, update the module first, then confirm this index still matches.
