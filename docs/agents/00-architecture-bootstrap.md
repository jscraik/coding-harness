---
last_validated: 2026-06-06
---

# Architecture bootstrap

## Table of Contents

- [Purpose](#purpose)
- [One-task-at-a-time intake](#one-task-at-a-time-intake)
- [Artifact validation gates](#artifact-validation-gates)
- [Exact behavior evidence](#exact-behavior-evidence)
- [Refresh workflow](#refresh-workflow)
- [Deterministic Fingerprints](#deterministic-fingerprints)
- [Stop conditions](#stop-conditions)

## Purpose

Use this guide first when a task changes architecture, policy flow, or cross-command behavior.
The root `ARCHITECTURE.md` file is the stable source map for high-level
boundaries and invariants, while `AI/context/diagram-context.md` and
`.diagram/` are generated context packs that prove the current implementation
shape. When a change adds or materially refreshes the root architecture map,
keep this guide in the same branch so agents know which architecture surface is
canonical and which surfaces are generated evidence.

## One-task-at-a-time intake

1. Confirm architecture artifacts exist:
   - `.diagram/manifest.json`
   - `AI/context/diagram-context.md`
2. Read `.diagram/manifest.json` to identify generated diagram types and timestamp.
3. Read only the relevant sections in `AI/context/diagram-context.md` for the task.
   - For schema, persistence, or data-integrity work, check `## erd` when
     present; otherwise use `## database` as the current diagram-cli
     persistence view.

4. For TypeScript-family implementation detail, run `bash
scripts/harness-cli.sh source-outline <path> --json` before opening full
   source, then unwrap only the needed symbol with `--symbol <name>`.
5. Route to deeper SOPs in `docs/agents/` after architecture context is loaded.

## Artifact validation gates

Run these checks before architecture-sensitive edits:

```bash
jq -r '.generatedAt, (.diagrams | length)' .diagram/manifest.json
rg -n '^## ' AI/context/diagram-context.md
harness docs-gate --mode advisory --json
```

If either command fails, refresh artifacts before proceeding.
When `docs-gate` reports required documentation surfaces for the same change category, update the listed operator guides in that PR before merge.
For command-registry deep-module splits, keep the public command spec small,
move action-specific option builders behind named internal adapter seams,
refresh `AI/context/diagram-context.md`, and update README command-surface
guidance when docs-gate reports a CLI-surface requirement.
For validation-lock, hook, or local CI-equivalent guard changes that refresh
`AI/context/diagram-context.md`, keep the generated `.diagram/` artifacts,
this guide, `AGENTS.md`, and `docs/agents/07b-agent-governance.md`
synchronized. The architecture context must show the current validation
dependencies, while `docs/agents/02-tooling-policy.md` and
`docs/agents/06-security-and-governance.md` describe operator execution and
pre-push governance.
The prompt-gate split follows this rule: keep `src/commands/prompt-gate.ts`
as a compatibility facade, keep `prompt-gate-command-spec.ts` as the registry
adapter, and keep CLI argument parsing plus prompt-template section validation
inside `src/lib/prompt-gate/`.
Gap-case follows the same command-registry split pattern: keep
`src/commands/gap-case.ts` as a compatibility facade, keep
`gap-case-command-spec.ts` as the registry adapter, and keep CLI argument
parsing, lifecycle validation, persistence, and presentation inside
`src/lib/gap-case/`.
Simulate follows the same command-registry split pattern: keep
`src/commands/simulate.ts`, `src/commands/simulate-analysis.ts`, and
`src/commands/simulate-analysis-recommendations.ts` as compatibility facades,
keep `simulate-command-spec.ts` as the registry adapter, and keep CLI argument
parsing, simulation orchestration, analysis, recommendations, and presentation
inside `src/lib/simulate/`.
Ci-migrate follows the same registry-boundary pattern: keep
`src/commands/ci-migrate.ts` as the migration orchestration facade, keep
`ci-migrate-command-spec.ts` as the registry adapter, and keep raw CLI
argument projection plus delegated helper routing inside
`src/lib/ci-migrate/`.
Init follows the same registry-boundary pattern: keep
`src/commands/init.ts` as the init orchestration facade, keep
`init-command-spec.ts` as the registry adapter, and keep raw CLI argument
projection plus issue-tracker/minimal-mode validation inside
`src/lib/init/cli-args.ts`.
Upgrade follows the same registry-boundary pattern: keep
`src/commands/upgrade.ts` as the compatibility facade, keep
`upgrade-command-spec.ts` as the registry adapter, keep raw CLI argument
projection inside `src/lib/upgrade/cli-args.ts`, keep contract/default
migration helpers inside `src/lib/upgrade/contract.ts`, keep the shared
upgrade option contract inside `src/lib/upgrade/types.ts`, keep template
and manifest updates inside `src/lib/upgrade/templates.ts`, and keep
upgrade orchestration inside `src/lib/upgrade/runner.ts`.
Brain follows the same registry-boundary pattern: keep `src/commands/brain.ts`
and `src/commands/brain-core.ts` as compatibility facades, keep
`brain-command-spec.ts` as the registry adapter, keep raw Project Brain flag
projection inside `src/lib/project-brain/cli-args.ts`, keep the dispatcher and
public export surface inside `src/lib/project-brain/cli.ts`, and keep
subcommand behavior inside `src/lib/project-brain/*-cli.ts`.
For north-star contract/scaffold updates that affect workflow authority, update this guide and `docs/agents/07b-agent-governance.md` together in the same PR.
For root-surface cleanup, use `docs/architecture/root-surface-classification.md` as the tracked classification contract. Move historical root evidence into `docs/archive/root-cleanup/` or a domain docs surface before considering deletion; when a tracked root entry is deleted under explicit destructive-cleanup authority, record that decision in the classification table. Keep `AGENTS.md`, this guide, `docs/README.md`, and `docs/agents/07b-agent-governance.md` synchronized when docs-gate reports architecture-context or agent-governance surfaces.
Rule lifecycle governance updates are architecture-adjacent when they alter the manifest schema, `rule-lifecycle-gate`, or rule metadata validation. Keep this guide synchronized with `AGENTS.md` and `README.md` when docs-gate reports architecture-context or contract-policy surfaces, and ensure schema validation resolves from the target repo root rather than the caller's shell cwd.
Documentation lifecycle governance updates are architecture-adjacent when they
alter `docs/doc-lifecycle-manifest.json`,
`docs/doc-lifecycle.schema.json`, `pnpm docs:lifecycle`, docs-gate
lifecycle validation, PR lifecycle fields, or downstream-template distribution
guards. Keep this guide synchronized with `AGENTS.md`,
`docs/architecture/documentation-layers.md`, and
`docs/agents/07b-agent-governance.md` when docs-gate reports
architecture-context or agent-governance surfaces.
Reader-task documentation eval changes are part of the same lane when they add
or alter `pnpm docs:task-eval`, fixture categories, fixture evidence
validation, or docs-surface automation. Keep `AGENTS.md`,
`docs/agents/00-architecture-bootstrap.md`, `docs/agents/07b-agent-governance.md`,
generated architecture context, and docs-gate-required surfaces synchronized so
reviewers can trace reader journeys, canon boundaries, review-state truth, and
downstream distribution assumptions from the architecture bootstrap surface.
Stale-document archive-candidate reporting is also architecture-adjacent when it
adds or alters `pnpm docs:archive-candidates`,
`docs-archive-candidates-report/v1`, scanner/classifier behavior,
docs-gate projection, or destructive-option rejection. Refresh generated
architecture context and keep this guide synchronized with `AGENTS.md`,
`README.md`, `CONTRIBUTING.md`, `docs/agents/02-tooling-policy.md`,
`docs/agents/06-security-and-governance.md`, and
`docs/agents/07b-agent-governance.md` when docs-gate reports
architecture-context or governance surfaces. The report remains advisory-only;
archive, move, delete, demotion, metadata rewrite, manifest, active-artifact,
or archive-index repair work requires a separate reviewed decision.
For agent-native cockpit work, treat decision-envelope, generated environment action, hook setup, runtime-card evidence, and diagram-context changes as architecture-adjacent surfaces. Run `bash scripts/check-diagram-freshness.sh` explicitly for those changes, and use `bash scripts/refresh-diagram-context.sh --force` when the check reports stale or missing artifacts. Keep this guide synchronized with `AGENTS.md` and `docs/agents/07b-agent-governance.md` when `docs-gate` asks for architecture-context evidence.
RouteDecision lifecycle metadata belongs to this cockpit architecture-adjacent lane: keep `route-decision/v1` contract changes additive to `harness-decision/v1`, refresh `AI/context/diagram-context.md`, and commit this guide with the required docs-gate governance surfaces when `docs-gate` reports the architecture-context surface.
Risk-tiered RouteDecision mutation authority is still advisory route metadata:
only low-risk repo-local mutation routes with current evidence, validator
ownership, agent-local authority (`authority=agent_local`), and no network
dependency (`requiresNetwork=false`) may omit human review, while destructive,
production, release, security, credential, merge, public-contract,
goal-completion, verifier-disagreement, ambiguous-governance, external-impact,
tracker-sensitive, unknown, or network-dependent mutation remains HILT-governed.
This policy must not turn target commands into execution authority or support
delivery-truth, merge-readiness, Judge/PM, or goal-completion claims.
Generated Codex environment action changes that add validation script actions or branch-attachment behavior are architecture-adjacent when they refresh `AI/context/diagram-context.md`; commit the refreshed context pack and this guide with the required docs-gate governance surfaces when docs-gate reports the architecture-context surface.
Codex preflight changes are architecture-adjacent when they alter Local Memory,
Project Brain, or runtime-readiness enforcement. Legacy positional
`scripts/codex-preflight.sh` invocations must preserve the required Local
Memory default unless the caller explicitly selects `off` or `optional`.
When that parser or its generated template changes, refresh the architecture
context pack and keep this guide synchronized with `AGENTS.md` and
`docs/agents/07b-agent-governance.md` so future agents can trace the
fail-closed preflight contract from the architecture bootstrap surface.
Generated environment action merge repairs that preserve setup PATH behavior,
detached worktree attachment, or script-derived test/eval actions should keep
`AGENTS.md`, `docs/agents/00-architecture-bootstrap.md`, and `docs/agents/07b-agent-governance.md` in the PR when `AI/context/diagram-context.md` is part of the branch
diff, even if the architecture text is otherwise unchanged.
Goal-continuation, approval-plan, Flow Ops closure-evidence classifiers,
eval-seed, observed usage collection, and E2E/eval artifact changes that add or
reroute source modules must refresh `AI/context/diagram-context.md` in the same
PR so agent reviewers can discover the new evidence path from the architecture
context pack.
When closure-evidence follow-up changes fail-closed required-check
classification, outcome-closeout validation, generated Codex environment setup,
or init scaffolding tests in one branch, keep `AGENTS.md`, `docs/agents/00-architecture-bootstrap.md`, and `docs/agents/07b-agent-governance.md` in the diff with the
refreshed architecture context so reviewers can trace why the context pack
changed.
For release packaging changes that alter runtime dependency metadata, pass the packed CLI smoke path before publish, and commit any required `AI/context/diagram-context.md` refresh and its required docs-gate surfaces (including `AGENTS.md`, `docs/agents/00-architecture-bootstrap.md`, and `docs/agents/07b-agent-governance.md`) that pre-push or docs-gate reports.
For formatter or linter major-version migrations, expect generated architecture context to drop newly ignored local analysis paths and refresh `AGENTS.md`, `docs/agents/00-architecture-bootstrap.md`, and `docs/agents/07b-agent-governance.md` with the committed `AI/context/diagram-context.md` update so reviewers know the architecture pack changed because tracked tooling rules changed.
For validation gate graph changes, refresh `AI/context/diagram-context.md` and keep the validation governance surfaces synchronized (`AGENTS.md`, `docs/agents/00-architecture-bootstrap.md`, and `docs/agents/07b-agent-governance.md`) when typed gate specs, phase-exit evidence gates, local review/validation artifact adapters, `harness next --phase-exit` visibility, parity tests, or resume-checkpoint guards are added or changed. Rollback: revert the branch to remove the typed mirror, evidence-gate contract, adapter wiring, dispatch guard, cockpit visibility, parity tests, and synchronized doc updates.
Type and artifact contract gate changes are part of this validation graph when
they alter `pnpm types:check`, `pnpm artifact:types`, Python/Pydantic
validation, TypeScript escape-hatch policy, JSON Schema contract validation, or
live CLI JSON contract validation. Keep generated architecture context
synchronized and commit this guide with the validation changes so future agents
can find the current typed contract entrypoint from the architecture bootstrap
surface. Rollback: remove the typed package scripts, CLI JSON manifest entries,
Python project dependency wiring, and generated context refresh together.
For runtime-card evidence adapter changes, treat the adapter as an
agent-native cockpit surface: keep `runtime-card/v1` and
`runtime-evidence-bundle/v1` advisory and artifact-backed, keep local evidence
reads and persisted outputs within `--repo`, and synchronize `AGENTS.md`,
`docs/agents/00-architecture-bootstrap.md`, and
`docs/agents/07b-agent-governance.md` when docs-gate reports governance
surfaces.
Runtime-card evidence producer changes are architecture-artifact changes because
they add durable evidence artifacts consumed by the agent cockpit. Refresh
`AI/context/diagram-context.md` and keep `AGENTS.md`,
`docs/agents/00-architecture-bootstrap.md`, and
`docs/agents/07b-agent-governance.md` in the PR when
`runtime-card --evidence-out`, `runtime-evidence-bundle/v1`, or related
producer and adapter wiring changes.

Runtime-card trace-out changes belong in `src/lib/runtime-trace/` and must
reuse the canonical run-record writer under `src/lib/contract/` instead of
inventing a second JSONL/hash-chain persistence path. Keep `--trace-out`
constrained to `artifacts/agent-runs/<runId>/events.jsonl`, require a fresh
run id with a pre-append claim, and fail closed on reused or pre-claimed run
ids; emitted traces are replay-ready audit/orientation evidence and must not
support closeout, CI, review, Linear, or merge-readiness claims by themselves.

Rollback expectations: the runtime-card trace-out owner must revert the trace
policy, CLI examples, generated architecture context, and any run-record writer
adapter changes in the same rollback. Any run IDs claimed before rollback must
be treated as invalid for closeout or replay support until a fresh
`runtime-card --trace-out artifacts/agent-runs/<runId>/events.jsonl` run proves
the restored contract.

Replay packet changes are replay contract work, not a new claim-support
rail. Keep `replay-packet/v1` inside `src/lib/replay/` as the pointer-only,
content-bound packet for replay seeds, hook execution identity, normalized event
summaries, stale-state classification, and redaction proof. Validators must
prove repo-relative path containment, SHA-256 reference integrity, hook file and
resolved-command provenance, timestamp ordering, TTL/head freshness semantics,
and rejection of raw prompts, transcripts, command output, screenshots, images,
or secret-like fields. Replay packets may support orientation and audit trails;
they must not support delivery-truth, review-state, external-state,
root-hygiene, merge-readiness, or Judge/PM claims without a future explicit
consumer boundary and matching governance update.

Runtime evidence receipts and private delivery-truth composition belong to the
same architecture-adjacent cockpit lane when they decide whether a claim can be
supported. Keep `evidence-receipt/v1` and `delivery-truth/v1` changes
additive, fixture-backed, and separated from public closeout authority until the
production verifier surface is intentionally wired. Refresh
`AI/context/diagram-context.md` and update this guide when those contracts add
new claim-support, freshness, head-SHA, blocker-class, or source-kind rules.
Judge/PM readiness checks are part of that private delivery-truth composition
lane. Keep issue/PR/goal authority matching inside
`src/lib/delivery-truth/judge-pm-audit-authority.ts`, keep clean-worktree,
local-validation, remote-state, and packet composition inside
`src/lib/delivery-truth/judge-pm-audit.ts`, and wire PR closeout through the
composed `goal_ready_for_judge_pm` claim rather than adding another public
closeout surface. The required proof is fixture-backed delivery-truth output
plus PR-closeout coverage that shows the claim blocks when Judge/PM authority,
validation, or external-state evidence is missing or stale.

Root-hygiene evidence belongs in the same deep-module lane when it supports
delivery-truth claims. Keep repository inventory, git-tracked path resolution,
policy digestion, freeze classification, and receipt generation inside
`src/lib/root-hygiene/`, then expose only the narrow verifier seam through
`src/lib/delivery-truth/root-hygiene-evidence.ts`. Update
`ARCHITECTURE.md`, `docs/architecture/root-surface-classification.md`, and
the generated architecture context when root-surface classification or
`root_surface_tidy` claim-support rules change, so agent cockpit guidance
continues to show where the work is placed.

Codex runtime evidence packet changes belong in the existing runtime deep module
before they feed the runtime-card adapter. Keep the public
`codex-runtime-evidence/v1` surface as a narrow facade over runtime types,
source classification, validation, and reference-integrity checks; refresh
`AI/context/diagram-context.md` and this guide when those packet or validator
modules change. Client user-message correlation belongs in the Codex runtime
identity contract only when the producer supplies explicit evidence; missing
message ids must remain null rather than inferred from turn, trace, timestamp,
PR, or artifact fields.
Environment-scoped permission evidence also belongs in this runtime deep
module. Keep environment id, cwd, expected cwd, executor kind, approval scope,
expected approval scope, sandbox policy refs, environment state, and failure
class inside `codex-runtime-evidence/v1`; project only compact
`environmentRefs` into runtime-card summaries. Tool-exposure snapshots remain a
separate exposure-summary module and should not be duplicated to satisfy this
environment contract.
Runtime-card Codex continuity belongs in the same runtime deep module. Keep
thread, turn, trace, goal, client-message, queue, approval, and
heartbeat/automation continuity as producer-supplied compact refs, validate
them against runtime evidence bundle sources and runtime-card receipt refs, and
project them only under `codexRuntime.continuity`. Do not infer continuity from
timestamps, PR data, branch names, artifact paths, or model output, and do not
let continuity refs authorize commands or satisfy delivery-truth, review-state,
external-state, merge-readiness, Judge/PM, or goal-completion claims.

Prompt-context receipt authority classification belongs in
`src/lib/prompt-context/`, not in prompt-context drift or delivery truth. Keep
`prompt-context-receipt/v1` pointer-only and `not_yet_emitted`; validate
authority metadata directly on source refs before any source can steer agent
behavior. Instruction sources may only use system policy, developer policy,
repo instruction, trusted skill, or user steering authority layers. Plugin
metadata, artifact data, review feedback, telemetry, and untrusted external
sources may orient or preserve audit evidence on non-instruction surfaces, but
must not become command authority, delivery-truth support, review-state support,
external-state support, Linear truth, merge-readiness proof, Judge/PM proof, or
goal-completion proof without a future typed consumer boundary and synchronized
governance update.

Browser evidence packet changes are runtime-cockpit evidence work, not delivery
truth. Keep `browser-evidence/v1` validation inside
`src/lib/browser-evidence/` and expose it through the existing
`evidence-verify` command facade only as advisory orientation/audit evidence.
Validators must prove manifest path containment, screenshot file existence,
required viewport coverage, PNG dimensions, non-blank image content, stable
console policy handling, and sanitized evidence messages. Browser evidence must
not prove delivery-truth, review-state, external-state, root-hygiene,
Judge/PM readiness, merge readiness, or command authority without a future
explicit consumer boundary and synchronized governance update.

Review-state and external-state packet changes are runtime-cockpit architecture
work even when they do not add public CLI commands. Keep `review-state/v1`
inside `src/lib/review-state/` as the PR review truth packet for reviewer
artifacts, unresolved threads, CodeRabbit/GitHub review summaries, and
validation ownership classification. Keep `external-state-snapshot/v1` inside
`src/lib/external-state/` as the PR/CI/review/tracker freshness packet, with
source completeness, TTL-derived staleness, head-SHA binding, and claim-support
eligibility handled by validators before delivery-truth composition consumes
those packets. When `src/lib/pr-closeout/` derives those packets from
normalized closeout input, keep that bridge read-only and validator-backed; it
may compose only claim-scoped `remote_checks_current` and
`review_threads_resolved` delivery-truth verdicts from validated packets, and
must not turn raw PR, CI, review, or Linear summaries into closeout, Linear,
root-hygiene, Judge/PM, or merge authority.

Action-review receipt changes are high-risk-action governance packet work, not
a new execution rail. Keep `action-review-receipt/v1` inside
`src/lib/action-review/` as the contract-only, `not_yet_emitted` receipt for
merge, release, destructive cleanup, and external tracker mutation review
decisions. Validators must prove reviewer independence, canonical actor
identity separation, current head binding, required evidence freshness,
allow/block/mismatch semantics, and stable error codes. The packet may support
orientation, governance, and audit trails, but it must not authorize commands,
satisfy delivery-truth claims, or prove merge readiness unless an emitted
producer and consumer boundary is implemented, validated, and documented in the
same change.

Artifact runtime surface changes are artifact-truth cockpit work, not a new
artifact warehouse. Keep `artifact-runtime-surface/v1` inside
`src/lib/artifact-runtime-surface/` as the pointer-only contract for
implementation notes, review artifacts, screenshots, CSV/PDF/document outputs,
runtime cards, reports, and lifecycle artifacts that steer execution or support
claims. Validators must prove repo-relative path safety, symlink/realpath
containment in the standalone semantic path, checksum and size consistency,
current-head and lineage matching, preview applicability, timestamp ordering,
and value-level leakage rejection before an artifact can support a claim.
Orientation or audit-trail artifacts may be stale or blocked, but they must not
prove delivery-truth, review-state, external-state, root-hygiene, merge
readiness, or Judge/PM readiness without current typed claim refs.

Prompt-context drift report changes are agent-readiness cockpit work, not a
new delivery-truth rail. Keep `prompt-context-drift-report/v1` inside
`src/lib/prompt-context-drift/` as the pointer-only integrity report for
prompt-context receipts, active artifacts/routes, Project Brain memory and
knowledge refs, runtime-card or handoff evidence, and receipt head-SHA checks.
Validators must prove repo-contained source refs, SHA-256 integrity, symlink
and realpath containment, current head binding, closed enum values, stale-state
classification, and raw/secret leakage rejection. `agent-readiness` may consume
the report as an advisory `prompt_context_drift` context surface, but it must
not authorize commands, satisfy delivery-truth claims, close JSC-363
acceptance criteria, or prove merge readiness.

Intermediary receipt coverage changes are real-time-truth cockpit work, not a
new closeout, delivery-truth, review-state, or external-state rail. Keep
`intermediary-receipt-coverage/v1` inside
`src/lib/intermediary-receipts/` as the contract-first,
`not_yet_emitted` packet for browser state, streamed status, mailbox status,
compaction summaries, visual state, real-time event snippets, external check
snapshots, operator steering echoes, and subagent status text. Validators must
prove full source-kind taxonomy coverage, complete deny-by-default
source-kind/claim-family policy entries, deterministic blocker-to-next-action
mapping, most-restrictive-wins summary aggregation, raw/secret leakage
rejection, current receipt/head-SHA binding for claim support, and
canonical-packet routing for protected external-state, review-state,
delivery-truth, Linear, Judge/PM, and merge-readiness claim families. Unbound
intermediary observations may orient agents, but they must not support
delivery, closeout, tracker, review, root-hygiene, Judge/PM, or merge-readiness
claims without a current `evidence-receipt/v1` plus the matching canonical
packet route. When intermediary receipt work also changes `harness next`
worktree-role decisions or PR closeout snapshot projections, keep those
surfaces advisory and evidence-bound: role-gated worktree state may block the
next recommendation, and snapshot status may classify PR lanes, but neither
surface becomes merge authority without current canonical evidence.

Steering-queue packet changes are continuation-recovery cockpit work, not a new
agent execution rail. Keep `steering-queue/v1` and
`steering-application-receipt/v1` inside `src/lib/steering-queue/` as advisory
packets for pending operator steering and attempted steering application. The
queue packet owns instruction-source hashing, artifact identity, supersession,
stale-precondition classification, deterministic selected-item rules, and a
script-backed semantic validator. The application receipt must stay
pointer-only and bind the queue item, expected/current thread-turn-message
context, stale-precondition result, runtime-card update reference, and current
head SHA before it can explain whether steering was applied, rejected, or
blocked. These packets may support orientation and audit trails, but they must
not authorize commands, satisfy delivery-truth claims, prove Judge/PM
readiness, mutate trackers, or prove merge readiness until a separate
runtime-card integration explicitly defines that consumption boundary.

Tool promotion threshold changes are agent operating-system architecture, not
just prose hygiene. If an operator must apply the same judgment twice, or the
same failure mode can recur across slices, encode the rule as the smallest
durable validator, tool, or skill hook and keep the generated architecture
artifacts synchronized. If the knowledge is genuinely one-off implementation
context, keep it in plan evidence or implementation notes instead of adding a
new execution surface.

Trust-boundary validator changes that add script-backed evidence reports, such
as `audit-reference-report/v1`, are architecture-adjacent when they classify
repository paths, git-tracked proof, or stale artifacts. Refresh
`AI/context/diagram-context.md` and synchronize `AGENTS.md`,
`docs/agents/00-architecture-bootstrap.md`, and
`docs/agents/07b-agent-governance.md` whenever making trust-boundary validator
changes that classify repo paths, git-tracked proof, or stale artifacts.

For required-check architecture changes, keep the branch-protection identity set aligned across `harness.contract.json`, `.harness/ci-required-checks.json`, generated scaffold templates, and external app checks such as `semgrep-cloud-platform/scan`.
When required-check or CI migration logic is split into deep modules, keep the
public command facade as orchestration only, add or update executable module
ratchets in `src/lib/architecture/module-boundaries.test.ts`, and document the
new seam in `docs/architecture/module-boundaries.md` so future agents can work
inside the module without bypassing the boundary.
For CI ownership architecture changes, keep `harness.contract.json` `ciOwnership` aligned with those required-check identities: CircleCI remains the primary PR gate, CodeRabbit remains independent review evidence, Semgrep Cloud remains independent external security evidence, and GitHub Actions workflows must not become automatic PR gates without a deliberate contract migration.
For PR evidence-template changes, keep the local PR-template validator aligned
with the GitHub PR body contract so agent closeout, CI validation, and reviewer
handoff parse the same required ledger headings and fields.
When PR evidence-template changes admit repeated steering feedback as a
stop-the-line system signal, keep the generated scaffold, validator tests,
steering guard, Project Brain/memory destination, and architecture context pack
aligned so the proof survives beyond the current chat turn.
For PR closeout evidence changes, treat `pr-closeout/v1` and
`harness pr-closeout` as read-only architecture-adjacent handoff surfaces.
Refresh `AI/context/diagram-context.md` and keep this guide synchronized with
`AGENTS.md` and `docs/agents/07b-agent-governance.md` when docs-gate reports
the architecture-context surface.
Delivery lifecycle closeout snapshots belong inside the existing
`src/lib/pr-closeout/` boundary. Keep lifecycle lane summaries, worktree role
classification, review artifact status, Linear mutation availability, release
readiness impact, and queue/handoff/approval blockers read-only inside
`pr-closeout/v1`; they describe delivery truth for handoff and must not perform
external mutations, resolve review threads, update Linear, or prove merge
readiness without the matching fresh external-state evidence.
Structured closeout success must remain claim/evidence driven: model-written
summaries may point at verifier output, but current required evidence status,
source, freshness, head SHA, blocker class, and verification timestamp are the
architecture contract that determines pass, blocked, or unknown outcomes.
When PR closeout starts consuming coding-harness gate evidence, keep those gates
harness-owned and HE-compatible rather than HE-owned, refresh the architecture
context pack, and require the PR template pattern scope inventory to show which
sibling gate and evidence surfaces were checked.
When artifact-routine or pattern-scope commands become part of closeout
evidence, treat them as architecture-adjacent assurance surfaces: refresh the
context pack, keep command registry/capability metadata aligned, and prove that
Project Brain inputs are fresh before they route implementation.
When PR closeout live-input or blocker classification changes how GitHub state,
review-thread evidence, or closeout-gate artifacts are trusted, refresh the
context pack and keep this architecture bootstrap guide in the PR so agents can
trace the fail-closed evidence boundary.

## Exact behavior evidence

When architecture or cross-command behavior changes, do not rely only on broad
validation. Run the smallest real executable path that exercises the exact
production code touched whenever feasible.

Prefer invoking the production function, class, CLI command, shell script,
validator, or route directly. If no existing test covers the path, create a
temporary local reproduction harness under `codex-scripts/`, keep it
gitignored, and import or invoke production code directly instead of copying
implementation into the harness.

If the exact path cannot run because it depends on unavailable credentials,
external services, unsafe side effects, or missing generated runtime state,
record that blocker explicitly and run the nearest meaningful validation
instead. Do not describe production behavior as verified unless the touched
path actually ran.

## Refresh workflow

Use this sequence when artifacts are missing or stale:

```bash
bash scripts/refresh-diagram-context.sh --dry-run
bash scripts/refresh-diagram-context.sh --force
jq -r '.generated_at, .diagram_count, .changed' .diagram/context/diagram-context.meta.json
```

The `scripts/hook-pre-push.sh` leaf adapter, and the manual `make hooks-pre-push` wrapper around it, run `scripts/check-diagram-freshness.sh`. That gate now skips refresh work unless architecture-sensitive implementation paths changed, and it ignores test-only source changes to keep the local loop tighter.
The refresh script must use repo-owned package-manager execution for both
availability checks and generation: `pnpm --dir "$ROOT_DIR" exec diagram --version`
for the pre-`pushd` availability probe, and `pnpm exec diagram` after entering
the repo root for generation. Do not require a globally installed `diagram`
binary when the package-manager-scoped command is available,
because pre-push validation runs from disposable worktrees where PATH may not
expose dependency bins directly.
The freshness gate compares the standalone `.diagram/*.mmd` artifacts for semantic diagram drift and treats volatile embedded sections in `AI/context/diagram-context.md` as generated presentation detail. Keep `scripts/lib/normalize-mermaid-artifact.cjs` aligned with that split so changes to the combined context pack do not create false stale-artifact failures while the underlying Mermaid artifacts still catch real topology changes.

## Deterministic Fingerprints

`scripts/refresh-diagram-context.sh` normalizes node identities before sorting to keep generated artifacts stable:

- `rawNodeFingerprint(rawId)` extracts the trailing fingerprint suffix with `/_([0-9a-f]{8})$/i` (case-insensitive).
- If a suffix is present, the canonical key is the matched 8-hex fingerprint converted to lower case.
- If no suffix is present, normalization falls back to `rawId.toLowerCase()`.
- Deterministic ordering uses this canonical key, so output ordering can change when fingerprint suffixes or raw node IDs change.
- Duplicate-node rewrites must carry a rename map through dependent Mermaid selectors such as `class old_id className`; generated diagrams are stale if class selectors reference node IDs that no longer appear after deduplication.
- Regression coverage for diagram identity rewrites should exercise both node rewrites and dependent class selectors so the generated context pack cannot silently preserve stale Mermaid references.

## Stop conditions

Stop and ask for direction when any gate fails:

- `scripts/refresh-diagram-context.sh` exits non-zero.
- `AI/context/diagram-context.md` is missing after refresh.
- Diagram output does not include the command or module area touched by your change.
