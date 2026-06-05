---
name: coding-harness
description: "Use when users need to install, bootstrap, upgrade, audit, diagnose, or explain @brainwav/coding-harness in a repository, including harness init/upgrade, CI migration, governance gates, command discovery, and Codex environment action sync; do not use for unrelated feature delivery."
skill_kind: executable
owned_workflow: harness-install-upgrade-and-governance
validation_command: pnpm skill:validate
doc_schema: coding-harness-doc/v1
doc_type: skill
authority: canon
canon_class: canonical
distribution: packaged-skill
audience:
  - codex-agent
  - coding-harness-maintainer
lifecycle_state: active
owner: coding-harness-maintainers
created: 2026-06-04
last_reviewed: 2026-06-04
review_cadence: release
maintenance_trigger:
  - packaged-skill-change
  - harness-command-change
  - downstream-install-change
semver_impact: minor
validated_by:
  - pnpm docs:lifecycle
  - pnpm skill:validate
depends_on:
  - .agents/skills/coding-harness/references/agent-install-guide.md
  - .agents/skills/coding-harness/references/setup-and-commands.md
  - .agents/skills/coding-harness/references/contract.yaml
---

# Coding Harness Skill

Use this skill to operate `@brainwav/coding-harness` from live repo evidence, not stale install memory.

## Table of Contents
- [Use](#use)
- [Command Truth](#command-truth)
- [Workflow](#workflow)
- [Validation](#validation)
- [References](#references)
- [Boundaries](#boundaries)
- [Execution Boundaries](#execution-boundaries)
- [Failure Mode](#failure-mode)
- [Gotchas](#gotchas)

## Use
- Install, bootstrap, update, repair, or explain `@brainwav/coding-harness`.
- Run or interpret `harness init`, `harness upgrade`, `harness ci-migrate`, or governance gates.
- Verify harness state with command evidence before calling a repo green.
- Align generated `.codex/environments/environment.toml` actions with current project scripts.
- Maintain this source repo's packaged skill, templates, command contracts, or eval fixtures.

Do not use for unrelated feature delivery, generic cloud deployment, or security work that is not tied to harness setup, policy gates, or CI ownership.

## Command Truth
- Fresh-agent entrypoint: `harness next --json`.
- Focused first-contact help: `harness --help`.
- Public agent rail catalog: `harness commands --json --for-agent`.
- Full expert catalog: `harness commands --json` and `harness --help --all-commands`.
- Source-repo probes: `node --import tsx src/cli.ts ...` so command evidence matches the current tree without the `pnpm exec tsx` IPC runner.
- Consumer-repo installs: use the installed `harness` binary, preferably via `mise install -g npm:@brainwav/coding-harness`.
- Existing-repo updates: preview with `harness upgrade --dry-run`, then apply with `harness upgrade`.
- Scaffold transitions only: `harness init --update`, `--interactive`, `--migrate`, or `--rollback`.
- CI migration is snapshot-backed. Use `prepare`, `verify`, `commit`, and `abort`; do not manually delete `.github/workflows/`.
- CI ownership: CircleCI is the primary PR gate, CodeRabbit is the independent review check, Semgrep Cloud is the independent external security check, and GitHub Actions is release/fallback unless intentionally migrated.

## Workflow
1. Confirm the mode: explanation-only or execution.
2. Confirm repo root, dirty worktree, package manager, and available auth before mutations.
3. Discover live truth with `harness next --json`; in this source repo use `node --import tsx src/cli.ts next --json`.
4. For first-time bootstrap, run `harness init --dry-run`, review planned writes, then run `harness init`.
5. For update checks, run `harness init --check-updates`; use `harness upgrade --dry-run` and `harness upgrade` for routine existing-repo updates.
6. For CI migration, run the snapshot commands in order and preserve rollback evidence.
7. Validate the smallest real path first, widen when runtime, artifact, CI, or governed docs changed.
8. Report exact command outcomes, skipped auth-bound checks, residual risk, and next safe command.

## Validation
Command discovery:
- `harness next --json`
- `harness --help`
- `harness commands --json --for-agent`
- `harness commands --json`
- `harness --help --all-commands`

Source-repo equivalents:
- `node --import tsx src/cli.ts next --json`
- `node --import tsx src/cli.ts --help`
- `node --import tsx src/cli.ts commands --json --for-agent`
- `node --import tsx src/cli.ts commands --json`
- `node --import tsx src/cli.ts --help --all-commands`

Setup and governance:
- `harness init --dry-run`
- `harness init`
- `harness init --check-updates`
- `harness upgrade --dry-run`
- `harness upgrade`
- `harness ci-migrate prepare --provider circleci --dry-run`
- `harness ci-migrate --provider circleci --apply`
- `harness ci-migrate verify --snapshot <snapshot-id>`
- `harness ci-migrate commit --snapshot <snapshot-id>`
- `harness ci-migrate abort --snapshot <snapshot-id>`
- `harness docs-gate --mode advisory --json`
- `harness check-environment --contract <path> --attestation <path>`
- `harness verify-coderabbit`
- `harness check-authz --contract <path> --repo <owner/repo> --branch <branch>`

Source-repo baseline:
- `pnpm skill:validate`
- `pnpm check`
- `pnpm test:deep` when runtime or artifact behavior changed
- `bash scripts/validate-codestyle.sh` before handoff when code or governed docs changed

Fail fast on the first blocking gate. Rerun the exact failed check after fixing it.

## References
- Install and repair: [`references/agent-install-guide.md`](./references/agent-install-guide.md)
- Machine-readable install phases: [`references/agent-install.json`](./references/agent-install.json)
- Command lifecycle and validation ladder: [`references/setup-and-commands.md`](./references/setup-and-commands.md)
- Contract alignment: [`references/contract.yaml`](./references/contract.yaml)
- Benchmark expectations: [`references/evals.yaml`](./references/evals.yaml)
- Reference validator implementation: [`scripts/validate_reference_contracts.py`](./scripts/validate_reference_contracts.py)

## Boundaries
Can scaffold governed files, run local gates, emit JSON evidence, manage snapshot-backed CI migration, and verify remote policy when credentials exist.

Cannot create credentials, install GitHub Apps, bypass branch protection, turn missing auth into a pass, overwrite user-owned environment files without approval, or claim full capabilities from focused `harness --help`.

## Execution Boundaries
- Safe autonomous work stays inside the target repository and harness-managed scaffolds.
- Preview mutating lanes first with `--dry-run` or snapshot commands before applying.
- Do not create credentials, install GitHub Apps, weaken branch protection, or change user/global config.
- Do not overwrite user-owned `.codex/environments/environment.toml` unless it is harness-autogenerated or explicitly approved.
- Treat remote policy verification as blocked unless credentials, repository, and branch scope are available.
- For cleanup before init or CI migration, use harness dry-runs and snapshot-backed migration commands.
- If a user asks for destructive cleanup, say it is unsafe for this lane and offer the harness preview or migration-abort path instead of providing a deletion command.

## Failure Mode
- Fail closed when command truth, repo root, package manager, or canonical harness state cannot be established.
- Stop at the first failed or blocked validation gate, report the exact command output, and rerun that same gate after a fix.
- Mark auth-bound, network-bound, or destructive checks as blocked rather than inferred from local source.
- If the requested task is not harness setup, governance, CI ownership, command discovery, packaged skill maintenance, or action sync, hand off instead of expanding scope.

## Gotchas
- `harness --help` is focused first-contact help, not proof of the full command catalog.
- In this source repo, global `harness` may be stale; prefer `node --import tsx src/cli.ts ...`.
- `harness init --update` is a deliberate re-scaffold lane, not the routine upgrade path.
- CI migration must preserve snapshot rollback evidence; manual workflow deletion is a drift risk.
- A packaged-skill validation pass does not prove runtime visibility, auth-bound checks, or downstream install health.
