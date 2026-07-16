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
- [24. CI and Stateful Artifact Safety](#24-ci-and-stateful-artifact-safety)

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
* `pnpm run audit`
* `pnpm check`
* `bash scripts/validate-codestyle.sh`
* `bash scripts/verify-work.sh --fast`

Coverage and mutation thresholds MAY be enforced only when wired to executable repository validators.
`pnpm run quality:debt` is the executable legacy-debt ratchet. It prevents new
size, complexity, TypeScript escape-hatch, production-marker, and duplicate-block
debt from entering the tree while allowing existing debt to burn down through a
source-controlled baseline.

### Engineering judgement checklist

Use this checklist when reviewing AI-generated or agent-assisted changes. Each
item should map to a repo command, schema, artifact, test, or explicit blocker;
do not satisfy it with generic prose alone.

* Structure: avoid distributed monoliths, god services, big balls of mud,
  circular dependencies, tight coupling, leaky abstractions, shotgun surgery,
  and copy-paste programming. Prefer clear ownership, dependency direction, and
  small modules. Use `pnpm run quality:debt` to detect new duplicate-block,
  size, and complexity debt.
* Behavior and APIs: preserve versioned contracts, idempotency, pagination,
  rate-limit behavior, consistent error envelopes, and boundary validation.
  Do not return success-shaped responses for errors.
* Failure: design for timeouts, retries, queues, backpressure, partial failure,
  graceful degradation, and recovery paths. Do not assume networks, disks,
  external APIs, or model calls always succeed.
* Security: enforce least privilege, input validation, secret boundaries, audit
  logging, and injection protections. Do not trust client-side validation or
  model output as authority.
* Testing and evals: select the smallest exact behavior proof first, then widen
  through related tests, artifact contracts, deterministic evals, and calibrated
  judges only where those are repo-defined.
* Observability: include actionable logs, metrics, traces, health checks, and
  service identity where the product or CLI can fail in operation.
* CI/CD and release: keep pipelines reproducible, fast enough for feedback,
  rollback-aware, and separate from review, tracker, and merge-readiness claims.
* Accessibility: for UI work, preserve keyboard flow, semantic structure,
  labels, contrast, and focus states before claiming user-facing readiness.
* AI engineering: avoid prompt spaghetti, context-window dumping, blind trust in
  model output, tool explosion, unbounded agent loops, missing grounding, and
  missing human approval for authority-bearing actions.

`harness fitness --json` exposes these review families as coverage metadata
alongside deterministic lane evidence. Treat that metadata as routing context;
a lane is proof only when its source command or artifact has current evidence.

### Legacy debt ratchet

The legacy-debt baseline is [contracts/code-quality-debt-baseline.json](../contracts/code-quality-debt-baseline.json).
It is allowed to contain existing debt, but it is not a permission slip for new
debt.

* New debt MUST fail `pnpm run quality:debt`.
* Resolved debt SHOULD be removed from the baseline in the same PR that burns it
  down.
* Baseline refreshes MUST be deliberate and reviewable; do not refresh the
  baseline just to hide a regression.
* The debt report is local static evidence only. It does not prove behavior,
  CI, review-thread state, tracker state, or merge readiness.

---

## 16. Fast Tools (MANDATORY for agents)

* Use `rg` not `grep` for project-wide search.
* Prefer `fd` for file finding.
* Use `jq` for JSON parsing/transformations.
* Shell scripts that inspect JSON MUST use `jq` or a typed language helper;
  regex, `sed`, `awk`, or string slicing MUST NOT parse JSON.
* When `jq` is used in shell, pass shell values with `--arg` or
  `--argjson` and use `-e` when the filter result is the command success
  condition.
* Prefer repo-owned wrappers for toolchain setup. If several scripts need the
  same `uv`, Node, Semgrep, or package-manager environment, centralize that
  setup in the approved helper (for example `scripts/run-uv-python.sh`) and
  route package scripts through it.

* For TypeScript-family source, agents MUST run
  `bash scripts/harness-cli.sh source-outline <path> --json` before reading full
  file bodies; agents SHOULD unwrap implementation only for the needed symbol
  with `--symbol <name>`. Downstream repositories that consume the packaged CLI
  directly MAY use `harness source-outline <path> --json` instead.

* Read limits: cap reads at ~250 lines; prefer targeted context flags.

---

## 17. Security, Supply Chain & Compliance

* No hard-coded secrets; use env injection/secret manager.
* Validate/sanitize all external inputs.
* Scanning per PR SHOULD include:

  * OSV / audits per ecosystem
  * Semgrep policy + OWASP
  * SBOM generation at release (CycloneDX)
  * provenance/signing (SLSA/in-toto + Sigstore) where applicable
* Containers (if used): minimal base, non-root, read-only FS, drop caps.

---

## 18. Accessibility

* Baseline: WCAG 2.2 AA.
* Full keyboard operation required.
* Screen reader compatibility required.
* CLI/TUI: `--plain` / `--no-color` modes required.

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

* Biome: `biome.json`
* Vale: `.vale.ini`
* Markdownlint: `.markdownlint-cli2.yaml`
* Mise: `.mise.toml`
* TypeScript: `tsconfig.json`
* Vitest: `vitest.config.ts` and `e2e/vitest.e2e.config.ts`
* CircleCI: `.circleci/config.yml`
* GitHub Actions release workflows: `.github/workflows/*.yml`
* Semgrep/security policy: `semgrep*.yml` and repository security scripts where present
* ESLint/Rustfmt: downstream-only unless the repository includes `eslint.config.*` or `rustfmt.toml`

---

## 24. CI and Stateful Artifact Safety

* CI configuration changes MUST be explicit in the branch/PR scope; do not smuggle workflow, pipeline, or required-check changes into unrelated work.
* Do not add `[skip ci]`, disable failing tests, or weaken checks to unblock a merge. Fix the code, fix the test, or record a concrete blocker.
* External tools required by tests or validation SHOULD be installed through the repo toolchain contract. "Hard to install" is not a skip reason.
* After pushing work where CI truth is part of closeout, inspect the current run/check state before claiming CI, merge readiness, or release readiness.
* Stateful artifacts MUST have an owner, schema or documented shape, `schema_version` or equivalent version field, and reader/writer contract.
* Stateful artifacts are last-seen evidence, not authority. Verify against the live source before acting on recalled state.
* Shape changes to stateful artifacts MUST define migration behavior. Non-owner readers must tolerate missing or newer records without escalating work.
