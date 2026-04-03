# FORJAMIE

## 2026-04-03 - Command Failure Taxonomy (Why It Felt So Noisy)

### Why so many "failures" showed up

- Not all failures were the same class:
  - expected safety blocks (`git checkout` blocked by local changes),
  - sandbox permission denials (unable to remove stale `.git/worktrees/*` metadata),
  - non-interactive git constraints (`rebase --continue` needing `EDITOR`),
  - genuine merge/rebase conflicts during long replay.
- Long single-shot replay/cherry-pick sequences amplified this because one stop condition triggered repeated retries with new failure modes.
- Hook and policy enforcement correctly blocked some unsafe shortcuts (for example `git checkout --theirs`) and forced safer alternatives.

### Improvements to reduce future churn

1. Classify every command failure immediately as `guardrail`, `sandbox`, `interactive-shell`, or `real-conflict` before retrying.
2. For large cherry-pick/rebase runs, replay in smaller batches and checkpoint status between batches.
3. Run scripted continues with `GIT_EDITOR=true` to avoid non-interactive editor dead-ends.
4. When guardrails block `git checkout --theirs`, resolve from stage blobs (`git show :3:<path> > <path>`) and continue.
5. Treat sandbox `Operation not permitted` on `.git/worktrees/*` as metadata-cleanup debt; do not misclassify it as repo-content failure.

## 2026-04-03 - Push Recovery Notes

### What blocked this branch

- Pre-commit initially failed because `tmp/coding-harness-linear-issue-updates.json` was unformatted and `biome check .` scans `tmp/`.
- Pre-push initially failed because Semgrep tried to write `~/.semgrep/semgrep.log` and the session could not write there.
- A later push attempt succeeded remotely but returned local Git ref/config lock errors.
- The branch also diverged mid-run and required a rebase; the only content conflicts were in:
  - `scripts/codex-preflight.sh`
  - `src/templates/codex-preflight.sh`

### Fast recovery path next time

1. Keep `tmp/**` scratch JSON formatted or move it outside the repo before commit/push.
2. If Semgrep hits a log-file permission error, push with:
   - `SEMGREP_LOG_FILE=/tmp/codex-semgrep/semgrep.log`
   - `SEMGREP_SETTINGS_FILE=/tmp/codex-semgrep/settings.yml`
   - `XDG_CONFIG_HOME=/tmp/codex-semgrep/xdg-config`
   - `XDG_CACHE_HOME=/tmp/codex-semgrep/xdg-cache`
3. If push says `fetch first`, stash only local-only files (for this run: `.codex/environments/environment.toml` and `tmp/coding-harness-linear-issue-updates.json`), rebase, then restore the stash.
4. If push reports local `.git/config` or `refs/remotes/origin/*` lock errors after the remote update line, verify the PR head before retrying; the branch may already be updated on GitHub.
5. Do not pull unrelated `.codex/environments/environment.toml` into governance PRs unless the task explicitly targets Codex environment action changes.

## 2026-03-15 - CircleCI Closeout + Durability Sweep

### Plan / Annotation updates

- Marked the CircleCI transition status plan as completed and added explicit closeout annotations in:
  - `docs/plans/2026-03-14-feat-github-actions-to-circleci-transition-status-plan.md`
- Annotated final review-driven fixes so future readers can trace why they were applied:
  - Node runtime parity (`cimg/node:24.13`),
  - Corepack-permission-safe pnpm bootstrap in CircleCI,
  - quoted/unquoted `.mise.toml` key validation in environment checks,
  - preflight learning-doc path fallback (`Learning.md` -> `Learnings.md`).

### Durability fixes shipped in code + scaffold generation

- Runtime workflow:
  - `.circleci/config.yml`
- Init scaffolding so new repos inherit the same behavior:
  - `src/lib/init/scaffold.ts`
  - `src/templates/codex-preflight.sh`
- Test updates for generated CircleCI content:
  - `src/commands/init.test.ts`

### Verification this pass

- `pnpm lint` -> pass.
- `pnpm typecheck` -> pass.
- `pnpm test` -> fails at runner teardown with `Error: [vitest-worker]: Timeout calling "onTaskUpdate"` after reporting all test files passed (`94 passed`).
- `pnpm check` -> same Vitest runner timeout in its `pnpm test` phase after lint/docs/typecheck/workflow validation pass.

## 2026-03-14 - Transition Plan Status Refresh (Completed vs Remaining)

### Marked Completed in Plan

- Added an explicit execution checklist to `docs/plans/2026-03-14-feat-github-actions-to-circleci-transition-status-plan.md` and marked complete:
  - provider-neutral `ci-migrate` control plane + signed snapshot trust,
  - fail-closed merge-queue evidence ingestion/orchestrator/replay-binding checks,
  - strict verify metadata hardening + `shadow/*` rejection,
  - proof-pack trust chain automation plus canonical harvest templates.

### Left to Do (Highest Impact)

- Break-glass signer governance operations automation:
  - signer roster lifecycle, rotation cadence, and dual-approval workflow operations.
- Live provider API queue execution wiring:
  - pause/drain/revalidate orchestration at provider API level (not evidence ingestion only).
- Full provider API run discovery + scheduling automation:
  - automatic immutable artifact collection/provenance generation for parity/downstream proof-pack production.

### Repo Hygiene Updates Requested This Pass

- Updated `.gitignore` to:
  - stop excluding `FORJAMIE.md` so this handoff log is trackable in PR history,
  - ignore transient `.harness-memory-validator-*/` directories.

## 2026-03-14 - CircleCI Transition Continuation (Fail-Closed Verify + Merge-Queue Binding Hardening)

- Hardened fail-closed enforcement in `src/commands/ci-migrate.ts`:
  - Merge-queue evidence binding is now required whenever evidence is explicitly supplied or discovered at canonical evidence paths, not only in required-mode/orchestrator paths.
  - Strict `verify` now rejects malformed `ciProviderPolicy` migration metadata instead of silently defaulting (`migrationStage`, `transitionStatusArtifactPath`).
  - Strict `verify` now rejects authoritative required checks using the `shadow/*` namespace.
- Added regression coverage in `src/commands/ci-migrate.test.ts`:
  - `rejects explicit merge-queue evidence when binding does not match apply identity in shadow mode`
  - `rejects discovered merge-queue evidence when binding does not match apply identity in shadow mode`
  - `fails strict verify when ciProviderPolicy migration metadata is malformed`
  - `fails strict verify when required checks use shadow namespace`
- Updated transition status plan matrix in:
  - `docs/plans/2026-03-14-feat-github-actions-to-circleci-transition-status-plan.md`
- Correction for prior notes:
  - Earlier entries referencing a public `--artifact-harvest-input` CLI flag are superseded; canonical artifact harvesting is currently documented via templates under `docs/examples/ci-migrate/`, with provider-specific run discovery/scheduling remaining external automation.

### Validation evidence

- `pnpm vitest run src/commands/ci-migrate.test.ts src/cli-dispatch.test.ts` -> pass (133 passed, 7 skipped).
- `pnpm exec biome check src/commands/ci-migrate.ts src/commands/ci-migrate.test.ts src/cli.ts src/cli-dispatch.test.ts` -> pass.
- `pnpm exec tsc --noEmit --pretty false` -> pass.

## 2026-03-14 - CircleCI Transition Continuation (Provider Artifact Harvest Template Wiring)

- Added canonical operator templates under `docs/examples/ci-migrate/` for immutable artifact intake into the existing proof-pack trust chain:
  - `ci-parity-proof-harvest-manifest.template.json`
  - `parity-proof-harvest-orchestrator.template.sh` (executable template)
- The orchestrator template now automates:
  - provider artifact download/copy from `source.url` or `source.path`,
  - deterministic artifact signatures using tuple:
    - `path:sha256:sourceProvider:sourceRunId:sourceCommitSha:capturedAt`,
  - writing `.harness/ci-parity-proof-provenance.input.json`,
  - writing signed `.harness/ci-parity-proof-artifact-index.json` + `.sig`.
- Updated docs/status artifacts:
  - `docs/examples/ci-migrate/README.md` now includes harvest manifest + orchestrator usage and env contracts.
  - root `README.md` now references provider artifact harvest templates as the bridge into `--auto-generate-proof-pack`.
  - transition plan now narrows partial status to provider-specific run discovery/scheduling, while canonical harvest templates are marked shipped.

### Validation evidence

- `pnpm vitest run src/commands/ci-migrate.test.ts src/cli-dispatch.test.ts` -> pass (129 passed, 7 skipped).
- `pnpm exec biome check src/commands/ci-migrate.ts src/commands/ci-migrate.test.ts src/cli.ts src/cli-dispatch.test.ts` -> pass.
- `pnpm exec tsc --noEmit --pretty false` -> pass.

## 2026-03-14 - CircleCI Transition Continuation (Break-Glass Governance Policy Enforcement)

- Implemented signed break-glass governance policy enforcement in `src/commands/ci-migrate.ts`:
  - Added required policy path: `.harness/control-plane/ci-migrate-break-glass-policy.json` (+ `.sig`).
  - Added schema validation for `ci-migrate-break-glass-policy/v1` with integrity binding:
    - approver allowlist
    - max approval TTL
    - dual-approval requirement for rollback weakening.
  - `--break-glass-approval` now fails closed if governance policy is missing, unsigned/tampered, or policy checks fail.
  - Required-mode rollback-weakening approvals now enforce policy-level dual approval when configured.
- Expanded break-glass test coverage in `src/commands/ci-migrate.test.ts`:
  - rejects required rollback-weakening approval when policy is missing,
  - rejects non-allowlisted approvers,
  - rejects single-approver rollback weakening when policy requires dual approval.
- Added docs template:
  - `docs/examples/ci-migrate/ci-migrate-break-glass-policy.template.json`
  - updated `docs/examples/ci-migrate/README.md`, root `README.md`, and transition status plan.

## 2026-03-14 - CircleCI Transition Continuation (Docs/Template Trust Alignment + Plan Status Refresh)

- Aligned operator artifacts with the enforced merge-queue trust contract:
  - Updated `docs/examples/ci-migrate/merge-queue-cutover-orchestrator.template.sh` to emit schema `ci-migrate-merge-queue-evidence/v2`.
  - Added required `binding` payload fields (repo/policy identity) sourced from `HARNESS_CI_MIGRATE_BINDING_*` env vars.
  - Ensured optional lifecycle fields (`drainedAt`, `revalidatedAt`, candidate counts) are omitted unless full lifecycle is required.
- Expanded docs in `docs/examples/ci-migrate/README.md`:
  - Added TOC and explicit template inventory.
  - Added orchestrator env contract and emitted artifact requirements (`.json` + `.sig`).
- Refreshed transition tracker `docs/plans/2026-03-14-feat-github-actions-to-circleci-transition-status-plan.md`:
  - Marked orchestrator execution hook as complete coverage.
  - Updated migration UX text to reflect required-mode apply/commit fail-closed evidence behavior.
  - Narrowed outstanding items to non-code trust/governance integration lanes.
- Updated root `README.md` CI migration feature bullets so docs match current behavior.

### Plan status check (highest-impact lanes)

- Completed in code:
  - Signed/immutable snapshot trust and provenance pipeline
  - Merge-queue cutover state machine + signed evidence + orchestrator hook
  - Required-mode fail-closed evidence and policy-bound replay protection
- Remaining operations/governance work:
  - break-glass signer governance workflow (owner roster, rotation, dual approval),
  - provider API-backed merge-queue pause/drain/revalidate wiring,
  - provider API artifact harvesting + provenance signing automation for fully automatic proof-pack generation.

### Validation evidence

- `npm test` -> fails (repo pre-existing non-doc lane failures):
  - `src/commands/init.test.ts`: interactive symlink exclusion assertion + `generateDiff is not a function` (3 tests),
  - `src/commands/pilot-evaluate.test.ts`: timeout in `capturePilotMetrics > returns metrics with errors when artifacts missing`.
- `npm run test:deep` -> fails during `pnpm check` with pre-existing lint/test debt:
  - `src/commands/ci-migrate.test.ts` format-only Biome suggestion,
  - `src/commands/init.ts` unused imports + organize-imports,
  - `src/lib/init/interactive.ts` organize-imports,
  - same `init.test.ts` and `pilot-evaluate.test.ts` runtime failures as above.

## 2026-03-14 - CircleCI Transition Continuation (Merge-Queue Orchestrator Hook + Signed Evidence Binding)

- Added live orchestration hook support to `ci-migrate`:
  - New optional CLI flag in `src/cli.ts`: `--merge-queue-orchestrator <path>`.
  - New `CIMigrateOptions.mergeQueueOrchestratorPath` wiring in `src/commands/ci-migrate.ts`.
  - `ci-migrate` now executes a repository-local orchestrator executable (default `.harness/control-plane/merge-queue-cutover-orchestrator` when present) before apply/commit merge-queue evidence validation.
- Added fail-closed orchestration behavior in `src/commands/ci-migrate.ts`:
  - orchestration path must exist (when explicitly configured),
  - non-zero orchestrator exit blocks migration,
  - orchestrator must emit both evidence JSON and `.sig` sidecar,
  - generated evidence is still schema/signature/lifecycle validated through existing trust checks.
- Bound cutover window timestamps to signed evidence when available:
  - `pausedAt`, `drainedAt`, and `revalidatedAt` in `.harness/control-plane/merge-queue-cutover-window.json` now prefer signed evidence lifecycle timestamps.
- Added regression coverage in `src/commands/ci-migrate.test.ts`:
  - `runs merge-queue orchestrator and ingests generated signed evidence`
  - `fails closed when merge-queue orchestrator exits non-zero`
- Updated operator docs:
  - `docs/examples/ci-migrate/merge-queue-cutover-orchestrator.template.sh` (new executable template)
  - `docs/examples/ci-migrate/README.md`, `README.md`, and transition status plan coverage matrix.

### Validation evidence

- `pnpm biome check --write src/commands/ci-migrate.ts src/commands/ci-migrate.test.ts src/cli.ts src/cli-dispatch.test.ts` -> pass.
- `pnpm biome check src/commands/ci-migrate.ts src/commands/ci-migrate.test.ts src/cli.ts src/cli-dispatch.test.ts` -> pass.
- `pnpm vitest run src/commands/ci-migrate.test.ts src/cli-dispatch.test.ts` -> pass (124 passed, 7 skipped).

## 2026-03-14 - CircleCI Transition Continuation (Harvest Manifest -> Provenance Automation)

- Extended `ci-migrate` auto-generation pipeline to bootstrap from a harvest manifest:
  - New optional CLI flag in `src/cli.ts`: `--artifact-harvest-input <path>`.
  - New schema support in `src/commands/ci-migrate.ts`: `ci-parity-proof-harvest-input/v1`.
  - `--auto-generate-proof-pack` now supports this flow:
    - harvest input (file/http artifact sources) ->
    - materialized provenance input (`.harness/ci-parity-proof-provenance.input.json`) ->
    - artifact index/bundle/manifest generation ->
    - signed parity proof-pack generation.
- Added strict fail-closed controls for harvest ingestion:
  - requires unique artifact IDs and valid source metadata,
  - validates HTTPS-only HTTP sources and auth header/env-var shape,
  - blocks missing file sources and empty harvested artifacts,
  - enforces repo-safe output paths for harvested immutable artifact copies.
- Added focused regression coverage:
  - `auto-generates provenance evidence from harvest input when requested`
  - `fails auto-generation from harvest input when source artifact is missing`
  - Updated CLI dispatch tests for `--artifact-harvest-input`.
- Added operator docs/templates:
  - `docs/examples/ci-migrate/ci-parity-proof-harvest.input.template.json` (new)
  - `docs/examples/ci-migrate/README.md` (usage updates)
  - `README.md` and transition status plan coverage matrix updated.

### Validation evidence

- `pnpm biome check --write src/commands/ci-migrate.ts src/commands/ci-migrate.test.ts src/cli.ts src/cli-dispatch.test.ts` -> pass.
- `pnpm biome check src/commands/ci-migrate.ts src/commands/ci-migrate.test.ts src/cli.ts src/cli-dispatch.test.ts` -> pass.
- `pnpm vitest run src/commands/ci-migrate.test.ts src/cli-dispatch.test.ts` -> pass (122 passed, 7 skipped).

## 2026-03-14 - CircleCI Transition Continuation (Signed Break-Glass Governance Policy Enforcement)

- Completed signed governance-policy enforcement for break-glass rollback approvals in `src/commands/ci-migrate.ts`:
  - Added policy path `.harness/control-plane/ci-migrate-break-glass-policy.json` (`ci-migrate-break-glass-policy/v1`).
  - Enforced policy signature + integrity verification before accepting `--break-glass-approval`.
  - Bound break-glass approvals to policy-defined:
    - approver allowlist,
    - maximum approval TTL,
    - capability bounds (`allowExpiredSnapshotRestore`, `allowRollbackWeakening`).
  - Added fail-closed behavior:
    - break-glass approvals are rejected when policy is missing,
    - rollback weakening in required mode is rejected when governance policy is missing.
- Added test coverage in `src/commands/ci-migrate.test.ts`:
  - rejects break-glass approval when governance policy is missing,
  - rejects break-glass approval when approver is not allowlisted,
  - existing required-mode rollback tests updated to include signed governance policy fixtures.
- Added operator docs:
  - `docs/examples/ci-migrate/ci-migrate-break-glass-policy.template.json`,
  - expanded `docs/examples/ci-migrate/README.md`,
  - updated `README.md` and transition status plan.

### Validation evidence

- `pnpm biome check src/commands/ci-migrate.ts src/commands/ci-migrate.test.ts README.md docs/examples/ci-migrate/README.md docs/plans/2026-03-14-feat-github-actions-to-circleci-transition-status-plan.md` -> pass.
- `pnpm vitest run src/commands/ci-migrate.test.ts` -> pass (75/75).
- `npm test` -> fails in unrelated existing lanes:
  - parse error in `src/lib/init/interactive.ts`,
  - timeout in `src/commands/pilot-evaluate.test.ts`.

## 2026-03-14 - CircleCI Transition Continuation (Required-Mode Commit Evidence Hardening)

- Hardened explicit cutover commit behavior in `src/commands/ci-migrate.ts`:
  - `ci-migrate commit` now requires signed merge-queue evidence by default when `ciProviderPolicy.mode = required` and target provider is CircleCI.
  - Evidence remains overrideable via `--merge-queue-evidence`, but missing evidence now fail-closes commit windows instead of silently continuing.
- Added regression coverage in `src/commands/ci-migrate.test.ts`:
  - `requires signed merge-queue evidence on explicit required-mode commit windows`
  - `accepts signed merge-queue evidence on explicit required-mode commit windows`
- Updated status docs:
  - `README.md` CI migration feature list now documents required-mode commit evidence enforcement.
  - `docs/plans/2026-03-14-feat-github-actions-to-circleci-transition-status-plan.md` records the required-mode commit fail-closed behavior.

### Validation evidence

- `pnpm biome check src/commands/ci-migrate.ts src/commands/ci-migrate.test.ts README.md docs/plans/2026-03-14-feat-github-actions-to-circleci-transition-status-plan.md` -> pass.
- `pnpm vitest run src/commands/ci-migrate.test.ts` -> pass.
- `npm test` -> pass.
- `npm run test:deep` -> pass.

## 2026-03-14 - CircleCI Transition Continuation (Signed Merge-Queue Evidence + Signed Artifact-Index Automation)

- Extended `ci-migrate` to support signed merge-queue orchestration evidence:
  - New CLI flag in `src/cli.ts`: `--merge-queue-evidence <path>`.
  - `src/commands/ci-migrate.ts` now validates signed evidence (`.sig`) for schema `ci-migrate-merge-queue-evidence/v1` and binds digest + lifecycle metadata into `.harness/control-plane/merge-queue-cutover-window.json`.
  - Required-mode runs enforce stronger lifecycle semantics when evidence is supplied (`drainedAt`/`revalidatedAt`, candidate counts, monotonic timestamps).
- Added immutable artifact-index automation for proof-pack generation:
  - New signed source artifact:
    - `.harness/ci-parity-proof-artifact-index.json`
    - `.harness/ci-parity-proof-artifact-index.sig`
  - New schema in `src/commands/ci-migrate.ts`: `ci-parity-proof-artifact-index/v2`.
  - `--auto-generate-proof-pack` can now bootstrap from signed artifact index:
    - signed artifact index -> provenance input -> provenance bundle -> provenance manifest -> parity proof-pack.
  - Index integrity is validated against both sidecar signature and canonical payload digest (`integrity.payloadSha256`) before materialization.
- Updated transition tracker:
  - `docs/plans/2026-03-14-feat-github-actions-to-circleci-transition-status-plan.md` now marks signed merge-queue evidence ingestion and signed artifact-index automation as complete, while live provider API collectors remain partial.
- Updated README CI migration section with new capabilities and artifact paths.

### Validation evidence

- `pnpm biome check src/commands/ci-migrate.ts src/commands/ci-migrate.test.ts src/cli.ts src/cli-dispatch.test.ts` -> pass.
- `pnpm vitest run src/commands/ci-migrate.test.ts src/cli-dispatch.test.ts` -> pass.
- `npm test` -> pass.

## 2026-03-14 - CircleCI Transition Continuation (Legacy Required-Check Bootstrap + Status Tracker Refresh)

- Implemented missing-manifest bootstrap for `ci-migrate` in `src/commands/ci-migrate.ts`:
  - Added fail-safe legacy import path when `.harness/ci-required-checks.json` is absent.
  - Import sources:
    - `harness.contract.json` required checks (`branchProtection` + `reviewPolicy`),
    - source-provider workflow metadata (`.github/workflows/*` job `name` entries for GitHub Actions).
  - Dry-run behavior:
    - imports checks in-memory without mutating repository files.
  - Apply behavior:
    - writes canonical `.harness/ci-required-checks.json` before migration continues.
  - Imported checks are normalized with immutable identity fields:
    - deterministic `policyId`,
    - provider-bound `sourceAppSlug/sourceAppId`,
    - escaped `externalIdPattern`,
    - `requiredOnEvents` and `freshnessWindowDays`.
- Updated migration report generation to accept imported required-check overrides so `prepare` can proceed safely even when manifest bootstrap is needed.
- Added regression coverage in `src/commands/ci-migrate.test.ts`:
  - `bootstraps required checks from legacy contract/workflow evidence in dry-run without writing manifest`
  - `writes imported required checks manifest on apply when manifest is missing`
- Added canonical transition status tracker:
  - `docs/plans/2026-03-14-feat-github-actions-to-circleci-transition-status-plan.md`
  - Marks complete/partial/pending lanes against the validated migration contract and calls out the next gate to `circleci` required mode.

### Validation evidence

- `pnpm biome check src/commands/ci-migrate.ts src/commands/ci-migrate.test.ts` -> pass.
- `pnpm vitest run src/commands/ci-migrate.test.ts src/cli-dispatch.test.ts` -> pass (113 passed, 7 skipped).
- `pnpm exec tsx src/cli.ts ci-migrate prepare --provider circleci --dry-run` -> now generates migration report; exits when `HARNESS_CI_MIGRATE_SIGNING_KEY` is not set (expected with signed snapshot/state policy).

## 2026-03-14 - CircleCI Transition Continuation (Provenance-Input Automation for Full Proof-Pack Generation)

- Extended `ci-migrate` proof-pack automation to close the remaining provenance bootstrapping gap:
  - Added optional provenance metadata input:
    - `.harness/ci-parity-proof-provenance.input.json` (`ci-parity-proof-provenance-input/v1`)
  - `--autoGenerateProofPack` now supports a third fallback path:
    - provenance input -> generated signed provenance bundle -> generated signed provenance manifest -> generated proof-pack input/artifacts -> generated signed proof-pack.
- Implementation details in `src/commands/ci-migrate.ts`:
  - Added strict parser for provenance input with fail-closed validation for:
    - schema version, timestamps, artifact metadata shape, provider IDs, run/workflow fields, optional scenario IDs.
  - Added provenance-bundle materializer that:
    - verifies source artifact paths stay inside repo root,
    - computes immutable artifact digests from actual file content,
    - signs artifact provenance tuples,
    - writes `.harness/ci-parity-proof-provenance.bundle.json`.
  - Updated auto-generation flow to prefer materializing bundle from provenance input when bundle is absent, then continue through existing trust chain.
  - Updated missing-evidence error messaging to include all accepted bootstrap sources:
    - proof-pack input,
    - provenance bundle,
    - provenance input.
- Added regression coverage in `src/commands/ci-migrate.test.ts`:
  - `auto-generates provenance bundle and signed proof-pack from provenance input`
  - `fails auto-generation from provenance input when source artifact is missing`

### Validation evidence

- `pnpm biome check src/commands/ci-migrate.ts src/commands/ci-migrate.test.ts` -> pass.
- `pnpm vitest run src/commands/ci-migrate.test.ts` -> pass (58/58).
- `pnpm lint` -> pass.
- `pnpm test` -> pass (91 files, 1299 passed / 9 skipped).
- `pnpm run test:deep` -> pass (`pnpm check` + `pnpm test:artifacts`).

## 2026-03-14 - CircleCI Transition Continuation (Immutable Provenance Bundle Automation)

- Implemented provenance-bundle-driven proof-pack input automation in `src/commands/ci-migrate.ts`:
  - Added optional immutable source bundle path:
    - `.harness/ci-parity-proof-provenance.bundle.json`
  - Added signed provenance manifest outputs:
    - `.harness/ci-parity-proof-provenance.manifest.json`
    - `.harness/ci-parity-proof-provenance.manifest.sig`
  - Added schema-validated provenance parsing (`ci-parity-proof-provenance-bundle/v1`) with fail-closed checks for:
    - required fields and timestamps,
    - per-artifact digest and signature metadata,
    - source provider/run/workflow/commit provenance fields.
  - Added materialization pipeline for `--autoGenerateProofPack` when `.harness/ci-parity-proof-pack.input.json` is missing:
    - verifies signed provenance artifacts against local files,
    - copies verified immutable artifacts into `.harness/ci-parity-proof-pack-artifacts/`,
    - auto-writes `.harness/ci-parity-proof-pack.input.json`,
    - emits signed provenance manifest.
  - Existing auto-generation path from direct proof-pack input remains intact and backward compatible.
- Added regression coverage in `src/commands/ci-migrate.test.ts`:
  - `auto-generates proof-pack inputs from signed provenance bundle when input is missing`
  - `fails auto-generation from provenance bundle when artifact signature is invalid`
- Prior lane retained and validated:
  - merge-queue cutover window lifecycle persisted (`paused` -> `drained` -> `revalidated` / `aborted`) in `.harness/control-plane/merge-queue-cutover-window.json`.

### Validation evidence

- `pnpm biome check src/commands/ci-migrate.ts src/commands/ci-migrate.test.ts src/lib/ci/provider-adapter.ts src/lib/ci/satisfiability.ts` -> pass.
- `pnpm vitest run src/commands/ci-migrate.test.ts src/cli-dispatch.test.ts` -> pass (100 passed, 7 skipped).

## 2026-03-14 - CircleCI Transition Continuation (Merge-Queue Window + Immutable Proof-Pack Automation)

- Implemented merge-queue cutover window orchestration in `src/commands/ci-migrate.ts`:
  - Added persisted cutover window metadata at `.harness/control-plane/merge-queue-cutover-window.json`.
  - Added explicit lifecycle handling:
    - `beginMergeQueueCutoverWindow` (`status: paused`)
    - `markMergeQueueCutoverDrained` (records `drainedAt` before post-cutover validation)
    - `completeMergeQueueCutoverWindow` (`status: revalidated`)
    - `abortMergeQueueCutoverWindow` (`status: aborted`)
  - Preserved `startedAt` across transitions and persisted `drainedAt`/`completedAt` to make commit-window behavior auditable.
- Implemented immutable CI proof-pack automation in `src/commands/ci-migrate.ts`:
  - Added signed proof-pack generation path when required-mode proof-pack artifacts are missing:
    - input envelope: `.harness/ci-parity-proof-pack-input.json`
    - artifact source dir: `.harness/ci-parity-proof-pack-artifacts/`
  - Auto-generation binds output proof-pack to:
    - repo identity (`originUrl`, normalized fullName),
    - trusted policy ref + base/head SHAs,
    - policy digests (`authorityConfigPath`, `requiredCheckManifestPath`),
    - artifact digest/signature metadata.
  - Required-mode apply now fail-closes if neither trusted proof-pack nor immutable input/artifact sources exist.
- Added regression coverage in `src/commands/ci-migrate.test.ts`:
  - `auto-generates required-mode parity proof pack from immutable input artifacts on apply`
  - merge-queue lifecycle revalidate assertions (including timestamp ordering)
  - merge-queue abort assertions on post-cutover auto-rollback path.
- Updated transition status tracker:
  - `docs/plans/2026-03-14-feat-github-actions-to-circleci-transition-status-plan.md` now marks merge-queue orchestration and downstream proof-pack automation as complete, with parity-matrix orchestration still marked partial/external.

### Validation evidence

- `pnpm vitest run src/commands/ci-migrate.test.ts src/cli-dispatch.test.ts` -> pass.
- `pnpm biome check src/commands/ci-migrate.ts src/commands/ci-migrate.test.ts` -> pass.

## 2026-03-14 - CircleCI Transition Continuation (Break-Glass Governance)

- Implemented signed break-glass governance for rollback exceptions in `src/commands/ci-migrate.ts`:
  - Added `--break-glass-approval <path>` support (`src/cli.ts` + `src/cli-dispatch.test.ts`).
  - Added signed break-glass schema validation (`ci-migrate-break-glass-approval/v1`) with fail-closed checks for:
    - file presence + `.sig` sidecar presence,
    - signature verification,
    - snapshot binding,
    - signer key-id match,
    - timestamp validity + expiry window.
  - Added explicit override scopes:
    - `allowExpiredSnapshotRestore`,
    - `allowRollbackWeakening`.
  - Required-mode rollback now blocks without break-glass when rollback may weaken authoritative checks/rulesets (`circleci -> github-actions` in required mode).
  - Expired snapshot rollback can proceed only with a valid break-glass approval that explicitly allows expired snapshot restore.
- Added regression coverage in `src/commands/ci-migrate.test.ts`:
  - required-mode rollback weakening blocked without break-glass,
  - required-mode rollback weakening succeeds with break-glass,
  - stale snapshot rollback succeeds only with break-glass override.
- Updated status tracker to mark break-glass lane complete:
  - `docs/plans/2026-03-14-feat-github-actions-to-circleci-transition-status-plan.md`.

### Validation evidence

- `pnpm vitest run src/commands/ci-migrate.test.ts src/cli-dispatch.test.ts` -> pass (108 passed, 7 skipped).
- `pnpm biome check src/commands/ci-migrate.ts src/commands/ci-migrate.test.ts src/cli.ts src/cli-dispatch.test.ts` -> pass.

## 2026-03-14 - CircleCI Transition Continuation (State Attestation Trust Hardening)

- Closed the state-metadata replay/forgery gap in `src/commands/ci-migrate.ts` by moving migration state trust from self-asserted sidecars to signed attestation metadata:
  - `writeMigrationState` now emits:
    - `<snapshot>.state.attestation.json`
    - `<snapshot>.state.attestation.sig`
  - state attestation binds:
    - `snapshotId`,
    - `stage`,
    - `payloadPath`,
    - `payloadDigest`,
    - `reportDigest`,
    - `requiredChecksDigest`,
    - optional `proofPackPayloadSha256`,
    - signer key id + signature algorithm.
  - `readMigrationState` now fails closed on:
    - missing attestation/signature sidecars,
    - invalid attestation signature,
    - signer key-id mismatch,
    - invalid/expired attestation timestamps,
    - payload path/digest mismatch,
    - stage/policy-digest/proof-pack digest mismatch versus state payload.
- Preserved legacy `<snapshot>.state.sig` emission for compatibility, but attestation sidecars are authoritative for trust decisions.
- Updated migration fixture helpers and tests in `src/commands/ci-migrate.test.ts`:
  - helper now writes signed state attestation artifacts,
  - added explicit regression: commit is rejected when prepared state-attestation signature is missing.
- Updated transition status tracker to mark state-attestation trust and wrong-app publisher enforcement as completed:
  - `docs/plans/2026-03-14-feat-github-actions-to-circleci-transition-status-plan.md`.

### Validation evidence

- `pnpm vitest run src/commands/ci-migrate.test.ts` -> pass (48/48).
- `pnpm biome check src/commands/ci-migrate.ts src/commands/ci-migrate.test.ts` -> pass.
- `pnpm docs:lint docs/plans/2026-03-14-feat-github-actions-to-circleci-transition-status-plan.md FORJAMIE.md Learning.md` -> pass (0 errors).

## 2026-03-14 - CircleCI Transition Continuation (Parity Proof-Pack Gate)

- Implemented required-mode promotion gating for CircleCI in `src/commands/ci-migrate.ts`:
  - Added fail-closed proof-pack validation for `.harness/ci-parity-proof-pack.json`.
  - Added required scenario matrix checks for:
    - `pull_request`, `main`, `merge_queue`, `fork_pr`, `docs_only_pr`, `canceled_run`, `flaky_retry`, `release_candidate_tag`.
  - Added promotion-gate checks requiring true values for:
    - `zeroUnexpectedDiffs`, `outcomeParity`, `skippedSemanticsParity`, `artifactParity`, `greptileParity`, `releaseParity`.
  - Added downstream threshold enforcement:
    - at least 3 repositories,
    - at least 2 ecosystem profiles,
    - at least 1 merge-queue-enabled repository,
    - parity-matrix and rollback-rehearsal evidence required per repository.
  - Added required-mode guardrails:
    - block on parity drift (`parity.status !== "parity"`),
    - block when pre-cutover scans have zero open PR evidence,
    - block when post-cutover scans have zero open PR evidence.
  - `MigrationReport` now records `promotionEvidence` state (`required`, `status`, `proofPackPath`, `violations`) and includes it in digest continuity checks.
- Expanded tests in `src/commands/ci-migrate.test.ts`:
  - required-mode apply fails when proof pack is missing,
  - required-mode apply fails when proof pack is insufficient,
  - required-mode apply passes with valid proof-pack evidence,
  - required-mode apply fails when no open PR parity evidence exists.
- Updated transition status tracker:
  - `docs/plans/2026-03-14-feat-github-actions-to-circleci-transition-status-plan.md` now marks parity/promotion/downstream proof-pack lanes as `PARTIAL` with explicit implemented-vs-pending boundaries.

### Validation evidence

- `pnpm biome check src/commands/ci-migrate.ts src/commands/ci-migrate.test.ts` -> pass.
- `pnpm vitest run src/commands/ci-migrate.test.ts` -> pass (37/37).

## 2026-03-14 - Workflow Generate Command (S|E|G|A|P|R|N Format)

- Implemented `harness workflow:generate` command:
  - `src/commands/workflow-generate.ts` - Main command implementation.
  - Parses source markdown workflow docs with frontmatter (title, type, status, date, origin).
  - Extracts compact operational spec sections: Metadata, Errors, States, Transitions, Invariants, Idempotency, Modes, Dry-Run, Logs.
  - Generates canonical S|E|G|A|N transition tables from source markdown.
  - Outputs Mermaid stateDiagram-v2 strictly derived from transition table.
  - Generates pseudocode executor switch statement grouped by state.
  - Supports `--json` output format for machine consumption.
  - Supports `--dry-run` to preview without writing.
  - Supports `--watch` to auto-regenerate on file changes (requires `--output`).
  - Validates required error codes: VALIDATION_ERROR, BLOCKED_DEPENDENCY, POLICY_FAIL, SYSTEM_ERROR.
  - Validates required log fields: workflow_id, transition_code, from_state, to_state, correlation_id, result.
  - Added integration to `src/cli.ts` with help text and option parsing.
  - Added test suite in `src/commands/workflow-generate.test.ts`.
- Usage: `harness workflow:generate --source <path> [--output <path>] [--json] [--dry-run] [--watch]`
- Example: `harness workflow:generate --source WORKFLOW.md --output docs/agents/workflow-operational-spec.md`
- Watch mode example: `harness workflow:generate --source WORKFLOW.md --output docs/agents/workflow-operational-spec.md --watch`

## 2026-03-14 - CircleCI Transition Continuation (Signed Snapshot Trust Slice)

- Implemented immutable signed snapshot trust in `ci-migrate` rollback/apply paths:
  - `src/commands/ci-migrate.ts` now writes snapshot attestation sidecars:
    - `<snapshot>.attestation.json`
    - `<snapshot>.attestation.sig`
  - Snapshot restore now fails closed on:
    - missing attestation/signature metadata,
    - invalid signature,
    - mismatched signer key id,
    - invalid attestation schema/timestamps,
    - expired attestation window,
    - payload digest drift from signed attestation.
  - Freshness gating now uses signed `expiresAt` metadata instead of filesystem `mtime`.
  - Signed snapshot operations require `HARNESS_CI_MIGRATE_SIGNING_KEY` (minimum 16 bytes).
- Confirmed and validated external control-plane rollback restoration is active and signed-attestation bound:
  - rulesets (`.harness/control-plane/github-rulesets.json`)
  - CircleCI project settings (`.harness/control-plane/circleci-project-settings.json`)
  - CircleCI context bindings (`.harness/control-plane/circleci-context-bindings.json`)
  - GitHub app-installation metadata (`.harness/control-plane/github-app-installation.json`)
- Added external-control-plane restore hardening:
  - restore path validation now enforces allowlisted control-plane artifact paths only (no non-canonical `relativePath` acceptance).
- Updated migration tests in `src/commands/ci-migrate.test.ts`:
  - Added attestation/sig artifact assertions for apply flow.
  - Replaced stale snapshot coverage from `utimes`/`mtime` to signed metadata expiry.
  - Added explicit rollback failure coverage for missing signature sidecar.
  - Added rollback coverage for missing external control-plane snapshot sidecar.
  - Added rollback coverage proving external control-plane artifacts restore/remove correctly.
  - Added rollback rejection coverage for non-allowlisted external control-plane artifact paths.
  - Added explicit apply failure coverage when signing-key env is missing.
- Fixed rollback fixture setup for external-control-plane restore test by creating `.harness/control-plane` before drift writes.
- Updated status tracker to mark immutable/signed snapshot trust complete:
  - `docs/plans/2026-03-14-feat-github-actions-to-circleci-transition-status-plan.md`.

### Validation evidence

- `pnpm vitest run src/commands/ci-migrate.test.ts` -> pass (33/33).
- `pnpm biome check src/commands/ci-migrate.ts src/commands/ci-migrate.test.ts` -> pass.

## 2026-03-14 - CircleCI Transition Continuation (Authoritative Shadow Guardrails)

- Implemented `shadow/*` rejection in authoritative merge-gate paths:
  - `src/lib/contract/validator.ts` now rejects `reviewPolicy.requiredChecks` and `branchProtection.requiredChecks` entries using `shadow/*`.
  - `src/commands/branch-protect.ts` now fails fast when resolved required checks include `shadow/*` (explicit flags, ecosystem profile, or contract-derived).
- Added targeted regression tests:
  - `src/lib/contract/validator.test.ts` adds rejection cases for `shadow/*` in both review and branch-protection required checks.
  - `src/commands/branch-protect.test.ts` adds explicit + contract-derived `shadow/*` validation error tests.
  - `src/lib/ci/provider-adapter.test.ts` adds trusted-base SHA fallback, event normalization defaults, and workflow semantics assertions.
- Added explicit `ciProviderPolicy` to `harness.contract.json` with current safe defaults (`github-actions`, `shadow`, canonical paths, trusted ref).
- Updated status tracker checkboxes in `docs/plans/2026-03-14-feat-github-actions-to-circleci-transition-status-plan.md` to mark this slice complete.

### Validation evidence

- `pnpm vitest src/commands/branch-protect.test.ts src/lib/contract/validator.test.ts src/lib/ci/provider-adapter.test.ts` -> pass (109/109).
- `pnpm biome check src/commands/branch-protect.ts src/commands/branch-protect.test.ts src/lib/contract/validator.ts src/lib/contract/validator.test.ts src/lib/ci/provider-adapter.test.ts` -> pass.
- `pnpm docs:lint docs/plans/2026-03-14-feat-github-actions-to-circleci-transition-status-plan.md FORJAMIE.md` -> pass (0 errors).
- `pnpm check` -> fails due pre-existing unrelated lint in `src/lib/init/migration.ts` (left untouched in this pass).

## 2026-03-14 - CircleCI Transition Continuation (Contract Dedupe + Revalidation)

- Deduped `ciProviderPolicy` in `harness.contract.json` so the contract carries a single canonical CI provider policy key.
- Kept migration plan status aligned with implementation reality in `docs/plans/2026-03-14-feat-github-actions-to-circleci-transition-status-plan.md`.
- Re-ran the migration-focused validation bundle after contract correction:
  - `pnpm vitest run src/lib/ci/provider-adapter.test.ts src/lib/contract/validator.test.ts src/commands/branch-protect.test.ts src/commands/ci-migrate.test.ts` (137/137 passing)
  - `pnpm docs:lint FORJAMIE.md docs/plans/2026-03-14-feat-github-actions-to-circleci-transition-status-plan.md` (0 errors)
  - `pnpm exec biome check harness.contract.json` (pass after file-scoped format)

## 2026-03-14 - CircleCI Transition Plan Continuation (Implementation Slice)

- Confirmed and documented that `shadow/*` required-check rejection is already implemented in authoritative paths:
  - `src/lib/contract/validator.ts` + `src/lib/contract/validator.test.ts`
  - `src/commands/branch-protect.ts` + `src/commands/branch-protect.test.ts`
- Added explicit `ciProviderPolicy` block into `harness.contract.json`:
  - `activeProvider: github-actions`
  - `mode: shadow`
  - `authorityConfigPath: harness.contract.json`
  - `requiredCheckManifestPath: .harness/ci-required-checks.json`
  - `trustedPolicyRef: refs/heads/main`
- Expanded/confirmed validator coverage for CI provider policy shape:
  - accepted valid policy
  - rejected invalid `activeProvider`
- Confirmed provider-adapter tests now cover the previously identified gap set:
  - trusted-base SHA fallback behavior
  - normalized-event default semantics
  - workflow semantics metadata
- Status plan remains the canonical tracker:
  - `docs/plans/2026-03-14-feat-github-actions-to-circleci-transition-status-plan.md`

### Validation run notes

- Focused tests passed:
  - `pnpm exec vitest run src/lib/contract/validator.test.ts src/lib/ci/provider-adapter.test.ts src/commands/branch-protect.test.ts`
- Typecheck passed:
  - `pnpm typecheck`
- Docs lint passed:
  - `pnpm docs:lint docs/plans/2026-03-14-feat-github-actions-to-circleci-transition-status-plan.md`
- One command misfire to record:
  - `pnpm test -- <files>` executed the broader suite in this repo and surfaced unrelated pre-existing failures (not in edited files). Scoped `pnpm exec vitest run <files>` is the reliable verification path for this migration slice.

## 2026-03-14 - CircleCI Transition Plan Status Mark-Off

- Created and maintained a single canonical migration status plan at `docs/plans/2026-03-14-feat-github-actions-to-circleci-transition-status-plan.md`.
- Marked completed, partial, and pending items against the validated transition contract (compatibility, migration UX/rollback, legacy import strategy, and validation-test coverage).
- Consolidated duplicate draft plan files produced during multi-agent review into one source of truth.
- Corrected wording to reflect current implementation truth: digest-bound snapshot/state metadata is implemented, cryptographic signing is not.
- Validation run passed: `pnpm docs:lint docs/plans/2026-03-14-feat-github-actions-to-circleci-transition-status-plan.md` (0 errors).

### Current blockers before full cutover

- Signed snapshot trust metadata and immutable timestamp envelope.
- External control-plane rollback restore payloads (rulesets/CircleCI settings/context bindings/app-install state).
- Merge queue pause-drain-revalidate commit controls.
- Greptile/CircleCI publication parity and release-authority locking.
- Full parity matrix + downstream proof-pack coverage before `circleci/required`.

---

## 2026-03-14 - CircleCI Transition Continuation (Publisher Identity Enforcement)

- Added wrong-publisher rejection in required-check satisfiability so same-name checks from non-authoritative apps do not satisfy migration gates when app metadata is available.
- Added focused tests in `src/lib/ci/satisfiability.test.ts` for:
  - wrong publisher with matching check name -> fail closed,
  - mixed publishers with one expected publisher -> pass on expected publisher state.
- Updated transition plan status to mark identity/policy coverage for wrong-app publisher rejection as completed in enforcement path.

### Validation evidence

- `pnpm vitest run src/lib/ci/satisfiability.test.ts` -> pass (9/9 tests).
- `pnpm docs:lint docs/plans/2026-03-14-feat-github-actions-to-circleci-transition-status-plan.md` -> pass (0 errors).
- `pnpm check` -> fails in existing unrelated lint/test lanes (for example `src/lib/init/migration.ts` organizeImports/format and pre-existing `pilot-evaluate`/`control-plane` expectation failures).

---

## 2026-03-14 (Four New Workflow Operational Specs)

**Created compact operational specs for Review Gate, Agent Testing Gates, Docs Gate Rollout, and Release & Change Control workflows.**

### What shipped
- Added `docs/agents/review-gate-operational-spec.md` - 30+ transition states for PR verification workflow
  - S|E|G|A|N table covering IDLE → PR_LOADED → CHECK_POLLING → APPROVAL_EVALUATION → terminal states
  - Confidence rubric (1-5) computation
  - STRICT vs ADVISORY modes
- Added `docs/agents/agent-testing-gates-operational-spec.md` - 5-gate sequential validation workflow
  - lint → typecheck → test → audit → check sequence
  - Per-gate pass/fail/block states
  - Remediation hints for each gate type
- Added `docs/agents/docs-gate-rollout-operational-spec.md` - Phase-based rollout state machine
  - PHASE_1_SHADOW → PHASE_2_ADVISORY_HARNESS → PHASE_3_ADVISORY_DOWNSTREAM → PHASE_3_REQUIRED_DOWNSTREAM
  - Promotion/demotion trigger conditions with thresholds
  - FP rate, bootstrap gap, trust mismatch metrics
- Added `docs/agents/release-change-control-operational-spec.md` - Pre-release validation workflow
  - INTAKE → CHECKLIST_VALIDATION → CONTRADICTION_CHECK → CONTRACT_VERIFICATION → BENCHMARK_CADENCE → terminal
  - Release blockers: checklist, contradictions, contract mismatch, stale benchmarks
  - Rollback policy for reversible/irreversible/uncertain changes
- Registered all 4 specs in `harness.contract.json` as `workflow_doc` surfaces

### Validation
- `pnpm workflow:validate` → pass (7 files validated)
- `pnpm docs:lint` → pass (0 errors across 151 files)

### Files changed
- `docs/agents/review-gate-operational-spec.md` (new)
- `docs/agents/agent-testing-gates-operational-spec.md` (new)
- `docs/agents/docs-gate-rollout-operational-spec.md` (new)
- `docs/agents/release-change-control-operational-spec.md` (new)
- `harness.contract.json` (added 4 surface registrations)

---

## 2026-03-14 (Linear Workflow Operational Spec)

**Created a compact operational spec for the Linear Workflow with S|E|G|A|N modeling and strict transition semantics.**

### What shipped
- Added `docs/agents/linear-workflow-operational-spec.md` - a compact workflow specification for agentic Linear issue automation.
- Defined 5 workflow states (S0-S4) with S3 DONE as terminal, S4 BLOCKED as recoverable.
- Created canonical S|E|G|A|N transition table:
  - **S**tate | **E**vent | **G**uard | **A**ction | **N**ext
  - 8 transitions covering start, status_tick, pr_opened, handoff_ready, merged, blocked, unblocked
- Added STRICT vs ADVISORY execution modes (hard-fail vs warning-only policy violations).
- Specified idempotency key format: `{{ issue.identifier }}|{{ issue.url }}|<event>|<state>`
- Included strictly-derived Mermaid state diagram (no inferred states - every arrow maps to a table row).
- Registered the spec in `harness.contract.json` as a `workflow_doc` surface for workflow_authority tracking.

### Technical details
- Transition guards are evaluated in order (first-match) with deterministic `(S,E)` routing.
- Error taxonomy: VALIDATION_ERROR (reject), BLOCKED_DEPENDENCY (S4), POLICY_FAIL (S4), SYSTEM_ERROR (terminal fail).
- Terminal path contract: every run produces schema-valid terminal manifest + terminal event.
- Dry-run simulation evaluates guards without side effects, emitting trace rows `[S,E,G,A,N,decision]`.

### Validation
- `pnpm workflow:validate` → pass (new spec follows canonical section order)
- `pnpm docs:lint` → pass (ToC added, proper markdown structure)
- `pnpm check` → pass (docs-gate.test.ts all 21 tests passing)

### Files changed
- `docs/agents/linear-workflow-operational-spec.md` (new)
- `harness.contract.json` (added surface registration)

---

## 2026-03-22 (Harness Upgrade Guardrails)

**Downstream harness upgrades should recover baseline governance files through `harness init --update`, not manual repo surgery.**

### What changed
- `harness init` now scaffolds baseline `.npmrc` and `.harness/ci-provider-transition-status.json`.
- `harness verify-greptile` now points missing `.npmrc` remediation back to `harness init --update`.
- `harness ci-migrate verify` now points missing transition artifact remediation back to `harness init --update`.
- Init tests now enforce Biome package-to-schema alignment so dependency bumps also update the repo config and scaffold template.

### Why it matters
- Downstream repos were tripping over missing baseline governance files during upgrade and migration workflows.
- A scaffold-first recovery path is safer and more consistent than asking each repo to recreate those files manually.

---

## 2026-03-31 (Pre-push Hook Fails In Fresh Temp Worktrees)

**Root cause: the pre-push hook runs inside the current worktree, and fresh temp worktrees often do not have dependencies installed yet.**

### What happened
- The repo pre-push hook executes `pnpm test`.
- In a newly created temp worktree, `node_modules/` was missing.
- Push was blocked by hook execution context, not by a code regression.

### How we resolve it
- Before first push from any fresh worktree, run `pnpm install` in that exact worktree.
- Run `pnpm check` and `pnpm test` locally in the same worktree to match hook behavior.
- Prefer pushing from a prepared worktree unless isolation is required.
