---
schema_version: 1
artifact_id: jsc-288-contract-ownership-map
artifact_type: he-code-review-contract-ownership-map
canonical_slug: jsc-288-contract-ownership-map
title: JSC-288 Contract Ownership Map
harness_stage: he-code-review
status: accepted
date: 2026-05-08
traceability_required: true
origin: .harness/plan/2026-05-08-architecture-JSC-288-governance-trust-repair-plan.md
linear_issue: JSC-288
linear_milestone: Governance Trust Repair Slice
linear_status: Triage
implementation_unit: IU-288-003
---

# JSC-288 Contract Ownership Map

## Table Of Contents

- [Decision](#decision)
- [Linear Work Item Contract](#linear-work-item-contract)
- [Scope](#scope)
- [Published Aggregate Rule](#published-aggregate-rule)
- [Bounded Context Ownership Map](#bounded-context-ownership-map)
- [Compatibility Rules](#compatibility-rules)
- [Later Fragment Eligibility](#later-fragment-eligibility)
- [Known Coupling](#known-coupling)
- [Validation Notes](#validation-notes)
- [Evidence](#evidence)
- [Linear Acceptance Traceability](#linear-acceptance-traceability)

## Decision

`harness.contract.json` remains the published aggregate contract for installed
repositories.

Internal ownership is bounded by domain. A future split may introduce generated
or internal fragments, but only if the aggregate output remains compatible and
all read sites continue to consume the same published contract shape.

## Linear Work Item Contract

| Field | Value |
| --- | --- |
| Linear issue | `JSC-288` |
| Linear project | `coding-harness` |
| Linear milestone | `Governance Trust Repair Slice` |
| Plan unit | `IU-288-003` |
| Scope | Design bounded contract ownership without schema movement. |
| Out of scope | Contract fragmentation, schema changes, JSC-178 implementation, runtime changes, and PR-template edits. |
| Human review | Required before contract-backed implementation or schema movement. |

## Scope

This artifact completes the design portion of `IU-288-003`.

It names contract bounded contexts, owners, validation commands, compatibility
rules, and later-fragment eligibility. It does not edit `harness.contract.json`,
`src/lib/contract/**`, docs, validators, runtime behavior, or packaged skill
content.

## Published Aggregate Rule

The published contract remains:

- `harness.contract.json`
- `src/lib/contract/types-core.ts` `HarnessContract`
- `src/lib/contract/validator-core.ts` aggregate validation
- `DEFAULT_CONTRACT` as the TypeScript default aggregate

Future bounded contexts may be introduced only as internal source ownership or
generated inputs. They must not become hidden parallel contracts.

## Bounded Context Ownership Map

| Context | Aggregate fields | Owner | Validation command | Compatibility rule | Later-fragment eligibility |
| --- | --- | --- | --- | --- | --- |
| CI ownership and required checks | `ciOwnership`, `ciProviderPolicy`, `branchProtection.requiredChecks`, `.harness/ci-required-checks.json` relationship | ci-governance | `harness ci-ownership-gate --json`; `python3 scripts/validate-ci-required-checks.py` when required-check manifests change | CircleCI remains primary PR gate, CodeRabbit remains review provider, Semgrep Cloud remains independent external security check unless an ADR migrates ownership. | Eligible only after required-check consumers and branch-protection docs read from generated aggregate output. |
| Branch protection and merge policy | `branchProtection`, `mergePolicy`, `reviewPolicy.requiredChecks` subset relationship | review-governance | `pnpm exec tsx src/cli.ts policy-gate --contract harness.contract.json --json`; branch-protection dry-run where applicable | Required review and check semantics must remain compatible with existing PR readiness and GitHub branch-protection expectations. | Eligible after `reviewPolicy` and `branchProtection` cross-field validators are covered by generated aggregate tests. |
| Review gate and reviewer independence | `reviewPolicy`, `overrideReviewerRegistry`, `evidencePolicy`, `loopStageContracts.review-gate` | review-governance | `harness review-gate ... --json` for runtime readiness; contract validation for static policy | Coding agent self-approval remains forbidden; CodeRabbit and independent Codex review surfaces stay distinct. | Eligible after review-gate tests prove fragment composition keeps required checks and independence semantics intact. |
| Docs gate and governed documentation | `docsGatePolicy`, `docsDriftRules`, governed docs surfaces | docs-governance | `bash scripts/run-harness-gate.sh docs-gate --mode required --json` for governed doc changes; `pnpm exec tsx src/cli.ts docs-gate --mode required --json` for focused command proof | Required documentation surfaces must stay discoverable; compression must not orphan a required workflow instruction. | Eligible because docs-gate is already domain-shaped, but only with generated aggregate parity tests. |
| Policy chain and risk tiering | `policyChain`, `riskTierRules`, `diffBudget`, `controlPlanePolicy`, `pilotAuthzPolicy` | policy-governance | `pnpm exec tsx src/cli.ts policy-gate --files <changed-files> --contract harness.contract.json --json`; focused policy tests when code changes | Risk actions must remain fail-closed for high-risk governance controls and must not weaken explicit human-review boundaries. | Eligible after policy-gate read sites can consume a generated aggregate and fragment-specific tests cover high/medium/low behavior. |
| Memory and Project Brain | `memoryPolicy`, `memoryMaintenancePolicy`, `memoryEvalPolicy`, `toolingPolicy.projectBrainMemoryExtension`, `.harness/memory/**`, `.harness/knowledge/**` | memory-governance | `harness learnings gate --source .harness/learnings/coderabbit.local.json --files <files> --json`; `harness review-context --source .harness/learnings/coderabbit.local.json --files <files> --json`; `harness north-star-feedback --source .harness/learnings/coderabbit.local.json --json`; explicit `n.a.` reason when artifact is absent | Placeholder `memory.json` must not satisfy required trust. Required memory evidence must have provenance, freshness, owner, and command or review proof. | Eligible only after `IU-288-004` replaces the PR-template placeholder proof and any retained memory command has fixture coverage. |
| Tooling and command surface | `toolingPolicy`, `packageManagerPolicy`, command docs relationship, readiness script | tooling-governance | `pnpm exec tsx src/cli.ts tooling-audit --path . --json`; `bash scripts/check-environment.sh`; `bash scripts/validate-codestyle.sh --fast` for readiness-affecting changes | Repo command guidance must match `package.json`, lockfile, `.mise.toml`, readiness scripts, and generated Codex environment actions. | Eligible after tooling-audit proves generated aggregate parity for command/tooling fields. |
| Init, update, and scaffold defaults | init/update template fields in `toolingPolicy`, `packageManagerPolicy`, CI provider defaults, scaffolded contract defaults | scaffold-governance | `pnpm test:harness-upgrade-matrix -- <repo>...`; `harness upgrade --dry-run --json`; focused `src/lib/init/**` tests | Downstream upgrades must preserve target git status in dry-run and emit update evidence. The aggregate contract remains the installed artifact. | Eligible after scaffold templates generate the same aggregate from domain-owned inputs. |
| Release readiness and package publishing | `ciOwnership.fallbackWorkflows`, release workflow policy, `packageManagerPolicy`, `runtimePolicy`, release docs | release-governance | `pnpm check`; release workflow validation where touched; `docs/agents/08-release-and-change-control.md` review | GitHub Actions remains release publishing only and must not become automatic PR gate without contract migration. | Eligible after release workflow and CI ownership fields are generated from one release context source. |
| North-star and product surfaces | `northStar`, `productSurface`, `contextIntegrityPolicy`, `contextCompact` | product-governance | `harness north-star-feedback --source .harness/learnings/coderabbit.local.json --json`; `harness drift-gate --json` or focused drift tests where changed | North-star status, product surfaces, and context integrity must remain evidence-backed rather than narrative-only. | Eligible after drift-gate/context-health consumers prove aggregate parity. |
| Observability and runtime resilience | `observabilityPolicy`, `runtimePolicy`, `contextIntegrityPolicy`, `contextCompact`, `uiLoopPolicy` | runtime-governance | focused runtime command tests for touched surfaces; `pnpm check` when source behavior changes | Runtime policy fields must remain explainable and should not become symbolic configuration unused by commands. | Eligible only after read sites are mapped; current ownership is weaker than CI/docs/tooling. |
| Linear and issue tracking | `issueTrackingPolicy`, branch/PR issue-key rules | delivery-governance | `harness linear-gate --json` where available; focused Linear workflow tests when source changes | Linear remains the execution tracker; GitHub issues stay disabled unless contract changes intentionally migrate issue ownership. | Eligible after Linear command read sites are mapped to generated aggregate output. |

## Compatibility Rules

- Do not move or rename aggregate fields during JSC-288.
- Do not split `harness.contract.json` into runtime fragments in this issue.
- Do not add new aggregate policy fields without bounded context, owner,
  validation command, and compatibility rule.
- Cross-field invariants stay aggregate-level until all involved contexts have
  generated parity tests.
- Any future fragment system must generate or validate the published aggregate
  before downstream repos consume it.

## Later Fragment Eligibility

The safest first fragment candidates are docs gate, CI ownership, tooling, and
memory/Project Brain because their contract fields already have recognizable
domain owners and command gates.

The riskiest fragment candidates are policy chain, branch protection/review
cross-checks, runtime/context integrity, and product-surface governance because
they couple multiple commands and merge-readiness decisions.

No fragment is approved by this artifact. This artifact only defines ownership
and migration constraints.

## Known Coupling

- `reviewPolicy.requiredChecks` must remain a subset of
  `branchProtection.requiredChecks`.
- `ciOwnership.securityChecks` must remain covered by
  `branchProtection.requiredChecks`.
- `toolingPolicy.projectBrainMemoryExtension` is memory-governance content
  carried inside the tooling policy because readiness/tooling-audit enforce path
  presence.
- Release publishing appears in both CI ownership and release docs; GitHub
  Actions must stay release-only.
- Docs-gate and policy-gate are both governance controls; docs-gate owns
  discoverability, policy-gate owns merge/readiness policy.

## Validation Notes

This unit is design-only. Validation should prove the aggregate remains valid
and that this artifact is structurally traceable.

Implementation of fragments, validators, or schema movement belongs to a future
JSC-178 or successor lane, not JSC-288.

## Evidence

Facts:

- `harness.contract.json` currently contains one aggregate object with fields
  including `ciOwnership`, `branchProtection`, `reviewPolicy`,
  `docsGatePolicy`, `toolingPolicy`, `memoryPolicy`, `memoryMaintenancePolicy`,
  `memoryEvalPolicy`, `issueTrackingPolicy`, `northStar`, `productSurface`,
  `contextIntegrityPolicy`, and release-related CI fallback workflow policy.
- `src/lib/contract/types-core.ts` defines the aggregate `HarnessContract` and
  `DEFAULT_CONTRACT`.
- `src/lib/contract/validator-core.ts` validates supported aggregate keys and
  enforces cross-field relationships for required checks and CI ownership.
- `ADR-004` requires bounded internal ownership while preserving the published
  aggregate.
- `IU-288-002` accepted Project Brain, `.harness/memory/LEARNINGS.md`, and
  learning-loop evidence as the replacement memory trust path.

Interpretation:

- The contract is already organized enough to map ownership domains, but not yet
  split enough to make local reasoning cheap.
- Fragmenting now would create compatibility risk; ownership mapping is the
  correct intermediate step.

Assumption:

- Downstream repositories and generated artifacts still expect a single
  `harness.contract.json` aggregate.

## Linear Acceptance Traceability

| Linear issue | Acceptance IDs | Status | Evidence |
| --- | --- | --- | --- |
| `JSC-288` | `SA-288-004` | Covered | Contract bounded contexts are named while preserving the aggregate. |
| `JSC-288` | `SA-288-010` | Covered for contract ownership | Retained required contract surfaces are mapped to executable policy, generated projection, or canonical human guidance owners. |
