# Deepening Guide

Use this guide when turning shallow module findings into refactor candidates.

## Dependency Categories

### In-process

Pure computation or in-memory state with no I/O. These modules are usually safe
to deepen directly. Test through the new interface.

### Local-substitutable

Dependencies with reliable local stand-ins, such as a temp filesystem,
in-memory store, or local process. Keep the external interface focused on
behavior; use the stand-in inside tests.

### Remote-owned

Networked dependencies owned by this system or organization. Define a port at
the seam only when there is a real production adapter and a real test adapter.
The deep module should own the behavior; transport should sit in an adapter.

### True external

Third-party systems that the repo cannot control. Inject an interface at the
seam and use a mock or fake adapter in tests.

## Testing Strategy

- Replace fragile tests around shallow helpers with tests at the deepened
  module interface.
- Assert observable behavior through the interface, not implementation details.
- Delete old tests when they only preserve a shallow implementation shape.
- Preserve exact behavior checks for changed production paths before claiming
  verification.

## Harness-Specific Pressure Test

Before recommending a deepening move, ask:

- Does this reduce PR lead time or review/rework retries?
- Does this remove repeated manual glue work?
- Does this make acceptable agent output easier to produce?
- Does this preserve deterministic evidence, SHA discipline, and rollback?
- Would this candidate still matter if governance surface area were not valued?
