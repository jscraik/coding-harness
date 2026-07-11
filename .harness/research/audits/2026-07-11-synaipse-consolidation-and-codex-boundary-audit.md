---
schema_version: 1
lifecycle_schema: harness-document-lifecycle/v1
artifact_id: synaipse-consolidation-and-codex-boundary-audit-2026-07-11
artifact_type: research-audit
canonical_slug: synaipse-consolidation-and-codex-boundary-audit
title: SynAIpse Consolidation And Codex Boundary Audit
status: active
date: 2026-07-11
source_type: research
authority: secondary-context
lifecycle_status: reviewed
canonical_destination: docs/specs/2026-07-11-synaipse-agent-native-delivery-control-plane-v1-spec.md
owner: coding-harness-maintainers
created: 2026-07-11
last_reviewed: 2026-07-11
review_cadence: on-change
validated_by:
  - pnpm docs:lint
  - pnpm docs:lifecycle
  - pnpm harness:audit-tracking
  - bash scripts/run-harness-gate.sh docs-gate --mode required --json
depends_on:
  - docs/specs/2026-07-11-synaipse-agent-native-delivery-control-plane-v1-spec.md
  - docs/adr/004-synaipse-agent-native-delivery-control-plane.md
tracking_issue: JSC-441
---

# SynAIpse Consolidation And Codex Boundary Audit

## Table of Contents

- [Purpose](#purpose)
- [Executive Verdict](#executive-verdict)
- [Evidence Baseline](#evidence-baseline)
- [Target Boundary](#target-boundary)
- [Code-Tree Findings](#code-tree-findings)
- [Codex Main Ownership Map](#codex-main-ownership-map)
- [Command Disposition Ledger](#command-disposition-ledger)
- [Non-Command Surface Dispositions](#non-command-surface-dispositions)
- [Deletion Queue](#deletion-queue)
- [Implementation Sequence](#implementation-sequence)
- [Decision Gates](#decision-gates)
- [Claims Boundary](#claims-boundary)

## Purpose

This audit returns SynAIpse to the original question: what should Coding
Harness keep, deepen, merge, delegate to Codex, extract, or delete so Jamie can
steer outcomes while Codex executes the full engineering job without producing
slop.

It applies four lenses:

- Ryan Lopopolo's harness-engineering model: shape context, autonomy, tool
  scope, verification, and feedback rather than adding agent workflow theater;
- agent-native readiness: one discoverable execution loop, mechanical
  guardrails, outcome proof, recovery, and feedback compounding;
- principal architecture: canonical owner, public surface, caller map,
  dependency direction, reversible migration, and verifier;
- ruthless grilling: every mechanism must justify the decision it removes,
  failure it prevents, evidence it improves, or recurring cost it lowers.

This is a decision and migration input. It is not deletion authority. Public
interfaces, unknown consumers, generated projections, downstream installs, and
durable knowledge require migration proof before removal.

Linear issue `JSC-441` admits this planning publication and Phase 0
characterization only. Every runtime implementation slice requires separate
admission before deletion or refactoring begins.

## Executive Verdict

SynAIpse has a valuable control-plane core inside an overgrown product surface.
The core is:

```text
Jamie Core + project authority + lifecycle state + current-SHA evidence
  -> one next action -> Codex execution -> provider evidence
  -> transition or Vital Decision -> improvement disposition
```

The repository currently exposes 84 registered commands, including 38 domain
commands, 43 plumbing commands, three cockpit commands, and a 19-command agent
rail. The accepted architecture says `harness next --json` is the sole routine
entrypoint. The mismatch is the primary consolidation target.

The ruthless target is not one binary containing only one command. It is one
routine agent journey with bounded internal gates and administrative tools.
Command count is a diagnostic; decision count, context burden, duplicated
ownership, and review/rework cost are the outcome measures.

Candidate product surface to test during migration:

| Surface | Audience | Role |
| --- | --- | --- |
| `next` | Codex and Jamie | Sole routine lifecycle cockpit. |
| `adopt` | Administrator | Hypothesis: diagnose, install, upgrade, remove, and rollback SynAIpse. |
| `diagnose` | Maintainer and recovery | Hypothesis: pure-by-default health, environment, contract, and drift diagnostics. |
| `commands` | Maintainer | Machine-readable administrative discovery. |

`adopt` and `diagnose` do not yet exist and are not admitted by this audit.
Phase 0 must characterize callers and effects, then a bounded prototype must
prove cold, resumed, administrative, and recovery parity plus lower operator
choice burden. Any new surface must absorb and retire older surfaces in the
same measured migration. Until then, existing compatibility commands remain
callable and `next` is the only accepted routine target.

Other current commands are candidates for internal operations, provider
adapters, optional capability packs, or time-bounded compatibility facades. No
new top-level command is admitted unless it absorbs an older surface or proves
a distinct user outcome that existing surfaces cannot express safely.

## Evidence Baseline

### Coding Harness source

- Branch inspected: `codex/synaipse-control-plane-spec`.
- Command catalog schema: `harness-command-catalog/v3`.
- Registered commands: 84.
- Agent rail commands: 19.
- Source inventory observed: 280 files under `src/commands`, 945 under
  `src/lib`, 126 scripts, 328 documentation files, and 50 files under the
  top-level test/eval fixture roots used by the inventory command.
- Large durable-history surfaces exist under `.harness/intent`,
  `.harness/review`, `.harness/research`, `.harness/specs`, `.harness/plan`,
  and `.harness/implementation-notes`.

### Codex main source

- Repository: `OpenAI Codex repository` (logical source identifier).
- Branch inspected: `main` tracking `origin/main`.
- Commit inspected: `5c9905ae413e61c4bfaaa5fdfc5464583308e18a`.
- `codex-rs/core-api/src/lib.rs` exports thread management, state, configuration,
  permissions, skills, MCP, environment management, dynamic tools, approval
  policy, events, and user input.
- `codex-rs/ext/goal` owns thread-goal state.
- `codex-rs/ext/memories` owns memory contribution, reading, searching, and
  bounded ad-hoc note creation.
- `codex-rs/ext/skills`, `codex-rs/plugin`, and `codex-rs/ext/mcp` own skills,
  plugins, and MCP extension loading.
- `codex-rs/hooks` owns lifecycle hooks including session start, tool use,
  permission requests, compaction, prompt submission, and stop.
- `codex-rs/thread-store` owns create, resume, persist, read, archive-related,
  and discard behavior for threads.
- `codex-rs/app-server-protocol` exposes plans, thread status, thread goals,
  approvals, review items, collaboration-agent activity, and turn history.

### Caller-map limitation

Repository references were searched across source, scripts, CI, root contracts,
documentation, and `.harness`. Reference counts include definitions, tests,
examples, and historical records; they do not prove active runtime use.
External downstream consumers and installed package versions are not fully
enumerated. Therefore this ledger authorizes compatibility migration and
canaries, not immediate public-interface deletion.

## Target Boundary

### Codex owns execution primitives

- threads, turns, goals, plans, checkpoints, and resume;
- tools, shell, filesystem, git, dynamic tools, and collaboration agents;
- permissions, approvals, sandboxing, environments, and workspace roots;
- native memories, skills, plugins, MCP, apps, hooks, and review execution;
- raw runtime events, history, and interaction with Jamie.

### SynAIpse owns delivery policy

- Jamie Core, taste, values, standards, and Vital Decision routing;
- Shape, Admit, Build, Prove, Review, Integrate, and Improve transitions;
- project adoption, capability admission, and provider ownership;
- normalization of current-SHA repository, CI, review, security, tracker,
  sign-off, merge, and main-sync evidence;
- one next action, stop condition, rollback, and claims boundary;
- observed-feedback classification and retain/change/consolidate/delete
  disposition.

### Target repositories remain authoritative

- product and domain truth;
- local architecture, privacy, raw sources, and durable knowledge;
- `AGENTS.md`, `CODESTYLE.md`, validation wrappers, and rollback limits;
- repository documentation and the public GitBook source projection.

SynAIpse may select and reference context. It must not duplicate Codex memory,
become another search engine, or make builds and hosted CI depend on private
Jamie Brain availability.

## Code-Tree Findings

### F1: The public journey is wider than the architecture

The catalog exposes three cockpit commands and 19 agent-rail commands while the
architecture names `next` as the routine front door. Cold agents must still
choose among orientation, readiness, ratchet, runtime, session, validation,
review, and decision packet surfaces. This keeps orchestration decisions in the
operator's head.

Disposition: **merge** routine projection into `next`; retain internal commands
only where they remain clean module seams or administrator diagnostics.

### F2: Command families describe workflow stages instead of primitives

Packet generators such as `session-distill`, `agent-rework`,
`reviewer-decision`, and `governance-decision-surface` expose intermediate
workflow products as commands. Codex already owns thread/session/plan/review
execution. SynAIpse needs their normalized evidence fields, not separate routine
user journeys.

Disposition: **merge**, then remove from the agent rail; preserve readers during
the compatibility window.

### F3: Context/search overlaps Codex-native capability

`context`, `search`, `index-context`, `context-health`, `source-outline`,
`brain`, and session-context surfaces overlap native filesystem search, memory
search, skills, connectors, and dynamic tools. SynAIpse has one distinct need:
stage-aware selection of governed logical context references under authority,
privacy, freshness, and project identity.

Disposition: **delegate** retrieval to Codex; **keep/deepen** the small
stage-aware reference selector; quarantine general indexing/search until a
canary proves an outcome Codex cannot provide.

### F4: Diagnosis is fragmented

`check`, `doctor`, `health`, `audit`, `fitness`, `agent-readiness`,
`tooling-audit`, `org-audit`, `feedback-loop-audit`, `check-environment`, and
multiple health gates overlap in questions and evidence. Several commands also
have invocation-dependent writes that are not adequately represented by a
command-level read/write label.

Disposition: **merge** under pure-by-default `diagnose`; gate and artifact writes
remain explicit internal operations. `next` consumes compact results.

### F5: Adoption is fragmented across commands

`init`, `upgrade`, `eject`, `fleet-plan`, `ci-migrate`, `preset`, and parts of
`branch-protect` describe one adoption lifecycle. Separate entrypoints expose
mechanism rather than the outcome: safely admit, update, or remove SynAIpse.

Disposition: **merge** under administrator-only `adopt` with diagnose, propose,
apply, verify, rollback, and remove actions. Preserve compatibility facades
during downstream migration.

### F6: Gates are numerous but mostly legitimate plumbing

Policy, documentation, plan, evidence, memory, review, CI ownership, license,
silent-error, observability, artifact, and drift gates encode real invariants.
Their existence is less concerning than their visibility and duplicated result
shapes.

Disposition: **keep** as internal deep modules where each owns a distinct
invariant; **merge** result envelopes, effect declarations, and lifecycle
routing; remove a gate only when its invariant is duplicated or retired.

### F7: Historical control-plane material is context-heavy

The tree contains many plans, brainstorms, intent packets, reviews, research
records, implementation notes, goals, schemas, examples, and generated
artifacts. Some are durable provenance, but default routing can turn history
into active cognitive load.

Disposition: **extract** history from default context, keep a compact active
route, preserve immutable references, and archive only after caller and
authority checks. Do not delete raw sources or durable private knowledge to hit
a size target.

### F8: Provider ownership must replace provider duplication

CircleCI, GitHub Actions, CodeRabbit, Linear, Betterleaks/Gitleaks, Semgrep,
Trivy, Aikido, Snyk, and sign-off each need one admitted responsibility.
SynAIpse should normalize evidence and make transition decisions, not recreate
provider functionality.

Disposition: **extract** provider interactions behind adapters, **keep**
deterministic linkage and evidence normalization, and **delete** duplicated
provider lanes only after finding-class and branch-protection parity proof.

## Codex Main Ownership Map

| Capability | Current Codex evidence | SynAIpse disposition |
| --- | --- | --- |
| Threads, resume, persistence | `codex-rs/core-api`, `codex-rs/thread-store` | Delegate execution; retain logical task/evidence refs only. |
| Goals and plan state | `codex-rs/ext/goal`, app-server plan events | Delegate goal/plan mechanics; retain lifecycle acceptance policy. |
| Permissions and approvals | core API permission and approval types; app-server approval requests | Delegate enforcement; SynAIpse states required authority and Vital Decision class. |
| Environment management | `codex-rs/exec-server`, core API environment exports | Delegate runtime environments; inject only repo-owned reproducible configuration. |
| Tools and dynamic tools | `codex-rs/tools`, core API dynamic-tool exports | Delegate tool execution/discovery; SynAIpse selects allowed outcome and evidence. |
| Skills and plugins | `codex-rs/ext/skills`, `codex-rs/plugin` | Delegate loading/routing; use skills only as bounded policy or workflow knowledge. |
| MCP and apps | `codex-rs/ext/mcp`, connector and plugin surfaces | Delegate provider transport; keep provider ownership and mutation boundaries. |
| Hooks and lifecycle events | `codex-rs/hooks` | Consume stable signals; do not build a second hook runtime. |
| Memory search and contribution | `codex-rs/ext/memories` | Delegate retrieval/storage mechanics; keep governed project-context selection and privacy. |
| Review execution | protocol review items, app-server review mapping | Delegate review execution; keep independent-review requirement and evidence normalization. |
| Collaboration agents | app-server collaboration-agent activity | Delegate orchestration runtime; keep builder/independent-grader policy. |
| Runtime history and trace | protocol events, thread history, rollout trace | Reference current evidence; do not copy raw session history into repository contracts. |

## Command Disposition Ledger

`compatibility` means the command stays callable until source-package and
downstream canaries prove migration. `internal` means it remains a module or
plumbing operation but leaves routine discovery.

| Command | Disposition | Target |
| --- | --- | --- |
| `next` | **deepen** | Sole routine cockpit; emit lifecycle state, one action, effects, authority, rollback, and evidence refs. |
| `orient` | **merge** | Absorb cold/resumed orientation into `next`; compatibility facade, then retire. |
| `check` | **merge** | Project compact diagnosis through `next`/`diagnose`; remove cockpit status. |
| `commands` | **keep** | Administrative machine-readable catalog; not a routine workflow. |
| `agent-readiness` | **merge** | `diagnose agent`; project blockers into adoption and `next`. |
| `agent-native-ratchets` | **merge** | Improvement-state projection; remove standalone agent command. |
| `session-distill` | **delegate** | Codex owns session history; retain only bounded evidence-reference adapter if measured. |
| `agent-rework` | **merge** | Fold retry, verifier, stop, and recovery fields into transition/improvement state. |
| `reviewer-decision` | **merge** | Fold independent decision into Review transition evidence. |
| `governance-decision-surface` | **merge** | Fold Vital Decision classification into `next`. |
| `runtime-card` | **merge** | Internal current-runtime evidence adapter consumed by `next` and `diagnose`. |
| `session-context` | **delegate** | Prefer Codex thread/runtime context; retain logical task snapshot refs only. |
| `decision-request` | **merge** | Vital Decision output from `next`; no separate routine command. |
| `audit` | **merge** | `diagnose deep`; preserve specialist internals. |
| `doctor` | **merge** | `diagnose recovery`; compatibility facade. |
| `health` | **merge** | `diagnose summary`; compatibility facade. |
| `fitness` | **merge** | Improvement metrics behind `diagnose` and Improve stage. |
| `verify-work` | **deepen** | Internal repository verifier; standardize evidence envelope and invocation effects. |
| `contract` | **keep** | Administrative contract inspection/validation behind `diagnose` where practical. |
| `init` | **merge** | `adopt apply`; compatibility facade. |
| `upgrade` | **merge** | `adopt update`; compatibility facade. |
| `eject` | **merge** | `adopt remove`; explicit rollback and native-authority preservation. |
| `fleet-plan` | **merge** | `adopt portfolio --dry-run`; never routine agent discovery. |
| `preset` | **merge** | Internal adoption profile selection; capabilities remain project-admitted. |
| `ci-migrate` | **merge** | Optional `adopt ci`; retire after CircleCI ownership migration. |
| `branch-protect` | **extract** | Provider adapter invoked by admitted adoption/integration authority. |
| `linear` | **extract** | Prefer Linear plugin/app for interaction; compatibility only for proven gaps. |
| `linear-gate` | **keep** | Deterministic CI linkage and metadata gate; internal Review/Integrate operation. |
| `workflow:generate` | **extract** | Linear/Symphony adapter; remove if plugin-native workflow covers the outcome. |
| `symphony-check` | **extract** | Optional Symphony capability pack, absent from universal core. |
| `pr-closeout` | **deepen** | Canonical current-SHA Review/Integrate evidence adapter consumed by `next`. |
| `review-context` | **merge** | Review transition projection; raw context stays behind references. |
| `validation-plan` | **merge** | Prove-stage recommendation inside `next`; retain internal planner. |
| `verify-coderabbit` | **extract** | CodeRabbit provider adapter; current-SHA evidence only. |
| `review-gate` | **keep** | Internal Review transition invariant. |
| `pr-template-gate` | **keep** | Internal PR metadata invariant; retire aliases after migration. |
| `policy-gate` | **keep** | Internal risk and repository-policy invariant. |
| `risk-tier` | **merge** | Internal policy evaluator; no standalone routine surface. |
| `rule-lifecycle-gate` | **keep** | Internal repeated-rule ownership/expiry invariant. |
| `preflight-gate` | **merge** | Internal transition aggregate; avoid overlapping routine diagnosis. |
| `plan-gate` | **keep** | Internal plan/Shape invariant when a plan is admitted. |
| `prompt-gate` | **keep** | Internal prompt/intent invariant only where it prevents a measured failure. |
| `brainstorm-gate` | **merge** | Shape-stage evaluator; retire if plan/intent contracts fully absorb it. |
| `docs-gate` | **keep** | Internal documentation ownership and GitBook safety invariant. |
| `license-gate` | **keep** | Internal admitted license invariant. |
| `memory-gate` | **merge** | Preserve durable-learning invariant; delegate native memory mechanics to Codex. |
| `artifact-gate` | **keep** | Internal artifact contract invariant. |
| `ci-ownership-gate` | **keep** | Internal non-overlap and required-check identity invariant. |
| `observability-gate` | **keep** | Internal proof/telemetry-boundary invariant where admitted. |
| `silent-error` | **keep** | Internal fail-closed error-detection invariant. |
| `blast-radius` | **merge** | Internal Admit/Build risk evaluator. |
| `diff-budget` | **merge** | Internal taste/restraint signal; advisory unless project policy admits blocking. |
| `runtime-budget` | **merge** | Internal autonomy/cost signal; Vital Decision only at material thresholds. |
| `evidence-verify` | **deepen** | Shared evidence verifier behind transitions; no routine menu choice. |
| `pattern-scope` | **merge** | Improve-stage sibling-scope evaluator. |
| `artifact-routine` | **merge** | Internal proof planner; absorb into Prove transition. |
| `feedback-loop-audit` | **merge** | Improve-stage diagnosis; delete if improvement case covers all callers. |
| `north-star-feedback` | **merge** | Improvement case input; no standalone routine command. |
| `learnings` | **merge** | Improvement case adapter; Codex/Jamie Brain own durable storage mechanics. |
| `gardener` | **extract** | Scheduled maintenance capability, not universal routine core. |
| `org-audit` | **extract** | Portfolio administration capability. |
| `tooling-audit` | **merge** | `diagnose tooling`; internal checker. |
| `check-environment` | **merge** | `diagnose environment`; pure-by-default. |
| `check-authz` | **delegate** | Codex owns approvals/permissions; retain provider-scope check only when external API proof requires it. |
| `local-memory-preflight` | **delegate** | Codex/local-memory runtime owns availability; `diagnose` may consume its status. |
| `drift-gate` | **keep** | Internal source/projection/cadence invariant. |
| `prompt-context-drift:write` | **merge** | Explicit diagnostic artifact action; leave routine rail. |
| `prompt-context-drift:validate` | **merge** | Internal diagnostic validator. |
| `context-health` | **merge** | `diagnose context`; only governed-ref health, not general retrieval quality. |
| `context` | **delegate** | Replace general retrieval with stage-aware logical-ref selection plus Codex reads. |
| `search` | **delegate** | Codex filesystem/memory/connector search owns retrieval unless a canary proves a gap. |
| `index-context` | **delegate** | No second general index; keep only registry/catalog metadata validation. |
| `source-outline` | **delegate** | Codex source reading/skills own outlining; retain only if a product outcome proves distinct value. |
| `brain` | **merge** | Project-context selector and improvement refs; no second memory product. |
| `replay` | **extract** | Evidence/eval capability pack; internal recovery where transitions reference it. |
| `remediate` | **merge** | Build/recovery operation governed by `next`; not an autonomous policy owner. |
| `simulate` | **extract** | Eval/planning capability, outside universal runtime core. |
| `automation-run` | **extract** | Optional automation adapter with explicit effects and authority. |
| `gap-case` | **merge** | Improvement/exception case; remove after transition contracts absorb consumers. |
| `pilot-evaluate` | **delete** | Migrate useful measurement fields into improvement cases, then retire pilot-era command. |
| `pilot-rollback` | **delete** | Migrate rollback behavior into adoption/improvement contracts, then retire pilot-era command. |
| `ui:fast` | **extract** | Optional UI proof capability pack. |
| `ui:verify` | **extract** | Optional UI proof capability pack. |
| `ui:explore` | **extract** | Optional UI exploration capability pack; never universal gate. |

## Non-Command Surface Dispositions

| Surface family | Disposition | Boundary |
| --- | --- | --- |
| `src/lib/decision`, `pr-closeout`, `delivery-truth`, evidence verification | **keep/deepen** | Core lifecycle and current-SHA truth modules. |
| `src/lib/init`, upgrade, project-type, presets | **merge** | One adoption deep module with reversible actions. |
| `src/lib/context-compound`, context/search/indexing | **delegate/quarantine** | Keep logical ref selection; compare retrieval against Codex before retaining general search. |
| `src/lib/session`, session-context, prompt-context packets | **delegate/merge** | Codex owns session mechanics; retain bounded evidence adapters. |
| `src/lib/memory`, project-brain, learnings | **merge** | Keep policy, provenance, and promotion; delegate storage/retrieval mechanics to canonical providers. |
| `src/lib/linear`, GitHub, CodeRabbit, CI | **extract** | Provider adapters behind lifecycle interfaces. |
| Security provider configuration | **keep/consolidate** | One owner per finding class; no duplicate blocking lane. |
| `scripts/` validation contracts | **keep/merge** | Keep repo wrappers; remove script/package/CLI duplication after caller proof. |
| `.harness` active decisions/specs/learnings | **keep** | Durable operating truth when promoted and indexed. |
| `.harness` raw runs, generated reports, local imports, stale route snapshots | **extract/archive** | Outside default context; local by default unless promoted. |
| Historical brainstorms/plans/reviews | **retain by reference** | Provenance, not active instruction. Archive only with owner and link validation. |
| Generated diagrams and `AI/context` | **keep as projection** | Never canonical; refresh from source architecture. |
| Downstream templates | **keep/trim** | Project-admitted minimum only; never copy Coding Harness's entire governance tree. |
| GitBook scaffold | **keep/trim** | Public repository docs only; private context prohibited. |
| GitHub Actions | **delete duplicated PR lanes** | Retain only admitted CodeQL and trusted publishing requirements. |
| CircleCI | **keep/deepen** | Sole general validation pipeline owner. |

## Deletion Queue

The following queue is ordered by confidence and reversibility. A queue entry is
not permission to delete before its proof gate passes.

### High-confidence migration candidates

1. Remove `orient` and `check` from first-contact discovery after `next` cold,
   resumed, and partial-adoption parity.
2. Remove five standalone agent-native packet commands from the agent rail
   after their useful fields project through state, transition, review, and
   improvement contracts.
3. Retire `pilot-evaluate` and `pilot-rollback` after measurement and rollback
   consumers migrate.
4. Retire command aliases after catalog telemetry/source searches and one
   downstream deprecation window.
5. Remove duplicated GitHub Actions PR validation after required-check and
   branch-protection parity proves CircleCI ownership.

### Evidence-dependent candidates

1. General `context`, `search`, `index-context`, and `source-outline` command
   families after Codex comparison canaries.
2. Interactive `linear` and workflow generation after plugin parity, offline CI
   linkage, and mutation-authority proof.
3. Snyk configuration after Trivy/Aikido finding-class and outage parity.
4. Redundant diagnosis commands after pure-by-default `diagnose` compatibility.
5. Historical default-context documents after active-route and provenance
   reference validation.

### Protected from broad deletion

- repository-native instructions, CODESTYLE, domain docs, tests, and rollback;
- raw sources and durable private knowledge;
- accepted decisions and immutable evidence references;
- provider evidence needed for review, security, or legal provenance;
- public interfaces with unknown downstream callers.

## Implementation Sequence

This audit remains planning evidence. It must not be added to or used to widen
the bounded GitBook/context canary in PR #465. Implementation requires a
separate branch and PR plus a Linear Admit route or explicit accepted exception,
phase ownership, proof, rollback, and independent QA. The first implementation
unit begins only after that route exists.

### Phase 0: Freeze and characterize

- Freeze new top-level commands, packet families, general search, and provider
  lanes.
- Record command catalog, exact invocation effects, packet producers/consumers,
  package/downstream versions, active provider checks, and current Codex SHA.
- Add no new abstraction during characterization.
- Treat `adopt` and `diagnose` as hypotheses. Prototype them only after the
  baseline, and admit them only if parity and lower choice burden are observed
  while older surfaces retire in the same migration.

### Phase 1: Truthful effects

- Make exact invocation effects authoritative.
- Convert diagnostics to pure-by-default operation.
- Require explicit artifact, repository, git, and external mutation actions.

### Phase 2: One cockpit

- Fold orientation and compact diagnosis into `next`.
- Emit lifecycle stage, one action, evidence refs, stop condition, authority,
  rollback, and claims boundary.
- Remove `orient` and `check` from first-contact discovery while retaining
  compatibility.

### Phase 3: Lifecycle and Vital Decisions

- Join Shape through Improve transitions with current-SHA evidence.
- Prove ordinary choices continue without Jamie and Vital Decisions stop with
  one recommended question.

### Phase 4: Adoption deep module

- Consolidate diagnose, apply, update, verify, rollback, and removal behavior.
- Preserve repository-native authority and make every write previewable.
- Keep GitBook and private-context registration as admitted capabilities, not a
  universal copied tree.

### Phase 5: Packet and context reduction

- Map packet callers, project useful fields, retain readers, and remove
  standalone agent commands.
- Compare context/search outcomes with Codex native filesystem, memory, skill,
  plugin, MCP, and connector paths.
- Keep only stage-aware governed-ref selection unless distinct value is proven.

### Phase 6: Provider ownership

- Enforce CircleCI as general pipeline owner.
- Preserve minimal GitHub Actions only for admitted CodeQL and trusted
  publishing.
- Extract Linear, CodeRabbit, security, and sign-off adapters.
- Normalize duplicate findings and current-SHA evidence.

### Phase 7: Canary, measure, dispose

- Run self-host, product, agent-skills, native, knowledge/privacy, minimal, and
  private-project canaries in the accepted order.
- Measure routine commands, context size, Jamie interventions, PR lead time,
  rework, evidence quality, rollback, and provider overlap.
- Record retain, change, consolidate, delete, or explicit non-adoption for every
  canonical project.

## Decision Gates

The audit found no new Vital Decision required before Phase 0 characterization.
The accepted architecture already establishes one cockpit, Codex ownership,
CircleCI ownership, GitBook/public privacy, private project context, and the
provider set.

Return to Jamie only when evidence exposes one of these choices:

- remove a public command before downstream migration proof;
- weaken a repository-owned rule or privacy boundary;
- grant new external mutation authority;
- accept recurring material provider cost;
- change public compatibility or strategic architecture;
- waive required current-SHA, review, security, sign-off, or rollback evidence.

## Claims Boundary

This audit establishes an evidence-backed target and migration queue. It does
not establish that any command is unused outside the repository, that deletion
is safe, that PR checks or review threads permit integration, that GitBook has
published, or that any downstream project has adopted the target architecture.

Each removal still requires source and generated-consumer search, package and
downstream canary, compatibility decision, exact verifier, rollback, and
independent QA.
