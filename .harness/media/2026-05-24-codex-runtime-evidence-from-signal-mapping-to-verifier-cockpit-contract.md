# From Signal Mapping With Claim Gaps -> Verifier Cockpit Contract

## Purpose

This media sidecar records the required review-artifact image framing for the Codex Runtime Evidence Verifier Cockpit Spec. The active runtime did not expose a callable image generation tool, so the artifact is persisted as a production-grade fallback prompt and evidence sidecar rather than a generated PNG.

## Image Generation & Persistence Evidence

- media status: fallback-only
- imagegen invoked: no; blocked because no callable image generation tool is exposed in the active tool list
- generated-image cache source path: blocked; no generated bitmap exists
- repository .harness/media/ PNG path: blocked; no generated bitmap exists to persist
- prompt metadata path: .harness/media/2026-05-24-codex-runtime-evidence-from-signal-mapping-to-verifier-cockpit-contract-prompt.md
- sidecar path: .harness/media/2026-05-24-codex-runtime-evidence-from-signal-mapping-to-verifier-cockpit-contract.md
- repository PNG existence verification: blocked; image generation unavailable
- persistence method: blocked
- final user-facing text after imagegen permitted: yes
- residual risk: A generated visual still needs to be produced in a runtime that exposes image generation, then copied into .harness/media/ and referenced from this sidecar.

## Bespoke Framing

- spec name: Codex Runtime Evidence Verifier Cockpit Spec
- spec type: mixed integration, architecture, data model, and operational spec
- original state: source-grounded signal mapping with claim-verifier, root-hygiene, ownership, accessibility, observability, rollback, and acceptance-criteria gaps
- target state: verifier cockpit contract with explicit existing-contract composition, canonical root-surface projection, owner boundaries, rollback path, redaction guard, accessibility requirements, observability requirements, and pass/fail acceptance criteria
- main weakness: delivery-truth/v1 could have become a parallel verifier instead of composing runtime-evidence-contract/v1 and pr-closeout/v1
- main improvement: claim support is now tied to shared evidence receipts and existing Harness verifier semantics
- validation evidence: HE BLUF structure check pass; HE generated artifact shape check pass; markdownlint targeted docs check pass; marker scan pass with no matches
- artifact impact: canonical spec patched; prompt metadata and media sidecar created; PNG persistence blocked because generation is unavailable
- confidence movement: 78 percent before patch to 90 percent after patch and targeted validation
- loop outcome: optimal within available evidence

## Prompt Summary

Use the prompt metadata file to generate a 2048x1152 engineering infographic titled From Signal Mapping With Claim Gaps -> Verifier Cockpit Contract. The composition should show the reviewed transformation from loose runtime signals and claim gaps into a Harness-first verifier cockpit with evidence receipts, runtime cards, delivery truth, review state, external-state snapshots, and explicit remaining risks.

## Linked Context

- .harness/specs/2026-05-24-codex-runtime-evidence-verifier-cockpit-spec.md
- .harness/research/audits/2026-05-24-evidence-led-codebase-gap-audit.md
- src/lib/runtime/runtime-evidence-contract.ts
- src/lib/pr-closeout/types.ts
- docs/architecture/root-surface-classification.md
