# PU-047 CNF-001 Skill-Lens Review

## Scope

Reviewed the PU-047/CNF-001 local implementation for Codex user-message
correlation across runtime evidence, steering queue, schema/example validation,
goal tracker surfaces, and architecture/governance documentation.

This artifact records the coordinator lens pass. It does not replace the
independent adversarial, agent-native, or best-practices reviewer artifacts.

## Lenses

### improve-codebase-architecture

Result: pass

Evidence:
- Work is placed in existing deep modules rather than a new command or broad
  orchestration surface.
- Runtime identity changes live in src/lib/runtime/.
- Steering queue correlation and stale-precondition logic live in
  src/lib/steering-queue/.
- Semantic validation stays in scripts/validate-steering-queue.cjs and the
  steering queue validation module.
- Architecture surfaces were synchronized in AGENTS.md, ARCHITECTURE.md,
  docs/agents/00-architecture-bootstrap.md, and
  docs/agents/07b-agent-governance.md.

Residual risk:
- Runtime-card continuity and delivery-truth consumption are intentionally not
  implemented in this slice and remain separate CNF/final-closeout lanes.

### simplify

Result: pass

Evidence:
- The runtime producer accepts an optional nullable field and preserves null
  rather than introducing a new adapter, fallback mapper, or derived ID helper.
- The steering queue builder adds one focused stale-precondition comparison.
- Validation logic uses the existing nullable safe-pointer helper style and
  existing semantic error collection.
- No broad refactor or unrelated cleanup was introduced.

Skipped:
- No dedupe extraction was applied because the added checks are small and local;
  extracting a shared abstraction would add more indirection than leverage.

### unslopify

Result: pass

Evidence:
- No in-scope TODO, placeholder, or draft-marker text was introduced for
  PU-047/CNF-001.
- The goal-root shape regression was caught by
  scripts/check-goal-board.py and fixed by moving intent artifacts to the
  validator-accepted notes/ surface rather than weakening the validator.
- clientUserMessageId source capability is documented explicitly; missing live
  extraction is blocked/unknown, not hidden as a future implementation note.

Residual risk:
- Historical receipts and older goal notes still contain legitimate deferred
  follow-up language from prior slices. Those are outside this slice.

### he-code-review

Result: pass with residual blocked lane

Evidence:
- Readiness claims remain separated: local code/test truth, goal board truth,
  live Codex Desktop extraction, delivery-truth consumption, review state,
  tracker state, Judge/PM readiness, and parent-goal completion are not
  collapsed.
- The slice records current evidence boundaries in goal.md, state.yaml, the
  Kanban board, and the source-capability note.
- Review-swarm artifacts are still required before the slice can be marked done.

Blocked lane:
- pnpm test:deep reached the external E2E credential boundary. The approved
  private env surface ~/.codex/.env exists as a FIFO rather than a regular env
  file, so env-loaded E2E credential recovery is blocked without safely reading
  a FIFO or printing secrets.

### testing

Result: pass with one blocked deep gate

Commands observed by coordinator:
- Command: pnpm exec vitest run src/lib/runtime/codex-runtime-evidence.test.ts src/lib/runtime/codex-runtime-evidence-producer.test.ts src/lib/steering-queue/steering-queue.test.ts -> pass
- Command: node scripts/validate-steering-queue.cjs contracts/examples/steering-queue.example.json -> pass
- Command: pnpm typecheck -> pass
- Command: bash scripts/run-harness-gate.sh docs-gate --mode required --json -> pass
- Command: pnpm lint -> pass
- Command: pnpm test -> pass
- Command: pnpm audit -> pass
- Command: pnpm check -> pass
- Command: bash scripts/validate-codestyle.sh -> pass
- Command: PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-goal-board.py docs/goals/codex-runtime-evidence-verifier-cockpit -> pass after moving intent artifacts to notes/
- Command: PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-goal-audit-freshness.py docs/goals/codex-runtime-evidence-verifier-cockpit --repo . -> pass
- Command: git diff --check -> pass
- Command: pnpm test:deep -> blocked (external E2E credentials unavailable through a regular env file; ~/.codex/.env is a FIFO)

Coverage notes:
- Focused tests prove producer-provided clientUserMessageId is carried,
  missing producer input remains null, stale expected/current message mismatch
  is classified, and applied steering items cannot omit or mismatch the applied
  client message ID when an expected ID exists.
- The blocked deep gate prevents claiming production E2E behavior or live
  external integration readiness.

## Verdict

No material fixable issue remains from the coordinator skill-lens pass before
independent reviewer synthesis. The slice remains not done until the required
post-implementation reviewer artifacts are present, reviewed, and incorporated
into R224.

WROTE: artifacts/reviews/pu047-cnf-001-skill-lenses.md

