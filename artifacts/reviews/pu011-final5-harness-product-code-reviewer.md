# PU-011 Product Code Review

## Findings

### High: trusted root-hygiene reports can still be retargeted after classification
- Evidence: [src/lib/root-hygiene/classifier.ts:67-87](/Users/jamiecraik/dev/coding-harness-pu011/src/lib/root-hygiene/classifier.ts#L67), [src/lib/root-hygiene/report-freeze.ts:4-14](/Users/jamiecraik/dev/coding-harness-pu011/src/lib/root-hygiene/report-freeze.ts#L4)
- Why it matters: `freezeRootHygieneReport` freezes the report wrapper, arrays, summary, coverage, blockers, deferred entries, and receipt, but it never freezes `report.repository`. Because `classifyRootSurfaceInternal` brands the report as verifier-owned before returning it, a caller can mutate `report.repository.digest` after classification and make a previously trusted report validate against a different repository identity. I reproduced this locally: mutating the nested repository digest changed `composeDeliveryTruth` from blocked to pass for a replayed root-hygiene report.
- Remediation: freeze `report.repository` as part of the report graph, or replace the nested object with an immutable primitive/tuple before branding the report. Add a regression asserting the nested repository identity cannot be mutated and that claim support does not change after attempted mutation.

### Medium: repository identity is path-derived, not git-toplevel-derived
- Evidence: [src/lib/root-hygiene/repository-identity.ts:13-21](/Users/jamiecraik/dev/coding-harness-pu011/src/lib/root-hygiene/repository-identity.ts#L13), [docs/architecture/root-surface-classification.md:49-53](/Users/jamiecraik/dev/coding-harness-pu011/docs/architecture/root-surface-classification.md#L49)
- Why it matters: the current identity hashes `realpathSync(repoRoot)`, so the identity changes with the caller's filesystem path rather than the repository's actual git toplevel. That means a legitimate report can be rejected when the classifier is invoked from a subdirectory or alternate alias, and the implementation does not actually satisfy the stated "real git toplevel" contract.
- Remediation: resolve the canonical repository root via `git rev-parse --show-toplevel` and hash that path, then add a regression that proves the same repository reports one stable identity when invoked through a subdirectory or symlinked path.

## Missing Tests Or Evidence

- No regression currently proves that mutating the nested repository identity after classification is impossible.
- No regression currently proves repository identity is stable across subdirectory or symlinked invocations that resolve to the same git toplevel.

## Residual Risks

- `isVerifierOwnedRootHygieneReport` is still exported from `classifier.ts`, so the module-private trust oracle story remains a little looser than the intent language suggests, even though the WeakSet itself is private.
- I only reran the affected vitest slice locally; the other validation evidence in the prompt was supplied by the caller and looked internally consistent.

## Validation

- `pnpm vitest run src/lib/root-hygiene/*.test.ts src/lib/delivery-truth/*.test.ts src/lib/architecture/module-boundaries.test.ts --reporter=dot` -> pass (109 tests)
- No gate failures were observed in the validation I reran, so there is no failure ownership classification to assign.

WROTE: artifacts/reviews/pu011-final5-harness-product-code-reviewer.md
