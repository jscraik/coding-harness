---
schema_version: 1
lifecycle_schema: harness-document-lifecycle/v1
artifact_id: advisory-stale-document-archive-candidate-reporting-trace-plan
plan_id: advisory-stale-document-archive-candidate-reporting-trace-plan
artifact_type: sy-trace-plan
canonical_slug: advisory-stale-document-archive-candidate-reporting
title: Advisory Stale-Document Archive Candidate Reporting Trace Plan
harness_stage: sy-trace-plan
status: proposed
date: 2026-06-05
origin: sy-trace-plan from .harness/specs/2026-06-05-advisory-stale-document-archive-candidate-reporting-spec.md
source_type: plan
authority: execution-input
lifecycle_status: execution-input
canonical_destination: src/lib/docs-surface
owner: coding-harness-maintainers
created: 2026-06-05
last_reviewed: 2026-06-05
review_cadence: event-driven
validated_by:
  - pnpm docs:lint
  - pnpm docs:lifecycle
depends_on:
  - .harness/specs/2026-06-05-advisory-stale-document-archive-candidate-reporting-spec.md
  - .harness/plan/2026-06-04-documentation-architecture-comparison-plan.md
  - .harness/linear/2026-06-04-JSC-392-coding-harness-documentation-lifecycle-linear-plan.md
  - .harness/specs/2026-06-04-documentation-research-lifecycle-metadata-spec.md
  - .harness/specs/2026-06-04-reader-task-documentation-eval-spec.md
linear_issue: JSC-395
linear_parent: JSC-392
linear_project: Harness control-loop hardening
traceability_required: true
safe_to_continue: true
pre_implementation_gate_required: true
blocked_reason: null
acceptance_ids:
  - SA-001
  - SA-002
  - SA-003
  - SA-004
  - SA-005
  - SA-006
  - SA-007
  - SA-008
  - SA-009
  - SA-010
  - SA-011
  - SA-012
---

# Advisory Stale-Document Archive Candidate Reporting Trace Plan

## Command Summary

BLUF: This trace plan maps the JSC-395 advisory archive-candidate spec to
implementation tasks, expected artifacts, validation commands, and closeout
proof. It matters because archive candidate reporting is safety-sensitive:
every acceptance criterion must preserve the line between advisory evidence,
metadata repair, generated-output repair, and destructive archive authority.
Execution is bounded to local docs-surface code, focused fixtures, one package
script, advisory docs-gate projection, and minimal documentation. This
plan does not mutate Linear, GitHub, CI, review state, release settings,
downstream templates, active archive locations, or generated architecture
context. The next stage is sy-work after the trace gaps are accepted.

Decision Needed: approve this trace plan as the implementation map for JSC-395.

Top Risks:

- Free-form actions or candidate labels could be mistaken for archive/delete
  authority.
- Canonical, execution-input, generated, or retained research artifacts could
  become false archive candidates.
- Stale .harness/active-artifacts.md could create negative evidence by absence.
- Docs-gate projection could accidentally convert advisory findings into a
  required failure.

Next Action: run the sy-work preflight gate, implement the work units in order,
and record exact validation outcomes before closeout.

## Source Contract

| Source | Role | Freshness |
| --- | --- | --- |
| .harness/specs/2026-06-05-advisory-stale-document-archive-candidate-reporting-spec.md | Canonical behavior contract for JSC-395 | Current local file read on 2026-06-05 |
| .harness/plan/2026-06-04-documentation-architecture-comparison-plan.md | Parent documentation architecture plan and VAC-007 mapping | Current local file read on 2026-06-05 |
| .harness/linear/2026-06-04-JSC-392-coding-harness-documentation-lifecycle-linear-plan.md | Local Linear issue tree mapping | Current local file; live Linear not refreshed |
| .harness/specs/2026-06-04-documentation-research-lifecycle-metadata-spec.md | Lifecycle metadata authority dependency | Current local file dependency only |
| .harness/specs/2026-06-04-reader-task-documentation-eval-spec.md | Reader-task route-truth dependency | Current local file dependency only |

## Scope and Boundaries

In scope:

- src/lib/docs-surface/archive-candidates*.ts
- src/lib/docs-surface/archive-candidates*.test.ts
- scripts/check-docs-archive-candidates.ts
- package.json script docs:archive-candidates
- advisory docs-gate projection and focused tests
- minimal documentation explaining candidate criteria and non-deletion boundary

Out of scope:

- deleting, moving, archiving, demoting, or compressing files
- updating lifecycle metadata, manifests, active-artifacts, or archive indexes
  from the scanner
- editing src/templates/**
- changing .github/PULL_REQUEST_TEMPLATE.md
- mutating Linear, GitHub, CI, branch protection, release settings, or
  downstream repositories
- making docs-gate fail solely because advisory archive candidates exist
- using generated architecture context as source truth

## Traceability Map

| ID | Requirement | Owner Surface | Artifact / File | Validation Command | Closeout Proof | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FR-001 | Scan git-tracked source files only unless a future manifest admits another source class. | Scanner boundary | src/lib/docs-surface/archive-candidates-scanner.ts | pnpm test -- src/lib/docs-surface/archive-candidates-scanner.test.ts | Fixture proves untracked/runtime files are ignored. | gap |
| FR-002 | Read docs and .harness lifecycle metadata when present. | Metadata parser | src/lib/docs-surface/archive-candidates.ts | pnpm test -- src/lib/docs-surface/archive-candidates.test.ts | Candidate/protected entries include lifecycle fields from frontmatter. | gap |
| FR-003 | Compute inbound refs from the bounded corpus using repo-relative paths. | Reference scanner | src/lib/docs-surface/archive-candidates-scanner.ts | pnpm test -- src/lib/docs-surface/archive-candidates-scanner.test.ts | Markdown, frontmatter, manifest, package script, and code-fence fixtures pass. | gap |
| FR-004 | Use lifecycle manifest and active .harness artifacts as protection evidence without treating absence as negative evidence unless route freshness is verified. | Route freshness classifier | src/lib/docs-surface/archive-candidates.ts | pnpm test -- src/lib/docs-surface/archive-candidates.test.ts | Stale active-artifacts fixture emits repair finding, not candidate confidence. | gap |
| FR-005 | Identify lifecycle fields by surface type without inventing states. | Contract validation | src/lib/docs-surface/archive-candidates-contract.ts | pnpm test -- src/lib/docs-surface/archive-candidates-contract.test.ts | Unknown state handling and mapping matrix are covered. | gap |
| FR-006 | Emit candidates with reason, confidence, closed-enum suggestedAction, advisory authority, and evidence refs. | Report contract | src/lib/docs-surface/archive-candidates-contract.ts | pnpm test -- src/lib/docs-surface/archive-candidates-contract.test.ts | JSON schema rejects missing fields and free-form destructive action text. | gap |
| FR-007 | Emit protections explaining why weak signals do not create archive candidates. | Classifier | src/lib/docs-surface/archive-candidates.ts | pnpm test -- src/lib/docs-surface/archive-candidates.test.ts | Protected canonical, execution-input, generated, and research fixtures pass. | gap |
| FR-008 | Keep JSON stable enough for docs-gate advisory projection. | Report contract and script | scripts/check-docs-archive-candidates.ts | pnpm docs:archive-candidates -- --json | Output validates as docs-archive-candidates-report/v1. | gap |
| FR-009 | Text output clearly says advisory and no deletion or moves. | Script presenter | scripts/check-docs-archive-candidates.ts | pnpm docs:archive-candidates | Text output contains advisory and non-mutation boundary. | gap |
| FR-010 | Docs-gate integration is advisory only. | Docs-gate consumer | src/commands/docs-gate-core.ts, src/commands/docs-gate.test.ts, src/lib/cli/registry/docs-gate-command-spec.ts, src/lib/output/normalise-docs-gate.ts | bash scripts/run-harness-gate.sh docs-gate --mode required --json | Required docs-gate remains pass when only archive candidates exist, with advisory findings separated from required findings. | gap |
| FR-011 | Split archive candidates from governance repair findings. | Classifier and contract | src/lib/docs-surface/archive-candidates.ts | pnpm test -- src/lib/docs-surface/archive-candidates.test.ts | Metadata, manifest, generated-source-link, and archive-index gaps land in repairFindings. | gap |
| NFR-001 | Deterministic for a given repository tree. | Scanner/report contract | src/lib/docs-surface/archive-candidates-contract.ts | pnpm test -- src/lib/docs-surface/archive-candidates-contract.test.ts | Timestamp injection or normalization keeps snapshots stable. | gap |
| NFR-002 | No network access. | Script and tests | scripts/check-docs-archive-candidates.ts | pnpm test -- src/lib/docs-surface/archive-candidates*.test.ts | Tests use local fixtures only; no external services are called. | gap |
| NFR-003 | Do not inspect secrets, local DBs, dependency folders, or runtime output. | Scanner boundary | src/lib/docs-surface/archive-candidates-scanner.ts | pnpm test -- src/lib/docs-surface/archive-candidates-scanner.test.ts | Exclusion fixtures cover caches, telemetry, dependency output, and transcripts. | gap |
| NFR-004 | Do not follow symlinks outside repo root. | Scanner boundary | src/lib/docs-surface/archive-candidates-scanner.ts | pnpm test -- src/lib/docs-surface/archive-candidates-scanner.test.ts | Symlink escape fixture fails closed or is ignored with evidence. | gap |
| NFR-005 | Report only repo-relative or redacted paths. | Contract validation | src/lib/docs-surface/archive-candidates-contract.ts | pnpm test -- src/lib/docs-surface/archive-candidates-contract.test.ts | Absolute local paths are rejected in all emitted fields. | gap |
| NFR-006 | Keep scanner small enough for focused fixtures. | Architecture boundary | src/lib/docs-surface/archive-candidates*.ts | pnpm run quality:size | Size ratchets pass or split point is recorded. | gap |
| SA-001 | Superseded tracked doc with replacement ref becomes candidate with evidence and no delete claim. | Classifier | src/lib/docs-surface/archive-candidates.test.ts | pnpm test -- src/lib/docs-surface/archive-candidates.test.ts | Fixture asserts superseded_status, replacement evidence, and no delete claim. | gap |
| SA-002 | Root canonical doc with low inbound links is protected. | Classifier | src/lib/docs-surface/archive-candidates.test.ts | pnpm test -- src/lib/docs-surface/archive-candidates.test.ts | Fixture asserts root_entrypoint or canon_or_canonical. | gap |
| SA-003 | Old inactive research audit is retained or low/medium confidence, not disposable. | Classifier | src/lib/docs-surface/archive-candidates.test.ts | pnpm test -- src/lib/docs-surface/archive-candidates.test.ts | Fixture asserts research_value_retained unless admitted evidence says otherwise. | gap |
| SA-004 | Execution-input or active-artifact referenced plan/spec is protected. | Route freshness classifier | src/lib/docs-surface/archive-candidates.test.ts | pnpm test -- src/lib/docs-surface/archive-candidates.test.ts | Fixture asserts execution_input or active_artifact_reference. | gap |
| SA-005 | Generated projection lacking source ref is repairFinding or ignored, not candidate. | Generated-output classifier | src/lib/docs-surface/archive-candidates.test.ts | pnpm test -- src/lib/docs-surface/archive-candidates.test.ts | Fixture asserts generated_output_do_not_edit and no candidate entry. | gap |
| SA-006 | Candidates do not fail required docs-gate. | Docs-gate projection | src/commands/docs-gate.test.ts and src/lib/output/normalise-docs-gate.ts | bash scripts/run-harness-gate.sh docs-gate --mode required --json | Required docs-gate pass with advisory candidates only, and noisy advisory output remains bounded. | gap |
| SA-007 | Destructive options and mutation-shaped aliases fail closed with exit code 2. | CLI script | scripts/check-docs-archive-candidates.ts | pnpm docs:archive-candidates -- --archive and pnpm docs:archive-candidates -- --apply | Commands exit 2 and emit destructive_option_unsupported. | gap |
| SA-008 | JSON uses stable schema, reason codes, and protection codes. | Report contract | src/lib/docs-surface/archive-candidates-contract.ts | pnpm docs:archive-candidates -- --json | Output contains docs-archive-candidates-report/v1 and stable code sets. | gap |
| SA-009 | Execution-input or canonical file missing from manifest is repair finding, not archive candidate. | Classifier | src/lib/docs-surface/archive-candidates.test.ts | pnpm test -- src/lib/docs-surface/archive-candidates.test.ts | Fixture emits metadata_repair_needed or protection_repair_needed. | gap |
| SA-010 | Stale/unverified active-artifacts absence does not increase candidate confidence. | Route freshness classifier | src/lib/docs-surface/archive-candidates.test.ts | pnpm test -- src/lib/docs-surface/archive-candidates.test.ts | Fixture emits active_reference_stale_or_unverified. | gap |
| SA-011 | JSON paths are repo-relative or redacted. | Contract validation | src/lib/docs-surface/archive-candidates-contract.ts | pnpm test -- src/lib/docs-surface/archive-candidates-contract.test.ts | Absolute paths are rejected. | gap |
| SA-012 | Generated architecture context source-link gap targets regeneration/source-link repair. | Generated-output classifier | src/lib/docs-surface/archive-candidates.test.ts | pnpm test -- src/lib/docs-surface/archive-candidates.test.ts | Fixture uses generated_output_do_not_edit and repair_generated_source_link codes, does not require an undefined sourceTruth field, and keeps the file out of candidates. | gap |
| VAC-007 | Archive candidate reporting is advisory and never deletes or moves files automatically. | Whole slice | scanner, script, docs-gate projection, docs | pnpm docs:archive-candidates -- --json and destructive-option test | Report is read-only; destructive options fail closed; docs-gate remains advisory. | gap |

## Work Units

### PU-000: Sy-Work Preflight and Resumption Gate

Objective: prove the next worker is on the intended route and will not treat
unrelated dirty files or stale active-artifacts state as implementation input.

Trace: FR-004, SA-010, VAC-007.

Allowed paths:

- no source edits before this gate completes
- this plan or implementation notes for recording preflight evidence

Tasks:

1. Capture git status --short --branch before implementation.
2. Identify unrelated dirty files and preserve them.
3. Confirm the current execution route names this plan and the source spec.
4. Classify .harness/active-artifacts.md freshness before using it as
   protection evidence.
5. Treat stale, missing, unparseable, route-mismatched, or unverified
   active-artifacts state as repair evidence only. It must not protect a file,
   suppress an archive candidate, or increase candidate confidence.
6. Re-run this gate before any resumed source-edit batch after interruption,
   compaction, checkout, pull, stash pop, branch switch, or new dirty-worktree
   state.

Closeout proof:

- recorded git status and dirty-file ownership notes
- recorded current spec/plan route
- recorded active-artifacts freshness classification, including the decision
  that stale or unverified entries are ineligible as protection evidence
- recorded resume-gate recheck in the sy-work handoff before resumed edits

### PU-001: Contract and Report Schema

Objective: define the machine-readable docs-archive-candidates-report/v1
contract before scanner behavior expands.

Trace: FR-005, FR-006, FR-008, NFR-001, NFR-005, SA-008, SA-011.

Allowed paths:

- src/lib/docs-surface/archive-candidates-contract.ts
- src/lib/docs-surface/archive-candidates-contract.test.ts

Tasks:

1. Define report, candidate, repair finding, protected file, ignored file,
   summary, reason, protection, suggested action, and confidence types.
2. Add validation for required fields, closed-enum action codes, advisoryOnly,
   actionAuthority: advisory_only, reviewed-decision flags, and absolute path
   rejection.
3. Add timestamp injection or normalization so snapshots stay deterministic.
4. Add negative tests for local absolute paths and destructive-looking
   free-form action text.

Closeout proof:

- pnpm test -- src/lib/docs-surface/archive-candidates-contract.test.ts

### PU-002: Scanner Boundary and Reference Corpus

Objective: scan only the admitted source universe and produce bounded reference
evidence.

Trace: FR-001, FR-003, NFR-002, NFR-003, NFR-004.

Allowed paths:

- src/lib/docs-surface/archive-candidates-scanner.ts
- src/lib/docs-surface/archive-candidates-scanner.test.ts

Tasks:

1. Build the git-tracked file list boundary.
2. Exclude dependency folders, runtime output, caches, telemetry, raw
   transcripts, binary/deleted files, and unsafe symlink targets.
3. Parse Markdown links, frontmatter path fields, lifecycle manifest
   dependencies, package script references, and low-confidence prose mentions.
4. Ensure code-fenced examples do not count as inbound references unless
   structured evidence also admits them.
5. Add a production git-index adapter and command-path test so scanner proof
   exercises the real file-list source, not only in-memory fixtures.
6. Add a sentinel fixture or adapter spy that fails when
   pnpm docs:archive-candidates -- --json receives a mocked, precomputed, or
   arbitrary filesystem file list instead of the production git-index adapter.

Closeout proof:

- pnpm test -- src/lib/docs-surface/archive-candidates-scanner.test.ts
- pnpm docs:archive-candidates -- --json
- pnpm test -- src/lib/docs-surface/archive-candidates-scanner.test.ts -t
  production-git-index-adapter, or the repo's equivalent focused test command
  if the final test name differs

### PU-003: Classifier and Route Freshness

Objective: classify candidates, repair findings, protected files, and ignored
files without turning weak evidence into archive authority.

Trace: FR-002, FR-004, FR-007, FR-011, SA-001 through SA-005, SA-009, SA-010,
SA-012.

Allowed paths:

- src/lib/docs-surface/archive-candidates.ts
- src/lib/docs-surface/archive-candidates.test.ts

Tasks:

1. Apply lifecycle metadata mapping by surface type.
2. Protect canon, canonical, root-entrypoint, agent-instruction,
   package-distribution, execution-input, current route, retained research, and
   historical evidence surfaces.
3. Protect active-artifact references only when the active index is fresh,
   parseable, route-matched, and points at an existing repo-relative file.
4. Emit repair findings for manifest gaps, lifecycle metadata gaps, stale
   active-artifact references, generated source-link gaps, and archive-index
   gaps.
5. Emit candidates only when no protection or repair-only rule suppresses the
   archive-candidate classification.
6. Prove generated projections and canonical/execution-input files cannot
   become archive candidates solely because metadata or references are missing.

Closeout proof:

- pnpm test -- src/lib/docs-surface/archive-candidates.test.ts

### PU-004: CLI Script and Package Command

Objective: expose the advisory report through a local operator command.

Trace: FR-006, FR-008, FR-009, SA-007, SA-008, VAC-007.

Allowed paths:

- scripts/check-docs-archive-candidates.ts
- package.json

Tasks:

1. Add text and --json output modes.
2. Keep successful advisory candidate/repair-finding runs at exit code 0.
3. Fail scanner/runtime contract errors with nonzero status.
4. Reject destructive options and mutation-shaped aliases such as --archive,
   --delete, --move, --demote, --rewrite-metadata, --update-manifest,
   --update-active-artifacts, --repair-index, --apply, --fix, --write, --rm,
   -a, -d, -m, -w, -f, -r, and any parser-supported short aliases with exit code 2 and
   destructive_option_unsupported.
5. Keep a closed destructive-option matrix next to the CLI parser. The matrix
   must enumerate every destructive long option, every supported short alias,
   and every mutation-shaped equivalent admitted by parser metadata.
6. Add pnpm docs:archive-candidates.

Closeout proof:

- pnpm docs:archive-candidates
- pnpm docs:archive-candidates -- --json
- pnpm docs:archive-candidates -- --archive
- pnpm docs:archive-candidates -- --apply
- pnpm test -- scripts/check-docs-archive-candidates.test.ts -t
  destructive-option-matrix, or the repo's equivalent focused test command if
  the implementation keeps CLI tests under src/lib/docs-surface
- matrix proof asserts exit code 2 and destructive_option_unsupported for
  --archive, --delete, --move, --demote, --rewrite-metadata,
  --update-manifest, --update-active-artifacts, --repair-index, --apply,
  --fix, --write, --rm, -a, -d, -m, -w, -f, -r, and any parser-supported
  short aliases

### PU-005: Advisory Docs-Gate Projection

Objective: surface archive-candidate report output through docs-gate as
advisory-only evidence without changing required docs-gate semantics.

Trace: FR-010, SA-006, VAC-007.

Allowed paths:

- src/commands/docs-gate-core.ts
- src/commands/docs-gate.test.ts
- src/lib/cli/registry/docs-gate-command-spec.ts
- src/lib/output/normalise-docs-gate.ts
- docs-gate-adjacent docs only if docs-gate reports a required synchronized
  governance surface

Tasks:

1. Add a distinct advisory rule id such as docs_archive_candidates_advisory.
2. Preserve reason codes, protection codes, suggested actions, evidence refs,
   and advisoryOnly in projection.
3. Keep required docs-gate status passing when only advisory candidates or
   repair findings exist.
4. Keep scanner runtime/contract failures separate from advisory findings.
5. Add a noisy-repository fixture proving advisory archive output is summarized,
   bounded, and does not swamp required lifecycle/task-eval findings.
6. Keep full advisory details in --json output or an artifact pointer while
   text output shows summary counts and bounded samples.
7. Document and test an internal disable/flag path if visible projection is too
   noisy to enable immediately.
8. In text mode, suppress protected and ignored detail rows by default, cap
   advisory candidate and repair-finding samples, and print the cap and
   hidden-count summary before any sample rows.
9. The noisy fixture must assert separate summary counts for lifecycle errors,
   task-eval errors, archive candidates, repair findings, protected files, and
   ignored files.

Closeout proof:

- bash scripts/run-harness-gate.sh docs-gate --mode required --json
- pnpm test -- src/commands/docs-gate.test.ts
- pnpm test -- src/commands/docs-gate.test.ts -t
  noisy-advisory-archive-candidates, or the repo's equivalent focused
  docs-gate fixture command
- noisy fixture proves required-mode status remains pass, category counts are
  separated, protected/ignored details are suppressed by default, advisory rows
  are capped, and full details remain available through JSON or an artifact
  pointer

### PU-006: Minimal Docs and Closeout Evidence

Objective: expose the non-deletion boundary and validation record without
widening into progressive-disclosure cleanup.

Trace: FR-009, VAC-007.

Allowed paths:

- the smallest current docs-surface or agent-governance doc selected by
  docs-gate and implementation impact
- this plan or implementation notes if needed for handoff evidence

Tasks:

1. Document that archive-candidate reporting is advisory only.
2. Document that archive, delete, move, demotion, manifest update,
   active-artifact update, source-link update, and archive-index repair require
   separate reviewed decisions.
3. Record validation command outcomes exactly.
4. Keep downstream templates and generated architecture context unchanged unless
   a validation gate proves a synchronized update is required.

Closeout proof:

- pnpm docs:lint
- pnpm docs:lifecycle --json
- pnpm run test:related

## Evidence Checked

- .harness/specs/2026-06-05-advisory-stale-document-archive-candidate-reporting-spec.md
- .harness/plan/2026-06-04-documentation-architecture-comparison-plan.md
- .harness/plan/2026-06-04-reader-task-documentation-eval-plan.md
- CODESTYLE.md
- codestyle/04-docs-config-and-release.md
- $sy-trace-plan source contract

## Validation

Validation performed for this trace-plan stage:

- Command: pnpm docs:lint -> pass
- Command: pnpm docs:lifecycle --json -> pass

Validation required during sy-work:

- Command: git status --short --branch -> pending implementation preflight
- Command: pnpm test -- src/lib/docs-surface/archive-candidates-contract.test.ts -> pending implementation
- Command: pnpm test -- src/lib/docs-surface/archive-candidates-scanner.test.ts -> pending implementation
- Command: pnpm test -- src/lib/docs-surface/archive-candidates.test.ts -> pending implementation
- Command: pnpm docs:archive-candidates -> pending implementation
- Command: pnpm docs:archive-candidates -- --json -> pending implementation
- Command: pnpm docs:archive-candidates -- --archive -> pending implementation
- Command: pnpm docs:archive-candidates -- --apply -> pending implementation
- Command: pnpm test -- scripts/check-docs-archive-candidates.test.ts -t destructive-option-matrix -> pending implementation, or repo-equivalent focused CLI test path if the implementation keeps CLI tests under src/lib/docs-surface
- Command: bash scripts/run-harness-gate.sh docs-gate --mode required --json -> pending implementation
- Command: pnpm test -- src/commands/docs-gate.test.ts -> pending implementation
- Command: pnpm test -- src/commands/docs-gate.test.ts -t noisy-advisory-archive-candidates -> pending implementation, or repo-equivalent focused docs-gate fixture path
- Command: pnpm run test:related -> pending implementation

## Open Risks

- Live Linear status for JSC-395 was not refreshed in this stage.
- PR state, CI state, CodeRabbit review, review-thread state, mergeability, and
  release readiness were not checked.
- Docs-gate projection is in scope for JSC-395 as advisory-only output; sy-work
  must keep it bounded by the noise budget or document a tested internal
  disable path before visible projection is enabled.
- The current worktree contains unrelated modified files; implementation must
  preserve them and record preflight ownership before source edits.
- .harness/active-artifacts.md is known to be a possible stale-route surface
  and must not be used as negative evidence by absence or as protection
  evidence unless it is fresh, parseable, route-matched, and points at existing
  repo-relative files.

## Next Stage

next_stage: sy-work

Recommended sy-work prompt:

~~~text
[$sy-work] implement .harness/plan/2026-06-05-advisory-stale-document-archive-candidate-reporting-trace-plan.md
~~~

Resume requirement: before any resumed sy-work edits after interruption,
compaction, checkout, pull, stash pop, branch switch, or new dirty-worktree
state, re-run PU-000 and record updated git status, dirty-file ownership, route
freshness, and active-artifacts freshness. Do not reuse stale preflight notes as
protection evidence.

## Handoff Checklist

- Source spec mapped to requirements, acceptance criteria, artifacts,
  validation, and proof.
- Destructive actions remain outside this slice.
- External lanes are explicitly unchecked.
- Implementation can proceed only as read-only advisory reporting.
