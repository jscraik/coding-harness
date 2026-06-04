---
doc_schema: coding-harness-doc/v1
doc_type: governance
authority: canon
canon_class: canonical
distribution: source-only
audience:
  - codex-agent
  - release-operator
  - coding-harness-maintainer
lifecycle_state: active
owner: coding-harness-maintainers
created: 2026-06-04
last_reviewed: 2026-06-04
review_cadence: quarterly
maintenance_trigger:
  - package-contract-change
  - scaffold-template-change
  - skill-distribution-change
semver_impact: minor
validated_by:
  - pnpm docs:lifecycle
depends_on:
  - docs/agents/08-release-and-change-control.md
  - docs/guardrails/generated-artifacts.md
  - src/lib/init/README.md
---

# Package and scaffold release guardrail

## Table of Contents

- [Default Stance](#default-stance)
- [Allowed Exceptions](#allowed-exceptions)
- [Proof Obligations](#proof-obligations)
- [Validation](#validation)
- [Review Checklist](#review-checklist)

## Default Stance

Downstream package, scaffold, template, and packaged-skill changes are public
contract changes. Source-only docs may guide them, but source-only paths must
not leak into generated downstream surfaces.

## Allowed Exceptions

- Brand-doc-only changes may leave package, CLI, and template names unchanged.
- Template text may mention source concepts only when the downstream project can
  act without reading source-only repo docs.
- Fixture-only changes may use local paths when they are clearly test data and
  not emitted to downstream users.

## Proof Obligations

| Surface | Evidence needed |
| --- | --- |
| npm package | SemVer classification and release-note impact |
| harness init scaffold | Rendered template fixture and source-only distribution check |
| packaged skill | Skill validation and downstream install/upgrade impact |
| PR template | Validator fixture and required-field compatibility |
| CI templates | Required check identity and branch-protection alignment |

## Validation

Use the narrow scaffold, PR-template, skill, or release tests for the changed
surface. Run docs lifecycle and docs-gate when documentation or template
contracts change.

## Review Checklist

- Does the change alter downstream behavior or only source docs?
- Is SemVer classified honestly?
- Are generated templates free of source-only doc references?
- Are package, CLI, skill, and template names kept stable unless migration is planned?
