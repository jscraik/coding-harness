# Brownfield Memory Inventory

Use this inventory before adopting, replacing, or ignoring existing memory, artifact, goal, review, or decision surfaces.
Brownfield setup must classify existing surfaces before replacement.

## Classification

| Surface | Class | Adopted path | Conflict | Decision |
| --- | --- | --- | --- | --- |
| `.harness/memory/LEARNINGS.md` | canonical | `.harness/memory/LEARNINGS.md` | none observed | Preserve as repo-scoped learned-fixes surface. |
| `.harness/knowledge/**` | canonical | `.harness/knowledge/**` | none observed | Preserve as Project Brain knowledge surface. |
| `.harness/decisions/**` | canonical | `.harness/decisions/**` | none observed | Preserve for accepted decisions and ADR-style records. |
| `.harness/review-log.md` | canonical | `.harness/review-log.md` | none observed | Preserve for periodic review evidence. |
| `docs/goals/**` | canonical | `docs/goals/**` | active baseline goal present | Preserve as goal-board convention and current lane state. |

Classes: canonical, mirror, legacy, optional, blocked.

## Rules

- Resolve canonical or blocked conflicts before replacing content.
- Preserve useful legacy or mirror evidence with an explicit mapping or deferred reason.
- Add a sync receipt for adopted, mapped, deferred, or blocked surfaces.
