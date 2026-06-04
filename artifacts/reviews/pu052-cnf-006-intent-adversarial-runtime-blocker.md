# PU-052 CNF-006 Intent Adversarial Review Runtime Blocker

## Status

STATUS: blocked_runtime

## Blocker

The adversarial intent reviewer completed and then completed the required artifact-recovery retry, but did not persist artifacts/reviews/pu052-cnf-006-intent-adversarial.md. Mailbox completion is not accepted as review evidence under the repo swarm contract.

## Evidence

- Intent artifact requires pre-implementation review or runtime blocker evidence: docs/goals/codex-runtime-evidence-verifier-cockpit/notes/PU-052-cnf-006-steering-application-receipt-intent.md:82
- Intent artifact states the exact blocker fallback: docs/goals/codex-runtime-evidence-verifier-cockpit/notes/PU-052-cnf-006-steering-application-receipt-intent.md:86
- Required contract scope is narrow and implementation may proceed with this review coverage gap visible: docs/goals/codex-runtime-evidence-verifier-cockpit/notes/PU-052-cnf-006-steering-application-receipt-intent.md:22

## Fallback Review Notes

Proceed only if implementation keeps the following adversarial requirements explicit:

- Applied receipts must reject expected/current turn, client user-message, and head mismatches.
- Applied receipts must require a runtime-card update reference on the same head.
- Expired, superseded, rejected, stale, or already-applied steering must not be recorded as applied.
- The receipt must remain pointer-only and must reject raw prompts, transcripts, command output, secrets, tokens, and credentials.
- The receipt must not authorize commands, delivery truth, Judge/PM readiness, PR/CI truth, or merge readiness.

## Validation Ownership

- introduced by current patch: reviewer artifact coverage gap
- environment or tooling failure: subagent artifact persistence failed after retry
- coordinator next step: implement with explicit negative tests and retry post-implementation reviewers

WROTE: artifacts/reviews/pu052-cnf-006-intent-adversarial-runtime-blocker.md
