# Pattern Generalization Enforcement Gap

Date: 2026-05-18

## Table of Contents

- [Purpose](#purpose)
- [User Signal](#user-signal)
- [Existing Coverage](#existing-coverage)
- [Gaps](#gaps)
- [Contradictions](#contradictions)
- [Trim Or Refactor](#trim-or-refactor)
- [Recommended Repair Path](#recommended-repair-path)

## Purpose

Identify why Coding Harness can already contain strong repeated-steering and
pattern-generalization language while Jamie still has to tell Codex to apply
the same principle across multiple places in a codebase.

## User Signal

Jamie reported that even with steering, the development pain remains:

- Codex often applies a correction locally.
- Jamie then has to ask for the same correction in multiple places.
- The desired behavior is larger-system judgment: infer the broader principle,
  inspect sibling surfaces, and apply or explicitly reject the wider pattern.

This is not a missing wording problem. The wording exists. The gap is that the
wording is not yet converted into a pre-edit or mid-implementation control.

## Existing Coverage

- AGENTS.md says every correction that implies a design principle triggers a
  pattern-generalization pass across sibling code, tests, docs, templates,
  skills, and gates.
- CODESTYLE.md says design corrections must be generalized before closeout and
  gives a concrete sibling-API example.
- .harness/memory/LEARNINGS.md records several repeated-steering learnings
  about line-level corrections, principle inference, sibling searches, and
  intentionally unchanged siblings.
- docs/agents/04-validation.md defines the agent engineering proof loop:
  observe, orient, decide, act, and close out.
- .github/PULL_REQUEST_TEMPLATE.md requires a Pattern scope inventory.
- src/lib/pr-template-validator.ts rejects PR bodies that admit line-level or
  design-pattern feedback without principle, sibling search, changed siblings,
  and unchanged/deferred sibling evidence.
- scripts/check-steering-feedback-contract.cjs keeps the rule connected across
  AGENTS, validation docs, glossary, memory, PR template, validator, and
  solution record.

## Gaps

### Gap 1: Closeout Enforcement, Not Implementation Enforcement

The strongest executable guard is the PR-template validator. That catches weak
or missing pattern inventory only when the PR body admits a pattern-bearing
correction. Jamie's pain happens earlier: during the edit loop, Codex has
already made a local patch and has to be steered into sibling work.

Impact: the rule can pass closeout ceremony while still failing development
behavior.

### Gap 2: Admission-Driven, Not Diff-Driven

pr-template-gate depends on text signals in the PR body. If the agent does not
admit that feedback was pattern-bearing, the validator may not require the
inventory.

Impact: the agent can avoid the broader obligation by omission, even when the
diff shape suggests sibling risk.

### Gap 3: No Sibling Discovery Primitive

The repo tells agents to search siblings, but does not expose a compact command
such as harness pattern-scope that accepts changed files or a feedback phrase
and returns likely sibling files, tests, docs, templates, generated surfaces,
and validators.

Impact: each agent improvises sibling search, so quality depends on taste and
available context.

### Gap 4: No Required Pattern Scope Artifact Before Claiming Done

The contract names a pattern scope inventory, but the inventory mostly exists
as PR-body text. There is no required local artifact for current-session
steering such as .harness/review/YYYY-MM-DD-pattern-scope.md or a machine-readable
JSON packet that can be validated before the PR exists.

Impact: pattern reasoning is not durable during implementation, especially
before a PR body is written.

### Gap 5: Validator Checks Words, Not Evidence

The PR validator checks whether the inventory names principle, sibling search,
changed siblings, and unchanged/deferred siblings. It does not verify that the
listed sibling files exist, were searched, were changed when relevant, or have
validation evidence.

Impact: the inventory can be plausible prose rather than proof.

### Gap 6: Broader-Perspective Trigger Coverage Is Incomplete

The validator and guard include many trigger phrases, but the exact user signal
same things in multiple places and larger perspective is not a first-class
trigger phrase. The spirit is covered, but this wording should be treated as
high-signal because it describes the defect directly.

Impact: the user's clearest phrasing can still fall through a phrase-based
admission system.

### Gap 7: No Connection To Existing Blast-Radius Style Commands

Coding Harness already has concepts such as risk tiers, blast radius, command
truth, review context, and next-action routing. Pattern generalization is not
yet clearly connected to those command surfaces.

Impact: sibling-scope work remains a social instruction instead of becoming
part of the same decision machinery as risk and validation.

### Gap 8: The Rule Is Buried In Dense Meta Text

AGENTS.md contains the rule, but it is embedded in a long bullet that carries
many other obligations. That is easy for an agent to acknowledge globally while
missing operationally at the moment of edit.

Impact: the instruction is present but not shaped as a short execution
checkpoint.

## Contradictions

- The repo says standalone prose is not enough, but the strongest current
  implementation of the broader-perspective requirement is still mostly prose
  plus PR-body validation.
- The repo says the pattern-generalization pass must happen before claiming a
  correction is fixed, but the executable guard mostly runs at PR closeout.
- The repo says repeated steering is a stop-the-line defect, but there is no
  current-session artifact or command that must be produced immediately when
  Jamie gives this exact steering.
- The repo says agents should use larger-system judgment, but the practical
  workflow still makes Jamie identify the sibling surfaces when Codex fails to
  do so.

## Trim Or Refactor

- Trim repeated prose copies of the same steering rule once a typed artifact or
  command owns the behavior.
- Refactor the long AGENTS.md agent-engineering paragraph into a shorter
  execution checklist plus references to the canonical validation section.
- Refactor PR-body-only evidence into a reusable pattern-scope packet that can
  be produced during implementation and summarized later in the PR body.
- Refactor phrase-only trigger detection toward changed-file and diff-shape
  heuristics: same helper family, same command family, same schema field,
  generated projection, mirrored docs, or repeated fixture pattern.
- Remove any future governance text that says search siblings without naming
  the command, artifact, or validator that proves the search.

## Recommended Repair Path

1. Define pattern-scope/v1 as a small artifact with principle, trigger, changed
   files, sibling search commands, candidate siblings, siblings changed,
   siblings unchanged with reasons, deferred follow-ups, and validation.
2. Add a harness pattern-scope --files ... --feedback ... --json command or a
   narrower script that produces candidate sibling surfaces using ripgrep,
   import relationships, command registry metadata, generated templates, and
   docs references.
3. Teach harness next --json or verify-work to require a pattern-scope packet
   when current-session steering, line-level design feedback, repeated review
   comments, or phrase triggers are present.
4. Extend trigger coverage to include same things in multiple places, larger
   perspective, larger-system judgment, broader perspective, and apply this
   everywhere relevant.
5. Update the PR-template validator to accept a referenced pattern-scope packet
   and verify that the referenced file exists and contains required fields.
6. Compress AGENTS.md after the executable path exists, so the rule becomes a
   short checklist instead of another paragraph future agents can skim past.
