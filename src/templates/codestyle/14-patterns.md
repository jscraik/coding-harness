# Common Patterns Standards

## Table of Contents
- [Scope](#scope)
- [Core design principles](#core-design-principles)
- [Structural patterns](#structural-patterns)
- [Boundary and response patterns](#boundary-and-response-patterns)
- [Enforcement](#enforcement)

## Scope
- This module defines reusable implementation patterns that improve maintainability and consistency.

## Core design principles
- Prefer KISS, DRY, and YAGNI in that order.
- Favor immutable updates over in-place mutation in production paths.
- Keep functions focused and split deeply nested logic into named helpers.

## Structural patterns
- Organize by feature/domain boundaries instead of technology buckets when practical.
- Keep files cohesive; extract shared logic before copy-paste drift appears.
- Use repository/service abstractions when multiple storage backends or test doubles are required.

## Boundary and response patterns
- Validate all external input at boundaries before domain logic.
- Keep error structures and API envelopes consistent within a service surface.
- Use named constants for thresholds, limits, and policy values; avoid magic numbers.

## Enforcement
- Pattern changes SHOULD be reviewed with targeted examples in PR notes.
- Any deliberate deviation from these defaults MUST include rationale and a tracker reference.
