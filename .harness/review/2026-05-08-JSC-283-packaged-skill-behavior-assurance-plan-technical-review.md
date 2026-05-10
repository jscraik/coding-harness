# JSC-283 Packaged Skill Behavior Assurance Plan Technical Review

## Review Target

- Plan:
  `.harness/plan/2026-05-08-architecture-JSC-283-packaged-skill-behavior-assurance-plan.md`
- Source spec:
  `.harness/specs/2026-05-08-jsc-283-packaged-skill-behavior-assurance-spec.md`
- Source spec review:
  `.harness/review/2026-05-08-JSC-283-packaged-skill-behavior-assurance-spec-technical-review.md`
- Linear issue: `JSC-283`
- Review date: 2026-05-08
- Review type: adversarial technical plan review before `he-work`

## Verdict

Pass after remediation.

The plan is ready for the next `he-work` slice. It now distinguishes source
proof, local packed artifact proof, and blocked remote/global proof clearly
enough that JSC-283 cannot be closed by repository-tree validation alone.

## First-Pass Findings

### Resolved Blocker - Reference proof could still close from source

Severity: high, resolved.

Evidence:

- `FX-283-REFS` originally allowed source workspace or tarball evidence.
- Closure criteria did not force the reference-resolution proof to use the
  packed skill files.

Resolution:

- `FX-283-REFS` closure now requires `package_form: local-packed-artifact`.
- Closure-eligible comparison must use the skill files extracted from the
  local tarball.
- Source workspace reference checks may still be used for discovery, but not
  for closure.

Why it matters:

- JSC-283 exists because source-command proof is not downstream packaged proof.
- Letting source validation close the issue would recreate the JSC-282/JSC-283
  boundary failure.

### Resolved Blocker - Tarball payload proof was underspecified

Severity: high, resolved.

Evidence:

- The first plan version required a packed artifact but did not define the
  minimum payload inventory for packaged CLI plus packaged skill behavior.

Resolution:

- The plan now includes a required payload manifest for `dist/cli.js`, skill
  entrypoint, install guide, machine-readable install metadata, eval metadata,
  setup/command guidance, and packaged reference validator.
- The eval evidence schema now requires a `payload_manifest` record.

Why it matters:

- Packaged behavior cannot be trusted if the package may omit the files future
  agents rely on.
- Payload inspection gives an early deterministic stop before behavior fixtures
  produce misleading failures.

### Resolved Risk - Fixture isolation could leak ambient state

Severity: medium, resolved.

Evidence:

- The first plan version blocked live service credentials but did not fully
  define runtime isolation from local home/config/global binaries.

Resolution:

- Fixtures now require ephemeral `HOME` and `XDG_CONFIG_HOME`.
- Baseline fixtures must clear or override service credential environment
  variables unless they are explicitly `FX-283-REMOTE`.
- Fixture evidence must record environment baseline, package-manager command,
  Node and pnpm versions, harness binary path, and git status before and after.

Why it matters:

- Ambient state can make downstream fixture proof look valid on Jamie's machine
  while failing for a real consumer.

### Resolved Risk - Sequencing allowed premature closure evidence

Severity: medium, resolved.

Evidence:

- The first plan version allowed command reference work before local packed
  artifact mechanics were proven.

Resolution:

- The dependency table now allows IU-283-002 source discovery after policy is
  set, but closure evidence waits for tarball mechanics and payload manifest
  proof.

Why it matters:

- This preserves useful parallel discovery without letting source analysis
  masquerade as packaged evidence.

## Second-Pass Result

The adversarial reviewer confirmed all first-pass findings are resolved.

Confirmed controls:

- `FX-283-REFS` closure requires `local-packed-artifact` evidence.
- Required payload manifest is explicit.
- Eval schema includes `payload_manifest`, `environment_baseline`, and
  `network_policy`.
- Fixture isolation includes ephemeral home/config state and credential
  clearing.
- IU-283-002 discovery is separated from closure evidence.

No remaining P0-P3 findings were reported from the reviewed risk set.

## Confidence Loop Addendum

The first pass was not enough for factual confidence. A second loophole sweep
was run against packaging feasibility, scope/closure, and eval-proof integrity.

### Resolved Blocker - Extracted tarball reference proof was not executable

Severity: high, resolved.

Evidence:

- The plan required `FX-283-REFS` closure against extracted tarball skill files.
- The current reference validator is repo-root bound and does not yet accept a
  target skill root.

Resolution:

- The plan now requires a targetable validator interface such as
  `--skill-root <path>` or a small wrapper.
- `FX-283-REFS` cannot be closure-eligible until the validator runs against the
  extracted tarball skill root.
- Eval records must include `target_skill_root`.

Why it matters:

- Without this, the plan could demand tarball proof while implementation still
  runs source-root validation.

### Resolved Blocker - Existing fixture helper could leak ambient environment

Severity: high, resolved.

Evidence:

- The plan referenced the existing upgrade matrix script as reusable evidence.
- That script materializes repos but does not provide the full JSC-283
  environment isolation contract.

Resolution:

- The plan now says repo materialization and dirty-status ideas are reusable,
  but inherited ambient execution is not.
- A fixture launcher contract now requires ephemeral `HOME`, `XDG_CONFIG_HOME`,
  credential clearing, package-manager network classification, packaged CLI
  provenance, and before/after git status.

Why it matters:

- Fixture proof must not pass because Jamie's local home, global binary, or
  ambient credentials accidentally filled in the missing behavior.

### Resolved Risk - Tarball invocation path was ambiguous

Severity: medium, resolved.

Evidence:

- The plan previously allowed a "tarball-provided harness CLI or explicitly
  resolved local package binary" without a provenance rule.

Resolution:

- Closure proof must use either `node <extracted-tarball>/package/dist/cli.js`
  or a package-manager bin installed from the local tarball into the fixture.
- Eval records must include `harness_invocation`.
- Closure is invalid if the command resolves to source workspace CLI or ambient
  global `harness`.

### Resolved Risk - Matrix lacked credential policy and rollback signal

Severity: medium, resolved.

Evidence:

- The spec required the fixture matrix to capture credential need and rollback
  signal per fixture.
- The first plan matrix did not carry those fields.

Resolution:

- The matrix now includes `Credential policy` and `Rollback signal` columns for
  every fixture.
- Registry/package-manager network is separated from GitHub, Linear, and
  CircleCI service credentials.

### Resolved Blocker - Closure could mix multiple tarball artifacts

Severity: high, resolved.

Evidence:

- Earlier plan text required tarball inspection but did not require all
  closure-eligible fixtures to use the same artifact identity.

Resolution:

- Eval records now require `tarball_path`, `tarball_sha256`, and
  `artifact_reuse_policy`.
- Closure-eligible fixtures must share the same `tarball_sha256`.
- Mismatched tarball hashes force `closure_claim: not_allowed`.

### Resolved Blocker - Evidence could be narrative-only

Severity: high, resolved.

Evidence:

- Earlier eval schema required command text and outcomes but not raw logs or
  checksummed evidence files.

Resolution:

- Eval records now require `evidence_dir`, `stdout_log_path`,
  `stderr_log_path`, `exit_code`, and `artifact_index`.
- Missing logs or checksum mismatches force `outcome: blocked` and
  `closure_claim: not_allowed`.

### Resolved Blocker - Closure could pass on one lucky run

Severity: high, resolved.

Evidence:

- The plan previously required two deterministic runs for release-gate
  promotion but not for JSC-283 closure.

Resolution:

- JSC-283 closure now requires two consecutive runs for every closure-eligible
  fixture set within one `determinism_group_id`.
- Single-run closure claims must use `closure_claim: not_allowed`.

### Resolved Risk - Static proof could drift from tarball build input

Severity: medium, resolved.

Evidence:

- `FX-283-STATIC` is source-workspace validation, while behavior fixtures test a
  local packed artifact.

Resolution:

- Eval records now require `source_commit_sha` and
  `tarball_build_commit_sha`.
- Static proof can close only when it ran from the same source commit used to
  build the final candidate tarball.

## Final Bounded Confidence Statement

The final fresh adversarial review reported:

> No remaining P0-P3 closure loopholes found.

This is bounded confidence, not omniscience. Within the reviewed risk set, the
plan now blocks the known ways future `he-work` could falsely close JSC-283:
source-proof leakage, global/source CLI leakage, ambient local-state leakage,
mixed tarball identity, source/tarball commit mismatch, narrative-only evidence,
single-run flukes, stale prior-unit evidence, credential classification drift,
and non-targetable reference validation.

## Remaining Non-Blocking Risks

| Risk | Status | Required handling |
| --- | --- | --- |
| Fixture implementation may overreach into a broad downstream simulator. | Non-blocking. | Keep `he-work` on IU-283-001 first; do not implement the full fixture suite until proof policy and packaging mechanics are confirmed. |
| Release-gate promotion may become process theater too early. | Non-blocking. | Keep fixture gates advisory until two consecutive deterministic local fixture runs are recorded. |
| Remote service proof may be mistaken for baseline readiness. | Non-blocking. | Keep `FX-283-REMOTE` blocked/non-closing unless credentials and release-channel safety are intentionally available. |

## Validation Evidence

| Command | Outcome |
| --- | --- |
| `pnpm docs:lint .harness/plan/2026-05-08-architecture-JSC-283-packaged-skill-behavior-assurance-plan.md` | Pass; `markdownlint-cli2` reported `0 error(s)`. |
| `pnpm exec tsx src/cli.ts plan-gate --plans .harness/plan --type architecture --require-plan-id --require-origin --strict --json` | Pass; `plan-gate` returned `status: pass` with zero findings. |

## Recommended Next Step

Proceed to `he-work` for IU-283-001 only.

The first execution slice should confirm:

- `pnpm skill:validate` still passes.
- `pnpm build` still produces the packaged CLI target.
- `pnpm pack --pack-destination <temp-dir>` works or records an exact blocker.
- The local tarball contains every required payload manifest path.
- The eval draft can represent package form, payload manifest, environment
  baseline, blocker state, and closure claim.

Do not close `JSC-283` until at least `FX-283-STATIC`, `FX-283-REFS`, and one
local packed artifact behavior fixture have closure-eligible evidence.
