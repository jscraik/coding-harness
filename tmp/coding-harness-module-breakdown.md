# Coding Harness — recommended module breakdown

## Bottom line

Do **not** turn this into many published npm packages yet.

It is already one coherent system, and the architecture rules are good enough to
support a domain split without forcing multi-package release overhead.

Recommended approach:
1. keep **one repo**,
2. keep **one public CLI package**,
3. split the codebase into **6 internal domains**,
4. only publish subpackages later if one becomes independently valuable.

---

## Recommended domains

### 1. `core/` — contract + policy kernel
Keep together:
- `src/lib/contract/*`
- `src/lib/policy/*`
- `src/lib/preflight/*`
- `src/lib/review-gate/*`
- `src/lib/plan-gate/*`
- `src/lib/evidence/*`
- `src/lib/governance/*`
- `src/lib/input/*`
- `src/lib/result/*`
- `src/lib/output/*`

Own these commands:
- `contract`
- `preflight-gate`
- `policy-gate`
- `docs-gate`
- `plan-gate`
- `review-gate`
- `risk-tier`
- `blast-radius`
- `diff-budget`
- `evidence-verify`
- `observability-gate`
- `memory-gate`
- `prompt-gate`
- `brainstorm-gate`
- `pr-template-gate`
- `health`
- `doctor`

Why:
This is the actual harness kernel.

---

### 2. `bootstrap/` — repo substrate
Keep together:
- `src/lib/init/*`
- `src/lib/project-type/*`
- `src/presets/*`
- `src/templates/*`

Own these commands:
- `init`
- `upgrade`
- `preset`

Why:
This is the repo compiler layer. It should stay separate from runtime policy.

---

### 3. `workflow/` — workflow authority
Keep together:
- `src/lib/workflow-contract/*`
- `src/lib/workflow/*`

Own these commands:
- `workflow:generate`
- `symphony-check`

Likely colocate:
- `linear-gate`

Why:
This is the strongest domain after core/bootstrap. It has its own parser,
checker, registry, normalizer, scorecards, and tracking model.

---

### 4. `rollout/` — rollout and autonomy control
Keep together:
- `src/lib/pilot-evaluation/*`
- `src/lib/ci/*`

Own these commands:
- `ci-migrate`
- `pilot-evaluate`
- `pilot-rollback`
- `branch-protect`
- `check-authz`
- `check-environment`
- `automation-run`

Why:
These commands govern change rollout, approvals, parity, and autonomy mode.
This is a clear upper control layer.

---

### 5. `integrations/` — remote system adapters
Keep together:
- `src/lib/github/*`
- `src/lib/linear/*`

Own these commands:
- `linear`
- `request-greptile-review`
- `verify-greptile`

Why:
Adapters should be downstream of the core, not mixed into it.

---

### 6. `adjacent/` — optional surfaces
Keep together:
- `src/lib/context-compound/*`
- `src/lib/gardener/*`
- `src/lib/remediation/*`
- `src/lib/replay/*`
- `src/lib/simulate/*`
- `src/lib/org/*`
- `src/lib/silent-error/*`
- `src/lib/gap-case/*`

Own these commands:
- `context`
- `search`
- `index-context`
- `context-health`
- `org-audit`
- `tooling-audit`
- `gardener`
- `remediate`
- `replay`
- `simulate`
- `gap-case`
- `ui:*`
- `silent-error`

Why:
Useful, but not part of the core harness identity.

---

## What to peel apart first

### First target: `src/commands/ci-migrate.ts`
Current size is too large.

Split into:
- `rollout/ci-migrate/args.ts`
- `rollout/ci-migrate/snapshot.ts`
- `rollout/ci-migrate/verify.ts`
- `rollout/ci-migrate/proof-pack.ts`
- `rollout/ci-migrate/merge-queue.ts`
- `rollout/ci-migrate/break-glass.ts`
- `rollout/ci-migrate/harvest.ts`
- `rollout/ci-migrate/promote.ts`
- `rollout/ci-migrate/command.ts`

### Second target: `src/lib/init/scaffold.ts`
Split generated surfaces by concern:
- `bootstrap/scaffold/contracts.ts`
- `bootstrap/scaffold/workflow.ts`
- `bootstrap/scaffold/ci.ts`
- `bootstrap/scaffold/scripts.ts`
- `bootstrap/scaffold/docs.ts`
- `bootstrap/scaffold/templates.ts`

### Third target: `src/cli.ts`
Make the top-level CLI thin:
- parse argv
- dispatch command
- handle global errors
- print top-level help

Push command help/specs into domain-local registries.

---

## What not to do yet

Do not:
- publish 6 npm packages now,
- split tests into separate repos,
- move docs/examples out before the code boundaries are stable,
- over-normalize small utility modules.

You are a solo dev. Release burden matters.

---

## Recommended end-state tree

```text
src/
  cli/
    main.ts
    registry.ts
  domains/
    core/
    bootstrap/
    workflow/
    rollout/
    integrations/
    adjacent/
  shared/
    fs/
    errors/
    io/
    types/
```

Public command groups:
- `harness init|upgrade|preset`
- `harness contract|policy|review|docs|plan|health`
- `harness workflow|linear`
- `harness rollout`
- `harness context`
- `harness ops`

---

## The simplest practical move

If doing only one structural pass:

1. make `src/cli.ts` thin,
2. carve `ci-migrate` into a rollout domain,
3. move `init` into a bootstrap domain,
4. rename remaining lib folders around those 6 domains,
5. leave publishing exactly as it is.

That gets most of the clarity without creating packaging overhead.
