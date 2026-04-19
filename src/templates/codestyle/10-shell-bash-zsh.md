# Shell Standards (Bash and Zsh)

## Table of Contents
- [Scope](#scope)
- [Execution model](#execution-model)
- [Bash](#bash)
- [Zsh](#zsh)
- [Safety and portability](#safety-and-portability)
- [Enforcement](#enforcement)

## Scope
- This module covers shell scripts, command snippets, and execution conventions for Bash and Zsh.

## Execution model
- Run commands with `zsh -lc` in automation-oriented workflows.
- Invoke scripts explicitly with `bash` when script contracts require Bash.
- Do not source CLI scripts unless a script explicitly documents sourcing as the intended mode.

## Bash
- Use explicit shebangs and strict mode for script files where compatible.
- Quote expansions by default and avoid unbounded globbing.
- Use `[[ ... ]]` tests and clear exit-code paths.

## Zsh
- Keep interactive helpers in Zsh-compatible syntax when targeting Zsh startup flows.
- Avoid Bash-only constructs in Zsh files unless compatibility is explicitly managed.
- Keep shell-init behavior deterministic and low-noise.

## Safety and portability
- Use `rg`, `fd`, and `jq` over slower or brittle text pipelines when possible.
- Validate required binaries and paths before destructive or multi-step operations.
- Never use destructive git commands without explicit intent and confirmation.

## Enforcement
- Shell workflow changes MUST pass:
  - `bash scripts/codex-preflight.sh --stack auto --mode required`
  - `bash scripts/validate-codestyle.sh`
  - `bash scripts/verify-work.sh --fast`
  - `pnpm lint`
  - `pnpm test`
- Shell snippets in docs MUST use executable contract forms (`zsh -lc ...`, `bash script.sh`) and avoid sourced-CLI patterns.
- Any exception to strict-mode, quoting, or destructive-command policy requires waiver metadata with rule ID or section, reason, tracking ticket, and expiry or ADR reference.
