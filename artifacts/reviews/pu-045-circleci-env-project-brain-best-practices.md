# PU-045 Best-Practices Review (CircleCI env Project Brain rule)

## Scope reviewed
- /private/tmp/coding-harness-jsc363-linear-stack-refresh-0601/.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-045-circleci-env-project-brain-rule-intent.json
- /private/tmp/coding-harness-jsc363-linear-stack-refresh-0601/.harness/knowledge/ci/rules.md
- /private/tmp/coding-harness-jsc363-linear-stack-refresh-0601/.harness/knowledge/INDEX.md
- /private/tmp/coding-harness-jsc363-linear-stack-refresh-0601/.harness/active-artifacts.md
- /private/tmp/coding-harness-jsc363-linear-stack-refresh-0601/docs/goals/codex-runtime-evidence-verifier-cockpit/state.yaml
- /private/tmp/coding-harness-jsc363-linear-stack-refresh-0601/docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl

## Findings (severity-ranked)

### 1) Medium - PU-045 promotion appears in state/knowledge but is not yet anchored by an append-only PU-045 receipt row in this snapshot
- Severity: medium
- Evidence: command evidence from `rg -n "\"id\":\"R198\"|PU-045|R-001|circleci-env-project-brain" .../receipts.jsonl .../state.yaml .../active-artifacts.md .../rules.md` returned PU-045 references in `state.yaml`, `active-artifacts.md`, `rules.md`, and intent JSON, but no PU-045-specific receipt id in `receipts.jsonl`.
- Impacted behavior: route-truth durability is weaker because the ledger lane is the canonical append-only proof surface for what was done and validated in a slice.
- Remediation: append a PU-045 receipt entry (next receipt id) that records promoted rule artifact paths, validation commands run, explicit lane separations, and whether `~/.codex/.env` access was actually needed (`used_this_slice: no` if not needed).
- Fixability now: fixable now in-repo.
- Confidence: high
- Validation ownership: coordinator/worker in this branch.

## No additional findings
- The durable primitive selection is appropriate and minimal: Project Brain CI rule promotion is the smallest mechanism that converts repeated steering into reusable operating behavior.
- Secret-handling guard is explicit and correct (`never print or persist secret values`) in both intent and CI rule.
- Lane separation is explicitly preserved across active artifacts and goal state (no false claims of merge, tracker alignment, Judge/PM readiness, runtime producer emission, or goal completion).

## Commit readiness
- Can this slice be committed after remediation: yes.
- Condition: add and validate the PU-045 append-only receipt entry so the rule promotion has full ledger traceability parity with existing goal-governor slices.

WROTE: artifacts/reviews/pu-045-circleci-env-project-brain-best-practices.md
