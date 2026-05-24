# Coding Harness — Product Definition and Minimum Viable Adoption Path

## Decision summary

Coding Harness should be presented first as:

> A repo control plane for AI-assisted coding that helps small teams and disciplined solo developers set up governed workflows, validate risky changes, and ship with stronger trust signals.

It should *not* be presented first as an enterprise governance platform, a semantic search system, or a multi-repo compliance product.

---

## JSC-118 — Default user model

### Primary persona
**Platform-minded solo developer or small engineering team lead (1–8 engineers)**  
A GitHub-first developer who uses AI coding tools regularly, wants stronger repo guardrails, and is willing to adopt a small amount of structure in exchange for safer and more repeatable changes.

### Secondary persona
**DevEx / platform engineer in a small-to-mid-sized team (5–30 engineers)**  
Someone standardizing AI-assisted coding across a few repos who wants stronger consistency, policy, and release trust without immediately adopting enterprise-scale control surfaces.

### Non-target by default
The default product should *not* read as designed primarily for:
- large enterprises needing multi-repo governance from day one
- teams with heavy formal compliance programs as the first user story
- teams that do not want any repo-local config or workflow conventions
- developers who only want “one-shot code generation”

### Default team profile
The default docs and UX should assume:
- 1–8 engineers
- GitHub-first workflow
- one or a few repositories
- at least basic CI already exists
- willingness to use repo-local config
- desire for safer AI-assisted coding, not full compliance theater

### Product posture by capability level

#### Default
- `init`
- `contract validate`
- `health`
- `preflight-gate`
- `policy-gate`
- `docs-gate`
- `plan-gate`
- `review-gate`
- basic Linear workflow support

#### Advanced
- workflow-contract subsystem
- `ci-migrate`
- `pilot-evaluate`
- trust artifacts
- provenance / attestations
- stricter branch protection and rollout controls

#### Enterprise-oriented / later
- multi-repo governance
- org audit
- broad rollout programs
- high-ceremony control-plane operations across many teams

### Positioning language to use
Use this short definition at the top of README and docs:

> Coding Harness is a repo control plane for AI-assisted coding. It helps solo developers and small teams bootstrap governed repo workflows, validate risky changes, and ship with stronger trust signals.

### Positioning language to avoid
Avoid leading with:
- “enterprise”
- “compliance”
- “control plane for all software delivery”
- “multi-agent orchestration platform”

Those can exist later in advanced docs.

---

## JSC-119 — Minimum viable adoption path

### Goal
A new user should get meaningful value in **10–15 minutes** without learning the whole system.

### First success moment
The first believable win is:

> “I installed Coding Harness, initialized the repo safely, validated the contract, and confirmed repo health.”

That is the onboarding target.

### Minimum viable adoption path

#### Step 1 — Install
```bash
npm install -g @brainwav/coding-harness
harness --help
```

#### Step 2 — Preview repo bootstrap
```bash
harness init --dry-run
```

#### Step 3 — Apply tracked bootstrap
```bash
harness init --track
```

#### Step 4 — Validate repo contract
```bash
harness contract validate
```

#### Step 5 — Check overall repo health
```bash
harness health
```

### Success criteria for minimum adoption
After those steps, the user should be able to say:
- the repo is harness-managed
- the contract is valid
- the repo health surface is understandable
- I know what to do next

---

## The 3 hero workflows

These are the flows that should be most visible in docs, help output, and examples.

### Hero workflow 1 — Check repo health
**User question:** “Is my repo healthy and correctly governed?”

#### Current commands
```bash
harness contract validate
harness health
```

#### Outcome
- validate contract integrity
- expose major missing prerequisites
- show whether the repo is in a sane governed state

#### Future UX target
```bash
harness repo check
```

---

### Hero workflow 2 — Start work on an issue
**User question:** “I’m starting work—what’s the governed path?”

#### Current commands
```bash
harness linear prepare --issue JSC-123
harness preflight-gate --contract harness.contract.json --files src/cli.ts,README.md
harness policy-gate --contract harness.contract.json --files src/cli.ts,README.md
```

#### Outcome
- branch / issue context prepared
- fast preflight checks run
- policy expectations surfaced before expensive work

#### Future UX target
```bash
harness work start --issue JSC-123
```

---

### Hero workflow 3 — Submit for review
**User question:** “Am I ready for review or merge?”

#### Current commands
```bash
harness docs-gate --mode advisory --json
harness plan-gate --require-plan-id --require-traceability --json
harness review-gate --token "$GITHUB_TOKEN" --owner <owner> --repo <repo> --pr <number> --sha <head-sha>
```

#### Outcome
- docs parity checked
- traceability requirements checked
- merge/readiness state checked against review signals

#### Future UX target
```bash
harness work submit
```

---

## What the docs should do now

### Quickstart should lead with only three things
1. install
2. initialize safely
3. validate health

### Core docs should then introduce
1. repo health
2. start work
3. submit for review

### Advanced docs should only later introduce
- workflow contracts
- CI migration
- pilot evaluation
- provenance and release trust
- org-level surfaces

---

## What the CLI/help should do now

Until taxonomy redesign lands, the help output should still **promote the 3 hero workflows first**, even if the underlying commands are not yet reorganized.

Recommended “start here” section in help/docs:

- Check repo health
- Start work on an issue
- Submit for review

Then list current commands beneath each.

---

## Recommended follow-on implementation issues

This combined decision should feed directly into:
- JSC-120 — CLI taxonomy redesign
- JSC-121 — naming simplification
- JSC-122 — docs/instruction consolidation
- JSC-123 — config ergonomics
- JSC-124 — lite mode

---

## Acceptance checklist for JSC-118 + JSC-119

- the default user is explicit
- the default team profile is explicit
- the non-target user is explicit
- a new user can get first value in 10–15 minutes
- the docs prioritize 3 hero workflows
- advanced features are moved later in the learning path
