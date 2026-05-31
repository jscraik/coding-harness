# From Overstated Readiness -> Evidence-Limited Delivery Contract

## Media Status

- media status: generation-blocked
- blocker: the active image-generation tool requires no assistant text after invocation, while the user-requested workflow requires a structured final written review after the media section.
- repository PNG path: blocked
- generated-image cache source path: blocked
- prompt metadata path: `.harness/media/2026-05-13-jsc-311-recovery-capsule-cockpit-from-overstated-readiness-to-evidence-limited-delivery-contract-prompt.md`
- sidecar path: not created because no generated bitmap exists

## Bespoke Framing

- plan name: JSC-311 Recovery Capsule Cockpit Plan
- spec name: `.harness/specs/2026-05-13-JSC-311-recovery-capsule-cockpit-spec.md`
- original state: plan/spec pair with useful scope but overstated readiness and stale spec metadata
- target state: PU-001-ready delivery contract with evidence-limited confidence and explicit security/privacy boundary review
- main weakness: unimplemented runtime behavior was too close to production-ready confidence language
- main improvement: readiness now means start ADR plus AI architecture/ERD only, not runtime proof
- validation evidence: HE plan/spec validators, identity lint, traceability lint, markdownlint, and local source evidence
- spec update status: updated
- confidence movement: 91% overstated -> 89% evidence-limited
- loop outcome: optimal within available evidence after validator rerun

## Fallback `$imagegen` Prompt

$imagegen

Use case: plan-review technical infographic
Asset type: review artifact / X technical explainer
Recommended size: 2048x1152
Aspect ratio: 16:9

Title:
"From Overstated Readiness -> Evidence-Limited Delivery Contract"

Subtitle:
"A bespoke transformation map for JSC-311 Recovery Capsule Cockpit Plan and Spec"

Context:
The JSC-311 Recovery Capsule Cockpit plan and associated spec were reviewed as an operator-first solo harness delivery contract. The patch narrowed readiness to PU-001, corrected confidence below the production-ready band, aligned spec metadata with the existing plan, and added a concrete security/privacy boundary review for the future recovery read path.

Before state:

- Plan confidence and readiness language could be mistaken for runtime proof.
- Spec metadata still said ready for plan after the canonical plan existed.
- Security/privacy validation was scoped conceptually but not a concrete plan gate.

After state:

- Plan is explicitly ready for PU-001 only: ADR plus AI architecture and ERD.
- Spec metadata points to the plan and records ready_for_pu_001.
- Security/privacy boundary review must check for secrets, network, external systems, and writer APIs after implementation files exist.

Spec update shown:

- updated
- status changed to planned, source_plan added, implementation_readiness changed to ready_for_pu_001.
- Remaining spec risk: runtime behavior still requires implementation and focused tests.

Evidence shown:

- Plan/spec validators: pass after rerun.
- Markdown lint: pass after rerun with non-blocking npm token warning if emitted.
- Runtime behavior: blocked until implementation exists.

Loop outcome:

- optimal within available evidence

Composition:
Show a left-to-right transformation from an overconfident plan/spec pair to a bounded, evidence-limited implementation contract. Include confidence movement, PU-001 gate, spec metadata alignment, security/privacy boundary review, rollback path, validation gates, remaining runtime risks, and final loop outcome. Leave clean space for deterministic overlay text.

Style:
Professional engineering poster, dense but readable, restrained colour palette, crisp diagrammatic layout, no fake dashboards, no invented metrics, no fake logos.

Deterministic overlay text to add separately:

- JSC-311 Recovery Capsule Cockpit Plan
- `.harness/specs/2026-05-13-JSC-311-recovery-capsule-cockpit-spec.md`
- From Overstated Readiness -> Evidence-Limited Delivery Contract
- Main improvement: PU-001 readiness replaces false production confidence
- Evidence: validators pass; runtime testing still required
- Loop outcome: optimal within available evidence
