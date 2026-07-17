---
schema_version: 1
lifecycle_schema: harness-document-lifecycle/v1
artifact_id: pr477-tooling-audit-review-hardening
artifact_type: implementation-note
canonical_slug: pr477-tooling-audit-review-hardening
title: PR 477 Tooling Audit Review Hardening
harness_stage: implementation-notes
status: active
date: 2026-07-17
origin: PR 477 automated review findings
source_type: implementation-note
authority: execution-input
lifecycle_status: execution-input
canonical_destination: src/commands/tooling-audit-core.ts
owner: coding-harness-maintainers
created: 2026-07-17
last_reviewed: 2026-07-17
review_cadence: event-driven
validated_by:
  - pnpm check:static # expected outcome: pass
  - pnpm test:ci # expected outcome: pass
  - bash scripts/run-harness-gate.sh tooling-audit --path . --json # expected outcome: pass
depends_on:
  - PR-477
---

# PR 477 tooling-audit review hardening

## Table of contents

- [Feedback signal](#feedback-signal)
- [Durable correction](#durable-correction)
- [Pattern scope and evidence boundary](#pattern-scope-and-evidence-boundary)

## Feedback signal

Repeated automated review found that `tooling-audit` could accept invalid Prek
TOML or misclassify the effective runtime shape. The failure categories were
weak validation, hidden scope assumptions, and incomplete forwarding and hook
runtime checks. The affected siblings were root defaults, root install types,
hook fields, quoted keys, arrays, inline tables, forwarded readiness targets,
and commit-message filename delivery.

## Durable correction

The TOML boundary now reads defaults only before the first table, rejects
duplicate or malformed governed root assignments, decodes quoted basic keys
before duplicate detection, requires complete array-element consumption, and
parses every inline-table key/value entry. Readiness forwarding detection is
suffix-independent for `SCRIPT_DIR` targets. Every local hook requires an
`entry`, and approved `commit-msg` validators must keep `pass_filenames = true`.

Each correction has an assertion-shaped fixture that starts from a compliant
repository, introduces one invalid configuration, and requires a specific
critical diagnostic. This moves the reviewed behavior from conversational
memory into the validator and its regression suite.

## Pattern scope and evidence boundary

The sibling sweep covered every policy-relevant Prek field and both root-level
default arrays in `src/commands/tooling-audit-core.ts`, plus readiness wrappers
that use direct, shell-suffixed, or extensionless targets. General-purpose TOML
support outside the Prek policy surface remains intentionally unchanged.

Focused and repository-wide commands prove local parser, audit, static, and
test behavior. Hosted checks, final automated-review convergence, acceptance,
merge, release, and cleanup remain separate evidence lanes.
