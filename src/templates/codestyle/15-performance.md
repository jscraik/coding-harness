# Performance Standards

## Table of Contents
- [Scope](#scope)
- [Performance workflow](#performance-workflow)
- [Runtime and context discipline](#runtime-and-context-discipline)
- [Common hotspots](#common-hotspots)
- [Enforcement](#enforcement)

## Scope
- This module defines performance expectations for implementation, review, and troubleshooting.

## Performance workflow
- Measure first, optimize second.
- Performance claims MUST include before/after evidence for latency, throughput, or resource usage.
- Prefer incremental performance changes over broad rewrites.

## Runtime and context discipline
- Use the least costly runtime/tooling mode that safely satisfies task requirements.
- Avoid unnecessary context growth in long-running sessions; summarize and checkpoint when scope expands.
- Keep heavy workflows bounded and parallelize only when correctness and resource limits allow.

## Common hotspots
- Prevent repeated expensive I/O in loops.
- Prevent unbounded queries/scans without pagination, filtering, or limits.
- Prevent repeated recomputation when caching or memoization is appropriate.

## Enforcement
- If a change is marked as a performance improvement, include measurable evidence in PR/testing notes.
- If performance validation cannot run, mark it explicitly as blocked with the concrete blocker.
