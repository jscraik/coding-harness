# PU-012 Current-Main Producer Proof Intent Review

## Verdict

needs_changes

## Accountability Receipt

- status: needs_changes
- manifest_path: \`artifacts/agent-runs/adversarial-reviewer-019e9fea-a9b0-7a63-b81e-9efe17a1674b/manifest.json\`
- artifact_paths:
  - \`artifacts/reviews/pu012-current-main-producer-proof-intent-adversarial.md\`
- findings:
  - High: fixture-only validation can still pass while current-main or the real wrapper boundary has drifted.
  - Medium: packet admission validates the source snapshot, but not the provenance payload it carries.
- failures_or_blockers:
  - No live execution was required for this review, but the intent still needs correction before it can safely authorize PU-012 source edits.
- improvement_opportunities:
  - Add a live checkout assertion or an integration-style proof that derives the source snapshot from the actual current head and wrapper file.
  - Either validate \`sourceProvenance\` against the same observed snapshot or remove the checksum-backed fallback wording from the intent.
- strengths:
  - The intent correctly keeps live Codex emission, delivery truth, Linear, Judge/PM, and parent-goal completion out of scope.
  - The validation floor is explicit and includes the producer- and provenance-specific unit tests.
- validation_evidence:
  - \`docs/goals/codex-runtime-evidence-verifier-cockpit/notes/PU-012-current-main-producer-proof-intent.md:52-74\`
  - \`docs/goals/codex-runtime-evidence-verifier-cockpit/notes/PU-012-current-main-producer-proof-intent.md:140-162\`
  - \`src/lib/runtime/codex-runtime-evidence-producer.ts:146-188\`
  - \`src/lib/runtime/codex-runtime-evidence-producer.test.ts:260-297\`
  - \`src/lib/runtime/codex-runtime-source-provenance.ts:134-147\`
  - \`src/lib/runtime/runtime-evidence-adapter.ts:190-260\`
- next_action:
  - Revise the intent so the PU-012 validation floor proves the live checkout bridge boundary, not only a synthetic fixture path, and so the provenance claim matches what the producer actually validates.

## Findings

1. High: fixture-backed current-main proof can go green even if the real checkout has drifted.
   - Evidence:
     - The intent says the current-main reconciliation already has evidence in this checkout and that the selected boundary is the harness-owned wrapper/import producer, then points the reviewer at unit-test validation only. See [intent lines 52-74](/Users/jamiecraik/dev/coding-harness/docs/goals/codex-runtime-evidence-verifier-cockpit/notes/PU-012-current-main-producer-proof-intent.md#L52-L74) and [intent lines 153-169](/Users/jamiecraik/dev/coding-harness/docs/goals/codex-runtime-evidence-verifier-cockpit/notes/PU-012-current-main-producer-proof-intent.md#L153-L169).
     - The producer only validates the supplied \`sourceSnapshot\` and then admits the packet; it does not derive the snapshot from the actual checkout. See [producer lines 146-188](/Users/jamiecraik/dev/coding-harness/src/lib/runtime/codex-runtime-evidence-producer.ts#L146-L188).
     - The tests use hard-coded fixture helpers for the “matching” source snapshot and wrapper provenance instead of reading the real repo head or file blobs. See [test lines 260-297](/Users/jamiecraik/dev/coding-harness/src/lib/runtime/codex-runtime-evidence-producer.test.ts#L260-L297).
   - Impacted behavior: \`pnpm vitest run src/lib/runtime/codex-runtime-evidence.test.ts src/lib/runtime/runtime-evidence-adapter.test.ts\` and the producer-specific tests can all pass while the live main checkout, wrapper file, or blob identity has already drifted. That would authorize PU-012 edits on a proof path that does not actually prove current main.
   - Remediation: add one narrow live-checkout assertion or integration test that computes the real current head and wrapper blob for the selected boundary before admitting the packet, or explicitly downgrade this note from “current-main” proof to fixture-only unit coverage.
   - Confidence: 85
   - Validation ownership: introduced by current patch

2. Medium: the intent promises checksum-backed provenance binding, but the producer never validates the provenance payload itself.
   - Evidence:
     - The intent says source provenance is validated through commit SHA or checksum-backed fallback before packet admission. See [intent lines 140-145](/Users/jamiecraik/dev/coding-harness/docs/goals/codex-runtime-evidence-verifier-cockpit/notes/PU-012-current-main-producer-proof-intent.md#L140-L145).
     - The producer validates only \`input.sourceSnapshot\` and then passes \`input.sourceProvenance\` through unchanged into the packet. See [producer lines 146-188](/Users/jamiecraik/dev/coding-harness/src/lib/runtime/codex-runtime-evidence-producer.ts#L146-L188).
     - The provenance type carries \`commitSha\` and per-file \`sourceFileChecksums\`, but this review surface does not show any check that ties those fields back to the validated snapshot. See [provenance lines 134-147](/Users/jamiecraik/dev/coding-harness/src/lib/runtime/codex-runtime-source-provenance.ts#L134-L147).
   - Impacted behavior: a caller can supply a valid snapshot and an otherwise admissible packet while the attached provenance fields are stale, mismatched, or synthetic. Downstream consumers would then treat unverified provenance as if it had been bound to the packet’s admission proof.
   - Remediation: either validate the provenance payload against the same observed snapshot before admission or rewrite the intent so it does not claim checksum-backed fallback behavior that the current producer does not enforce.
   - Confidence: 82
   - Validation ownership: introduced by current patch

WROTE: artifacts/reviews/pu012-current-main-producer-proof-intent-adversarial.md
