Verdict: fail
Confidence: 89%

## Findings (Severity-ordered)

### 1) High — TOCTOU symlink swap can bypass repo-boundary guarantee for runtime artifact reads
- Evidence:
  - src/lib/runtime/repo-runtime-artifact.ts:37
  - src/lib/runtime/repo-runtime-artifact.ts:41
  - src/lib/runtime/repo-runtime-artifact.ts:24
- Scenario chain:
  1. Caller supplies `--evidence` (or another runtime artifact flag) pointing at an in-repo file path.
  2. `readRepoRuntimeArtifactText` resolves and canonicalizes the path with `realpathSync` and boundary-checks it against `--repo`.
  3. Between that check and `readFileSync(canonicalArtifact, "utf8")`, an attacker/process with write access to the repo can replace the path entry with a symlink to an out-of-repo target (or swap via rename).
  4. The current code no longer opens with `O_NOFOLLOW`; it performs a path-based read directly, so the second-stage open can follow the swapped symlink.
  5. Outcome: artifact contents can be sourced from outside `--repo`, violating the trust-boundary contract this helper is meant to enforce.
- Why this is materially worse than prior behavior:
  - The previous implementation opened with `O_NOFOLLOW` and read via file descriptor, which blocked symlink-following at open-time for the final read target. This change removed that protection.
- Remediation:
  - Restore descriptor-based open with `O_NOFOLLOW` and `fstat` verification before read, or equivalent atomic open pattern that rejects symlink traversal at read time.
  - Add a regression test that simulates a symlink swap between canonicalization and read to prove the helper fails closed.

## Validation ownership classification
- Finding 1: introduced by current patch.

## Adversarial coverage notes
- Covered assumption violation:
  - File identity and path safety remain stable between canonicalization and read.
- Covered composition failures:
  - Runtime artifact boundary checks composed with path-based file read (non-atomic) produce a cross-boundary escape window.
- Covered abuse case:
  - Concurrent mutation of artifact path entry during verifier execution.
- Cascade check:
  - Escape can poison downstream packet validation by feeding attacker-controlled non-repo artifacts into closeout/verifier paths.

## Remaining gaps
- No additional material gaps found inside PU-014 claim-separation logic (`remote_checks_current`, `review_threads_resolved`, `linear_state_aligned`) after this pass.
