# Coding Harness — improved concise map

## Table of Contents
- [Tight definition](#tight-definition)
- [Actual architecture](#actual-architecture)
  - [Bootstrap and repo substrate](#1-bootstrap-and-repo-substrate)
  - [Policy and gate kernel](#2-policy-and-gate-kernel)
  - [Workflow authority layer](#3-workflow-authority-layer)
  - [Evidence and control-plane artifacts](#4-evidence-and-control-plane-artifacts)
  - [CI migration as a major subsystem](#5-ci-migration-as-a-major-subsystem)
  - [Pilot/autonomy governance](#6-pilotautonomy-governance)
- [Cleanest compact map](#cleanest-compact-map)
  - [A. Core harness](#a-core-harness)
  - [B. Workflow authority](#b-workflow-authority)
  - [C. Rollout control](#c-rollout-control)
  - [D. Evidence substrate](#d-evidence-substrate)
  - [E. Adapters and satellites](#e-adapters-and-satellites)
- [Bottom line](#bottom-line)

Source basis: uploaded `coding-harness-main.zip`, inspected locally.

## Tight definition
Coding Harness is a **repo control plane for agentic development**. Its actual code center is:
1. scaffold a governed repo,
2. compile/validate repo contract,
3. run merge and workflow gates,
4. emit evidence-bearing artifacts and run records,
5. govern rollout and rollback for higher-autonomy workflows.

## Actual architecture

### 1. Bootstrap and repo substrate
Primary entrypoint:
- `init` → `src/commands/init.ts` re-exports `src/lib/init/cli.ts`

What this layer owns:
- repo scaffolding
- project-type detection
- contract creation/migration
- rollback and tracked updates
- template rendering
- path-safety checks

Evidence:
- `src/commands/init.ts`
- `src/lib/init/cli.ts`
- `src/lib/init/scaffold.ts` (~4077 LOC)
- `src/commands/init.test.ts` (~3315 LOC)

### 2. Policy and gate kernel
This is the merge/governance enforcement layer.

Core commands:
- `contract`
- `preflight-gate`
- `policy-gate`
- `docs-gate`
- `plan-gate`
- `review-gate`
- `linear-gate`
- `pr-template-gate`
- `evidence-verify`
- `check-authz`
- `check-environment`
- `health`

Why this is a kernel:
- `harness.contract.json` defines risk tiers, merge policy, review policy, branch protection, and tooling policy.
- `src/lib/contract/*` is one of the largest shared libraries in the repo.
- CLI registry wiring groups many governance commands together in `src/lib/cli/command-registry.ts`.

### 3. Workflow authority layer
This is not just docs. It is an executable workflow subsystem.

Core commands:
- `workflow:generate`
- `symphony-check`
- `linear`

Core library:
- `src/lib/workflow-contract/*`

What it owns:
- parser/checker for workflow contracts
- state normalization
- gate bundles
- operator scorecards
- pilot tracking
- workflow artifact registry
- test harness for workflow modules

Interpretation:
This is the repo’s strongest sign that the project is becoming a control plane rather than a pile of gates.

### 4. Evidence and control-plane artifacts
This is the shared trust substrate.

Shared mechanisms:
- canonical run records: `src/lib/contract/run-record-emitter.ts`, `src/lib/contract/run-records.ts`
- workflow artifact registry: `docs/workflow-artifact-registry.json`, `src/lib/workflow-contract/registry.ts`
- repo-local verification runner: `scripts/verify-work.sh`

Interpretation:
The harness is designed to produce machine-legible evidence, not just command exits.

### 5. CI migration as a major subsystem
`ci-migrate` is a product inside the product.

Evidence:
- `src/commands/ci-migrate.ts` ~10117 LOC
- `src/commands/ci-migrate.test.ts` ~5812 LOC

What it appears to own:
- migration snapshots
- provider adapters
- branch-protection sync
- satisfiability scans
- proof packs and signatures
- merge-queue cutover evidence
- break-glass policy paths
- commit modes (`solo` and `enterprise`)

Interpretation:
This is a first-class rollout/change-management subsystem, not a helper script.

### 6. Pilot/autonomy governance
Core commands:
- `pilot-evaluate`
- `pilot-rollback`

Core library:
- `src/lib/pilot-evaluation/*`

What it owns:
- metric capture
- registry-backed thresholds
- control-plane artifacts
- decision packet generation
- promotion / hold / rollback outcomes

Interpretation:
This is the autonomy-governance layer sitting above the policy kernel.

## Cleanest compact map

### A. Core harness
- `init`
- `contract`
- `preflight-gate`
- `policy-gate`
- `docs-gate`
- `plan-gate`
- `review-gate`
- `health`

### B. Workflow authority
- `workflow:generate`
- `symphony-check`
- `linear`
- workflow-contract parser/checker/registry/scorecards

### C. Rollout control
- `ci-migrate`
- `pilot-evaluate`
- `pilot-rollback`

### D. Evidence substrate
- run records
- artifact registries
- `verify-work.sh`
- proof packs / decision packets / scorecards

### E. Adapters and satellites
- GitHub / branch protection / Greptile / Linear adapters
- remediation / replay / simulate
- search / context / indexing
- UI verify / explore
- org/tooling audits

## Bottom line
The project is **more coherent than the README alone suggests**.

The real architecture is:
- **repo bootstrap**
- **contract + gate kernel**
- **workflow authority layer**
- **evidence substrate**
- **rollout/autonomy control**

The main risk is not lack of substance. The repo has substance.
The main risk is that too many satellite commands obscure the core.