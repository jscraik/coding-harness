---
title: "Ideation: Codex-first harness drift and north-star realignment"
date: "2026-04-20"
status: "proposed"
route: "fresh"
authors:
  - "Codex"
last_validated: 2026-04-20
---

# Ideation: Codex-first harness drift and north-star realignment

## Table of Contents
- [Codebase Context](#codebase-context)
- [Sweep Method](#sweep-method)
- [Drift Map](#drift-map)
- [Ranked Ideas](#ranked-ideas)
- [Rejection Summary](#rejection-summary)
- [Session Log](#session-log)

## Codebase Context

The repository now has a much clearer canonical statement of intent than it did
before. The new [north-star doc](../roadmap/north-star.md) says the product
exists to let humans steer and agents execute safely, with `PR lead time` as
the primary metric and the review or rework loop as the primary bottleneck
(`docs/roadmap/north-star.md:7-104`). The updated
[agent-first status matrix](../roadmap/agent-first-status.md) also frames
progress in terms of throughput, manual glue removal, and reliability rather
than feature count alone (`docs/roadmap/agent-first-status.md:9-45`).

That gives the repo a strong documentary north star, but not yet a
load-bearing runtime contract.

The current product surface still presents `coding-harness` as a broad control
plane that spans bootstrap, review policy, CI migration, Linear workflow
operations, Symphony workflow validation, context indexing, search, UI loops,
and org-wide audit posture (`README.md:8-25`, `README.md:358-378`,
`README.md:420-505`). That breadth is not automatically wrong, but it creates a
real drift risk: the repo can keep adding governance, orchestration, and
adjacent platform surfaces without proving that the review or rework loop got
cheaper for Codex-driven work.

The important distinction after this sweep is:

- the repo is still strongly Codex-compatible
- the repo is not yet strongly Codex-first in its runtime contract,
  hero workflows, or control-plane boundaries

That means the right response is not "remove every non-Codex feature." The
right response is to make the Codex-first throughput loop the primary product
contract and make every other surface justify itself against that loop.

## Sweep Method

This ideation pass was a repo-wide sweep grounded in direct file reads and
inventory, not a brainstorm from memory. The repo currently contains:

- `757` tracked files
- `400` TypeScript files
- `246` Markdown files
- `29` shell scripts
- `47` JSON files

The scan prioritized source-of-truth surfaces rather than generated output such
as `dist/`, `coverage/`, and large artifact folders. High-attention surfaces
included:

- north-star and status docs
- `README.md`
- `harness.contract.json`
- command registry and command implementations
- init and scaffold machinery
- Codex wrapper and preflight scripts
- Linear and Symphony workflow docs
- PR and review governance surfaces

The highest-entropy files in the repo today are:

- `src/commands/ci-migrate.ts` — `10346` lines
- `src/lib/init/scaffold.ts` — `5053` lines
- `src/commands/init.test.ts` — `4718` lines
- `src/lib/cli/registry/command-specs.ts` — `2159` lines
- `src/commands/review-gate.ts` — `999` lines
- `src/commands/drift-gate.ts` — `840` lines
- `scripts/codex-preflight.sh` — `725` lines
- `scripts/check-environment.sh` — `406` lines

The command catalog currently exposes `55` commands, spanning bootstrap,
governance, Linear operations, Symphony workflow generation, drift auditing,
context indexing, search, UI loops, CI migration, remediation, and pilot
evaluation (`src/lib/cli/registry/command-specs.ts:98-240` and parsed command
inventory from `src/lib/cli/registry/command-specs.ts`).

That matters because command count is not itself drift, but command sprawl is a
strong signal that the repo may be optimizing for control-plane breadth instead
of a smaller, more teachable Codex-first loop.

## Drift Map

### 1. The north star is canonical in docs, but not yet encoded as runtime truth

The new north-star doc is crisp. The runtime contract is not. The live contract
file still defines risk tiers, review policy, branch protection, Linear issue
tracking, remediation policy, loop stages, docs-gate rules, and other policy
surfaces, but it has no explicit machine-readable north-star section
(`harness.contract.json:1-220`). There is no contract field for:

- mission
- primary metric
- primary bottleneck
- autonomy boundary
- safety floor
- non-goals

The result is that the most important product contract still lives in prose
while the enforcement surfaces continue to operate without directly asking
whether new work reduces PR lead time or removes manual glue.

Related gaps are visible in runtime gates:

- `plan-gate` still checks for implementation steps and acceptance criteria, but
  does not require fields like `north_star_metric`, `primary_bottleneck`, or
  `why_this_improves_throughput_or_reliability`
  (`src/lib/plan-gate/detector.ts:112-171`, `src/lib/plan-gate/detector.ts:437`)
- `drift-gate` currently checks command parity, to-do lifecycle, quality score,
  and the status matrix, but not whether `README.md`, the contract, preflight,
  or PR surfaces agree with the canonical north star
  (`src/commands/drift-gate.ts:24`, `src/commands/drift-gate.ts:350-600`)
- `scripts/codex-preflight.sh` is a heavy environment and memory bootstrap, but
  it does not restate the north star before work begins
  (`scripts/codex-preflight.sh:1-220`)
- the PR template asks for summary, risk, and review artifacts, but not whether
  the change reduces PR lead time or removes repeated manual glue work
  (`.github/PULL_REQUEST_TEMPLATE.md:1-42`)

### 2. The product surface is still broader than a Codex-first harness

The updated README now opens with the right framing: PR lead time, review and
rework loop, humans steer, agents execute (`README.md:8-25`, `README.md:111-125`).
But the same README still makes the product feel like a broad governance and
workflow platform:

- advanced Symphony workflow contract support (`README.md:358-378`)
- Linear workflow operations as a first-class command family
  (`README.md:464-473`)
- search, context indexing, semantic retrieval, and UI loops as peer surfaces
  (`README.md:488-505`)
- requirements that include Linear auth, Local Memory, and a local embedding
  embeddings, and browser automation tooling (`README.md:506-519`)

The effect is subtle but important. The repo's first honest sentence says
"throughput-first Codex harness," while the command and requirements surface
still says "general control plane for many adjacent workflow problems."

That is drift because it invites future work that can plausibly be useful
without being demonstrably north-star useful.

### 3. Linear and Symphony still occupy too much canonical surface

The repository still treats Linear and Symphony as central enough that they
shape branch policy, check policy, docs, and workflow expectations:

- `issueTrackingPolicy.provider` is still `linear` in the main contract
  (`harness.contract.json:100-109`)
- branch protection still requires `linear-gate`
  (`harness.contract.json:55-72`)
- `README.md` still presents "start work on an issue" and "submit a change for
  review" using `linear prepare` and `linear sync` as the standard path
  (`README.md:73-79`)
- `README.md` still presents Symphony validation as one of the advanced
  workflows (`README.md:358-378`)

There are also still explicit manual-repair seams in the Linear docs:

- `harness linear sync` does not auto-close resolved issues; closure remains
  manual by design (`docs/linear-sync.md:64-83`)
- Codex-created branches do not trigger Linear branch-copy automation, so
  `In Progress` transitions still require manual repair
  (`docs/agents/18-github-linear-automation.md:120-145`)

This is the clearest "Codex-first vs workflow-platform" tension in the repo.
Linear can remain important, but it should be a support system for the Codex
throughput loop, not a co-equal product identity that forces manual glue back
into the harness.

### 4. Environment and governance baseline has become too large and too coupled

The strongest single-file evidence of control-plane sprawl is
`scripts/check-environment.sh`. It currently hard-fails on:

- contract file presence
- `.mise.toml`
- `.codex/environments/environment.toml`
- `Makefile`
- `prek.toml`
- `CODESTYLE.md`
- the full code-style module directory and checksum manifest
- a long list of support scripts
- a full Project Brain scaffold
- a large pinned tool inventory
- tooling-doc keyword sync
- a large binary inventory
- a large Codex action inventory
- required Make targets
- required `prek` hooks
- required `package.json` scripts

This is all in one baseline gate (`scripts/check-environment.sh:7-260`).

The problem is not that any single requirement is irrational. The problem is
that the repo has turned many optional or advanced capabilities into one
compound environment truth. That increases setup cost, hides which
dependencies are actually needed for the Codex-first loop, and makes the repo
teach "full ceremony" as normal.

The same coupling shows up in scaffold output. `src/lib/init/scaffold.ts`
contains template logic for Codex wrappers, CodeRabbit config, Linear intake,
workflow generation, Project Brain scaffolding, Git hooks, docs, code-style
packs, workflow files, and environment actions all in one giant emission
surface (`src/lib/init/scaffold.ts:1-220`, `src/lib/init/scaffold.ts` matches
around lines `563-605`, `1715-1910`, `2207-2245`, `2896-2912`, `4317-4594`,
`4979-5006`).

That is drift from the north-star principle "keep repo structures legible to
agents by making patterns uniform and local to a subtree." The scaffold knows
too much at once.

### 5. Control-plane hot spots are too large to teach cleanly

Some complexity is justified. The repo genuinely does hard things. But the
largest control-plane files now carry too many responsibilities:

- `src/commands/review-gate.ts` mixes contract loading, current-head SHA
  validation, plan traceability, approvals, reviewer independence, review
  threads, required checks, authz preflight, rerun-comment logic, and artifact
  emission (`src/commands/review-gate.ts:320-560`, `src/commands/review-gate.ts`
  matches around `523-559`, `686-928`)
- `src/commands/ci-migrate.ts` has grown into an enormous migration and
  provenance engine with snapshot capture, break-glass policy, merge-queue
  orchestration, artifact signing, external control-plane capture, parity proof
  bundles, and commit-mode branching (`src/commands/ci-migrate.ts:1-220` and
  matches throughout the file)
- `src/lib/cli/registry/command-specs.ts` is both a capability catalog and a
  large dispatch and argument-routing surface for the entire CLI
  (`src/lib/cli/registry/command-specs.ts:98-240`)

This is a north-star issue because large mixed-responsibility files increase
context cost for agents. The repo becomes harder to modify safely, harder to
pattern-match, and harder to evolve around the review or rework loop without
understanding unrelated features.

### 6. Codex-first foundations exist and should be preserved

The repo is not lost. Several surfaces already embody the right model:

- the north-star doc itself is strong and specific
  (`docs/roadmap/north-star.md:7-104`)
- the status matrix now interprets progress through the north-star lens
  (`docs/roadmap/agent-first-status.md:9-45`)
- `scripts/codex-enforced` still treats Codex as the primary operator path and
  protects `main` by creating task worktrees before launch
  (`scripts/codex-enforced:1-220`)
- `scripts/new-task.sh` still encodes one task = one worktree = one branch = one
  agent thread (`scripts/new-task.sh:9-26`)
- remediation policy already includes `codex` as a first-class provider default
  (`harness.contract.json:110-125`)
- `review-gate` still preserves strong safety primitives like current-head SHA
  discipline and plan traceability (`src/commands/review-gate.ts:464-490`)

That means this is a realignment problem, not a greenfield strategy problem.

## Ranked Ideas

### 1. Promote the north star from doc to runtime contract

**Description**

Add an explicit `northStar` section to `harness.contract.json` and make
`plan-gate`, `drift-gate`, preflight, and PR/review surfaces consume it.

**Rationale**

This is the highest-leverage move because it changes what the repo can enforce.
Right now the repo can enforce dozens of lower-level policy details without
enforcing the thing that is supposed to justify them.

**Implementation shape**

- Add machine-readable fields for mission, primary metric, primary bottleneck,
  autonomy boundary, safety floor, and non-goals.
- Make `plan-gate` require throughput alignment metadata.
- Make `drift-gate` compare `north-star.md`, `README.md`, status reporting, and
  contract values.
- Make `scripts/codex-preflight.sh`, `review-gate`, and the PR template restate
  the north star at execution time.

**Downsides**

This adds one more contract surface. If done poorly, it becomes another prose
mirror instead of real enforcement.

**Confidence**

High

**Complexity**

Medium

**Status**

Keep

### 2. Define a real product split between core Codex-first harness and adjacent platform surfaces

**Description**

Separate the repo into "core path" versus "adjacent path" at the product level.
Core means the Codex-first throughput loop. Adjacent means Linear ops,
Symphony/workflow contracts, semantic search, org audit, and similar surfaces.

**Rationale**

The repo currently reads as if all of these are peer commitments. They are not.
Some are central to the north star; others are support systems or experiments.
Without a product split, the README and command surface will keep encouraging
breadth.

**Implementation shape**

- Rewrite the top-level README around a smaller hero path.
- Group commands into `core`, `adjacent`, and `experimental` capability
  families in the command catalog.
- Make downstream install presets explicitly choose a posture instead of
  scaffolding every advanced surface by default.

**Downsides**

This may make some existing capabilities feel demoted. It also forces sharper
product decisions about what the repo really owns.

**Confidence**

High

**Complexity**

Medium

**Status**

Keep

### 3. Make Codex-first the default posture and treat Linear/Symphony as optional integrations

**Description**

Stop making Linear and Symphony feel like mandatory identity surfaces for the
product. Keep them, but make them optional overlays on top of the Codex-first
loop.

**Rationale**

The repo's branch policy, docs, and review path still assume Linear deeply
enough that Codex-native work has to repair manual state transitions. That is a
harness bug, not a user obligation.

**Implementation shape**

- Remove `linear-gate` from the conceptual default path unless the selected
  profile explicitly requires Linear.
- Keep issue tracking configurable in both docs and scaffold output.
- Either automate the remaining Linear repair seams or stop making Linear
  hygiene look like a default success criterion for every repo.

**Downsides**

This could reduce leverage for Jamie's own current workflow if done too bluntly.
The right move is optionality, not erasure.

**Confidence**

High

**Complexity**

Medium-high

**Status**

Keep

### 4. Replace all-in-one environment ceremony with capability-driven baseline checks

**Description**

Refactor `check-environment` and related scaffold logic so the repo validates
required capabilities for the chosen operating mode instead of one giant
everything baseline.

**Rationale**

This is the best way to reduce control-plane sprawl without weakening safety.
A Codex-first repo should not need search embeddings, browser tooling, Linear,
and enterprise governance artifacts just to be considered healthy unless that
repo explicitly chose those capabilities.

**Implementation shape**

- Introduce capability profiles such as `codex-core`, `codex-linear`,
  `codex-ui`, `codex-enterprise`.
- Drive required tools, files, hooks, and docs from those selected profiles.
- Keep fail-closed behavior, but shrink the default surface.

**Downsides**

This requires reworking scaffold and validation assumptions together. Partial
execution would create more drift before it creates less.

**Confidence**

High

**Complexity**

High

**Status**

Keep

### 5. Break up oversized command and scaffold files around the throughput loop

**Description**

Split `review-gate`, `ci-migrate`, `command-specs`, and `init/scaffold` into
smaller bounded modules aligned to the core loop instead of large
mixed-responsibility files.

**Rationale**

This is not just a maintainability cleanup. It directly affects whether agents
can safely modify the harness. A Codex-first repo should be unusually easy for
Codex to navigate.

**Implementation shape**

- `review-gate`: separate SHA validation, plan traceability, approval logic,
  rerun policy, and artifact emission.
- `command-specs`: separate catalog metadata from execution dispatch.
- `init/scaffold`: separate core Codex scaffold, adjacent integrations, and
  enterprise governance templates.
- `ci-migrate`: separate snapshot/provenance infrastructure from user-facing
  action handlers.

**Downsides**

This is a large refactor and creates temporary churn. It needs strict parity
tests or it will destabilize real workflows.

**Confidence**

Medium-high

**Complexity**

High

**Status**

Keep

### 6. Change review surfaces from generic governance proof to throughput proof

**Description**

Make review, PR, and status surfaces explicitly ask whether new work reduces PR
lead time, reduces review-loop retries, or removes manual glue work.

**Rationale**

The current review surfaces are serious and detailed, but they still validate a
lot of governance behavior without requiring a north-star justification. That
is how breadth grows.

**Implementation shape**

- Add north-star questions to the PR template.
- Add explicit throughput-alignment questions to `review-gate`.
- Add a weekly scorecard for PR lead time, retries, manual interventions, and
  blocked runs.

**Downsides**

Metrics can become theater if they are not tied to real operating choices.

**Confidence**

High

**Complexity**

Medium

**Status**

Keep

### 7. Extract or demote search, context indexing, and other adjacent platform features unless they prove throughput value

**Description**

Treat semantic search, context indexing, org audit, and similar surfaces as
features that must continuously justify their place in the core package.

**Rationale**

These are exactly the kinds of surfaces that can be useful and still be drift.
If they do not reduce review cost, setup cost, or context loss for Codex-first
delivery, they should be optional, extracted, or clearly secondary.

**Implementation shape**

- Mark them as optional capabilities in docs and scaffold.
- Measure whether teams using them actually reduce review or rework cost.
- Consider extraction into separate commands, packages, or plugin surfaces if
  they remain valuable but non-core.

**Downsides**

This can feel like retreat if some of those capabilities are strategically
interesting. The point is not to kill them automatically; it is to stop letting
them hide inside the core identity.

**Confidence**

Medium

**Complexity**

Medium

**Status**

Keep

## Rejection Summary

### 1. Rewrite the product around a brand-new agent runtime

**Reason rejected**

The repo already has the right safety primitives: current-head SHA discipline,
deterministic evidence, bounded remediation, and task worktree isolation. The
drift is in contract clarity and product boundary, not in the absence of a new
runtime.

### 2. Remove Linear entirely

**Reason rejected**

Linear is clearly useful in Jamie's current operating model. The issue is that
it still occupies too much canonical product surface and still leaks manual
repair steps into Codex-first work. Optionality is the right answer, not
deletion by ideology.

### 3. Keep adding policy surface but improve the docs

**Reason rejected**

The repo's problem is not primarily explanatory. It is that policy surface can
expand without a direct north-star check. Better wording alone will not prevent
future drift.

### 4. Solve drift only through a massive docs rewrite

**Reason rejected**

The documentary layer is already much better after `north-star.md` and the
status refresh. The missing piece is runtime enforcement and product-surface
narrowing.

## Session Log

- Read the new north-star and status docs to establish the canonical lens:
  `docs/roadmap/north-star.md`, `docs/roadmap/agent-first-status.md`
- Scanned the top-level product surface in `README.md`
- Read the live runtime contract in `harness.contract.json`
- Read `src/lib/plan-gate/detector.ts` to verify current plan constraints
- Read `scripts/check-environment.sh`, `scripts/codex-preflight.sh`,
  `scripts/codex-enforced`, and `scripts/new-task.sh`
- Read `src/commands/review-gate.ts`, `src/commands/drift-gate.ts`,
  `src/commands/ci-migrate.ts`, and `src/lib/init/scaffold.ts`
- Read Linear workflow docs:
  `docs/linear-sync.md`, `docs/agents/18-github-linear-automation.md`
- Counted repo inventory and command surface breadth to ground the sweep

Final judgment after the sweep:

- The repo has not drifted away from "humans steer, agents execute safely."
- It has drifted toward "broad governance and workflow platform" as a product
  identity.
- The path back is to make the Codex-first throughput loop the only unquestioned
  center of the system and force every adjacent surface to justify itself
  against that center.
