# Diagram Context

## Table of Contents

- [Purpose](#purpose)
- [Current State](#current-state)
- [Refresh Path](#refresh-path)

## Purpose

This file is the required architecture-context truth source for `coding-harness`.
It exists so docs-gate and context-integrity checks can rely on a stable,
tracked path even when richer generated diagram artifacts are refreshed
separately.

## Current State

- The canonical diagram context location is `AI/context/diagram-context.md`.
- Generated or refreshed diagram artifacts may live alongside this file.
- Governance checks should treat this file as the presence marker for diagram
  context, not as the only possible architecture artifact.

## Refresh Path

- Refresh architecture context through the repo-approved diagram workflow when
  deeper diagrams are needed.
- Keep this file present and tracked so required-mode docs-gate can validate the
  configured truth source.
