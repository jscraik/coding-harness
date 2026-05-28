# PU-032 / SPG-006 HILT Boundary Implementation Review (Best Practices)

## Scope
- src/lib/decision-request/types.ts
- src/lib/decision-request/hilt-boundary.ts
- src/lib/decision-request/builder.ts
- src/lib/decision-request/cli.ts
- src/commands/decision-request.test.ts
- src/lib/cli/command-registry.test.ts
- src/lib/cli/registry/decision-request-command-spec.ts
- contracts/decision-request.schema.json
- contracts/examples/decision-request.example.json
- docs/cli-reference.md
- .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-032-spg-006-hilt-boundary-intent.json

## Findings

### 1) Medium - Claim-sensitive evidence check accepts structurally empty evidence refs when builder is called directly
- Severity: medium
- Evidence: src/lib/decision-request/hilt-boundary.ts:86 only enforces `input.evidenceRefs.length > 0`; contracts/decision-request.schema.json:82-87 allows string items with no `minLength`; reproduction command:
  - `node --import tsx -e "import { buildDecisionRequest } from ./src/lib/decision-request/builder.ts; const r=buildDecisionRequest({generatedAt:2026-05-28T09:10:00.000Z,intent:Claim