---
last_validated: 2026-04-18
---

# CI Migration Artifact Templates

These templates are tracked examples for strict `harness ci-migrate verify` preflight inputs.

## Table of Contents
- [Files](#files)
- [Usage](#usage)
- [Merge-Queue Orchestrator Template](#merge-queue-orchestrator-template)
- [Break-Glass Governance Policy Template](#break-glass-governance-policy-template)
- [Parity Proof Harvest Manifest Template](#parity-proof-harvest-manifest-template)
- [Parity Proof Harvest Orchestrator Template](#parity-proof-harvest-orchestrator-template)

## Files
- `ci-required-checks.template.json`: starter manifest with required check identity metadata.
- `ci-provider-transition-status.template.json`: starter transition status artifact.
- `ci-migrate-break-glass-policy.template.json`: governance policy for signer allowlist, TTL cap, and dual-approval rollback-weakening requirements.
- `merge-queue-cutover-orchestrator.template.sh`: example executable that emits signed merge-queue evidence (`ci-migrate-merge-queue-evidence/v2`) with identity binding.
- `ci-parity-proof-harvest-manifest.template.json`: provider artifact intake and parity/downstream metadata used to generate signed provenance inputs.
- `parity-proof-harvest-orchestrator.template.sh`: example executable that downloads/copies immutable CI artifacts and emits signed provenance input + artifact index artifacts for `--auto-generate-proof-pack`.

## Usage
1. Run `harness ci-migrate bootstrap` to generate a draft `.harness/ci-provider-transition-status.json`
   in your repo (skip-if-exists by default; use `--force` to overwrite).
2. Confirm your CircleCI pipeline is stable, then set `nextGateComplete=true` in the generated file.
3. Commit the file, then run `harness ci-migrate verify`.

For older repos or scaffold repair without running `bootstrap`, you can still copy each template
into your repository-local `.harness/` directory manually:
- `.harness/ci-required-checks.json`
- `.harness/ci-provider-transition-status.json`
- `.harness/control-plane/ci-migrate-break-glass-policy.json`


## Merge-Queue Orchestrator Template
Use `merge-queue-cutover-orchestrator.template.sh` as a starting point for `--merge-queue-orchestrator` automation in required-mode cutovers.

The template expects `ci-migrate` to provide:
- `HARNESS_CI_MIGRATE_SNAPSHOT_ID`
- `HARNESS_CI_MIGRATE_EVIDENCE_PATH`
- `HARNESS_CI_MIGRATE_SIGNING_KEY`
- `HARNESS_CI_MIGRATE_REQUIRE_FULL_LIFECYCLE`
- `HARNESS_CI_MIGRATE_BINDING_REPO_FULL_NAME`
- `HARNESS_CI_MIGRATE_BINDING_HEAD_SHA`
- `HARNESS_CI_MIGRATE_BINDING_TRUSTED_POLICY_REF`
- `HARNESS_CI_MIGRATE_BINDING_AUTHORITY_CONFIG_SHA256`
- `HARNESS_CI_MIGRATE_BINDING_REQUIRED_CHECK_MANIFEST_SHA256`

The orchestrator must emit:
- evidence JSON at `$HARNESS_CI_MIGRATE_EVIDENCE_PATH`
- HMAC signature sidecar at `${HARNESS_CI_MIGRATE_EVIDENCE_PATH}.sig`

## Break-Glass Governance Policy Template
Use `ci-migrate-break-glass-policy.template.json` to define trusted rollback override governance.

For active enforcement, write:
- policy JSON to `.harness/control-plane/ci-migrate-break-glass-policy.json`
- HMAC signature sidecar to `.harness/control-plane/ci-migrate-break-glass-policy.json.sig`

Set policy fields to match your operations model:
- `approverAllowlist`: explicit signer identities accepted in break-glass approvals.
- `maxApprovalTtlHours`: maximum allowed approval lifetime.
- `requireDualApprovalForRollbackWeakening`: require at least two distinct approvers when rollback may weaken required checks/rulesets.

## Parity Proof Harvest Manifest Template
Use `ci-parity-proof-harvest-manifest.template.json` to define immutable CI artifact capture metadata and parity/downstream evidence context.

This template feeds `parity-proof-harvest-orchestrator.template.sh`, which writes:
- `.harness/ci-parity-proof-provenance.input.json`
- `.harness/ci-parity-proof-artifact-index.json`
- `.harness/ci-parity-proof-artifact-index.json.sig`

Each artifact entry supports either:
- `source.path`: copy a local file already harvested by your CI pipeline, or
- `source.url`: fetch from provider APIs (for example GitHub Actions/CircleCI) with optional bearer auth via environment variable.

## Parity Proof Harvest Orchestrator Template
Use `parity-proof-harvest-orchestrator.template.sh` as a starting point for provider artifact intake automation.

Required environment:
- `HARNESS_CI_MIGRATE_SIGNING_KEY`

Optional overrides:
- `HARNESS_CI_MIGRATE_HARVEST_MANIFEST_PATH` (default `.harness/ci-parity-proof-harvest-manifest.json`)
- `HARNESS_CI_MIGRATE_PROVENANCE_INPUT_PATH` (default `.harness/ci-parity-proof-provenance.input.json`)
- `HARNESS_CI_MIGRATE_ARTIFACT_INDEX_PATH` (default `.harness/ci-parity-proof-artifact-index.json`)

Suggested flow:
1. Copy the template script into `.harness/control-plane/parity-proof-harvest-orchestrator` and make it executable.
2. Fill `.harness/ci-parity-proof-harvest-manifest.json`.
3. Run the orchestrator.
4. Run `harness ci-migrate commit --snapshot <id> --auto-generate-proof-pack`.
