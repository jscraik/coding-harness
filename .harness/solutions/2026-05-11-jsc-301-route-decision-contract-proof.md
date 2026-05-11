---
schema_version: 1
artifact_id: jsc-301-route-decision-contract-proof
artifact_type: he-compound-solution
canonical_slug: jsc-301-route-decision-contract
title: JSC-301 RouteDecision Contract Proof
harness_stage: he-compound
date: 2026-05-11
status: locally_solved_closure_blocked
traceability_required: true
origin: .harness/evals/2026-05-11-JSC-301-route-decision-contract-coding-harness-eval.md
linear_issue: JSC-301
linear_parent: JSC-300
domain: governance
owner: agent-ops
freshness_review: 2026-06-11
project_brain_status: explicitly_deferred
project_brain_evidence:
  source: ".harness/solutions/2026-05-11-jsc-301-route-decision-contract-proof.md"
  target: ".harness/knowledge/governance/knowledge.md"
  reason: "Local implementation proof is validated, but closure remains blocked until commit or PR evidence exists."
---

# JSC-301 RouteDecision Contract Proof

## Table Of Contents

- [Problem](#problem)
- [Resolution](#resolution)
- [Evidence](#evidence)
- [Reusable Rule](#reusable-rule)
- [Validation](#validation)
- [Prevention](#prevention)
- [Project Brain / Routing](#project-brain--routing)
- [Maintenance](#maintenance)
- [Related Artifacts](#related-artifacts)

## Problem

Harness Engineering lifecycle routing had been proven in planning and eval
artifacts, but `coding-harness` did not yet have a typed internal contract for
carrying lifecycle route intent into cockpit decision metadata. Without a
bounded contract slice, future adapter work could blur three decisions that must
remain separate:

1. lifecycle route classification;
2. cockpit command recommendation;
3. executable public CLI behavior.

That ambiguity is a governance and agent-execution risk. It can make a future
agent treat route metadata as command authority or claim public `harness route`
behavior before the adapter and CLI slices exist.

## Resolution

JSC-301 introduced a contract-only `RouteDecision/v1` implementation and kept
runtime behavior unchanged:

- `src/lib/decision/route-decision.ts` defines the route schema version, route
  ids, blocker boundaries, validator, type guard, and compatibility mapper.
- `src/lib/decision/route-decision.test.ts` covers route ids, blocker
  boundaries, malformed inputs, cross-field invariants, metadata collision,
  unsafe shell-like text, and `HarnessDecision` compatibility.
- `targetCommand` remains advisory metadata under `meta.lifecycleRoute`; it does
  not become executable command authority.
- JSC-302, JSC-303, JSC-304, and JSC-311 remain downstream or future work rather
  than being pulled into JSC-301.

The local implementation proof is solved. Delivery closure is still blocked
because no commit SHA, PR URL, CI result, or live Linear closure evidence exists.

## Evidence

- Spec:
  `.harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md`
- Plan:
  `.harness/plan/2026-05-11-JSC-301-route-decision-contract-plan.md`
- Eval:
  `.harness/evals/2026-05-11-JSC-301-route-decision-contract-coding-harness-eval.md`
- Implementation gate artifact:
  `.harness/review/2026-05-11-JSC-301-route-decision-implementation-gates.md`
- Source:
  `src/lib/decision/route-decision.ts`
- Tests:
  `src/lib/decision/route-decision.test.ts`
- Linear plan:
  `.harness/linear/coding-harness-linear-plan.md`

## Reusable Rule

Lifecycle route work must keep contract, adapter, and executable CLI behavior as
separate proof boundaries:

1. A contract slice may add typed schema, validation, and metadata mapping.
2. An adapter slice must prove how lifecycle route metadata is consumed.
3. A public CLI slice must prove command registration, JSON output, docs, and
   regression behavior.
4. No slice may treat `targetCommand` or lifecycle route metadata as executable
   authority unless that behavior is explicitly specified, reviewed, and tested.
5. Linear closure needs delivery proof in addition to local validation proof.

## Validation

Local validation evidence recorded for JSC-301:

- `pnpm test src/lib/decision/route-decision.test.ts src/lib/decision/harness-decision.test.ts src/commands/next.test.ts`
  passed, 3 files, 84 tests.
- `pnpm typecheck` passed.
- `pnpm markdownlint .harness/review/2026-05-11-JSC-301-route-decision-implementation-gates.md .harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md .harness/plan/2026-05-11-JSC-301-route-decision-contract-plan.md .harness/linear/coding-harness-linear-plan.md`
  passed, 0 errors.
- `bash scripts/validate-codestyle.sh --fast` passed, including related
  RouteDecision tests.
- `python3 /Users/jamiecraik/dev/agent-skills/Plugins/harness-engineering/skills/he-eval-report/scripts/validate_eval_report.py .harness/evals/2026-05-11-JSC-301-route-decision-contract-coding-harness-eval.md --json`
  passed.
- `python3 /Users/jamiecraik/dev/agent-skills/Infrastructure/scripts/validation-and-linting/he_artifact_identity_lint.py .harness/evals/2026-05-11-JSC-301-route-decision-contract-coding-harness-eval.md`
  passed.
- `python3 /Users/jamiecraik/dev/agent-skills/Infrastructure/scripts/validation-and-linting/he_frontmatter_safety_lint.py .harness/evals/2026-05-11-JSC-301-route-decision-contract-coding-harness-eval.md`
  passed.
- `pnpm markdownlint .harness/evals/2026-05-11-JSC-301-route-decision-contract-coding-harness-eval.md`
  passed, 0 errors.

Blocked closure evidence:

- `git commit` is blocked by an unrelated unstaged
  `.codex/environments/environment.toml` hook/stash failure with
  `error: unable to unlink old .codex/environments/environment.toml: Operation not permitted`.

## Prevention

Future lifecycle routing work should start from the JSC-301 contract rather than
from chat summaries or broad prompt interpretation. Before closing a route-related
slice, future agents should check:

- whether the work is contract-only, adapter work, or public CLI behavior;
- whether `HarnessDecision/v1` remains cockpit command authority;
- whether lifecycle metadata is still nested under `meta.lifecycleRoute`;
- whether validation includes focused route tests plus existing `HarnessDecision`
  and `harness next` regressions when compatibility is claimed;
- whether closeout has commit, PR, CI, or approved Linear evidence.

## Project Brain / Routing

Status: explicitly deferred.

Reason:

The implementation lesson is stable enough to store as a solution artifact, but
Project Brain promotion should wait until JSC-301 has delivery proof. Promoting a
new governance rule before commit or PR evidence would overstate closure.

Candidate Project Brain target after delivery proof exists:

- `.harness/knowledge/governance/knowledge.md`
- `.harness/knowledge/governance/rules.md`

## Maintenance

Owner: agent-ops.

Refresh this solution when JSC-301 receives commit or PR evidence, or when the
JSC-302/JSC-304 adapter/public-route slices change the contract boundary. If
public `harness route --json` behavior ships, this artifact must remain a
contract-slice lesson and should link to the newer adapter or CLI solution
instead of being rewritten as runtime proof.

## Related Artifacts

- `.harness/solutions/2026-05-08-jsc-282-durable-eval-proof.md`
- `.harness/solutions/2026-05-08-jsc-288-governance-trust-repair-solution.md`
- `.harness/evals/2026-05-11-JSC-301-route-decision-contract-coding-harness-eval.md`
- `.harness/review/2026-05-11-JSC-301-route-decision-implementation-gates.md`
