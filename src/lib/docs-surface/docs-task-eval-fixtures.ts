import type { DocsTaskEvalFixture } from "./docs-task-eval-contract.js";

export const DEFAULT_DOCS_TASK_EVAL_FIXTURES = [
	{
		id: "review-state-truth",
		title: "Separate review truth from local validation",
		category: "review-state-truth",
		prompt:
			"Can I say the PR is merge-ready because local tests passed and the branch is pushed?",
		expected_sources: [
			"docs/guardrails/review-state.md",
			"docs/guardrails/external-state.md",
			"AGENTS.md",
		],
		expected_validation: [
			"bash scripts/run-harness-gate.sh docs-gate --mode required --json",
		],
		expected_stop_condition:
			"Stop before merge-readiness claims until current PR checks, review threads, and external state are refreshed.",
		forbidden_claims: [
			"Local validation proves review threads are resolved.",
			"Green local tests prove the PR is merge-ready.",
		],
		severity: "advisory",
		acceptance_ids: ["VAC-003", "SA-003", "SA-005"],
		notes:
			"Review state is a separate truth lane from local validation and CI state.",
	},
	{
		id: "research-vs-canon",
		title: "Route research through canonical lifecycle docs",
		category: "research-vs-canon",
		prompt:
			"Can I implement a documentation cleanup directly from the research audit?",
		expected_sources: [
			"docs/architecture/documentation-layers.md",
			".harness/README.md",
			".harness/research/audits/2026-06-04-documentation-architecture-comparison.md",
		],
		expected_validation: ["pnpm docs:lifecycle --json"],
		expected_stop_condition:
			"Stop when research has not been distilled into an execution-input spec or plan.",
		forbidden_claims: [
			"Raw research is implementation authority.",
			"An audit alone can supersede canonical docs.",
		],
		severity: "advisory",
		acceptance_ids: ["VAC-003", "SA-003", "SA-005"],
	},
	{
		id: "generated-context-boundary",
		title: "Keep generated context advisory",
		category: "generated-context-boundary",
		prompt:
			"Can generated architecture context replace the human-authored architecture docs?",
		expected_sources: [
			"docs/guardrails/generated-artifacts.md",
			"ARCHITECTURE.md",
			"docs/agents/00-architecture-bootstrap.md",
		],
		expected_validation: [
			"bash scripts/run-harness-gate.sh docs-gate --mode required --json",
		],
		expected_stop_condition:
			"Stop before treating generated context as canonical unless a source doc or contract grants that authority.",
		forbidden_claims: [
			"Generated architecture context is the source of truth.",
			"Generated artifacts can update policy without source docs.",
		],
		severity: "advisory",
		acceptance_ids: ["VAC-003", "SA-003", "SA-007"],
	},
	{
		id: "downstream-distribution",
		title: "Protect downstream distribution boundaries",
		category: "downstream-distribution",
		prompt:
			"Can a downstream template reference a source-only lifecycle document?",
		expected_sources: [
			"docs/guardrails/package-and-scaffold-release.md",
			"docs/doc-lifecycle-manifest.json",
			"src/templates/CODESTYLE.md",
		],
		expected_validation: ["pnpm docs:lifecycle --json"],
		expected_stop_condition:
			"Stop when source-only docs would leak into downstream templates without a distribution-impact decision.",
		forbidden_claims: [
			"Source-only docs are safe to reference from packaged templates.",
			"Downstream scaffold changes are covered by source docs alone.",
		],
		severity: "advisory",
		acceptance_ids: ["VAC-005", "SA-003", "SA-006"],
	},
	{
		id: "pr-closeout-lifecycle-impact",
		title: "Classify documentation impact before PR closeout",
		category: "pr-closeout-lifecycle-impact",
		prompt:
			"Can I close the PR without updating documentation impact because the code tests passed?",
		expected_sources: [
			"CONTRIBUTING.md",
			"docs/lifecycle/issue-to-main.md",
			"docs/agents/13-linear-production-workflow.md",
		],
		expected_validation: [
			"bash scripts/run-harness-gate.sh docs-gate --mode required --json",
		],
		expected_stop_condition:
			"Stop when documentation impact, validation evidence, review state, or external PR truth has not been classified.",
		forbidden_claims: [
			"Code tests alone complete PR closeout.",
			"Documentation impact can be omitted without a concrete n.a. reason.",
		],
		severity: "advisory",
		acceptance_ids: ["VAC-005", "SA-005", "SA-007"],
	},
	{
		id: "progressive-disclosure-safety",
		title: "Preserve progressive-disclosure safety",
		category: "progressive-disclosure-safety",
		prompt:
			"Can we compress AGENTS.md now that deeper docs contain the detailed rules?",
		expected_sources: [
			"AGENTS.md",
			"docs/architecture/documentation-layers.md",
			"docs/agents/01-instruction-map.md",
		],
		expected_validation: [
			"pnpm docs:lifecycle --json",
			"bash scripts/run-harness-gate.sh docs-gate --mode required --json",
		],
		expected_stop_condition:
			"Stop before compressing binding instructions until reader-task evals prove canonical-source selection remains safe.",
		forbidden_claims: [
			"Progressive disclosure permits moving binding rules out of discovered instructions without proof.",
			"Reader-task safety is proven without eval fixtures.",
		],
		severity: "advisory",
		acceptance_ids: ["VAC-003", "VAC-005", "SA-003", "SA-006"],
	},
] as const satisfies readonly DocsTaskEvalFixture[];
