# PU-047 CNF-001 Source Capability Proof

## Classification

\`available_producer_input\`

## Evidence

The Coding Harness-owned runtime evidence producer already accepts explicit
Codex identity facts before packet admission. The relevant boundary is
\`CodexRuntimeEvidenceProducerIdentityInput\` in
\`src/lib/runtime/codex-runtime-evidence-producer.ts\`, which feeds
\`CodexRuntimeIdentity\` in \`src/lib/runtime/codex-runtime-evidence-types.ts\`.

This means CNF-001 can add a nullable \`clientUserMessageId\` to that explicit
producer-input boundary and carry it into normalized runtime evidence.

## Non-Claims

This proof does not claim that the active Codex Desktop runtime exposes a live
client user-message id to Coding Harness today. It does not authorize
synthesizing a client user-message id from \`turnId\`, \`traceId\`, timestamps, fixture
names, PR numbers, or artifact paths.

\`clientUserMessageId\` remains orientation and steering-queue audit evidence only.
It must not support delivery-truth, review-state, external-state, root-hygiene,
merge-readiness, Judge/PM readiness, or goal-completion claims.

## Contract Implication

\`clientUserMessageId\` must remain nullable at the runtime evidence boundary.
When unavailable, the producer must emit null rather than an adjacent-field
substitute.

Steering queue validation may require an applied item to record the actual
applied client user-message id because that field is operator-action evidence,
not live runtime discovery.

## Validation Requirement

Focused tests for PU-047 must prove that producer-provided \`clientUserMessageId\`
is carried into runtime evidence, omitted \`clientUserMessageId\` remains null,
stale evaluation rejects mismatched current and expected client user-message
ids, and applied steering items cannot omit or mismatch \`appliedClientUserMessageId\`
when an expectation exists.
