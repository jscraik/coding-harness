import type {
	DocsTaskEvalCategory,
	DocsTaskEvalFinding,
	DocsTaskEvalFixture,
	DocsTaskEvalSeverity,
} from "./docs-task-eval-contract.js";

/** Contract inputs used to validate docs-task eval fixtures. */
export type FixtureValidationContract = {
	fixtureKeys: ReadonlySet<string>;
	categories: readonly DocsTaskEvalCategory[];
	severities: readonly DocsTaskEvalSeverity[];
};

/** Result of validating one docs-task eval fixture before repo evidence checks. */
export type FixtureValidation = {
	fixture?: DocsTaskEvalFixture;
	findings: DocsTaskEvalFinding[];
};

const KEBAB_CASE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Validate one docs-task fixture without reading repository state. */
export function validateFixture(
	candidate: unknown,
	contract: FixtureValidationContract,
	index?: number,
): FixtureValidation {
	if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
		return {
			findings: [
				{
					id: "fixture.invalid-object",
					severity: "required",
					kind: "configuration",
					message: "Fixture must be an object.",
					fix: "Define each fixture as an object with the required reader-task fields.",
				},
			],
		};
	}
	const record = candidate as Record<string, unknown>;
	const fixtureId =
		typeof record.id === "string" ? record.id : `unknown-fixture-${index ?? 0}`;
	const findings = [
		...collectUnknownFieldFindings(record, fixtureId, contract.fixtureKeys),
		...collectRequiredShapeFindings(record, fixtureId),
		...collectIdFindings(record, fixtureId),
		...collectCategoryFindingsForFixture(
			record,
			fixtureId,
			contract.categories,
		),
		...collectSeverityFindings(record, fixtureId, contract.severities),
		...collectNotesFindings(record, fixtureId),
	];
	if (findings.length > 0) return { findings };
	return {
		fixture: record as DocsTaskEvalFixture,
		findings,
	};
}

/** Report missing required fixture categories across an eval fixture set. */
export function collectMissingCategoryFindings(
	fixtures: readonly unknown[],
	categories: readonly DocsTaskEvalCategory[],
): DocsTaskEvalFinding[] {
	const seen = new Set<string>();
	for (const fixture of fixtures) {
		if (!fixture || typeof fixture !== "object" || Array.isArray(fixture)) {
			continue;
		}
		const category = (fixture as Record<string, unknown>).category;
		if (typeof category === "string") seen.add(category);
	}
	return categories
		.filter((category) => !seen.has(category))
		.map((category) => ({
			id: `missing-category.${category}`,
			severity: "required",
			kind: "category-coverage",
			message: `Required fixture category is missing: ${category}`,
			fix: "Add at least one deterministic fixture for every required category.",
		}));
}

function collectUnknownFieldFindings(
	record: Record<string, unknown>,
	fixtureId: string,
	fixtureKeys: ReadonlySet<string>,
): DocsTaskEvalFinding[] {
	return Object.keys(record)
		.filter((key) => !fixtureKeys.has(key))
		.map((key) => ({
			id: `${fixtureId}.unknown-field.${key}`,
			fixture_id: fixtureId,
			severity: "required",
			kind: "configuration",
			message: `Fixture contains unsupported field: ${key}`,
			fix: "Remove the field or intentionally add it to the fixture contract with tests.",
		}));
}

function collectRequiredShapeFindings(
	record: Record<string, unknown>,
	fixtureId: string,
): DocsTaskEvalFinding[] {
	const requiredStringFields = [
		"id",
		"title",
		"prompt",
		"expected_stop_condition",
	] as const;
	const arrayFields = [
		"expected_sources",
		"expected_validation",
		"forbidden_claims",
		"acceptance_ids",
	] as const;
	return [
		...requiredStringFields
			.filter((field) => !nonEmptyString(record[field]))
			.map((field) => requiredFieldFinding(fixtureId, field)),
		...arrayFields
			.filter((field) => !nonEmptyStringArray(record[field]))
			.map((field) => requiredFieldFinding(fixtureId, field)),
	];
}

function collectIdFindings(
	record: Record<string, unknown>,
	fixtureId: string,
): DocsTaskEvalFinding[] {
	if (typeof record.id !== "string" || KEBAB_CASE_PATTERN.test(record.id)) {
		return [];
	}
	return [
		{
			id: `${fixtureId}.invalid-id`,
			fixture_id: fixtureId,
			severity: "required",
			kind: "configuration",
			message: "Fixture id must be stable kebab-case.",
			fix: "Use lowercase words separated by hyphens.",
		},
	];
}

function collectCategoryFindingsForFixture(
	record: Record<string, unknown>,
	fixtureId: string,
	categories: readonly DocsTaskEvalCategory[],
): DocsTaskEvalFinding[] {
	if (
		typeof record.category === "string" &&
		new Set<string>(categories).has(record.category)
	) {
		return [];
	}
	return [
		{
			id: `${fixtureId}.invalid-category`,
			fixture_id: fixtureId,
			severity: "required",
			kind: "configuration",
			message: "Fixture category is missing or unsupported.",
			fix: `Use one of: ${categories.join(", ")}.`,
		},
	];
}

function collectSeverityFindings(
	record: Record<string, unknown>,
	fixtureId: string,
	severities: readonly DocsTaskEvalSeverity[],
): DocsTaskEvalFinding[] {
	if (
		typeof record.severity === "string" &&
		new Set<string>(severities).has(record.severity)
	) {
		return [];
	}
	return [
		{
			id: `${fixtureId}.invalid-severity`,
			fixture_id: fixtureId,
			severity: "required",
			kind: "configuration",
			message: "Fixture severity is missing or unsupported.",
			fix: "Use advisory or required.",
		},
	];
}

function collectNotesFindings(
	record: Record<string, unknown>,
	fixtureId: string,
): DocsTaskEvalFinding[] {
	if (record.notes === undefined || typeof record.notes === "string") {
		return [];
	}
	return [
		{
			id: `${fixtureId}.invalid-notes`,
			fixture_id: fixtureId,
			severity: "required",
			kind: "configuration",
			message: "Fixture notes must be a string when present.",
			fix: "Remove notes or provide a short string.",
		},
	];
}

function requiredFieldFinding(
	fixtureId: string,
	field: string,
): DocsTaskEvalFinding {
	return {
		id: `${fixtureId}.missing-${field}`,
		fixture_id: fixtureId,
		severity: "required",
		kind: "configuration",
		message: `Fixture is missing required field: ${field}`,
		fix: `Add a non-empty ${field} value to the fixture.`,
	};
}

function nonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function nonEmptyStringArray(value: unknown): value is string[] {
	return (
		Array.isArray(value) &&
		value.length > 0 &&
		value.every((item) => nonEmptyString(item))
	);
}
