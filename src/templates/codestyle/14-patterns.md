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
- Implementations SHOULD prioritize KISS, DRY, and YAGNI in that order.
- Production paths SHOULD favor immutable updates over in-place mutation.
- Functions SHOULD remain focused and deeply nested logic SHOULD be split into named helpers.

## Structural patterns
- Code SHOULD be organized by feature/domain boundaries instead of technology buckets when practical.
- Files MUST remain cohesive; shared logic SHOULD be extracted before copy-paste drift appears.
- Repository/service abstractions SHOULD be used when multiple storage backends or test doubles are required.

## Boundary and response patterns
- All external input MUST be validated at boundaries before domain logic.
- Error structures and API envelopes MUST remain consistent within a service surface.
- Named constants MUST be used for thresholds, limits, and policy values; magic numbers MUST be avoided.

## Enforcement
- Pattern changes SHOULD be reviewed with targeted examples in PR notes.
- Any deliberate deviation from these defaults MUST include rationale and a tracker reference.
