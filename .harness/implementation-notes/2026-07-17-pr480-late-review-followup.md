---
schema_version: 1
lifecycle_schema: harness-document-lifecycle/v1
artifact_id: pr480-late-review-followup
artifact_type: implementation-note
canonical_slug: pr480-late-review-followup
title: PR 480 Late Review Follow-up
harness_stage: implementation-notes
status: active
date: 2026-07-17
origin: PR 480 late automated review findings
source_type: implementation-note
authority: execution-input
lifecycle_status: execution-input
canonical_destination: src/commands/review-gate-core.ts
owner: coding-harness-maintainers
created: 2026-07-17
last_reviewed: 2026-07-17
review_cadence: event-driven
validated_by:
  - pnpm exec vitest run src/commands/review-gate.test.ts src/dev/package-files-quality-scripts.test.ts src/dev/validate-runtime-packet-schemas-semantic.test.ts src/lib/synaipse/packet-consolidation-reviewer-coverage.test.ts # expected outcome: pass
  - bash scripts/run-uv-python.sh -m pytest -q scripts/tests/test_agent_native_artifact_contracts.py # expected outcome: pass
  - pnpm check:static # expected outcome: pass
depends_on:
  - PR-480
---

# PR 480 late review follow-up

## Table of contents

- [Feedback signal](#feedback-signal)
- [Root operational failures](#root-operational-failures)
- [Durable correction](#durable-correction)
- [Pattern scope and evidence boundary](#pattern-scope-and-evidence-boundary)

## Feedback signal

Three review conversations arrived after PR 480's merge. A passing reviewer
receipt could carry no evidence references in two contract boundaries, a
required reviewer configured with GitHub's `[bot]` suffix could be treated as a
different actor from the same unsuffixed API identity, and the installed package
omitted a baseline file read by its packaged behavior suite.

The follow-up review then exposed two sibling boundary gaps: generic GitHub App
logins lost their `[bot]` classification before human-approval checks, and the
JSON Schema accepted whitespace-only coverage evidence references. It also
identified unchecked JSON fixture mutation in two regression tests.

## Root operational failures

The failure classes were weak cross-boundary validation, external identity
alias drift, and incomplete transitive package-input coverage. The merge-time
closeout was accurate for the evidence available in that window, but late
review delivery exposed gaps that still required a separate repair lane.

## Durable correction

Passing reviewer decisions now require at least one coverage evidence reference
at the JSON Schema and typed Python boundaries, matching the existing canonical
TypeScript adapter. Evidence references must contain a non-whitespace character
in all three validation lanes. GitHub actor classification now inspects the raw
login before the optional `[bot]` suffix is removed for identity comparison, so
unknown GitHub Apps cannot satisfy human approval or coding-actor checks. The
behavior-test baseline is explicitly published and asserted by the package
tarball smoke test.

Both JSON-derived reviewer fixtures now pass through one validated fixture
mutator before their evidence references are changed. The Python boundary
already rejected blank list items through its shared field validator; an
explicit empty and whitespace regression records that existing invariant.

Each correction has an assertion-shaped regression fixture. This converts the
late review feedback into contract, identity, and package-content enforcement
rather than relying on future prompt memory.

## Pattern scope and evidence boundary

The sibling sweep covered all three reviewer-decision validation boundaries,
all `normalizeBotLogin` consumers in the review gate, both JSON-derived reviewer
fixture mutations, and every runtime input currently asserted by the package
quality-script smoke test. General GitHub identity canonicalization outside the
review gate and unrelated evaluation data remain intentionally unchanged.

Local commands below prove only source, contract, and package behavior. Hosted
checks, review-thread resolution, acceptance, merge, release, and cleanup remain
separate evidence lanes and must be refreshed after the follow-up head is
published.

Command: `MISE_NO_CONFIG=1 pnpm exec vitest run src/commands/review-gate.test.ts src/dev/validate-runtime-packet-schemas-semantic.test.ts src/lib/synaipse/packet-consolidation-reviewer-coverage.test.ts --reporter=dot` -> pass (3 files and 117 focused contract, bot-classification, and validated-fixture tests).
Command: `MISE_NO_CONFIG=1 pnpm exec vitest run src/lib/synaipse/packet-consolidation.test.ts --reporter=dot` -> pass (62 packet-consumer inventory and consolidation tests).
Command: `MISE_NO_CONFIG=1 bash scripts/run-uv-python.sh -m pytest -q scripts/tests/test_agent_native_artifact_contracts.py` -> pass (28 typed artifact-contract tests, including empty and whitespace evidence references).
Command: `MISE_NO_CONFIG=1 node scripts/validate-runtime-packet-schemas.cjs --all` -> pass (28 runtime packet schemas and examples).
Command: `MISE_NO_CONFIG=1 pnpm check:static` -> pass (static, type, architecture, documentation, behavior, and package-quality gates).
Command: `MISE_NO_CONFIG=1 pnpm run test:related` -> pass (4 related files and 118 tests).
Command: `MISE_NO_CONFIG=1 bash scripts/run-harness-gate.sh docs-gate --mode required --json` -> pass (0 errors and 1 advisory stale-document warning).
Command: `MISE_NO_CONFIG=1 pnpm check` -> pass (424 standard Vitest files with 6,196 tests passed and 1 platform-gated skip, 108 CI-migrate tests, plus dependency audit with 0 advisories).
