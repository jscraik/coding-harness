## Agent-Native Architecture Review

### Summary
This slice has real agent integration and uses typed delivery-truth + root-hygiene evidence composition as the enforcement surface. The root-hygiene deep module and delivery-truth claim checks are mostly aligned with agent-native parity goals: agents can only support `root_surface_tidy` with verifier-produced, checksum-bound, policy-bound evidence and matching repository identity. One implementation gap remains against the intended replay contract: repository identity is currently hashed from the caller-provided path realpath, not the repository's git toplevel.

### Capability Map

| UI Action | Location | Agent Tool | In Prompt? | Priority | Status |
|-----------|----------|------------|------------|----------|--------|
| Classify root surface from live tracked files | src/lib/root-hygiene/classifier.ts:25 | `classifyGitTrackedRoot` | N/A (library seam) | Must have | Implemented |
| Emit claim-support receipt bound to policy digest + checksum | src/lib/root-hygiene/receipt.ts:15 | `buildRootHygieneReceipt` via classifier | N/A | Must have | Implemented |
| Reject non-verifier / forged / replayed root evidence in claim composition | src/lib/delivery-truth/root-hygiene-evidence.ts:13 and src/lib/delivery-truth/composition.ts:107 | `composeDeliveryTruth` | N/A | Must have | Implemented |
| Refuse missing/mismatched repository identity for root_hygiene claims | src/lib/delivery-truth/composition.ts:138 | `composeDeliveryTruth` | N/A | Must have | Implemented |
| Enforce module split and facade boundaries | src/lib/architecture/module-boundaries.test.ts:1124 and :1837 | Module ratchets/tests | N/A | Should have | Implemented |

### Findings

#### Critical (Must Fix)
None.

#### Warnings (Should Fix)
1. **Repository identity is not derived from git toplevel** -- `src/lib/root-hygiene/repository-identity.ts:17-20` -- The digest is computed from `realpathSync(repoRoot)`, where `repoRoot` is caller-supplied. This does not guarantee identity from the repository's real git toplevel and can produce different identities for paths inside the same repo (for example repo root vs subdirectory), conflicting with the intended replay contract documented in `ARCHITECTURE.md`. Recommendation: resolve git toplevel first (for example `git -C <repoRoot> rev-parse --show-toplevel` via no-shell `execFileSync`), canonicalize that path, then hash it for identity.

#### Observations
1. **Verifier ownership remains module-private as intended** -- `src/lib/root-hygiene/classifier.ts:22,97-103` with no export in `src/lib/root-hygiene/index.ts:1-43`; delivery-truth validates this token through `isVerifierOwnedRootHygieneReport` (`src/lib/delivery-truth/root-hygiene-evidence.ts:22`), which blocks digest-consistent copied reports (`src/lib/delivery-truth/delivery-truth-composition.test.ts:188-217`).
2. **Caller-supplied inventories fail closed for claim support** -- `src/lib/root-hygiene/classifier.ts:49-65` sets `coverage.valid` false unless the internal live-git path is used; tests cover policy-fixture and caller-labeled `git_tracked_paths` spoofing (`src/lib/root-hygiene/root-hygiene.test.ts:132-170`).
3. **Root-hygiene reports are frozen before branding** -- `src/lib/root-hygiene/classifier.ts:97-103` calls `freezeRootHygieneReport` before adding the WeakSet marker; freeze behavior is asserted in `src/lib/root-hygiene/root-hygiene.test.ts:64-90`.
4. **Claim-head behavior matches intended split** -- `src/lib/delivery-truth/composition.ts:301-326` requires verdict head only for `merge_ready`; `root_surface_tidy` can pass without verdict head when repository identity and trusted evidence checks pass (`src/lib/delivery-truth/delivery-truth-composition.test.ts:71-92`).

### What's Working Well
- Root-hygiene is cleanly decomposed as a deep module with ratchets and facade checks (`src/lib/architecture/module-boundaries.test.ts:1124-1191,1837,2323-2337`).
- Delivery-truth trust policy rejects prose-only refs, stale/missing evidence, forged shapes, copied reports, and cross-repo replay attempts (`src/lib/delivery-truth/delivery-truth-composition.test.ts` root-hygiene negative cases).
- Architecture/doc surfaces point agents to the correct module and replay-resistant proof seam (`ARCHITECTURE.md:97-115`, `docs/architecture/root-surface-classification.md:57-63`).

### Validation Ownership Classification
- No new gate failures found in this review pass.
- Noted pre-existing warning context from provided evidence: `pnpm architecture:check` has 4 warning-level auth-command observations classified as **pre-existing** and outside this PU-011 slice.

### Score
- **5/6 high-priority capabilities are agent-accessible**
- **Verdict:** NEEDS WORK

WROTE: artifacts/reviews/pu011-final5-agent-native-reviewer.md
