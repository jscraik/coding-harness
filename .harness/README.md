# Harness Control Plane

## Table of Contents

- [Tracking Policy](#tracking-policy)
- [Authority Levels](#authority-levels)
- [Directory Map](#directory-map)
- [Admission Rule](#admission-rule)

## Tracking Policy

Track curated Markdown and JSON contract files under `.harness`. Ignore runtime,
backup, database, cache, and bulk snapshot output.

`.harness` is part of the repository control plane, but it is not a dumping
ground. Durable policy, decisions, execution inputs, and curated context should
move with the repository. Local run state should stay local.

Do not rely on a blanket ignore rule to decide whether a `.harness` file is
repository truth. Classify the artifact first:

- Track stable control-plane inputs: policy, decisions, accepted specs/plans,
  curated research, intent packets, validator manifests, and example contracts.
- Keep mutable runtime output local: run directories, databases, caches,
  snapshots, imported local learning feeds, bulk telemetry, and live browser
  views.
- Promote generated evidence only when a spec, plan, PR, validator, or decision
  names it as an acceptance artifact and the artifact has been redacted for
  local paths, secrets, and bulky telemetry.

## Authority Levels

| Level | Meaning |
| --- | --- |
| `policy` | Non-negotiable project invariants and operating rules. |
| `decision` | ADRs, tradeoffs, and accepted constraints. |
| `execution-input` | Approved work slices that may directly route implementation. |
| `secondary-context` | Useful evidence and intent, but not implementation authority by itself. |
| `generated-runtime` | Local command output, caches, snapshots, or mutable state. |
| `backup/scratch` | Recovery or temporary files that should not be reviewed as repo truth. |

## Directory Map

| Path | Level | Tracking |
| --- | --- | --- |
| `.harness/core/**.md` | `policy` | Track |
| `.harness/decisions/**.md` | `decision` | Track |
| `.harness/linear/**.md` | `execution-input` | Track |
| `.harness/active-artifacts.md` | `execution-input` | Track |
| `.harness/refactors/**.md` | `execution-input` | Track |
| `.harness/features/**.md` | `secondary-context` | Track |
| `.harness/implementation-notes/**.md` | `secondary-context` | Track when they admit steering, capture implementation proof, or are referenced by a validator |
| `.harness/implementation-notes/**.html` | `generated-runtime` | Keep local while used as a live browser view; promote only as a reviewed final artifact |
| `.harness/intent/**.md` | `execution-input` | Track when tied to an accepted plan, goal, or review packet |
| `.harness/intent/**.json` | `execution-input` | Track when it is a stable intent, baseline, or review receipt; do not track bulky runtime captures |
| `.harness/strategy/**.md` | `secondary-context` | Track |
| `.harness/triage/**.md` | `secondary-context` | Track |
| `.harness/review/**.md` | `secondary-context` | Track when curated |
| `.harness/evals/**.md` | `secondary-context` | Track when produced by Harness Engineering |
| `.harness/solutions/**.md` | `secondary-context` | Track when produced by Harness Engineering |
| `.harness/ideate/**.md` | `secondary-context` | Track when produced by Harness Engineering |
| `.harness/brainstorm/**.md` | `secondary-context` | Track when produced by Harness Engineering |
| `.harness/specs/**.md` | `execution-input` | Track when produced by Harness Engineering |
| `.harness/plan/**.md` | `execution-input` | Track when produced by Harness Engineering |
| `.harness/memory/LEARNINGS.md` | `policy` | Track |
| `.harness/learnings/*.example.json` | `policy` | Track as reusable learning-loop examples |
| `.harness/learnings/enforcement-status.json` | `policy` | Track when it represents the repo intent for enforcement posture |
| `.harness/learnings/*.local.json` | `generated-runtime` | Do not track imported local reviewer, session, or telemetry feeds |
| `.harness/knowledge/**.md` | `secondary-context` | Track |
| `.harness/quality/**` | `policy` | Track |
| `.harness/review-log.md` | `secondary-context` | Track |
| `.harness/media/**/*.md` | `secondary-context` | Track sidecars, prompts, and review notes for promoted media artifacts |
| `.harness/media/**/*.json` | `secondary-context` | Track metadata for promoted media artifacts |
| `.harness/media/**/*.{png,jpg,jpeg,webp}` | `generated-runtime` | Do not track by default; promote only when the image is a required review/spec artifact |
| `.harness/ci-required-checks.json` | `policy` | Track |
| `.harness/ci-provider-transition-status.json` | `policy` | Track |
| `.harness/artifact-provenance.json` | `policy` | Track |
| `.harness/rule-lifecycle-manifest.json` | `policy` | Track |
| `.harness/research/evidence-patterns.json` | `policy` | Track |
| `.harness/research/README.md` | `policy` | Track as the research intake and promotion map |
| `.harness/research/audits/**.md` | `secondary-context` | Track when referenced by adopted evidence patterns, plans, or specs |
| `.harness/research/deep/**.md` | `secondary-context` | Track when listed by `.harness/research/evidence-patterns.json` |
| `.harness/evidence/**` | `generated-runtime` | Do not track raw command evidence by default; promote redacted fixture or closeout evidence explicitly |
| `.harness/guardrails/**` | `generated-runtime` | Do not track generated guardrail snapshots unless a validator consumes the exact file |
| `.harness/metrics/**` | `generated-runtime` | Do not track local metrics snapshots by default |
| `.harness/*-manifest.json` | `policy` | Track with care when validators consume it |
| `.harness/backups/**` | `backup/scratch` | Do not track |
| `.harness/*.db` | `generated-runtime` | Do not track unless promoted to a fixture |
| `.harness/ci-migrate-snapshots/**` | `generated-runtime` | Do not track unless a fixture or doc contract consumes it |
| `.harness/runs/**` | `generated-runtime` | Do not track |
| `.harness/memory/codex-learned/**` | `generated-runtime` | Do not track |
| `.harness/memory/codex-preflight-overrides.env` | `generated-runtime` | Do not track |
| `.harness/rollback-marker.json` | `generated-runtime` | Do not track; use a decision or plan note for durable rollback policy |

## Admission Rule

Secondary context is not execution authority on its own. Files under
`.harness/review`, `.harness/strategy`, `.harness/triage`, `.harness/features`,
`.harness/ideate`, and `.harness/brainstorm` can inform work, but they only
drive implementation after an admitted `.harness/linear`, `.harness/refactors`,
`.harness/specs`, or `.harness/plan` slice references them.

Deep research evidence becomes implementation authority only when it is listed
in `.harness/research/evidence-patterns.json` with an `adopted` status,
target surfaces, a disposition reason, and a validation command. Deferred or
unlisted research remains secondary context.
