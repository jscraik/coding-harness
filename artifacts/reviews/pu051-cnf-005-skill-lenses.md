# PU-051 CNF-005 Skill-Lens Validation

## Scope

Slice CNF-005 adds prompt-context source-ref authority classification to `prompt-context-receipt/v1`.
This artifact records the required skill-lens checks before the slice is treated as locally ready for PR handoff.

## Improve-Codebase-Architecture

- Result: pass
- Evidence:
  - `src/lib/prompt-context/prompt-context-receipt.ts:39` defines the closed authority-layer vocabulary inside the existing prompt-context deep module.
  - `src/lib/prompt-context/prompt-context-receipt.ts:248` keeps `instructionSources` validation in the receipt validator instead of moving claim authority into delivery-truth or prompt-context-drift.
  - `ARCHITECTURE.md:146`, `docs/agents/00-architecture-bootstrap.md:229`, and `docs/agents/07b-agent-governance.md:131` document the deep-module placement and non-claim boundary.
- Judgment: the implementation deepens the existing prompt-context module rather than creating a new public command or cross-module authority path.

## Simplify

- Result: pass
- Evidence:
  - The new behavior is limited to a required field, closed vocabulary constants, one instruction-source restriction, schema parity, examples, and focused tests.
  - `contracts/prompt-context-receipt.schema.json:181` duplicates the instruction-source schema shape intentionally because the repository runtime packet schema validator rejected `allOf` during validation.
- Judgment: the schema duplication is less elegant than composition, but it is the smallest compatible implementation proven by the local validator. A broader helper extraction is not justified in this slice.

## Unslopify

- Result: pass
- Evidence:
  - `src/lib/prompt-context/prompt-context-receipt.ts:108` includes `authorityLayer` in the allowed source-ref key list, preventing silent extra-field drift.
  - `src/lib/prompt-context/prompt-context-receipt.test.ts:260` through `src/lib/prompt-context/prompt-context-receipt.test.ts:349` cover missing, unknown, disallowed-in-instruction, and allowed-orientation authority layers.
  - `contracts/examples/prompt-context-receipt.example.json` carries concrete authority layers for all example source refs.
- Judgment: no placeholder behavior, deferred implementation markers, fake current-tool claims, or dead test-only vocabulary were introduced.

## HE Code Review

- Result: pass with reviewer-runtime blockers recorded
- Evidence:
- Runtime blocker artifacts were written for missing adversarial, agent-native, and best-practices review artifacts after completed agents failed to persist required reports; adversarial and agent-native artifact-only retries also completed without required artifacts and were recorded as blocked runtime lanes.
  - The implementation preserves explicit non-claims: prompt-context receipts remain pointer-only, `not_yet_emitted`, and not command authority, delivery-truth support, Judge/PM readiness proof, PR/CI truth, or merge-readiness proof.
- Judgment: deterministic local validation supports PR handoff. Independent review coverage remains a separate blocked lane and must not be represented as completed.

## Testing

- Result: pass
- Evidence:
  - `MISE_TRUSTED_CONFIG_PATHS=.mise.toml pnpm exec vitest run src/lib/prompt-context/prompt-context-receipt.test.ts src/dev/validate-runtime-packet-schemas-script.test.ts` -> pass after replacing unsupported schema `allOf` with an explicit schema definition.
  - `MISE_TRUSTED_CONFIG_PATHS=.mise.toml pnpm typecheck` -> pass after replacing tuple `includes` with a string `Set` membership check.
  - `git diff --check` -> pass.
  - `MISE_TRUSTED_CONFIG_PATHS=.mise.toml bash scripts/run-harness-gate.sh docs-gate --mode required --json` -> pass.
  - `MISE_TRUSTED_CONFIG_PATHS=.mise.toml bash scripts/check-diagram-freshness.sh` -> pass.
  - `MISE_TRUSTED_CONFIG_PATHS=.mise.toml pnpm run quality:docstrings` -> pass.
  - `MISE_TRUSTED_CONFIG_PATHS=.mise.toml pnpm run quality:size` -> pass with existing size-ratchet warnings; no blocking size failure.
  - `MISE_TRUSTED_CONFIG_PATHS=.mise.toml pnpm run test:related` -> pass with baseline documented-command dispatch warnings; exit code 0.

## Residual Risks

- Post-implementation subagent review artifacts were blocked by runtime artifact persistence failures.
- The prompt-context receipt producer remains `not_yet_emitted`; this slice proves contract validation, not live runtime emission.
- The schema composition fallback is intentionally duplicated until the repo schema validator supports composition constructs such as `allOf`.

WROTE: artifacts/reviews/pu051-cnf-005-skill-lenses.md
