# Adversarial Review (PU-011 Final 5)

## Findings

### [high] Legitimate root-hygiene proof can be blocked by subdirectory-derived repository identity mismatch
- Classification: composition failure (contract mismatch across module boundaries)
- Validation ownership: introduced by current patch
- Evidence:
  1. The architecture and root-surface contract require repository identity to be derived from the real git toplevel (`ARCHITECTURE.md:104`, `docs/architecture/root-surface-classification.md:52-53`).
  2. The live root-hygiene classifier computes repository identity from the caller-provided path via `realpathSync(repoRoot)` rather than git toplevel resolution (`src/lib/root-hygiene/repository-identity.ts:14-21`), and `classifyGitTrackedRoot` passes `input.repoRoot` directly (`src/lib/root-hygiene/classifier.ts:35`).
  3. `readGitTrackedPaths` uses `git -C <repoRoot> ls-files -z`, which works from any subdirectory (`src/lib/root-hygiene/git-tracked-paths.ts:10-13`), so callers can legitimately pass a nested path.
  4. Delivery-truth requires exact repository identity equality (`src/lib/delivery-truth/composition.ts:141-154`), so the same repository can produce different identities depending on whether one caller uses repo root and another uses a nested path.
  5. Result: valid current evidence can be rejected as `repository_identity_mismatch` even when no cross-repo replay occurred.
- Remediation:
  1. Canonicalize repository identity from the actual git toplevel (e.g., `git -C <repoRoot> rev-parse --show-toplevel`, then `realpathSync` that path) before hashing.
  2. Add a regression test that classifies from a nested path and verifies identity equality with classification from repo root.

## Residual Risks
- Same-process cross-repository replay appears closed by verifier-owned report token + repository identity equality checks (`isVerifierOwnedRootHygieneReport` and `sameRootHygieneRepositoryIdentity`), but this depends on consistent repository identity canonicalization.
- No bypass found for JSON-deserialized/copied reports; WeakSet provenance plus frozen report graph correctly blocks shape-valid copies.

## Testing Gaps
- Missing explicit test that repository identity remains stable across equivalent paths inside one repository (repo root vs nested subdirectory).
- Existing replay test covers different repositories, not same-repo path canonicalization drift (`src/lib/delivery-truth/delivery-truth-composition.test.ts:117-149`).

WROTE: artifacts/reviews/pu011-final5-adversarial-reviewer.md
