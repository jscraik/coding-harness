# ADR-003

## Title

Executable Governance Or Delete It

## Status

accepted

## Table Of Contents

- [Decision](#decision)
- [Context](#context)
- [Why This Decision Exists](#why-this-decision-exists)
- [Alternatives Considered](#alternatives-considered)
- [Accepted Tradeoffs](#accepted-tradeoffs)
- [Anti-Drift Constraints](#anti-drift-constraints)
- [Safe Revisit Conditions](#safe-revisit-conditions)
- [Related Systems](#related-systems)
- [Evidence](#evidence)

## Decision

Governance policy must be executable, generated from an executable source, or
explicitly marked as reference-only. Governance prose without an enforcement
destination should be deleted rather than duplicated.

New governance surfaces require:

- repeated-failure or safety reason
- canonical owner
- enforcement path or generated projection
- validation command
- deletion or revisit condition

## Context

Coding Harness intentionally uses repo-local governance because agent workflows
need visible contracts, not tribal knowledge. The same strength creates a
failure mode: policy language can multiply across docs, PR templates, contracts,
skills, and CI files until agents cannot tell which surface is authoritative.

## Why This Decision Exists

Governance is useful only when it reduces ambiguity or prevents repeated
failures. Repeated prose that is not enforced becomes drift inventory.

This decision prevents future agents from solving every defect by adding another
instruction paragraph.

## Alternatives Considered

- Keep all governance prose for onboarding comfort: rejected because duplication
  increases contradiction risk.
- Centralize everything in a long policy document: rejected because agents need
  short routing surfaces and executable checks.
- Rely on review to catch policy drift: rejected because review is exactly the
  cost the harness is meant to reduce.

## Accepted Tradeoffs

- Some docs become less explanatory.
- Contributors must do more work before adding new policy.
- Reference-only docs must clearly give up authority.

## Anti-Drift Constraints

- No new governance doc without an owner and enforcement/projection plan.
- No repeated policy paragraph unless generated from a canonical source.
- Prompt growth must not substitute for a harness improvement when a deterministic
  check is feasible.
- PR template checks must not require symbolic or placeholder evidence.
- Governance should block merges only when it protects safety, review readiness,
  or contract integrity.

## Safe Revisit Conditions

Revisit if evidence shows that deleted or compressed governance materially
increases repeated failures that cannot be caught by scripts, contracts, CI, or
review-gate evidence.

## Related Systems

- `harness.contract.json`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `docs/agents/**`
- `AGENTS.md`
- `.circleci/config.yml`
- `.harness/refactors/governance-contract-memory-simplification.md`

## Evidence

Facts:

- `.harness/features/coding-harness-intent.md` says governance only works for
  agents when it lives in the repo and is enforced by CI, while warning that too
  many layers can become harder to operate than the work they protect.
- `.harness/review/coding-harness-architecture-review.md` identifies governance
  breadth, repeated prose, and placeholder trust surfaces as architectural drag.
- `.harness/triage/coding-harness-triage.md` recommends Governance Admission
  Criteria and rejects low-leverage governance expansion.
- `.harness/strategy/coding-harness-strategy.md` states that governance must be
  executable or deleted.

Interpretation:

- Governance is part of the moat only when it creates operational reliability
  cheaper than the failures it prevents.

Assumptions:

- Most valuable governance rules can be represented as contracts, scripts, CI
  checks, generated docs, or explicit review gates.
