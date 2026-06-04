# PU-048 CNF-002 Environment-Scoped Permission Evidence Intent

## Intent

Add a compact, explicit-evidence-only environment snapshot to
`codex-runtime-evidence/v1` so runtime evidence can distinguish which
execution environment, working directory, executor kind, approval scope, and
sandbox policy produced a permission claim.

## Why This Slice Exists

CNF-002 in `state.yaml` requires `environmentId`, `cwd`, `executorKind`,
`approvalScope`, and `sandboxPolicyRef` where available. The current packet
can represent permission profile, writable roots, and network state, but it
cannot bind those facts to the exact execution environment. That leaves a
reviewer or future verifier unable to tell whether a permission claim came from
the active worktree, a stale cwd, a different executor, or a policy snapshot
with no referenced evidence.

This was reinforced during this slice: required preflight initially failed in
the disposable worktree because `mise trust` and Local Memory PID/state paths
wanted user-global home writes. A worktree-local `HOME` plus a config pointer
allowed required preflight to pass without mutating global state. That is the
kind of environment-scoped permission fact CNF-002 should make explicit.

## Scope

- Extend `CodexRuntimeEvidence` with an `environment` section.
- Add producer input normalization for explicit environment facts.
- Validate:
  - `environmentId` is nullable but non-empty when present.
  - `cwd` is nullable but non-empty when present.
  - `executorKind` uses a closed taxonomy.
  - `approvalScope` uses a closed taxonomy.
  - `sandboxPolicyRef` is required when permission/network facts are known.
  - stale cwd and approval-scope mismatch are explicit classifications.
- Add focused fixtures for multiple environments, stale cwd,
  approval-scope mismatch, and missing sandbox-policy refs.

## Non-Goals

- Do not implement live Codex Desktop extraction of environment facts.
- Do not change delivery-truth, PR closeout, or Judge/PM authority.
- Do not infer environment facts from adjacent fields such as thread id,
  writable roots, or source provenance.
- Do not duplicate `tool-exposure-snapshot/v1`; CNF-002 complements the
  completed SPG-005 tool-exposure slice.
- Do not mutate `/Users/jamiecraik/dev/codex`.

## Source Capability Evidence

- Existing runtime evidence packet:
  `src/lib/runtime/codex-runtime-evidence-types.ts`
- Existing producer normalization:
  `src/lib/runtime/codex-runtime-evidence-producer.ts`
- Existing validator:
  `src/lib/runtime/codex-runtime-evidence-validation.ts`
- Goal refinement:
  `docs/goals/codex-runtime-evidence-verifier-cockpit/state.yaml`
- Required preflight recovery evidence:
  ```bash
  # Set HOME and MISE_TRUSTED_CONFIG_PATHS to a temporary worktree-local directory
  # Example placeholders shown; substitute actual values before running:
  HOME=<TMP_DIR>/.cache/local-memory-home \
  MISE_TRUSTED_CONFIG_PATHS=<TMP_DIR>/.mise.toml \
  bash scripts/codex-preflight.sh --stack auto --mode required
  ```
  Expected: pass

  Note: `<TMP_DIR>` should be set to a disposable temporary directory (e.g., `$TMPDIR/coding-harness-cnf002-${UNIQUE_ID}`) to avoid mutating user-global home state.

## Review-The-Intent Checklist

- This slice keeps scope inside the runtime evidence deep module.
- This slice makes intent a first-class artifact before implementation.
- This slice preserves explicit unknowns and blocker classes.
- This slice avoids claiming live producer extraction, delivery truth, or
  closeout readiness.
- This slice adds deterministic tests for the new environment invariants.
