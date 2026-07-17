---
schema_version: 1
lifecycle_schema: harness-document-lifecycle/v1
artifact_id: solo-maintainer-review-gate-steering-admission
artifact_type: implementation-note
canonical_slug: solo-maintainer-review-gate-steering-admission
title: Solo-Maintainer Review Gate Steering Admission
harness_stage: implementation-notes
status: active
date: 2026-07-16
origin: repeated user steering that Jamie is a solo developer and automated review is the independent review lane
source_type: implementation-note
authority: execution-input
lifecycle_status: execution-input
canonical_destination: reviewPolicy approval mode, review-gate runtime, and AI review governance
owner: coding-harness-maintainers
created: 2026-07-16
last_reviewed: 2026-07-17
review_cadence: event-driven
validated_by:
  - pnpm exec vitest run src/lib/contract/validator.test.ts src/commands/review-gate.test.ts
  - pnpm run docs:steering:guard
  - bash scripts/run-harness-gate.sh docs-gate --mode required --json
  - pnpm check:static
depends_on:
  - harness.contract.json
  - docs/agents/12-ai-review-governance.md
  - docs/agents/review-gate-workflow-contract.md
---

# Current-Session Steering Admission

## Feedback Signal

Jamie repeatedly clarified that he is a solo developer and that the configured
Codex and CodeRabbit review threads are the independent review lane. The
feedback class is repeated approval-boundary steering. The inferred principle
is that review independence means separation from the coding actor, not an
unavailable second-human ceremony when repository-owned automated reviewers
provide fresh final-SHA evidence.

## Root Operational Failure

The coordinator retrieved generic closeout language about independent approval
but did not retrieve the repository's AI review governance or packaged skill,
both of which identify CodeRabbit and Codex as the independent review sources.
The executable `review-gate` reinforced the mistake by always requiring a
GitHub `APPROVED` review, even when the repository has one maintainer and the
configured automated reviewers have reviewed the exact head SHA.

## Failure Category

- hidden assumptions
- retrieval failure
- poor workflow design
- architecture drift
- missing guardrails
- lack of verification

## Searched Surfaces

- `.agents/skills/coding-harness/SKILL.md` identifies CodeRabbit as the
  independent review check.
- `docs/agents/12-ai-review-governance.md` requires CodeRabbit plus the Codex
  review process unless waived.
- `src/commands/review-gate-core.ts` unconditionally required a human
  `APPROVED` review after the independent review check passed.
- `src/commands/review-gate.test.ts` encoded the human-only assumption.
- `harness.contract.json`, contract types, JSON Schema, and validator are the
  sibling implementations searched for an enforceable policy seam.
- `.harness/review-log.md` repeated the ambiguous phrase "independent
  approval" and therefore propagated the same routing error.

## Durable System Improvement

Durable destination: contract schema, runtime gate, regression tests,
governance documentation, and this steering admission record. Add an explicit
`reviewPolicy.approvalMode` with safe default `human_approval`. The
`automated_review` mode requires named automated reviewers to submit review
evidence for the exact head SHA. Configure this solo-maintainer repository to
require both CodeRabbit and Codex, while preserving human approval semantics for
repositories that select the default mode.

Pattern scope inventory: sibling implementations searched were contract types,
contract JSON Schema, runtime contract validation, initialization types,
review-gate execution, review-gate tests, AI review governance, workflow
contract, root repository contract, and the review log. Siblings changed are
those that define or consume the approval mode. Presets are intentionally left
unchanged so existing and newly scaffolded repositories retain the conservative
`human_approval` default. No broader branch-protection or reviewer-access change
is included.

## Executable Guard

Run the focused contract and runtime tests, then the steering admission guard:

```bash
pnpm exec vitest run src/lib/contract/validator.test.ts src/commands/review-gate.test.ts
pnpm run docs:steering:guard
bash scripts/run-harness-gate.sh docs-gate --mode required --json
```

The contract validator rejects unknown approval modes and rejects
`automated_review` without named reviewers. The runtime test fails closed when
one configured reviewer has no review on the current SHA.

## Latest-State Ratchet

Final-head review exposed one remaining stale-state gap: an earlier passing
automated review could mask a later `CHANGES_REQUESTED` or `DISMISSED` event by
the same reviewer. Review acceptance now evaluates the latest current-head
review for each configured automated reviewer. Only a latest `COMMENTED` or
`APPROVED` state satisfies the automated-review lane, and unresolved
conversations remain independently blocking. A parameterized regression proves
both later blocking states. This preserves practical solo-maintainer review
while preventing stale automated approval from being treated as current truth.

## Forbidden Recurrence Behavior

Do not infer that "independent review" means a second human. Load the repository
review policy before classifying approval blockers. Do not request an impossible
self-approval from a solo maintainer. Do not accept an automated review from an
older SHA, a passing status without the configured review event, unresolved
review conversations, or the coding actor's own comments as independent review
evidence.

## Validation

- Command: `pnpm exec vitest run src/lib/contract/validator.test.ts src/commands/review-gate.test.ts --reporter=dot` -> pass (2 files and 217 tests, including current-SHA automated-review success and missing-reviewer fail-closed cases)
- Command: `pnpm run docs:steering:guard` -> pass (`steering-feedback-contract: pass`)
- Command: `bash scripts/run-harness-gate.sh docs-gate --mode required --json` -> pass (zero errors; one advisory stale-document warning)
- Command: `pnpm check:static` -> pass (toolchain, lint, policy, docs, workflow, architecture, types, docstrings, size, debt, behavior, and audit-tracking gates passed)

## Review Condition

This correction may resume ordinary PR work only after the approval-mode
contract validates, the runtime passes a solo-maintainer automated-review
fixture, the missing-reviewer fixture fails closed with an assertion-shaped
diagnostic, and the steering and docs guards pass. It does not resolve the three
new PR #480 Codex findings, prove hosted checks, merge the PR, release anything,
or clean up either worktree.
