# PU-048 CNF-002 Skill-Lens Review

## Scope

Reviewed the PU-048/CNF-002 local implementation for environment-scoped
permission evidence across Codex runtime packet contracts, producer
normalization, validation, runtime-card projection, goal tracker surfaces, and
architecture/governance documentation.

This artifact records the coordinator lens pass. It does not replace the
independent adversarial, agent-native, or best-practices reviewer artifacts.

## Lenses

### improve-codebase-architecture

Result: pass

Evidence:
- Environment-scoped permission evidence is implemented inside the existing
  runtime deep module under src/lib/runtime/.
- The public packet remains a narrow facade over typed contracts, validation,
  producer normalization, reference integrity, and runtime-card adapters.
- Runtime-card output projects compact environmentRefs rather than exposing raw
  permission details.
- Governance surfaces were synchronized in AGENTS.md, ARCHITECTURE.md,
  docs/agents/00-architecture-bootstrap.md, and
  docs/agents/07b-agent-governance.md.

Residual risk:
- Live Codex Desktop producer wiring and delivery-truth consumption remain
  unclaimed future slices. This slice proves the contract and adapters only.

### simplify

Result: pass

Evidence:
- The change adds one focused environment snapshot to the existing packet
  rather than creating a new command family or parallel permission model.
- Validation uses the existing finding collection style and enum validation
  helpers.
- Runtime-card projection reuses the existing bundle-source path instead of
  introducing a separate summary store.
- The coordinator review removed a quiet over-claim path by requiring current
  environment state to carry explicit scope evidence.

Skipped:
- No shared abstraction was introduced for environment and permission
  validation because the current checks are small and easier to audit inline.

### unslopify

Result: pass

Evidence:
- CNF-002 goal, board, and receipt language separates local contract validation
  from live producer wiring, independent review, PR/CI truth, Linear truth, and
  parent-goal completion.
- No in-scope placeholder, draft-marker, or completion-by-assertion wording was
  introduced.
- The reviewer-artifact runtime miss is recorded as a blocker instead of being
  converted into a false pass.

Residual risk:
- Historical artifacts outside this slice may contain older deferred-language
  conventions. This pass only checked the CNF-002 change set.

### he-code-review

Result: pass with blocked independent-review lane

Evidence:
- Local code/test truth is separated from independent reviewer truth,
  PR/remote truth, CI truth, review-thread truth, tracker truth, Judge/PM
  readiness, and parent-goal completion.
- The implementation adds validation for stale cwd, approval-scope mismatch,
  missing sandbox-policy refs, unknown environment scope, and current-scope
  spoofing.
- The goal state and Kanban board keep CNF-002 in implementation rather than
  done while independent reviewer artifacts are missing.

Blocked lane:
- Required independent reviewer artifacts could not be recovered because the
  requested reviewer roles completed without writing files. The blocker is
  recorded in artifacts/reviews/pu048-cnf-002-reviewer-runtime-blocker.md.

### testing

Result: pass for focused local contract tests

Commands observed by coordinator:
- Command: pnpm exec vitest run src/lib/runtime/codex-runtime-evidence.test.ts src/lib/runtime/codex-runtime-evidence-producer.test.ts src/lib/runtime/codex-runtime-source-provenance.test.ts src/lib/runtime/runtime-evidence-adapter.test.ts src/lib/runtime/runtime-card-codex-runtime-projection.test.ts src/commands/runtime-card.test.ts -> pass (6 files, 88 tests)
- Command: pnpm typecheck -> pass
- Command: PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-goal-board.py docs/goals/codex-runtime-evidence-verifier-cockpit -> pass after R233
- Command: PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-goal-audit-freshness.py docs/goals/codex-runtime-evidence-verifier-cockpit --repo . -> pass after R233

Coverage notes:
- Focused tests prove environment snapshots validate across desktop and
  subagent executor kinds, stale cwd is blocked, approval-scope mismatch is
  blocked, missing sandbox-policy refs are blocked, unbacked sandbox-policy
  refs are blocked, and current environment claims without explicit scope
  evidence are rejected.
- Broader validation must be rerun after reviewer recovery and before commit or
  PR handoff.

## Verdict

No material fixable issue remains from the coordinator skill-lens pass. The
slice remains not done because independent reviewer artifacts are blocked and
broader validation has not yet been rerun after the anti-spoofing patch.

WROTE: artifacts/reviews/pu048-cnf-002-skill-lenses.md
