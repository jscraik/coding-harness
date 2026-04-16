# Project Brain v1 Contract

> **Status:** Active (JSC-183)
> **Version:** 1.0.0
> **Last updated:** 2026-04-16

## Overview

Project Brain is the persistent knowledge management layer for Coding Harness.
It stores domain-specific knowledge, hypotheses, rules, decision records, and
quality criteria in a structured, queryable format under `.harness/`.

This document defines the v1 contract: file structure, required fields,
validation rules, and migration strategy.

## File structure

```
.harness/
├── knowledge/
│   ├── INDEX.md                    # Required: domain catalog and health summary
│   ├── <domain>/
│   │   ├── knowledge.md            # Required: confirmed facts, patterns, gotchas
│   │   ├── hypotheses.md           # Required: active and resolved hypotheses
│   │   └── rules.md                # Required: promoted rules and conventions
│   └── ...
├── quality/
│   └── criteria.md                 # Required: quality gates and acceptance criteria
├── decisions/
│   └── <YYYY-MM-DD>-<slug>.md      # Optional: architectural decision records
└── review-log.md                   # Required: completed review entries
```

## INDEX.md contract

The INDEX.md file is the entry point for Project Brain navigation.

### Required sections

```markdown
# Knowledge Index

**Last updated:** YYYY-MM-DD

## Domains

| Domain | Focus | Last updated | Key rules |
|--------|-------|--------------|-----------|
| [domain-name](./domain-name/) | One-line focus description | YYYY-MM-DD | N rules |

## Recently active

- [domain-name] Brief description of recent change (YYYY-MM-DD)

## Review needed

- [domain-name] Reason for review flag (YYYY-MM-DD)

## Archive

(none yet)
```

### Validation rules

1. `Last updated` must be a valid ISO date (YYYY-MM-DD)
2. Domain table must have all four columns
3. Domain focus must NOT be a placeholder (e.g., `{describe focus}`, `(none yet)`)
4. Each domain must have a corresponding directory under `knowledge/`
5. `Recently active` entries must include a date

## Domain knowledge.md contract

### Required sections

```markdown
# <Domain> Knowledge

**Last verified:** YYYY-MM-DD
**Verification source:** manual | automated | codex-learn
**Confidence:** high | medium | low
**Owner:** email or identifier

## Confirmed facts

- Fact description with evidence reference

## Patterns

- Pattern name: description

## Gotchas

- Gotcha description with remediation

## References

- Reference description or URL
```

### Metadata fields

| Field | Required | Description |
|-------|----------|-------------|
| `Last verified` | Yes | Date of last verification |
| `Verification source` | Yes | How the knowledge was verified |
| `Confidence` | Yes | Confidence level (high/medium/low) |
| `Owner` | Yes | Responsible party for maintenance |

### Validation rules

1. All four metadata fields must be present
2. `Last verified` must be a valid date
3. `Confidence` must be one of: high, medium, low
4. `Verification source` must be one of: manual, automated, codex-learn
5. Placeholder content is not allowed: `(none yet)`, `{describe ...}`

## Domain hypotheses.md contract

### Required sections

```markdown
# <Domain> Hypotheses

## Active

- **H-001**: Hypothesis description
  - Status: active
  - Created: YYYY-MM-DD
  - Evidence for: description
  - Evidence against: description
  - Next validation step: description

## Resolved

- **H-001**: Resolution description (date)
```

### Validation rules

1. Active hypotheses must have status, created date, and next validation step
2. Resolved hypotheses must have a resolution description
3. Hypothesis IDs must follow `H-NNN` format within each domain

## Domain rules.md contract

### Required sections

```markdown
# <Domain> Rules

## Active rules

- **R-001**: Rule description
  - Severity: must | should | may
  - Rationale: why this rule exists
  - Last promoted: YYYY-MM-DD
  - Promoted from: H-NNN or manual

## Deprecated

- **R-NNN**: Deprecation reason (date)
```

### Validation rules

1. Active rules must have severity, rationale, and last promoted date
2. Severity must be one of: must, should, may
3. `Promoted from` must reference a hypothesis ID or state `manual`

## Quality criteria contract

### Required content

```markdown
# Quality Criteria

## Gates

- **Q-001**: Criteria description
  - Applies to: command | module | surface
  - Enforcement: automated | manual | advisory
  - Threshold: measurable threshold

## Coverage

- Surface: percentage covered
```

### Validation rules

1. Must have at least one gate defined
2. Each gate must have applies-to, enforcement, and threshold
3. Placeholder content `(none yet)` is not allowed

## Decision record contract

Decision records are optional but follow a specific format when present.

### Required sections

```markdown
# <Title>

- **Date:** YYYY-MM-DD
- **Status:** proposed | accepted | deprecated
- **Context:** What is the decision context
- **Decision:** What was decided
- **Consequences:** What are the implications

## Alternatives considered

1. Alternative description and why it was not chosen
```

## Review log contract

```markdown
# Review Log

## Entries

- **YYYY-MM-DD**: [domain] Review summary
  - Reviewer: identifier
  - Findings: count
  - Actions: description
```

### Validation rules

1. Each entry must have date, domain, reviewer, and at least one action
2. Date must be valid ISO format
3. Reviewer must be an identifiable party

## Validation command

```bash
harness brain status --validate
```

This command validates all Project Brain artifacts against the v1 contract,
reporting:
- Missing required files
- Missing metadata fields
- Placeholder content
- Invalid date formats
- Coverage gaps

## Migration from v0 (placeholder scaffold)

The migration path from placeholder scaffolds to v1:

1. **INDEX.md**: Replace `{describe focus}` with actual domain focus descriptions
2. **Domain files**: Fill in metadata headers (last_verified, confidence, owner)
3. **Quality criteria**: Add at least one measurable quality gate
4. **Review log**: Log the migration as the first review entry

Migration is not automatic — it requires domain expertise to fill in
accurate content. The `harness brain status` command identifies remaining
gaps.

## Compatibility notes

- v1 is backward-compatible with existing placeholder content (validation
  reports it as incomplete rather than failing)
- New metadata fields are additive
- No file renames or restructuring required for existing installations
