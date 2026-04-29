# Governance Knowledge

**Last verified:** 2026-04-27
**Verification source:** manual
**Confidence:** medium
**Owner:** agent-ops

## Confirmed facts

- The north-star runtime gate integration plan requires Project Brain preflight before P2 gate edits and a Project Brain closeout decision for durable rules, decisions, gotchas, or explicit skip reasons.
- `harness brain preflight --files <changed-files> --json` maps plan and governance-rule edits to the governance domain and returns current quality criteria for structured command output and gate envelopes.
- `harness brain status --json` currently validates the Project Brain scaffold with no missing files, while placeholder warnings remain in unrelated `api`, `auth`, and `ui` domain files.

## Patterns

- Runtime gate changes should preserve two evidence loops: machine-readable gate artifacts for CI/review and Project Brain updates for reusable agent knowledge.

## Gotchas

- `harness brain add --type rule` appends `R-auto` entries with placeholder rationale; normalize promoted governance rules to stable `R-NNN` IDs before closeout.

## References

- `docs/plans/2026-04-21-feat-north-star-contract-product-surface-realignment-plan.md`
- `.harness/knowledge/governance/rules.md`
- `.harness/review-log.md`
