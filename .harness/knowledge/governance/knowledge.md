# Governance Knowledge

**Last verified:** 2026-05-08
**Verification source:** automated
**Confidence:** medium
**Owner:** agent-ops

## Confirmed facts

- The north-star runtime gate integration plan requires Project Brain preflight before P2 gate edits and a Project Brain closeout decision for durable rules, decisions, gotchas, or explicit skip reasons.
- `harness brain preflight --files <changed-files> --json` maps plan and governance-rule edits to the governance domain and returns current quality criteria for structured command output and gate envelopes.
- `harness brain status --json` reports the active Project Brain scaffold as present with no missing files, no placeholder domains, and maturity level `mature`; treat this as scaffold-health evidence, not proof that every domain rule is complete.
- The north-star learning loop should stay machine-readable first (`harness learnings gate --json`, `harness review-context --json`, `harness north-star-feedback --json`) and should promote durable repeated learnings into Project Brain rules, knowledge, decisions, or explicit skip reasons during closeout.
- JSC-282 proved that eval closure requires durable proof storage as well as validator-clean report content: `.harness/evals/**.md` must be tracked or the eval must be explicitly attached to Linear before a parent issue is treated as complete.

## Patterns

- Runtime gate changes should preserve two evidence loops: machine-readable gate artifacts for CI/review and Project Brain updates for reusable agent knowledge.
- CodeRabbit learning imports are operational evidence, not long-form memory by default. Project Brain should receive the distilled durable rule or decision, not every imported CSV row.
- Harness closure reports should pair the active plan status, the eval recommendation, and git-tracked proof artifacts so future agents can reconstruct the completion decision without chat context.

## Gotchas

- `harness brain add --type rule` appends `R-auto` entries with placeholder rationale; normalize promoted governance rules to stable `R-NNN` IDs before closeout.
- Local Memory REST health only proves the daemon is reachable. End-to-end memory confidence still requires an observe/search path or the repo-local `harness local-memory-preflight` check.
- A local eval file under `.harness/evals/` is not durable evidence unless `git ls-files <eval>` shows it is tracked or the Linear issue links the artifact explicitly.

## References

- `docs/plans/2026-04-21-feat-north-star-contract-product-surface-realignment-plan.md`
- `docs/specs/2026-04-28-feat-coderabbit-learnings-operational-evidence-spec.md`
- `.harness/solutions/2026-05-08-jsc-282-durable-eval-proof.md`
- `.harness/evals/coding-harness-jsc-282-command-truth-eval.md`
- `.harness/knowledge/governance/rules.md`
- `.harness/review-log.md`
