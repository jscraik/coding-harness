# Context And Linear Decisions


## Table of Contents

- [Decision Records](#decision-records)
- [When To Offer A Linear Issue](#when-to-offer-a-linear-issue)
- [What Qualifies](#what-qualifies)
- [Linear Issue Content](#linear-issue-content)
- [ADR Compatibility](#adr-compatibility)
- [CONTEXT.md Format](#contextmd-format)
- [Single vs Multi-Context Repos](#single-vs-multi-context-repos)


Use this reference only when architecture work needs durable project language or
decision records.

## Decision Records

Across Jamie's projects, new durable architecture decisions should be captured
in Linear, not as new ADR files.

Use existing files under `docs/adr/` as legacy/read-only decision context when
they are relevant, but do not create a new ADR unless Jamie explicitly asks for
one or a repo-specific instruction says ADRs are still authoritative.

The default project contract is Linear-first:

- Open or update a **Linear issue** for every reproducible repository bug,
  feature request, policy gap, workflow regression, automation task, release
  follow-up, or durable architectural follow-up.
- Reuse an existing Linear issue when the work matches an active or historical
  item.
- Prefer project-scoped work in the current repo's Linear project; for this
  local skill, that is the `coding-harness` project.
- Branches and PRs should preserve the Linear key where practical.

### When To Offer A Linear Issue

Offer to create or update a Linear issue when all three are true:

- The decision or rejected refactor would matter to future architecture reviews.
- The reason is not obvious from the code or north-star contract alone.
- Losing the context would cause repeated review/rework, repeated proposals, or
  manual coordination later.

If the reason is ephemeral, obvious, or easy to rediscover, skip the issue and
summarize it in the current handoff instead.

### What Qualifies

- Architectural shape with real downstream cost.
- Integration patterns between command families, gates, agents, CI, GitHub, or
  Linear.
- Technology choices that carry real lock-in.
- Ownership, seam, or scope decisions where explicit no-s matter.
- Deliberate deviations from the obvious path.
- Constraints not visible in the code.
- Rejected alternatives when the rejection is non-obvious and likely to recur.

### Linear Issue Content

When creating or updating the issue, include:

- **Decision or rejected refactor**: one concise sentence.
- **Context**: why this came up during architecture review.
- **North-star link**: PR lead time, review/rework cost, manual glue, evidence,
  SHA discipline, autonomy boundary, or rollback safety.
- **Files**: exact paths and line references when available.
- **Trade-off**: alternatives considered and why this path is preferred or
  rejected.
- **Follow-up**: the next concrete implementation, validation, or revisit step.

### ADR Compatibility

If an existing ADR conflicts with a proposed candidate:

- Treat the ADR as historical evidence, not automatic current authority.
- Check newer roadmap, plan, Linear, and north-star surfaces before deciding
  which source is authoritative.
- Surface the conflict explicitly in the candidate risk section.
- Prefer resolving the conflict through a Linear issue or current plan update,
  not by adding another ADR.
- If a repo has no Linear access in the current environment, write the proposed
  Linear issue content in the handoff and mark the tracker update as blocked
  instead of creating an ADR fallback.

## CONTEXT.md Format

Create or update `CONTEXT.md` lazily when a project-specific term becomes
load-bearing during a design discussion.

### Structure

```md
# {Context Name}

{One or two sentence description of what this context is and why it exists.}

## Language

**Order**:
A customer's request to purchase one or more items.
_Avoid_: Purchase, transaction

**Invoice**:
A request for payment sent to a customer after delivery.
_Avoid_: Bill, payment request

**Customer**:
A person or organization that places orders.
_Avoid_: Client, buyer, account

## Relationships

- An **Order** produces one or more **Invoices**
- An **Invoice** belongs to exactly one **Customer**

## Example dialogue

> **Dev:** "When a **Customer** places an **Order**, do we create the
> **Invoice** immediately?"
> **Domain expert:** "No, an **Invoice** is only generated once a
> **Fulfillment** is confirmed."

## Flagged ambiguities

- "account" was used to mean both **Customer** and **User**; resolved: these
  are distinct concepts.
```

### Rules

- Be opinionated. Pick the best term and list weaker aliases to avoid.
- Flag conflicts explicitly.
- Keep definitions tight: one sentence max, defining what the concept is.
- Show relationships with bold term names and cardinality where obvious.
- Include only terms specific to this project's context.
- Exclude general programming concepts unless they are project-domain terms.
- Group terms under subheadings when natural clusters emerge.
- Include example dialogue that clarifies related concepts.

## Single vs Multi-Context Repos

For a single-context repo, use one root `CONTEXT.md`.

For a multi-context repo, use a root `CONTEXT-MAP.md`:

```md
# Context Map

## Contexts

- [Ordering](./src/ordering/CONTEXT.md): receives and tracks customer orders
- [Billing](./src/billing/CONTEXT.md): generates invoices and processes payments
- [Fulfillment](./src/fulfillment/CONTEXT.md): manages warehouse picking and shipping

## Relationships

- **Ordering -> Fulfillment**: Ordering emits `OrderPlaced` events; Fulfillment consumes them to start picking
- **Fulfillment -> Billing**: Fulfillment emits `ShipmentDispatched` events; Billing consumes them to generate invoices
- **Ordering <-> Billing**: Shared types for `CustomerId` and `Money`
```

Infer structure as follows:

- If `CONTEXT-MAP.md` exists, read it to find contexts.
- If only a root `CONTEXT.md` exists, treat the repo as single-context.
- If neither exists, create a root `CONTEXT.md` lazily when the first term is
  resolved.
- If multiple contexts exist and the current topic is unclear, ask before
  editing context files.
