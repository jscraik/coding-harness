# Runner Trust Model

**Issue:** JSC-115
**Status:** Active
**Last reviewed:** 2026-04-19

## Overview

This document describes the runner trust boundaries for coding-harness CI/CD across both GitHub Actions and CircleCI.

## GitHub Actions

### Runner type

All GitHub Actions workflows use `ubuntu-latest` (GitHub-hosted runners).

### Trust rationale

- GitHub-hosted runners provide ephemeral, isolated virtual machines with a clean slate per job.
- No persistent state between runs; no custom runner software.
- Suitable for: release publishing and provenance attestation.
- **Not suitable for:** workloads requiring self-hosted GPU, special hardware, or network access to internal services.

### Token permissions

| Workflow | `contents` | `pull-requests` | `id-token` | `attestations` |
| --- | --- | --- | --- | --- |
| `release-private-npm.yml` | write | — | write | write |

### Action pinning

All third-party actions are pinned to immutable commit SHAs with version comments:

- `actions/checkout@11bd7190...` # v4.2.2
- `actions/setup-node@49933ea5...` # v4
- `pnpm/action-setup@41ff7265...` # v4
- `actions/upload-artifact@ea165f8d...` # v4.6.2
- `actions/attest-build-provenance@977bb373...` # v3

### Workflow protection

- All `.github/workflows/**` files require review via CODEOWNERS.
- No `pull_request_target` usage in any workflow.
- No inline secret handling; all secrets reference GitHub Actions secrets.
- No `env` injection from untrusted PR metadata into shell commands.

## CircleCI

### Runner type

CircleCI uses the `cimg/node:24.13` Docker convenience image on GitHub-hosted infrastructure.

### Trust rationale

- CircleCI runs on CircleCI-managed infrastructure with ephemeral containers.
- Docker image is pinned to a specific minor version (`24.13`) for reproducibility.
- `resource_class: small` provides a minimal compute allocation.
- No SSH access to runners; no persistent storage between runs.

### Token handling

| Secret | Usage | Scope |
| --- | --- | --- |
| `NPM_TOKEN` | optional token fallback for npm publish (release workflow only) | npm registry |
| `GITHUB_PERSONAL_ACCESS_TOKEN` | GitHub API interactions | Repository-scoped |
| `SNYK_TOKEN` | Snyk CircleCI orb authentication for dependency scanning | Snyk project/org scope |

### Hardening measures

- Docker image pinned to specific minor version (`cimg/node:24.13`)
- `resource_class: small` for minimal privilege
- No custom runner software or extensions
- All secrets stored as CircleCI project environment variables

## Trust boundary summary

| Boundary | GitHub Actions | CircleCI |
| --- | --- | --- |
| Runner host | GitHub-managed | CircleCI-managed |
| Isolation | Ephemeral VM | Ephemeral Docker container |
| Image pinning | SHA-pinned actions | Minor-version pinned image |
| Token scope | Minimal per-workflow `permissions` | Project-level env vars |
| Workflow protection | CODEOWNERS review required | Config in repo (same review) |
| Self-hosted runners | Not used | Not used |

## Review cadence

This document should be reviewed:
- When adding new CI workflows
- When changing runner types or Docker images
- When modifying token permissions
- Quarterly as part of security posture review
