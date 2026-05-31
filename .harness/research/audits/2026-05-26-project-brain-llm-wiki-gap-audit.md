# Project Brain LLM Wiki Gap Audit

schema_version: project-brain-gap-audit/v1
audit_date: 2026-05-26
status: draft
capability_surface: Project Brain, Local Memory, Obsidian-compatible Markdown,
llm-wiki hygiene, and OODA horizon support.

## Table of Contents

- [Purpose](#purpose)
- [Fresh Evidence](#fresh-evidence)
- [Capability Surface](#capability-surface)
- [OODA Horizon Gap](#ooda-horizon-gap)
- [LLM Wiki Benchmark](#llm-wiki-benchmark)
- [Gap Findings](#gap-findings)
- [Architecture Options](#architecture-options)
- [Selected Decision](#selected-decision)
- [Recommended First Move](#recommended-first-move)
- [Tracer Proof](#tracer-proof)
- [Decision Surface](#decision-surface)
- [Validation](#validation)
- [Confidence](#confidence)

## Purpose

This audit judges the current Coding Harness Project Brain setup against the
llm-wiki operating model and the architecture goal of extending an agent's OODA
horizon.

The target is not to make Obsidian a runtime dependency. The target is a
Codex-first Markdown control plane that is safe to open as an Obsidian vault,
safe to query across compaction and harness boundaries, and explicit about
which remembered claims are evidence-backed, fresh, sensitive, or uncertain.

## Fresh Evidence

- docs/architecture/project-brain-v1-contract.md:9 defines Project Brain as
  the persistent knowledge management layer.
- docs/architecture/project-brain-v1-contract.md:18 to
  docs/architecture/project-brain-v1-contract.md:31 defines the v1 file
  structure under .harness/knowledge, .harness/quality, .harness/decisions,
  and .harness/review-log.md.
- docs/architecture/project-brain-v1-contract.md:79 to
  docs/architecture/project-brain-v1-contract.md:87 requires domain metadata
  and asks confirmed facts to carry evidence references.
- docs/architecture/project-brain-v1-contract.md:154 to
  docs/architecture/project-brain-v1-contract.md:169 requires rule metadata,
  but does not require source citations, confidence, or sensitivity per rule.
- src/lib/project-brain/cli.ts:14 to src/lib/project-brain/cli.ts:20 exposes
  only status, query, add, preflight, and stale.
- .harness/knowledge/cli/knowledge.md:3 to
  .harness/knowledge/cli/knowledge.md:6 carries legacy inline metadata.
- .harness/knowledge/cli/knowledge.md:10 to
  .harness/knowledge/cli/knowledge.md:12 has useful confirmed facts, but no
  claim-level source anchors.
- .harness/knowledge/cli/rules.md:8 to
  .harness/knowledge/cli/rules.md:12 records a promoted rule, but its
  provenance is the broad phrase "Project Brain setup audit".
- .harness/quality/criteria.md:22 to .harness/quality/criteria.md:26 already
  makes Project Brain preflight and durable learning promotion quality
  criteria.
- .harness/README.md classifies .harness/knowledge/**.md as tracked secondary
  context and .harness/quality/** as tracked policy, so a gap audit here is
  evidence, not automatic execution authority.

## Capability Surface

Project Brain is already useful as a structured local control plane.

Current strengths:

- Domain folders are predictable.
- The index is current enough to route CLI, CI, tooling, runtime evidence,
  testing, agent context, and memory provenance.
- brain preflight can load relevant context for changed files.
- brain add can promote learnings, decisions, hypotheses, and rules.
- The current implementation keeps Obsidian optional and avoids runtime
  dependency on vault plugins.
- Quality criteria already say route-driving changes should run Project Brain
  preflight or record a skip reason.

The missing capability is trust calibration. Agents can find Project Brain
content, but cannot yet ask the content itself whether its claims are cited,
fresh, sensitivity-classified, linked, superseded, or safe to promote.

## OODA Horizon Gap

The architectural goal is wider OODA, not merely better notes.

Horizontal horizon means agents can observe and orient against organizational
activity outside the immediate turn: prior reviews, Local Memory, Project Brain,
Linear slices, research artifacts, CI state, and other active work.

Vertical horizon means agents know they are acting over stacked trajectories:
the current patch, prior compactions, earlier review swarms, downstream harness
install behavior, release governance, and future closeout obligations.

Current Project Brain helps both horizons by keeping durable context in the
repo, but it does not yet make the horizon safe enough. The system needs a way
to distinguish:

- cited claim from remembered assertion,
- current rule from stale rule,
- source summary from raw source,
- secondary context from execution authority,
- public-safe synthesis from restricted local evidence,
- active decision from superseded decision.

Without that distinction, horizontal recall can amplify stale organizational
noise, and vertical recall can treat one trajectory's assumption as a later
trajectory's fact.

## LLM Wiki Benchmark

llm-wiki sets the benchmark as: cited local files beat remembered answers.
For Project Brain, that implies knowledge is not just readable by agents. It
must be inspectable, lintable, and safe to reuse after compaction.

The relevant update gate is:

> A wiki update passes when every changed claim has a source citation or
> explicit uncertainty marker, new wikilinks resolve or are intentional stubs,
> aliases do not create duplicate identities, attachments stay under the
> approved local asset path, index/log entries name the change, and no broad
> rename/reorganization happened. Fail fast: stop at the first failed gate; do
> not proceed. Optional local checks: `rg -n "\\[\\[[^]]+\\]\\]" wiki/` for
> wikilinks and `find raw/assets -type f` for attachments.

Project Brain currently satisfies the local Markdown and index portions of that
standard, but it does not yet satisfy citation, wiki-link, alias, sensitivity,
attachment, mutation-log, or lint portions.

## Gap Findings

### P1: No Formal Trust Lint Surface

Project Brain has status, query, add, preflight, and stale, but no lint
command. status validates shape. It does not express an llm-wiki-style trust
report with unsupported assertions, broken wikilinks, duplicate aliases, unclear
sensitivity, stale reviewed dates, and orphan pages.

Evidence:

- src/lib/project-brain/cli.ts:14 to src/lib/project-brain/cli.ts:20
  enumerates the current subcommands.
- docs/architecture/project-brain-v1-contract.md:238 describes validation
  through harness brain status --validate, not a knowledge-trust lint schema.

Remediation:

- Add read-only harness brain lint --json.
- Start with warnings rather than migration edits.
- Emit project-brain-lint/v1 with stable finding kinds and file evidence.

### P1: Claims Are Not Citation-Gated

Domain pages include useful facts, but the current contract only asks for a
general verification source and references. It does not require every changed
claim or rule to cite a path, line, source summary, review artifact, or explicit
uncertainty marker.

Evidence:

- .harness/knowledge/cli/knowledge.md:10 to
  .harness/knowledge/cli/knowledge.md:12 records confirmed facts without
  claim-level citations.
- .harness/knowledge/cli/rules.md:8 to
  .harness/knowledge/cli/rules.md:12 records a rule with broad provenance but
  no source anchor.
- docs/architecture/project-brain-v1-contract.md:86 asks for an evidence
  reference, but the implemented page shape does not make that machine-checkable.

Remediation:

- Extend brain add with optional --source, --confidence, and --sensitivity.
- Teach lint to flag facts and rules without Source or an uncertainty marker.

### P1: OODA Horizon Memory Is Not Freshness-Bounded

Project Brain expands orientation across turns, but the current artifact model
does not force agents to treat reused context as time-bounded. This is risky for
horizontal organizational recall and vertical stacked-trajectory recall.

Evidence:

- .harness/knowledge/cli/knowledge.md:3 records Last verified, but facts under
  it do not carry individual reviewed dates.
- .harness/quality/criteria.md:25 recommends brain preflight for route-driving
  changes, but does not define freshness or stale-context blockers.

Remediation:

- Add lint findings for stale page review dates and stale claim dates.
- Treat stale route-driving Project Brain context as a warning first, then a
  blocker only for high-authority surfaces.

### P2: Obsidian-Compatible, Not Obsidian-Native

The .harness/knowledge tree can be opened in Obsidian, but it does not use a
consistent wikilink or frontmatter model.

Evidence:

- .harness/knowledge/INDEX.md:7 to .harness/knowledge/INDEX.md:18 uses
  Markdown links for domains.
- A search for wikilinks, YAML frontmatter, aliases, source arrays, and
  sensitivity fields under .harness/knowledge, .harness/quality, and
  .harness/review-log.md found no meaningful wiki metadata beyond a Markdown
  horizontal rule.

Remediation:

- Define frontmatter for domain pages: type, domain, status, sources, aliases,
  confidence, reviewed, sensitivity, and supersedes.
- Add a lint check for broken wikilinks and duplicate aliases before broad
  migration.

### P2: No Dedicated Knowledge Mutation Log

Project Brain has .harness/review-log.md, but not a mutation log that records
each knowledge ingest, promotion, source-summary update, rename, or no-rename
decision.

Evidence:

- .harness/review-log.md:1 to .harness/review-log.md:16 is a periodic review
  log, not a per-update wiki mutation log.

Remediation:

- Add .harness/knowledge/LOG.md or a dedicated Project Brain section in
  .harness/review-log.md.
- Require every automated or manual knowledge update to name pages changed and
  broad rename status.

### P2: Source-Summary Promotion Is Informal

The repo has curated research and Project Brain pages, but there is no formal
bridge from raw research/review evidence into source summaries and selected
domain knowledge.

Evidence:

- .harness/README.md keeps .harness/research/audits/**.md at secondary-context
  unless adopted by an evidence pattern, plan, or spec.
- Project Brain v1 defines domain files, but not source-summary files.

Remediation:

- Add brain ingest --source path --domain domain --json later.
- Keep the first implementation read-only by adding lint before ingest.

### P2: Sensitivity Is Not Classified Per Claim Or Source

Project Brain can contain local review notes, sessions, PR evidence, memory
snippets, and source references. The current page model does not classify
sources as public, internal, confidential, or restricted.

Evidence:

- .harness/knowledge/cli/knowledge.md:3 to
  .harness/knowledge/cli/knowledge.md:6 has confidence and owner metadata, but
  no sensitivity field.
- .harness/README.md explains tracking policy and redaction expectations, but
  sensitivity is not attached to individual Project Brain pages or entries.

Remediation:

- Add sensitivity metadata to pages and source references.
- Lint unclear sensitivity as a warning for now and as a failure for promoted
  source summaries later.

### P3: Rule Identity Is Locally Unique But Not Allocated

The current pages can use stable R-NNN IDs, and the shared typed rule parser
supports compatibility formats. The next gap is allocation and collision
prevention across generated additions.

Evidence:

- .harness/knowledge/cli/rules.md:14 to
  .harness/knowledge/cli/rules.md:18 says each rule gets a unique R-NNN
  identifier within its domain.

Remediation:

- Add rule ID allocation after lint and citation support.
- Avoid making numbering the first slice because provenance is the larger trust
  gap.

## Architecture Options

### Patch Design

Document the gaps, add manual page-frontmatter guidance, and update a few domain
pages by hand.

Benefits:

- Very low implementation risk.
- Improves human readability quickly.

Costs:

- Does not give Codex a machine-checkable trust boundary.
- Allows drift to return as soon as agents add pages without the new convention.

### Interface Design

Add a read-only brain lint --json interface and typed lint finding model first.
Use it to check frontmatter, claim sources, wikilinks, aliases, reviewed dates,
sensitivity, and mutation-log entries. Migrations and ingest flows follow after
the lint contract is stable.

Benefits:

- Gives agents a deterministic trust check before relying on Project Brain.
- Supports horizontal OODA by flagging stale or unsupported organizational
  memory.
- Supports vertical OODA by showing whether stacked trajectory context is still
  current and cited.
- Keeps Obsidian optional.

Costs:

- Requires new tests and a stable JSON schema.
- Needs careful severity choices so existing Project Brain content is not
  abruptly treated as failed policy.

### Ingest Design

Add brain ingest first so research and review artifacts can promote into source
summaries and domain pages.

Benefits:

- Directly improves the source-summary bridge.
- Makes research artifacts more reusable.

Costs:

- Harder to make safe before citations, sensitivity, wikilinks, and freshness
  have a lint surface.
- Higher risk of turning broad research into overconfident durable rules.

## Selected Decision

request_user_input:

- Prompted for first implementation direction.
- Recommended option: Lint contract.
- No answer was received before this audit needed to proceed, so the default is
  the recommended low-risk slice.

selected_design_decision: interface_design

Start with harness brain lint --json. The command should be read-only and should
not migrate content. It should report findings against existing Project Brain
pages so the team can tune the trust contract before changing storage shape.

agent_safe_boundary: safe

The first slice is safe because it only reads tracked .harness Markdown and
emits diagnostics. It should not rewrite knowledge pages, infer authority, or
ingest raw sources.

## Recommended First Move

Implement harness brain lint --json with this initial schema:

```json
{
  "schema_version": "project-brain-lint/v1",
  "status": "pass|warn|fail",
  "findings": [
    {
      "severity": "warning",
      "kind": "unsupported_assertion",
      "path": ".harness/knowledge/cli/rules.md",
      "line": 8,
      "evidence": "Rule has no Source field",
      "owner": "project-brain"
    }
  ]
}
```

Initial finding kinds:

- missing_frontmatter
- missing_source
- unsupported_assertion
- missing_sensitivity
- stale_reviewed_date
- broken_wikilink
- duplicate_alias
- orphan_page
- missing_mutation_log
- attachment_outside_approved_path

Default severity plan:

- fail: malformed Project Brain structure that current status should also
  consider invalid.
- warn: missing citations, frontmatter, sensitivity, wikilinks, mutation log,
  and stale review dates during rollout.
- info: intentional stubs, secondary-context pages, or skipped sources with a
  recorded reason.

## Tracer Proof

Use .harness/knowledge/cli/rules.md as the first tracer.

Expected first lint result:

- missing_frontmatter at page level.
- missing_source for R-001.
- No broken_wikilink finding because the page currently uses no wikilinks.
- No automatic rewrite.

Follow-up tracer:

- Add frontmatter and a Source field to that one page.
- Rerun lint.
- Confirm only the intended findings clear.

## Decision Surface

This audit is secondary context. It should not route implementation by itself.
To make the work execution-authoritative, reference this file from one of:

- .harness/active-artifacts.md
- a tracked Linear issue artifact under .harness/linear
- an accepted plan under .harness/plan
- an adopted research evidence pattern

## Validation

Commands run while preparing this audit:

- sed -n "1,220p" CODESTYLE.md -> pass
- sed -n "1,240p" codestyle/04-docs-config-and-release.md -> pass
- sed -n "1,320p" docs/architecture/project-brain-v1-contract.md -> pass
- sed -n "1,260p" src/lib/project-brain/cli.ts -> pass
- sed -n "1,220p" .harness/README.md -> pass
- sed -n "1,220p" .harness/knowledge/INDEX.md -> pass
- sed -n "1,200p" .harness/knowledge/cli/knowledge.md -> pass
- sed -n "1,220p" .harness/knowledge/cli/rules.md -> pass
- sed -n "1,220p" .harness/review-log.md -> pass
- sed -n "1,220p" .harness/quality/criteria.md -> pass
- rg -n "\[\[|^---$|Source:|Sensitivity:|aliases:|sources:|confidence:"
  .harness/knowledge .harness/quality .harness/review-log.md -> pass

Validation still needed after implementation:

- Unit tests for the lint parser and JSON schema.
- CLI smoke for harness brain lint --json.
- bash scripts/validate-codestyle.sh --fast.

## Confidence

confidence: high

The audit is grounded in current repo files and the requested skill lenses. The
recommended first implementation is intentionally narrow because Project Brain
already exists; the highest-leverage gap is now trust calibration for reused
local knowledge, not more storage scaffolding.
