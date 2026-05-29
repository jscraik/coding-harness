# Adversarial Intent Re-Review — PU-036 SPG-010 ReplayPacket

status: completed
scope: amended pre-implementation intent review only
intent_path: .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json

## Findings (severity-ranked)

No material blocker remains in the amended intent.

### Prior Finding Closure Verification
1. Per-ref digest/integrity gap: closed.
- Evidence:
  - Replay-critical refs are now required to be content-bound with sha256 digests and semantic verification for repo refs requiring filesystem existence ([.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:41](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:41), [.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:61](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:61)).
- Validation ownership: introduced-by-current-patch

2. hookExecutionIdentity spoofing gap: closed.
- Evidence:
  - Hook provenance now requires hookExecutionIdentity with hook-file digest and resolved-command digest, and acceptance criteria make those fields mandatory ([.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:43](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:43), [.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:63](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:63)).
- Validation ownership: introduced-by-current-patch

3. stale/head freshness gate gap: closed.
- Evidence:
  - Intent now requires observedHeadSha/currentHeadSha/ttlSeconds/freshnessVerdict and orientation-only gating, with stale packets constrained to audit-trail only ([.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:47](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:47), [.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:48](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:48), [.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:64](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:64), [.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:65](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:65)).
- Validation ownership: introduced-by-current-patch

4. agent-discoverable command-surface gap: closed.
- Evidence:
  - Design constraint and acceptance criterion now require machine-readable command-surface proof via commands --json --all plus manifest coverage ([.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:51](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:51), [.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:69](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:69), [.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:78](/Users/jamiecraik/dev/coding-harness/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json:78)).
- Validation ownership: introduced-by-current-patch

## Residual Risks
- hookExecutionIdentity proves structural binding to declared hook/command refs but does not cryptographically attest process-level execution origin; authenticity remains bounded by producer trust and filesystem hash checks.
- Freshness gating is intent-complete, but implementation must ensure stale classification cannot silently degrade to orientation through consumer-side defaults.

## Testing Gaps
- No new intent-level blocker identified; implementation review should confirm dedicated negative fixtures for forged hookExecutionIdentity correlation IDs and for stale-to-orientation downgrade attempts.

## Accountability Receipt
- status: completed
- manifest_path: artifacts/agent-runs/adversarial-reviewer-019e6ef8-d5fa-7341-a864-f3b2358ca9b3/manifest.json
- artifact_paths:
  - artifacts/reviews/pu-036-spg-010-replay-packet-intent-adversarial-rerun.md
- findings:
  - useful_findings: 0 material blockers; 4 prior blockers verified as closed
  - avoided_false_positive: no new speculative blockers raised where amended intent already enforced the constraint
  - evidence_quality: high (line-precise closure evidence for each prior finding)
  - followed_scope: intent-only rerun, no implementation review, no source edits
  - reusable_learning: closure reruns should map one-to-one prior findings to explicit amended line evidence
  - coordinator_score: strong (clear rerun scope and required artifact path)
- failures_or_blockers:
  - none
- improvement_opportunities:
  - During implementation, add explicit fixture asserting forged correlation IDs do not bypass provenance checks.
- strengths:
  - Amendment encoded all previously reported adversarial gaps directly into constraints and acceptance criteria with machine-testable validation hooks.
- validation_evidence:
  - nl -ba .harness/intent/codex-runtime-evidence-verifier-cockpit-pu-036-spg-010-replay-packet-intent.json | sed -n "1,260p"
  - nl -ba artifacts/reviews/pu-036-spg-010-replay-packet-intent-adversarial.md | sed -n "1,260p"
- next_action:
  - Proceed to implementation with this intent baseline, then run adversarial implementation review focused on authenticity/freshness downgrade abuse paths.

WROTE: artifacts/reviews/pu-036-spg-010-replay-packet-intent-adversarial-rerun.md
