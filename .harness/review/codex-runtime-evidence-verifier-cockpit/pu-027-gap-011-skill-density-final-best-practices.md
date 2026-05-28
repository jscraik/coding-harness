# Final best-practices review: PU-027 / GAP-011 skill density

## Scope and evidence checked
- Commit: `b062dd02`
- Files reviewed:
  - `.agents/skills/coding-harness/SKILL.md`
  - `.agents/skills/improve-codebase-architecture/SKILL.md`
  - `scripts/validate-packaged-skill.cjs`
  - `src/dev/validate-packaged-skill-script.test.ts`
  - `.harness/intent/codex-runtime-evidence-verifier-cockpit-pu-027-gap-011-skill-density-intent.json`
- Commands executed:
  - `git show --stat --oneline b062dd02` (scoped change confirmation)
  - `git show -- <scoped files>` (line-level diff inspection)
  - `pnpm vitest run src/dev/validate-packaged-skill-script.test.ts` (pass)
  - `pnpm skill:validate` (pass)

## Findings (blocking)
No material blocking findings were identified for recording R090 for PU-027 in the scoped files.

## Why this is clear-to-proceed
- Machine-readable skill density metadata is now present for both in-repo skills and aligns with the intended contract:
  - `.agents/skills/coding-harness/SKILL.md:4` `skill_kind: executable`
  - `.agents/skills/coding-harness/SKILL.md:5` `owned_workflow`
  - `.agents/skills/coding-harness/SKILL.md:6` `validation_command`
  - `.agents/skills/improve-codebase-architecture/SKILL.md:4` `skill_kind: advisory`
  - `.agents/skills/improve-codebase-architecture/SKILL.md:5` `owned_workflow`
  - `.agents/skills/improve-codebase-architecture/SKILL.md:6` `validation_command`
- Advisory skill now documents explicit validation path in body (`.agents/skills/improve-codebase-architecture/SKILL.md:148-151`), satisfying validator linkage semantics.
- Validator adds deterministic, fail-closed checks for:
  - frontmatter parsing and required metadata (`scripts/validate-packaged-skill.cjs`, functions `parseSkillFrontmatter`, `validateSkillMetadata`)
  - prompt-only/advisory/executable classification checks (`validateSkillMetadata`)
  - trigger-overlap detection with deterministic thresholds and allowlist support (`validateSkillOverlap`, `isOverlapAllowlisted`)
  - top-level enforcement inside main validation lane (`validateSkillDensity();` before final pass output)
- Focused tests cover missing metadata, missing advisory workflow/reference structure, overlap blocking, low-signal overlap pass, and executable proof/validation-link failures:
  - `src/dev/validate-packaged-skill-script.test.ts` (5 tests, all passing)

## Non-blocking improvement opportunities
- The manual frontmatter parser currently handles scalar/list patterns but not multiline YAML constructs. This is acceptable for the present contract but should remain intentionally constrained or explicitly documented to avoid future surprise if richer YAML appears.
  - Evidence: `scripts/validate-packaged-skill.cjs` `parseSkillFrontmatter` line family in current diff.
  - Severity: low
  - Confidence: high

## Validation ownership classification
- No gate failures observed in this review run.
- Ownership classification for failures: n/a

## Accountability receipt
- status: complete
- artifact_paths:
  - `.harness/review/codex-runtime-evidence-verifier-cockpit/pu-027-gap-011-skill-density-final-best-practices.md`
- manifest_path: `artifacts/agent-runs/best-practices-researcher-019e6a27-ecab-7ee0-8bf4-d6b4145d82eb/manifest.json`
- findings:
  - blocking_findings: 0
  - non_blocking_findings: 1
- failures_or_blockers:
  - none
- improvement_opportunities:
  - constrain or document frontmatter parser limitations if multiline YAML is introduced
- strengths:
  - deterministic policy encoded in validator
  - scoped tests directly assert intended fail/pass behavior
  - validation lane integration confirmed by `pnpm skill:validate` pass
- validation_evidence:
  - `pnpm vitest run src/dev/validate-packaged-skill-script.test.ts` => pass (5/5)
  - `pnpm skill:validate` => pass (`skill-density: pass (2 skills)`)
- next_action:
  - coordinator may proceed with R090 evidence packaging using this artifact as best-practices clearance
- useful_findings: yes
- avoided_false_positive: yes (no unsupported blocker claim when gates pass)
- evidence_quality: strong for scoped files and commands
- followed_scope: yes
- reusable_learning: deterministic overlap and metadata enforcement is a robust pattern for other skill sets
- coordinator_score: 9/10

WROTE: .harness/review/codex-runtime-evidence-verifier-cockpit/pu-027-gap-011-skill-density-final-best-practices.md
