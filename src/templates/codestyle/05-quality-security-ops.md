# Quality, Security, and Operations Standards

## Table of Contents
- [Scope](#scope)
- [Detailed modules](#detailed-modules)
- [15. Quality Gates: Coverage, Mutation, TDD](#15-quality-gates-coverage-mutation-tdd)
- [16. Fast Tools (MANDATORY for agents)](#16-fast-tools-mandatory-for-agents)
- [17. Security, Supply Chain & Compliance](#17-security-supply-chain--compliance)
- [18. Accessibility](#18-accessibility)
- [19. Observability, Logging & Streaming](#19-observability-logging--streaming)
- [20. Resource Management & Memory Discipline](#20-resource-management--memory-discipline)
- [21. Repository Scripts & Reports](#21-repository-scripts--reports)
- [22. MCP & External Tools](#22-mcp--external-tools)
- [23. Config References (Authoritative)](#23-config-references-authoritative)

## Scope
- This module is a cross-cutting quality/security/operations umbrella.
- Topic-specific policy details are defined in dedicated modules listed below.

## Detailed modules
- Git workflow: [13-git-workflow.md](./13-git-workflow.md)
- Patterns: [14-patterns.md](./14-patterns.md)
- Performance: [15-performance.md](./15-performance.md)
- Security: [16-security.md](./16-security.md)
- Testing: [17-testing.md](./17-testing.md)
- Code review: [18-code-review.md](./18-code-review.md)
- Development workflow: [19-development-workflow.md](./19-development-workflow.md)

## 15. Quality Gates: Coverage, Mutation, TDD

PR merge gate MUST pass the repository contract commands:

* `pnpm lint`
* `pnpm typecheck`
* `pnpm test`
* `pnpm audit`
* `pnpm check`
* `bash scripts/validate-codestyle.sh`
* `bash scripts/verify-work.sh --fast`

Coverage and mutation thresholds MAY be enforced only when wired to executable repository validators.

---

## 16. Fast Tools (MANDATORY for agents)

* Use `rg` not `grep` for project-wide search.
* Prefer `fd` for file finding.
* Use `jq` for JSON parsing/transformations.
* For TypeScript-family source, agents MUST run `harness source-outline <path>`
  before reading full file bodies; agents SHOULD unwrap implementation only for
  the needed symbol with `--symbol <name>`.
* Read limits: cap reads at ~250 lines; prefer targeted context flags.

---

## 17. Security, Supply Chain & Compliance

* Secrets MUST NOT be hard-coded; use environment injection or a secret manager.
* All external inputs MUST be validated and sanitized.
* Scanning per PR SHOULD include:

  * OSV / audits per ecosystem
  * Semgrep policy + OWASP
  * SBOM generation at release (CycloneDX)
  * provenance/signing (SLSA/in-toto + Sigstore) where applicable
* Containers (if used) SHOULD use minimal base images, MUST run non-root, SHOULD use read-only filesystems, and SHOULD drop unnecessary capabilities.

---

## 18. Accessibility

* Baseline MUST be WCAG 2.2 AA.
* Full keyboard operation MUST be supported.
* Screen reader compatibility MUST be supported.
* CLI/TUI implementations MUST provide `--plain` and `--no-color` modes.
---

## 19. Observability, Logging & Streaming

* OpenTelemetry SHOULD be used where services/CLIs exist.
* Logs SHOULD be structured and include `service` at app boundaries.
* Streaming:

  * default token delta streaming for CLIs,
  * optional aggregated mode,
  * JSON event streaming optional if supported.

---

## 20. Resource Management & Memory Discipline

* Respect repo-defined concurrency limits for pnpm/CI tasks.
* Measure before increasing parallelism; attach before/after results to PR when changing.

---

## 21. Repository Scripts & Reports

* If codemap/report tooling exists, outputs MUST include service identity and be attachable to PRs.

---

## 22. MCP & External Tools

* Adapters/helpers MUST not hard-code user-specific paths.
* Health checks MUST be scriptable.
* Egress/network policies MUST be explicit where required.

---

## 23. Config References (Authoritative)

* ESLint: `eslint.config.mjs` (flat config)
* Biome: `biome.json` (or repo equivalent)
* Vale: `.vale.ini`
* Mise: `.mise.toml`
* Rustfmt: `rustfmt.toml`
* CI: `.github/workflows/*.yml`
* Rules of AI: `brainwav/governance/00-core/RULES_OF_AI.md`

---
