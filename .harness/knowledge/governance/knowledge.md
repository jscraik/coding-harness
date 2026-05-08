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
- JSC-283 proved that packaged skill closure requires package-form behavior proof. Source-only validation is insufficient when the claim covers downstream install behavior, packaged command references, update ownership, or release-gate readiness.
- `.codex/environments/environment.toml` generation is intentional repository behavior because Codex local environment actions are a first-class OpenAI Codex app surface. Updates must remain sentinel-owned so customized downstream files are skipped rather than overwritten.
- Local packaged-skill closure and release-gate admission are different decisions: local closure can pass with clean package-form proof and exact credential blockers, while release-gate promotion requires a committed reusable runner and clean committed-candidate rerun.
- JSC-288 proved that governance trust proof must use current executable memory evidence, not bootstrap placeholder shape. For this repo, PR closeout memory proof should exercise Project Brain and learning-loop surfaces through `pnpm exec tsx src/cli.ts tooling-audit --path . --json`.
- JSC-288 also proved that HE eval prose is not closure proof until it passes the canonical `he-eval-report` validator and the traceable spec/plan/eval chain passes identity, frontmatter, and Linear traceability lints.

## Patterns

- Runtime gate changes should preserve two evidence loops: machine-readable gate artifacts for CI/review and Project Brain updates for reusable agent knowledge.
- CodeRabbit learning imports are operational evidence, not long-form memory by default. Project Brain should receive the distilled durable rule or decision, not every imported CSV row.
- Harness closure reports should pair the active plan status, the eval recommendation, and git-tracked proof artifacts so future agents can reconstruct the completion decision without chat context.
- Packaged skill proof should exercise the package artifact or extracted packaged skill, not just the source tree. Validator paths should be targetable so clean downstream fixtures can prove the same behavior future users receive.
- Governance trust repairs should replace stale proof paths with executable source-truth commands and update all spec, plan, refactor, and Linear-plan backlinks when an artifact moves to its canonical slug.

## Gotchas

- `harness brain add --type rule` appends `R-auto` entries with placeholder rationale; normalize promoted governance rules to stable `R-NNN` IDs before closeout.
- Local Memory REST health only proves the daemon is reachable. End-to-end memory confidence still requires an observe/search path or the repo-local `harness local-memory-preflight` check.
- A local eval file under `.harness/evals/` is not durable evidence unless `git ls-files <eval>` shows it is tracked or the Linear issue links the artifact explicitly.
- Do not treat credential-blocked remote package checks as pass/fail ambiguity. Record the missing credential or service input exactly, and keep that blocker separate from local package-form closure.
- Do not treat `memory.json` shape as proof of operational memory. It can exist as bootstrap compatibility, but current governance proof must point at Project Brain, `.harness/memory/LEARNINGS.md`, and learning-loop evidence.
- Do not assume a useful eval artifact is closeable. Run the canonical `he-eval-report` validator before closure, especially after eval contract changes.

## References

- `docs/plans/2026-04-21-feat-north-star-contract-product-surface-realignment-plan.md`
- `docs/specs/2026-04-28-feat-coderabbit-learnings-operational-evidence-spec.md`
- `.harness/solutions/2026-05-08-jsc-282-durable-eval-proof.md`
- `.harness/solutions/2026-05-08-jsc-283-packaged-skill-behavior-proof.md`
- `.harness/solutions/2026-05-08-jsc-288-governance-trust-repair-solution.md`
- `.harness/evals/coding-harness-jsc-282-command-truth-eval.md`
- `.harness/evals/coding-harness-jsc-283-packaged-skill-behavior-assurance-eval.md`
- `.harness/evals/2026-05-08-JSC-288-coding-harness-jsc-288-governance-trust-repair-eval.md`
- `.harness/knowledge/governance/rules.md`
- `.harness/review-log.md`
