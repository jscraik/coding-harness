# Security and governance

## Security posture

This repository follows conservative defaults:

- Minimal command surface in docs and scripts.
- Explicitly avoid ad hoc global installs and hidden mutation.
- Preserve existing dependency and execution boundaries (`pnpm` + lockfile-driven installs).
- Harness-managed consumer repositories are a defined exception: `scripts/check-environment.sh` requires global npm install of `@brainwav/coding-harness` with explicit `NPM_TOKEN` auth wiring.

## Secret handling

- Never place tokens, keys, or PII in docs, command output, commit text, or memory notes.
- If sensitive material appears in a file, sanitize and rotate as soon as practical.
- Keep environment-specific credentials outside repo and out of command snippets unless placeholders are explicit.

## Code and data governance

- Validate behavior changes before merge using documented gates.
- Keep audit trail artifacts (closeout outputs, validation status) in the task record.
- For high-risk edits (policy/validation gates), include rollback expectations in docs.

## Risk controls

- Do not skip required gates to save time.
- If checks fail repeatedly, stop and request decision on risk acceptance.
- Treat stale check output as non-evidence.

## Governance escalation

- Escalate to human owner for:
  - Security policy conflicts
  - Permission or secret leakage concerns
  - Any command that modifies global environment settings

## Operational check list

- Package manager consistency verified in repo files.
- No unauthorized command or toolchain mutation.
- Validation gate outputs captured.
- No secrets in docs/memory.

## Pre-commit hooks

This repository uses `simple-git-hooks` to install local hooks, and `prek.toml` mirrors the same commands so hook policy drift is visible in-repo:

### Hooks installed

| Hook | Purpose |
| --- | --- |
| `pre-commit` | Runs `make hooks-pre-commit` (`pnpm lint`, `pnpm docs:lint`, `pnpm typecheck`, staged `gitleaks`, staged-doc `vale`, related tests) |
| `commit-msg` | Validates conventional commit format, reminds about PR template |
| `pre-push` | Runs `make hooks-pre-push` (`docs-gate --mode required`, diagram freshness, `tooling-audit`, `check-environment`, changed-file `semgrep`, `pnpm test`, `pnpm build`, `pnpm audit`) |

`docs-gate` no longer covers only branch/CI governance wording. Local hook, readiness, and tooling-runtime changes are expected to update this guide and `docs/agents/02-tooling-policy.md` in the same change so pre-push drift is caught before GitHub does.

## Plan traceability

- Pull requests must declare `Plan IDs` in the PR template summary.
- Each declared ID must resolve to a `docs/plans/*` document with matching `plan_id` frontmatter.
- Completed acceptance checklist items in referenced plans must carry evidence links or refs before merge.
- `risk-policy-gate` enforces this in CI, and `review-gate` treats missing or invalid plan traceability as a merge blocker even when the review check itself passed.

`scripts/check-semgrep-changed.sh` is intentionally narrow: it compares `HEAD` to the upstream merge-base (or the nearest main/master fallback), filters to changed implementation files under `src/**`, and runs only the local `scripts/semgrep-pre-push.yml` ruleset. That keeps the local lane useful without duplicating the full CI security scan.

### Setup

Hooks are automatically installed after `pnpm install` via `postinstall` script.

To manually reinstall hooks:

```bash
node scripts/setup-git-hooks.js
```

### Commit message format

All commits must follow conventional commit format:

```
type(scope)!: description

Detailed body (optional).

Co-Authored-By: Name <email>
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`, `perf`, `ci`, `build`, `revert`

### PR template reminder

On agent branches (`codex/*`, `claude/*`), the commit-msg hook reminds about PR template requirements:
- ## Summary (1-3 bullet points)
- Plan IDs
- ## Checklist (all items checked)
- ## Testing (test commands and evidence)
- ## Review artifacts (links to review outputs)
- ## Notes (merge rationale, risks, rollback)
