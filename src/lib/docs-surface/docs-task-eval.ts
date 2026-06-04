import { existsSync, statSync } from "node:fs";
import { isAbsolute, join, normalize, resolve, sep } from "node:path";
import { DEFAULT_DOCS_TASK_EVAL_FIXTURES } from "./docs-task-eval-fixtures.js";
import {
	DOCS_TASK_EVAL_CATEGORIES,
	DOCS_TASK_EVAL_REPORT_SCHEMA,
	type DocsTaskEvalFinding,
	type DocsTaskEvalFixture,
	type DocsTaskEvalFixtureResult,
	type DocsTaskEvalReport,
	type DocsTaskEvalSummary,
	type RunDocsTaskEvalOptions,
} from "./docs-task-eval-contract.js";
import {
	collectMissingCategoryFindings,
	validateFixture,
	type FixtureValidation,
} from "./docs-task-eval-validation.js";

export {
	DOCS_TASK_EVAL_CATEGORIES,
	DOCS_TASK_EVAL_REPORT_SCHEMA,
	type DocsTaskEvalAdvisoryStatus,
	type DocsTaskEvalCategory,
	type DocsTaskEvalFinding,
	type DocsTaskEvalFindingKind,
	type DocsTaskEvalFixture,
	type DocsTaskEvalFixtureResult,
	type DocsTaskEvalReport,
	type DocsTaskEvalSeverity,
	type DocsTaskEvalStatus,
	type DocsTaskEvalSummary,
	type RunDocsTaskEvalOptions,
} from "./docs-task-eval-contract.js";
export { DEFAULT_DOCS_TASK_EVAL_FIXTURES } from "./docs-task-eval-fixtures.js";

const FIXTURE_KEYS = new Set([
	"id",
	"title",
	"category",
	"prompt",
	"expected_sources",
	"expected_validation",
	"expected_stop_condition",
	"forbidden_claims",
	"severity",
	"acceptance_ids",
	"notes",
]);

type FixtureEvaluation = {
	result: DocsTaskEvalFixtureResult;
	findings: DocsTaskEvalFinding[];
};

/** Run deterministic reader-task documentation eval fixtures against local repo evidence. */
export function runDocsTaskEval(
	options: RunDocsTaskEvalOptions,
): DocsTaskEvalReport {
	const repoRoot = resolve(options.repoRoot);
	const fixtures = options.fixtures ?? DEFAULT_DOCS_TASK_EVAL_FIXTURES;
	const findings: DocsTaskEvalFinding[] = [];
	const results: DocsTaskEvalFixtureResult[] = [];
	const evidenceRef = new Set<string>();

	for (const fixture of fixtures) {
		const evaluation = evaluateFixture({ fixture, repoRoot, evidenceRef });
		findings.push(...evaluation.findings);
		results.push(evaluation.result);
	}

	findings.push(
		...collectMissingCategoryFindings(fixtures, DOCS_TASK_EVAL_CATEGORIES),
	);
	const uniqueFindings = dedupeFindings(findings);
	const summary = summarize(results);
	const hasRequiredFailure = uniqueFindings.some(
		(finding) => finding.severity === "required",
	);
	const hasAdvisoryFailure = uniqueFindings.some(
		(finding) => finding.severity === "advisory",
	);
	const advisoryCount = summary.advisory;
	return {
		schema: DOCS_TASK_EVAL_REPORT_SCHEMA,
		status: hasRequiredFailure ? "fail" : "pass",
		advisory_status:
			advisoryCount === 0
				? "not_applicable"
				: hasAdvisoryFailure
					? "warn"
					: "pass",
		fixtures: results,
		findings: uniqueFindings,
		summary,
		evidence_ref: [...evidenceRef].sort(),
	};
}

function evaluateFixture(options: {
	fixture: unknown;
	repoRoot: string;
	evidenceRef: Set<string>;
}): FixtureEvaluation {
	const validation = validateFixture(options.fixture, {
		fixtureKeys: FIXTURE_KEYS,
		categories: DOCS_TASK_EVAL_CATEGORIES,
		severities: ["advisory", "required"],
	});
	const findings = [...validation.findings];
	if (validation.fixture) {
		findings.push(
			...collectRepositoryEvidenceFindings(
				validation.fixture,
				options.repoRoot,
				options.evidenceRef,
			),
		);
	}
	return {
		findings,
		result: buildFixtureResult(options.fixture, validation, findings),
	};
}

function collectRepositoryEvidenceFindings(
	fixture: DocsTaskEvalFixture,
	repoRoot: string,
	evidenceRef: Set<string>,
): DocsTaskEvalFinding[] {
	const findings = fixture.expected_sources.flatMap((source) =>
		collectSourceEvidenceFindings(fixture, repoRoot, source, evidenceRef),
	);
	for (const command of fixture.expected_validation) evidenceRef.add(command);
	return findings;
}

function collectSourceEvidenceFindings(
	fixture: DocsTaskEvalFixture,
	repoRoot: string,
	source: string,
	evidenceRef: Set<string>,
): DocsTaskEvalFinding[] {
	const sourceCheck = resolveRepoRelativePath(repoRoot, source);
	if (!sourceCheck.ok) {
		return [
			{
				id: `${fixture.id}.invalid-source-path`,
				fixture_id: fixture.id,
				severity: "required",
				kind: "configuration",
				message: sourceCheck.message,
				path: source,
				fix: "Use a repo-relative source path that stays inside the repository.",
			},
		];
	}
	evidenceRef.add(source);
	if (!existsSync(sourceCheck.absolutePath)) {
		return [
			{
				id: `${fixture.id}.missing-source`,
				fixture_id: fixture.id,
				severity: fixture.severity,
				kind: "repository-evidence",
				message: `Expected source path does not exist: ${source}`,
				path: source,
				fix: "Update the fixture to a current canonical source or restore the missing document.",
			},
		];
	}
	if (statSync(sourceCheck.absolutePath).isFile()) return [];
	return [
		{
			id: `${fixture.id}.invalid-source-file`,
			fixture_id: fixture.id,
			severity: fixture.severity,
			kind: "repository-evidence",
			message: `Expected source path is not a file: ${source}`,
			path: source,
			fix: "Point expected_sources at canonical files, not directories or placeholder paths.",
		},
	];
}

/** Render a compact human-readable report for the docs task eval CLI. */
export function formatDocsTaskEvalText(report: DocsTaskEvalReport): string {
	const lines = [
		"[docs-task-eval] status=" +
			report.status +
			" advisory_status=" +
			report.advisory_status,
		"[docs-task-eval] fixtures=" +
			report.summary.total +
			" passed=" +
			report.summary.passed +
			" failed=" +
			report.summary.failed +
			" advisory=" +
			report.summary.advisory +
			" required=" +
			report.summary.required,
	];
	for (const finding of report.findings) {
		lines.push(
			[
				"[docs-task-eval]",
				finding.severity,
				finding.kind,
				finding.fixture_id ?? finding.id,
				finding.path ?? "",
				finding.message,
				`Fix: ${finding.fix}`,
			]
				.filter(Boolean)
				.join(" "),
		);
	}
	return lines.join("\n");
}

function buildFixtureResult(
	candidate: unknown,
	validation: FixtureValidation,
	findings: DocsTaskEvalFinding[],
): DocsTaskEvalFixtureResult {
	const record =
		candidate && typeof candidate === "object" && !Array.isArray(candidate)
			? (candidate as Partial<DocsTaskEvalFixture>)
			: {};
	const status = findings.some((finding) => finding.severity === "required")
		? "fail"
		: "pass";
	return {
		id: typeof record.id === "string" ? record.id : "unknown-fixture",
		title: typeof record.title === "string" ? record.title : "Unknown fixture",
		category: validation.fixture?.category ?? "unknown",
		severity: validation.fixture?.severity ?? "unknown",
		status,
		acceptance_ids: validation.fixture?.acceptance_ids ?? [],
		findings: findings.map((finding) => finding.id),
		evidence_ref: validation.fixture
			? [
					...validation.fixture.expected_sources,
					...validation.fixture.expected_validation,
				].sort()
			: [],
	};
}

function summarize(results: DocsTaskEvalFixtureResult[]): DocsTaskEvalSummary {
	return {
		total: results.length,
		passed: results.filter((result) => result.status === "pass").length,
		failed: results.filter((result) => result.status === "fail").length,
		advisory: results.filter((result) => result.severity === "advisory").length,
		required: results.filter((result) => result.severity === "required").length,
	};
}

function dedupeFindings(
	findings: DocsTaskEvalFinding[],
): DocsTaskEvalFinding[] {
	const seen = new Set<string>();
	const deduped: DocsTaskEvalFinding[] = [];
	for (const finding of findings) {
		const key = [
			finding.id,
			finding.fixture_id ?? "",
			finding.path ?? "",
			finding.message,
		].join("\0");
		if (seen.has(key)) continue;
		seen.add(key);
		deduped.push(finding);
	}
	return deduped;
}

function resolveRepoRelativePath(
	repoRoot: string,
	sourcePath: string,
): { ok: true; absolutePath: string } | { ok: false; message: string } {
	if (isAbsolute(sourcePath)) {
		return {
			ok: false,
			message: `Expected source path must be repo-relative: ${sourcePath}`,
		};
	}
	const normalized = normalize(sourcePath);
	if (
		normalized === ".." ||
		normalized.startsWith(`..${sep}`) ||
		normalized.includes(`${sep}..${sep}`)
	) {
		return {
			ok: false,
			message: `Expected source path must stay inside the repository: ${sourcePath}`,
		};
	}
	return { ok: true, absolutePath: join(repoRoot, normalized) };
}
