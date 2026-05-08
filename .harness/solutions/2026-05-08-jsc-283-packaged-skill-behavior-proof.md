---
schema_version: 1
title: JSC-283 Packaged Skill Behavior Proof
date: 2026-05-08
status: solved
domain: governance
owner: agent-ops
freshness_review: 2026-06-08
project_brain_status: updated
project_brain_evidence:
  source: ".harness/solutions/2026-05-08-jsc-283-packaged-skill-behavior-proof.md"
  target: ".harness/knowledge/governance/knowledge.md"
  reason: "Packaged skill proof changed the repository closeout and release-gate admission contract."
---

# JSC-283 Packaged Skill Behavior Proof

## Table Of Contents

- [Problem](#problem)
- [Resolution](#resolution)
- [Evidence](#evidence)
- [Reusable Rule](#reusable-rule)
- [Maintenance](#maintenance)
- [Project Brain Sync](#project-brain-sync)

## Problem

JSC-283 needed proof that the coding-harness skill works after packaging, not
only from the source checkout. Source-only validation could miss broken packaged
references, missing runtime dependencies, clean-install failures, or unsafe
`harness init --update` behavior in downstream repositories.

The first eval artifact also used a non-canonical filename and did not satisfy
the Harness Engineering eval-report identity contract, so future agents could
not rely on it as clean closure proof.

## Resolution

The packaged behavior proof is now explicit and bounded:

- The eval report lives at the canonical identity path
  `.harness/evals/coding-harness-jsc-283-packaged-skill-behavior-assurance-eval.md`.
- The report passes the `he-eval-report` validator, artifact identity lint, and
  frontmatter safety lint.
- The implementation commit records packaged command-reference validation,
  packaged skill validation, clean downstream install/init proof, and
  `.codex/environments/environment.toml` update-ownership behavior.
- The environment action file remains intentional. OpenAI Codex app docs treat
  local environments as a first-class app surface, and the Codex config
  reference keeps project-scoped `.codex/config.toml` as a supported trusted
  project override. The repository therefore keeps generated
  `.codex/environments/environment.toml` support, but protects user-owned files
  with sentinel-based update ownership instead of overwriting customized local
  environment actions.
- Release-gate promotion remains advisory until the fixture runner is committed
  as a reusable gate and rerun from a clean committed candidate.

## Evidence

- Linear parent: `JSC-283`.
- Plan:
  `.harness/plan/2026-05-08-architecture-JSC-283-packaged-skill-behavior-assurance-plan.md`
- Spec:
  `.harness/specs/2026-05-08-jsc-283-packaged-skill-behavior-assurance-spec.md`
- Refactor program:
  `.harness/refactors/packaged-skill-behavior-assurance.md`
- Eval:
  `.harness/evals/coding-harness-jsc-283-packaged-skill-behavior-assurance-eval.md`
- Implementation commit:
  `66fbb2f44c151323027d5ad93d5c169d519424ea`
- State-repair merge commit:
  `40155cfd`
- Local evidence bundle:
  `.harness/evidence/jsc-283-closure/` (ignored runtime evidence)
- External source comparison:
  OpenAI Codex local environments docs and Codex config reference were checked
  on 2026-05-08 before preserving `.codex/environments/environment.toml`
  generation as intentional repository behavior.

Validation rerun after the `he-eval-report` fix, recorded from the local
workspace where the Agent Skills checkout lived at
`/Users/jamiecraik/dev/agent-skills`:

- `python3 /Users/jamiecraik/dev/agent-skills/Plugins/harness-engineering/skills/he-eval-report/scripts/validate_eval_report.py .harness/evals/coding-harness-jsc-283-packaged-skill-behavior-assurance-eval.md`
  passed.
- `python3 /Users/jamiecraik/dev/agent-skills/Infrastructure/scripts/validation-and-linting/he_artifact_identity_lint.py .harness/evals/coding-harness-jsc-283-packaged-skill-behavior-assurance-eval.md`
  passed.
- `python3 /Users/jamiecraik/dev/agent-skills/Infrastructure/scripts/validation-and-linting/he_frontmatter_safety_lint.py .harness/evals/coding-harness-jsc-283-packaged-skill-behavior-assurance-eval.md`
  passed.

## Reusable Rule

Packaged skill closure requires package-form behavior proof. Future agents must
not close a packaged-skill slice from source-only evidence when the claim is
about downstream install behavior, packaged command references, update
ownership, or release-gate readiness.

For this repository, local closure may pass when the package-form proof is clean
and credential-gated remote checks record exact blockers. Release-gate admission
requires a committed reusable runner, deterministic fixture records, and a clean
committed candidate rerun.

## Maintenance

Owner: agent-ops.

Refresh this solution if packaged skill validation moves, if
`.codex/environments/environment.toml` generation is removed or replaced, if the
eval-report identity contract changes, or if release-gate promotion becomes
mandatory for packaged skill closure.

## Project Brain Sync

Status: updated.

Target:

- `.harness/knowledge/governance/knowledge.md`
- `.harness/knowledge/governance/rules.md`
- `.harness/knowledge/INDEX.md`

Reason:

JSC-283 changes the governance contract for closing packaged skill work: proof
must exercise the package users receive, preserve user-owned local environment
actions, and separate local closure from release-gate admission.
