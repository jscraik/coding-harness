# Image Generation Prompt Metadata

Use case: specification-review technical infographic
Asset type: review artifact / X technical explainer
Recommended size: 2048x1152
Aspect ratio: 16:9

Title:
"From Implicit Recovery Spec -> Owned Evidence Contract"

Subtitle:
"A bespoke transformation map for .harness/specs/2026-05-13-JSC-311-recovery-capsule-cockpit-spec.md"

Context:
The Recovery Capsule Cockpit spec was reviewed as an operator-first harness contract for JSC-311. The patch tightened the spec by making ownership, decision authority, escalation, and runtime evidence explicit while preserving the thin-surface rule: Recovery Capsule remains a read-only `harness next` enhancement, not a new orchestration platform.

Before state:

- Ownership and escalation were implicit.
- Runtime evidence and observability were scattered across validation prose.
- Reviewers could confuse recovery orientation with executable gate evidence.

After state:

- Ownership, decision authority, and escalation are explicit.
- Observability is defined as command evidence, focused fixtures, and reviewable JSON.
- Acceptance criteria now block dashboards, persistent run-history databases, automatic memory promotion, and external tracker mutation in v1.

Evidence shown:

- BLUF structure check: pass
- markdownlint-cli2 spec check: pass
- Implementation tests: not applicable because this patch changed the spec only
- Image generation persistence: blocked by active image tool protocol

Composition:
Show a left-to-right transformation from a thin but under-owned recovery specification into an implementation-ready operator cockpit contract. Include three central lanes: ownership, runtime evidence, and scope guardrails. Show `harness next` in the center, `meta.recovery` as an additive JSON envelope, and a red gate blocking Runtime Card, Closeout Guardian, MCP, plugin UI, and broad HE-Assemble until recovery evidence exists. Include a small confidence movement marker from 86% to 91%.

Style:
Professional engineering poster, dense but readable, restrained colour palette, crisp diagrammatic layout, accessible contrast, no decorative clutter.

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
