# Architecture Language

Use these terms consistently when reviewing `coding-harness`.

## Terms

**Module**: Anything with an interface and an implementation, from a function to
a package-level slice. Avoid `component`, `service`, and `unit` unless those are
literal names in the code.

**Interface**: Everything a caller must know to use a module correctly:
parameters, types, invariants, ordering, error modes, configuration, side
effects, and performance expectations. Avoid using `API` when this broader
meaning is intended.

**Implementation**: The behavior hidden behind a module interface.

**Depth**: Leverage at the interface. A deep module gives callers a lot of
behavior through a small, coherent interface. A shallow module forces callers to
understand nearly as much complexity as the implementation contains.

**Seam**: The place where an interface lives and behavior can vary without
editing the caller. Prefer `seam` over `boundary` unless an ADR or domain model
uses boundary deliberately.

**Adapter**: A concrete implementation that satisfies an interface at a seam.
Use this term for the role a concrete thing plays, not for every implementation.

**Leverage**: The caller benefit from depth: more useful behavior per fact the
caller must learn.

**Locality**: The maintainer benefit from depth: change, failures, knowledge,
and verification concentrate in one place instead of spreading through callers.

## Principles

- Depth belongs to the interface, not to line count.
- The interface is the test surface.
- A module earns its keep when deleting it would spread complexity across
  callers.
- One adapter is usually a hypothetical seam; two adapters make the seam real.
- Internal seams can exist for implementation tests without becoming part of the
  external interface.
