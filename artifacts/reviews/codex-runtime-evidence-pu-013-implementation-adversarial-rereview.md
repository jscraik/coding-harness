# Adversarial Re-Review: PU-013 Runtime Artifact Reader

## Scope
- Re-review target: TOCTOU / trust-boundary concern in `readRepoRuntimeArtifactText` (`src/lib/runtime/repo-runtime-artifact.ts`).
- Change under review: descriptor-based open with `O_NOFOLLOW`, `fstatSync(descriptor).isFile()`, descriptor read, and `finally` close.

## Depth
- Review depth: Quick
- Rationale: Narrow follow-up patch on a single trust-boundary read path; no broader domain expansion in this retry.

## Findings
- None blocking.

## Resolution Verdict
- The original symlink TOCTOU path is materially mitigated for the local CLI threat model.
- Reasoning:
  1. Path is still constrained to `--repo` via canonical repo resolution + `isOutsideRepo`.
  2. Canonical artifact path is resolved before open.
  3. Open now uses `O_NOFOLLOW`, so final-component symlink swaps fail at open time.
  4. File-type check now occurs on the opened descriptor (`fstatSync(descriptor)`), not on a separate path lookup.
  5. File bytes are read from the same descriptor that passed checks, collapsing prior check/use split.

## New Blockers Introduced By Descriptor Read
- None observed.
- Descriptor lifecycle is correct (`try/finally` close).
- `readFileSync(descriptor, "utf8")` reads from the verified descriptor, preserving check/use coherence.

## Residual Risks (Non-blocking)
1. Hard-link provenance remains outside strict content-origin guarantees.
- Scenario:
  1. Attacker with local filesystem access creates an in-repo hard link to a readable external file.
  2. Boundary checks pass because the path itself resides under repo root.
  3. Descriptor read returns bytes from content that originated outside the repo tree.
- Impact: Path-boundary policy remains enforced, but content-origin policy is not cryptographically enforced.
- Confidence: 50 (depends on local filesystem/link permissions and expected policy strictness).

## Validation Evidence Observed
- `biome format` on touched file: pass.
- Focused `vitest` lanes (`runtime-card`, `next`, runtime-evidence suites): pass.
- `tsc --noEmit`: pass.
