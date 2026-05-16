---
last_validated: 2026-05-16
---

# Runtime-Aware Harness Control Plane

## Table of Contents
- [Purpose](#purpose)
- [Architecture Posture](#architecture-posture)
- [Evidence Spine](#evidence-spine)
- [Harness Run Context](#harness-run-context)
- [Boundaries](#boundaries)
- [Validation](#validation)
- [Next Slices](#next-slices)

## Purpose

Coding Harness should stay Codex-aligned and harness-stable: Codex owns the
agent runtime, while Coding Harness owns repository workflow policy, evidence
interpretation, and professional handoff.

This architecture lane moves repo work from prompt-led status reconstruction to
evidence-led runtime control. The goal is shorter PR lead time without weakening
review evidence, rollback safety, or independent review.

## Architecture Posture

Use upstream Codex runtime concepts as contracts when they are available:

- profiles and permissions describe intent and risk
- workspace roots describe scope
- sessions and trace ids describe provenance
- lifecycle events describe current state
- memory contributors describe durable context
- diagnostics describe what is broken

Expose those ideas through stable harness interfaces instead of depending on
private Codex source paths, unstable logs, or one current runtime build.

## Evidence Spine

Runtime-aware work should flow through a small set of evidence surfaces:

1. `Operation Profile` names the bounded mode, such as `triage`, `fix`,
   `review`, `ci-babysit`, `linear-mutate`, or `release`.
2. `Harness Run Context` records local runtime evidence: repo identity,
   worktree roots, sessions, traces, permissions, targets, blockers, and
   lifecycle status.
3. `Run Record` persists terminal manifests, event streams, and additive
   companion artifacts under `artifacts/agent-runs/<runId>/`.
4. Phase-exit and validation gates consume structured evidence instead of
   chat-only claims.
5. PR work ledgers, Linear reconciliation, and Project Brain learnings reuse the
   same evidence rather than asking the operator to reconstruct what happened.

## Harness Run Context

`harness-run-context/v1` is the first implementation contract for this lane. It
is a pure TypeScript model and validator under `src/lib/contract/`.

The v1 packet includes:

- schema version
- operation profile
- lifecycle status
- repository context: cwd, repo root, worktree root, git common dir, branch,
  and head SHA
- session ids and trace ids
- workspace roots
- permission context: sandbox mode, permission profile, network state, readable
  roots, and writable roots
- validation evidence references
- review artifact references
- Linear, PR, and external repository targets
- blockers

The contract intentionally accepts `unknown` for unavailable runtime evidence so
producers can degrade honestly without fabricating precision. `repo.headSha` is
the exception: it must be a real lowercase 40-character SHA or the explicit
`unknown` sentinel.

## Boundaries

This lane does not make Coding Harness a Codex runtime clone.

Coding Harness owns:

- stable local contracts
- repo and worktree interpretation
- validation lane routing
- PR, Linear, and Project Brain evidence mapping
- blocker classification
- professional handoff outputs

Codex owns:

- agent execution
- raw session lifecycle
- runtime permissions
- workspace-root selection
- tool execution
- runtime memory providers

Integrations must remain contract-level and reversible. A harness command may
read Codex-provided evidence when available, but the command should still return
a useful degraded context when that evidence is absent.

## Validation

The initial tracer proof is intentionally narrow:

- `validateHarnessRunContext` rejects malformed profiles, lifecycle statuses,
  arrays, permission network states, external target shapes, and fake head SHAs.
- The public contract barrel exports the model so future `harness doctor`, PR
  ledger validation, phase-exit evidence, and Project Brain providers can share
  one type instead of inventing parallel packets.
- Documentation links the contract to north-star language: thin surface, strong
  guardrails, durable memory, and professional output.

## Next Slices

1. Add a read-only `harness doctor --json` local diagnostics surface on top of
   `Harness Run Context`.
2. Introduce typed operation profile policy for validation lanes and stop
   conditions.
3. Emit run-record companion artifacts that reference the run context.
4. Validate or autofill PR work-ledger fields from run context plus run-record
   evidence.
5. Add a lifecycle status classifier for PR babysitting and CI wait loops.
6. Expose Project Brain list/read/search/active context as a provider-style
   harness interface.
