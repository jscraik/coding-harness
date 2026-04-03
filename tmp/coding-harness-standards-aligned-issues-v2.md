# Coding Harness — standards-aligned issue upgrades (Mar 31, 2026)

This backlog tightens the existing Coding Harness issues against current official references and industry consensus guidance available as of 2026-03-31:

- NIST SP 800-218 (SSDF) v1.1, plus the Dec 2025 initial public draft of SP 800-218 Rev. 1 / SSDF v1.2
- NIST SP 800-218A (SSDF profile for generative AI / dual-use foundation models)
- NIST AI RMF 1.0 and the Generative AI Profile (NIST AI 600-1)
- SLSA v1.2 (approved)
- OpenSSF OSPS Baseline v2026.02.19
- OpenSSF Scorecard
- OpenSSF Security-Focused Guide for AI Code Assistant Instructions (2025)
- CISA Secure by Design and Safe Software Deployment guidance
- GitHub Actions security hardening and artifact attestations
- npm trusted publishing and npm provenance
- SPDX 3.0 and CycloneDX 1.6

---

## Upgrade JSC-103
### Title
Define the Coding Harness core command spine and publish a standards-aligned product contract

### Why
Coding Harness is strong but too easy to misread as several tools at once. The repo needs a single authoritative product contract that explains what the harness is, what is core, what is adjacent, and which external controls it helps satisfy.

### Deliverables
- Add a short “product contract” near the top of `README.md`
- Add a “Core / Integration / Adjacent” command-family map
- Add a standards map that links command families to:
  - NIST SSDF / SP 800-218
  - NIST SP 800-218A
  - NIST AI RMF / GAI Profile
  - OpenSSF OSPS Baseline
  - CISA Secure by Design
  - SLSA
- Add maturity levels: `stable`, `beta`, `experimental`
- Ensure CLI help text and docs use the same taxonomy

### Acceptance criteria
- A new maintainer can explain Coding Harness in under 2 minutes
- The README and CLI help expose one consistent architecture story
- Major command families each map to at least one explicit external control family
- “Core” commands are visibly separate from adjacent utilities

---

## Upgrade JSC-104
### Title
Refactor `ci-migrate` into a secure release and deployment control subsystem

### Why
`ci-migrate` is large enough that it should become an explicit subsystem. It also sits at the intersection of release safety, provenance, rollback, deployment trust, and branch-protection policy.

### Deliverables
Split `ci-migrate` into modules for:
- snapshot capture and restore
- parity verification
- proof-pack generation
- branch-protection and merge-queue integration
- break-glass policy and approvals
- apply / promote / commit orchestration
- deployment evidence capture

Add design notes that explain how the subsystem supports:
- CISA Safe Software Deployment
- GitHub Actions hardening
- SLSA provenance expectations
- rollback and release evidence

### Acceptance criteria
- Top-level `ci-migrate` command file becomes an orchestration shell
- Submodules map to clear release/deployment responsibilities
- Rollback, parity, and proof-pack flows are independently testable
- The subsystem has a documented control story, not just command behavior

---

## Upgrade JSC-105
### Title
Slim `src/cli.ts` to a policy-neutral shell with dispatch and error normalization only

### Why
The CLI shell should not be an architecture hotspot. It should load commands, normalize output, and fail consistently.

### Deliverables
Keep `src/cli.ts` responsible only for:
- argv parsing
- dispatch
- top-level error normalization
- help/version output
- output mode selection (`text` / `json`)

### Acceptance criteria
- Command behavior lives in command modules or shared libraries
- New commands can be added without increasing CLI complexity materially
- Exit codes and JSON output are normalized consistently across command families

---

## Upgrade JSC-106
### Title
Split `init` scaffold generation by managed surface and generated evidence

### Why
`init` is the repo substrate compiler. Its output surfaces should be independently understandable and testable.

### Deliverables
Split scaffold logic by generated surface:
- contract artifacts
- workflow artifacts
- CI / automation artifacts
- scripts and local wrappers
- docs and examples
- migration and update helpers

Also add golden-output fixtures for each generated surface.

### Acceptance criteria
- `init` stays as orchestration, not generation monolith
- Generated surfaces can be tested independently
- Dry-run, track, update, migrate, and rollback remain stable
- Example outputs become reusable documentation inputs

---

## Upgrade JSC-107
### Title
Publish verifiable trust artifacts and reference examples for the harness

### Why
The repo makes strong claims around governance, evidence, parity, and rollback. Those claims should be inspectable without running the whole system.

### Deliverables
Publish examples for:
- `harness.contract.json`
- generated `WORKFLOW.md`
- gate-result JSON
- run-record / evidence artifact
- pilot decision packet
- CI migration proof-pack
- SBOM in SPDX 3.x or CycloneDX 1.7
- build provenance attestation
- npm provenance example for package releases

### Acceptance criteria
- A reader can inspect the trust outputs directly from the repo
- Examples are linked from README
- The examples are current enough to serve as real references

---

## Upgrade JSC-108
### Title
Harden the workflow-contract subsystem around explicit trust, safety, and AI-governance boundaries

### Why
This subsystem is a real architectural core. It should align with NIST’s AI secure development and AI risk-management guidance, not just internal workflow parsing.

### Deliverables
Clarify and separate:
- parser
- normalization
- semantic validation
- artifact registry
- scorecard generation
- policy/gate binding

Add a control map from workflow constructs to:
- NIST SP 800-218A
- NIST AI RMF 1.0
- NIST AI 600-1 GAI Profile

### Acceptance criteria
- The workflow-contract model is a public subsystem, not hidden implementation detail
- Safety- and trust-related checks are explicit and documented
- Adding a workflow rule does not require coupling to unrelated command paths

---

## Upgrade JSC-109
### Title
Clarify `pilot-evaluate` as a measurable AI-governance decision engine

### Why
This command answers a high-stakes question: whether autonomy can be expanded. It should read as a measure/manage control loop, not just a report generator.

### Deliverables
Separate and document:
- input collection
- threshold evaluation
- lane-specific policies
- decision packet generation
- reporting/output formatting

Align the subsystem language with:
- NIST AI RMF “measure” and “manage”
- CISA Secure by Design emphasis on evidence and operational safety

### Acceptance criteria
- The evaluation path is traceable end to end
- Thresholds and decisions are machine-auditable
- Decision packets are readable by someone who did not author the code

---

## Upgrade JSC-110
### Title
Sequence the architecture backlog as a standards-first hardening program

### Why
The issues now span product clarity, architecture, AI governance, supply chain security, and trust surfaces. They need an execution order that minimizes rework.

### Deliverables
Document this sequence:
1. JSC-103 core product contract
2. JSC-105 CLI shell
3. JSC-106 init split
4. JSC-104 ci-migrate split
5. JSC-108 workflow-contract hardening
6. JSC-109 pilot-evaluate clarification
7. JSC-111 release provenance and attestations
8. JSC-112 OSPS / Scorecard baseline
9. JSC-113 AI assistant security policy
10. JSC-107 trust artifacts examples

### Acceptance criteria
- The order is explicit in project planning
- Each later issue depends on earlier clarified architecture
- Docs and examples are written after the underlying architecture stabilizes

---

## New JSC-111
### Title
Implement release provenance, signed attestations, and trusted publishing for Coding Harness

### Why
A gold-standard harness should ship with verifiable provenance and modern release integrity controls.

### Deliverables
- Use GitHub artifact attestations for release outputs
- Adopt GitHub Actions OIDC where possible instead of long-lived secrets
- Adopt npm trusted publishing
- Publish npm packages with provenance
- Add verification steps to release docs and CI
- Store example verification commands for consumers

### Acceptance criteria
- Release artifacts have verifiable provenance
- npm releases are performed through trusted publishing, not long-lived write tokens
- Consumers can verify release provenance from docs alone
- Release workflows follow least-privilege token permissions

---

## New JSC-112
### Title
Adopt OpenSSF OSPS Baseline 2026.02.19 and Scorecard as the measurable minimum security posture

### Why
The project needs a public, current, cross-industry baseline rather than an implied security posture.

### Deliverables
- Select target OSPS Baseline level for the repo
- Create a control matrix mapping repo settings and docs to OSPS controls
- Run OpenSSF Scorecard regularly
- Fail or warn on regressions in key Scorecard checks
- Add badge / status references once criteria are met

### Acceptance criteria
- The repo declares a target OSPS level and current status
- Scorecard runs continuously
- Gaps are visible and tracked instead of informal

---

## New JSC-113
### Title
Establish a secure AI assistant and agent instruction policy for the repo

### Why
Because Coding Harness governs AI-assisted coding, it should itself model good AI-instruction hygiene.

### Deliverables
- Add a repo-level AI assistant instruction file / policy
- Align it with the OpenSSF Security-Focused Guide for AI Code Assistant Instructions
- Include dependency-selection, secret-handling, test-generation, logging, provenance, and workflow-generation rules
- Align harness-generated agent instructions / skills with the same policy

### Acceptance criteria
- The repo contains one authoritative security-focused instruction policy for AI assistants
- Harness-managed prompts / skills do not drift from the policy
- The policy explicitly addresses hallucinated dependencies, secrets, secure defaults, and security testing

---

## New JSC-114
### Title
Create a SLSA v1.2 roadmap for source integrity and build integrity

### Why
SLSA v1.2 now covers both build and source tracks. Coding Harness should publish a realistic target state and gap analysis.

### Deliverables
- Document current and target SLSA levels for:
  - Source track
  - Build track
- Map branch protection, review rules, provenance, and build isolation to those levels
- Identify which controls are repo responsibilities vs platform responsibilities
- Publish a “current / next / later” roadmap

### Acceptance criteria
- Consumers can understand the project’s current SLSA posture
- Source and build integrity controls are not conflated
- Two-party review, provenance, and build isolation are tracked explicitly

---

## New JSC-115
### Title
Harden GitHub Actions and repository policy to a least-privilege default

### Why
A coding harness should model safe automation. GitHub’s official guidance stresses least privilege, pinned actions, code review on workflow changes, OIDC, and caution with third-party workflows/runners.

### Deliverables
- Pin third-party actions to immutable SHAs
- Set explicit minimal `permissions:` in workflows
- Protect workflow files with CODEOWNERS / review policy
- Review self-hosted runner usage and document trust boundaries
- Add checks for risky workflow patterns

### Acceptance criteria
- All third-party actions are pinned or justified
- Workflow token permissions are explicit and minimal
- Changes to workflows receive stronger review than ordinary code
- Runner trust model is documented

---

## New JSC-116
### Title
Publish a Secure by Design and safe-deployment posture for Coding Harness

### Why
CISA’s current guidance emphasizes measurable progress, transparency, safer defaults, patching posture, and deployment playbooks.

### Deliverables
- Publish a concise Secure by Design posture statement
- Publish a safe deployment / rollback playbook
- Define logging / evidence expectations for deployment and rollback events
- Define how Coding Harness reduces classes of workflow or policy failure at scale

### Acceptance criteria
- Security posture is publicly stated in outcome terms, not just implementation terms
- Deployment and rollback are guided by documented playbooks
- Logs/evidence for release and rollback are part of the standard process

---

## Suggested labels
- `architecture`
- `standards`
- `supply-chain`
- `ai-governance`
- `release`
- `trust-artifacts`
- `docs`
- `security`

## Suggested milestone
**Gold-standard foundation (2026 H1)**

Use it for:
- JSC-103
- JSC-104
- JSC-105
- JSC-106
- JSC-108
- JSC-109
- JSC-111
- JSC-112
- JSC-113
- JSC-114
- JSC-115
- JSC-116
- JSC-107
