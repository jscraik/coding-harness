---
doc_schema: coding-harness-doc/v1
doc_type: product
authority: canon
canon_class: canonical
distribution: source-only
audience:
  - human-operator
  - codex-agent
  - coding-harness-maintainer
lifecycle_state: active
owner: coding-harness-maintainers
created: 2026-06-04
last_reviewed: 2026-06-04
review_cadence: quarterly
maintenance_trigger:
  - brand-name-change
  - logo-asset-change
  - product-positioning-change
semver_impact: patch
validated_by:
  - pnpm docs:lifecycle
depends_on:
  - README.md
  - UBIQUITOUS_LANGUAGE.md
---

# Brand

## Table of Contents

- [Purpose](#purpose)
- [Canonical Name](#canonical-name)
- [Logo](#logo)
- [Usage Boundary](#usage-boundary)

## Purpose

This page records the source-repository brand language for the product currently
implemented by the coding-harness package and repository.

## Canonical Name

Use synAIpse as the product name in prose. Use AI Delivery Harness as the
descriptor.

Use Coding Harness, coding-harness, and @brainwav/coding-harness only when
referring to the current repository, package, CLI, templates, or migration
surfaces that have not yet been formally renamed.

## Logo

![synAIpse AI Delivery Harness logo](./synaipse-logo.png)

The current repo-owned logo asset is [synaipse-logo.png](./synaipse-logo.png).
It is the approved documentation asset for the synAIpse brand lockup.

## Usage Boundary

Brand updates are source-only until a package, CLI, template, or downstream
scaffold rename migration is explicitly planned. Do not rename executable
contracts, npm package names, command names, generated templates, or downstream
skill paths as part of a brand-doc-only change.
