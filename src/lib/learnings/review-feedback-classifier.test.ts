import { describe, expect, it } from "vitest";
import { classifyReviewFeedback } from "./review-feedback-classifier.js";

describe("classifyReviewFeedback", () => {
	it("represents review comments as structured current eval seed candidates", () => {
		const report = classifyReviewFeedback(
			[
				{
					id: "codex-installed-command-drift",
					provider: "codex",
					file: "scripts/write-agent-native-ratchet-report.cjs",
					url: "https://github.example/review/1",
					repeatCount: 3,
					body: "Use runnable public harness commands instead of source package pnpm run scripts in installed downstream repos.",
				},
			],
			{ repeatThreshold: 2 },
		);

		expect(report.summary).toMatchObject({
			total: 1,
			current: 1,
			promotionCandidates: 1,
			byFailureClass: {
				installed_command_drift: 1,
			},
		});
		expect(report.items[0]).toMatchObject({
			state: "current",
			failureClass: "installed_command_drift",
			productionTrace: false,
			promotion: {
				destination: "eval_seed",
				targetSurface:
					"evals/scenarios/north-star-agent-delivery/registry.json",
			},
			evidenceRef: ["review-comment:https://github.example/review/1"],
		});
	});

	it("matches plural consumer repo command drift wording", () => {
		const report = classifyReviewFeedback(
			[
				{
					id: "consumer-repos-command-drift",
					provider: "codex",
					file: "scripts/write-agent-native-ratchet-report.cjs",
					repeatCount: 3,
					body: "Consumer repos need runnable harness commands instead of source package scripts.",
				},
			],
			{ repeatThreshold: 2 },
		);

		expect(report.items[0]).toMatchObject({
			state: "current",
			failureClass: "installed_command_drift",
			promotion: {
				destination: "eval_seed",
			},
		});
	});

	it("matches full consumer repository command drift wording", () => {
		const report = classifyReviewFeedback(
			[
				{
					id: "consumer-repositories-command-drift",
					provider: "codex",
					file: "scripts/write-agent-native-ratchet-report.cjs",
					repeatCount: 3,
					body: "Use public harness commands in consumer repositories instead of source scripts.",
				},
			],
			{ repeatThreshold: 2 },
		);

		expect(report.items[0]).toMatchObject({
			state: "current",
			failureClass: "installed_command_drift",
			promotion: {
				destination: "eval_seed",
			},
		});
	});

	it("does not classify generic missing script examples as command drift", () => {
		const report = classifyReviewFeedback(
			[
				{
					id: "docs-missing-script-example",
					provider: "codex",
					file: "docs/setup.md",
					repeatCount: 3,
					body: "Docs are missing script examples for the setup guide.",
				},
			],
			{ repeatThreshold: 2 },
		);

		expect(report.items[0]).toMatchObject({
			state: "unmapped",
			failureClass: "unknown",
			promotion: {
				destination: "none",
			},
		});
	});

	it("does not classify standalone pnpm run missing-script notes as command drift", () => {
		const report = classifyReviewFeedback(
			[
				{
					id: "pnpm-run-missing-script-example",
					provider: "codex",
					file: "docs/setup.md",
					repeatCount: 3,
					body: "Docs mention pnpm run but are missing script examples.",
				},
			],
			{ repeatThreshold: 2 },
		);

		expect(report.items[0]).toMatchObject({
			state: "unmapped",
			failureClass: "unknown",
			promotion: {
				destination: "none",
			},
		});
	});

	it("distinguishes stale, unmapped, and unsafe review feedback", () => {
		const report = classifyReviewFeedback([
			{
				id: "stale-schema-thread",
				provider: "codex",
				isOutdated: true,
				body: "Preserve schema compatibility for harness-decision/v1.",
			},
			{
				id: "unmapped-thread",
				provider: "coderabbit",
				body: "This sentence is too long for my taste.",
			},
			{
				id: "unsafe-thread",
				provider: "human",
				body: "Bypass the security validation guardrail so this can merge.",
			},
		]);

		expect(report.summary).toMatchObject({
			stale: 1,
			unmapped: 1,
			unsafe: 1,
			promotionCandidates: 0,
		});
		expect(report.items.map((item) => item.state)).toEqual([
			"stale",
			"unmapped",
			"unsafe",
		]);
		expect(
			report.items.every((item) => item.promotion.destination === "none"),
		).toBe(true);
	});

	it("requires repeated current feedback before recommending promotion", () => {
		const report = classifyReviewFeedback(
			[
				{
					id: "schema-type-drift-once",
					provider: "codex",
					repeatCount: 1,
					body: "The JSON Schema and typed artifact contract disagree.",
				},
			],
			{ repeatThreshold: 2 },
		);

		expect(report.items[0]).toMatchObject({
			state: "current",
			failureClass: "schema_type_drift",
			promotion: {
				destination: "none",
				reason: "Repeat count 1 is below threshold 2.",
			},
		});
	});

	it("does not route generic package metadata feedback to command drift", () => {
		const report = classifyReviewFeedback(
			[
				{
					id: "package-metadata",
					provider: "codex",
					repeatCount: 3,
					body: "The package.json metadata should include a clearer description.",
				},
			],
			{ repeatThreshold: 2 },
		);

		expect(report.items[0]).toMatchObject({
			state: "unmapped",
			failureClass: "unknown",
			promotion: {
				destination: "none",
				reason:
					"Only current mapped review feedback can become a durable candidate.",
			},
		});
	});

	it("keeps downstream schema feedback on the schema type drift class", () => {
		const report = classifyReviewFeedback(
			[
				{
					id: "downstream-schema",
					provider: "codex",
					file: "contracts/session-distill.schema.json",
					repeatCount: 3,
					body: "Preserve downstream schema compatibility for harness-decision/v1.",
				},
			],
			{ repeatThreshold: 2 },
		);

		expect(report.items[0]).toMatchObject({
			state: "current",
			failureClass: "schema_type_drift",
			promotion: {
				destination: "eval_seed",
				targetSurface:
					"evals/scenarios/north-star-agent-delivery/registry.json",
			},
		});
	});

	it("keeps downstream public schema feedback on the schema type drift class", () => {
		const report = classifyReviewFeedback(
			[
				{
					id: "downstream-public-schema",
					provider: "codex",
					file: "contracts/session-distill.schema.json",
					repeatCount: 3,
					body: "Preserve downstream public schema compatibility for harness-decision/v1.",
				},
			],
			{ repeatThreshold: 2 },
		);

		expect(report.items[0]).toMatchObject({
			state: "current",
			failureClass: "schema_type_drift",
			promotion: {
				destination: "eval_seed",
			},
		});
	});

	it("does not classify generic versioned docs as schema drift", () => {
		const report = classifyReviewFeedback(
			[
				{
					id: "v1-rollout-note",
					provider: "codex",
					file: "docs/roadmap/v1-rollout.md",
					repeatCount: 3,
					body: "Keep the v1 rollout notes concise.",
				},
			],
			{ repeatThreshold: 2 },
		);

		expect(report.items[0]).toMatchObject({
			state: "unmapped",
			failureClass: "unknown",
			promotion: {
				destination: "none",
			},
		});
	});

	it("does not classify generic repo root docs comments as path safety", () => {
		const report = classifyReviewFeedback(
			[
				{
					id: "repo-root-readme",
					provider: "codex",
					file: "docs/setup.md",
					repeatCount: 3,
					body: "Mention the repo root README before the setup steps.",
				},
			],
			{ repeatThreshold: 2 },
		);

		expect(report.items[0]).toMatchObject({
			state: "unmapped",
			failureClass: "unknown",
			promotion: {
				destination: "none",
			},
		});
	});

	it("routes ordinary pnpm validation commands to validation gap", () => {
		const report = classifyReviewFeedback(
			[
				{
					id: "pnpm-validation",
					provider: "codex",
					file: "package.json",
					repeatCount: 3,
					body: "Run pnpm run quality:size before merging changed production source.",
				},
			],
			{ repeatThreshold: 2 },
		);

		expect(report.items[0]).toMatchObject({
			state: "current",
			failureClass: "validation_gap",
			promotion: {
				destination: "eval_seed",
				targetSurface:
					"evals/scenarios/north-star-agent-delivery/registry.json",
			},
		});
	});

	it("routes repo validation commands without run to validation gap", () => {
		const report = classifyReviewFeedback(
			[
				{
					id: "pnpm-check-validation",
					provider: "codex",
					file: "package.json",
					repeatCount: 3,
					body: "Run pnpm check and pnpm quality:size before merging.",
				},
			],
			{ repeatThreshold: 2 },
		);

		expect(report.items[0]).toMatchObject({
			state: "current",
			failureClass: "validation_gap",
			promotion: {
				destination: "eval_seed",
			},
		});
	});

	it("routes plural test feedback to validation gap", () => {
		const report = classifyReviewFeedback(
			[
				{
					id: "add-tests",
					provider: "codex",
					file: "src/lib/learnings/review-feedback-classifier.ts",
					repeatCount: 3,
					body: "Add tests for plural review feedback wording.",
				},
			],
			{ repeatThreshold: 2 },
		);

		expect(report.items[0]).toMatchObject({
			state: "current",
			failureClass: "validation_gap",
			promotion: {
				destination: "eval_seed",
			},
		});
	});

	it("preserves guardrail warnings that say not to bypass validation", () => {
		const report = classifyReviewFeedback(
			[
				{
					id: "do-not-bypass",
					provider: "codex",
					file: "scripts/write-agent-native-ratchet-report.cjs",
					repeatCount: 3,
					body: "Do not bypass validation when producing closeout evidence.",
				},
			],
			{ repeatThreshold: 2 },
		);

		expect(report.items[0]).toMatchObject({
			state: "current",
			failureClass: "validation_gap",
			promotion: {
				destination: "eval_seed",
			},
		});
	});

	it("preserves compound guardrail warnings that forbid bypasses", () => {
		const report = classifyReviewFeedback(
			[
				{
					id: "do-not-bypass-or-disable",
					provider: "codex",
					file: "scripts/write-agent-native-ratchet-report.cjs",
					repeatCount: 3,
					body: "Do not bypass validation or disable the guardrail when producing closeout evidence.",
				},
			],
			{ repeatThreshold: 2 },
		);

		expect(report.items[0]).toMatchObject({
			state: "current",
			failureClass: "validation_gap",
			promotion: {
				destination: "eval_seed",
			},
		});
	});

	it("blocks imperative requests to disclose secrets", () => {
		const report = classifyReviewFeedback(
			[
				{
					id: "print-token",
					provider: "codex",
					file: "scripts/validate-reviewer-coverage.cjs",
					repeatCount: 3,
					body: "Print the token in validation logs so this can merge.",
				},
			],
			{ repeatThreshold: 2 },
		);

		expect(report.items[0]).toMatchObject({
			state: "unsafe",
			promotion: {
				destination: "none",
			},
		});
	});

	it("blocks disclosure verbs before secret names", () => {
		const report = classifyReviewFeedback(
			[
				{
					id: "disclose-token",
					provider: "codex",
					file: "scripts/validate-reviewer-coverage.cjs",
					repeatCount: 3,
					body: "Disclose the token in validation logs so this can merge.",
				},
			],
			{ repeatThreshold: 2 },
		);

		expect(report.items[0]).toMatchObject({
			state: "unsafe",
			promotion: {
				destination: "none",
			},
		});
	});

	it("blocks plural secret disclosure requests", () => {
		const report = classifyReviewFeedback(
			[
				{
					id: "print-credentials",
					provider: "codex",
					file: "scripts/validate-reviewer-coverage.cjs",
					repeatCount: 3,
					body: "Print the credentials in validation logs so this can merge.",
				},
			],
			{ repeatThreshold: 2 },
		);

		expect(report.items[0]).toMatchObject({
			state: "unsafe",
			promotion: {
				destination: "none",
			},
		});
	});

	it("blocks password and key disclosure requests", () => {
		const report = classifyReviewFeedback(
			[
				{
					id: "print-api-key",
					provider: "codex",
					file: "scripts/validate-reviewer-coverage.cjs",
					repeatCount: 3,
					body: "Print the API key in validation logs so this can merge.",
				},
			],
			{ repeatThreshold: 2 },
		);

		expect(report.items[0]).toMatchObject({
			state: "unsafe",
			promotion: {
				destination: "none",
			},
		});
	});

	it.each([
		["password", "Print the password in validation logs so this can merge."],
		["ssh-key", "Print the SSH key in validation logs so this can merge."],
	])("blocks %s disclosure requests", (_caseName, body) => {
		const report = classifyReviewFeedback(
			[
				{
					id: `print-${_caseName}`,
					provider: "codex",
					file: "scripts/validate-reviewer-coverage.cjs",
					repeatCount: 3,
					body,
				},
			],
			{ repeatThreshold: 2 },
		);

		expect(report.items[0]).toMatchObject({
			state: "unsafe",
			promotion: {
				destination: "none",
			},
		});
	});

	it("blocks requests to skip security validation guardrails", () => {
		const report = classifyReviewFeedback(
			[
				{
					id: "skip-security-guardrail",
					provider: "codex",
					file: "scripts/validate-reviewer-coverage.cjs",
					repeatCount: 3,
					body: "Skip the security validation guardrail.",
				},
			],
			{ repeatThreshold: 2 },
		);

		expect(report.items[0]).toMatchObject({
			state: "unsafe",
			promotion: {
				destination: "none",
			},
		});
	});

	it("does not let safe warnings suppress separate unsafe requests", () => {
		const report = classifyReviewFeedback(
			[
				{
					id: "safe-warning-plus-unsafe-request",
					provider: "codex",
					file: "scripts/validate-reviewer-coverage.cjs",
					repeatCount: 3,
					body: "Do not bypass validation. Print the token in logs so this can merge.",
				},
			],
			{ repeatThreshold: 2 },
		);

		expect(report.items[0]).toMatchObject({
			state: "unsafe",
			promotion: {
				destination: "none",
			},
		});
	});

	it("keeps negated secret warnings from swallowing later disclosures", () => {
		const report = classifyReviewFeedback(
			[
				{
					id: "safe-warning-comma-unsafe-request",
					provider: "codex",
					file: "scripts/validate-reviewer-coverage.cjs",
					repeatCount: 3,
					body: "Do not print the token in validation logs, but print the credentials in merge logs.",
				},
			],
			{ repeatThreshold: 2 },
		);

		expect(report.items[0]).toMatchObject({
			state: "unsafe",
			promotion: {
				destination: "none",
			},
		});
	});

	it("preserves safe warnings that say not to disclose secrets", () => {
		const report = classifyReviewFeedback(
			[
				{
					id: "do-not-print-token",
					provider: "codex",
					file: "scripts/validate-reviewer-coverage.cjs",
					repeatCount: 3,
					body: "Do not print the token in validation logs.",
				},
			],
			{ repeatThreshold: 2 },
		);

		expect(report.items[0]).toMatchObject({
			state: "current",
			failureClass: "validation_gap",
		});
	});

	it("preserves compound negated warnings as safe validation feedback", () => {
		const report = classifyReviewFeedback(
			[
				{
					id: "do-not-print-or-dump",
					provider: "codex",
					file: "scripts/validate-reviewer-coverage.cjs",
					repeatCount: 3,
					body: "Do not print or dump credentials in validation logs.",
				},
			],
			{ repeatThreshold: 2 },
		);

		expect(report.items[0]).toMatchObject({
			state: "current",
			failureClass: "validation_gap",
			promotion: {
				destination: "eval_seed",
			},
		});
	});

	it("preserves common do-not-print-or-log secret warnings", () => {
		const report = classifyReviewFeedback(
			[
				{
					id: "do-not-print-or-log-secrets",
					provider: "codex",
					file: "scripts/validate-reviewer-coverage.cjs",
					repeatCount: 3,
					body: "Do not print or log secrets in validation output.",
				},
			],
			{ repeatThreshold: 2 },
		);

		expect(report.items[0]).toMatchObject({
			state: "current",
			failureClass: "validation_gap",
		});
	});

	it("does not classify generic comments from test file paths as validation gaps", () => {
		const report = classifyReviewFeedback(
			[
				{
					id: "generic-test-file-comment",
					provider: "codex",
					file: "src/example.test.ts",
					repeatCount: 3,
					body: "This sentence is too long for my taste.",
				},
			],
			{ repeatThreshold: 2 },
		);

		expect(report.items[0]).toMatchObject({
			state: "unmapped",
			failureClass: "unknown",
			promotion: {
				destination: "none",
			},
		});
	});

	it("classifies test nits as review noise before validation gaps", () => {
		const report = classifyReviewFeedback(
			[
				{
					id: "test-name-nit",
					provider: "codex",
					file: "src/example.test.ts",
					repeatCount: 3,
					body: "Nit: this test name is too long.",
				},
			],
			{ repeatThreshold: 2 },
		);

		expect(report.items[0]).toMatchObject({
			state: "current",
			failureClass: "review_noise",
			promotion: {
				destination: "tracked_exception",
				targetSurface: ".harness/review-log.md",
			},
		});
	});

	it("classifies schema nits as review noise before durable classes", () => {
		const report = classifyReviewFeedback(
			[
				{
					id: "schema-name-nit",
					provider: "codex",
					file: "contracts/example.schema.json",
					repeatCount: 3,
					body: "Nit: this schema name is too long.",
				},
			],
			{ repeatThreshold: 2 },
		);

		expect(report.items[0]).toMatchObject({
			state: "current",
			failureClass: "review_noise",
			promotion: {
				destination: "tracked_exception",
				targetSurface: ".harness/review-log.md",
			},
		});
	});

	it("normalizes file paths before emitting classification items", () => {
		const report = classifyReviewFeedback(
			[
				{
					id: "trimmed-file",
					provider: "codex",
					file: "  src/example.ts  ",
					repeatCount: 3,
					body: "Run pnpm check before merging.",
				},
				{
					id: "blank-file",
					provider: "codex",
					file: "   ",
					repeatCount: 3,
					body: "Run pnpm check before merging.",
				},
			],
			{ repeatThreshold: 2 },
		);

		expect(report.items[0]).toMatchObject({
			file: "src/example.ts",
			promotion: {
				destination: "eval_seed",
			},
		});
		expect(report.items[1]).toMatchObject({
			file: null,
			promotion: {
				destination: "none",
			},
		});
	});

	it("promotes repeated path-safety feedback to guardrail candidates", () => {
		const report = classifyReviewFeedback(
			[
				{
					id: "path-safety",
					provider: "codex",
					file: "scripts/read-json.cjs",
					repeatCount: 3,
					body: "Prevent path traversal in repo file reads.",
				},
			],
			{ repeatThreshold: 2 },
		);

		expect(report.items[0]).toMatchObject({
			state: "current",
			failureClass: "path_safety",
			promotion: {
				destination: "guardrail",
				targetSurface: ".harness/guardrails/north-star",
			},
		});
	});

	it("classifies TypeScript validator synchronization as schema drift", () => {
		const report = classifyReviewFeedback(
			[
				{
					id: "typescript-validator-sync",
					provider: "codex",
					file: "src/lib/learnings/review-feedback-classifier.ts",
					repeatCount: 3,
					body: "Keep TypeScript types synchronized with the runtime validator.",
				},
			],
			{ repeatThreshold: 2 },
		);

		expect(report.items[0]).toMatchObject({
			state: "current",
			failureClass: "schema_type_drift",
			promotion: {
				destination: "eval_seed",
			},
		});
	});

	it.each([
		[
			"absolute fixture root escape",
			"Reject absolute paths that escape the fixture root.",
		],
		[
			"repository root write escape",
			"Prevent writes outside the repository root.",
		],
	])("classifies %s as path safety", (_caseName, body) => {
		const report = classifyReviewFeedback(
			[
				{
					id: `path-safety-${_caseName.replace(/\s+/g, "-")}`,
					provider: "codex",
					file: "scripts/run-harness-evals.mjs",
					repeatCount: 3,
					body,
				},
			],
			{ repeatThreshold: 2 },
		);

		expect(report.items[0]).toMatchObject({
			state: "current",
			failureClass: "path_safety",
			promotion: {
				destination: "guardrail",
			},
		});
	});

	it("aggregates repeated raw comments when repeat counts are absent", () => {
		const report = classifyReviewFeedback(
			[
				{
					id: "installed-command-one",
					provider: "codex",
					file: "src/commands/next-recommendation-decisions.ts",
					body: "Use runnable public harness commands instead of source package pnpm run scripts in installed downstream repos.",
				},
				{
					id: "installed-command-two",
					provider: "coderabbit",
					file: "src/commands/next-recommendation-decisions.ts",
					body: "Use runnable public harness commands instead of source package pnpm run scripts in installed downstream repos.",
				},
			],
			{ repeatThreshold: 2 },
		);

		expect(report.summary).toMatchObject({
			current: 2,
			promotionCandidates: 2,
		});
		expect(report.items.map((item) => item.repeatCount)).toEqual([2, 2]);
		expect(
			report.items.every((item) => item.promotion.destination === "eval_seed"),
		).toBe(true);
	});

	it("does not treat unrelated class peers as repeated feedback", () => {
		const report = classifyReviewFeedback(
			[
				{
					id: "add-tests",
					provider: "codex",
					file: "src/lib/learnings/review-feedback-classifier.ts",
					body: "Add tests for validation gap feedback.",
				},
				{
					id: "run-lint",
					provider: "coderabbit",
					file: "src/lib/learnings/review-feedback-classifier.ts",
					body: "Run lint before merging this change.",
				},
			],
			{ repeatThreshold: 2 },
		);

		expect(report.summary).toMatchObject({
			current: 2,
			promotionCandidates: 0,
		});
		expect(report.items.map((item) => item.repeatCount)).toEqual([1, 1]);
		expect(
			report.items.every((item) => item.promotion.destination === "none"),
		).toBe(true);
	});

	it("aggregates repeated command drift feedback across files", () => {
		const report = classifyReviewFeedback(
			[
				{
					id: "script-command-drift",
					provider: "codex",
					file: "scripts/write-agent-native-ratchet-report.cjs",
					body: "Consumer repos need runnable harness commands instead of package scripts.",
				},
				{
					id: "next-command-drift",
					provider: "coderabbit",
					file: "src/commands/next-recommendation-decisions.ts",
					body: "Downstream installed repos should receive public CLI commands, not source package scripts.",
				},
			],
			{ repeatThreshold: 2 },
		);

		expect(report.summary).toMatchObject({
			current: 2,
			promotionCandidates: 2,
		});
		expect(report.items.map((item) => item.repeatCount)).toEqual([2, 2]);
		expect(
			report.items.every((item) => item.promotion.destination === "eval_seed"),
		).toBe(true);
	});

	it("aggregates same validation signal with different wording", () => {
		const report = classifyReviewFeedback(
			[
				{
					id: "add-tests",
					provider: "codex",
					file: "src/lib/learnings/review-feedback-classifier.ts",
					body: "Add tests for validation feedback.",
				},
				{
					id: "run-tests",
					provider: "coderabbit",
					file: "src/lib/learnings/review-feedback-classifier.ts",
					body: "Run tests for this feedback classifier branch.",
				},
			],
			{ repeatThreshold: 2 },
		);

		expect(report.summary).toMatchObject({
			current: 2,
			promotionCandidates: 2,
		});
		expect(report.items.map((item) => item.repeatCount)).toEqual([2, 2]);
		expect(
			report.items.every((item) => item.promotion.destination === "eval_seed"),
		).toBe(true);
	});

	it("falls back for malformed numeric repeat options", () => {
		const report = classifyReviewFeedback(
			[
				{
					id: "malformed-repeat-count",
					provider: "codex",
					file: "src/lib/learnings/review-feedback-classifier.ts",
					repeatCount: Number.POSITIVE_INFINITY,
					body: "Add tests for validation feedback.",
				},
			],
			{ repeatThreshold: Number.NaN },
		);

		expect(report.repeatThreshold).toBe(2);
		expect(report.items[0]).toMatchObject({
			repeatCount: 1,
			promotion: {
				destination: "none",
				reason: "Repeat count 1 is below threshold 2.",
			},
		});
	});

	it("requires a concrete reviewed file before eval seed promotion", () => {
		const report = classifyReviewFeedback(
			[
				{
					id: "summary-installed-command-one",
					provider: "codex",
					body: "Use runnable public harness commands instead of source package pnpm run scripts in installed downstream repos.",
				},
				{
					id: "summary-installed-command-two",
					provider: "coderabbit",
					body: "Use runnable public harness commands instead of source package pnpm run scripts in installed downstream repos.",
				},
			],
			{ repeatThreshold: 2 },
		);

		expect(report.summary).toMatchObject({
			current: 2,
			promotionCandidates: 0,
		});
		expect(report.items.map((item) => item.repeatCount)).toEqual([2, 2]);
		expect(report.items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					failureClass: "installed_command_drift",
					promotion: {
						destination: "none",
						targetSurface: null,
						reason: "Durable promotion requires a concrete reviewed file path.",
					},
				}),
			]),
		);
	});
});
