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
suffix-independent for `SCRIPT_DIR` targets and requires the canonical quoted
path form so repository paths containing spaces remain safe. Every local hook
requires an `entry`. Approved `commit-msg` validators may omit
`pass_filenames`, inheriting Prek's default `true`, but an explicit `false`
fails closed. Inline tables reject TOML-forbidden trailing commas while arrays
retain their separate TOML trailing-comma behavior.

The hook-table splitter now parses TOML array-table key segments instead of
matching only the bare `[[repos.hooks]]` spelling. Equivalent bare, quoted,
mixed, and escaped key paths resolve to the same `repos.hooks` identity while
header-shaped content inside multiline strings remains inert. The unreadable
readiness fixture also restores the earlier Prek leaf mutation before its
second audit and asserts the readiness path itself, so that regression cannot
pass because an unrelated drift finding survived from the first assertion.

Each correction has an assertion-shaped fixture that starts from a compliant
repository, introduces one invalid configuration, and requires a specific
critical diagnostic. This moves the reviewed behavior from conversational
memory into the validator and its regression suite.

## Pattern scope and evidence boundary

The sibling sweep covered every policy-relevant Prek field and both root-level
default arrays in `src/commands/tooling-audit-core.ts`, plus readiness wrappers
that use direct, shell-suffixed, or extensionless targets. General-purpose TOML
support outside the Prek policy surface remains intentionally unchanged.

Command: `MISE_NO_CONFIG=1 pnpm exec vitest run src/commands/tooling-audit-toml.test.ts --reporter=dot` -> pass (12 focused TOML compatibility tests, including equivalent quoted hook-table paths and isolated readiness diagnostics).
Command: `MISE_NO_CONFIG=1 pnpm run test:related` -> pass (5 related files and 51 tests).
Command: `MISE_NO_CONFIG=1 pnpm check:static` -> pass (the full static, contract, architecture, type, documentation, size, self-affirming, and behavior-test gate passed).
Command: `git merge --no-edit FETCH_HEAD` -> fail (canonical main advanced through PR #480 and produced conflicts only in generated `.diagram/manifest.json` and `AI/context/diagram-context.md`; no source conflict occurred).
Command: `MISE_NO_CONFIG=1 bash scripts/refresh-diagram-context.sh --force` -> pass (regenerated 14 diagram artifacts from the combined source state and removed both generated-file conflicts).
Command: `MISE_NO_CONFIG=1 bash scripts/check-diagram-freshness.sh` -> pass (the regenerated merged artifacts match the combined source state).
Command: `MISE_NO_CONFIG=1 bash scripts/run-harness-gate.sh docs-gate --mode required --json` -> pass (0 errors, 1 advisory stale-document warning, and all required documentation surfaces present).
Command: `MISE_NO_CONFIG=1 pnpm run test:related` -> pass (34 merged-state related files passed 1,067 tests with 1 platform-gated skip).
Command: `MISE_NO_CONFIG=1 pnpm check:static` -> pass (the merged source, contract, architecture, documentation, type, and behavior-test surface passed).

Focused and repository-wide commands prove local parser, audit, static, and
test behavior. Hosted checks, final automated-review convergence, acceptance,
merge, release, and cleanup remain separate evidence lanes.
