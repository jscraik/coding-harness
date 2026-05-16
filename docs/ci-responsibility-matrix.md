---

last_validated: 2026-04-26

---

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

This document is the operational source of truth for CI ownership intent. `harness.contract.json`, `.harness/ci-required-checks.json`, and workflow files are executable enforcement artifacts and must be kept in lockstep with this matrix.

## Ownership Principles

1. **One responsibility, one owner.** Each CI gate has exactly one canonical system.
2. **No duplicated gates.** The same check must not run in both systems unless explicitly transitional.
3. **Branch protection references canonical checks only.** The required-check list must match the owning system `githubCheckName` values.
4. **Publishing is single-owner.** GitHub Actions is the only publish path in this repository.
5. **Repo-run security scanning is single-owner.** CircleCI is the only repo-run security scan owner in this repository; independent app checks such as Semgrep Cloud stay external required checks.

## Responsibility Assignment

### CircleCI Owns

| Responsibility                                                                                                                                            | Workflow        | Job                                 | Trigger                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ----------------------------------- | ------------------------------------------------------ |
| PR governance and quality checks (`pr-template`, `linear-gate`, `risk-policy-gate`, `docs-gate`, `lint`, `typecheck`, `test`, `audit`, `check`, `memory`) | `pr-pipeline`   | `run-governance-check` fan-out jobs | Pull request and merge queue events via GitHub webhook |
| Security scanning (`security-scan`)                                                                                                                       | `security-scan` | `security-scan`, `snyk-dependency-scan` | Pull request and merge queue events via GitHub webhook |
| Environment and dependency policy checks (`dependency-scan`, `orb-pinning`)                                                                               | `pr-pipeline`   | `dependency-scan`, `orb-pinning`    | Pull request and merge queue events via GitHub webhook |

### GitHub Actions Owns

| Responsibility                                        | Workflow              | Job       | Trigger                                       | Workflow File                               |
| ----------------------------------------------------- | --------------------- | --------- | --------------------------------------------- | ------------------------------------------- |
| npm publish + provenance attestation + GitHub Release | `release-private-npm` | `publish` | `Semver` tag push and guarded manual dispatch | `.github/workflows/release-private-npm.yml` |

### Not Owned by Either CI System

| Check Name                    | Source                   | Notes                                        |
| ----------------------------- | ------------------------ | -------------------------------------------- |
| `CodeRabbit`                  | CodeRabbit GitHub App    | Independent review bot                       |
| `semgrep-cloud-platform/scan` | Semgrep Cloud GitHub App | Independent Semgrep Cloud code scanning gate |

## Canonical Status Checks

These are the check names that GitHub branch protection must reference:

| Canonical Check Name          | Owning System     | Workflow File          |
| ----------------------------- | ----------------- | ---------------------- |
| `pr-pipeline`                 | CircleCI          | `.circleci/config.yml` |
| `security-scan`               | CircleCI          | `.circleci/config.yml` |
| `CodeRabbit`                  | CodeRabbit App    | (external)             |
| `semgrep-cloud-platform/scan` | Semgrep Cloud App | (external)             |

All harness governance checks (`pr-template`, `linear-gate`, `risk-policy-gate`, `docs-gate`, `lint`, `typecheck`, `test`, `audit`, `check`, `memory`) are tracked as CircleCI fan-out jobs under the `pr-pipeline` workflow.

## Release Path

```text
Developer pushes tag v1.2.3
         |
         +---> GitHub Actions: release-private-npm / publish
                 1. pnpm check
                 2. pnpm build
                 3. Generates SBOM (cyclonedx-npm)
                 4. Smoke tests packed CLI artifact
                 5. Verifies tag == package.json version
                 6. Publishes to npm (token or OIDC)
                 7. Generates provenance attestation (OIDC)
                 8. Verifies attestation
                 9. Creates GitHub Release with CHANGELOG.md notes
```

**Publish authority: GitHub Actions only.** CircleCI has no publish workflow in this repository.

## Current State

The repository is in a **CircleCI-primary state**:

- CircleCI is the canonical owner for PR governance and security checks.
- The CircleCI `security-scan` workflow runs repo-owned Semgrep and report-only Snyk lanes while preserving the single GitHub check-run name `security-scan`.
- GitHub Actions is retained only for release publishing at `.github/workflows/release-private-npm.yml`.
- `.harness/ci-required-checks.json` maps `security-scan` to CircleCI, `CodeRabbit` to the CodeRabbit app, and `semgrep-cloud-platform/scan` to the Semgrep Cloud app.

## Target State

Current target:

1. CircleCI remains the sole owner of non-release CI checks.
2. GitHub Actions remains release-only.
3. Branch protection references `pr-pipeline`, `security-scan`, `CodeRabbit`, and `semgrep-cloud-platform/scan`.
4. No fallback or duplicate non-release workflows exist in `.github/workflows/`.

## Migration Rules

### Moving a responsibility from CircleCI to GitHub Actions

1. Add the gate to the target GitHub Actions workflow.
2. Update `harness.contract.json` and `.harness/ci-required-checks.json` ownership metadata.
3. Remove the gate from `.circleci/config.yml`.
4. Update this matrix.
5. Verify branch protection check names remain canonical.

### Moving a responsibility from GitHub Actions to CircleCI

1. Add the gate to `.circleci/config.yml` with explicit check ownership.
2. Update `harness.contract.json` and `.harness/ci-required-checks.json` ownership metadata.
3. Remove the gate from any non-release GitHub Actions workflow.
4. Update this matrix.
5. Verify branch protection check names remain canonical.

## Overlap Detection

Run `pnpm workflow:validate` to validate workflow documentation contract shape.

For ownership overlap detection, manually verify:

1. No non-release gate runs in both CircleCI and GitHub Actions.
2. Branch protection required checks match actual check names.
3. `.harness/ci-required-checks.json` provider ownership matches the workflow owner.
4. GitHub Actions includes only release workflows.

## Secrets and Runtime Parity

| Dimension           | CircleCI                                          | GitHub Actions                                 |
| ------------------- | ------------------------------------------------- | ---------------------------------------------- |
| Node.js version     | `cimg/node:24.13`                                 | `actions/setup-node@v6` (node-version: 24)     |
| pnpm version        | npm install --global `pnpm@10.33.0`               | `pnpm/action-setup@v5` (version: `10.33.0`)    |
| Install command     | `pnpm install --frozen-lockfile --prefer-offline` | `pnpm install --frozen-lockfile`               |
| Security scan lane  | `security-scan` workflow in `.circleci/config.yml` with Semgrep and report-only Snyk jobs | N/A (release-only)                             |
| Snyk token          | `SNYK_TOKEN` project environment variable for the report-only Snyk CLI step | N/A                                      |
| npm publish token   | N/A (does not publish)                            | `NPM_TOKEN` secret or OIDC (`id-token: write`) |
| Attestation signing | N/A                                               | OIDC (`actions/attest-build-provenance`)       |
