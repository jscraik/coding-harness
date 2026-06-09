# Active Harness Specs And Plans

## Table Of Contents

- [Scope](#scope)
- [Current Active Route](#current-active-route)
- [Artifact Index](#artifact-index)
- [Duplicate Resolution](#duplicate-resolution)
- [Closeout Reconcile Items](#closeout-reconcile-items)

## Scope

Current working reconciliation: 2026-06-09 post-PR380 merge pullback for
JSC-363. PR #380 is merged into `main` as squash merge commit
`b436db70eea4b0f2a29473235cadcf7789dc81fb`; local `main` and `origin/main`
are synced to that head. PR #378 remains merged tracker-refresh provenance from
`28b0bf30091689559afad2e3240f1f849122cf48`. PR #374 delivered the delivery-truth consumption
projection from submitted head `ca7bc92aeeeb5fa357732fbad8f49f62f54abc2b`,
PR #375 delivered the post-PR374 tracker review-fix from submitted head
`be214cd3c64eea16758f8bc57f58de813b37f35f`, and PR #376 delivered the
post-PR375 tracker refresh plus review-note repair from submitted head
`f6df03c7336e23de5b6b98c6a100e68e71be0fc3`. PR #377 delivered the
post-PR376 tracker refresh from submitted head
`499b060437986ebcfc55e679233abb8f24bdf8e6`. PR #378 delivered the
post-PR377 tracker refresh from submitted head
`9b003db2bec03f0638e8fbd4d296c8bc38816167`.
PU-013 runtime cockpit integration proof remains merged through PR #370, PR #371
merged the post-PR370 tracker repair, PR #372 merged the post-PR371 tracker
repair plus narrow CodeRabbit learning-contract validator support, and PR #373
merged the post-PR372 tracker refresh. Linear JSC-363 has pre-PR372 post-merge
route-truth comment `34a50024-24be-4853-af6e-3219cbc0d845`. No PR route is
active after the PR #380 merge pullback; Linear field-text decision is active but blocked because Linear tools and LINEAR_API_KEY are unavailable in this session.
Documentation accuracy, review/external/root-hygiene proof, Judge/PM readiness,
and parent-goal completion remain unclaimed.

Historical snapshot: Last reconciled: 2026-06-07 after PR #365 merged into `main` at
2026-06-07T09:18:13Z as squash merge commit
`bec3bca5f1c3a7f24d1f4b79fb2c02b64252bfbd` from submitted head
`c3fe2f06bf5ab2f69b59a8882075bfb3e5ff3c79`, and local `main`
fast-forwarded to the same `origin/main` head. Before merge, repo-owned
CircleCI lanes, aggregate `pr-pipeline`, aggregate `security-scan`,
CodeRabbit, Socket, CircleCI `snyk-dependency-scan`, and review-thread checks
passed or resolved. The external Snyk GitHub App quota/status lane remains an
owner-approved waiver for that external lane only; it does not claim external
Snyk passed and does not waive repo-run
security, future Snyk results, or future security findings. Live Linear JSC-363
was refreshed during the PR #364 lane and is `In Review`, has PR #364, PR #363,
PR #362, and PR #360 attachments present, and still has Phase 1 title/description
wording, so field-text-current remains unclaimed unless accepted by the owner or
edited.

This index is a local control-plane hygiene artifact. It reconciles tracked
`.harness/specs` and `.harness/plan` files against local merged-PR evidence and
the local Linear queue file. It does not claim live Linear, GitHub, or CI state
unless a live refresh is recorded in the referenced artifact.

## Current Active Route

| Route | Linear Key | Canonical Artifacts | Status | Next Safe Action |
| --- | --- | --- | --- | --- |
| Advisory stale-document archive candidate reporting | JSC-395 | `.harness/specs/2026-06-05-advisory-stale-document-archive-candidate-reporting-spec.md` plus `.harness/plan/2026-06-05-advisory-stale-document-archive-candidate-reporting-trace-plan.md` plus `.harness/plan/2026-06-05-advisory-stale-document-archive-candidate-reporting-execution-plan.md` | Delivered on current main by PR #354. The slice remains advisory/read-only: it may report stale-document archive candidates and docs-gate advisory findings, but it must not delete, move, archive, demote, or rewrite documentation artifacts. | Treat PR #354 as merged implementation evidence. Keep release, downstream-template, and any future docs-cleanup action separate unless a later tracked route explicitly promotes them. |
| Codex runtime evidence verifier cockpit | JSC-363 | .harness/specs/2026-05-24-codex-runtime-evidence-verifier-cockpit-spec.md plus .harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md plus docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md plus docs/goals/codex-runtime-evidence-verifier-cockpit/notes/execution-tracker.md plus .harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md plus .harness/research/deep/2026-05-26-codex-ecosystem-operational-review.md plus .harness/research/deep/2026-05-27-codex-system-prompt-operational-analysis.md | Active Goal Governor route with a thin execution tracker. No PR route is active after PR #380 merged into current main at b436db70eea4b0f2a29473235cadcf7789dc81fb. PR #374 remains merged provenance and delivered final delivery-truth projection in the existing pr-closeout and delivery-truth deep modules. PR #380 remains tracker-refresh provenance only. Linear field-text decision is active but blocked because Linear MCP tools and LINEAR_API_KEY are unavailable in this session. | Next Safe Action: unblock Linear access or get owner classification for JSC-363 field-text currency before broader closeout work. |

PU-046 update: PR #330 was refreshed again on head
163017e16e4611d5d71f5c4c62fc85f8d164b17b after the R205 artifact receipt was
committed and pushed.
All visible checks pass and the PR is MERGEABLE/CLEAN. The R203 Project Brain
path review thread is resolved. A new review thread found R200 references PU-046
review artifacts that were still ignored local files; R205 commits those
artifacts so the references are present in the PR tree. R206 records current-head
audit freshness after the artifact commit. The Linear
full-lifecycle scope-note attachment
for JSC-363 remains attachment 5d4b796b-9129-4561-92b6-489bb6982925 with local
digest ce1463fba3a0dd7daebe2ff15c55ecb54119d0c9a24456b907757b3e2920e414.
Because the Linear title and description still say Phase 1, this only supports
`tracker_scope_note_attached_fields_stale`; it does not prove Linear fields
current, Judge/PM readiness, runtime producer emission, delivery-truth
consumption, merge readiness, or final goal completion.

PU-045 artifact update: PR #330 review found that R198 referenced the PU-045
CircleCI env Project Brain reviewer artifacts without committing them. Commit
e6b245df4124da83310897fa94253bb86c7fa5b9 adds the adversarial, agent-native,
and best-practices reviewer artifacts under artifacts/reviews/. R207 records
the governed audit source against that artifact commit; remote push, remote tree
verification, thread resolution, and check refresh remain separate evidence
lanes.

PU-045/PU-046 whitespace update: PR #330 review found that five committed
review artifacts had extra blank EOF lines and failed the PR-range
git diff --check. Commit aec76ea1c46ee084ab018e474736d5d79ac0fce1 trims the
affected artifacts, and R208 records the corrected range validation. The R208
receipt commit 490cc6b7a7ca55adca1cb19269c1ca15bc43a100 was pushed to PR #330;
fresh review-thread refresh reports zero unresolved threads, PR #330 is
APPROVED, MERGEABLE/CLEAN, and visible checks pass.

Post-R210 PR #330 refresh: R210 was pushed through current PR #330 head
d217f528dd934bd8c285da11e8596481534be695. Fresh GitHub evidence reports PR #330
OPEN, MERGEABLE, APPROVED, no auto-merge request, all visible checks passing,
and all nine review threads resolved after the stale R210 depth-only thread was
answered. This updates the PR #330 lane only; PR #327, PR #328, PR #329, Linear,
Judge/PM readiness, runtime producer emission, delivery-truth consumption, merge
execution, and final goal completion remain separate evidence lanes.

Post-R211 validator repair: after the R211 route-truth commit was pushed as
1175bfcbd25ed5f2b5ad345f2369af8de2f4dc1b, PR #330 checks passed, but a new
review thread found that depth-1 review checkouts could not prove receipt
ancestry for otherwise declared self-referential route receipts. R212 repairs
\`scripts/check-goal-audit-freshness.py\` to fetch the missing recorded commit
from \`origin\` in shallow checkouts before evaluating the real changed-path
diff; R213 then rejects self-reported shallow changed-file claims when the
fetched diff includes non-goal files. This is a validator compatibility repair only; it does
not claim PR stack merge execution, Linear field alignment, Judge/PM readiness,
runtime producer emission, delivery-truth consumption, or final goal completion.

## Artifact Index

| Linear Key | Canonical Slug | Active Spec | Active Plan | Local Status | Notes |
| --- | --- | --- | --- | --- | --- |
| JSC-198 | flow-ops-closure-evidence-reconciliation | `.harness/specs/2026-05-09-jsc-198-flow-ops-closure-evidence-reconciliation-spec.md` | `.harness/plan/2026-05-09-JSC-198-flow-ops-closure-evidence-reconciliation-plan.md` | Later / legacy context | Artifact status remains `draft`; local queue demotes this behind JSC-311 integration unless stale closure repeats. |
| JSC-282 | command-truth-cockpit | `.harness/specs/coding-harness-agent-cockpit-compression-spec.md` | `.harness/plan/2026-05-08-architecture-JSC-282-command-truth-cockpit-plan.md` | Complete / historical | The earlier 2026-05-07 plan is explicitly superseded by the 2026-05-08 plan. |
| JSC-283 | packaged-skill-behavior-assurance | `.harness/specs/2026-05-08-jsc-283-packaged-skill-behavior-assurance-spec.md` | `.harness/plan/2026-05-08-architecture-JSC-283-packaged-skill-behavior-assurance-plan.md` | Resolved historical context | Local queue records this work as done. Keep these artifacts as historical references only; do not route new work from their older front matter. |
| JSC-288 | governance-trust-repair | `.harness/specs/2026-05-08-jsc-288-governance-trust-repair-spec.md` | `.harness/plan/2026-05-08-architecture-JSC-288-governance-trust-repair-plan.md` | Resolved historical context | Local queue records this work as done. Keep these artifacts as historical references only; do not route new work from their older front matter. |
| JSC-289 | ci-migration-boundary-recovery | `.harness/specs/2026-05-08-JSC-289-ci-migration-boundary-recovery-spec.md` | `.harness/plan/2026-05-08-architecture-JSC-289-ci-migration-boundary-recovery-plan.md` | Resolved historical context | Local queue records this work as done. Keep these artifacts as historical references only; do not route new work from their older front matter. |
| JSC-290 | validation-typed-gate-specs | `.harness/specs/2026-05-09-validation-typed-gate-specs-spec.md` | `.harness/plan/2026-05-09-JSC-290-validation-typed-gate-specs-plan.md` | Resolved historical context | Local queue records this work as done. Keep these artifacts as historical references only; do not route new work from their older front matter. |
| JSC-301 | route-decision-contract | `.harness/specs/2026-05-11-jsc-301-route-decision-contract-spec.md` | `.harness/plan/2026-05-11-JSC-301-route-decision-contract-plan.md` | Archived PR closeout context | Not the next active implementation slice. Keep as dependency context for JSC-311 control-plane work. |
| JSC-311 | he-phase-exit-evidence-gates | `.harness/specs/2026-05-13-jsc-311-he-phase-exit-evidence-gates-spec.md` | `.harness/plan/2026-05-13-JSC-311-he-phase-exit-evidence-gates-plan.md` | Implemented in current checkout; validation/PR closeout pending | PR #247 merged the internal `HeGateResult/v1` / `HePhaseExit/v1` contract and worktree baseline. The current checkout adds the operator-visible `harness next --phase-exit <artifact>` path. |
| JSC-331 | harness-assurance-artifact-handling | n.a. | `.harness/plan/2026-05-18-agent-testing-gates-harness-assurance-plan.md`; `.harness/research/audits/2026-05-20-evidence-led-codebase-gap-audit.md`; `docs/goals/jsc-331-goal-governed-evidence-led-implementation/goal.md` | Active assurance route with ready-not-started Goal Governor board | Selected instead of creating a duplicate issue because live Linear already has a coding-harness apparatus/assurance lane. The audit now adds the Codex runtime-evidence contract and `.agents` observed-state bridge as the next durable hardening targets. The Goal Governor board is prepared for owner kickoff and begins with read-only governor bootstrap, not Worker implementation. JSC-308 remains related HE artifact-policy context. |
| JSC-363 | codex-runtime-evidence-verifier-cockpit | `.harness/specs/2026-05-24-codex-runtime-evidence-verifier-cockpit-spec.md` | `.harness/plan/2026-05-24-codex-runtime-evidence-verifier-cockpit-plan.md`; `docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md`; `docs/goals/codex-runtime-evidence-verifier-cockpit/notes/execution-tracker.md`; `.harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md`; `.harness/research/deep/2026-05-26-codex-ecosystem-operational-review.md`; `.harness/research/deep/2026-05-27-codex-system-prompt-operational-analysis.md` | Current active Goal Governor route for this thread | The board governs the full lifecycle, not just Phase 1. The thin execution tracker is the restart surface. No PR route is active after PR #380 merged into current main at `b436db70eea4b0f2a29473235cadcf7789dc81fb`. Next route action is unblock Linear access or get owner classification for JSC-363 field-text currency before broader closeout work. |
| JSC-395 | advisory-stale-document-archive-candidate-reporting | `.harness/specs/2026-06-05-advisory-stale-document-archive-candidate-reporting-spec.md` | `.harness/plan/2026-06-05-advisory-stale-document-archive-candidate-reporting-trace-plan.md`; `.harness/plan/2026-06-05-advisory-stale-document-archive-candidate-reporting-execution-plan.md` | Current active implementation route for this branch | Implements an advisory, read-only archive-candidate report and docs-gate projection. It must preserve the boundary that candidate findings are not archive, delete, demotion, or movement authority. |

## Duplicate Resolution

| Linear Key | Duplicate Pattern | Resolution | Remaining Risk |
| --- | --- | --- | --- |
| JSC-282 | Two command-truth cockpit plans looked active: 2026-05-07 and 2026-05-08. | Marked `.harness/plan/2026-05-07-architecture-JSC-282-command-truth-cockpit-plan.md` as `superseded` by the 2026-05-08 plan. | None for local routing; live Linear was not refreshed in this pass. |
| JSC-311 | 2026-05-11 and 2026-05-13 spec/plan pairs exist for phase-exit evidence gates. | 2026-05-11 artifacts were already marked `superseded`; 2026-05-13 artifacts remain canonical for the merged internal contract and follow-up routing. | After this checkout is delivered, remaining risk moves to live Linear/PR closeout and future session-evidence ingestion. |
| JSC-331 | The 2026-05-18 assurance plan was active but had no Linear owner and was not indexed. | Selected live issue JSC-331, added artifact handling routine to the plan, and synced the 2026-05-21 runtime-evidence audit update to Linear. | Live Linear is now reachable for this lane. Remaining risk is implementation/PR closeout evidence, not tracker reachability. |

## Closeout Reconcile Items

- PR #315 and PR #316 are both in merged state, both PR/CI lanes have all checks
  passing on current PR heads, and both PRs report zero unresolved review threads
  after a fresh review-thread refresh. Merge-readiness and Linear scope alignment
  are still blocked pending a successful check-goal-board run on current HEAD and
  confirmed live Linear mutation confirmation.
- Live Linear was refreshed for JSC-331 on 2026-05-21; tracker closure and
  live issue status for other issues remain explicit external actions.
- JSC-283, JSC-288, JSC-289, and JSC-290 are no longer active routing items in
  this index. Their older draft front matter is historical artifact state, not a
  current status-drift claim.
- JSC-311's current checkout implements the explicit artifact visibility path
  and adds `runtime-card/v1` as the cockpit summary input for `harness next`.
  Remaining JSC-311 closeout work is validation, PR #250 CI recovery, live
  Linear reconciliation, and a future session-collector evidence adapter slice
  if admitted separately.
- JSC-331 now owns the current harness assurance and route-driving artifact
  handling routine. The 2026-05-20 evidence-led audit is the current graded
  fix plan and now includes the Codex runtime-evidence contract and `.agents`
  observed-state bridge. The Goal Governor kickoff board is
  `docs/goals/jsc-331-goal-governed-evidence-led-implementation/goal.md`.
  Before any `.harness` artifact drives implementation, confirm live Linear
  ownership, tracked state, referenced-path existence, stale frontmatter
  disposition, active-index freshness, native goal reconciliation, board
  validity, and completion-blocking review evidence from `$he-code-review`,
  `@testing-reviewer`, `$simplify`, `$unslopify`,
  `$improve-codebase-architecture`, and `$ubiquitous-language` when
  implementation changed.
- JSC-363 is the current execution route for the Codex Runtime Evidence
  Verifier Cockpit goal. Use
  `docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md` as the
  cockpit and
  `docs/goals/codex-runtime-evidence-verifier-cockpit/notes/execution-tracker.md`
  as the thin restart surface. Keep
  `.harness/research/audits/2026-05-26-evidence-led-codebase-gap-audit.md`
  freshness enforced through `scripts/check-goal-board.py`, and keep Linear,
  PR, CI, review-thread, Project Brain, and runtime evidence truth separated in
  receipts. Historical compatibility evidence and PR #322 through PR #374 route
  ledgers are immutable provenance only; they are not current route truth. Current
  main route provenance is PR #374 merged into `main` as squash
  commit `b7b5d9f48fb9369c29a4cd9902acde88285bfb22`. No PR lane is active.
  PU-013 runtime cockpit integration proof is merged and pulled back with no
  production code patch required. Delivery-truth consumption, Linear field-text
  currency, documentation accuracy, Judge/PM readiness, and parent completion
  remain unclaimed. R149 records
  the post-merge refresh after PR
  #312 merged into main as squash commit
  `7e8cb93fa16636336194e15e53a592117b9f276a`. R150/R152 record the PR #318
  and PU-040 validator-hardening lane. PR #319 merged into main as squash
  commit `1afb519f7623f109b7a383688449c031541ff3dd`; R154 is the current
  route-truth reanchor because the latest pre-squash branch receipt R153 is no
  longer reachable from current main. PR #322 was the live branch lane
  for `codex/jsc-363-pr320-rerun`; R157 records that its stale PR title/body
  were repaired after `ci/circleci: linear-gate` failed on missing JSC-363 PR
  metadata. R158 records remediation for PR #322 review-thread findings,
  including the release-readiness handoff-evidence fix, and was pushed as
  `fa74a817fd5b476f10510ef26803c5a2790abd91`. R159 records the remaining
  goal-evidence follow-up for R155 validators and current-PR handoff wording,
  and was pushed as `f208aa3da8d7c56fb36a7a121dd453a3f4268ecd`. R160 records
  the release-readiness closeout blocker remediation and was pushed as
  `aa9a478d57d0cf0362765ab21280e1e41032d4e0`: explicit
  `releaseReadinessImpact` values now feed top-level closeout blockers, with
  governed-change regression coverage. R161 records the live git-env sanitizer
  remediation for PR #322 review thread `PRRT_kwDORWZJCc6F6Lc6`: local git
  inspection now uses the shared safe-env minimal policy and the regression
  covers `GIT_COMMON_DIR`, `GIT_DIR`, `GIT_WORK_TREE`, and
  `GIT_INDEX_FILE`. R162 records reviewed release-readiness classification and
  Windows behavior-test shim remediation: live closeout now blocks unknown
  release-readiness impact, non-live omission remains lifecycle-compatible, and
  the behavior-test script prefers `vitest.cmd` under the Windows platform
  override. R163 records the input-mode release-readiness override remediation
  for PR #322 review thread `PRRT_kwDORWZJCc6F6XuZ`: explicit
  `--release-readiness-impact` now overlays normalized `--input` packets before
  report generation while live `--pr` mode remains owned by
  `buildLivePrCloseoutInput`. PR #322 checks, CodeRabbit/review-thread truth,
  linked-issue status, and Linear JSC-363 must be refreshed after the next push
  before any closeout claim.
  R164 records current-head reconciliation for PR #322 head
  27e525eedcc1ef493b51499c983411bd54f8e1fe after the board caught the
  pre-commit R163 head SHA. Live PR checks are green except CodeRabbit, which
  remains pending; linked-issue status and Linear JSC-363 still require
  separate refresh before any closeout claim.
  R165 records local reviewed remediation for the latest PR #322 review gaps on
  implementation commit `3c2cb159eda80334de526e74462736c0608d24b1`: source
  repo codestyle source-only gates remain fail-closed while downstream scaffold
  repos stay compatible by default, omitted release-readiness input is covered,
  inherited process-level `GIT_*` contamination is covered, PATH composition
  uses the platform delimiter, and strict-mode downstream behavior is now an
  executable regression. Push, remote checks, review threads, CodeRabbit,
  linked-issue truth, Linear, merge readiness, Judge/PM readiness, and final
  goal completion remain unclaimed until refreshed after the R165 push.
  R167 records local reviewed remediation for the PR #322 feedback-loop
  closure-evidence review thread on implementation commit `e4fb33e`: implemented
  feedback-loop gaps and recommendations now require non-empty evidence refs
  before the audit can report closure. R168 records local reviewed remediation
  for PR #322 review thread `PRRT_kwDORWZJCc6F7Fgx` on implementation commit
  `65c56a9`: `.harness/feedback-loops/index.json` is explicitly unignored
  as tracked durable evidence, sibling local outputs remain ignored,
  `.harness/README.md` documents the ledger, and `harness:audit-tracking`
  verifies the live git-ignore behavior. R169 records post-push reconciliation
  for PR #322 head e7bde7dc: the targeted feedback-loop ledger thread is
  resolved and the refreshed review-thread page returned no unresolved threads,
  but CodeRabbit and several CircleCI checks were still pending. R170 records
  local reviewed remediation for new review thread PRRT_kwDORWZJCc6F7LzF on
  implementation commit fbd472c: audit-tracking git probes now bind to the
  active repo root with sanitized Git environment and contaminated-env
  regression coverage. Push, remote checks green, CodeRabbit completion,
  review-thread resolution, linked-issue truth, Linear, merge readiness,
  Judge/PM readiness, and final goal completion remain unclaimed until
  refreshed after the R170 push.
  R171 records local reviewed remediation for review thread
  `PRRT_kwDORWZJCc6F7N2M` on implementation commit `6da8aca`: the package
  files whitelist now includes the three pnpm check quality guard scripts, and
  package-files regression coverage plus `pnpm pack --dry-run` prove the
  reviewed tarball surface locally. R172 records local reviewed remediation for
  review thread `PRRT_kwDORWZJCc6F7StG` on implementation commit `c5a1f39`:
  minimal Git environment sanitization now drops `GIT_CONFIG` and all
  `GIT_CONFIG_*` keys, with behavior tests proving inline config and
  config-file pointer contamination cannot hide untracked-file truth after
  sanitization. Push, remote checks green, CodeRabbit completion, review-thread
  resolution, linked-issue truth, Linear, merge readiness, Judge/PM readiness,
  and final goal completion remain unclaimed until refreshed after the R172
  push. R173 records local reviewed remediation for review thread
  `PRRT_kwDORWZJCc6F7XW0` on implementation commit `4d5039f`:
  `expectBehavior` now validates `given` and `should` context separately and
  requires exact deep equality between `actual` and `expected`, with regression
  coverage proving extra actual object fields no longer pass through subset
  matching. Push, remote checks green, CodeRabbit completion, review-thread
  resolution, linked-issue truth, Linear, merge readiness, Judge/PM readiness,
  and final goal completion remain unclaimed until refreshed after the R173
  push.
  R174 records local reviewed remediation for review threads
  `PRRT_kwDORWZJCc6F7cu8` and `PRRT_kwDORWZJCc6F7ezU` on implementation
  commit `36458dd`: the package files allowlist now includes the runtime
  source/test inputs required by packaged quality scripts without publishing
  \`src/dev/**\` or unregistered \`src/**/*.test.ts\` payloads, and the
  package-files regression verifies the actual packed tarball plus packed
  \`package.json\`. R175 records the pushed PR #322 head
  \`219854d4580fe19b13d5e1d03760f1506c7713c6\`, targeted resolution of those
  two review threads, and a fresh unresolved-thread query returning no
  unresolved threads; CodeRabbit, pr-pipeline, ci/circleci: check, and
  ci/circleci: orb-pinning were still pending at that refresh. Linked-issue
  truth, Linear, merge readiness, Judge/PM readiness, and final goal completion
  remain unclaimed.
  R176 records the GAP-001 Local Memory preflight implementation on commit
  `4641f9ca17d1ed13f075ef4bdde93a533f3616ca`: legacy positional preflight
  calls now fail closed to required Local Memory, explicit off/optional modes
  remain intentional, deterministic test overrides are gated and CI-rejected,
  and repo-like mode ambiguity is covered. R177 reanchors this Project Brain
  route and the governed 2026-05-26 audit freshness to that implementation
  head. R178 reanchors the same route after the generated architecture context
  refresh commit `f8fa4206d6ae85f28e557ffd5ca248938ff2bae7`. R179 reanchors
  it again after the architecture bootstrap sync commit
  `633b5cc48a0008fdd1f873c0962900c57bcd5e08`. Push, PR creation, remote
  checks, CodeRabbit, reviewDecision, Linear, merge readiness, Judge/PM
  readiness, and final goal completion remain unclaimed.
  Historical stacked PRs may still show CONFLICTING/DIRTY metadata because
  their old head/base refs are stale. That historical metadata is not an active
  open-PR merge blocker. Before any
  closeout, refresh Linear
  JSC-363, current PR/CI/review-thread truth, runtime producer evidence,
  delivery-truth consumption, Judge/PM readiness, merge execution, and final
  goal completion as separate lanes.
- JSC-308 is related broader HE runtime-authoring/process-exhaust context. Do
  not use it as the coding-harness tracker for the 2026-05-18 assurance plan
  unless Linear is explicitly reparented or updated later.
