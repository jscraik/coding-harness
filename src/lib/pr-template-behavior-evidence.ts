import {
	CANDIDATE_FIX_PATTERN,
	CONCRETE_DURABLE_REFERENCE_PATTERN,
	DURABLE_META_DESTINATION_PATTERN,
	PATTERN_SCOPE_EVIDENCE_PATTERNS,
	PATTERN_SCOPE_SIGNAL_PATTERN,
	REPEATED_ERROR_RESEARCH_EVIDENCE_PATTERNS,
	REPEATED_ERROR_RESEARCH_SIGNAL_PATTERN,
	REQUIRED_WORK_FIELDS,
	STEERING_SIGNAL_PATTERN,
} from "./pr-template-validator-rules.js";
import { validateDurableEvidenceMap } from "./evidence-reference/evidence-reference.js";

const LOCAL_ABSOLUTE_PATH_PATTERN =
	/(?:^|[\s\x60"'(])((?:\/Users\/|\/private\/var\/folders\/|\/var\/folders\/|\/private\/tmp\/|\/tmp\/)[^\s\x60"'<>),;]+)/g;

/**
 * Reads a normalized field value from a markdown section in a PR body.
 */
export type PrTemplateFieldReader = (
	body: string,
	sectionHeading: string,
	label: string,
) => string | null;

function hasDurableEvidenceReference(value: string | null): boolean {
	return (
		value !== null &&
		DURABLE_META_DESTINATION_PATTERN.test(value) &&
		CONCRETE_DURABLE_REFERENCE_PATTERN.test(value)
	);
}

function countCandidateFixes(value: string): number {
	return Array.from(value.matchAll(CANDIDATE_FIX_PATTERN)).length;
}

function collectDurableEvidenceMapErrors(
	body: string,
	readFieldValue: PrTemplateFieldReader,
): string[] {
	const durableEvidenceMap = readFieldValue(
		body,
		"## Work performed",
		"Durable evidence map",
	);
	const reviewArtifacts = readFieldValue(
		body,
		"## Work performed",
		"Review artifacts",
	);
	const evidenceText = REQUIRED_WORK_FIELDS.filter(
		(field) => field.label !== "Durable evidence map",
	)
		.map((field) => readFieldValue(body, "## Work performed", field.label))
		.filter((field): field is string => field !== null)
		.join("\n");

	return validateDurableEvidenceMap({
		durableEvidenceMap,
		evidenceText,
		reviewArtifacts,
	}).errors;
}

function collectMetaBehaviorErrors(
	body: string,
	readFieldValue: PrTemplateFieldReader,
): string[] {
	const bodyWithoutMetaFields = body
		.split(/\r?\n/)
		.filter(
			(line) =>
				!/^[\s]*-[\s]*(Meta-behavior proof|Learning \/ reinforcement):/i.test(
					line,
				),
		)
		.join("\n");

	if (!STEERING_SIGNAL_PATTERN.test(bodyWithoutMetaFields)) {
		return [];
	}

	const errors: string[] = [];
	const metaProof = readFieldValue(
		body,
		"## Work performed",
		"Meta-behavior proof",
	);
	const learning = readFieldValue(
		body,
		"## Work performed",
		"Learning / reinforcement",
	);

	if (!hasDurableEvidenceReference(metaProof)) {
		errors.push(
			"Meta-behavior proof must name a durable destination and concrete repo path, command, or issue ID when PR text admits steering feedback or repeated user correction.",
		);
	}
	if (!hasDurableEvidenceReference(learning)) {
		errors.push(
			"Learning / reinforcement must name the promoted learning, memory update, guard, or tracked exception with a concrete repo path, command, or issue ID when PR text admits steering feedback or repeated user correction.",
		);
	}

	return errors;
}

function collectPatternScopeInventoryErrors(
	body: string,
	readFieldValue: PrTemplateFieldReader,
): string[] {
	const bodyWithoutInventoryField = body
		.split(/\r?\n/)
		.filter((line) => !/^-\s*Pattern scope inventory:/i.test(line))
		.join("\n");

	if (!PATTERN_SCOPE_SIGNAL_PATTERN.test(bodyWithoutInventoryField)) {
		return [];
	}

	const inventory = readFieldValue(
		body,
		"## Work performed",
		"Pattern scope inventory",
	);
	if (
		inventory === null ||
		!PATTERN_SCOPE_EVIDENCE_PATTERNS.every((pattern) => pattern.test(inventory))
	) {
		return [
			"Pattern scope inventory must name the inferred principle, sibling patterns searched, siblings changed, and siblings intentionally unchanged with reasons when PR text admits line-level or design-pattern correction.",
		];
	}

	return [];
}

function collectRepeatedErrorResearchErrors(
	body: string,
	readFieldValue: PrTemplateFieldReader,
): string[] {
	const bodyWithoutResearchField = body
		.split(/\r?\n/)
		.filter((line) => !/^-\s*Repeated-error research:/i.test(line))
		.join("\n");

	if (!REPEATED_ERROR_RESEARCH_SIGNAL_PATTERN.test(bodyWithoutResearchField)) {
		return [];
	}

	const research = readFieldValue(
		body,
		"## Work performed",
		"Repeated-error research",
	);
	const candidateCount = research !== null ? countCandidateFixes(research) : 0;
	if (
		research === null ||
		!REPEATED_ERROR_RESEARCH_EVIDENCE_PATTERNS.every((pattern) =>
			pattern.test(research),
		) ||
		candidateCount < 3 ||
		candidateCount > 5
	) {
		return [
			"Repeated-error research must include Source, 3-5 numbered Candidate/Fix/Option entries, Chosen, and Implemented evidence when PR text admits the same error happened twice.",
		];
	}

	return [];
}

function collectLocalAbsolutePathErrors(body: string): string[] {
	const localPaths = Array.from(
		new Set(
			Array.from(body.matchAll(LOCAL_ABSOLUTE_PATH_PATTERN), (match) =>
				(match[1] ?? "").replace(/[.,;:]+$/g, ""),
			).filter((path) => path.length > 0),
		),
	);

	return localPaths.map(
		(path) =>
			"Replace local absolute path in PR body with a repo-relative path, PR comment, CI artifact URL, runtime-card ref, or tracked receipt: " +
			path,
	);
}

/**
 * Collect evidence-integrity errors that make PR bodies weak for future agents.
 *
 * @param body - Pull request body markdown.
 * @param readFieldValue - Field reader supplied by the template parser.
 * @returns Durable evidence, meta-behavior, repeated-error, pattern-scope, and local-path errors.
 */
export function collectWorkEvidenceIntegrityErrors(
	body: string,
	readFieldValue: PrTemplateFieldReader,
): string[] {
	return [
		...collectDurableEvidenceMapErrors(body, readFieldValue),
		...collectMetaBehaviorErrors(body, readFieldValue),
		...collectPatternScopeInventoryErrors(body, readFieldValue),
		...collectRepeatedErrorResearchErrors(body, readFieldValue),
		...collectLocalAbsolutePathErrors(body),
	];
}
