# Core Harness Policy

## Table of Contents

- [Purpose](#purpose)
- [Authority](#authority)
- [Use](#use)

## Purpose

.harness/core contains portable policy and operating-system rules for agents.

## Authority

Files here are policy authority. They may constrain implementation directly when
referenced by .harness/active-artifacts.md, repo instructions, validators, or
command contracts.

## Use

Keep rules short, source-owned, and validator-backed where possible. Runtime
state, generated logs, and bulky evidence belong elsewhere.
