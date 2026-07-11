# Ubiquitous Language Map

## Table of Contents

- [Purpose](#purpose)
- [Context Map](#context-map)
- [Routing Rule](#routing-rule)

## Purpose

This map is the fast entrypoint for the canonical glossary in
`UBIQUITOUS_LANGUAGE.md`. Use it to pick the right language context, then read
or update the canonical term table only when the work changes meaning.

## Context Map

| Context | Canonical Terms | Use When |
| --- | --- | --- |
| Product identity | SynAIpse, AI Delivery Harness, Coding Harness | Separating external product language from repository/package identity. |
| Policy precedence | Jamie Core, SynAIpse Baseline, Target Repository Authority | Deciding which policy owns a delivery decision without overwriting local truth. |
| Lifecycle | Shape, Admit, Build, Prove, Review, Integrate, Improve | Routing an idea through evidence-backed delivery and feedback. |
| Decision authority | Vital Decision, Ordinary Engineering Decision | Deciding whether Jamie must choose or Codex should continue from policy and evidence. |
| Delivery truth | Truth Lane, Claim Authority, Safety Floor, Outcome Closeout Schema | Describing what a piece of evidence can and cannot prove. |
| Agent operating model | Lifecycle Harness, Expected Outcome Contract, Portable Agent Operating System | Explaining the issue-to-main agent workflow and north-star outcome. |
| Command architecture | Command Facade, Command Core, Output Renderer, Deep Module Boundary | Reviewing CLI surface area, module placement, or architecture bloat. |
| Agent action | SynAIpse State, SynAIpse Transition, Invocation Effect, Recommended Command | Returning one next action with truthful effects, authority, evidence, and recovery. |
| Validation | Validation Lane, Validation Failure Classifier, Wrapper Command | Reporting exact check outcomes and blocker ownership. |
| Review and feedback | Steering Feedback, Pattern-Generalization Pass, Pattern Scope Inventory | Turning repeated comments or line-level corrections into durable guardrails. |
| Improvement | Improvement Case, Ablation Run, Distillation | Choosing, testing through canaries, measuring, and disposing of harness mechanisms. |
| Runtime evidence | Codex Runtime, Harness Control Plane, Workspace Root Evidence, Permission Context | Handling runtime-card, replay, trace, permission, and environment evidence. |
| Project memory | Project Brain Provider, Durable north-star guardrail, Active Artifact Index | Routing memory, learning, active-artifact, and route-driving surfaces. |
| Portfolio adoption | Project Adoption, Zero Customer Integration Ceremony, Portable Agent Operating System | Admitting the smallest useful SynAIpse surface to canonical repositories. |
| Universal context | Universal Context Plane, Context Catalog, Context Reference, Context Resolver, Task Context Snapshot | Selecting bounded private and repository context without copying it into product repos or CI. |
| Security and sign-off | SynAIpse Security Finding, SynAIpse Sign-off, Required Check Identity | Assigning one blocking owner and binding sign-off evidence to the current SHA. |

## Routing Rule

Use this file for orientation. Use `UBIQUITOUS_LANGUAGE.md` for authoritative
definitions, aliases to avoid, prompt translations, and decision-log changes.
