---
schema_version: 1
status: active
applies_to: all harness-managed repositories
last_validated: 2026-04-18
---

# AI Assistant Security Policy

## Table of Contents

- [Purpose](#purpose)
- [Scope](#scope)
- [Risk Domains and Controls](#risk-domains-and-controls)
  - [1. Dependency Selection](#1-dependency-selection)
  - [2. Secret Handling](#2-secret-handling)
  - [3. Test Generation](#3-test-generation)
  - [4. Logging and Observability](#4-logging-and-observability)
  - [5. Workflow and CI Generation](#5-workflow-and-ci-generation)
  - [6. Provenance and Supply Chain](#6-provenance-and-supply-chain)
  - [7. Privilege and Authorization](#7-privilege-and-authorization)
- [Harness Gate Mapping](#harness-gate-mapping)
- [Review and Update Policy](#review-and-update-policy)
- [References](#references)

---

## Purpose

This document defines the minimum security controls that apply when AI coding
assistants (Codex, Claude Code, Gemini, or any agent runtime) generate, modify,
or review code in a harness-managed repository.

It is aligned with the [OpenSSF Security-Focused Guide for AI Code Assistant
Instructions (2025)](https://openssf.org/projects/ai-code-assistant-instructions/)
and is intended to complement, not replace, the general repository security
baseline in `docs/agents/06-security-and-governance.md`.

---

## Scope

This policy applies to:

- All AI-generated code, configuration, and workflow artifacts committed to this
  repository or scaffolded by `harness init` / `harness upgrade`.
- All agent sessions operating in this repository, regardless of the agent
  runtime used.
- All automated PR generation, remediation, and workflow execution triggered by
  harness commands.

It does **not** apply to purely local agent sessions that produce no committed
artifacts.

---

## Risk Domains and Controls

### 1. Dependency Selection

**Risk:** AI assistants can suggest non-existent, typosquatted, or
unmaintained packages (hallucinated dependencies, supply chain confusion
attacks).

**Controls:**

- Agents **must not** add a dependency without verifying it exists on the
  intended registry (`npm`, `PyPI`, `crates.io`, etc.) before suggesting it.
- All new dependencies require explicit human approval via PR review. Agents
  **must not** auto-merge dependency-adding PRs.
- Prefer packages with provenance attestation (npm provenance, SLSA Build L2
  or higher) when feasible options exist.
- Run `pnpm run audit` (or equivalent) after adding or upgrading any dependency.
  Findings at `high` or above block merge by default.
- Avoid adding packages that have no recent activity, no published maintainer,
  or no open-source license compatible with this repository's license.

**Harness enforcement:** `harness policy-gate` checks changed package manifests
against the contract's dependency policy surface. `harness license-gate`
validates license compatibility.

### 2. Secret Handling

**Risk:** AI assistants can inadvertently embed secrets, tokens, or credentials
in generated code, configuration files, or commit messages.

**Controls:**

- Agents **must never** hardcode credentials, API keys, tokens, certificate
  material, or private keys in any file committed to the repository.
- All secrets must be referenced via environment variables, a secrets manager
  (e.g., 1Password, Infisical), or a CI/CD secrets store. Never inline values.
- Generated shell scripts and CI workflow files **must** reference secrets via
  `${{ secrets.NAME }}` (GitHub Actions), environment variable injection, or
  equivalent mechanism for the active CI provider.
- Agents **must not** echo, log, or print secret values in any form, including
  masked prefixes.
- Before committing, the pre-commit hook runs `gitleaks` (or equivalent) on
  staged content. If a leak is detected, the commit is blocked.

**Harness enforcement:** `harness preflight-gate` can be configured to scan
for credential-shaped patterns via the `secretPatterns` field in
`harness.contract.json`. The pre-commit hook (scaffolded by `harness init`)
runs `bash scripts/check-staged-secrets.sh`.

### 3. Test Generation

**Risk:** AI-generated tests that mock external dependencies or use shallow
assertions give false confidence. Tests that do not cover failure paths create
dangerous coverage gaps.

**Controls:**

- Every generated function, handler, or transformation with observable side
  effects **must** have at least one test.
- Tests for auth flows, payment processing, data mutations, and external API
  calls **must** include at least one failure-path assertion (error thrown,
  fallback triggered, rollback executed).
- Unit tests may use mocks for isolation, but integration tests **must** use
  real objects through the real call chain for at least one test per changed
  boundary.
- Agents **must not** generate tests that assert only on mock call counts when
  the behavior under test involves real I/O or state changes.
- Coverage is not a sufficient quality signal on its own. Test scenario
  completeness (happy path, edge cases, error paths, integration) matters more
  than line percentage.

**Harness enforcement:** `harness docs-gate` checks that plan documents include
test scenarios for each implementation unit. `harness plan-gate` validates
traceability between implementation and acceptance criteria.

### 4. Logging and Observability

**Risk:** AI-generated logging statements can leak user data, credentials, or
system internals. Insufficient logging makes incident response harder.

**Controls:**

- Log messages **must not** include raw request bodies, full-stack traces
  containing user data, session tokens, or personally identifiable information
  (PII).
- Use structured logging (JSON) wherever the runtime supports it. Avoid
  free-form string concatenation for log lines that include variable data.
- Log sanitized summaries (counts, presence flags, error types) rather than raw
  input values when handling untrusted external input.
- Agents generating observability code (metrics, traces, logs) **must** scope
  cardinality to bounded label sets. Unbounded label cardinality is a
  reliability risk.

**Harness enforcement:** `harness observability-gate` checks metrics
cardinality limits. `harness silent-error` detects logging gaps in error
handling paths.

### 5. Workflow and CI Generation

**Risk:** AI-generated CI/CD workflows can introduce privilege escalation,
secret exposure via `pull_request_target`, cache poisoning, or action
injection vulnerabilities.

**Controls:**

- Generated GitHub Actions workflows **must not** use `pull_request_target`
  with checkout of the PR head ref unless the workflow is explicitly designed
  for trusted reviewer-triggered execution.
- Workflow files **must** pin all third-party actions to a full commit SHA
  (`uses: actions/checkout@<sha>`), not a mutable tag or branch name.
- Generated workflows **must not** pass secrets to steps that run untrusted
  user-supplied code.
- `GITHUB_TOKEN` permissions in generated workflows **must** be scoped to
  the minimum required (`permissions:` block with explicit grants, defaulting
  to `read-all`).
- Agents **must not** generate workflows that disable branch protection,
  modify repository settings, or self-approve PRs.
- `harness workflow:generate` validates generated workflow contracts against
  the Symphony schema before writing output.

**Harness enforcement:** `harness symphony-check` validates `WORKFLOW.md`
and transition-table readiness. `pnpm workflow:validate` runs the JSON
schema validation suite over all workflow contracts.

### 6. Provenance and Supply Chain

**Risk:** AI-generated build artifacts without provenance attestation cannot be
verified by downstream consumers. Unsigned releases introduce supply chain risk.

**Controls:**

- Published npm packages from this repository **must** use npm provenance
  (`--provenance` flag via the release workflow) so consumers can verify the
  build origin.
- Release workflows **must** use SLSA-compatible build environments (GitHub
  Actions with `id-token: write` for OIDC) to generate verifiable build
  attestations.
- Agents **must not** modify the release workflow to bypass provenance signing
  steps.
- All PRs that touch the release workflow or CI pipeline **must** receive an
  explicit human approval, regardless of the approval policy configured for
  other PR types.

**Harness enforcement:** The `release` and `ci-migrate` surfaces enforce
required-check parity and proof packs before cutover. See
`docs/agents/06-security-and-governance.md` for the full release governance
chain.

### 7. Privilege and Authorization

**Risk:** AI-generated code can accumulate excessive permissions (GitHub token
scopes, IAM roles, database grants) beyond what a task actually requires.

**Controls:**

- Agents **must** request the minimum scopes needed for a task. Never request
  `repo` scope when `contents:read` suffices. Never request `admin:org` for
  operations that only need `read:org`.
- Generated code that calls external APIs or services **must** document the
  required permissions in a comment adjacent to the call site.
- Service accounts and bot tokens used in automation **must** be scoped to the
  specific repository and operation, not organization-wide.
- Agents **must not** generate code that bypasses `check-authz` policy checks
  for mutative operations governed by this repository's contract.

**Harness enforcement:** `harness check-authz` validates authorization policy
for mutative operations. `harness review-gate` enforces merge-readiness checks
including required-scope validation.

---

## Harness Gate Mapping

| Risk domain | Primary gate | Secondary gate | Enforcement |
|---|---|---|---|
| Dependency selection | `policy-gate` | `license-gate` | Enforced (`risk-policy-gate` in requiredChecks) / CLI-only |
| Secret handling | `preflight-gate` | pre-commit hook | CLI-only / pre-commit hook |
| Test generation | `docs-gate` | `plan-gate` | Enforced (`docs-gate` in requiredChecks) / CLI-only |
| Logging / observability | `observability-gate` | `silent-error` | CLI-only |
| Workflow / CI generation | `workflow:generate` | `pnpm workflow:validate` | CLI-only |
| Provenance / supply chain | Release workflow | `ci-migrate` | Enforced (release workflow gates) |
| Privilege / authorization | `check-authz` | `review-gate` | CLI-only / Enforced (`CodeRabbit` in requiredChecks) |

Gates marked **enforced** are listed in `harness.contract.json` `branchProtection.requiredChecks` and block merge. Gates marked **CLI-only** are run manually or in CI pipelines but are not branch-protection blockers.

---

## Review and Update Policy

- This document is reviewed quarterly or when a new OpenSSF or NIST AI
  guidance update is published.
- Material changes (new risk domain, new gate mapping, change to a control)
  require a PR with the `docs-gate` passing in non-advisory mode.
- Owner: repository maintainer (see `harness.contract.json` for contact).

---

## References

- [OpenSSF Security-Focused Guide for AI Code Assistant Instructions (2025)](https://openssf.org/projects/ai-code-assistant-instructions/)
- [OWASP Top 10 for LLM Applications](https://owasp.org/www-project-top-10-for-large-language-model-applications/)
- [NIST AI RMF 1.0](https://nvlpubs.nist.gov/nistpubs/ai/nist.ai.100-1.pdf)
- [SLSA Supply Chain Framework](https://slsa.dev/)
- [OpenSSF OSPS Baseline](https://baseline.openssf.org/)
- [docs/agents/06-security-and-governance.md](./agents/06-security-and-governance.md)
- [harness.contract.json schema](../harness.contract.json)
