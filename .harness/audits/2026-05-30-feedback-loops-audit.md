# Feedback Loops Audit

Date: 2026-05-30
Scope: coding-harness repository feedback loops visible from repository contracts, docs, scripts, CI configuration, Project Brain surfaces, and current agent-facing workflow guidance.

## Table of Contents
- [Method](#method)
- [Ranked Findings](#ranked-findings)
- [Detailed Loop Inventory](#detailed-loop-inventory)
- [Cross-Loop Gaps](#cross-loop-gaps)
- [Recommended Next Steps](#recommended-next-steps)
- [Evidence Map](#evidence-map)

## Method

This audit treats a feedback loop as any recurring path where a signal is generated, routed to an agent, maintainer, reviewer, CI surface, Project Brain, or tracker, and expected to change behavior. It includes automated checks, human review, runtime evidence, issue tracking, telemetry, user steering, and durable learning surfaces.

Ranking uses leverage rather than severity: a high-leverage loop either shortens PR lead time, prevents repeated manual steering, improves agent reliability, or protects delivery truth across multiple downstream loops.

## Ranked Findings

| Rank | Feedback loop | Leverage | Why it ranks here |
| --- | --- | --- | --- |
| 1 | Operator steering to durable guardrail | Very high | Repeated steering is the clearest proof that the operating system failed to encode a rule. It can turn expensive human judgment into tests, gates, docs, Project Brain rules, or tracked exceptions. |
| 2 | Local validation and repo wrapper gates | Very high | pnpm check, validate-codestyle, verify-work, and focused gates are the fastest executable proof path before PR and CI cost is paid. |
| 3 | CI and branch-protection checks | Very high | CircleCI, CodeRabbit, Semgrep Cloud, and branch protection decide whether a PR can merge; failures are expensive but authoritative for external readiness. |
| 4 | Code review and review-gate | Very high | Independent review catches design and behavioral risk that tests miss, and review-gate turns review readiness into deterministic evidence. |
| 5 | Runtime evidence, runtime-card, and pr-closeout | High | These loops keep local validation, PR state, review state, tracker state, and merge readiness separated instead of collapsing them into false completion. |
| 6 | Linear and issue-tracking loop | High | Linear anchors plans, branches, PR titles, acceptance evidence, and closeout state; drift here makes work look done while tracker truth remains wrong. |
| 7 | Project Brain, local memory, and learnings | High | This is the durable path for converting repeated failures into future-agent context, but it depends on explicit promotion discipline. |
| 8 | Docs, contract, and governance drift gates | High | Docs-gate and contract checks prevent policy and runtime behavior from drifting apart when agent-facing workflows change. |
| 9 | Security, dependency, and secrets loops | High | Semgrep, Snyk, audit, staged-secret checks, and security-scan protect release and branch-protection readiness across local and CI lanes. |
| 10 | Artifact and evidence provenance loops | Medium-high | Artifact gates and evidence validators prevent screenshots, reports, receipts, and generated files from becoming unverifiable claims. |
| 11 | Related tests and behavior-test quality loops | Medium-high | Related-test, self-affirming, and behavior-test checks improve trust in tests, but they depend on source-to-test mapping quality. |
| 12 | Preflight, policy, risk, and blast-radius loops | Medium-high | These loops route validation and review effort before implementation or handoff, but need better calibration from escaped defects. |
| 13 | Git hooks and worktree-safety loops | Medium | Immediate local feedback prevents bad commits and unsafe worktree config, but hooks can be bypassed and are not delivery truth. |
| 14 | Agent readiness, session context, and next-command loops | Medium | These improve agent orientation and reduce manual routing, but stale artifacts can mislead unless paired with current evidence. |
| 15 | Telemetry, observability, and session-trace loops | Medium | Runtime traces and eval usage show how agents and tools behave, but aggregation and ownership are less mature than gates. |
| 16 | Packaged skill, downstream install, and upgrade loops | Medium | Packaged-skill and upgrade checks protect downstream usability; signal arrives later and often through integration friction. |
| 17 | Release, provenance, and rollback loops | Medium | Release loops are high impact but lower frequency; they need strong rollback evidence and signed or published artifact proof. |
| 18 | Audit, research, and refactor report loops | Medium | Audits create rich signal, but leverage depends on closure tracking so findings do not become passive documentation. |
| 19 | User reports and external issue intake | Medium | User-reported defects are product-critical but currently less structured than local gates, PR checks, and Linear production workflow. |

## Detailed Loop Inventory

### 1. Operator Steering To Durable Guardrail

- Signal source: Jamie feedback, repeated review comments, repeated command failures, planning-only corrections, and line-level design feedback.
- Recipient: current agent first, then repo operating system surfaces such as AGENTS.md, .harness/memory/LEARNINGS.md, PR template fields, scripts, validators, and Project Brain.
- Average delay: minutes when admitted in-session; hours to days when it waits for PR closeout or later memory promotion.
- Failure mode: signal stays in chat, gets acknowledged once, or becomes prose without an executable guard.
- Actionability: very high. The repo already names the destination pattern: guardrail, test, prompt, policy check, or tracked exception.
- Missing feedback: no single queue that lists steering admissions, the durable destination chosen, the proving command, and whether the guard prevented recurrence later.
- Next Steps: create a steering-admission index under .harness, add a periodic check for admissions without durable destinations, and feed the index into north-star-feedback.

### 2. Local Validation And Repo Wrapper Gates

- Signal source: package scripts, bash scripts/validate-codestyle.sh, bash scripts/verify-work.sh, scripts/run-harness-gate.sh, pnpm check, and focused script/test gates.
- Recipient: implementing agent, PR author, local pre-commit/pre-push hooks, and reviewers reading validation evidence.
- Average delay: seconds for focused gates; 2-20 minutes for aggregate checks; longer for deep artifact or e2e lanes.
- Failure mode: aggregate failures are too broad, environment failures get confused with product failures, or a passing local gate is overstated as CI, review, tracker, or merge-readiness truth.
- Actionability: very high. Failures usually include command and file-level evidence, and the repo requires exact command/outcome reporting.
- Missing feedback: no unified latency or flakiness history per gate, no automatic link from failing gate to owner and likely recovery doc, and no clear trend of which gates most reduce review rework.
- Next Steps: emit a validation run ledger with command, duration, changed-file scope, failure class, and next owner; rank gates by failure frequency and mean time to fix.

### 3. CI And Branch-Protection Checks

- Signal source: CircleCI pr-pipeline, CircleCI security-scan, CodeRabbit check, Semgrep Cloud check, branch protection, .harness/ci-required-checks.json, and harness.contract.json.
- Recipient: PR author, maintainer, GitHub branch protection, Linear automation, and closeout/reporting tools.
- Average delay: 5-30 minutes for most PR checks; longer when external security scanners queue or require credentials.
- Failure mode: CircleCI workflow-level check names hide individual job failures, stale PR metadata is mistaken for current truth, or internal harness check names are confused with GitHub required check names.
- Actionability: high. CI failures usually name the failing job, but the rollup/required-check split requires careful interpretation.
- Missing feedback: no single merged timeline showing local validation result, CI job result, branch-protection result, retries, and whether failure was introduced, flaky, pre-existing, or external.
- Next Steps: extend pr-closeout or a companion report with CI timeline and ownership classification, then keep required-check manifests and docs in parity.

### 4. Code Review, CodeRabbit, And Review-Gate

- Signal source: human PR review, CodeRabbit comments/checks, Codex review artifacts, harness reviewer roles, Semgrep comments, and harness review-gate.
- Recipient: PR author, implementing agent, independent reviewers, and PR closeout gates.
- Average delay: minutes for automated AI review; hours to days for human or specialist review.
- Failure mode: review comments are fixed locally but not resolved remotely, CodeRabbit feedback is treated as inbox noise, review status is collapsed into generic pass/fail, or coding agents self-approve by implication.
- Actionability: high when comments cite file/line evidence; medium when review produces broad advice without owner or reproduction path.
- Missing feedback: no complete review-feedback lifecycle joining comment, fix commit, validation command, resolver, and durable learning or pattern search result.
- Next Steps: add a review-thread ledger with source, severity, file/line, fix commit, validation, remote resolution state, and learning promotion.

### 5. Runtime Evidence, Runtime-Card, And PR Closeout

- Signal source: runtime-card/v1, runtime evidence bundles, pr-closeout/v1, delivery-truth packets, review-state packets, external-state packets, receipt validators, and runtime-card traces.
- Recipient: current agent, coordinator, PR author, reviewer, and closeout decision surfaces.
- Average delay: immediate for local packet generation; minutes when live GitHub, Linear, or provider state is included.
- Failure mode: packet freshness is stale, local paths leak into durable artifacts, evidence is used beyond claim-support authority, or a summary packet is mistaken for delivery truth.
- Actionability: high when freshness, head SHA, source kind, and blocker class are current.
- Missing feedback: no always-on freshness monitor for runtime-card, review-state, external-state, and delivery-truth artifacts that still appear in active handoffs after expiry.
- Next Steps: add an active-evidence freshness index and require closeout reports to show current, stale, unobserved, or advisory-only packet status.

### 6. Linear And Issue-Tracking

- Signal source: Linear issue state, branch naming, harness linear prepare, linear-gate, PR template Plan IDs, acceptance trace, and GitHub to Linear automation.
- Recipient: agent, PR author, Linear issue owner, release planner, and closeout workflow.
- Average delay: immediate for CLI preparation; minutes to hours for remote sync; days when issue state waits for review or merge.
- Failure mode: issue key missing from branch/PR, Linear state says one thing while local code says another, tracker closeout is claimed before PR merge, or findings are synced without acceptance evidence.
- Actionability: medium-high. Linear gives ownership and prioritization, but exact remediation still depends on local evidence and PR state.
- Missing feedback: no complete issue lifecycle report joining issue status, branch, PR, validation, review threads, CI, and deferred follow-ups in one current snapshot.
- Next Steps: require current PR and validation refs before issue state changes, and feed review/CI failure classes back into issue comments or linked follow-ups.

### 7. Project Brain, Local Memory, And Learnings

- Signal source: .harness/memory/LEARNINGS.md, Project Brain knowledge/rules/decisions, imported CodeRabbit learning evidence, north-star feedback, and repo memory preflight.
- Recipient: future agents, current closeout author, strategy/planning workflows, and local-memory preflight.
- Average delay: same turn for explicit learning updates; days or longer when learning waits for PR closeout or retrospective work.
- Failure mode: high-signal learning is not promoted, stale memory is treated as current truth, or machine-readable imported evidence exists without distilled durable rule.
- Actionability: high for repeated-rule extraction; medium for raw memory entries without affected surfaces or validation command.
- Missing feedback: no retention-quality score showing whether a learning later changed agent behavior, reduced rework, or prevented repeat comments.
- Next Steps: add recurrence-prevented, affected-surfaces, and validation-proof fields to learning/promotion evidence; make local-memory-preflight warn on relevant learning without matching guard/test/doc destination.

### 8. Docs, Contract, And Governance Drift

- Signal source: docs-gate, contract validation, codestyle parity, architecture checks, workflow validation, ubiquitous language guard, steering guard, and root/guided docs policies.
- Recipient: PR author, docs reviewer, governance owner, and downstream scaffold consumers.
- Average delay: seconds to minutes locally; CI delay when run as part of pr-pipeline.
- Failure mode: docs pass markdown syntax but miss behavior drift, generated docs/checksums are stale, or docs-gate warnings are treated as optional even when they describe governance mismatch.
- Actionability: high when docs-gate reports required surfaces; medium when it only reports unknown-governance warnings.
- Missing feedback: weak link between docs changes and downstream comprehension, no post-merge signal that updated docs reduced agent confusion.
- Next Steps: add docs-gate output fields for intended consumer, changed behavior, and observed downstream confusion; promote repeated doc-driven failures to clearer guidance or validators.

### 9. Security, Dependency, And Secrets

- Signal source: pnpm audit, audit:strict, Semgrep local/changed/full scans, Snyk dependency scan, staged secret checks, Trivy/cosign/tooling checks, Semgrep Cloud, and security-scan workflow.
- Recipient: PR author, maintainer, security reviewer, branch protection, and release owner.
- Average delay: seconds for staged-secret checks; minutes locally for audits and Semgrep; 10-30 minutes in CI/security scanners.
- Failure mode: warning-level findings are ignored without explicit waiver, CI scanner auth fails, local and external scanners disagree, or security feedback is reported without owner/risk acceptance.
- Actionability: high for concrete secret/dependency findings; medium for policy warnings needing triage.
- Missing feedback: no unified vulnerability lifecycle joining scanner source, severity, waiver/false-positive rationale, owner, expiry, and verification command.
- Next Steps: create a security-finding ledger or extend review artifacts with waiver expiry and owner, then feed recurring findings into rules or templates.

### 10. Artifact And Evidence Provenance

- Signal source: artifact-gate, research evidence validator, HE artifact validation, runtime evidence receipts, generated HTML/media reports, screenshots, session collector artifacts, and .harness/active-artifacts.md.
- Recipient: reviewer, closeout author, future agent, and runtime-card/pr-closeout consumers.
- Average delay: seconds to minutes for local validation; longer when artifacts depend on browser, CI, or external provider capture.
- Failure mode: artifact exists but is stale, local-only, untracked, too large, path-unsafe, content-redacted incorrectly, or not linked to the claim it supports.
- Actionability: medium-high. Structural issues are fixable; semantic evidence quality requires reviewer judgment.
- Missing feedback: no artifact lifecycle state showing active, superseded, consumed, stale, or deliberately local-only.
- Next Steps: expand .harness/active-artifacts.md into a lifecycle index with freshness and claim-support eligibility; add artifact owner and consumer fields.

### 11. Related Tests And Behavior-Test Quality

- Signal source: Vitest, test:related, test:ci, test:artifacts, quality:self-affirming, quality:behavior-tests, and expectBehavior assertions.
- Recipient: implementing agent, maintainer, reviewer, and CI.
- Average delay: seconds for narrow Vitest paths; minutes for full test:ci; longer for artifact/e2e suites.
- Failure mode: related-test mapping misses touched code, self-affirming tests pass without requirement-derived expected values, broad suites hide exact behavior path, or tests validate shape rather than trust-boundary semantics.
- Actionability: high for failing deterministic tests; medium when test-quality gates report missing coverage but not the right test to write.
- Missing feedback: no escaped-defect backfeed into related-test mapping and no heat map of source files with weak or absent behavior-test coverage.
- Next Steps: track when review, CI, or user reports reveal missing related tests and update mapping; add coverage-by-trust-boundary reporting for evidence-heavy modules.

### 12. Preflight, Policy, Risk, And Blast Radius

- Signal source: preflight-gate, policy-gate, risk-tier, blast-radius, contract risk tier rules, admission declarations, and changed-file classifiers.
- Recipient: agent before implementation, PR author before handoff, reviewer, and closeout gates.
- Average delay: seconds to minutes.
- Failure mode: changed-file categories are incomplete, risk tier is too coarse, admission declarations become paperwork, or policy gates warn but do not change validation routing.
- Actionability: medium-high when findings name files and required gates; lower when the output cannot prove actual behavioral risk.
- Missing feedback: no calibration loop from escaped defects, review severity, or production friction back into risk-tier and blast-radius rules.
- Next Steps: add calibration fields to review/defect reports that propose risk-tier rule updates; summarize false positives and false negatives by path category.

### 13. Git Hooks And Worktree Safety

- Signal source: pre-commit/pre-push/commit-msg hooks, prepare-worktree.sh, check-git-common-config.sh, check-environment.sh, and hook env sanitization.
- Recipient: local agent/developer before commit or push.
- Average delay: immediate to a few minutes.
- Failure mode: hooks are bypassed, hook environment differs from CI, shared worktree config is unsafe, or dirty worktree state hides unrelated user changes.
- Actionability: high for deterministic hook failures; medium when failures depend on local shell/tool installation.
- Missing feedback: no central record of hook bypasses, hook duration, or hook failures that were later caught by CI.
- Next Steps: add hook run metadata to local validation ledgers, report bypasses in PR closeout, and keep hook env sanitization enforced through validate-codestyle.

### 14. Agent Readiness, Session Context, And Next Command

- Signal source: harness next --json, agent-readiness, session-context/v1, decision-request packets, runtime-card inputs, active artifacts, and command catalog.
- Recipient: current/future agents and coordinators deciding the next safe command.
- Average delay: immediate for local orientation; minutes when live providers or active artifacts are refreshed.
- Failure mode: recommendation is based on stale packet, active artifact points to obsolete evidence, command catalog is current but runtime environment cannot execute the command, or advisory packets are mistaken for authorization.
- Actionability: medium. It routes work well when evidence is fresh, but it should not close delivery lanes by itself.
- Missing feedback: no measured rate of correct vs corrected next recommendations, and no built-in user correction channel that updates route rules.
- Next Steps: capture when agents override or reject next recommendations and why, add freshness badges, and feed repeated route mistakes into Project Brain rules or command docs.

### 15. Telemetry, Observability, And Session Traces

- Signal source: runtime-card trace output, session collector artifacts, OpenTelemetry/logging policy, eval usage collection, UI/browser evidence capture, and observed eval usage scripts.
- Recipient: maintainers, evaluators, release reviewers, and future agents.
- Average delay: immediate for local traces; hours or days for aggregated evaluation and review.
- Failure mode: telemetry explains but does not decide, raw traces are too bulky or private for durable artifacts, trace IDs are listed without mapping to claims, or metrics are not aggregated into actionable thresholds.
- Actionability: medium. Telemetry is strong for diagnosis and trend analysis, weaker for direct pass/fail unless wrapped by a validator.
- Missing feedback: no repository-wide dashboard of latency, failure classes, gate duration, reviewer turnaround, or PR lead-time contribution by loop.
- Next Steps: define a small telemetry schema for gate duration, failure class, rerun count, and reviewer/CI turnaround; generate a periodic feedback-loop health report.

### 16. Packaged Skill, Downstream Install, And Upgrade

- Signal source: packaged skill validation, install/update dry-runs, harness upgrade, CI migration snapshots, downstream generated scaffolds, upgrade matrix tests, and skill evals.
- Recipient: maintainers, downstream repo agents, package consumers, and release owner.
- Average delay: minutes in source repo tests; hours to days when downstream adoption surfaces friction.
- Failure mode: source repo validation passes but packaged runtime visibility fails, downstream generated instructions drift, or upgrade/rollback evidence is not preserved.
- Actionability: medium. Source failures are direct; downstream friction often requires reproduction in another repo.
- Missing feedback: no structured downstream consumer report that classifies install friction, first-run blockers, and generated-surface drift by version.
- Next Steps: add downstream install smoke evidence to release readiness, track upgrade matrix failures by generated surface, and feed recurring issues into templates or packaged skill validation.

### 17. Release, Provenance, And Rollback

- Signal source: prepublishOnly, release scripts, GitHub Actions release publishing, npm package state, signed commits/tags, changelog, Scorecard, provenance tools, and rollback markers.
- Recipient: maintainer/release owner, package consumers, branch protection, and downstream repos.
- Average delay: release-cadence dependent; minutes for scripts, hours for external package/security signals.
- Failure mode: local release checks pass but publish fails, release provenance is incomplete, rollback path is documented but untested, or package consumers discover breakage after publish.
- Actionability: medium-high before publish; lower after consumers hit breakage.
- Missing feedback: no release retrospective tying post-release issues back to missing local/CI/review loops.
- Next Steps: require a release feedback record with local gates, CI checks, provenance status, package smoke, and rollback rehearsal status.

### 18. Audit, Research, And Refactor Reports

- Signal source: .harness/audits, .harness/research/audits, .harness/refactors, architecture/shallow-module/hidden-dependency audits, and strategy/brainstorm artifacts.
- Recipient: maintainers, planning agents, implementation agents, and reviewers.
- Average delay: same turn for report creation; days to weeks for remediation.
- Failure mode: report lands without owner, priority, acceptance criteria, Linear issue, or validation path; findings become a context archive instead of a work queue.
- Actionability: medium. Audit findings can be high value, but only after conversion into tracked implementation slices.
- Missing feedback: no standard audit closeout state that marks finding as accepted, rejected, implemented, superseded, or linked to an issue.
- Next Steps: add a lightweight audit finding status format and periodically reconcile audits against active Linear/refactor plans.

### 19. User Reports And External Issue Intake

- Signal source: user bug reports, GitHub issues, Linear intake, customer/downstream repo issues, Slack or mailbox-derived code-fixes queues, and PR comments from consumers.
- Recipient: issue triage owner, maintainer, implementation agent, and Project Brain when the issue implies a durable rule.
- Average delay: hours to days depending on reporting channel and triage cadence.
- Failure mode: external reports are not normalized into Linear/GitHub, duplicates are not linked, reproduction evidence is missing, or reports do not feed back into tests/gates.
- Actionability: medium. Reports are often important but require reproduction and classification before becoming code changes.
- Missing feedback: no single user-report intake schema that captures reproduction command, affected version, expected/actual behavior, escaped-loop classification, and durable-learning destination.
- Next Steps: define a user-report normalization template, add escaped-loop classification, and convert repeated reports into regression tests, docs fixes, or scaffold/gate changes.

## Cross-Loop Gaps

1. There is no unified feedback-loop ledger. The repository has many strong loops, but no single surface that shows signal source, recipient, delay, owner, failure class, and action taken across loops.
2. Delay is mostly implicit. CI and tests expose runtime, but review turnaround, Linear drift, steering admission latency, memory promotion latency, and artifact freshness are not consistently measured.
3. Closure state is uneven. PR closeout is strong, but audit findings, steering admissions, user reports, and telemetry observations need clearer accepted, rejected, implemented, and superseded states.
4. Feedback promotion is manual. The repo says repeated failure should become a guardrail, test, prompt, policy check, or exception, but promotion coverage is not measured.
5. External truth lanes remain easy to conflate. The repo correctly separates local validation, CI, review, Linear, and merge readiness, but reports still need to keep those lanes visually and structurally separate.

## Recommended Next Steps

1. Build .harness/feedback-loops/index.json or a generated Markdown report that records each loop with owner, source, recipient, expected delay, latest signal, failure class, action, and closure state.
2. Add harness feedback-loop-audit --json as a read-only command after the report shape stabilizes. Start with repository evidence only: scripts, contracts, CI manifest, PR template, active artifacts, learnings, and audit findings.
3. Extend PR closeout to include a lane-separated feedback summary: local validation, CI, review, Linear, artifact/runtime evidence, learning promotion, and residual user/reporting signals.
4. Add latency collection for local gates and CI checks, then manually classify review and tracker delay until a provider-backed collector exists.
5. Create an audit-finding lifecycle convention so .harness/audits reports become actionable queues rather than passive archives.
6. Add escaped-loop classification to user reports and post-release defects: name the loop that should have caught the issue, or create the missing loop.
7. Keep the first implementation narrow: index local validation, CI manifest, PR template, and learnings first; add telemetry and provider-backed state only after the local ledger is useful.

## Evidence Map

- Project mission and feedback objective: README.md:17, README.md:31, README.md:153.
- Durable learning and repeated steering rule: README.md:161, README.md:501, .harness/memory/LEARNINGS.md:13.
- Review-gate and CodeRabbit workflow: README.md:469, README.md:492, docs/agents/12-ai-review-governance.md.
- Learning-loop closeout commands: README.md:523.
- Runtime-card, session-context, pr-closeout, audit, doctor, health, and brain command surfaces: README.md:643.
- Package scripts and aggregate local validation: package.json:6.
- CircleCI workflows and security-scan jobs: .circleci/config.yml:212.
- Required check manifest: .harness/ci-required-checks.json:1.
- Branch protection and CI ownership contract: harness.contract.json:1.
- Docs-gate policy and required governed surfaces: harness.contract.json:306.
- PR evidence and review artifact template: .github/PULL_REQUEST_TEMPLATE.md:1.
- Local memory and Project Brain operational surface: docs/agents/03-local-memory.md, .harness/memory/LEARNINGS.md:1.
- Validation evidence and exact command outcome contract: docs/agents/04-validation.md, CODESTYLE.md:48.
