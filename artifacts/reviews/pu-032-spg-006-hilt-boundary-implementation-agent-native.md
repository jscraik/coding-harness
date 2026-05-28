## Agent-Native Architecture Review

### Summary
The decision-request slice is agent-native and preserves the read-only governance boundary: agent and user share the same command surface (`decision-request`), boundary classification is machine-readable, and claim-sensitive boundaries require explicit evidence and non-current state. Within the scoped files, I found no material parity regressions or hidden human-only workflow dependencies.

### Capability Map

| UI Action | Location | Agent Tool | In Prompt? | Priority | Status |
|---|---|---|---|---|---|
| Emit decision request packet for bounded authority boundary | src/lib/cli/registry/decision-request-command-spec.ts:5 | `harness decision-request` via command registry | Yes (CLI docs) | Must-have | Pass |
| Provide explicit boundary class for HILT authority | src/lib/decision-request/hilt-boundary.ts:33 | `--boundary` validated against closed taxonomy | Yes (CLI docs + schema) | Must-have | Pass |
| Prevent routine uncertainty from becoming human-debt packet | src/lib/decision-request/hilt-boundary.ts:43 | build-time validation returning deterministic usage error | Yes (tests + command contract) | Must-have | Pass |
| Require evidence and non-current stale-state for claim-sensitive boundaries | src/lib/decision-request/hilt-boundary.ts:76 | builder validation + usage error path | Yes (tests) | Must-have | Pass |
| Keep packet non-closeout and governance-only | src/lib/decision-request/builder.ts:152 | fixed `runtimeStatus/evidenceUse/claimSupport` constants | Yes (schema + tests + docs) | Must-have | Pass |
| Human-readable boundary/blocker visibility | src/lib/decision-request/cli.ts:78 | text output includes boundary and blocker class | Partially (table-level docs only) | Should-have | Pass |

### Findings

#### Critical (Must Fix)
None.

#### Warnings (Should Fix)
None.

#### Observations
1. **Documentation depth gap for boundary taxonomy and claim-sensitive constraints** -- `docs/cli-reference.md:136` -- The command table names `decision-request` and `--boundary`, but does not enumerate allowed boundary values or document the special evidence+stale-state requirements for claim-sensitive boundaries. This is not a parity break (code and schema enforce it), but it may reduce discoverability for operators and external producers. Recommendation: add a short dedicated subsection under the command reference listing boundary enums and the claim-sensitive rule.

### What's Working Well
- Closed boundary taxonomy is enforced in both runtime validation and JSON schema, reducing drift between CLI producers and non-CLI producers.
- Claim-sensitive HILT cases are guarded with deterministic validation and explicit error code (`decision-request.boundary_evidence_required`), preventing routine ambiguity from being reframed as authority debt.
- Read-only governance posture is strongly preserved via constant packet fields and regression checks (`governance_request_only`, `not_closeout_proof`).
- Registry-level dispatch test confirms agent and user share the same operable command surface, avoiding split pathways.

### Score
- **6/6 high-priority capabilities are agent-accessible**
- **Verdict:** PASS

### Validation Ownership Classification
- `pnpm test:deep` blocked due missing credential environment was classified as **environment or tooling failure** (not introduced by this patch), matching the provided evidence context.

### Accountability Receipt
- status: completed
- manifest_path: n/a (coordinator did not request a run manifest path for this reviewer artifact)
- artifact_paths:
  - artifacts/reviews/pu-032-spg-006-hilt-boundary-implementation-agent-native.md
- findings:
  - observation_only: documentation depth gap for boundary taxonomy/claim-sensitive constraints
- failures_or_blockers:
  - none for scoped review
- improvement_opportunities:
  - Document allowed `--boundary` values and claim-sensitive constraints in command reference subsection
- strengths:
  - Strong action/context parity across CLI, builder, schema, and tests
  - Explicit non-closeout proof boundary retained
- validation_evidence:
  - src/lib/decision-request/hilt-boundary.ts:43
  - src/lib/decision-request/hilt-boundary.ts:86
  - src/lib/decision-request/builder.ts:152
  - src/lib/decision-request/cli.ts:78
  - src/commands/decision-request.test.ts:258
  - src/lib/cli/command-registry.test.ts:96
  - contracts/decision-request.schema.json:104
- next_action:
  - Optional docs-only follow-up to improve discoverability; no code correctness blocker in reviewed slice

WROTE: artifacts/reviews/pu-032-spg-006-hilt-boundary-implementation-agent-native.md
