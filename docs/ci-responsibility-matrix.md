# CI Responsibility Matrix

## Table of Contents

- [Purpose](#purpose)
- [Ownership Principles](#ownership-principles)
- [Responsibility Assignment](#responsibility-assignment)
- [Canonical Status Checks](#canonical-status-checks)
- [Release Path](#release-path)
- [Current State](#current-state)
- [Target State](#target-state)
- [Migration Rules](#migration-rules)
- [Overlap Detection](#overlap-detection)
- [Secrets and Runtime Parity](#secrets-and-runtime-parity)

## Purpose

Define a non-overlapping ownership model between CircleCI and GitHub Actions so the repository avoids duplicate gates, conflicting release paths, and ambiguous merge requirements.

This document is the authoritative source for CI ownership. When `harness.contract.json`, `.harness/ci-required-checks.json`, or workflow files disagree, this matrix wins.

## Ownership Principles

1. **One responsibility, one owner.** Each CI gate has exactly one canonical system.
2. **No duplicated gates.** The same check must not run in both systems unless explicitly transitional (see Migration Rules).
3. **Branch protection references the canonical check only.** The GitHub branch protection required-checks list must match the `githubCheckName` of the owning system.
4. **Publishing is single-owner.** Only one system can publish packages. Currently: GitHub Actions exclusively.
5. **Security scanning is single-owner.** Currently: GitHub Actions exclusively.

## Responsibility Assignment

### CircleCI Owns

| Responsibility | Workflow | Job | Trigger |
|---|---|---|---|
| PR build + lint + typecheck + test + audit + docs-lint + skill validation | `pr-workflow` | `pr-fast` | Branch push (not main) |
| PR pilot-evaluate tests (isolated, long-running) | `pr-workflow` | `pr-slow` | Branch push (not main) |
| PR status aggregation (canonical `pr-pipeline` check) | `pr-workflow` | `pr-pipeline` | After pr-fast + pr-slow pass |
| Release candidate validation (check + build + tag verification) | `release-workflow` | `release` | `Semver` tag push |

CircleCI does **not** publish. It stops at build verification.

### GitHub Actions Owns

| Responsibility | Workflow | Job | Trigger | Workflow File |
|---|---|---|---|---|
| Security scanning (BetterLeaks + Trivy + Semgrep) | `security-scan` | `secret-scan` | Push to main, PR, `merge_group` | `.github/workflows/secret-scan.yml` |
| npm publish + SBOM + provenance attestation + GitHub Release | `release-private-npm` | `publish` | `Semver` tag push | `.github/workflows/release-private-npm.yml` |
| **PR fallback CI** (emergency dispatch only) | `pr-pipeline-bridge` | `pr-pipeline` | `workflow_dispatch` only (disabled as automatic gate) | `.github/workflows/pr-pipeline-bridge.yml` |

### Not Owned by Either CI System

| Check Name | Source | Notes |
|---|---|---|
| `CodeRabbit` | CodeRabbit GitHub App | Independent review bot |
| `pr-template` | Harness governance gate | Validated inside `pr-pipeline` |
| `linear-gate` | Harness governance gate | Validated inside `pr-pipeline` |
| `risk-policy-gate` | Harness governance gate | Validated inside `pr-pipeline` |

## Canonical Status Checks

These are the check names that GitHub branch protection must reference:

| Canonical Check Name | Owning System | Workflow File |
|---|---|---|
| `pr-pipeline` | CircleCI (primary) / GitHub Actions (fallback) | `.circleci/config.yml` / `.github/workflows/pr-pipeline-bridge.yml` |
| `security-scan` | GitHub Actions | `.github/workflows/secret-scan.yml` |
| `CodeRabbit` | CodeRabbit App | (external) |

All harness-internal governance checks (`lint`, `typecheck`, `test`, `audit`, `docs-gate`, `skill-validate`, `workflow-validate`, etc.) roll up into the single `pr-pipeline` check. They are **not** independent GitHub status checks and must not appear in branch protection as separate required checks.

## Release Path

```
Developer pushes tag v1.2.3
         |
         +---> CircleCI: release-workflow / release
         |       1. Validates CIRCLE_TAG is set
         |       2. pnpm check (full suite)
         |       3. Verifies tag == package.json version
         |       4. Verifies tag commit is ancestor of origin/main
         |       5. pnpm build
         |       6. STOP -- does NOT publish
         |
         +---> GitHub Actions: Release to private npm / publish
                 1. pnpm check
                 2. pnpm build
                 3. Generates SBOM (cyclonedx-npm)
                 4. Smoke tests packed CLI artifact
                 5. Verifies tag == package.json version
                 6. Publishes to npm (token or OIDC)
                 7. Generates build provenance attestation (OIDC)
                 8. Creates GitHub Release with CHANGELOG.md notes
```

**Publish authority: GitHub Actions only.** The CircleCI `release` job validates and builds but explicitly does not publish. The comment in `.circleci/config.yml` states: "Canonical publish path: .github/workflows/release-private-npm.yml."

## Current State

The repository is in a **bridge-primary state**:

- **CircleCI free-tier** accepts pipelines but never dispatches them to runners. All pipelines remain in `state: "created"` with `build_num: null` — the workflow-level `status` fields reflect config validation only, not actual execution. No job in the project's history has ever run on a CircleCI runner.
- **`harness.contract.json`** declares `ciProviderPolicy.migrationStage: "circleci-only"` — this does not match operational reality since CircleCI never executes.
- **The `pr-pipeline-bridge` GitHub Actions workflow** was previously the **only functioning PR gate**, but has now been disabled to `workflow_dispatch: {}` only.
- **No CI system is currently gating PRs automatically.** CircleCI never runs; the bridge is dispatch-only. Re-enabling the bridge as an automatic gate is the fastest path to restoring PR CI.
- **Release validation**: GitHub Actions `publish` handles tag-driven release (build, publish, attestation, GitHub Release). CircleCI `release` job will not execute on tag pushes.

**Action required:** Either upgrade the CircleCI plan to get runner capacity, or re-enable the `pr-pipeline-bridge` as an automatic gate to restore PR CI coverage.

### Known Overlaps (Transitional)

These overlaps exist because both CI systems define the same gates. CircleCI never executes (no runner capacity), so only the GitHub Actions bridge was ever functional. The bridge is now dispatch-only, so no active overlap in practice — but the config duplication remains.

| Gate | CircleCI Job | GitHub Actions Job | Status |
|---|---|---|---|
| Lint | `pr-fast` | `pr-pipeline` (bridge) | Duplicate — bridge now dispatch-only |
| Typecheck | `pr-fast` | `pr-pipeline` (bridge) | Duplicate — bridge now dispatch-only |
| Tests | `pr-fast` + `pr-slow` | `pr-pipeline` (bridge) | Duplicate — bridge now dispatch-only |
| Audit | `pr-fast` | `pr-pipeline` (bridge) | Duplicate — bridge now dispatch-only |
| Docs lint | `pr-fast` | `pr-pipeline` (bridge) | Duplicate — bridge now dispatch-only |
| Skill/workflow validation | `pr-fast` | `pr-pipeline` (bridge) | Duplicate — bridge now dispatch-only |
| Tag validation + build | `release` | `publish` | Intentional — both validate independently; only GHA publishes |

## Target State

**Prerequisite:** Either upgrade CircleCI to a plan with runner capacity, or transition fully to GitHub Actions.

When the prerequisite is met:

1. **Primary PR gate runs in one system** with the `pr-pipeline` status context
2. **`pr-pipeline-bridge.yml`** is either removed (if CircleCI gets runners) or becomes the primary gate (if transitioning to GitHub Actions)
3. **GitHub Actions retains exclusive ownership** of security scanning and release/publish
4. **No duplicate gates** — each responsibility runs in exactly one system
5. **Branch protection** references `pr-pipeline` (owning system) + `security-scan` (GitHub Actions) + `CodeRabbit`

Until the prerequisite is met, the bridge workflow should be re-enabled as an automatic gate to restore PR CI coverage.

## Migration Rules

### Moving a responsibility from CircleCI to GitHub Actions

1. Add the gate to the target GitHub Actions workflow
2. Update `harness.contract.json` `ciProviderPolicy` to reflect the new owner
3. Update `.harness/ci-required-checks.json` `sourceAppSlug` for affected checks
4. Remove the gate from `.circleci/config.yml`
5. Update this matrix document
6. Verify branch protection still references the canonical check name

### Moving a responsibility from GitHub Actions to CircleCI

1. Add the gate to the target CircleCI job
2. Update `harness.contract.json` and `.harness/ci-required-checks.json`
3. Remove the gate from the GitHub Actions workflow
4. Update this matrix document
5. Verify the `pr-pipeline` CircleCI check still covers the gate

### Transitional coexistence

- During migration, both systems may run the same gate temporarily
- Document the overlap in the Known Overlaps table above
- Set a time limit for transitional duplication (default: 30 days)
- After the time limit, the overlap becomes a policy violation

## Overlap Detection

Run `pnpm workflow:validate` to detect CI ownership conflicts. The validator checks:

1. No gate runs in both CircleCI and GitHub Actions without a documented transitional entry
2. Branch protection required checks match actual GitHub check names
3. `ci-required-checks.json` `sourceAppSlug` matches the owning system
4. No publish job exists in CircleCI

## Secrets and Runtime Parity

| Dimension | CircleCI | GitHub Actions |
|---|---|---|
| Node.js version | `cimg/node:24.13` | `actions/setup-node@v4` (node-version: 24) |
| pnpm version | npm install --global pnpm@10.0.0 | `pnpm/action-setup@v4` (version: 10.0.0) |
| Install command | `pnpm install --frozen-lockfile` (PR) / `pnpm install` (release) | `pnpm install --frozen-lockfile` |
| npm publish token | N/A (does not publish) | `NPM_TOKEN` secret or OIDC (`id-token: write`) |
| Attestation signing | N/A | OIDC (`actions/attest-build-provenance`) |
| Resource class | `medium` (2 vCPU / 4 GB) — free-tier max | `ubuntu-latest` (2 vCPU / 7 GB) |
