---
schema_version: 1
artifact_type: implementation-note
title: Runtime Evidence Full Lifecycle Steering Admission
date: 2026-05-24
related_plan: .harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md
related_spec: .harness/specs/2026-05-24-codex-runtime-evidence-verifier-cockpit-spec.md
related_issue: JSC-363
status: active
---

# Runtime Evidence Full Lifecycle Steering Admission

## Feedback Signal

The user clarified that a Phase 1-only plan or PR would not satisfy the specified and implied intent of the conversation. The intended outcome is the full implementation and fix lifecycle for the Codex runtime evidence verifier cockpit, not only a planning artifact, spec review, or Harness-only foundation slice.

## Root Operational Failure

The workflow allowed a reviewed HE plan to become a candidate delivery artifact while the plan still encoded Phase 1 as the effective execution horizon. That created a false-success path: the plan could pass artifact and review checks while still failing the user's intended full lifecycle outcome.

## Failure Category

- unclear authority boundaries
- poor workflow design
- missing guardrails
- insufficient deterministic enforcement
- lack of verification
- stale-state and false-success risk

## Durable System Improvement

The plan was changed from a Phase 1 fixture plan into a full lifecycle implementation plan. The durable guard is now part of the canonical plan contract:

- Phase 1 is only the foundation stage, not the completion boundary.
- Planning, research, and specification artifacts cannot be presented as full implementation delivery.
- PR closeout must name the lifecycle stage actually completed.
- Full implementation requires production delivery-truth, review-state, external-state, Codex runtime producer, runtime cockpit, closeout refresh, Judge/PM audit packet, and hardening stages.
- Goal completion remains blocked until Judge/PM audit evidence or an explicitly authorized blocked status exists.

## Future Behavior Change

Future agents should not be able to treat plan/spec approval, reviewer mailbox summaries, local validation, or private fixtures as full delivery. The plan now requires stage-specific claim evidence and separates planning readiness, foundation completion, production verifier completion, Codex bridge completion, closeout readiness, Judge/PM audit readiness, and goal completion.

## Validation Requirements

The current-session validation proved:

- Command: python3 /Users/jamiecraik/dev/agent-skills/Plugins/harness-engineering/scripts/check_generated_artifact_shape.py .harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md --kind plan --json -> pass
- Command: python3 /Users/jamiecraik/dev/agent-skills/Plugins/harness-engineering/scripts/check_bluf_structure.py .harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md --json -> pass
- Command: pnpm markdownlint .harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md .harness/specs/2026-05-24-codex-runtime-evidence-verifier-cockpit-spec.md .harness/implementation-notes/2026-05-24-runtime-evidence-full-lifecycle-steering-admission.md -> pass
- Command: unfinished-marker scan across the touched plan, spec, and implementation note -> pass, no matches
- Command: bash scripts/validate-codestyle.sh --fast -> pass

## Closeout Rule

Do not report the Codex runtime evidence verifier cockpit as implemented until the plan's PU-000 through PU-016 lifecycle units have current validation evidence, or until a narrower PR truthfully states the exact lifecycle stage it completed.
