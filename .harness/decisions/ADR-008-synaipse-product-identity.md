# ADR-008

## Title

SynAIpse Is The Product Identity While Coding Harness Remains The
Implementation Surface

## Status

accepted

## Table Of Contents

- [Decision](#decision)
- [Context](#context)
- [Why This Decision Exists](#why-this-decision-exists)
- [Alternatives Considered](#alternatives-considered)
- [Accepted Tradeoffs](#accepted-tradeoffs)
- [Anti-Drift Constraints](#anti-drift-constraints)
- [Rename Levels](#rename-levels)
- [Safe Revisit Conditions](#safe-revisit-conditions)
- [Related Systems](#related-systems)
- [Evidence](#evidence)

## Decision

SynAIpse is the product and system identity for the evidence-led agent
governance platform being developed in this repository.

Coding Harness remains the current implementation name, package identity, and
CLI control-plane layer until a separate migration decision proves the blast
radius and compatibility path for a deeper rename.

Near-term language:

- SynAIpse is the product/system identity.
- Coding Harness is the implementation package and harness CLI control-plane
  layer.
- The harness CLI remains the stable operator command surface.
- The @brainwav/coding-harness package identity remains unchanged until a
  package migration plan exists.

## Context

The repository started as coding-harness, a TypeScript control plane for
agentic development. Recent research and audit work shows the project has
grown beyond a generic coding harness into a broader system for runtime truth,
claim/evidence separation, review orchestration, context engineering, memory,
ratchets, and agent operating loops.

The SynAIpse name better describes the product direction, but renaming the
repo, package, CLI, templates, generated artifacts, CI references, and
downstream surfaces in one step would create a high-noise migration.

Current worktree evidence before this decision:

- The repo is on main.
- The restored research/audit lane is local work:
  - .harness/research/evidence-patterns.json
  - .harness/research/audits/2026-06-30-evidence-led-codebase-gap-audit.md
  - .harness/research/deep/2026-06-30-tessl-agent-evidence.md
- The package and CLI identity remain @brainwav/coding-harness and harness.

## Why This Decision Exists

The product needs a durable identity that can survive beyond one repository
mechanism. SynAIpse names the larger operating system: evidence-led agent
governance, runtime proof, review/control-plane orchestration, context
management, and compounding operational learning.

At the same time, the implementation surfaces are already trust-bearing. The
package name, CLI command, docs, skills, generated templates, CI checks, and
downstream references are part of the operator contract. Renaming them without
an impact sweep would increase drift risk.

This decision separates narrative identity from technical migration.

## Alternatives Considered

- Rename the repository, package, and CLI to SynAIpse immediately: rejected
  because no rename impact sweep, downstream dependency inventory, CI reference
  mapping, or rollback path has been gathered.
- Keep using only Coding Harness as the product name: rejected because it
  describes the mechanism, not the broader system identity now emerging.
- Add SynAIpse only as marketing copy with no decision record: rejected because
  identity drift should be governed like other durable operating choices.
- Add a synaipse CLI alias immediately: deferred because command aliases are
  technical behavior and require compatibility tests.

## Accepted Tradeoffs

- The repo will temporarily carry two names with different scopes.
- Product-facing docs may say SynAIpse while implementation files keep
  coding-harness and harness.
- Future migration work must distinguish brand language from technical package
  identity.
- Some search results will show both terms until a later migration decision
  narrows or renames implementation surfaces.

## Anti-Drift Constraints

- Do not rename the package, repository, binary, imports, templates, CI checks,
  skills, or generated artifacts as incidental cleanup.
- Do not use SynAIpse as evidence that a technical migration has occurred.
- Do not claim package, CLI, or downstream compatibility after a name change
  without exact command evidence.
- Keep product identity language separate from delivery truth, CI state, review
  state, tracker state, and merge state.
- If a document says SynAIpse, it should clarify whether it means product
  identity, implementation package, CLI command, or future migration target.

## Rename Levels

Level 0: Brand layer only.

Use SynAIpse in product, roadmap, portfolio, and narrative documents while all
technical surfaces remain coding-harness, @brainwav/coding-harness, and
harness.

Level 1: Product identity with stable technical package.

SynAIpse becomes the system identity. Coding Harness remains the implementation
package and CLI control-plane layer. This ADR accepts Level 1 as the current
position.

Level 2: CLI alias.

Add synaipse as an alias or wrapper for harness while preserving harness
compatibility. This requires command registry updates, CLI tests, docs updates,
package bin updates, generated template checks, and rollback notes.

Level 3: Repo and package rename.

Rename repo, package, imports, generated artifacts, templates, CI references,
docs, skills, downstream consumers, and public surfaces. Treat this as a
separate migration project with a migration plan, validation matrix, and
rollback path.

## Safe Revisit Conditions

Revisit this decision when at least one of these is true:

- A rename impact sweep has mapped every coding-harness,
  @brainwav/coding-harness, harness, brainwav, and SynAIpse reference across
  source, docs, templates, contracts, CI, skills, packages, and downstream
  consumers.
- A CLI alias plan proves harness compatibility while adding synaipse.
- A package migration plan defines package publication, downstream consumers,
  generated template behavior, CI references, and rollback.
- A product-site or public-proof lane requires stable SynAIpse terminology and
  identifies which technical names remain intentionally unchanged.

## Related Systems

- package.json
- src/cli.ts
- src/lib/cli/**
- contracts/**
- .agents/skills/coding-harness/**
- docs/**
- README.md
- AGENTS.md
- .circleci/config.yml
- .github/**
- .harness/research/audits/2026-06-30-evidence-led-codebase-gap-audit.md
- .harness/research/deep/2026-06-30-tessl-agent-evidence.md

## Evidence

Facts:

- git status --short --branch after stash pop showed the checkout on main with
  only the restored research/audit edits listed.
- git stash pop stash@{0} restored the Tessl research/audit files onto main and
  dropped the cleanup stash.
- package.json currently defines the package as @brainwav/coding-harness and
  the binary as harness.
- The 2026-06-30 evidence-led audit grades the codebase as a strong
  agent-native control plane while identifying rename-adjacent risks around
  command, CI, docs, and context drift.

Interpretation:

- SynAIpse is the better product identity for the broader system, but technical
  rename work should be gated by migration evidence.

Assumptions:

- Future public positioning benefits from the SynAIpse name before the
  implementation package is renamed.
- Existing downstream operators and generated artifacts should continue to use
  harness unless a compatibility migration proves otherwise.
