---
schema_version: 1
lifecycle_schema: harness-document-lifecycle/v1
artifact_id: evidence-led-codebase-gap-audit-2026-06-30
artifact_type: research-audit
canonical_slug: evidence-led-codebase-gap-audit
title: Evidence-Led Codebase Gap Audit and Graded Fix Plan
status: active
date: 2026-06-30
source_type: research
authority: secondary-context
lifecycle_status: reviewed
canonical_destination: docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md
owner: coding-harness-maintainers
created: 2026-06-30
last_reviewed: 2026-06-30
review_cadence: on-change
validated_by:
  - pnpm run contracts:runtime-packets
  - pnpm run architecture:check
  - pnpm run harness:audit-tracking -- --json
  - pnpm run agent-native:ratchets
known_failed_evidence:
  - pnpm run prompt-context-drift:validate
  - pnpm exec harness next --mode orient --json
depends_on:
  - .harness/research/deep/2026-06-30-tessl-agent-evidence.md
---

# Evidence-Led Codebase Gap Audit and Graded Fix Plan

Generated: 2026-06-30

Target root: /Users/jamiecraik/dev/coding-harness

Comparison evidence: .harness/research/deep/2026-06-30-tessl-agent-evidence.md

Primary skills used: improve-agent-native, improve-codebase-architecture

Evidence window: audit command evidence was gathered during the 2026-06-30 audit pass before final git cleanup. Final closeout state was main at 54c6532cd with local artifact changes still unstaged. The validation tables below distinguish audit findings from final artifact-format validation.

Audit method: static code and contract inspection plus focused command validation. This audit does not claim CI, review-thread, tracker, branch, package-publication, or merge-readiness truth.

## Table of Contents

- [1. Executive Summary](#1-executive-summary)
- [2. Overall Gradecard](#2-overall-gradecard)
- [3. Evidence-to-Code Mapping](#3-evidence-to-code-mapping)
- [4. Gap Register](#4-gap-register)
- [5. Contradictions](#5-contradictions)
- [6. Missing Features](#6-missing-features)
- [7. Fix Roadmap](#7-fix-roadmap)
- [8. Highest-Leverage Fixes](#8-highest-leverage-fixes)
- [9. Implementation Advice](#9-implementation-advice)
- [10. Final Recommendation](#10-final-recommendation)

## 1. Executive Summary

Overall maturity grade: B, 78 out of 100.

Confidence: High for repo-local contracts, scripts, command registry, runtime-packet schemas, architecture check, and prompt-context drift validation because these were inspected and command-tested in the audit evidence window. Medium for CI reachability and hosted branch protection because this audit did not query GitHub branch settings or live CI. Medium for end-to-end autonomous loop maturity because the repo has many pieces, but the audit did not run a full PR lifecycle.

The codebase is materially agent-native. It is not just prompt prose around a normal TypeScript CLI. The repository has a command registry, public harness CLI entrypoint, runtime packet manifests, JSON Schemas, architecture validation, coding-policy routing, audit tracking, ratchet packets, review and closeout doctrine, and explicit claim-boundary enforcement. Those are strong foundations for the Tessl-agent pattern of turning repeated human-agent work into executable loops.

The main weakness is not absence of harness machinery. The main weakness is contract drift between doctrine, docs, manifests, CI references, and live command behavior. Some surfaces are excellent when invoked directly, but not all of them are wired into the default static gate. Some docs still point at stale command shapes. Prompt-context drift validation is currently failing against live repository state. Architecture metadata references an absent GitHub workflow even though the actual local architecture checker passes. Those are exactly the failures an agent-native system should make impossible or self-healing.

Top 5 gaps:

1. Prompt-context drift is stale against live HEAD, so a key agent-readiness cockpit surface currently fails validation.
2. CI and architecture contract references drift: harness.contract.json and .architecture.yml still name pr-pipeline or .github workflow paths that are not present in this checkout.
3. CLI documentation exposes an invalid next rail shape: docs describe harness next --mode orient, while the live CLI rejects orient and the valid orient rail lives under harness commands --json --for-agent --mode orient.
4. Agent-native ratchet and prompt-context checks exist, but prompt-context validation is not part of package.json check:static and ratchet generation is a separately invoked script rather than an always-on static gate.
5. The root AGENTS.md is doing too much policy work in one loaded surface, despite repo codestyle saying root/front-door docs should stay compact and route details into focused modules.

Top 5 risks:

1. False orientation confidence: an agent can read strong doctrine while stale prompt-context evidence fails the actual validator.
2. Broken operator rails: docs can send agents to a command that returns a structured invalid_mode block instead of the intended orientation rail.
3. Required-check ambiguity: required check names can exist in governance contracts without a current local workflow/job source.
4. Advisory packet over-credit: agent-native ratchets are explicitly advisory, but they can look like proof if closeout synthesis does not preserve their claim boundary.
5. Policy accretion: dense root instructions may improve discipline for experts while increasing cold-start load and inconsistency for future agents.

Strongest foundations:

1. Claim-boundary doctrine is explicit: AGENTS.md separates local code/test truth, PR state, CI, review threads, tracker state, artifacts, and merge readiness.
2. Runtime packet schemas are real contract surfaces: the validator checks 25 packet entries and forbids delivery/readiness claims such as ci_passed, tracker_closed, and merge_ready.
3. Agent-native ratchet packets encode allowed claims, forbidden claims, authority, evidence paths, and next moves.
4. The CLI exposes machine-readable command discovery and structured invalid-command output.
5. Architecture enforcement has an executable checker that passed in this audit, with baselined warnings reported explicitly.

Highest-leverage fixes:

1. Refresh and then gate prompt-context drift evidence so stale HEAD/hash drift is detected before agent-readiness claims.
2. Add a CI-required-check parity validator that maps required check names to actual CircleCI or GitHub workflow/job sources.
3. Fix docs/cli-reference.md to route orientation mode through harness commands --json --for-agent --mode orient, or teach harness next to support orient if that is the intended contract.
4. Add prompt-context-drift:validate and agent-native:ratchets, or a bounded combined agent-native contract check, to check:static.
5. Split high-churn operating doctrine out of AGENTS.md into focused docs already referenced by the instruction map, then add a doc-size or router-density guard.

Validation evidence gathered during this audit:

| Command | Outcome |
|---|---|
| git status --short --branch | pass; audit evidence window showed detached HEAD with untracked .harness/research/deep/2026-06-30-tessl-agent-evidence.md |
| pnpm run contracts:runtime-packets | pass; runtime-packet-schema-validation/v1, packetCount 25, errors empty |
| pnpm run architecture:check | pass; 4 baselined architecture warnings, 0 errors |
| pnpm run harness:audit-tracking -- --json | pass; harness-audit-tracking/v1 failures empty |
| pnpm run agent-native:ratchets | pass; agent-native-ratchets/v1 emitted and validated |
| pnpm run prompt-context-drift:validate | fail; digest mismatches and currentHeadSha mismatch |
| pnpm run coding-policy:route:changed | pass; changed Markdown routed to foundations and docs-config-release modules |
| pnpm exec harness next --mode orient --json | fail; exit 2, invalid_mode, supported modes local, pr, ci |
| pnpm exec harness commands --json --for-agent --mode orient | pass; emitted orient rail command catalog |

Final artifact closeout evidence:

| Command | Outcome |
|---|---|
| git rev-parse --abbrev-ref HEAD | pass; main |
| git rev-parse --short HEAD | pass; 54c6532cd |
| git status --short --branch | pass; main...origin/main with local artifact changes unstaged |

## 2. Overall Gradecard

| Area | Grade | Confidence | Current Status | Main Gap | Recommended Fix |
|---|---:|---|---|---|---|
| Repository as control plane | A- | High | Strong AGENTS, CODESTYLE, harness.contract.json, command registry, Project Brain, scripts, schemas, and audit tracking. | Some front-door doctrine is too dense and not all high-value agent-native checks are always on. | Compact AGENTS.md and add an agent-native static lane. |
| Runtime truth and decision packets | B+ | High | runtime-packet manifest covers 25 packets; validator passed. | Several future packets remain not_yet_emitted and prompt-context validation fails separately. | Keep not_yet_emitted explicit and gate emitted cockpit evidence freshness. |
| Claim-vs-evidence verification | A- | High | Forbidden claim lists exist in validators and ratchet writer; PR template demands exact evidence. | Advisory packet outputs can still be misunderstood if closeout synthesis ignores authority. | Add claim-boundary tests that consume generated ratchets and PR closeout together. |
| Mechanical architecture enforcement | B | High | scripts/check-architecture-rules.cjs passed with baselined warnings. | .architecture.yml comments reference absent GitHub workflow and diagram path. | Replace stale comments with actual checker authority and add CI-name parity validation. |
| Harness runtime loop | B | Medium | next, orient, runtime-card, session-context, session-distill, agent-rework, reviewer-decision, governance-decision-surface exist as commands or packet surfaces. | No single loop owns retry budget, verifier assignment, stop reason, and recovery dispatch end to end. | Introduce or promote a run-loop/v1 packet from existing runtime-card and agent-rework data. |
| Trace and session evidence | B | Medium | session-context/v1 is emitted and appears in the orient command catalog. | Prompt-context evidence is stale and replay-packet remains not_yet_emitted. | Refresh prompt-context drift and add replay packet only after session-context adoption is measured. |
| Context engineering | B- | Medium | coding-policy routing, Project Brain, prompt-context drift, Local Memory doctrine, and command catalog exist. | Context freshness validator is failing locally; root docs are too heavy. | Fix prompt-context evidence first, then add context-health to check:static. |
| Skills and workflow density | B | Medium | Repo-local skills exist and skill validation is in check:static. | Skill overlap and command reachability are not fully measured by cli-json-contracts manifest. | Expand CLI JSON contract manifest and add skill-density/reachability checks. |
| Recovery and failure handling | B | Medium | agent-rework packet and repeated-error doctrine exist. | Recovery classification is more documented than centrally orchestrated. | Add a compact recovery-state artifact generated by verify-work or agent-rework. |
| Governance and safety | B+ | High | Strong safety floor, separate truth lanes, branch protection contracts, PR template, audit tracking. | Required check names drift from available local workflow evidence. | Implement CI required-check source parity before changing more governance prose. |

## 3. Evidence-to-Code Mapping

Allowed Runtime Status values: implemented_enforced, implemented_not_enforced, documented_only, scaffolded, partial, contradicted, missing, unreachable, overbuilt.

| Evidence Pattern | Source File | Code Location | Runtime Status | Grade | Confidence |
|---|---|---|---|---|---|
| Agent work should be routed through a control plane, not raw prompt execution. | .harness/research/deep/2026-06-30-tessl-agent-evidence.md | src/cli.ts; src/lib/cli/registry/**; docs/cli-reference.md | implemented_enforced | A- | High |
| Repeated human steering should become durable repo machinery. | .harness/research/deep/2026-06-30-tessl-agent-evidence.md | AGENTS.md; CODESTYLE.md; scripts/validate-evidence-patterns.cjs; .harness/research/evidence-patterns.json | partial | B | High |
| Claim boundaries should be mechanical, not just social. | .harness/research/deep/2026-06-30-tessl-agent-evidence.md | scripts/validate-runtime-packet-schemas.cjs; scripts/write-agent-native-ratchet-report.cjs; contracts/runtime-packet-schemas.manifest.json | implemented_enforced | A- | High |
| Advisory cockpit evidence must not collapse into delivery truth. | .harness/research/deep/2026-06-30-tessl-agent-evidence.md | scripts/write-agent-native-ratchet-report.cjs; contracts/agent-native-ratchets.schema.json; .github/PULL_REQUEST_TEMPLATE.md | implemented_enforced | A- | High |
| Agent context should be compact and route-specific. | .harness/research/deep/2026-06-30-tessl-agent-evidence.md | src/commands/orient.ts; src/lib/orient/**; src/lib/cli/registry/** | partial | B | High |
| Runtime artifacts should validate their own schemas. | .harness/research/deep/2026-06-30-tessl-agent-evidence.md | contracts/runtime-packet-schemas.manifest.json; contracts/*.schema.json; scripts/validate-runtime-packet-schemas.cjs | implemented_enforced | A- | High |
| Architecture boundaries should be executable. | .harness/research/deep/2026-06-30-tessl-agent-evidence.md | .architecture.yml; scripts/check-architecture-rules.cjs; package.json architecture:check | partial | B | High |
| Context freshness should be checked before trust. | .harness/research/deep/2026-06-30-tessl-agent-evidence.md | scripts/write-prompt-context-drift-report.cjs; scripts/validate-prompt-context-drift.cjs; artifacts/context-integrity/prompt-context-drift-report.json | contradicted | D | High |
| Tooling affordances should match documentation. | .harness/research/deep/2026-06-30-tessl-agent-evidence.md | docs/cli-reference.md; src/commands/next.ts; src/lib/cli/registry/** | contradicted | C | High |
| Governance contracts should map to live CI sources. | .harness/research/deep/2026-06-30-tessl-agent-evidence.md | harness.contract.json; .architecture.yml; .circleci/config.yml; .github/** | partial | C+ | Medium |

## 4. Gap Register

### GAP-001: Prompt-context drift evidence is stale against live HEAD

**Category:** context / validation

**Current State:** Prompt-context drift report generation and validation scripts exist, but the current report failed validation against live repository state.

**Expected State:** Agent-readiness context reports should either be refreshed before consumption or fail closed with an explicit stale-state repair command.

**Evidence Basis:** The Tessl-agent evidence emphasizes observable loops and verifier layers that detect stale or incorrect agent context before the loop trusts it.

**Code Evidence:** AGENTS.md prompt-context drift contract; package.json prompt-context-drift:write and prompt-context-drift:validate; scripts/write-prompt-context-drift-report.cjs; scripts/validate-prompt-context-drift.cjs; command evidence: pnpm run prompt-context-drift:validate failed with digest mismatches and currentHeadSha mismatch.

**Risk:** Agents can consume apparently authoritative context while the validator says it does not match the checkout.

**Severity:** Critical

**Fix Grade:** P0

**Recommended Fix:** Refresh the prompt-context drift report, validate it, then decide whether freshness is a source-checkout invariant or consumption-time invariant. If source-checkout, add validation to check:static. If consumption-time, make agent-readiness consumers fail closed when stale.

**Suggested Software / Method:** Node validator, JSON Schema, SHA256 source refs, git HEAD comparison, jq smoke probes.

**Files Likely To Change:**

- artifacts/context-integrity/prompt-context-drift-report.json
- scripts/write-prompt-context-drift-report.cjs
- scripts/validate-prompt-context-drift.cjs
- package.json
- AGENTS.md

**Validation Command:** pnpm run prompt-context-drift:write; pnpm run prompt-context-drift:validate

**Acceptance Criteria:**

- prompt-context drift validation exits 0 after report refresh.
- The report currentHeadSha matches live HEAD.
- Every pass-class source ref is repo-contained and hash verified.
- The repo documents whether the artifact is source-controlled or generated on consumption.

### GAP-002: Required-check and workflow authority drift

**Category:** CI/CD / governance / validation

**Current State:** Source contracts and architecture comments reference pr-pipeline and a GitHub workflow path that was not present in the inspected checkout; CircleCI is present and active in source.

**Expected State:** Required check names should map mechanically to a current local workflow/job source or be explicitly marked hosted-only with current evidence requirements.

**Evidence Basis:** The Tessl-agent evidence favors observable loops and durable factory-owned workflow state over human memory of which external check owns a gate.

**Code Evidence:** .architecture.yml line 6 references .github/workflows/pr-pipeline.yml; harness.contract.json contains governance and branch-protection surfaces; .circleci/config.yml exists; command evidence: pnpm run architecture:check passed locally while stale workflow authority remained in metadata.

**Risk:** Agents can report or route against required checks that no longer have a local source mapping.

**Severity:** High

**Fix Grade:** P0

**Recommended Fix:** Add a CI required-check parity validator that reads harness.contract.json, any .harness required-check registry, .circleci/config.yml, and .github/workflows/*.yml, then reports required checks without source mappings.

**Suggested Software / Method:** YAML parser, JSON Schema, jq, CircleCI config parser, GitHub Actions workflow scan, package script gate.

**Files Likely To Change:**

- scripts/check-tooling-baseline-parity.mjs or new scripts/check-ci-required-check-source-parity.mjs
- package.json
- harness.contract.json
- .architecture.yml
- docs/agents/17-ci-required-checks.md

**Validation Command:** pnpm run tooling:parity; pnpm run architecture:check

**Acceptance Criteria:**

- Every required check has a local source mapping or an explicit hosted-only evidence rule.
- .architecture.yml no longer references absent workflow paths as active authority.
- The new parity check runs in the appropriate static gate.

### GAP-003: CLI reference advertises an invalid next mode

**Category:** command selection / runtime

**Current State:** docs/cli-reference.md describes phase-specific mode usage in a way that sends readers toward harness next --mode orient, but the live command rejects that mode.

**Expected State:** Documented command examples should either execute successfully or be clearly scoped to the command that owns that option.

**Evidence Basis:** The Tessl-agent evidence stresses that agent loops should be factory-owned and repeatable; command affordances are part of that loop and must not route agents into avoidable usage errors.

**Code Evidence:** docs/cli-reference.md describes --mode orient/verify/review/handoff; command evidence: pnpm exec harness next --mode orient --json failed with invalid_mode; pnpm exec harness commands --json --for-agent --mode orient passed.

**Risk:** Cold agents can start with an invalid rail and enter repair mode before doing useful work.

**Severity:** High

**Fix Grade:** P1

**Recommended Fix:** Update docs/cli-reference.md to scope phase-specific modes to harness commands --json --for-agent --mode, or add those modes to harness next with tests if next is intended to own them.

**Suggested Software / Method:** Vitest CLI tests, command-registry tests, docs lint, generated command catalog validation.

**Files Likely To Change:**

- docs/cli-reference.md
- src/commands/next.ts if behavior changes
- src/commands/next.test.ts if behavior changes
- src/lib/cli/command-registry.test.ts

**Validation Command:** pnpm exec harness commands --json --for-agent --mode orient; pnpm docs:lint

**Acceptance Criteria:**

- The docs no longer recommend an invalid command shape.
- The documented orient rail emits JSON successfully.
- If next gains orient mode, a targeted test covers the new behavior.

### GAP-004: Agent-native ratchet checks are not part of the default static lane

**Category:** validation / runtime

**Current State:** Agent-native ratchet scripts exist and pass when invoked directly, but the aggregate static lane does not run them by default.

**Expected State:** The repo should routinely validate agent-facing packet generation, claim boundaries, and command reachability when those surfaces are part of the operator path.

**Evidence Basis:** The Tessl-agent evidence points to verifier layers and recurring loops that continuously check whether skills and workflows still behave.

**Code Evidence:** package.json defines agent-native:ratchets, session:distill, agent-rework:report, reviewer:decision, and governance:decision-surface; check:static omits agent-native:ratchets and prompt-context-drift:validate; command evidence: pnpm run agent-native:ratchets passed.

**Risk:** Agent-native cockpit surfaces can drift without failing the broad static gate.

**Severity:** Medium

**Fix Grade:** P1

**Recommended Fix:** Add a proposed agent-native:validate script that runs ratchets, runtime packet schema validation, command catalog validation, and prompt-context freshness with explicit stale-artifact semantics.

**Suggested Software / Method:** package script aggregation, JSON Schema, Vitest smoke tests, jq.

**Files Likely To Change:**

- package.json
- scripts/write-agent-native-ratchet-report.cjs
- contracts/cli-json-contracts.manifest.json
- scripts/validate-runtime-packet-schemas.cjs

**Validation Command:** Proposed command: pnpm run agent-native:validate. Current executable fallback: pnpm run agent-native:ratchets; pnpm run contracts:runtime-packets; pnpm run contracts:command-catalog; pnpm run prompt-context-drift:validate. Follow with pnpm check:static after the aggregate exists.

**Acceptance Criteria:**

- Agent-native validation has one documented command.
- The command fails on schema drift or forbidden claim drift.
- check:static either runs the command or records why it remains consumption-time only.

### GAP-005: Root AGENTS.md is overloaded as both router and policy manual

**Category:** context / governance

**Current State:** AGENTS.md contains compact routing plus a large amount of high-churn operational doctrine.

**Expected State:** AGENTS.md should remain a high-signal router and hard-constraint capsule, with long procedures routed to focused docs and validators.

**Evidence Basis:** The Tessl-agent evidence and repo codestyle both favor compressed context, durable rules, and verifier-backed behavior over broad prompt prose.

**Code Evidence:** AGENTS.md lines 44-180 contain many non-negotiables and process rules; CODESTYLE.md 14A says root/front-door docs should stay compact and route detail into focused modules.

**Risk:** Cold agents may miss or mis-prioritize critical rules because the first loaded policy surface is too dense.

**Severity:** Medium

**Fix Grade:** P2

**Recommended Fix:** Move long incident-shaped guidance into docs/agents/04-validation.md, docs/agents/07b-agent-governance.md, and docs/agents/17-ci-required-checks.md, then add a router-density or duplicate-policy check for AGENTS.md.

**Suggested Software / Method:** docs lifecycle validator, markdown AST scan, custom Node guard, docs-gate.

**Files Likely To Change:**

- AGENTS.md
- docs/agents/04-validation.md
- docs/agents/07b-agent-governance.md
- docs/agents/17-ci-required-checks.md
- scripts/check-doc-lifecycle.ts or a new docs guard

**Validation Command:** pnpm docs:lifecycle; pnpm docs:lint; bash scripts/run-harness-gate.sh docs-gate --mode required --json

**Acceptance Criteria:**

- AGENTS.md keeps hard constraints and routing.
- Long procedure blocks move to focused docs.
- A mechanical check prevents the same policy from drifting across multiple front doors.

### GAP-006: CLI JSON contract manifest is narrower than the public agent command surface

**Category:** command selection / validation

**Current State:** The CLI JSON contract manifest validates only a small subset of the agent-facing JSON command surface.

**Expected State:** Every command that agents are told to call should have a live JSON contract, expected schema version, and allowed exit-code envelope.

**Evidence Basis:** The Tessl-agent evidence emphasizes factory-owned automation and verifier layers; command JSON contracts are the verifier layer for agent tooling.

**Code Evidence:** contracts/cli-json-contracts.manifest.json validates command-catalog, harness-next-decision, and harness-fitness-error; live orient catalog includes next, orient, agent-readiness, agent-native-ratchets, runtime-card, session-context, session-distill, reviewer-decision, governance-decision-surface, and agent-rework.

**Risk:** Commands can remain discoverable while their JSON envelopes drift.

**Severity:** Medium

**Fix Grade:** P1

**Recommended Fix:** Expand cli-json-contracts.manifest.json to cover orient, session-context, agent-native-ratchets, session-distill, agent-rework, reviewer-decision, governance-decision-surface, and key usage-error paths.

**Suggested Software / Method:** JSON Schema, live command validation, Vitest, jq.

**Files Likely To Change:**

- contracts/cli-json-contracts.manifest.json
- contracts/examples/*.json
- contracts/*.schema.json
- scripts/validate-cli-json-contracts.cjs if missing
- package.json

**Validation Command:** pnpm run contracts:command-catalog; pnpm run contracts:runtime-packets

**Acceptance Criteria:**

- The manifest names the current agent-facing commands.
- Each manifest entry has expected schema version, example path, liveValidation, and allowed exit codes.
- A validator fails if a listed command stops emitting valid JSON.

### GAP-007: Architecture warnings are baselined but repair metadata is not visible enough

**Category:** architecture / validation

**Current State:** architecture:check passes with four baselined auth-boundary warnings.

**Expected State:** Baselined architecture findings should carry visible owner, reason, expiry, and next action in JSON output.

**Evidence Basis:** The Tessl-agent evidence favors observable loops and repairable verifier output, not opaque pass states.

**Code Evidence:** pnpm run architecture:check passed with four baselined auth-commands-use-crypto warnings; .architecture.yml requires node:crypto for auth-boundary commands.

**Risk:** Baselines can become permanent hidden exceptions.

**Severity:** Medium

**Fix Grade:** P2

**Recommended Fix:** Surface baseline metadata and burn-down guidance directly in architecture:check JSON.

**Suggested Software / Method:** custom Node validator, JSON output schema, Vitest for checker output.

**Files Likely To Change:**

- scripts/check-architecture-rules.cjs
- .architecture-baseline.txt
- .architecture.yml
- tests for architecture checker if present

**Validation Command:** pnpm run architecture:check

**Acceptance Criteria:**

- JSON output includes baseline owner, reason, expiry, and suggested next action.
- Expired baselines fail.
- Current baselined warnings remain visible without blocking unrelated work.

### GAP-008: Research audit artifacts are advisory but can look like governance inputs

**Category:** governance / traceability

**Current State:** The repo distinguishes operator-requested audits from research-discovery audits, but research audits can still be read as implementation authority unless promoted explicitly.

**Expected State:** Research audits should carry a clear secondary-context authority boundary and a promotion path into decisions, specs, goals, or implementation plans.

**Evidence Basis:** The Tessl-agent evidence stresses factory ownership and durable workflow artifacts; advisory research should become implementation authority only through a governed promotion path.

**Code Evidence:** scripts/check-harness-audit-tracking.mjs verifies .harness/audits versus .harness/research/audits destination distinction; the current artifact is in .harness/research/audits by request.

**Risk:** Advisory research findings may be treated as accepted policy without a decision record or validation plan.

**Severity:** Low

**Fix Grade:** P3

**Recommended Fix:** Add a short research-audit authority banner or index explaining that research audits are secondary-context inputs until promoted into a goal, ADR, spec, or implementation plan.

**Suggested Software / Method:** docs-gate, audit tracking validator, Markdown lifecycle metadata.

**Files Likely To Change:**

- .harness/README.md
- .harness/research/audits/README.md if created
- scripts/check-harness-audit-tracking.mjs

**Validation Command:** pnpm run harness:audit-tracking -- --json; pnpm docs:lint

**Acceptance Criteria:**

- Research audits declare secondary-context authority.
- The promotion path is documented.
- audit tracking validation remains pass.

## 5. Contradictions

### Contradiction: Architecture Authority Points At An Absent Workflow

**Claim:** .architecture.yml says the active gate today is a diagram manifest in .github/workflows/pr-pipeline.yml.

**Actual Implementation:** package.json wires architecture enforcement through pnpm architecture:check and scripts/check-architecture-rules.cjs. The inspected checkout did not expose the named GitHub workflow file as the local source authority.

**Evidence:** pnpm run architecture:check passed with four baselined warnings; .circleci/config.yml is present; .architecture.yml still references .github/workflows/pr-pipeline.yml in comments.

**Severity:** High

**Operational Impact:** Agents can route CI or architecture repair work to the wrong source surface, then report local architecture truth as if it proved hosted PR pipeline truth.

**Recommended Fix:** Replace the stale workflow comment with the current local architecture checker, then add CI required-check source parity so future workflow-name drift becomes a validation failure.

### Contradiction: CLI Reference Routes To An Invalid Command Shape

**Claim:** docs/cli-reference.md describes phase-specific --mode rails in a way that can send readers toward harness next --mode orient.

**Actual Implementation:** pnpm exec harness next --mode orient --json exits with invalid_mode. pnpm exec harness commands --json --for-agent --mode orient emits the orient command catalog.

**Evidence:** Local command evidence from this audit: harness next --mode orient failed; harness commands --json --for-agent --mode orient passed.

**Severity:** High

**Operational Impact:** Cold agents start by repairing a command-usage error instead of using the intended orient rail.

**Recommended Fix:** Scope phase-specific --mode examples to harness commands --json --for-agent --mode, or add the missing modes to harness next with tests and JSON contract coverage.

### Contradiction: Agent-Readiness Cockpit Freshness Is Required But Failing

**Claim:** AGENTS.md requires prompt-context drift reports to be refreshed and validated before agent-readiness consumers trust them.

**Actual Implementation:** pnpm run prompt-context-drift:validate failed against the current checkout with digest mismatches and currentHeadSha mismatch. check:static does not currently include that validator.

**Evidence:** Local validation evidence from this audit: prompt-context-drift:validate failed; prompt-context drift scripts exist in package.json and scripts/.

**Severity:** Critical

**Operational Impact:** The repo can present an agent-readiness cockpit while its freshness validator says the context artifact is stale.

**Recommended Fix:** Decide artifact lifecycle, refresh the report, validate it, then either add freshness validation to check:static or make the consumer regenerate/fail closed on stale context.

### Contradiction: Root Front Door Claims Compact Routing But Carries Dense Procedure

**Claim:** AGENTS.md says agent governance details live in deeper docs and the root file should remain the compact operating contract.

**Actual Implementation:** AGENTS.md contains a long operational manual, including detailed steering, OODA, validation recovery, and agent-governance doctrine.

**Evidence:** AGENTS.md root guidance and CODESTYLE.md 14A both favor compact front doors; the current AGENTS.md includes high-churn procedural detail in the first loaded policy surface.

**Severity:** Medium

**Operational Impact:** High-value constraints are present but compete with too much first-load context, increasing cold-agent omission risk.

**Recommended Fix:** Keep hard constraints and route pointers in AGENTS.md, move procedures into docs/agents/* modules, and add a docs guard for front-door density or duplicate policy.

## 6. Missing Features

### Runtime State

- Missing: default validation of prompt-context drift freshness before agent-readiness context is consumed.
- Missing: run-loop/v1 or equivalent runtime packet that binds retry budget, stop condition, verifier owner, recovery class, and next safe command.
- Missing: richer architecture baseline repair metadata in command output.

### Command Selection

- Missing: live JSON contract entries for most agent-facing cockpit commands.
- Missing: a command-shape validator that proves documented examples match executable CLI behavior.
- Missing: a single operator command that says whether a failed loop should retry, escalate, refresh context, or create a durable guardrail.

### Verification

- Missing: a consumer test proving agent-native ratchets cannot satisfy PR closeout, CI, review, tracker, or merge-readiness claims.
- Missing: source-level check that all required hosted checks have local source mappings or explicit hosted-only evidence rules.

### Validation

- Missing: agent-native aggregate validation that includes ratchets, runtime packet schemas, command catalog, CLI JSON contracts, and prompt-context freshness semantics.
- Missing: prompt-context report refresh discipline in aggregate validation.
- Missing: explicit validator promotion prompt when the same failure class recurs.

### Architecture Enforcement

- Missing: command that compares .architecture.yml comments, package scripts, and CI config for authority drift.
- Missing: visible owner, reason, expiry, and next action for baselined architecture warnings.

### Traces

- Missing: replay-packet/v1 emission; the manifest marks replay-packet not_yet_emitted.
- Missing: durable trace-to-command evidence linking failed command loops to retry, escalation, or validator-promotion decisions.

### Context

- Missing: automatic stale-context prompt or fail-closed behavior when prompt-context drift validation fails.
- Missing: context-size and route-density metrics for AGENTS.md and other high-load agent surfaces.

### Skills

- Missing: skill overlap/density validator for repo-local skills and workflow docs.
- Missing: executable workout coverage for every high-value skill path.

### Recovery

- Missing: central durable record for repeated command failures observed in current session unless the operator manually converts them into a report.
- Missing: recovery-state artifact classifying retryable, stale-context, validation, missing-artifact, and authority-drift failures.

### Governance

- Missing: a source-controlled promotion path from research audit to goal, decision, spec, or implementation plan.
- Missing: a short authority banner for research audits to prevent advisory evidence becoming policy by implication.

### CI/CD

- Missing: CI required-check source parity.
- Missing: hosted-vs-local CI authority reconciliation inside a source validator.

### Observability

- Missing: bounded observability consumer that joins session, command, and runtime-card evidence without converting telemetry into delivery truth.
- Missing: explicit redaction and authority fields for any future telemetry-backed governance packet.

## 7. Fix Roadmap

### Phase 1 — Critical Trust Boundary Fixes

**Objective:** Make current-state evidence trustworthy before agents consume or route from it.

**Fixes Included:** GAP-001 prompt-context drift freshness; GAP-003 CLI orient rail contradiction; explicit advisory-vs-delivery language for any touched cockpit evidence.

**Files Likely Affected:** artifacts/context-integrity/prompt-context-drift-report.json; scripts/write-prompt-context-drift-report.cjs; scripts/validate-prompt-context-drift.cjs; docs/cli-reference.md; package.json.

**Validation Gates:** pnpm run prompt-context-drift:write; pnpm run prompt-context-drift:validate; pnpm exec harness commands --json --for-agent --mode orient; pnpm docs:lint.

**Expected Risk Reduction:** Removes the highest-risk stale-context failure and prevents cold agents from starting on an invalid documented command.

### Phase 2 — Mechanical Enforcement

**Objective:** Convert authority drift into source-level validation failures.

**Fixes Included:** GAP-002 CI required-check source parity; GAP-004 agent-native aggregate validator; GAP-006 expanded CLI JSON contract manifest; architecture authority comment correction.

**Files Likely Affected:** package.json; harness.contract.json; .architecture.yml; .circleci/config.yml; contracts/cli-json-contracts.manifest.json; scripts/check-ci-required-check-source-parity.mjs; docs/agents/17-ci-required-checks.md.

**Validation Gates:** pnpm run tooling:parity; pnpm run contracts:command-catalog; pnpm run contracts:runtime-packets; pnpm check:static; pnpm run architecture:check.

**Expected Risk Reduction:** Makes stale required-check labels, invalid JSON command envelopes, and omitted agent-native checks mechanically visible.

### Phase 3 — Runtime Harness Maturity

**Objective:** Connect existing runtime packets into an operator-visible recovery loop.

**Fixes Included:** run-loop/v1 or agent-rework extension; retry budget; verifier owner; recovery class; stop reason; next safe command; replay-packet emission plan.

**Files Likely Affected:** contracts/run-loop.schema.json; contracts/runtime-packet-schemas.manifest.json; src/commands/*; src/lib/runtime-*; tests for runtime packet generation.

**Validation Gates:** pnpm run contracts:runtime-packets; targeted Vitest for run-loop branches; pnpm test:deep if runtime/artifact behavior changes.

**Expected Risk Reduction:** Reduces repeated-loop ambiguity and gives operators a deterministic repair/escalation surface.

### Phase 4 — Context and Skill Compression

**Objective:** Reduce cold-start load while preserving hard governance constraints.

**Fixes Included:** GAP-005 AGENTS.md router compaction; docs/agents routing refresh; context-density metric; skill overlap/workout coverage guard.

**Files Likely Affected:** AGENTS.md; CODESTYLE.md if routing changes; docs/agents/04-validation.md; docs/agents/07b-agent-governance.md; docs/agents/17-ci-required-checks.md; repo-local skill workout fixtures.

**Validation Gates:** pnpm docs:lifecycle; pnpm docs:lint; bash scripts/run-harness-gate.sh docs-gate --mode required --json; pnpm codestyle:parity if projection surfaces change.

**Expected Risk Reduction:** Decreases policy omission risk by keeping the first loaded agent surface compact and test-backed.

### Phase 5 — Governance and Scaling

**Objective:** Keep research, telemetry, review, CI, and delivery truth separated as autonomy expands.

**Fixes Included:** GAP-008 research-audit authority banner and promotion path; observability authority fields; claim-boundary consumer tests; governance packet redaction and evidence rules.

**Files Likely Affected:** .harness/README.md; .harness/research/audits/README.md; scripts/check-harness-audit-tracking.mjs; PR template or governance docs if promotion workflow changes.

**Validation Gates:** pnpm run harness:audit-tracking -- --json; pnpm docs:lint; pnpm docs:lifecycle; targeted claim-boundary tests.

**Expected Risk Reduction:** Prevents advisory artifacts and telemetry from becoming implicit delivery authority.

## 8. Highest-Leverage Fixes

| Rank | Fix | Impact | Difficulty | Risk Reduced | Why First |
|---|---|---|---|---|---|
| 1 | Refresh and validate prompt-context drift evidence. | Very high | Low | Stale context consumption | It is current, concrete, and already has a failing validator. |
| 2 | Correct CLI orient rail documentation or behavior. | High | Low | Invalid first command for cold agents | It converts a known usage trap into an executable rail. |
| 3 | Add CI required-check source parity. | Very high | Medium | Hosted/local authority drift | It prevents source contracts from naming absent workflow authority. |
| 4 | Add agent-native:validate aggregate command. | High | Medium | Agent cockpit drift | It makes ratchets, packet schemas, command contracts, and freshness one runnable gate. |
| 5 | Expand cli-json-contracts manifest. | High | Medium | Silent JSON envelope drift | Agent-facing commands become schema-backed instead of discoverable only. |
| 6 | Surface architecture baseline metadata. | Medium | Medium | Permanent hidden exceptions | Baselines become managed debt rather than quiet pass states. |
| 7 | Compact AGENTS.md into router plus hard constraints. | Medium | Medium | Cold-start policy omission | The highest-priority rules become easier for agents to load and obey. |
| 8 | Add research-audit authority banner. | Medium | Low | Advisory evidence promoted by implication | It keeps research inputs separate from accepted governance decisions. |
| 9 | Add claim-boundary consumer tests. | High | Medium | Cockpit evidence overclaiming | It proves advisory packets cannot satisfy external delivery truth. |
| 10 | Introduce run-loop/v1 after drift fixes. | High | High | Repeated-loop ambiguity | It is powerful only after context, commands, and validation authority are trustworthy. |

## 9. Implementation Advice

Start with the failing validator, not the most ambitious architecture work. The prompt-context drift failure is current, concrete, and directly aligned with the Tessl-agent theme: the system should know when its context is stale. Repair that first.

Treat CI parity as a source-level validator before touching hosted settings. A local check cannot prove GitHub branch protection, but it can prevent source contracts from naming nonexistent workflow paths or stale job labels.

Prefer command-shape correction over explanatory prose. If docs say a command exists, one of two things should happen: the command works, or the docs stop saying it. The harness already emits structured invalid_mode output, which is useful; the next improvement is preventing the invalid recommendation.

Keep advisory cockpit surfaces advisory. agent-native-ratchets/v1 is valuable because it states allowed and forbidden claims. Do not let it become a hidden readiness proxy. Add consumer tests that preserve its authority boundary.

Do not rewrite the harness around a new orchestration abstraction yet. The repo already has next, orient, runtime-card, session-context, session-distill, agent-rework, reviewer-decision, governance-decision-surface, and packet schemas. The next improvement is connecting and validating those surfaces, not inventing a parallel stack.

When moving AGENTS.md detail into routed docs, preserve cold-start safety. Keep the hard truth-lane rules, validation evidence format, and forbidden readiness claims in the root. Move procedure, rationale, examples, and long incident-shaped guidance into focused docs and validators.

## 10. Final Recommendation

This codebase should not be treated as a greenfield harness rewrite candidate. It already has a credible agent-native architecture with real contract and validation surfaces. The right move is a hardening sequence: repair stale context evidence, repair command and CI authority drift, expand live JSON command contract coverage, compact high-load agent instructions, then promote existing recovery evidence into a small run-loop packet.

The strongest ideas are the explicit claim-boundary model, runtime packet schema validation, command catalog, ratchet packets, and policy routing. The weakest areas are freshness discipline, command-doc parity, CI required-check source mapping, and front-door context load.

Most reusable concepts:

- Runtime packets with forbidden claim sets.
- Command catalog with mutability, retryability, required flags, and safe alternatives.
- Advisory cockpit evidence that refuses to claim delivery truth.
- Coding-policy routing from changed files to exact gates.
- Audit tracking that separates operator-requested audits from research-discovery audits.

The repo can present excellent agent-native doctrine while a current context freshness validator fails. That is not a philosophical weakness; it is a concrete fixable control-plane gap.

**Immediate Next Action:** Refresh prompt-context drift evidence, validate it, and decide whether the artifact is committed source evidence or generated-on-consumption evidence.

**Safest First Patch:** Correct docs/cli-reference.md so the orient rail points only to pnpm exec harness commands --json --for-agent --mode orient unless harness next intentionally gains orient mode.

**Highest-Risk Missing System:** CI required-check source parity, because hosted check labels, local workflow sources, and architecture comments can drift without a local validator joining them. First validator target: scripts/check-ci-required-check-source-parity.mjs reading harness.contract.json, .circleci/config.yml, .github/workflows/*.yml when present, and any .harness required-check registry.

**Best Validation Command To Add First:** Proposed command: pnpm run agent-native:validate. Add it as a package.json script that runs pnpm run prompt-context-drift:validate, pnpm run agent-native:ratchets, pnpm run contracts:runtime-packets, pnpm run contracts:command-catalog, and the expanded CLI JSON contract validator once that manifest covers the current agent-facing command surface. Until then, the current executable fallback is to run those existing commands individually.

**Broader Codex Autonomy Assessment:** Do not expand broader Codex autonomy yet. Local contracts are strong, but stale context validation and CI/check authority drift should be resolved before widening autonomous operation.
