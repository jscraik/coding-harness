---
last_validated: 2026-04-23
---

# Release and change-control checks

## Table of Contents

- [Scope](#scope)
- [Required pre-release checklist](#required-pre-release-checklist)
- [Benchmark cadence requirements](#benchmark-cadence-requirements)
- [Tag-Driven Release Path](#tag-driven-release-path)
- [Change-control flow](#change-control-flow)
- [Review-gate north-star evidence](#review-gate-north-star-evidence)
- [Verify-Work Run State And Resume Compatibility](#verify-work-run-state-and-resume-compatibility)
- [Rollback policy](#rollback-policy)
- [Post-change validation](#post-change-validation)
- [Release integrity and verification](#release-integrity-and-verification)
- [Release blockers](#release-blockers)

## Scope

Use this document before milestones, release-tagged branches, or behavior-changing policy edits.

## Required pre-release checklist

1. Run and pass `pnpm check` on current HEAD.
2. Confirm no open contradictions remain in operational docs.
3. Verify command contract still matches `package.json` and lockfile.
4. Ensure process docs (`docs/plans/*`, `FORJAMIE.md` where present) match the actual workflow used.
5. Confirm benchmark evidence is fresh per the benchmark cadence policy.

## Benchmark cadence requirements

- Canonical benchmark instructions: `docs/benchmarks/README.md`.
- Minimum cadence:
  - One SWE track run per week on `main`.
  - One fresh SWE track run before release tagging.
- Store each run record in JSON that validates against
  `docs/benchmarks/schema/benchmark-run.schema.json`.

## Tag-Driven Release Path

1. Validate release candidate on branch/PR (`pnpm check`, scoped tests, docs parity).
2. Merge to `main` only after required checks and independent review pass.
3. Create and push a semantic-version tag (`vX.Y.Z`) that matches `package.json`.
4. GitHub Actions workflow `.github/workflows/release-private-npm.yml` performs:
   - tag/version consistency check,
   - publish (`oidc` by default; `token` fallback only when explicitly requested),
   - attestation generation and verification (when available),
   - GitHub Release creation.
5. CircleCI `release` lane remains verification-only; it must not publish packages.

## Change-control flow

1. Record intent and impacted paths.
2. Apply minimal implementation.
3. Validate against required gates.
4. Update process artifacts if workflow changed.
5. Confirm rollback behavior (or document as not applicable).

## Review-gate north-star evidence

When `harness.contract.json` declares `northStar` governance and the PR touches
governed `productSurface.surfaces[].ownedPaths`, `review-gate` enforces four PR
body decisions:

- `lead_time_path: yes. Evidence: <ref>`
- `manual_glue: yes. Evidence: <ref>`
- `agent_reliability: yes. Evidence: <ref>`
- `safety_floor: yes. Evidence: <ref>`

Missing decisions or missing `Evidence:` references return
`review_evidence_incomplete`. Any non-`yes` answer returns
`review_evidence_contradiction`. Repos without `northStar` governance or
without touched governed surfaces keep legacy review-gate behavior.

## Verify-Work Run State And Resume Compatibility

`bash scripts/verify-work.sh` stores run-state under `.harness/runs/<run-id>/`:

- `run.json` contains lane metadata and compatibility keys (`repoRoot`, `providerClass`, `schemaVersion`, `contractVersion`, `contractFingerprint`).
- `gates/<gate-id>.json` stores each gate outcome.
- `summary.json` stores terminal status and failed gate identity.

When resuming with `bash scripts/verify-work.sh --resume-from <gate-id>`, prior gates are reused only if the compatibility tuple still matches and reused gates are already `passed`. Resume is rejected if deterministic fingerprint tooling is unavailable (`node`, `shasum`, or `openssl`).

## Rollback policy

- For reversible changes: revert specific commit and rerun validation.
- For irreversible operations: avoid one-step destructive edits and use staged changes first.
- For uncertain changes: pause, document impact, and request explicit approval.

## Post-change validation

- Confirm docs and plans still reference executable, current commands.
- Verify audit trail entries include command outcomes.

## Release integrity and verification

Releases published via OIDC trusted publishing from `.github/workflows/release-private-npm.yml` carry three trust layers that consumers can verify independently.

### 1. npm provenance

Releases published via OIDC trusted publishing include a signed provenance statement on the npm registry, linking the package to the exact source commit and build environment.

Verify OIDC-published packages from any machine:

```bash
npm view @brainwav/coding-harness --json | jq '.attestations'
npm audit signatures
```

The `--provenance` flag on publish ensures the npm registry stores a verifiable link between the published artifact and the GitHub Actions run that produced it.

### 2. GitHub artifact attestations

Each release generates a SLSA-format build provenance attestation signed by GitHub's Sigstore instance.

Verify a specific release artifact:

```bash
gh attestation verify brainwav-coding-harness-*.tgz \
  --repo jscraik/coding-harness \
  --predicate-type https://slsa.dev/provenance/v1
```

### 3. SBOM

A CycloneDX SBOM is generated during release and uploaded as a GitHub Actions artifact (90-day retention).

Download and inspect:

```bash
gh run download --name sbom
jq '.components | length' artifacts/sbom.cdx.json
```

### Permission model

The release workflow uses these top-level permissions (least-privilege):

| Permission | Justification |
|---|---|
| `id-token: write` | OIDC token for npm trusted publishing and attestation signing |
| `attestations: write` | `actions/attest-build-provenance` for build provenance |
| `contents: write` | GitHub Release creation |

No additional secrets are required for OIDC-mode publishes. Token-mode (`publish_auth=token`) is retained for bootstrap recovery only and may not produce full provenance attestations or SBOM artifacts.

## Release blockers

Block release completion if:

- Required validation commands are missing/unrunnable in CI environment,
- Command authority conflicts remain unresolved,
- High-risk behavior changed without rollback notes,
- Benchmark cadence evidence is missing for the release window.
