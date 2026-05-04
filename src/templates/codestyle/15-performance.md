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
- Performance work SHOULD measure first and optimize second.
- Performance claims MUST include before/after evidence for latency, throughput, or resource usage.
- Incremental performance changes SHOULD be preferred over broad rewrites.

## Runtime and context discipline
- The least costly runtime/tooling mode that safely satisfies task requirements SHOULD be used.
- Long-running sessions SHOULD avoid unnecessary context growth; scope expansion SHOULD trigger summarization and checkpointing.
- Heavy workflows MUST remain bounded, and parallelization MUST occur only when correctness and resource limits allow.

## Common hotspots
- Repeated expensive I/O in loops MUST be prevented.
- Unbounded queries/scans MUST NOT run without pagination, filtering, or limits.
- Repeated recomputation SHOULD be avoided when caching or memoization is appropriate.

## Enforcement
- If a change is marked as a performance improvement, include measurable evidence in PR/testing notes.
- If performance validation cannot run, mark it explicitly as blocked with the concrete blocker.
