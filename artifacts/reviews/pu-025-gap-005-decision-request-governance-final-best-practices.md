# PU-025 / GAP-005 Decision-Request Governance Final Best-Practices Review

## Scope
- Reviewed only the coordinator-provided slice:
  - src/lib/decision-request/**
  - src/commands/decision-request.ts
  - src/commands/decision-request.test.ts
  - src/lib/cli/registry/decision-request-command-spec.ts
  - src/lib/cli/registry/command-specs-core.ts
  - src/lib/cli/registry/command-capability-rules.ts
  - src/lib/cli/command-registry.test.ts
  - contracts/decision-request.schema.json
  - contracts/examples/decision-request.example.json
  - contracts/runtime-packet-schemas.manifest.json
  - scripts/validate-runtime-packet-schemas.cjs
  - src/dev/validate-runtime-packet-schemas-script.test.ts
  - README.md
  - docs/cli-reference.md
  - ARCHITECTURE.md
  - .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-025-gap-005-decision-request-governance-intent.json

## Findings (Severity-ranked)
- None.
- No blocker-level or high-severity governance regressions were found against the stated PU-025/GAP-005 intent.

## Requirement Coverage Evidence
- Registry command emission exists and is wired through the command registry:
  - src/lib/cli/registry/decision-request-command-spec.ts:5-14
  - src/lib/cli/registry/command-specs-core.ts:119
  - src/lib/cli/command-registry.test.ts:96-124
- Packet is explicitly read-only governance evidence, not closeout proof:
  - src/lib/decision-request/types.ts:24-31
  - src/lib/decision-request/types.ts:69-73
  - src/lib/decision-request/builder.ts:140-143
  - contracts/decision-request.schema.json:94-102
  - README.md:647
- Machine-readable intent/authority/options/evidence/escalation/freshness/stale-state present:
  - src/lib/decision-request/types.ts:56-74
  - src/lib/decision-request/builder.ts:122-145
  - contracts/decision-request.schema.json:7-24
- Fail-closed validations present for duplicate options/default mismatch/unknown tradeoff/malformed option/invalid enums-invalid date/blank escalation fields:
  - src/lib/decision-request/builder.ts:150-176
  - src/lib/decision-request/builder.ts:84-89
  - src/lib/decision-request/cli.ts:126-162
  - src/lib/decision-request/cli.ts:93-124
  - src/lib/decision-request/builder.ts:42-55
  - src/lib/decision-request/builder.ts:57-63
  - src/lib/decision-request/builder.ts:91-105
  - src/lib/decision-request/builder.ts:255-260
  - src/commands/decision-request.test.ts:90-163
- Stale/expiry normalization and stale-state classification are deterministic:
  - src/lib/decision-request/builder.ts:178-227
  - src/commands/decision-request.test.ts:64-88
- Public command is thin and logic is deep-module scoped under src/lib/decision-request:
  - src/commands/decision-request.ts:1-20
  - src/lib/decision-request/cli.ts:16-70
  - ARCHITECTURE.md:128-132

## Residual Risks / Gaps
- Low: schema-level constraints validate field presence and basic enum/format correctness but do not encode cross-field invariants such as `defaultOptionId` membership in `options[]` and option-id uniqueness. Current protection relies on builder/runtime tests rather than JSON schema alone.
  - Evidence: contracts/decision-request.schema.json:52-80; src/lib/decision-request/builder.ts:84-89,150-176
- Low: escalation `requestedAt` is always derived from `generatedAt` in CLI flow (no explicit CLI override flag), which is acceptable for this scope but limits future explicit backdated/escalated-at modeling without CLI surface extension.
  - Evidence: src/lib/decision-request/cli.ts:195-206; src/lib/decision-request/builder.ts:254-270

## Accountability Receipt
- status: complete
- manifest_path: artifacts/agent-runs/best-practices-researcher-019e698c-ad29-7683-9340-1b4e42ae59c9/manifest.json
- artifact_paths:
  - artifacts/reviews/pu-025-gap-005-decision-request-governance-final-best-practices.md
- findings:
  - no_blockers: true
  - total_findings: 0
  - residual_risks: 2
- failures_or_blockers:
  - template_missing: `agents/templates/review-artifact.md` and `agents/templates/blocker-artifact.md` not found in repository path scan; artifact produced using contract fields directly.
- improvement_opportunities:
  - Add schema-level cross-field validation strategy (or explicit validator note) for option-id uniqueness/default-option membership to reduce reliance on runtime-only checks.
  - Consider optional `--escalation-requested-at` for future audit scenarios requiring timestamp distinction from `generatedAt`.
- strengths:
  - Command registry integration is explicit and tested.
  - Governance boundary is strongly encoded via const fields (`governance_request_only`, `not_closeout_proof`, `runtimeStatus: emitted`).
  - Stale-state precedence logic is deterministic and test-covered.
- validation_evidence:
  - Coordinator-reported commands already passed for targeted tests, schema validation, command dispatch, catalog visibility, formatting, and diff checks.
  - Source validation confirmed by direct code and schema inspection in this review.
- next_action:
  - Coordinator can proceed with synthesis as no blocking governance defects were found in-scope.
- useful_findings:
  - Confirmed narrow deep-module boundary and non-closeout-proof semantics are implemented as intended.
- avoided_false_positive:
  - Did not flag schema-only invariant gaps as blockers because builder/runtime checks provide deterministic fail-closed enforcement in current architecture.
- evidence_quality:
  - high (line-level source evidence across command, builder, registry, schema, tests, docs)
- followed_scope:
  - true (review constrained to coordinator-provided files)
- reusable_learning:
  - For packet-contract slices, pairing schema consts with builder-level cross-field guards plus registry dispatch tests gives strong governance confidence without over-broad command-surface changes.
- coordinator_score:
  - 9/10 (clear intent, bounded scope, and provided validation receipts reduced ambiguity)

WROTE: artifacts/reviews/pu-025-gap-005-decision-request-governance-final-best-practices.md
