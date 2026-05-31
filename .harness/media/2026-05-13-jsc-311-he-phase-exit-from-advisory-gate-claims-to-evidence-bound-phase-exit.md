# From Advisory Gate Claims -> Evidence-Bound Phase Exit

## Purpose

This review artifact records the media framing for the technical review of
`.harness/specs/2026-05-13-jsc-311-he-phase-exit-evidence-gates-spec.md`. It
exists to make the spec transformation inspectable without treating generated
media as implementation, validation, review, or commit-readiness evidence.

## Image Generation & Persistence Evidence

* media status: generation-blocked
* `$imagegen` invoked: blocked
* generated-image cache source path: blocked because the available image tool
  does not expose a repository-local generated bitmap path that can be copied
  and verified while still returning the required structured final report
* repository `.harness/media/` PNG path: blocked; no PNG generated or persisted
* prompt metadata path: `.harness/media/2026-05-13-jsc-311-he-phase-exit-from-advisory-gate-claims-to-evidence-bound-phase-exit-prompt.md`
* sidecar path: `.harness/media/2026-05-13-jsc-311-he-phase-exit-from-advisory-gate-claims-to-evidence-bound-phase-exit.md`
* repository PNG existence verification: blocked
* persistence method: blocked
* final user-facing text after imagegen permitted: no
* residual risk: no bitmap was generated; the fallback prompt is ready for a
  tool that exposes a persistable output path

## Bespoke Framing

* spec name: `.harness/specs/2026-05-13-jsc-311-he-phase-exit-evidence-gates-spec.md`
* spec type: mixed operational / validation / agent workflow specification
* original state: advisory gate claims with implicit ownership and scattered
  risk/observability requirements
* target state: evidence-bound phase-exit contract with explicit authority,
  stop conditions, local evidence surfaces, and deterministic blocker summaries
* main weakness: implementers could treat advisory labels, recovery metadata,
  memory, chat text, or phantom Git paths as stronger evidence than they are
* main improvement: commit readiness is tied to typed, artifact-backed
  `HeGateResult/v1` and `HePhaseExit/v1` evidence with fail-closed behavior
* validation evidence: HE BLUF structure pass; HE artifact shape pass; HE
  artifact identity pass; Linear traceability pass; markdown lint pass with
  non-blocking `.npmrc` substitution warning
* artifact impact: canonical spec updated; media prompt metadata and sidecar
  created under `.harness/media/`
* confidence movement: 84% initial -> 89% final defensible confidence
* loop outcome: optimal within available evidence

## Prompt Summary

Use the prompt metadata file next to this sidecar. It asks for a professional
engineering infographic titled "From Advisory Gate Claims -> Evidence-Bound
Phase Exit" and limits visual claims to the reviewed spec patch and actual
validation evidence.

## Linked Context

* spec: `.harness/specs/2026-05-13-jsc-311-he-phase-exit-evidence-gates-spec.md`
* related rule: `AGENTS.md`
* adjacent spec: `.harness/specs/2026-05-13-JSC-311-recovery-capsule-cockpit-spec.md`
