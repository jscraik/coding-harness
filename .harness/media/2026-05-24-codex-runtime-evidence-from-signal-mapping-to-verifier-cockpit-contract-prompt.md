# Image Generation Prompt: Codex Runtime Evidence Verifier Cockpit

$imagegen

Use case: specification-review technical infographic
Asset type: review artifact / technical explainer
Recommended size: 2048x1152
Aspect ratio: 16:9

Title:
From Signal Mapping With Claim Gaps -> Verifier Cockpit Contract

Subtitle:
A bespoke transformation map for Codex Runtime Evidence Verifier Cockpit Spec

Context:
The reviewed specification maps local Codex runtime signals into Coding Harness evidence receipts, runtime cards, and claim verdicts. The review found that the original spec was source-grounded but still risked a second verifier layer, a parallel root hygiene taxonomy, weak ownership, weak accessibility and observability requirements, and pass/fail criteria that depended on unresolved producer decisions. The patch turns it into a bounded Harness-first verifier cockpit contract that composes existing runtime-evidence-contract and pr-closeout semantics.

Before state:

- Source-grounded Codex runtime mapping, but delivery-truth semantics could fork existing runtime and PR closeout contracts.
- Root hygiene receipt was named without explicitly projecting the canonical root-surface classification document.
- Accessibility, observability, rollback, redaction, and ownership gates were too implicit for implementation confidence.

After state:

- delivery-truth/v1 is explicitly a composition layer over runtime-evidence-contract/v1 and pr-closeout/v1 semantics.
- root-hygiene-classification/v1 is tied to docs/architecture/root-surface-classification.md.
- Acceptance criteria now include pass/fail proof for compatibility, root hygiene, accessibility, redaction, rollback, and source classification.

Evidence shown:

- HE BLUF structure check: pass.
- HE generated artifact shape check: pass.
- markdownlint targeted docs check: pass.
- Image generation: fallback-only because no callable image generation tool is exposed in the active runtime.

Composition:
Show a left-to-right transformation from a partially grounded runtime-signal map into a verifier cockpit contract. The left side should show loose signal sources and claim gaps. The center should show evidence-receipt/v1 as the normalization spine. The right side should show runtime-card/v1, delivery-truth/v1, review-state/v1, and external-state-snapshot/v1 with separate verdict lanes. Include small callouts for existing contract reuse, root-surface projection, accessibility labels, redaction guard, rollback path, and remaining Codex-native producer decision.

Style:
Professional engineering poster, dense but readable, restrained color palette, crisp diagrammatic layout, no fake product logos, no fake dashboards, no invented metrics, no unsupported production-readiness claims.

Constraints:

- no fake dashboards
- no invented metrics
- no fake logos
- no unsupported claims
- no raw secrets or prompt text
- no generic title
- leave clean zones for deterministic overlay text
- use readable labels, not tiny filler text

Deterministic overlay text to add separately:

- Codex Runtime Evidence Verifier Cockpit Spec
- From Signal Mapping With Claim Gaps -> Verifier Cockpit Contract
- Main improvement: claim support now composes existing runtime and PR closeout evidence contracts
- Validation: HE BLUF pass, HE artifact shape pass, markdownlint pass, media generation fallback-only
- Loop outcome: optimal within available evidence
