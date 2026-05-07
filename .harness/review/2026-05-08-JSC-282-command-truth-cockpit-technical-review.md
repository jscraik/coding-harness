---
schema_version: 1
title: JSC-282 Command Truth Cockpit Technical Review
type: technical-review
status: complete
date: 2026-05-08
review_target: .harness/plan/2026-05-08-architecture-JSC-282-command-truth-cockpit-plan.md
repo: coding-harness
linear_issue: JSC-282
---

# JSC-282 Command Truth Cockpit Technical Review

## Table Of Contents

- [Findings](#findings)
- [Review Verdict](#review-verdict)
- [Evidence Checked](#evidence-checked)
- [Plan Quality Assessment](#plan-quality-assessment)
- [Execution Risks](#execution-risks)
- [Recommended Corrections](#recommended-corrections)
- [Implementation Follow-Up](#implementation-follow-up)
- [Validation Evidence](#validation-evidence)

## Findings

### P1 - Legacy source docs still contain stale current-state baselines

Evidence:

- `docs/specs/2026-05-07-feat-ruthless-agent-native-compression-recovery-spec.md`
  still records `commands --json --for-agent` as `commandCount: 9` and default
  help as broad.
- Live source now returns `commandCount: 1` for `commands --json --for-agent`.
- Live help starts with `harness next --json` and lists only `next` in focused
  help.

Impact:

Future agents can read the May 7 spec as current truth and incorrectly reopen
already-solved command-surface work. This is a cognition drift risk, not a
runtime regression.

Required response:

Keep the May 7 numbers only as historical baseline or update the source docs to
point at the JSC-282 plan/eval as current truth.

### P2 - Packaged skill guidance over-compresses command truth into help output

Evidence:

- `.agents/skills/coding-harness/SKILL.md` says to treat `harness --help` as the
  runtime command truth.
- The current runtime intentionally makes `harness --help` a focused
  first-contact surface, while full capability truth lives behind
  `harness commands --json` and expert help behind `--all-commands`.

Impact:

JSC-283 packaged behavior proof could validate the wrong thing if it treats
focused help as complete command truth. The skill should teach the split:
focused help is first-contact truth; `commands --json` is catalog truth.

Required response:

Update the skill and contract reference before JSC-283 starts.

### P2 - The plan must not let command-count proof replace full compatibility proof

Evidence:

- `src/lib/cli/command-registry.ts` returns the full catalog when `--for-agent`
  is absent or when `--all` / `--plumbing` is supplied.
- The plan includes both compressed agent-catalog probes and full-catalog
  compatibility probes.

Impact:

A narrow assertion that only checks `commandCount: 1` would miss regressions
where expert discovery disappears. The plan correctly adds compatibility probes;
implementation must keep them.

Required response:

Do not close JSC-282 unless `commands --json`, `commands --json --for-agent
--all`, and `--help --all-commands` still work.

### P3 - The plan is intentionally proof-heavy; avoid turning it into more design

Evidence:

- Live runtime already exposes `next` only in the agent catalog.
- `FIRST_CONTACT_COMMAND_NAMES` is already the code-level authority.
- Tests already assert the one-rail catalog and focused help behavior.

Impact:

The next execution pass should not create new abstractions or command policy
tables unless a test demonstrates that `FIRST_CONTACT_COMMAND_NAMES` is too
weak. Extra architecture here would be false sophistication.

Required response:

Prefer baseline capture, stale-doc cleanup, packaged skill wording, and eval
closure over new command-routing structures.

## Review Verdict

The deepened plan is technically coherent and scoped correctly.

It recognizes that the runtime compression work is already mostly done and
shifts JSC-282 toward proof, source-truth reconciliation, and packaged skill
handoff. That is the right move. The main risk is stale architecture prose
teaching future agents an old baseline; the plan now names that risk directly
and makes it a closure blocker.

Do not expand this issue into a broader JSC-248 cockpit rewrite. JSC-282 should
close when command truth is consistent and eval-backed.

## Evidence Checked

| Evidence | Result |
| --- | --- |
| `pnpm exec tsx src/cli.ts commands --json --for-agent` | Runtime emits `commandCount: 1`, command `next`. |
| `pnpm exec tsx src/cli.ts --help` | Runtime starts with `harness next --json` and shows only `next` in focused help. |
| `src/lib/cli/registry/command-capabilities.ts` | `FIRST_CONTACT_COMMAND_NAMES` contains only `next`. |
| `src/lib/cli/command-registry.ts` | Agent catalog is filtered unless full catalog is explicitly requested. |
| `src/lib/cli/command-registry.test.ts` | Tests assert `AGENT_COMMAND_RAIL_NAMES = ["next"]` and focused help rows equal `["next"]`. |
| `docs/specs/2026-05-07-feat-ruthless-agent-native-compression-recovery-spec.md` | Baseline text is stale relative to live runtime. |
| `.agents/skills/coding-harness/SKILL.md` | Skill command-truth wording is too broad for current focused help behavior. |

## Plan Quality Assessment

Strengths:

- The plan separates first-contact truth from full catalog truth.
- It treats old specs as evidence, not automatically current runtime truth.
- It keeps JSC-283 blocked until packaged skill expectations are deterministic.
- It avoids adding new cockpit commands or expanding the command registry design.
- It makes compatibility proof explicit.

Weaknesses:

- It depends on follow-up doc and skill edits that are not yet performed.
- It assumes the active branch's source runtime is the target truth; packaged
  build proof is deferred to JSC-283.
- It still needs an eval artifact before Linear closure.

## Execution Risks

| Risk | Severity | Likelihood | Recommended control |
| --- | --- | --- | --- |
| Stale May 7 spec text reopens solved command work | High | Medium | Mark stale baselines historical or point to this plan/eval. |
| Packaged skill validates focused help as full catalog | High | Medium | Update skill wording before JSC-283. |
| Expert discovery regresses during compression | Medium | Low | Require full catalog and `--all-commands` probes. |
| New first-contact commands slip in through metadata defaults | Medium | Low | Keep tests asserting `["next"]`. |
| Plan becomes a new architecture program | Medium | Medium | Limit JSC-282 to proof and truth reconciliation. |

## Recommended Corrections

1. Add a short "current state after JSC-282" note to the May 7 spec and May 2
   plan, or move stale baseline rows under an explicitly historical heading.
2. Update `.agents/skills/coding-harness/SKILL.md` and its contract reference
   to distinguish focused help from full catalog truth.
3. Add `.harness/evals/coding-harness-jsc-282-command-truth-eval.md` with
   runtime probes and exact validation outcomes.
4. Run focused registry/CLI tests and docs lint before unblocking JSC-283.

## Implementation Follow-Up

Implemented on 2026-05-08:

- P1 is addressed by marking the May 7 spec and May 2 plan command-count
  evidence as historical baseline evidence and pointing current JSC-282 command
  truth at the `.harness/plan` artifact.
- P2 is addressed by updating `.agents/skills/coding-harness/SKILL.md` and
  `.agents/skills/coding-harness/references/contract.yaml` to distinguish
  `harness next --json`, focused `harness --help`, full
  `harness commands --json`, and `harness commands --json --for-agent`.

Remaining before JSC-282 closure:

- P2 compatibility proof remains required: full catalog probes and expert help
  must still pass in the final eval.
- The JSC-282 eval artifact is still required before unblocking JSC-283.

## Validation Evidence

This technical review was based on live source inspection and these probes:

```bash
pnpm exec tsx src/cli.ts commands --json --for-agent
pnpm exec tsx src/cli.ts --help
```

Artifact validation run after saving the plan and review:

```bash
pnpm docs:lint .harness/plan/2026-05-08-architecture-JSC-282-command-truth-cockpit-plan.md .harness/review/2026-05-08-JSC-282-command-truth-cockpit-technical-review.md
pnpm exec harness plan-gate --plans .harness/plan --type architecture --require-plan-id --require-origin --strict --json
pnpm exec vitest run src/lib/cli/command-registry.test.ts src/cli.test.ts
```

Outcomes:

- `docs:lint` passed with 0 markdown errors.
- `plan-gate` passed with 0 findings.
- Focused Vitest passed: 2 files, 208 tests passed, 1 skipped.
- The Vitest run printed existing `drift-gate` warning output about
  README-documented commands that are not dispatched by `src/cli.ts`; the
  command still exited 0. Treat this as residual command-doc drift evidence,
  not as a failure of the plan/review artifacts.
