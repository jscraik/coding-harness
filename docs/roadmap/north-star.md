---
last_validated: 2026-07-17
---

# North Star

This document is the canonical north-star contract for Coding Harness.
Other narrative surfaces should derive from this file rather than re-explain the
project from scratch.

## Table of Contents

- [Mission](#mission)
- [Primary Metric](#primary-metric)
- [Primary Bottleneck](#primary-bottleneck)
- [Autonomy Boundary](#autonomy-boundary)
- [Safety Floor](#safety-floor)
- [Portable Outcome](#portable-outcome)
- [Evaluation And Observability Model](#evaluation-and-observability-model)
- [Operating Principles](#operating-principles)
- [Non-Goals](#non-goals)
- [What This Means For Product Decisions](#what-this-means-for-product-decisions)

## Mission

Coding Harness exists to let a solo developer with limited cognitive bandwidth
orchestrate agentic software work to professional standards through compact
orientation, executable guardrails, durable memory, and evidence-based handoff.

Short form: Thin Surface. Strong Guardrails. Durable Memory. Simplicity /
Minimalism. Self Improvement. Professional Output.

Personal standards: moral courage, self-discipline, respect for others,
integrity, loyalty to self and others, and selfless commitment. These standards
shape how work is planned, implemented, reviewed, and closed out.

Expected outcome: Coding Harness becomes a portable agent operating system that
makes Codex behave like a software engineer, not merely a code generator, across
greenfield and brownfield projects with zero customer integration ceremony. The
harness is successful when a dropped-in agent can orient, act, validate, learn,
and close out professionally without the user repeatedly translating expert
judgment into one-off instructions.

PR lead time remains the primary north-star metric; the mission defines who the
system serves and how it should feel to operate.

## Primary Metric

- Primary north-star metric: `PR lead time` from open to merge.
- Primary quality constraint: improvements must not come from weakening review,
  evidence, or rollback safety.
- Supporting metrics:
  - review or rework retries per PR
  - manual interventions per agent-driven change
  - time spent blocked on merge-readiness or review coordination
  - rollback reliability when automation must be reversed

## Primary Bottleneck

The primary bottleneck is the review or rework loop.

Coding Harness should therefore optimize for:

- shrinking time between finding and acceptable fix
- reducing repeated human review comments on the same failure pattern
- reducing manual glue work between review, remediation, verification, and merge
- keeping PRs open for less time so merge conflicts and stale context are less
  likely
- making validation-lane ownership explicit so PR speed improvements reduce
  duplicate work without weakening review, evidence, or rollback safety

## Autonomy Boundary

- Low and medium-risk autonomy should be automated where evidence is
  deterministic and rollback is clear.
- High-risk changes remain human-mediated.
- Autonomy should expand only when the system demonstrates lower review cost,
  lower manual coordination cost, or better reliability than the previous mode.

## Safety Floor

The harness safety floor is:

- deterministic evidence over intuition
- strict current-head SHA discipline
- bounded auto-remediation instead of open-ended write access
- explicit rollback paths for higher-risk automation
- independent review surfaces that do not collapse back into self-approval

## Portable Outcome

Coding Harness should be installable into Jamie's greenfield and brownfield
projects without turning those projects into copies of this repo.

Portability means adapting to each repo with the smallest useful surface, not
installing every harness capability everywhere.

The product bar is zero customer integration ceremony. A user should be able to
drop agents into a workspace and expect them to diagnose the repo, bootstrap the
missing local contract, select the right validation lane, and explain any
blocked setup themselves. If the customer must manually integrate tools,
translate setup steps, or remember harness wiring before agents can work, the
harness has pushed product labor back onto the wrong person.

The portable product promise is:

- `harness init --dry-run --json` can inspect a repo, classify current harness
  maturity, propose the smallest useful install, identify conflicts, and show
  rollback before writing.
- agents can start from an unfamiliar workspace and run the diagnose or dry-run
  path without prior project-specific ceremony; missing tools, credentials, or
  permissions become named blockers with next actions rather than silent setup
  assumptions.
- `harness init` can install or upgrade a thin Codex-facing operating contract
  without overwriting local project truth, existing `AGENTS.md` guidance,
  validation scripts, CI ownership, or PR templates.
- `harness next --json` can still produce useful next-action guidance in a
  partially adopted repo by degrading unavailable integrations to `unknown`
  instead of treating them as failures.
- Live repos are portability canaries. Fixture repos are regression-proof after
  live canaries expose real upgrade and drift behavior.

Initial portability canaries:

- `~/dev/agent-skills` (brownfield eval/workout repo)
- `~/dev/diagram-cli` (brownfield CLI)
- `~/dev/design-system` (product/design repo)
- `~/dev/x-writer` (active product repo)

Brownfield installs must follow:

```text
detect -> propose -> apply minimal reversible patch -> validate -> record rollback
```

The harness must not normalize bulk scaffolding, hidden overwrites, or required
CI/check changes without a dry-run diff and rollback plan.

## Evaluation And Observability Model

The harness should adopt the useful parts of modern AI workflow platforms
without making any vendor workflow the architecture. The durable pattern is:

```text
trace real work
curate failures and edge cases
turn them into datasets or eval cases
score structural and live behavior
promote only improvements with current evidence
```

For Coding Harness, that means:

- a trace is one end-to-end harness run, PR loop, install attempt, review loop,
  or canary upgrade
- spans are named units of work such as `doctor`, `init-dry-run`,
  `runtime-card`, `pr-closeout`, `linear-gate`, `ci-state`,
  `review-context`, `validator`, `tool-call`, and `human-feedback`
- scores measure operational quality: install safety, next-action correctness,
  evidence freshness, rollback completeness, PR metadata readiness, stack
  health, and review-rework reduction
- curated datasets come from live repo canaries, CI failures, review failures,
  session collector evidence, and Project Brain solutions
- ablation runs remove prompts, tools, context, rules, or gates in controlled
  evals to prove whether a harness surface actually improves behavior or only
  adds ceremony
- distillation compresses large evidence sets such as labels, rollout records, tool
  calls, review threads, and session traces into smaller rules, fixtures,
  prompts, or gates while preserving the behavior that made the source useful
- organizational RLHF captures expert feedback from onboarding, code review,
  apprenticeship, incidents, and repeated work into durable evals, rules,
  memory, and gates so the machine improves through the same correction loops
  people use to become competent
- workflow skills should be proven with capture-the-flag style evals: plant an
  observable win condition in the UI, repository, or tool surface; run the
  skill; keep session and trace evidence; let Codex reflect on failures; commit
  targeted refinements; and rerun until the flag is captured or the blocker is
  named
- release-grade claims require trusted-live evidence, not only structural
  shape checks
- the verifier, not the model, owns completion truth; model success claims must
  be checked against trace, environment, PR, CI, or runtime evidence before
  closeout
- repeated setup, auth, environment, CI, or review blockers should become
  deterministic recovery handlers only when authority, secret handling, trace
  redaction, rollback, and retirement conditions are explicit

The portable harness rule is deliberately narrow: install the smallest surface
that helps the repo under inspection, not every capability the harness knows
how to create.

The `agent-skills` eval pattern is the reference model: structural mode is for
fast local iteration, trusted-live mode proves behavior against the real runner,
and release-ready mode requires retaining current-run evidence.

For high-level workflows, the eval must name the user-visible win condition:
login completed, attachment uploaded and chat started, access granted, review
thread resolved, or flag captured. Optimizing the skill means improving
reliability, wall-clock time, and drift tolerance against that outcome, not
polishing instructions in isolation.

## Operating Principles

- Treat code as abundant and human attention as scarce.
- Hold work to the personal standards of moral courage, self-discipline,
  respect for others, integrity, loyalty to self and others, and selfless
  commitment.
- Prefer simplicity and minimalism before adding new surface area; make the
  smallest interface that can carry strong guardrails and professional output.
- Practice systems thinking: spot recurring blockers, design ways for people or
  agents to overcome them systematically, and explain how code carries that
  leverage instead of leaving the fix as advice.
- Move repeated review feedback into durable guardrails, tests, prompts, or
  policy checks.
- Keep repo structures legible to agents by making patterns uniform and local to
  a subtree wherever possible.
- Prefer a small number of excellent guardrails and skills over a broad taxonomy
  that nobody maintains.
- Favor systems that reduce synchronous human coordination instead of adding new
  policy surface for its own sake.
- If the same failure happens twice, the repo should gain a durable guardrail.
- Prefer Codex runtime contracts when they exist, but wrap them in
  harness-stable interfaces before exposing them to repo workflows.
- Adopt Codex signals, not Codex sprawl. Stable ideas such as workspace
  identity, permission scope, trace IDs, lifecycle evidence, memory provenance,
  and diagnostics are useful only when they reduce PR lead time, review or
  rework cost, closeout ambiguity, or brownfield install risk.
- Prefer live canary evidence before broadening installer behavior, then convert
  stable canary lessons into deterministic fixtures.
- Keep observability outputs structured, small, and searchable; raw event volume
  is not useful unless it improves decisions or evals.
- Treat claim-vs-evidence verification, missing-context classification, and
  recovery-handler traces as the preferred way to turn agent failure into
  durable learning.
- Keep source research as evidence, not hot-path doctrine; promote only
  compressed invariants, fixtures, gates, or tracked exceptions.
- Encode expert leverage into agents that can produce the needed software,
  tool call, report, dashboard, or workflow just in time for the user. Do not
  treat shared dashboards, static artifacts, or one-size-fits-most workflows as
  the default product endpoint when a point-to-point agent service can deliver
  the expert outcome directly.

## Non-Goals

Coding Harness should not optimize for:

- governance surface area as a proxy for progress
- feature count without measurable throughput or reliability benefit
- manual coordination steps that recur every run or every PR
- broad autonomy expansion without evidence that the review or rework loop got
  cheaper
- docs, artifacts, or dashboards that do not reduce ambiguity, shorten
  decision-making time, or remove manual glue work
- fan-in/fan-out artifacts that preserve domain-expert scarcity as the product
  model when an agent can carry the ontology, context, and tool authority needed
  to deliver bespoke point-to-point help

## What This Means For Product Decisions

Any new feature, command, policy surface, or document should answer these
questions clearly:

1. Does this reduce PR lead time directly, or strengthen the path to lower PR
   lead time by reducing review or rework cost?
2. Does this remove repeated manual glue work rather than normalizing it?
3. Does this make acceptable output easier for agents to produce reliably?
4. Does this preserve strict evidence, SHA discipline, and rollback safety?
5. Does this improve portability across greenfield and brownfield repos without
   increasing the visible operating surface?
6. Does this identify a recurring blocker and show how code helps people or
   agents overcome it systematically?
7. Does this encode expert leverage into an agent-delivered outcome instead of
   forcing users to adapt a generic artifact to their own question?
8. Can this claim be proven through structural and trusted-live evidence?

If the answer is no, the work is either out of scope or needs a stronger
justification before it becomes part of the control plane.
