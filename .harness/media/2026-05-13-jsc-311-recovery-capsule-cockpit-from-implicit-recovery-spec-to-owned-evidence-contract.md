# From Implicit Recovery Spec -> Owned Evidence Contract

## Purpose

This media sidecar records the required specification-review infographic framing
for the JSC-311 Recovery Capsule Cockpit spec review. It exists because the
review workflow requires a media artifact, but repository-local PNG persistence
cannot be verified from the active image-generation tool in this environment.

## Image Generation & Persistence Evidence

- media status: generation-blocked
- `$imagegen` invoked: blocked
- generated-image cache source path: blocked; active image-generation tool does
  not expose a repository-copyable PNG path and forbids final explanatory text
  after invocation
- repository `.harness/media/` PNG path: blocked; no PNG was generated or
  persisted
- prompt metadata path:
  `/Users/jamiecraik/dev/coding-harness/.harness/media/2026-05-13-jsc-311-recovery-capsule-cockpit-from-implicit-recovery-spec-to-owned-evidence-contract-prompt.md`
- sidecar path:
  `/Users/jamiecraik/dev/coding-harness/.harness/media/2026-05-13-jsc-311-recovery-capsule-cockpit-from-implicit-recovery-spec-to-owned-evidence-contract.md`
- repository PNG existence verification: blocked; no generated PNG path is
  available
- persistence method: blocked
- final user-facing text after imagegen permitted: no
- residual risk: a future run with a local-output image tool should generate
  and copy the PNG into `.harness/media/` using this prompt metadata.

## Bespoke Framing

- spec name:
  `.harness/specs/2026-05-13-JSC-311-recovery-capsule-cockpit-spec.md`
- spec type: mixed agent workflow / operational / architecture contract
- original state: implicit recovery specification with scattered evidence
  requirements
- target state: owned, evidence-bound `harness next` recovery cockpit contract
- main weakness: ownership, decision authority, escalation, and observability
  were not explicit enough for implementation handoff
- main improvement: ownership and runtime evidence are now contractual
- validation evidence: BLUF structure check pass; markdownlint-cli2 pass;
  implementation tests not applicable for spec-only patch
- artifact impact: spec patched; prompt metadata and media sidecar created; PNG
  generation blocked
- confidence movement: 86% -> 91%
- loop outcome: optimal within available evidence

## Prompt Summary

The prompt asks for a professional engineering transformation poster titled
"From Implicit Recovery Spec -> Owned Evidence Contract" showing the move from
an under-owned recovery spec to an implementation-ready operator cockpit
contract with explicit ownership, runtime evidence, `meta.recovery`, and gated
adjacent systems.

## Linked Context

- `/Users/jamiecraik/dev/coding-harness/.harness/specs/2026-05-13-JSC-311-recovery-capsule-cockpit-spec.md`
- `/Users/jamiecraik/dev/coding-harness/.harness/media/2026-05-13-jsc-311-recovery-capsule-cockpit-from-implicit-recovery-spec-to-owned-evidence-contract-prompt.md`

## Fallback `$imagegen` Prompt Output Contract

```text
$imagegen

Use case: specification-review technical infographic
Asset type: review artifact / X technical explainer
Recommended size: 2048x1152
Aspect ratio: 16:9

Title:
"From Implicit Recovery Spec -> Owned Evidence Contract"

Subtitle:
"A bespoke transformation map for JSC-311 Recovery Capsule Cockpit Spec"

Context:
The Recovery Capsule Cockpit spec was reviewed as an operator-first harness
contract for JSC-311. The patch tightened the spec by making ownership,
decision authority, escalation, and runtime evidence explicit while preserving
the thin-surface rule: Recovery Capsule remains a read-only `harness next`
enhancement, not a new orchestration platform.

Before state:

- Ownership and escalation were implicit.
- Runtime evidence and observability were scattered across validation prose.
- Reviewers could confuse recovery orientation with executable gate evidence.

After state:

- Ownership, decision authority, and escalation are explicit.
- Observability is defined as command evidence, focused fixtures, and reviewable JSON.
- Acceptance criteria block dashboards, persistent run-history databases,
  automatic memory promotion, and external tracker mutation in v1.

Evidence shown:

- BLUF structure check: pass
- markdownlint-cli2 spec check: pass
- Implementation tests: not applicable because this patch changed the spec only

Composition:
Show a left-to-right transformation from a thin but under-owned recovery
specification into an implementation-ready operator cockpit contract. Include
three central lanes: ownership, runtime evidence, and scope guardrails. Show
`harness next` in the center, `meta.recovery` as an additive JSON envelope, and
a red gate blocking Runtime Card, Closeout Guardian, MCP, plugin UI, and broad
HE-Assemble until recovery evidence exists.

Style:
Professional engineering poster, dense but readable, restrained colour palette,
crisp diagrammatic layout.

Constraints:

- no fake dashboards
- no invented metrics
- no fake logos
- no unsupported claims
- no generic title unless accurate
- leave clean zones for deterministic overlay text
- use readable labels, not tiny filler text

Deterministic overlay text to add separately:

- JSC-311 Recovery Capsule Cockpit Spec
- From Implicit Recovery Spec -> Owned Evidence Contract
- Main improvement: ownership and runtime evidence are now contractual
- Evidence: BLUF pass; markdownlint-cli2 pass; implementation tests not applicable
- Loop outcome: optimal within available evidence
```
