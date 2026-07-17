---
doc_schema: coding-harness-doc/v1
doc_type: architecture
authority: canon
canon_class: canonical
distribution: source-only
audience:
  - coding-harness-maintainer
  - codex-agent
  - reviewer
lifecycle_state: active
owner: coding-harness-maintainers
created: 2026-07-11
last_reviewed: 2026-07-16
review_cadence: on-change
maintenance_trigger:
  - synaipse-architecture-change
  - lifecycle-contract-change
  - provider-ownership-change
  - portfolio-adoption-change
semver_impact: minor
validated_by:
  - pnpm docs:lifecycle
  - bash scripts/run-harness-gate.sh docs-gate --mode required --json
depends_on:
  - docs/adr/004-synaipse-agent-native-delivery-control-plane.md
  - docs/roadmap/north-star.md
  - .harness/research/audits/2026-07-11-synaipse-consolidation-and-codex-boundary-audit.md
title: SynAIpse Agent-Native Delivery Control Plane v1
type: architecture
status: accepted
date: 2026-07-11
origin: Jamie steering plus 2026-07-11 coding-harness forensic audit
risk: high
spec_depth: full
last_validated: 2026-07-11
tracking_issue: JSC-441
---

# SynAIpse Agent-Native Delivery Control Plane v1

## Table of Contents

- [Decision](#decision)
- [Problem And Outcome](#problem-and-outcome)
- [Principles](#principles)
- [Ownership And Authority](#ownership-and-authority)
- [Lifecycle](#lifecycle)
- [Canonical Contracts](#canonical-contracts)
- [Agent Interface](#agent-interface)
- [Universal Context Plane](#universal-context-plane)
- [Provider Ownership](#provider-ownership)
- [Jamie Core](#jamie-core)
- [Adoption And Improvement](#adoption-and-improvement)
- [Consolidation Targets](#consolidation-targets)
- [Acceptance](#acceptance)
- [Non-Goals And Admission Boundary](#non-goals-and-admission-boundary)

## Decision

SynAIpse is Jamie's delivery control plane around Codex. Codex executes work;
SynAIpse supplies compact policy, evidence, authority, and feedback so Codex can
carry an idea to integrated main without asking Jamie for decisions that
standing policy or deterministic evidence can answer.

The lifecycle is:

```text
Shape -> Admit -> Build -> Prove -> Review -> Integrate -> Improve
```

The sole routine agent entrypoint is:

```bash
harness next --json
```

Other commands are internal lifecycle operations, bounded administration,
provider adapters, or temporary compatibility surfaces.

Linear issue `JSC-441` admits publication of the consolidation plan and Phase
0 characterization. It does not admit runtime deletion or refactoring; the
first implementation slice requires its own Linear admission and PR.

## Problem And Outcome

The 2026-07-11 audit found strong capabilities expressed through too many
surfaces: 84 commands, 19 commands on the default agent rail, two first-contact
commands, 25 packet schemas, undeclared writes in commands catalogued as safe
reads, phantom orchestrator names, historical route weight, stale downstream
versions, mixed CI migration declarations, and overlap with Codex-owned context
and memory.

SynAIpse must guide Codex through the full delivery job:

1. shape a falsifiable outcome;
2. admit merge-bound work and authority in Linear;
3. implement through target-repository truth;
4. prove behavior proportionately;
5. obtain independent review and resolve valid findings;
6. integrate current-SHA evidence under standing authority;
7. retain, change, consolidate, or delete harness mechanisms from observed
   results.

Jamie orchestrates goals, taste, priorities, public commitments, and Vital
Decisions. Codex owns ordinary engineering judgment, implementation,
validation, cleanup, and follow-through.

## Principles

1. Humans steer; agents execute.
2. Understand the problem before acting.
3. Thin surface, strong guardrails, durable memory.
4. Simplicity, maintainability, restraint, and `valuemaxxing`.
5. Proof beats assertion; current-SHA artifacts decide.
6. The builder is not the only grader for non-trivial work.
7. Repeated corrections become the smallest useful durable mechanism.
8. Delete or consolidate before adding commands, packets, providers, or docs.
9. Capabilities are admitted from project needs, not copied wholesale.
10. Every mechanism has a canary, measurement, rollback, and disposal path.

Primary metric: PR lead time from open to merge. Improvements must not weaken
review, evidence, privacy, security, or rollback.

## Ownership And Authority

### Codex owns

- reasoning, execution, tools, shell, filesystem, and git;
- sessions, resume, fork, archive, raw lifecycle, and native memory;
- sandbox controls, permissions, approvals, and workspace roots;
- plugins, skills, MCP, apps, and native review execution;
- interaction with Jamie.

### SynAIpse owns

- Jamie Core and its precedence;
- delivery stages and transition requirements;
- current-SHA evidence normalization;
- provider ownership and project adoption policy;
- the Vital Decision Gate and standing integration authority;
- feedback classification, canaries, measurement, and disposal;
- stable adapters that reduce ambiguity without copying Codex or providers.

### Target repositories own

- product, architecture, privacy, raw-source, and durable-knowledge truth;
- local `AGENTS.md`, `CODESTYLE.md`, validation wrappers, and rollback limits;
- stack-specific capabilities and accepted risk.

Precedence is:

```text
Jamie Core
  -> SynAIpse Baseline
    -> Target Repository Authority
      -> Task Contract
        -> Current Evidence
```

SynAIpse may classify and reference Codex or provider evidence. It must not
become the source of truth for the underlying session, review, CI run, Linear
issue, git state, or repository domain fact.

Higher-level policy may strengthen a local safety, evidence, or quality floor;
it may not weaken or overwrite repository-owned privacy, raw-source, durable
knowledge, domain, CODESTYLE, validation, or rollback constraints. A local
rule may specialize the mechanism while preserving the higher-level outcome.
An unresolved contradiction blocks the transition. Material conflicts route
through the Vital Decision Gate with both authorities and the smallest safe
options visible.

### Vital Decision Gate

Codex asks Jamie only when a decision materially changes:

- the outcome or a public commitment;
- destructive or difficult-to-reverse state;
- agent or external-system authority;
- recurring or material cost;
- privacy, security, legal, moral, or personal-value posture;
- a policy waiver or evidence exception;
- strategic architecture or public compatibility;
- a material trade-off that evidence and policy cannot resolve.

Ordinary reversible implementation, test, naming, refactor, tool, and repair
choices remain with Codex.

Codex may integrate only with standing project authority, current-SHA evidence,
satisfied admitted truth lanes, no unresolved Vital Decision, clear rollback,
and no rejecting independent review. Otherwise `next` requests the single
missing authority or evidence item.

## Lifecycle

| Stage | Required outcome |
| --- | --- |
| Shape | Problem, beneficiary, acceptance evidence, non-goals, constraints, smallest mechanism, alternatives, rollback, and Vital Decisions. Shape creates no routine backlog. |
| Admit | Linear issue or explicit exception, repository/branch/base, risk, authority, proof, independent review, rollback, and stop condition. |
| Build | Smallest reversible patch using target instructions, CODESTYLE, and repository wrappers while preserving unrelated work. |
| Prove | Risk-proportionate local, integration, product, CLI, artifact, or generated-output evidence with exact commands and current SHA. |
| Review | Current-SHA CodeRabbit review, valid-thread disposition, independent QA, normalized security findings, and residual risk. |
| Integrate | Current-SHA PR/check/signoff evidence, standing authority, observed merge, and separate main-sync proof. |
| Improve | Observation, classification, sibling scope, smallest response, canary, measurement, and retain/change/consolidate/delete outcome. |

Minimum transition behavior:

| Transition | Entry | Exit | Failure or stale route |
| --- | --- | --- | --- |
| Shape -> Admit | Falsifiable outcome and non-goals | Owner, authority, proof, rollback, and issue/exception recorded | Stay in Shape for missing outcome; ask Jamie only for a Vital Decision. |
| Admit -> Build | Current repo/base and admitted task | Bounded branch/work area and implementation authority | Return to Admit on scope, authority, or base drift. |
| Build -> Prove | Implemented bounded change | Required local evidence on current SHA | Return to Build on behavior or validation failure. |
| Prove -> Review | Required universal and admitted capability evidence | Review request bound to current SHA | Return to Build for defects; refresh Prove when evidence expires or SHA changes. |
| Review -> Integrate | Current-SHA CodeRabbit, QA, security, and thread disposition | Standing integration authority and all admitted lanes satisfied | Return to Build for findings; return to Prove/Review when SHA or provider evidence becomes stale. |
| Integrate -> Improve | Observed merge and separate main-sync state | Improvement observation and disposition recorded | Block on uncertain merge/main state; do not infer it from checks. |
| Improve -> Shape | Prior mechanism retained, changed, consolidated, deleted, or explicitly blocked | New idea may enter Shape with relevant learning refs | A no-change disposition is valid; unclassified feedback remains visible and blocks closing the prior loop. |

Universal evidence is repository identity, current SHA where git exists,
authority, exact command outcomes, claim boundary, and rollback. Provider,
product, UI, deployment, and language evidence is required only when the
project admits that capability. Freshness is owned by the source contract;
absent source-specific policy, a SHA change invalidates code/review evidence
and external evidence must be refreshed in the same transition window.

## Canonical Contracts

A compatibility adapter may emit an internal fragment for a canonical builder,
but a target-contract label does not make that fragment a canonical record.
Every emitted canonical record must contain the full owning contract and pass
its owning validator. Internal fragments do not use a new public
`synaipse-*` schema version unless a separately admitted external consumer,
ownership decision, migration, verifier, canary, rollback, and retirement path
justify that contract.

### `synaipse-state/v1`

Compact state emitted by `next`: repository, branch/base/SHA, stage, task,
authority, truth-lane blockers, admitted capabilities, evidence refs, one next
action, invocation effects, freshness, and claim boundary.

### `synaipse-transition/v1`

One transition decision: from/to stage, repository/SHA, evidence admitted and
rejected, policy, authority, blockers, waivers, decision time, and recovery.

### `synaipse-improvement-case/v1`

Observation, local/systemic classification, sibling inventory, candidates
including deletion, selected mechanism, canary, measurement, disposition,
owner, and retirement condition.

### `synaipse-project-adoption/v1`

Canonical repo identity, contract and installed versions, policy digests,
cold-start result, admitted capabilities, CI/review/tracker/security/signoff
ownership, canary, rollback, drift, and next action. Directory presence is not
adoption proof.

### `synaipse-security-finding/v1`

Repository/SHA, provider, underlying finding identity, owner class, severity,
confidence, likelihood of exploitation, lifecycle, one blocking owner, corroboration,
evidence, suppression authority/expiry, Linear promotion, and disposition. One
underlying finding creates at most one Linear issue.

### `synaipse-signoff/v1`

Repository/SHA, `signoff/local|product|qa`, actor or lane, receipt, exact
validation, status, time, and supersession rule.

### Context contracts

- `synaipse-context-catalog/v1`: project-scoped context metadata, not document
  bodies.
- `synaipse-context-ref/v1`: stable ID, kind, authority, privacy, lifecycle,
  stages, requirement, provider, digest, and freshness.
- `synaipse-task-context/v1`: Admit-time snapshot of project/task identity,
  base SHA, outcome, non-goals, selected refs/digests, proof, privacy, Vital
  Decisions, and refresh triggers.

## Agent Interface

`harness next --json` must:

1. work for cold, resumed, and partially adopted repositories;
2. return one next action rather than a menu of overlapping diagnostics;
3. degrade missing integrations to explicit unknown or blocked states;
4. declare `pure_read`, `writes_artifact`, `writes_repository`, `mutates_git`,
   and `mutates_external` effects for the exact invocation;
5. name required authority, rollback, expected evidence, and retry policy;
6. keep raw provider detail behind compact references.

The command catalog remains administrative discovery. Diagnostics become pure
by default where practical; artifact production is explicit or an internally
governed lifecycle operation.

## Universal Context Plane

SynAIpse selects context; Codex retrieves it through native filesystem,
connector, plugin, or app capabilities. SynAIpse does not build another search
engine unless a measured canary proves a missing Codex capability.

The four planes are:

| Plane | Question | Canonical owner |
| --- | --- | --- |
| Project identity | What canonical project exists? | Jamie Brain `operating-system/projects.yaml`; no second registry. |
| Context catalog | What context exists and what may it support? | Governed Jamie Brain catalog metadata; project cards remain concise human summaries. |
| Resolution | What applies to this project, task, stage, privacy boundary, and authority now? | SynAIpse stage-aware selector plus provider adapters. |
| Task snapshot | What governed this admitted task? | `synaipse-task-context/v1` in the private context provider, referenced by logical ID/digest. |

Context kinds include operator intent, project direction, taste example,
accepted decision, specification, implementation plan, task snapshot, research
index, source evidence, review learning, delivery receipt, historical
provenance, public-safe proof, and private context. Authority is separate:
operator intent, repository authority, accepted task contract, work ownership,
architecture decision, supporting evidence, runtime evidence, historical
provenance, or generated projection.

Each context ref declares `public`, `internal`, `confidential`, or `restricted`
privacy plus allowed consumers and prohibited destinations when needed. Local
agents receive only task-admitted context. Remote agents receive approved
redacted projections. Hosted CI never requires private Jamie Brain content.
Private project context does not enter public PRs or proof by default.

Resolution flow:

```text
next -> canonical project ID -> lifecycle stage -> catalog
  -> authority/privacy/freshness selection -> Codex retrieval
  -> bounded refs in synaipse-state/v1 -> one next action
```

Required unavailable context blocks. Optional unavailable context becomes an
explicit unknown. The resolver distinguishes missing identity/catalog/context,
access denied, stale digest, superseded context, malformed catalog, provider
unavailable, and unresolved host path, each with one deterministic recovery.

Dependency direction:

- product repositories contain logical project/context refs, never Jamie-local
  absolute paths or private bodies;
- SynAIpse reads the registry/catalog and selects refs;
- Codex reads selected sources;
- snapshots reference sources immutably;
- target repositories remain executable truth and build independently of Jamie
  Brain;
- KnowledgeOS remains source/research evidence; Linear remains active work
  ownership; generated bundles never become canonical.

The first context slice is additive and read-only: extend the existing registry,
admit a governed catalog family through Jamie Brain CODE_TREE/governance, add
one coding-harness catalog, resolve it, and emit one task snapshot. Move no
existing documents. Physical migration requires a full caller map, privacy
tests, multi-project canaries, rollback, and separate authority.

### GitBook publication contract

Every canonical project must expose a GitBook-compatible public documentation
entrypoint in its target repository or record an explicit, evidence-backed
non-public exception. This is an adoption requirement, not permission to copy
one universal documentation tree into every repository.

The target repository owns the documentation source and navigation. CircleCI
owns documentation validation. A minimal GitHub Action may synchronize to
GitBook only when GitBook's repository integration requires it and it does not
duplicate general validation. Each publication receipt records project ID,
source repository, source revision, selected public paths, privacy decision,
publication target, result, and rollback.

Publication must exclude Jamie Brain project context, private intent, plans,
task snapshots, raw sources, secrets, private provider data, local absolute
paths, and claims lacking public-safe evidence. Product builds and hosted CI
must not require GitBook or Jamie Brain to be available. A successful
publication does not prove validation, review acceptance, mergeability, or
deployment health.

## Provider Ownership

| Concern | Owner | Boundary |
| --- | --- | --- |
| General PR build/test/policy/local-security CI | CircleCI | Sole general pipeline owner. |
| Public code scanning | CodeQL in minimal GitHub Actions | Only when applicable. |
| Trusted publishing | Minimal GitHub Actions when required | No duplicate PR validation. |
| Merge-bound work | Linear | Create at Admit; keep tracker truth separate. |
| External review | CodeRabbit | Required on current SHA with thread disposition. |
| Secrets | `Betterleaks` using current Gitleaks config | Standalone Gitleaks is a time-bounded rollback path. |
| SAST and Jamie static policy | Semgrep | Own blocking static/policy findings. |
| Dependency, OS, container, IaC, license, SBOM | Trivy | Disable duplicate secret scanning. |
| Prioritization and unique admitted classes | Aikido | Advisory by default; only admitted unique critical classes block. |
| Local/product/QA status | Constrained `gh-signoff` adapter | Bind to SHA; prohibit `-f`, `install`, and `uninstall`. |

The target repository owns merge-policy intent, GitHub owns observed
branch-protection and ruleset state, and SynAIpse may normalize, verify, or
apply that policy only under admitted external-mutation authority. Provider
fallback must be pre-authorized or treated as a Vital Decision.

## Jamie Core

Jamie Core encodes: problem understanding, thin surface, strong guardrails,
durable memory, simplicity, maintainability, `valuemaxxing`, taste, restraint,
evidence over confidence, misses into ratchets, deletion before addition, and
Jamie's personal standards of moral courage, self-discipline, respect,
integrity, loyalty, and selfless commitment.

Taste is enforced through compact positive/negative examples, change-budget
signals, independent Shape/Review judgment, and observed outcomes—not a large
subjective rules engine. Waivers require authority, scope, reason,
compensation, expiry, and retirement.

## Adoption And Improvement

Adoption follows:

```text
diagnose -> propose -> admit -> reversible patch -> validate
  -> canary -> measure -> retain/change/delete
```

Universal core: Jamie Core, lifecycle contracts, truthful effects, `next`,
validation discovery, logical project/context resolution, authority/evidence
boundaries, improvement, and rollback.
CI jobs, UI proof, language tooling, publishing, Project Brain, browser,
deployment, and production capabilities remain optional.

Mandatory v1 canary order:

1. `coding-harness` self-host;
2. `brainwav.io`;
3. `agent-skills`;
4. `skillsbar` native-application context canary;
5. `knowledge-OS` or `jamie-brain` maintained-wiki/privacy canary;
6. a new minimal repository;
7. private `x-writer` only under its explicit private-work boundary;
8. every remaining existing canonical repository.

Missing registry paths and duplicate identities must be reconciled before the
portfolio canary claim. V1 does not close with only representative canaries;
representative canaries control sequencing, while every canonical project must
record an accepted adoption or explicit non-adoption decision with evidence.

The improvement loop is:

```text
Observe -> Classify -> Scope -> Choose -> Canary -> Measure -> Dispose
```

Raw comments, telemetry, logs, and model reflection are evidence, not authority.
Candidate mechanisms must include deletion and consolidation. Measure PR lead
time, rework, Jamie interventions, evidence quality, context cost, rollback,
routine command count, packet count, required files, and provider overlap.

## Consolidation Targets

These are migration targets, not immediate deletion authority:

The command-by-command and code-tree disposition ledger lives in
`.harness/research/audits/2026-07-11-synaipse-consolidation-and-codex-boundary-audit.md`.
That audit is the implementation decision input for keep, deepen, merge,
delegate, extract, and delete work; this specification remains the canonical
product and authority contract.

| Surface | Target | Retirement proof |
| --- | --- | --- |
| `orient` | Absorb cold start into `next`; deprecate then remove | Catalog/downstream callers and cold/resumed canaries. |
| `check`, `doctor`, `health`, `audit` | Route behind `next`; retain bounded diagnostics | Effect contract and characterization. |
| Command-level mutability | Invocation-level effects | Write tracer and negative tests. |
| `pr-ready`, `fix-review`, `learn` metadata | Lifecycle-stage ownership | Registry consumers and compatibility test. |
| Five agent-native packet families | Project into complete state/transition/improvement records | Deterministic source/generated-consumer map, production adapter path, owning canonical validator, package/downstream canaries, and before/after surface measurement. |
| Harness context/search family | Quarantine against Codex-native capability | Proved distinct repository outcome. |
| Interactive Linear CLI overlap | Prefer plugin; retain CI linkage gate | Provider parity and CI/offline proof. |
| Snyk | Replace with Trivy/Aikido ownership | No lost admitted finding class. |
| Historical active-route prose | Compact current route; history by reference | Route callers, restart canary, provenance, rollback. |
| Duplicate project identities and stale pins | One canonical identity/version source | Filesystem, install, and package canaries. |

Deletion requires owner, public surface, caller/generated-consumer search,
replacement, migration, verifier, downstream canary, rollback, and independent
QA. The decision consumes current-SHA-bound evidence references for those lanes;
unverified caller assertions or success booleans are not deletion proof.
Unknown callers, public compatibility, raw sources, durable private knowledge,
or external state block deletion.

## Acceptance

- Every recommended invocation declares effects accurately; undeclared writes
  fail deterministic tests.
- Cold and resumed Codex obtain one safe action from `next`.
- Every stage transition is schema-valid and current-SHA bound.
- Legacy packet migration proves a real producer-to-canonical-consumer path;
  registry declarations and target labels alone are insufficient.
- Ordinary implementation proceeds without Jamie; Vital Decisions stop with
  one bounded request and recommendation.
- CodeRabbit and independent QA remain separate from builder assertions.
- Duplicate security reports normalize to one finding and blocking owner.
- Integration requires standing authority, current evidence, and observed main
  sync.
- Each improvement records retain, change, consolidate, delete, or a blocker
  with revisit condition.
- Consolidation records before/after command and packet visibility,
	  migrated-consumer coverage, packet-catalog context bytes, and packet-command
	  choice without introducing an unadmitted replacement packet. Historical
	  values are extracted from the exact source catalog and bind its source
	  commit and command, schema version, command count, normalized byte length,
	  full-catalog digest, extraction rule, exact raw subset, and subset digest;
	  self-consistent caller-authored replacement evidence is rejected.
- A minimal repository adopts the universal core without copying this repo.
- Codex source and installed runtime evidence remain separate; private Codex
  implementation paths are not dependencies.
- An unfamiliar agent resolves current accepted context, excludes unrelated
  private context, stops for missing required context, continues for missing
  optional context, and leaves a reproducible task snapshot.
- Product build and hosted CI succeed without Jamie Brain availability.
- Each canary can remove SynAIpse without damaging repository-native authority.
- Every canonical project has an accepted adoption or explicit non-adoption
  record; representative canaries alone do not satisfy the portfolio outcome.
- Each adoption record classifies its GitBook route as observed publication,
  configured but unobserved, blocked with reason, or explicitly non-public.

## Non-Goals And Admission Boundary

SynAIpse does not rebuild Codex, memory, review, Linear, CircleCI, CodeRabbit,
or security platforms; install every capability everywhere; treat `.harness`
presence as adoption; migrate all projects at once; or preserve surface area as
progress.

This specification records the accepted architecture. It does not replace the
current JSC-363 route, mutate Linear/providers/branch protection, prove hosted
or portfolio state, or authorize deletion before its proof conditions hold.
Implementation begins with truthful invocation effects after separate Linear
and route admission.
