---
type: project-brain-domain
status: active
domain: runtime-evidence
sources: [AGENTS.md, src/lib/runtime, src/lib/delivery-truth, src/lib/review-state, src/lib/external-state]
aliases: [runtime-evidence-knowledge]
confidence: high
reviewed: 2026-05-26
sensitivity: internal
---

# Runtime Evidence Knowledge

**Last verified:** 2026-05-26
**Verification source:** manual
**Confidence:** high
**Owner:** coding-harness maintainers

## Confirmed facts

- Runtime-card evidence, runtime-evidence bundles, evidence receipts, delivery-truth, review-state, and external-state packets are advisory evidence surfaces.
  - Source: AGENTS.md
- Runtime evidence work lives primarily under src/lib/runtime, src/lib/delivery-truth, src/lib/review-state, and src/lib/external-state.
  - Source: src/lib/delivery-truth
- Claims about delivery truth need source kind, freshness, head SHA, blocker class, and verification timestamps rather than local green status alone.
  - Source: AGENTS.md

## Patterns

- Runtime evidence changes should preserve separate verdicts for local validation, remote checks, review threads, tracker state, and merge readiness.
- Evidence packets should stay additive and artifact-backed until a production verifier surface intentionally wires them into closeout authority.

## Gotchas

- A pass-looking runtime packet can still be misleading if its source is stale, synthesized, or missing head-SHA/freshness proof.
- Local validation success is not delivery-truth success unless the relevant external horizon was observed.

## References

- src/lib/runtime/
- src/lib/delivery-truth/
- src/lib/review-state/
- src/lib/external-state/
- AGENTS.md
