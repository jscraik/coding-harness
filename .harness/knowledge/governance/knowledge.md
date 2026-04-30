# Governance Knowledge

**Last verified:** 2026-04-30
**Verification source:** automated
**Confidence:** medium
**Owner:** agent-ops

## Confirmed facts

- The north-star runtime gate integration plan requires Project Brain preflight before P2 gate edits and a Project Brain closeout decision for durable rules, decisions, gotchas, or explicit skip reasons.
- `harness brain preflight --files <changed-files> --json` maps plan and governance-rule edits to the governance domain and returns current quality criteria for structured command output and gate envelopes.
- `harness brain status --json` validates the active Project Brain scaffold with no missing files, no placeholder domains, and maturity level `mature`.
- The north-star learning loop should stay machine-readable first (`harness learnings gate`, `harness review-context`, `harness north-star-feedback`) and should promote durable repeated learnings into Project Brain rules, knowledge, decisions, or explicit skip reasons during closeout.

## Patterns

- Runtime gate changes should preserve two evidence loops: machine-readable gate artifacts for CI/review and Project Brain updates for reusable agent knowledge.
- CodeRabbit learning imports are operational evidence, not long-form memory by default. Project Brain should receive the distilled durable rule or decision, not every imported CSV row.

## Gotchas

- `harness brain add --type rule` appends `R-auto` entries with placeholder rationale; normalize promoted governance rules to stable `R-NNN` IDs before closeout.
- Local Memory REST health only proves the daemon is reachable. End-to-end memory confidence still requires an observe/search path or the repo-local `harness local-memory-preflight` check.

## References

- `docs/plans/2026-04-21-feat-north-star-contract-product-surface-realignment-plan.md`
- `docs/specs/2026-04-28-feat-coderabbit-learnings-operational-evidence-spec.md`
- `.harness/knowledge/governance/rules.md`
- `.harness/review-log.md`
