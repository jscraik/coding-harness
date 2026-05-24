# Root Cleanup Doc History Review

category: documentation_and_design_history
verdict: findings

## Findings

1. Medium: the archive move left dead intra-archive references in the completed issue backlog, so traceability now points at files that do not exist.
   - `docs/archive/root-cleanup/completed-issue-backlog/016-complete-p1-symlink-bypass-validatePath.md:101` links to `001-pending-p1-symlink-path-traversal.md`, which is not present in the archive.
   - `docs/archive/root-cleanup/completed-issue-backlog/018-complete-p2-duplicate-validatePath.md:94-95` links to `009-pending-p2-validate-path-location.md` and `016-pending-p1-symlink-bypass-validatePath.md`, neither of which exists at the new archive path.
   - `docs/archive/root-cleanup/completed-issue-backlog/002-complete-p3-gardener-json-error-consistency.md:80` still points at `002-pending-p1-json-output-flag.md`, which is missing.
   - `docs/archive/root-cleanup/completed-issue-backlog/022-complete-p2-link-checker-silent-failure.md:111` points at `011-pending-p2-return-structured-result.md`, which is missing.
   - Remediation: rewrite these archive references to the actual archived source-of-truth files, or replace them with a stable archive index/reference if the pending filenames are intentionally retired.

## Traceability Gaps

- The new archive surface preserves the completed backlog, but the cross-links inside those records were not rewritten during the move, so historical chains are now partially broken.

## Stale or Conflicting Claims

- No direct runtime-policy contradictions found in the new root classification, archive README, or docs index additions.

## Useful Skill Routes

- `harness-doc-history-reviewer`
- `validation-contract-check`
- `config-drift-guard`

## Validation to Request

- Re-run a link-aware docs check over `docs/archive/root-cleanup/**` after fixing the archive references.
- If the archive surface is meant to be exempt from prose lint, keep that exemption narrow and document which validator covers link integrity instead.

## Residual Risks

- The staged `scripts/check-doc-style.sh` exclusion means archive docs may no longer be inspected by the usual changed-doc Vale pass, so any future broken references in the archive can slip through unless another validator covers them.
