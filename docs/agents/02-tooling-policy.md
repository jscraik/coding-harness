# Tooling policy

## Verified command authority

For all repo operations, this repository treats scripts and package manager settings from repo files as authoritative:

- `package.json` (`packageManager`, scripts, repository command contract)
- `pnpm-lock.yaml` (lockfile and package provenance)
- `tsconfig.json` (TypeScript and module rules)

## Tool and shell defaults

- Shell: `zsh -lc`.
- Discovery: `rg`, `fd`, and `jq` (when available).
- File reads: keep snippets bounded and explicit.
- Do not add dependencies or global tool changes unless requested.

## Repository command contract

| Surface | Primary command | Purpose |
| --- | --- | --- |
| Install/deps | `pnpm install` | Dependency installation |
| Quality gate | `pnpm check` | `lint + typecheck + test + audit` |
| Lint | `pnpm lint` | `biome check .` |
| Typecheck | `pnpm typecheck` | `tsc --noEmit` |
| Tests | `pnpm test` | `vitest run` |
| Audit | `pnpm audit` | dependency risk check |
| Build | `pnpm build` | compile TypeScript and generate `dist/cli.js` |

## Execution rule for tooling

Use repo scripts as the source of truth and do not assume global shortcuts. If a command is unavailable in the environment, record it immediately and treat the corresponding validation gate as blocked until rerun in an environment with the command.

## Recommended command order

For code changes:

1. Read/inspect target files.
2. Apply minimal patch.
3. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`.
4. Run `pnpm check` before handoff.

## Tooling verification checklist

Before claiming a change is verified, confirm:

- The command invoked exists in repo docs or scripts.
- The command version/source is not in conflict with lockfile or repo settings.
- Output is captured in closeout notes.

## Discovery constraints

- Prefer `rg` for content search.
- Use `fd` when you need file-name discovery.
- Use `jq` for JSON filtering/transforms.

## Escalation triggers

Stop and ask before proceeding if:

- You must deviate from `pnpm` due environment constraints.
- A required command is absent.
- `pnpm` script behavior conflicts with local/global docs.

## Private npm package setup

When using `@brainwav/coding-harness` from a private npm registry, projects must configure `.npmrc`:

### Option 1: GitHub Packages (recommended for GitHub workflows)

```bash
# .npmrc
@brainwav:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
```

Set `NPM_TOKEN` as an environment variable (GitHub PAT with `read:packages` scope).

### Option 2: npm registry with OIDC trusted publisher

For CI/CD with OIDC:

```bash
# .npmrc
@brainwav:registry=https://registry.npmjs.org/
```

The registry will use OIDC token exchange for authentication.

### Verification

Run `harness verify-greptile --check-npmrc` to verify `.npmrc` is configured correctly for the private package.

## Required .npmrc settings for this repository

The `.npmrc` in this repository sets:

- `ignore-scripts=true` - Security: block scripts from dependencies
- `strict-peer-dependencies=false` - Warn on peer issues (not fail)
- `auto-install-peers=false` - Don't auto-install peers
- `shamefully-hoist=false` - Better isolation
- `node-linker=hoisted` - Better compatibility

Projects using coding-harness should adopt similar security-conscious defaults.
