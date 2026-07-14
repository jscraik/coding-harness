---
schema_version: 1
lifecycle_schema: harness-document-lifecycle/v1
artifact_id: jsc458-slice4-universal-context-plane
artifact_type: implementation-note
canonical_slug: jsc458-slice4-universal-context-plane
title: JSC-458 Slice 4 Universal Context Plane
harness_stage: implementation-notes
status: active
date: 2026-07-13
origin: JSC-458 phase-admitted Slice 4 implementation
source_type: implementation-note
authority: execution-input
lifecycle_status: execution-input
canonical_destination: src/lib/synaipse
owner: coding-harness-maintainers
created: 2026-07-13
last_reviewed: 2026-07-13
review_cadence: event-driven
validated_by:
  - pnpm exec vitest run src/lib/synaipse/context-contract.test.ts src/lib/synaipse/context-plane.test.ts src/lib/synaipse/state.test.ts src/commands/next.test.ts --reporter=dot # expected outcome: pass
  - pnpm check # expected outcome: known blocker (pre-existing Local Memory helper test mismatch)
depends_on:
  - docs/specs/2026-07-11-synaipse-agent-native-delivery-control-plane-v1-spec.md
  - JSC-458
---

# JSC-458 Slice 4 universal context plane

## Table of contents

- [Scope](#scope)
- [Feedback ratchet](#feedback-ratchet)
- [Evidence boundary](#evidence-boundary)

## Scope

This note records the bounded coding-harness half of the `JSC-458` admission.
It adds versioned metadata contracts for `synaipse-context-catalog/v1`,
`synaipse-context-ref/v1`, and `synaipse-task-context/v1`; a pure read resolver;
an immutable Admit-time snapshot constructor; and logical context ID/digest
projection through `synaipse-state/v1`.

The resolver consumes caller-supplied availability observations. It does not
read providers, create a search engine, move documents, copy document bodies,
or expose Jamie-local absolute paths. The separate Jamie Brain catalog remains
outside this repository slice and requires its own governed admission.

`runHarnessNext` accepts that caller-supplied resolution packet at its existing
production entrypoint, resolves it before changed-file inspection, blocks on a
malformed or policy-blocked packet, and projects only resolved logical IDs and
digests into cockpit state. Omitting the optional packet preserves compatibility
for repositories that have not adopted the context plane.

## Feedback ratchet

Repeated steering showed that context selection could not remain a prose-only
instruction. The durable boundary now parses finite context kinds, authority,
privacy, lifecycle, stage, provider, requirement, digest, and freshness fields
before selection. Required unavailable context blocks, optional unavailable
context becomes an explicit unknown, and stale, superseded, or unauthorized
context produces one deterministic blocker and recovery action.

The first independent adversarial review disproved the initial patch: the
entrypoint was disconnected, selection was not task- or authority-scoped,
historical/provider/host-path states collapsed incorrectly, schema-unique
arrays were not unique at runtime, and local Windows/UNC/home paths plus invalid
Git SHAs crossed the parser boundary. The correction makes the production
entrypoint consume the resolver, intersects catalog refs with the immutable task
snapshot and accepted authorities, gives each failure its own recovery, and
uses shared character-level parsers for portable paths and full Git SHAs.

The second independent review then found five sibling boundary gaps: private
context could reach a public PR when a caller omitted the deny-list entry, an
admitted ref missing from the catalog failed open, optional provider failures
blocked instead of becoming reasoned unknowns, future-dated evidence was
accepted, and repository-relative traversal plus an empty destination list
exposed schema/runtime drift. The correction now applies privacy defaults
independently of caller deny lists, reconciles every admitted ref against the
catalog, preserves optional failure reasons, rejects future evidence and parent
traversal through helpers, and aligns the published array cardinality.

The final adversarial pass identified six integration gaps: hosted CI could
still receive private context, Windows drive-relative and backslash paths were
not rejected consistently, optional unknown reasons were dropped by the
entrypoint projection, future task admission timestamps were accepted, the
task snapshot privacy decision was not enforced for public PRs, and the catalog
project was not bound to the target repository. The correction applies the
private-context default to hosted CI, uses one portable provider-reference
boundary for schema and runtime consumers, carries reasoned unknowns through
`synaipse-state/v1`, rejects future task snapshots, enforces snapshot privacy,
and binds each catalog to a canonical repository owner/name before changed-file
inspection. Simplification also reuses the shared strict RFC3339 parser instead
of maintaining a second timestamp implementation.

The closeout disproof matrix then caught two sibling parity cases: opaque
provider kinds could still carry parent traversal even though the schema
rejected it, and a required blocker caused coexisting optional unknown evidence
to disappear from the cockpit receipt. Provider portability is now enforced
uniformly for every kind, and blocked entrypoint decisions preserve the
resolver's selected references and reasoned unknowns without inspecting changed
files.

Operator-visible identifiers use entity prefixes and a human-safe opaque
alphabet. Runtime validation checks these identifiers and SHA-256 digests
character by character; JSON Schema patterns express the same wire contract.
Types used by the snapshot and state projection are inferred from their parser
return values, avoiding a second manual domain-model definition.

## Evidence boundary

The focused TDD loop proves metadata validation, pure-read selection,
required/optional failure behavior, digest freshness, supersession, remote
privacy rejection, task/authority admission, historical/provider/host-path
failures, public-destination privacy defaults, missing admitted-ref handling,
future-evidence rejection, package schema publication, immutable task
snapshots, canonical repository binding, hosted-CI and public-PR privacy,
reasoned unknown projection, production entrypoint ordering, and state
projection. Canonical
repository gates and independent adversarial review remain separate proof
lanes. The tests exercise hosted-CI privacy decisions, but this does not claim
hosted-CI integration or deployment. This note also does not claim review
convergence, merge readiness, product adoption, Jamie Brain catalog admission,
or SynAIpse v1 closure.
