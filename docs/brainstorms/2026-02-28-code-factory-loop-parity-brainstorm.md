---
date: 2026-02-28
topic: code-factory-loop-parity
clients:
  - Codex App/CLI
  - Claude Code
---

# Code Factory Loop Parity Brainstorm

## Table of Contents
- [What We're Building](#what-were-building)
- [Why This Approach](#why-this-approach)
- [Key Decisions](#key-decisions)
- [Resolved Questions](#resolved-questions)
- [Open Questions](#open-questions)
- [Next Steps](#next-steps)

## What We're Building
Build a shared, contract-driven “code-factory loop” that is usable by both Codex App/CLI and Claude Code: **risk policy gate → review gate → evidence verification → remediation loop**. The v1 goal is not UI expansion; it is closing workflow and runtime behavior gaps so the system is deterministic and auditable across clients. In parallel, convert ui:fast, ui:verify, and ui:explore from command-prep stubs into true execution commands with clear outcomes and artifacts.

## Why This Approach
We selected **Approach A: Unified Loop Core + Adapter Facades** because parity across Codex and Claude is a hard requirement, and duplicated implementations would drift. A shared core keeps policy, sequencing, and safety logic consistent. Thin adapters allow client-specific UX and invocation differences without forking governance. This is the simplest design that meets v1 outcomes while minimizing long-term maintenance overhead (YAGNI applied: no speculative platform-specific rewrites).

## Key Decisions
- **Single canonical loop core**: one deterministic flow for risk→review→evidence→remediation across both clients.
- **Shared core + adapters**: client-specific behavior is isolated to adapter layers, not duplicated loop logic.
- **v1 completion requires both governance and runtime**: CI loop enforcement and executable runtime command behavior are both mandatory.
- **Remediation safety posture**: auto-apply only low-risk findings in v1; medium/high remain human-approved.
- **Automation scope for this milestone**: prioritize loop parity first; add Pulse/Upskill/Green PRs/Drift Check as follow-on automation tracks that reuse the same core signals.
- **Deterministic workflow contract**: generated PR pipeline must enforce the full ordered loop (risk → review → evidence → remediation) with merge blocked on failures.
- **Runtime execution truth**: ui:fast, ui:verify, ui:explore, and remediation apply mode must execute real checks/actions and return failure codes on unsuccessful runs.
- **v1 non-goal**: no expansion into product UI features (voice/dictation/diff-panel UX); this milestone is control-plane parity and execution reliability only.

## Resolved Questions
- **V1 priority**: End-to-end loop enforcement first.
- **Parity model**: Shared core plus thin Codex/Claude adapters.
- **Auto-apply scope**: Low-risk findings only.
- **Milestone success**: Requires both CI proof and runtime execution parity.

## Open Questions
- None at this stage.

## Next Steps
→ Run /prompts:workflow-plan to define implementation phases, file-level changes, tests, rollout gates, and sequencing for Codex App/CLI + Claude Code parity.
