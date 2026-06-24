---
schema_version: synaipse-work-result/v1
lifecycle_schema: harness-document-lifecycle/v1
artifact_id: installed-package-downstream-portability-gate-work-result
artifact_type: implementation-note
authority: execution-input
source_type: implementation-note
lifecycle_status: execution-input
canonical_destination: evals/scenarios/north-star-agent-delivery/registry.json
owner: coding-harness-maintainers
created: 2026-06-23
last_reviewed: 2026-06-23
review_cadence: on-change
stage: work
status: pass
linear_issue: JSC-403
depends_on:
  - .harness/specs/2026-06-23-installed-package-downstream-portability-gate-spec.md
  - .harness/plans/2026-06-23-installed-package-downstream-portability-gate-execution-plan.yaml
  - scripts/run-harness-evals.mjs
validated_by:
  - bash scripts/validate-codestyle.sh --fast
  - node --import tsx scripts/run-harness-evals.mjs --scenario package-installed-downstream-canary
---

# Installed Package Downstream Portability Gate Work Result

## Scope

Implemented the JSC-403 work slice for an installed-package downstream portability gate. The slice adds a focused eval scenario and runner support for packing Coding Harness, installing it into a downstream repo outside the source workspace, and running public `harness ... --json` commands from that downstream cwd.

## Evidence

- Plan: `.harness/plans/2026-06-23-installed-package-downstream-portability-gate-execution-plan.yaml`
- Spec: `.harness/specs/2026-06-23-installed-package-downstream-portability-gate-spec.md`
- Eval scenario: `evals/scenarios/north-star-agent-delivery/registry.json#package-installed-downstream-canary`
- Runner: `scripts/run-harness-evals.mjs --scenario package-installed-downstream-canary`
- Local canary aggregate: `artifacts/evals/jsc403-result.json`
- Local canary artifact: `artifacts/evals/live-fixtures-jsc403-proof/package-installed-downstream-canary/result.json`

## Validation

- `node --check scripts/run-harness-evals.mjs`: pass
- `node --check scripts/write-agent-native-ratchet-report.cjs`: pass
- `pnpm exec vitest run src/dev/write-agent-native-ratchet-report-script.test.ts src/dev/run-harness-evals-script.test.ts src/dev/package-files-quality-scripts.test.ts`: pass
- `node scripts/validate-runtime-packet-schemas.cjs --all`: pass
- `pnpm artifact:types`: pass
- `git diff --check`: pass
- `pnpm run coding-policy:route -- .gitignore contracts/examples/agent-native-ratchets.example.json contracts/examples/session-distill.example.json evals/scenarios/north-star-agent-delivery/registry.json scripts/run-harness-evals.mjs scripts/write-agent-native-ratchet-report.cjs src/dev/run-harness-evals-script.test.ts src/dev/write-agent-native-ratchet-report-script.test.ts src/lib/cli/registry/agent-native-packet-command-specs.ts .harness/specs/2026-06-23-installed-package-downstream-portability-gate-spec.md .harness/plans/2026-06-23-ai-delivery-harness-cockpit-trace-plan.yaml .harness/plans/2026-06-23-ai-delivery-harness-cockpit-tracker-plan.yaml .harness/plans/2026-06-23-installed-package-downstream-portability-gate-execution-plan.yaml .harness/implementation-notes/2026-06-23-installed-package-downstream-portability-gate-work-result.md`: pass
- `node --import tsx scripts/run-harness-evals.mjs --scenario package-installed-downstream-canary --fixture-root artifacts/evals/live-fixtures-jsc403-proof --output artifacts/evals/jsc403-result.json --observability-output artifacts/evals/jsc403-braintrust.json`: pass
- `rg -n '/Users/jamiecraik/dev/coding-harness|node scripts|pnpm run' artifacts/evals/live-fixtures-jsc403-proof/package-installed-downstream-canary/result.json || true`: pass; no matches
- `bash scripts/validate-codestyle.sh --fast`: pass

## Proof Boundary

The local canary proves the covered installed command path from a downstream repo outside the source workspace:

- `harness next --json`
- `harness commands --json --for-agent`
- `harness session-distill --json`
- `harness agent-native-ratchets --json`
- `harness agent-rework --json`
- `harness reviewer-decision --json`
- `harness init --dry-run --json`

The primary `pnpm add <packed tarball>` path still fails in this local environment before dependency materialization, so the canary falls back to deterministic local dependency links while still running the packed package's `dist/cli.js` through `node_modules/.bin/harness`. This proves local installed-command portability for the covered commands. It does not prove live CI, review-thread state, tracker state, npm publication, or merge readiness.

## Next Stage

Open the JSC-403 PR, run PR green sweep against live CI and review state, merge when current required checks and review state allow it, update local `main`, then continue with JSC-404.
