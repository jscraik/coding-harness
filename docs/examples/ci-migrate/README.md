# CI Migration Artifact Templates

These templates are tracked examples for strict `harness ci-migrate verify` preflight inputs.

## Table of Contents
- [Files](#files)
- [Usage](#usage)
- [Merge-Queue Orchestrator Template](#merge-queue-orchestrator-template)
- [Break-Glass Governance Policy Template](#break-glass-governance-policy-template)

## Files
- `ci-required-checks.template.json`: starter manifest with required check identity metadata.
- `ci-provider-transition-status.template.json`: starter transition status artifact.
- `ci-migrate-break-glass-policy.template.json`: governance policy for signer allowlist, TTL cap, and dual-approval rollback-weakening requirements.
- `merge-queue-cutover-orchestrator.template.sh`: example executable that emits signed merge-queue evidence (`ci-migrate-merge-queue-evidence/v2`) with identity binding.

## Usage
1. Copy each template into your repository-local `.harness/` directory.
2. Rename to:
   - `.harness/ci-required-checks.json`
   - `.harness/ci-provider-transition-status.json`
   - `.harness/control-plane/ci-migrate-break-glass-policy.json`
3. Update values to match your repository and provider state.
4. Run `harness ci-migrate verify`.

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
