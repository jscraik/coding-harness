---
last_validated: 2026-04-18
---

# Module Boundaries

## Table of Contents
- [Purpose](#purpose)
- [CLI Registry Boundaries](#cli-registry-boundaries)
- [Contract Validator Boundaries](#contract-validator-boundaries)
- [Enforcement](#enforcement)

## Purpose

Define the bounded module layout for high-change control-plane surfaces so command growth and policy evolution do not reintroduce single-file concentration risk.

## CLI Registry Boundaries

CLI registry modules are split into a loader plus focused policy modules:

- `src/lib/cli/command-registry.ts`
  - Thin orchestration layer for dispatch/index/help output.
- `src/lib/cli/registry/command-capabilities.ts`
  - Command catalog schema and capability metadata (category, mutability, retry behavior, guardrails).
- `src/lib/cli/registry/fuzzy-resolution.ts`
  - Command normalization, fuzzy resolution, and suggestion scoring.
- `src/lib/cli/registry/command-specs.ts`
  - Canonical command manifest bindings to command implementations.

## Contract Validator Boundaries

Contract validation is split by responsibility:

- `src/lib/contract/validator.ts`
  - Entrypoint orchestration and cross-field validation checks.
- `src/lib/contract/validator-helpers.ts`
  - Primitive shape guards, forbidden-key protections, and reusable scalar/list validators.
- `src/lib/contract/policy-validators.ts`
  - Policy-domain validators for docs/context/pilot/remediation surfaces.

## Enforcement

Module boundaries and file-size thresholds are enforced by:

- `src/lib/architecture/module-boundaries.test.ts`

Threshold policy:

- `src/lib/cli/command-registry.ts` must remain a thin loader (`<= 220` lines).
- `src/lib/contract/validator.ts` must remain an entrypoint (`<= 2600` lines).
