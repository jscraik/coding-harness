# Image Prompt Metadata: JSC-311 Phase-Exit Evidence Gates

## Framing

| Field | Value |
| --- | --- |
| Plan name | JSC-311 HE Phase-Exit Evidence Gates Plan |
| Spec name | `.harness/specs/2026-05-13-jsc-311-he-phase-exit-evidence-gates-spec.md` |
| Original state | Ambiguous repo-state plan |
| Target state | PU-000 evidence gate |
| Main weakness | Git/filesystem disagreement could allow implementation to start from phantom source or invisible control-plane artifacts. |
| Main improvement | Source implementation is blocked until PU-000 reconciles source paths and plan/spec artifact visibility or receives an explicit spec-owner waiver. |
| Validation evidence | HE BLUF, artifact shape, artifact identity, Linear traceability, and markdownlint passed for plan/spec; repo-state inventory remains blocked. |
| Spec update status | updated |
| Confidence movement | 0.82 initial review confidence to 0.89 final defensible plan/spec confidence |
| Loop outcome | optimal within available evidence; implementation blocked by PU-000 repo-state evidence |

## Fallback `$imagegen` Prompt

$imagegen

Use case: plan-review technical infographic
Asset type: review artifact / X technical explainer
Recommended size: 2048x1152
Aspect ratio: 16:9

Title:
"From Ambiguous Repo-State Plan -> PU-000 Evidence Gate"

Subtitle:
"A bespoke transformation map for JSC-311 HE Phase-Exit Evidence Gates Plan and `.harness/specs/2026-05-13-jsc-311-he-phase-exit-evidence-gates-spec.md`"

Context:
The JSC-311 HE phase-exit evidence plan and spec were reviewed, patched, and aligned. The critical finding was that Git reports phantom `he-phase-exit` source paths and older artifacts while the filesystem exposes the live 2026-05-13 plan artifact. The patch turns implementation into a PU-000-only evidence gate until source paths and plan/spec artifact visibility are reconciled or explicitly waived.

Before state:

* Git/filesystem disagreement was a source-path blocker but not fully owned by the spec for plan artifacts.
* The plan's `safe_to_continue` status could be misread as permission to start source implementation.
* Implementation gates depended on future tests that could not safely run while PU-000 was blocked.

After state:

* PU-000 explicitly gates both phase-exit source paths and canonical plan/spec artifact visibility.
* Plan and spec both state that `safe_to_continue` only covers PU-000 inspection until reconciliation or waiver.
* Validation evidence separates passing plan/spec artifact gates from blocked source implementation gates.

Spec update shown:

* updated
* FR-017, SA-013, stop conditions, observability, and no-fog guidance now include canonical plan/spec artifact visibility.
* Remaining spec risk: runtime behavior remains untested until PU-000 clears and source implementation can begin.

Evidence shown:

* HE BLUF structure: pass
* HE artifact shape, identity, and Linear traceability: pass
* Repo-state inventory: blocked by reproduced Git/filesystem disagreement

Loop outcome:

* optimal within available evidence

Composition:
Show a left-to-right transformation from an ambiguous plan/spec pair to a validated, spec-aligned PU-000 gate. Include confidence movement, validation gates, rollback path, iterative review loop, stop condition, spec update status, and remaining risks. Leave clean space for deterministic overlay text.

Style:
Professional engineering poster, dense but readable, restrained colour palette, crisp diagrammatic layout, no fake dashboards, no invented metrics, no fake logos.

Deterministic overlay text to add separately:

* JSC-311 HE Phase-Exit Evidence Gates Plan
* `.harness/specs/2026-05-13-jsc-311-he-phase-exit-evidence-gates-spec.md`
* From Ambiguous Repo-State Plan -> PU-000 Evidence Gate
* Implementation blocked until source and artifact visibility reconcile
* Plan/spec validators pass; repo-state inventory blocked
* optimal within available evidence
