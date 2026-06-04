# PU-051 / CNF-005 Prompt Context Authority Classification Intent

## Objective

Implement CNF-005 as a bounded prompt-context contract slice: classify each prompt-context source reference with a closed authority taxonomy so future agents and validators can distinguish instruction authority from orientation-only or untrusted context.

## Source Evidence

- Goal source: `docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md` CNF-005 row.
- Active route: `.harness/active-artifacts.md` lists JSC-363 as the current Goal Governor route, but its PR-stack wording is stale relative to R245 and the tracked goal board.
- Memory surface: `.harness/memory/LEARNINGS.md` read before slice start; no CNF-005-specific conflicting rule found in the read window.
- Project Brain knowledge inventory: `.harness/knowledge/**` exists and was listed before implementation routing.
- Existing deep module: `src/lib/prompt-context/` owns `prompt-context-receipt/v1`.
- Existing drift module: `src/lib/prompt-context-drift/` owns freshness reporting and must remain separate from authority classification.

## Proposed Deep Module Placement

Primary module:

- `src/lib/prompt-context/prompt-context-receipt.ts`

Contract surfaces:

- `contracts/prompt-context-receipt.schema.json`
- `contracts/examples/prompt-context-receipt.example.json`
- `contracts/runtime-packet-schemas.manifest.json` only if schema metadata needs refresh; no new schema version is planned.

Tests:

- `src/lib/prompt-context/prompt-context-receipt.test.ts`
- `src/dev/validate-runtime-packet-schemas-script.test.ts` only if manifest/schema parity needs regression coverage.

Documentation:

- `ARCHITECTURE.md`
- `docs/agents/00-architecture-bootstrap.md`
- `docs/agents/07b-agent-governance.md`
- Goal tracker and route-truth board files after implementation validation.

## Authority Taxonomy

Add a required `authorityLayer` field to each prompt-context source ref with this closed vocabulary:

- `system_policy`
- `developer_policy`
- `repo_instruction`
- `trusted_skill`
- `plugin_metadata`
- `artifact_data`
- `review_feedback`
- `telemetry`
- `user_steering`
- `untrusted_external`

## Operating Rules

Instruction authority is allowed only for these layers:

- `system_policy`
- `developer_policy`
- `repo_instruction`
- `trusted_skill`
- `user_steering`

Orientation-only layers are not allowed to appear in `instructionSources` as behavior-steering instructions:

- `plugin_metadata`
- `artifact_data`
- `review_feedback`
- `telemetry`
- `untrusted_external`

Those layers may still appear in capability, goal, plugin, MCP, stale-state, or audit/orientation surfaces when the field location matches the source role and the receipt remains `evidenceUse: orientation` or `audit_trail`.

## Non-Goals

- Do not change prompt-context receipt `runtimeStatus`; it remains `not_yet_emitted`.
- Do not create a public command.
- Do not add delivery-truth, review-state, external-state, Linear, merge-readiness, or Judge/PM claim support.
- Do not parse raw prompts, transcripts, or private runtime payloads.
- Do not change `prompt-context-drift-report/v1` unless tests show a strict parity need.
- Do not infer authority from source text content; use explicit contract metadata only.

## Acceptance Criteria

- `PromptContextSourceRef` requires `authorityLayer`.
- The JSON schema requires `authorityLayer` on `sourceRef` objects and exposes the exact closed vocabulary.
- The checked-in prompt-context receipt example includes authority layers for instruction, skill, plugin, MCP, goal, and capability refs.
- Validation rejects missing or unknown `authorityLayer`.
- Validation rejects `instructionSources` entries with `authorityLayer` equal to `plugin_metadata`, `artifact_data`, `review_feedback`, `telemetry`, or `untrusted_external`.
- Validation accepts orientation-only non-instruction refs using `plugin_metadata`, `artifact_data`, or `telemetry` where those layers match the surface.
- Existing raw prompt, transcript, secret, unknown-field, emitted-runtime-status, and claim-support rejections continue to pass.

## Validation Plan

Focused first:

- `MISE_TRUSTED_CONFIG_PATHS=.mise.toml pnpm exec vitest run src/lib/prompt-context/prompt-context-receipt.test.ts src/dev/validate-runtime-packet-schemas-script.test.ts`
- `MISE_TRUSTED_CONFIG_PATHS=.mise.toml pnpm typecheck`
- `git diff --check`

If docs are updated:

- `MISE_TRUSTED_CONFIG_PATHS=.mise.toml bash scripts/run-harness-gate.sh docs-gate --mode required --json`
- `MISE_TRUSTED_CONFIG_PATHS=.mise.toml bash scripts/check-diagram-freshness.sh`

Route-truth after implementation:

- `jq -c . docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl >/dev/null`
- `PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-goal-board.py docs/goals/codex-runtime-evidence-verifier-cockpit`
- `PYTHONDONTWRITEBYTECODE=1 python3 scripts/check-goal-audit-freshness.py docs/goals/codex-runtime-evidence-verifier-cockpit --repo .`

## Review Plan

Before implementation:

- Request bounded adversarial and agent-native intent review.
- If reviewer artifact output fails again, record a blocker artifact and continue only after local intent checks show no material contradiction.

Before done claim:

- Run required skill-lens review across architecture improvement, simplification, slop-removal, HE code review, and testing.
- Request adversarial, agent-native, and best-practices review of the implementation or record a runtime blocker.
- Do not claim CNF-005 done until PR, CI, review-thread, CodeRabbit/Codex, predecessor-stack, and independent-review lanes are current.

## Rollback

Revert this slice's commit. Because the change is contract/schema/test/doc-only until runtime producers exist, rollback restores the previous prompt-context receipt shape without data migration.

## Explicit Non-Claims

This intent does not claim runtime producer emission, prompt extraction, delivery-truth consumption, review-state truth, external-state truth, Linear field truth, merge readiness, Judge/PM readiness, or parent-goal completion.
