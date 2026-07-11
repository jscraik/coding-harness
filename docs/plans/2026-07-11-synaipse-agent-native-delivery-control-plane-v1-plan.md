---
doc_schema: coding-harness-doc/v1
doc_type: governance
authority: supporting
canon_class: supporting
distribution: source-only
audience:
  - coding-harness-maintainer
  - codex-agent
  - reviewer
lifecycle_state: active
owner: coding-harness-maintainers
created: 2026-07-11
last_reviewed: 2026-07-11
review_cadence: on-change
maintenance_trigger:
  - synaipse-implementation-sequence-change
  - canary-order-change
  - retirement-gate-change
semver_impact: minor
validated_by:
  - pnpm docs:lifecycle
  - bash scripts/run-harness-gate.sh docs-gate --mode required --json
depends_on:
  - docs/specs/2026-07-11-synaipse-agent-native-delivery-control-plane-v1-spec.md
title: SynAIpse Agent-Native Delivery Control Plane v1 Implementation Plan
type: architecture
status: accepted
date: 2026-07-11
spec: ../specs/2026-07-11-synaipse-agent-native-delivery-control-plane-v1-spec.md
risk: high
last_validated: 2026-07-11
---

# SynAIpse Agent-Native Delivery Control Plane v1 Implementation Plan

## Table of Contents

- [Objective And Boundary](#objective-and-boundary)
- [Execution Rules](#execution-rules)
- [Slices](#slices)
- [Validation And QA](#validation-and-qa)
- [Rollback And Escalation](#rollback-and-escalation)
- [Exit Condition](#exit-condition)

## Objective And Boundary

Implement the accepted specification as reversible, independently provable
slices. Repair truthful agent effects and establish one routine cockpit before
consolidating packets, reducing historical context, or rolling out broadly.

This plan is not the current Goal Governor route and creates no tracker or
provider state. Before runtime implementation:

1. reconcile the existing JSC-363 route;
2. create or select one Linear parent for SynAIpse v1;
3. admit only the first merge-bound slice;
4. branch from current `main` using its Linear key;
5. capture command, packet, context, provider, downstream-version, and Codex
   source/runtime baselines.

Later slices enter Admit from preceding evidence. Do not create a speculative
issue tree.

## Execution Rules

- Target `harness next --json` as the operator journey while compatibility
  commands remain callable.
- Prefer additive contracts and adapters before interface removal.
- Every new surface absorbs an older surface or proves a distinct outcome.
- Preserve local, product, CI, review, tracker, merge, main-sync, and adoption
  truth as separate lanes.
- Do not mutate downstream repositories from a source-repository slice.
- Do not let the builder be the only grader.
- Stop at the first failed safety or contract gate and classify ownership.

## Slices

### 0. Admit and baseline

Reconcile JSC-363, admit the first Linear slice, canonicalize project identities,
and record current command/packet/context/provider/downstream/Codex measurements.
No runtime behavior changes.

Proof: tracker/branch refs, exact-command baseline, and explicit claim boundary.

### 1. Truthful invocation effects

Add invocation effects:

```text
pure_read | writes_artifact | writes_repository
mutates_git | mutates_external
```

Each recommended invocation names targets/provider class, authority,
retry policy, rollback, and expected evidence. Characterize and correct
`doctor`, `docs-gate`, `contract`, `context-health`, `workflow:generate`,
`pattern-scope`, `drift-gate`, `check-environment`, UI evidence,
`review-context`, and `linear-gate`. Diagnostics become pure by default where
practical; artifact output becomes explicit.

Proof: current write-path characterization, negative undeclared-write tests,
catalog tests, `next` effect tests, and a read-only temporary-repo probe.

Rollback: remove the projection while retaining characterization tests and
legacy execution.

### 2. One routine cockpit

- Fold minimal cold-start orientation into `next`.
- Emit `synaipse-state/v1`.
- Remove `orient` from first-contact discovery but keep compatibility.
- Replace phantom orchestrators with lifecycle-stage ownership.
- Keep `commands --json` as administration.

Proof: cold, resumed, partial-adoption, dirty-worktree, missing-provider,
malformed-evidence, help/catalog, source, package, and downstream scenarios.

### 3. Lifecycle and authority

- Add `synaipse-transition/v1` and `synaipse-improvement-case/v1`.
- Encode stage entry/exit, current-SHA binding, standing authority, Vital
  Decisions, waiver expiry, and recovery.
- Make `next` interrupt Jamie only at the Vital Decision Gate.

Proof: positive/negative transition matrix, stale SHA, missing evidence,
unauthorized integration, ordinary-choice autonomy, and policy-waiver stop.

### 4. Universal context plane

- Extend the existing Jamie Brain project registry additively; create no second
  registry.
- Define context kinds, authority, privacy, lifecycle, failures,
  `synaipse-context-catalog/v1`, `synaipse-context-ref/v1`, and
  `synaipse-task-context/v1`.
- Admit the catalog family through Jamie Brain CODE_TREE/governance and add one
  coding-harness catalog linked from its existing project card.
- Build a read-only resolver, freeze one Admit task snapshot, and project refs
  through `synaipse-state/v1` without another general search command.
- Move no existing documents in this slice.
- Admit `00-LLM Wiki/project-context/coding-harness/` as confidential catalog
  metadata; keep all publication inputs in the coding-harness repository.

Proof: unfamiliar-agent resolution, current/historical distinction,
required/optional failure behavior, stale/superseded detection, privacy and
remote-destination rejection, shared-workspace visibility, host resolution,
developer/CI independence, and code/native/knowledge/minimal/private canaries.

### 4A. GitBook projection baseline

- Define the smallest GitBook-compatible repository documentation entrypoint,
  navigation file, public-path allowlist, privacy check, source-revision
  receipt, and rollback contract.
- Configure coding-harness as the first publication canary only after CircleCI
  documentation validation and public-safety checks pass.
- Use GitBook's native repository integration when sufficient. Add a minimal
  GitHub synchronization action only when required and never duplicate the
  general CircleCI pipeline.
- Record publication truth separately from CI, CodeRabbit, sign-off, merge, and
  deployment truth.
- Roll the same contract through the canonical canary order; permit explicit
  non-public exceptions for private projects instead of publishing private
  context.

### 5. Packet consolidation

Map producers and consumers of the five agent-native packet families, project
useful fields into the canonical contracts, add compatibility adapters, and
remove standalone packet commands from the agent rail.

Proof: schema/type validation, source/package behavior, downstream canary, and
outcome-based evals. Delete legacy schemas/generator branches only after caller,
canary, rollback, and independent-QA evidence.

### 6. Route and context reduction

Generate one compact current route, keep receipts outside default context,
replace embedded PR chronology with refs, and make archive candidacy depend on
the active graph. Quarantine harness context/search pending comparison with
Codex-native capability.

Proof: cold/restart canaries, history lookup, stale-route negatives, context
size and next-action comparison, and separate Codex source/runtime evidence.

### 7. Provider ownership and sign-off

- CircleCI owns general PR validation.
- GitHub Actions retains admitted CodeQL and trusted publishing only.
- Linear plugin owns interaction; CI owns deterministic linkage.
- CodeRabbit owns current-SHA external review.
- `Betterleaks` uses current Gitleaks config.
- Semgrep, Trivy, and Aikido receive non-overlapping classes.
- `synaipse-security-finding/v1` consolidates duplicate findings.
- The `gh-signoff` adapter emits `synaipse-signoff/v1` and prohibits `-f`,
  `install`, and `uninstall`.
- Snyk overlaps replacements before retirement.

Proof: ownership tests, duplicate-finding fixture, stale-SHA sign-off rejection,
branch-protection diff/rollback, and provider-outage scenarios.

### 8. Self-host and canaries

Use the specification's mandatory v1 canary order; do not restate or reorder it
in this plan.

Each canary requires zero-install diagnosis, admitted capabilities, dry-run and
rollback, local-authority preservation, provider evidence, cold-start `next`,
independent QA, `synaipse-project-adoption/v1`, and an improvement disposition.
The named canaries are mandatory sequencing gates. Continue through every
remaining existing canonical repository and record accepted adoption or
explicit non-adoption; reconcile missing paths and duplicate identities before
the portfolio claim.

### 9. Retirement

Candidate queue: `orient`, redundant routine diagnostics, legacy packet
families, phantom orchestrators, unjustified context/search, interactive Linear
overlap, Snyk surfaces, historical default-context prose, duplicate project
identities, stale package fallbacks, and GitHub Actions duplicated by CircleCI.

Each deletion records owner/public surface, caller/generated-consumer search,
replacement, migration, verifier, canary, rollback, independent QA, and retained
siblings. Unknown callers or durable/private boundaries block deletion.

## Validation And QA

For each slice:

1. `pnpm run coding-policy:route -- <files>`;
2. focused unit/policy checks;
3. changed schema/docs validators;
4. `bash scripts/validate-codestyle.sh --fast`;
5. `pnpm run test:related` for production source;
6. `pnpm check` before PR handoff;
7. `pnpm test:deep` for runtime, CLI, artifact, generated, or operator behavior;
8. source-checkout product probe;
9. package/downstream canary for public or portability changes;
10. separate hosted CI, CodeRabbit, review-thread, Linear, merge, and main-sync
    refreshes.

If an exact path cannot run, record the blocker and nearest fallback without
promoting the fallback claim.

Independent QA must try to falsify effects, SHA binding, Vital Decision routing,
compatibility, local-authority preservation, rollback, deletion safety, and
claimed reductions in decision/context burden. CodeRabbit remains external
review and does not replace product-path QA.

## Rollback And Escalation

- Keep previous readers until admitted consumers migrate.
- Preserve one bounded deprecation window unless evidence supports less.
- Record restoration commands or revert commits for provider/protection work.
- A canary must be removable without deleting native instructions, CODESTYLE,
  CI, domain docs, or raw/durable knowledge.

Codex decides ordinary implementation and recovery. Ask Jamie one bounded
question only for public compatibility removal without migration proof,
destructive durable state, security/privacy/legal/values/provider authority,
recurring cost, policy waiver, merge authority, or unresolved strategic
architecture conflict.

## Exit Condition

Close the v1 migration only when the universal core operates through `next`,
effects and transitions are truthful/current-SHA bound, provider ownership has
no ungoverned blocking overlap, all named and remaining canonical-project
canaries have accepted adoption or explicit non-adoption evidence, every legacy
surface has a disposition, metrics are compared with baseline, and hosted
truth lanes have current evidence.
