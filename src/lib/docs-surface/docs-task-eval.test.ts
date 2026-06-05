import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	DOCS_TASK_EVAL_REPORT_SCHEMA,
	DEFAULT_DOCS_TASK_EVAL_FIXTURES,
	type DocsTaskEvalFixture,
	type DocsTaskEvalReport,
	runDocsTaskEval,
} from "./docs-task-eval.js";

describe("runDocsTaskEval", () => {
	it("passes the default advisory fixtures against current repo sources", () => {
		const report = runDocsTaskEval({ repoRoot: process.cwd() });

		expect(report).toEqual(
			expect.objectContaining({
				schema: DOCS_TASK_EVAL_REPORT_SCHEMA,
				status: "pass",
				advisory_status: "pass",
				summary: {
					total: 6,
					passed: 6,
					failed: 0,
					advisory: 6,
					required: 0,
				},
				findings: [],
			}),
		);
		expect(report.fixtures.map((fixture) => fixture.category).sort()).toEqual([
			"downstream-distribution",
			"generated-context-boundary",
			"pr-closeout-lifecycle-impact",
			"progressive-disclosure-safety",
			"research-vs-canon",
			"review-state-truth",
		]);
		expect(report.evidence_ref).toEqual(
			expect.arrayContaining([
				"docs/guardrails/review-state.md",
				"pnpm docs:lifecycle --json",
				"bash scripts/run-harness-gate.sh docs-gate --mode required --json",
			]),
		);
	});

	it("preserves acceptance traceability in fixture results", () => {
		const report = runDocsTaskEval({
			repoRoot: process.cwd(),
			fixtures: [validFixture()],
		});

		expect(report.fixtures).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "review-state-truth",
					acceptance_ids: ["VAC-003", "SA-005"],
				}),
			]),
		);
	});

	it("fails closed when fixtures contain unknown fields", () => {
		const report = runDocsTaskEval({
			repoRoot: process.cwd(),
			fixtures: [{ ...validFixture(), unexpected_field: true }],
		});

		expect(report.status).toBe("fail");
		expect(report.findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "review-state-truth.unknown-field.unexpected_field",
					severity: "required",
					kind: "configuration",
				}),
			]),
		);
	});

	it("separates advisory missing-source warnings from required failures", () => {
		const report = runDocsTaskEval({
			repoRoot: process.cwd(),
			fixtures: DEFAULT_DOCS_TASK_EVAL_FIXTURES.map((fixture) =>
				fixture.id === "review-state-truth"
					? {
							...fixture,
							expected_sources: ["docs/does-not-exist.md"],
							severity: "advisory",
						}
					: fixture,
			),
		});

		expect(report.status).toBe("pass");
		expect(report.advisory_status).toBe("warn");
		expect(report.findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "review-state-truth.missing-source",
					severity: "advisory",
					kind: "repository-evidence",
					path: "docs/does-not-exist.md",
				}),
			]),
		);
	});

	it("fails required missing-source evidence", () => {
		const report = runDocsTaskEval({
			repoRoot: process.cwd(),
			fixtures: [
				{
					...validFixture(),
					expected_sources: ["docs/does-not-exist.md"],
					severity: "required",
				},
			],
		});

		expect(report.status).toBe("fail");
		expect(report.findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "review-state-truth.missing-source",
					severity: "required",
					kind: "repository-evidence",
				}),
			]),
		);
	});

	it("rejects directory source evidence", () => {
		const repoRoot = createRepoWithSource("docs/source.md");
		mkdirSync(join(repoRoot, "docs/directory-source"), { recursive: true });
		const report = runDocsTaskEval({
			repoRoot,
			fixtures: [
				{
					...validFixture(),
					expected_sources: ["docs/directory-source"],
					severity: "required",
				},
			],
		});

		expect(report.status).toBe("fail");
		expect(report.findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "review-state-truth.invalid-source-file",
					severity: "required",
					kind: "repository-evidence",
					path: "docs/directory-source",
				}),
			]),
		);
	});

	it("distinguishes missing fixture configuration from repository evidence", () => {
		const report = runDocsTaskEval({
			repoRoot: process.cwd(),
			fixtures: [
				{
					...validFixture(),
					expected_validation: [],
					expected_stop_condition: "",
					forbidden_claims: [],
				},
			],
		});

		expect(report.status).toBe("fail");
		expect(report.findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "review-state-truth.missing-expected_validation",
					kind: "configuration",
				}),
				expect.objectContaining({
					id: "review-state-truth.missing-expected_stop_condition",
					kind: "configuration",
				}),
				expect.objectContaining({
					id: "review-state-truth.missing-forbidden_claims",
					kind: "configuration",
				}),
			]),
		);
		expect(report.findings).not.toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind: "repository-evidence",
				}),
			]),
		);
	});

	it("requires all initial fixture categories", () => {
		const report = runDocsTaskEval({
			repoRoot: process.cwd(),
			fixtures: [validFixture()],
		});

		expect(report.status).toBe("fail");
		expect(report.findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "missing-category.downstream-distribution",
					kind: "category-coverage",
				}),
			]),
		);
	});

	it("rejects absolute and escaping source paths before filesystem lookup", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "docs-task-eval-"));
		const report = runDocsTaskEval({
			repoRoot,
			fixtures: [
				{ ...validFixture(), expected_sources: ["/tmp/outside.md"] },
				{
					...validFixture(),
					id: "review-state-escape",
					expected_sources: ["../outside.md"],
				},
			],
		});

		expect(report.status).toBe("fail");
		expect(report.findings).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "review-state-truth.invalid-source-path",
					kind: "configuration",
				}),
				expect.objectContaining({
					id: "review-state-escape.invalid-source-path",
					kind: "configuration",
				}),
			]),
		);
	});

	it("emits a stable report shape for automation consumers", () => {
		const repoRoot = createRepoWithSource("docs/source.md");
		const report = runDocsTaskEval({
			repoRoot,
			fixtures: [
				{
					...validFixture(),
					expected_sources: ["docs/source.md"],
				},
			],
		});

		expect(report).toMatchObject<DocsTaskEvalReport>({
			schema: "docs-task-eval-report/v1",
			status: "fail",
			advisory_status: "pass",
			fixtures: [
				expect.objectContaining({
					id: "review-state-truth",
					evidence_ref: ["docs/source.md", "pnpm docs:lifecycle --json"],
				}),
			],
			findings: expect.arrayContaining([
				expect.objectContaining({ kind: "category-coverage" }),
			]),
			summary: {
				total: 1,
				passed: 1,
				failed: 0,
				advisory: 1,
				required: 0,
			},
			evidence_ref: ["docs/source.md", "pnpm docs:lifecycle --json"],
		});
	});

	it("keeps the exported default fixture set immutable to callers by convention", () => {
		expect(DEFAULT_DOCS_TASK_EVAL_FIXTURES).toHaveLength(6);
	});
});

function validFixture(): DocsTaskEvalFixture {
	return {
		id: "review-state-truth",
		title: "Review state truth",
		category: "review-state-truth",
		prompt: "Can local tests prove review threads are resolved?",
		expected_sources: ["docs/guardrails/review-state.md"],
		expected_validation: ["pnpm docs:lifecycle --json"],
		expected_stop_condition: "Stop until current review-state evidence exists.",
		forbidden_claims: ["Local tests prove review threads are resolved."],
		severity: "advisory",
		acceptance_ids: ["VAC-003", "SA-005"],
	};
}

function createRepoWithSource(path: string): string {
	const repoRoot = mkdtempSync(join(tmpdir(), "docs-task-eval-repo-"));
	const absolutePath = join(repoRoot, path);
	mkdirSync(dirname(absolutePath), { recursive: true });
	writeFileSync(absolutePath, "# Source\n", "utf-8");
	return repoRoot;
}
