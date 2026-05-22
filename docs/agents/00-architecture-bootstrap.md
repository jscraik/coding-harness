---
last_validated: 2026-05-21
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
For north-star contract/scaffold updates that affect workflow authority, update this guide and `docs/agents/07b-agent-governance.md` together in the same PR.
Rule lifecycle governance updates are architecture-adjacent when they alter the manifest schema, `rule-lifecycle-gate`, or rule metadata validation. Keep this guide synchronized with `AGENTS.md` and `README.md` when docs-gate reports architecture-context or contract-policy surfaces, and ensure schema validation resolves from the target repo root rather than the caller's shell cwd.
For agent-native cockpit work, treat decision-envelope, generated environment action, hook setup, runtime-card evidence, and diagram-context changes as architecture-adjacent surfaces. Run `bash scripts/check-diagram-freshness.sh` explicitly for those changes, and use `bash scripts/refresh-diagram-context.sh --force` when the check reports stale or missing artifacts. Keep this guide synchronized with `AGENTS.md` and `docs/agents/07b-agent-governance.md` when `docs-gate` asks for architecture-context evidence.
RouteDecision lifecycle metadata belongs to this cockpit architecture-adjacent lane: keep `route-decision/v1` contract changes additive to `harness-decision/v1`, refresh `AI/context/diagram-context.md`, and commit this guide with the required docs-gate governance surfaces when `docs-gate` reports the architecture-context surface.
Generated Codex environment action changes that add validation script actions or branch-attachment behavior are architecture-adjacent when they refresh `AI/context/diagram-context.md`; commit the refreshed context pack and this guide with the required docs-gate governance surfaces when docs-gate reports the architecture-context surface.
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

The local `make hooks-pre-push` path also runs `scripts/check-diagram-freshness.sh`. That gate now skips refresh work unless architecture-sensitive implementation paths changed, and it ignores test-only source changes to keep the local loop tighter.
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
