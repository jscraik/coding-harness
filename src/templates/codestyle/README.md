# Codestyle Instruction Set

Use this directory for detailed coding standards. Keep [../CODESTYLE.md](../CODESTYLE.md) concise as the front door and route details to these focused modules.

## Table of Contents
- [Scope](#scope)
- [Modules](#modules)
- [Enforcement defaults](#enforcement-defaults)
- [Maintenance rules](#maintenance-rules)

## Scope
- This directory is the detailed, layered coding standards pack for the `codex/` subtree.
- `../CODESTYLE.md` remains the canonical entrypoint and link index.
- Technical work under `codex/` MUST route through `../CODESTYLE.md` before these modules.

## Modules
- [01-foundations.md](./01-foundations.md)
- [02-javascript-ui.md](./02-javascript-ui.md)
- [03-rust-tauri.md](./03-rust-tauri.md)
- [04-docs-config-and-release.md](./04-docs-config-and-release.md)
- [05-quality-security-ops.md](./05-quality-security-ops.md)
- [06-appendices-and-project-overrides.md](./06-appendices-and-project-overrides.md)
- [07-python.md](./07-python.md)
- [08-typescript.md](./08-typescript.md)
- [09-web.md](./09-web.md)
- [10-shell-bash-zsh.md](./10-shell-bash-zsh.md)
- [11-package-managers-pnpm-npm.md](./11-package-managers-pnpm-npm.md)
- [12-swift.md](./12-swift.md)
- [13-git-workflow.md](./13-git-workflow.md)
- [14-patterns.md](./14-patterns.md)
- [15-performance.md](./15-performance.md)
- [16-security.md](./16-security.md)
- [17-testing.md](./17-testing.md)
- [18-code-review.md](./18-code-review.md)
- [19-development-workflow.md](./19-development-workflow.md)

## Enforcement defaults
- Treat this directory as policy, not guidance: `MUST` and `MUST NOT` are enforced defaults.
- Temporary exceptions require a waiver with reason, tracker, and expiry/ADR reference.
- Record validation evidence using exact command lines and `pass|fail|blocked` outcomes.

## Maintenance rules
- Keep section numbering and titles stable unless there is a deliberate migration.
- Preserve authoritative contract references and update links when files move.
- Keep project-specific override guidance in `06-appendices-and-project-overrides.md`.
