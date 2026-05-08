---
schema_version: 1
title: JSC-283 Packaged Skill Behavior Assurance Plan
type: architecture
status: draft
date: 2026-05-08
plan_id: jsc-283-packaged-skill-behavior-assurance
origin: .harness/specs/2026-05-08-jsc-283-packaged-skill-behavior-assurance-spec.md
repo: coding-harness
linear_issue: JSC-283
linear_issue_url: https://linear.app/jscraik/issue/JSC-283/coding-harness-prove-packaged-skill-behavior-for-cockpit-commands
linear_project: coding-harness
linear_milestone: Agent Cockpit Compression Slice
linear_depends_on:
  - JSC-282
source_spec: .harness/specs/2026-05-08-jsc-283-packaged-skill-behavior-assurance-spec.md
source_review: .harness/review/2026-05-08-JSC-283-packaged-skill-behavior-assurance-spec-technical-review.md
source_refactor: .harness/refactors/packaged-skill-behavior-assurance.md
traceability_required: true
---

# JSC-283 Packaged Skill Behavior Assurance Plan

## Table Of Contents

- [Plan Summary](#plan-summary)
- [Authority And Scope](#authority-and-scope)
- [Current Evidence](#current-evidence)
- [Planning Decisions](#planning-decisions)
- [Packaged Artifact Proof Mechanics](#packaged-artifact-proof-mechanics)
- [Packaged Reference Validator Contract](#packaged-reference-validator-contract)
- [Fixture Launcher Contract](#fixture-launcher-contract)
- [Artifact Identity And Evidence Policy](#artifact-identity-and-evidence-policy)
- [Fixture Matrix](#fixture-matrix)
- [Fixture Isolation Rules](#fixture-isolation-rules)
- [Implementation Steps](#implementation-steps)
- [Acceptance Criteria](#acceptance-criteria)
- [Validation Plan](#validation-plan)
- [Eval Evidence Schema](#eval-evidence-schema)
- [Rollback Plan](#rollback-plan)
- [Dependencies And Sequencing](#dependencies-and-sequencing)
- [Linear Child Issue Shape](#linear-child-issue-shape)
- [Human Review Points](#human-review-points)
- [Out Of Scope](#out-of-scope)
- [Traceability Matrix](#traceability-matrix)
- [he-work Handoff](#he-work-handoff)
- [Blackboard Delta](#blackboard-delta)

## Plan Summary

JSC-283 proves that the packaged `coding-harness` skill is behaviorally useful
from a downstream consumer's point of view. The plan must not treat source-tree
string validation as packaged readiness. JSC-282 already proved the selected
source command truth; JSC-283 must now prove that the packaged skill carries
that truth into downstream-like fixture states.

The first execution slice is not fixture implementation. It is the fixture
matrix and proof policy slice. That slice must choose:

- where the fixture matrix lives;
- the first proof package form;
- the closure proof package form;
- the credential-blocked policy;
- when fixtures may become release-blocking.

Only after those decisions are explicit should `he-work` add fixture code.

## Authority And Scope

Selected execution slice:

- Linear issue: `JSC-283`.
- Linear title:
  `[coding-harness] Prove packaged skill behavior for cockpit commands`.
- Milestone: `Agent Cockpit Compression Slice`.
- Project: `coding-harness`.
- Priority: `2 High`.
- Labels: `Developer Experience`, `Agent-Native`, `Eval`, `Reliability`.
- Route: agent-assisted; human review required for fixture admission and
  release-gate promotion.

Authoritative inputs:

- `.harness/linear/coding-harness-linear-plan.md`.
- `.harness/specs/2026-05-08-jsc-283-packaged-skill-behavior-assurance-spec.md`.
- `.harness/review/2026-05-08-JSC-283-packaged-skill-behavior-assurance-spec-technical-review.md`.
- `.harness/refactors/packaged-skill-behavior-assurance.md`.
- `.harness/decisions/ADR-007-portable-skill-and-memory-proof.md`.
- `.harness/core/routing-invariants.md`.
- `.harness/core/execution-invariants.md`.
- `.harness/evals/coding-harness-jsc-282-command-truth-eval.md`.

Scope rule:

JSC-283 may add or adjust packaged skill behavior proof surfaces. It must not
reopen broad command cleanup, JSC-248 umbrella scope, governance/memory
simplification, CI migration, or a general downstream simulator.

## Current Evidence

| Evidence | Current state | Plan implication |
| --- | --- | --- |
| Linear delta capture | `JSC-283` is the approved next slice; labels are reconciled. | Planning can proceed without label blocker. |
| JSC-282 eval | Source-command behavior is complete; packaged/install parity is explicitly deferred. | Use JSC-282 as source truth only. |
| JSC-283 spec review | Two blockers were resolved: acceptance closure now uses traceability table; source-only proof cannot close JSC-283. | Preserve these controls in every implementation unit. |
| `package.json` scripts | `pnpm skill:validate` maps to `node scripts/validate-packaged-skill.cjs`. | Static validation remains the first blocking guard. |
| Packaged skill references | `.agents/skills/coding-harness/SKILL.md` names `pnpm skill:validate` and reference validators. | Fixture proof must sit beside existing static validators. |
| Package manifest | `package.json` publishes `dist`, selected scripts, `codestyle`, README/license/changelog, and `.agents/skills/coding-harness`; `harness` bin points to `dist/cli.js`. | Packed artifact proof must confirm both CLI artifact and skill artifact are present. |
| Runtime dependencies | `package.json` has runtime dependencies, including Octokit, SQLite, diff, lodash, picomatch, and semver packages. | A fresh tarball install may require package-manager dependency resolution; this is different from credential-backed service access. |
| Existing upgrade matrix script | `scripts/test-harness-upgrade-matrix.mjs` already materializes git-backed repo fixtures and checks update dry-runs do not dirty repos. | Reuse repo materialization and dirty-status ideas only; do not inherit its ambient environment behavior without a fixture launcher. |
| Reference validator | `.agents/skills/coding-harness/scripts/validate_reference_contracts.py` checks stale/banned skill references from its own repo-local skill root. | JSC-283 must add or wrap a targetable validator interface before extracted-tarball reference proof is executable. |

## Planning Decisions

| Decision | Plan value | Why |
| --- | --- | --- |
| Fixture matrix location | Add the matrix to this plan first; later implementation may move executable fixture details into a dedicated test fixture README if code needs it. | Keeps the first slice reviewable without creating extra docs. |
| First proof package form | Source workspace proof for static validation and command-reference design only. | Cheap and deterministic, but not closure proof. |
| Closure proof package form | Local packed artifact proof. | It proves the release candidate without registry/global install noise. |
| Published/global install proof | Out of JSC-283 baseline; record blocked unless credentials and release channel are intentionally available. | Prevents network/auth noise from hiding product behavior. |
| Fixture root | Test-owned temporary directories created by fixture helpers. | Avoids Jamie-local state and keeps rollback cheap. |
| Release-gate posture | Advisory until two consecutive local fixture runs are deterministic. | Prevents flaky fixture debt from becoming a release blocker too early. |
| Eval artifact | `.harness/evals/coding-harness-packaged-skill-behavior-assurance-eval.md`. | Closure requires durable evidence, not chat summary. |

## Packaged Artifact Proof Mechanics

JSC-283 has two different artifact concerns:

1. Packaged CLI behavior.
   - The package exposes `harness` through `dist/cli.js`.
   - A local packed artifact must therefore be built before the closure fixture
     claims installed behavior.
2. Packaged skill behavior.
   - The package includes `.agents/skills/coding-harness`.
   - A local packed artifact must prove the skill files are present in the
     package payload and still point at real command contracts.

The first `he-work` slice must not implement the full fixture suite, but it must
confirm the local packed artifact proof path is mechanically available.

Preferred closure proof sequence:

1. Run source static validation.
   - `pnpm skill:validate`
2. Build the local package artifact.
   - `pnpm build`
3. Create a local tarball in a temporary artifact path.
   - Use `pnpm pack --pack-destination <temp-dir>` or document the exact blocker
     if pnpm version behavior differs.
4. Inspect the tarball contents.
   - Required payload must include `package/dist/cli.js`.
   - Required payload must include
     `package/.agents/skills/coding-harness/SKILL.md`.
   - Required payload must include every file listed in
     [Required Payload Manifest](#required-payload-manifest).
5. Use the tarball for downstream-like fixture installs.
   - Do not use the published package or global install as baseline proof.
   - If dependency resolution requires registry access, record that separately
     as package-manager dependency access, not as GitHub/Linear/CircleCI service
     access.
   - Invoke the packaged CLI through a provenance-controlled path, not through
     the source workspace or an ambient global binary.

Non-closure proof:

- Running `pnpm exec tsx src/cli.ts ...` remains source proof.
- Running `pnpm skill:validate` remains source static proof.
- Inspecting the repository tree remains source proof.
- None of those may close JSC-283 by themselves.

### Required Payload Manifest

The tarball payload inspection must assert these exact paths:

| Payload path | Why it matters |
| --- | --- |
| `package/dist/cli.js` | Proves the packaged `harness` binary target exists. |
| `package/.agents/skills/coding-harness/SKILL.md` | Proves the downstream skill entrypoint ships. |
| `package/.agents/skills/coding-harness/references/agent-install-guide.md` | Proves install/update guidance ships. |
| `package/.agents/skills/coding-harness/references/agent-install.json` | Proves machine-readable install phases ship. |
| `package/.agents/skills/coding-harness/references/evals.yaml` | Proves packaged eval expectations ship. |
| `package/.agents/skills/coding-harness/references/setup-and-commands.md` | Proves command/setup reference guidance ships. |
| `package/.agents/skills/coding-harness/scripts/validate_reference_contracts.py` | Proves the packaged reference validator ships. |

If any required payload path is missing, stop before behavior fixtures and fix
`package.json` `files` or packaging behavior.

## Packaged Reference Validator Contract

`FX-283-REFS` is not executable closure proof until the reference validator can
target extracted package contents.

Required validator behavior:

- Accept a target skill root such as `--skill-root <path>` or an equivalent
  explicit argument.
- Default behavior may remain repo-local for `pnpm skill:validate`, but closure
  proof must invoke the validator against the extracted tarball path.
- Emit a machine-readable mismatch report for closure evidence.
- Compare extracted package skill references against the JSC-282 source-command
  truth source named in the eval.
- Distinguish:
  - missing packaged files;
  - stale or banned references;
  - real command-truth mismatches;
  - intentionally blocked or deprecated references.
- Treat source-skill validation as discovery evidence only unless the target
  root is the extracted local tarball skill root.

If the current validator cannot support this without excessive coupling, wrap it
with a small targetable script rather than weakening the closure rule.

## Fixture Launcher Contract

Every packaged-behavior fixture command must run through a launcher or helper
that controls provenance and ambient state.

Required launcher behavior:

- Set fixture-specific `HOME` and `XDG_CONFIG_HOME`.
- Clear or override service credential environment variables for baseline
  fixtures, including GitHub, Linear, CircleCI, npm publish, and OpenAI tokens
  unless the fixture is explicitly `FX-283-REMOTE`.
- Record the effective credential-clearing policy without printing secret
  values.
- Record package-manager network policy separately from service credentials.
- Resolve the harness executable from one approved source:
  - `node <extracted-tarball>/package/dist/cli.js`; or
  - a package-manager bin installed from the local tarball into the fixture root.
- Capture the resolved harness path or exact Node invocation in evidence.
- Fail closure proof if the command resolves to the source workspace CLI or an
  ambient global `harness` binary.
- Capture `git status --short` before and after each fixture command.

Existing fixture helpers may be reused only if they satisfy this launcher
contract. Repo materialization is reusable; inherited ambient process execution
is not.

## Artifact Identity And Evidence Policy

Closure evidence must prove that every closure-eligible fixture tested the same
local packed artifact.

Required artifact identity:

- Record `source_commit_sha` for the source workspace used for validation.
- Record `tarball_build_commit_sha` for the source workspace used to build the
  local packed artifact.
- Record the absolute `tarball_path` for the tested local packed artifact.
- Record `tarball_sha256` for the tested local packed artifact.
- Use `artifact_reuse_policy: single-artifact` for closure-eligible fixtures.
- Reuse the same `tarball_sha256` across `FX-283-REFS` and every
  closure-eligible local packed artifact behavior fixture.
- Set `closure_claim: not_allowed` if any closure-eligible fixture uses a
  different tarball hash.
- Set `closure_claim: not_allowed` if `source_commit_sha` and
  `tarball_build_commit_sha` differ for closure evidence.

Required raw evidence:

- Store fixture evidence under a dedicated evidence directory.
- Record `evidence_dir` for every fixture record.
- Record `stdout_log_path`, `stderr_log_path`, and `exit_code`.
- Record an `artifact_index` containing every generated evidence file and its
  checksum.
- Treat missing raw logs or checksum mismatches as `outcome: blocked` and
  `closure_claim: not_allowed`.

Deterministic run criteria:

- Same `tarball_sha256`.
- Same fixture launcher version or config.
- Same Node and pnpm major/minor versions.
- Same command list and execution order.
- Same outcome statuses.
- No unexpected fixture repo diff.

JSC-283 closure and any later release-gate promotion both require two runs in
the same `determinism_group_id` that satisfy every deterministic run criterion.
A weak "looks stable" claim is not closure or promotion evidence.

## Fixture Matrix

| Fixture ID | Scenario | Required setup | Credential policy | Behavior to prove | Minimum proof | Gate state | Rollback signal |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FX-283-STATIC | Static packaged skill validation | Current repo checkout. | No service credentials; source proof only. | Required skill files, references, install metadata, and forbidden patterns remain valid. | `pnpm skill:validate` exact output. | Blocking. | Static validation failure blocks all later fixtures. |
| FX-283-REFS | Command reference resolution | Current repo checkout for discovery; extracted local tarball skill root for closure. | No service credentials; package-manager network only if needed to build or extract the tarball. | Packaged skill command references match JSC-282 source truth or declare blocked/deprecated state. Closure-eligible only when comparing extracted tarball skill files. | Machine-readable mismatch report with target skill root and JSC-282 truth source. | Blocking for closure. | Missing targetable validator or source-root-only comparison keeps JSC-283 open. |
| FX-283-CLEAN | Clean downstream-like repo | Temporary git repo with no harness state and no Jamie-local config. | No service credentials; package-manager network recorded separately if dependency install needs it. | Skill-guided install/init path works without secrets or records exact product blocker. | Command transcript, exit codes, generated-file inventory, resolved harness path. | Advisory until stable. | Ambient global/source CLI resolution invalidates the fixture. |
| FX-283-UPDATE | Existing harness repo | Temporary git repo seeded with committed harness-managed files from a prior init/update. | No service credentials; package-manager network recorded separately if dependency install needs it. | Re-running skill-guided update is idempotent and preserves managed/adaptable ownership. | Before/after diff summary plus repeat-run result. | Advisory until stable. | Unexpected dirty status or non-idempotent second run blocks promotion. |
| FX-283-ENV | Customized environment/action-sync repo | Temporary git repo with deliberately customized environment/action surfaces. | No service credentials; package-manager network recorded separately if dependency install needs it. | Owned generated action surfaces can update while user-owned config is preserved or conflict-marked. | Diff summary proving preservation. | Advisory until stable. | User-owned config overwrite stops implementation before more fixtures. |
| FX-283-REMOTE | Remote integration capability | Live or fixture path requiring GitHub, Linear, or CircleCI service credentials. | Service credentials required; not baseline closure proof. | Skill guidance identifies capability boundaries honestly. | Blocked record naming missing credential/service and no readiness claim. | Non-blocking if explicit. | Any remote success claim without credential provenance is invalid. |

## Fixture Isolation Rules

All behavior fixtures must follow these isolation rules:

- Create fixture roots under a test-owned temporary directory.
- Initialize a git repository inside each fixture root.
- Set local fixture git identity if commits are required.
- Do not read or mutate `~/.codex`, `~/.agents`, global Git config, live Linear,
  live GitHub, or Jamie-local project config for baseline proof.
- Do not depend on GitHub, Linear, CircleCI, npm publish credentials, or other
  live service credentials for baseline proof.
- Prefer offline/cache-backed package-manager installs when feasible.
- If fresh dependency resolution requires registry network access, record the
  package-manager network dependency explicitly in the eval and keep service
  credential paths separate.
- Do not use the installed global `harness` binary for closure proof.
- Prefer explicit CLI paths from the local packed artifact fixture.
- Do not use the source workspace CLI for closure proof.
- Use the fixture launcher contract for every packaged-behavior command.
- Run fixtures with an ephemeral `HOME` and `XDG_CONFIG_HOME`.
- Clear or override service credential environment variables for baseline
  fixtures unless the fixture is explicitly `FX-283-REMOTE`.
- Record the fixture environment baseline: `HOME`, `XDG_CONFIG_HOME`, package
  manager command, node version, pnpm version, and harness binary path.
- Record `git status --short` before and after fixture commands.
- Treat any unexpected dirty status as fixture failure unless the changed files
  are the exact expected generated-file inventory.
- Run idempotence fixtures twice and record the second-run diff.

Fixture evidence must be reproducible from command transcripts. A fixture that
only states expected behavior is not evidence.

## Implementation Steps

### IU-283-001 - Fixture Matrix And Proof Policy

Objective:

Make the proof contract executable enough for implementation without adding
fixture code yet.

Tasks:

- Preserve the fixture matrix in this plan as the first source of truth.
- Add or update the future `he-work` handoff if implementation needs a dedicated
  fixture README.
- Record source workspace proof as first proof only.
- Record packed artifact proof as the closure proof target.
- Confirm whether `pnpm build` plus `pnpm pack --pack-destination <temp-dir>`
  is the local packed artifact path for this repo.
- Record the minimum tarball payload checks for CLI and skill artifacts.
- Record the approved packaged CLI invocation path and reject source/global CLI
  resolution for closure proof.
- Record the targetable reference validator requirement for extracted tarball
  skill files.
- Record published/global install as blocked unless credentials and release
  channel are intentionally available.
- Keep `pnpm skill:validate` blocking.

Acceptance IDs:

- `SA-283-001`
- `SA-283-010`
- `SA-283-011`
- `SA-283-012`
- `SA-283-060`
- `SA-283-090`

Validation:

- `pnpm docs:lint .harness/plan/2026-05-08-architecture-JSC-283-packaged-skill-behavior-assurance-plan.md`
- `pnpm skill:validate`
- `pnpm build`
- `pnpm pack --pack-destination <temp-dir>` or exact blocker
- `pnpm exec tsx src/cli.ts plan-gate --plans .harness/plan --type architecture --require-plan-id --require-origin --strict --json`

Rollback:

- Revert the plan changes if they admit implementation scope beyond JSC-283 or
  allow source-only closure.

### IU-283-002 - Command Reference Resolution Proof

Objective:

Prove packaged skill command references resolve against JSC-282 source truth
before downstream fixtures rely on those references.

Tasks:

- Identify the existing command-reference validation path.
- Extend or wrap it only if needed to emit a machine-readable mismatch report.
- Add a targetable validator interface, such as `--skill-root <path>`, before
  claiming extracted-tarball reference closure.
- Compare packaged skill command references to the JSC-282 source-command truth.
- Ensure discovery can run against source skill files, but closure-eligible
  comparison must run against extracted tarball skill files.
- Store the target skill root, package form, and truth source in the mismatch
  report.
- Fix real mismatches at the source or mark references blocked/deprecated.
- Do not add fake dispatch solely to make references pass.

Acceptance IDs:

- `SA-283-050`

Validation:

- `pnpm skill:validate`
- Focused reference validator command, if separate from `pnpm skill:validate`.
- Machine-readable mismatch report stored or summarized in the eval artifact.

Rollback:

- Restore the prior validator-clean references and remove any new wrapper if it
  produces noisy or ambiguous output.

### IU-283-003 - Clean Repo Packed Artifact Fixture

Objective:

Prove the local packed artifact can support a clean downstream-like install/init
path without secrets.

Tasks:

- Create a temporary git repo fixture.
- Install or consume the local packed artifact rather than the published/global
  package.
- Run the documented skill-guided install/init path using the tarball-provided
  `harness` CLI or an explicitly resolved local package binary.
- Record exact commands, exit codes, and generated files.
- Ensure the fixture does not read or mutate Jamie-local state.

Acceptance IDs:

- `SA-283-020`

Validation:

- Clean fixture command transcript.
- Generated-file inventory.
- Fixture launcher evidence, including resolved harness path or Node invocation.
- `pnpm skill:validate`

Rollback:

- Keep static validation blocking and mark the clean fixture advisory/blocked if
  local packing or install mechanics are not deterministic.

### IU-283-004 - Update And Ownership Fixtures

Objective:

Prove update/idempotence and customized environment/action-sync ownership.

Tasks:

- Seed an existing harness repo fixture from deterministic committed files.
- Re-run the update path twice and compare diffs.
- Seed a customized environment/action-sync fixture.
- Assert user-owned configuration is preserved or conflict-marked rather than
  overwritten.
- Record before/after diffs and repeat-run results.

Acceptance IDs:

- `SA-283-030`
- `SA-283-040`

Validation:

- Update fixture transcript.
- Repeat-run diff summary.
- Customized environment/action-sync diff summary.

Rollback:

- Remove behavior-gate wiring first.
- Keep fixture evidence if it identifies a real ownership bug.

### IU-283-005 - Eval And Gate Recommendation

Objective:

Close JSC-283 only with durable evidence and an explicit gate recommendation.

Tasks:

- Write `.harness/evals/coding-harness-packaged-skill-behavior-assurance-eval.md`.
- Include every fixture as pass, fail, or blocked.
- Include packed tarball path, package version, and package payload checks.
- Include exact missing inputs for credential-blocked paths.
- Record whether each behavior fixture remains advisory or can become blocking.
- Require two deterministic local runs before claiming JSC-283 closure or
  recommending release-gate promotion.
- At closure time, rerun all closure-eligible fixtures against the final
  candidate tarball and regenerate evidence records.
- Treat prior-unit fixture evidence as reference-only unless rerun against the
  final candidate tarball.

Acceptance IDs:

- `SA-283-070`
- `SA-283-080`

Validation:

- Eval artifact exists and links to `JSC-283`.
- `pnpm docs:lint .harness/evals/coding-harness-packaged-skill-behavior-assurance-eval.md`
- Closure-time rerun of all closure-eligible fixture commands against the final
  candidate tarball.

Rollback:

- If eval evidence is incomplete, keep `JSC-283` open and mark the missing proof
  as blocked with the smallest recovery step.

## Acceptance Criteria

| ID | Plan acceptance | Implementation unit |
| --- | --- | --- |
| SA-283-001 | Scope remains bounded to `JSC-283` and does not reopen unrelated cockpit, CI, governance, or memory work. | IU-283-001 |
| SA-283-010 | Fixture matrix exists with setup, proof, credential, gate-state, and rollback posture. | IU-283-001 |
| SA-283-011 | Static packaged skill validation remains active. | IU-283-001 |
| SA-283-012 | First proof and closure proof package forms are separated; source-only proof cannot close JSC-283. | IU-283-001 |
| SA-283-020 | Clean repo packaged skill behavior is proven locally or explicitly blocked. | IU-283-003 |
| SA-283-030 | Existing harness repo update/idempotence behavior is proven locally or explicitly blocked. | IU-283-004 |
| SA-283-040 | Customized environment/action-sync ownership is proven locally or explicitly blocked. | IU-283-004 |
| SA-283-050 | Packaged skill command references resolve against JSC-282 source truth or carry explicit blocked/deprecated status. | IU-283-002 |
| SA-283-060 | Credential-required checks are blocked with missing inputs, not silently skipped. | IU-283-001, IU-283-005 |
| SA-283-070 | Fixture tests remain advisory until deterministic enough to gate release confidence. | IU-283-005 |
| SA-283-080 | JSC-283 eval artifact exists and links back to Linear. | IU-283-005 |
| SA-283-090 | Release-gate wiring waits behind fixture matrix and at least one local behavior fixture. | IU-283-001, IU-283-005 |

## Validation Plan

Planning-stage validation:

```bash
pnpm docs:lint .harness/plan/2026-05-08-architecture-JSC-283-packaged-skill-behavior-assurance-plan.md
pnpm exec tsx src/cli.ts plan-gate --plans .harness/plan --type architecture --require-plan-id --require-origin --strict --json
```

First implementation-slice validation:

```bash
pnpm skill:validate
pnpm docs:lint .harness/plan/2026-05-08-architecture-JSC-283-packaged-skill-behavior-assurance-plan.md
```

Behavior-slice validation:

```bash
pnpm skill:validate
pnpm docs:lint .harness/evals/coding-harness-packaged-skill-behavior-assurance-eval.md
bash scripts/verify-work.sh --fast
```

Fixture commands must be added by `he-work` when implementation creates the
fixtures. Do not claim fixture validation before those commands exist and run.

## Eval Evidence Schema

The JSC-283 eval artifact must contain one evidence record per fixture.

Required fields:

| Field | Requirement |
| --- | --- |
| `fixture_id` | One of `FX-283-STATIC`, `FX-283-REFS`, `FX-283-CLEAN`, `FX-283-UPDATE`, `FX-283-ENV`, `FX-283-REMOTE`. |
| `linear_issue` | `JSC-283`. |
| `acceptance_ids` | Related `SA-283-*` IDs. |
| `package_form` | `source-workspace`, `local-packed-artifact`, `published-global`, or `credential-blocked`. |
| `source_commit_sha` | Source commit used for source validation. |
| `tarball_build_commit_sha` | Source commit used to build the local packed artifact. |
| `tarball_path` | Absolute path to the tested local packed artifact when `package_form` is `local-packed-artifact`; otherwise `not_applicable`. |
| `tarball_sha256` | SHA-256 of the tested local packed artifact when `package_form` is `local-packed-artifact`; otherwise `not_applicable`. |
| `artifact_reuse_policy` | `single-artifact` for closure-eligible fixtures; otherwise `not_applicable`. |
| `network_policy` | `offline`, `package-manager-network`, `service-credential-required`, or `not_applicable`. |
| `run_id` | Unique ID for the fixture run. |
| `determinism_group_id` | Shared ID for the two-run determinism set when evaluating gate promotion; otherwise `not_applicable`. |
| `commands` | Exact command text in execution order. |
| `outcome` | `pass`, `fail`, or `blocked`. |
| `exit_code` | Process exit code for the command path, or `not_applicable` for blocked preflight records. |
| `changed_files` | Generated or modified files, or `none`. |
| `payload_manifest` | Required tarball payload paths and pass/fail status when `package_form` is `local-packed-artifact`. |
| `target_skill_root` | Extracted tarball skill root when a fixture validates packaged skill references; otherwise `not_applicable`. |
| `harness_invocation` | Exact packaged CLI invocation or resolved package-manager bin path. |
| `evidence_dir` | Directory containing raw fixture evidence. |
| `stdout_log_path` | Raw stdout log path for the fixture command path. |
| `stderr_log_path` | Raw stderr log path for the fixture command path. |
| `artifact_index` | Generated evidence files and checksums. |
| `git_status_before` | Fixture git status before the command path. |
| `git_status_after` | Fixture git status after the command path. |
| `environment_baseline` | Fixture `HOME`, `XDG_CONFIG_HOME`, node version, pnpm version, harness binary path, and credential clearing policy. |
| `blocker` | Exact missing input when outcome is `blocked`; otherwise `none`. |
| `closure_claim` | `allowed`, `not_allowed`, or `advisory_only`. |

Closure rule:

- At least `FX-283-STATIC`, `FX-283-REFS`, and one local packed artifact
  behavior fixture must have `closure_claim: allowed` before JSC-283 can close.
- `FX-283-STATIC` may have `closure_claim: allowed` only when it ran from the
  same `source_commit_sha` used as `tarball_build_commit_sha` for the final
  candidate tarball.
- JSC-283 closure requires two consecutive runs for every closure-eligible
  fixture set within one `determinism_group_id`, with identical outcomes and no
  unexpected repo diff.
- Any closure claim backed by a single run is `closure_claim: not_allowed`.
- All `closure_claim: allowed` records must reference the same
  `tarball_sha256` when `package_form` is `local-packed-artifact`.
- Closure-eligible fixture records are invalid unless referenced raw log files
  exist and match the checksums listed in `artifact_index`.
- `FX-283-REFS` may have `closure_claim: allowed` only when `package_form` is
  `local-packed-artifact`, the comparison uses extracted tarball skill files,
  and the evidence includes `target_skill_root`.
- Local packed artifact behavior fixtures may have `closure_claim: allowed` only
  when `harness_invocation` proves the command did not resolve to the source
  workspace CLI or an ambient global `harness` binary.
- `FX-283-REMOTE` may remain blocked if the blocker names the missing
  credential or service exactly.

## Rollback Plan

- If the fixture matrix expands beyond adoption-critical states, revert to the
  six-fixture matrix in this plan.
- If a fixture depends on Jamie-local state, remove it from the gate and record
  it as blocked.
- If a fixture launcher cannot prove packaged CLI provenance, keep the fixture
  advisory or blocked and do not claim closure.
- If the reference validator cannot target extracted tarball skill files, keep
  `FX-283-REFS` non-closing and fix the validator interface first.
- If closure-eligible fixtures reference different tarball hashes, rerun them
  against one final candidate tarball before claiming closure.
- If static validation and tarball build evidence come from different source
  commits, rerun static validation and rebuild the final candidate tarball from
  one commit before claiming closure.
- If any closure-eligible fixture has only one deterministic run, rerun the
  full closure-eligible fixture set before claiming closure.
- If raw fixture logs or artifact checksums are missing, treat the evidence as
  non-closing and rerun the fixture with evidence capture enabled.
- If packed artifact proof is unavailable, keep JSC-283 open and record the
  missing package step as a non-closure blocker.
- If tarball payload inspection proves the skill is not packaged, stop and fix
  package manifest/files before adding behavior fixtures.
- If release-gate wiring is added before fixture determinism, revert the wiring
  and keep fixtures advisory.
- If a fixture mutates user-owned config, stop implementation and preserve the
  failure evidence for bug fixing before adding more fixtures.

## Dependencies And Sequencing

| Order | Unit | Depends on | Can run in parallel | Human review |
| --- | --- | --- | --- | --- |
| 1 | IU-283-001 | JSC-282 source proof; labels reconciled | No | Yes |
| 2 | IU-283-002 | IU-283-001 | Discovery only after matrix policy; closure evidence waits for tarball mechanics and payload manifest | Yes |
| 3 | IU-283-003 | IU-283-001; package-form decision | No | Yes |
| 4 | IU-283-004 | IU-283-003 fixture pattern | Partly | Yes |
| 5 | IU-283-005 | IU-283-002 through IU-283-004 | No | Yes |

## Linear Child Issue Shape

Do not create child issues unless execution is about to begin and the active set
can stay small.

Recommended child issues:

| Child title | Covers | Create now |
| --- | --- | --- |
| `[coding-harness] Lock packaged skill fixture proof policy` | IU-283-001 | Yes, if Linear child tracking is required before `he-work`. |
| `[coding-harness] Validate packaged skill command references from package artifact` | IU-283-002 | Later, after proof policy is accepted. |
| `[coding-harness] Add clean repo packed-artifact skill fixture` | IU-283-003 | Later. |
| `[coding-harness] Add packaged skill update and ownership fixtures` | IU-283-004 | Later. |
| `[coding-harness] Write packaged skill behavior assurance eval` | IU-283-005 | Later, after fixture evidence exists. |

Do not create one issue per fixture command or one issue per skill reference.

## Human Review Points

- Approve the fixture matrix before fixture implementation.
- Approve the package-form decision before closure proof is claimed.
- Review any release-gate promotion recommendation.
- Review any fixture that reports user-owned config mutation.
- Review any proposed child Linear issue creation.

## Out Of Scope

- Global published package proof as a baseline requirement.
- New Linear initiatives or projects.
- General plugin runtime work.
- Broad command catalog cleanup.
- CI migration lifecycle extraction.
- Memory/Project Brain governance repair.
- Release workflow redesign.
- Fixture coverage for every CLI command.

## Traceability Matrix

| Artifact or tracker | Role | Related plan units |
| --- | --- | --- |
| `JSC-283` | Linear tracker of record. | All units |
| `.harness/specs/2026-05-08-jsc-283-packaged-skill-behavior-assurance-spec.md` | Requirements source. | All units |
| `.harness/review/2026-05-08-JSC-283-packaged-skill-behavior-assurance-spec-technical-review.md` | Review blocker and risk source. | IU-283-001, IU-283-005 |
| `.harness/refactors/packaged-skill-behavior-assurance.md` | Migration/refactor source. | All units |
| `.harness/evals/coding-harness-jsc-282-command-truth-eval.md` | Source-command truth dependency. | IU-283-002 |
| `.harness/evals/coding-harness-packaged-skill-behavior-assurance-eval.md` | Required closure proof. | IU-283-005 |
| `.agents/skills/coding-harness/**` | Packaged skill surface under test. | IU-283-002 through IU-283-004 |
| `scripts/validate-packaged-skill.cjs` | Static validation guard. | IU-283-001, IU-283-002 |
| `.agents/skills/coding-harness/scripts/validate_reference_contracts.py` | Reference validator to make targetable or wrap for tarball skill roots. | IU-283-002 |
| Packaged-behavior fixture launcher | Required provenance and environment-control helper. | IU-283-003, IU-283-004 |

## he-work Handoff

Start with IU-283-001 only.

Do not implement fixtures in the first `he-work` slice unless the user
explicitly asks to continue after the fixture matrix/proof policy is reviewed.

Required first-slice outputs:

- Keep this plan as the fixture matrix artifact.
- Confirm `pnpm skill:validate` still passes.
- Confirm the plan gate still passes.
- Record whether local packed artifact proof is mechanically available.
- Record whether tarball payload inspection can see every required payload
  manifest path.
- Record the tested `tarball_sha256` and preserve it as the artifact identity
  for later closure-eligible fixture runs.
- Record the current source commit SHA that future static and tarball evidence
  must share.
- Record the exact approved packaged CLI invocation path for future behavior
  fixtures.
- Record the targetable reference validator change needed for extracted
  tarball skill roots.
- Preserve the release-gate deferral rule.

`he-work` must stop if:

- it needs GitHub, Linear, CircleCI, npm publish, or other service credentials
  for a baseline fixture;
- it cannot identify a local packed artifact path;
- it cannot distinguish package-manager dependency resolution from
  service-backed behavior;
- it would need to touch JSC-248, CI migration, governance, or memory ownership;
- it would make a behavior fixture release-blocking before deterministic
  evidence exists.

## Blackboard Delta

- Selected slice: `JSC-283`.
- Current plan: `.harness/plan/2026-05-08-architecture-JSC-283-packaged-skill-behavior-assurance-plan.md`.
- First implementation unit: `IU-283-001`.
- First proof form: source workspace static/reference proof only.
- Closure proof form: local packed artifact fixture proof.
- Main blocker to avoid: source-only proof closing packaged behavior.
- Required eval:
  `.harness/evals/coding-harness-packaged-skill-behavior-assurance-eval.md`.
- IU-283-001 evidence artifact:
  `.harness/evals/coding-harness-packaged-skill-behavior-assurance-eval.md`.
- IU-283-001 evidence status: payload identity recorded, closure still blocked.
- Tested source commit:
  `9d1c51e92cdf6aa55b76c61cd1e45149b86b3c2d`.
- Tested tarball:
  `/private/tmp/jsc283-work-pack.kZNJY8/brainwav-coding-harness-0.15.1.tgz`.
- Tested tarball SHA-256:
  `e842aa2205786c8564a49101d678b094cf82e7964eb0db930c4ad0a1837ac8f3`.
- Required payload manifest paths: present.
- Approved future packaged CLI invocation:
  install the local tarball into an isolated fixture with
  `pnpm --store-dir "$FIXTURE_ROOT/.pnpm-store" add "$TARBALL_PATH" --ignore-scripts`,
  then invoke `./node_modules/.bin/harness <fixture-command>`.
- Disallowed packaged CLI invocation:
  raw tar extraction plus `node package/dist/cli.js`, because runtime
  dependencies are not installed in the extracted tree.
- Ambient leakage guard:
  do not use `pnpm exec harness` as fixture proof because failed installs can
  fall through to an older ambient harness binary.
- Current packaged-runtime blocker:
  isolated local-tarball install succeeds, but `./node_modules/.bin/harness
  --help` fails because `dist/lib/source-outline.js` imports `typescript` while
  `typescript` is only a devDependency.
- Reference validator follow-up:
  resolved for `FX-283-REFS`; the packaged validator now accepts
  `--skill-root`, `--package-form`, `--truth-source`, and `--json`.
- IU-283-002 evidence status:
  extracted local-tarball reference validation passes with a machine-readable
  report and no findings.
- IU-283-002 packaged reference tarball:
  `/private/tmp/jsc283-refs-pack.J9WY9E/brainwav-coding-harness-0.15.1.tgz`.
- IU-283-002 packaged reference tarball SHA-256:
  `70544644ebbe5d7bbb1acfcd2e143635e08f90d2b513a2f436b1e2552d761738`.
- IU-283-003 evidence status:
  clean repo local-tarball install, fixture-local `harness --help`, and
  `harness init --dry-run --json` pass without service credentials.
- IU-283-003 runtime dependency fix:
  `typescript` is a runtime dependency because `dist/lib/source-outline.js`
  imports it during packaged CLI startup.
- IU-283-003 clean fixture:
  `/private/tmp/jsc283-clean-fixture.fMiJQB`.
- IU-283-003 clean fixture tarball:
  `/private/tmp/jsc283-clean-pack.hw4gnb/brainwav-coding-harness-0.15.1.tgz`.
- IU-283-003 clean fixture tarball SHA-256:
  `b5d01d24f84d9cbb323e1cfb8e1db433d94c7749bebe0ae696ea0a0233fa2c20`.
- IU-283-004 evidence status:
  update/idempotence dry-runs pass; customized environment/action ownership now
  passes after source-comparison fix.
- IU-283-004 package payload fix:
  the npm tarball now includes scaffold source scripts referenced by packaged
  init renderers, including `check-doc-style`, Semgrep helpers, worktree
  helpers, and the local harness wrapper.
- IU-283-004 update fixture:
  `/private/tmp/jsc283-update-fixture.5B3fWk`.
- IU-283-004 update fixture tarball:
  `/private/tmp/jsc283-update-pack.6fielD/brainwav-coding-harness-0.15.1.tgz`.
- IU-283-004 update fixture tarball SHA-256:
  `6a32e2de99781f5fd2f846d1b39ab1c9f831bda4accae4581af877eaf1555a51`.
- IU-283-004 source comparison:
  OpenAI Codex documentation validates local environment actions as a first-class
  Codex app surface, so `.codex/environments/environment.toml` generation must
  remain supported. Repo source treats that file as harness-owned only while the
  autogenerated sentinel is present.
- IU-283-004 ownership fix:
  `src/lib/init/update-core.ts` now applies `shouldAutoUpdateTemplate()` before
  tracked `.codex/environments/environment.toml` updates; customized files are
  skipped instead of overwritten.
- IU-283-004 regression test:
  `src/commands/init.test.ts` covers tracked update after user customization.
- IU-283-004 post-fix fixture:
  `/private/tmp/jsc283-envfix-final-fixture.vha7MM`.
- IU-283-004 post-fix tarball:
  `/private/tmp/jsc283-envfix-final-pack.LaFZnX/brainwav-coding-harness-0.15.1.tgz`.
- IU-283-004 post-fix tarball SHA-256:
  `fb37fae88ce8b419314424f4e8e1dfec7309c79d5c13f4c1b32386aebc84db15`.
- IU-283-004 post-fix packaged update:
  pass; `.codex/environments/environment.toml` appears in `skipped`, does not
  appear in `updated`, and customized content is preserved byte-for-byte.
- IU-283-005 evidence status:
  closure evidence package recorded with two deterministic local runs each for
  `FX-283-STATIC`, `FX-283-REFS`, `FX-283-CLEAN`, and `FX-283-ENV`.
- IU-283-005 evidence directory:
  `.harness/evidence/jsc-283-closure`.
- IU-283-005 final candidate tarball:
  `.harness/evidence/jsc-283-closure/package/brainwav-coding-harness-0.15.1.tgz`.
- IU-283-005 final candidate tarball SHA-256:
  `fb37fae88ce8b419314424f4e8e1dfec7309c79d5c13f4c1b32386aebc84db15`.
- IU-283-005 closure summary:
  `FX-283-STATIC`, `FX-283-REFS`, `FX-283-CLEAN`, and `FX-283-ENV` pass twice
  with `closure_claim: allowed`; `FX-283-REMOTE` is blocked because NPM
  publishing or service-backed verification credentials were not supplied.
- IU-283-005 gate recommendation:
  keep packaged behavior fixtures advisory; do not promote to a release gate
  until the closure runner is committed as a reusable fixture and rerun from a
  clean committed candidate.
- Release-gate deferral: preserved.
