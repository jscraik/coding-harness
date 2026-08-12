import {
	CANDIDATE_FIX_PATTERN,
	CONCRETE_DURABLE_REFERENCE_PATTERN,
	DURABLE_META_DESTINATION_PATTERN,
	NO_SYSTEM_CHANGE_EVIDENCE_PATTERN,
	PATTERN_SCOPE_EVIDENCE_PATTERNS,
	PATTERN_SCOPE_SIGNAL_PATTERN,
	REPEATED_ERROR_RESEARCH_EVIDENCE_PATTERNS,
	REPEATED_ERROR_RESEARCH_SIGNAL_PATTERN,
	CONDITIONAL_EVIDENCE_FIELDS,
	REQUIRED_CHANGE_FIELDS,
	STEERING_SIGNAL_PATTERN,
} from "./pr-template-validator-rules.js";
import { validateDurableEvidenceMap } from "./evidence-reference/evidence-reference.js";

const LOCAL_ABSOLUTE_PATH_PATTERN =
	/(?:^|[\s\x60"'(])((?:\/Users\/|\/private\/var\/folders\/|\/var\/folders\/|\/private\/tmp\/|\/tmp\/)[^\s\x60"'<>),;]+)/g;
const NEGATED_SHARED_THRESHOLD_PATTERN =
	/\b(?:no|not|without)\s+(?:(?:recurrence|failure)\s+across independent (?:tasks|work)|(?:a\s+)?safety boundary(?:\s+(?:is|was|has been))?\s+(?:crossed|required|implicated|violated)|(?:a\s+)?(?:current|existing) contract\s+(?:conflict|contradiction))/i;
const NEGATED_PATTERN_SCOPE_SIGNAL_PATTERN =
	/\b(?:no|not|without)\s+(?:a\s+)?pattern[- ]generalization(?:\s+pass)?\s+is\s+(?:not\s+)?required\b[\s\S]{0,220}\b(?:local|below (?:the )?shared threshold|threshold not met)\b/i;
const LOCAL_REPEATED_ERROR_PATTERN =
	/\bsame (?:error|failure|command|stack trace|exception)\b[\s\S]{0,120}\btwice\b[\s\S]{0,120}\b(?:bounded|local|one[- ]off|isolated)\b/i;

const NO_SYSTEM_CHANGE_PROSE_EVIDENCE_PATTERNS = [
	/(?:\breason\b|\bbecause\b)[^;\n.]*(?:local|bounded|one[- ]off|no shared|no durable)/i,
	/(?:\bchecked scope\b|\bscope (?:was|checked|reviewed)\b|\b(?:touched|reviewed|searched) (?:file|fixture|module|scope))/i,
	/(?:no[- ]durable[- ]destination\b[^;\n.]*(?:close|local|none|not)|(?:close|keep|handled)\s+(?:this|it)\s+locally|no durable destination)/i,
] as const;

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

/** Count numbered Candidate/Fix/Option entries in a research field. */
function countCandidateFixes(value: string): number {
	return Array.from(value.matchAll(CANDIDATE_FIX_PATTERN)).length;
}

/** Check whether a research field contains the required option evidence. */
function hasRepeatedErrorResearchEvidence(value: string | null): boolean {
	if (value === null) {
		return false;
	}
	return (
		REPEATED_ERROR_RESEARCH_EVIDENCE_PATTERNS.every((pattern) =>
			pattern.test(value),
		) &&
		countCandidateFixes(value) >= 3 &&
		countCandidateFixes(value) <= 5
	);
}

/** Require explicit local-closeout facts when a repeat stays below threshold. */
function collectLocalRepeatedErrorErrors(
	bodyWithoutResearchField: string,
	research: string | null,
): string[] {
	if (!LOCAL_REPEATED_ERROR_PATTERN.test(bodyWithoutResearchField)) {
		return [];
	}
	if (hasRepeatedErrorResearchEvidence(research)) {
		return [];
	}
	if (research !== null && hasNoSystemChangeEvidence(research)) {
		return [];
	}
	return [
		"Repeated-error research for an isolated local repeat must include a reason, checked scope, and no-durable-destination decision when no research pass is required.",
	];
}

/** Check whether a local no-system-change record carries substantive evidence. */
function hasNoSystemChangeEvidence(value: string): boolean {
	return (
		NO_SYSTEM_CHANGE_EVIDENCE_PATTERN.test(value) ||
		NO_SYSTEM_CHANGE_PROSE_EVIDENCE_PATTERNS.every((pattern) =>
			pattern.test(value),
		)
	);
}

/** Collect durable-evidence-map validation errors from change-detail fields. */
function collectDurableEvidenceMapErrors(
	body: string,
	readFieldValue: PrTemplateFieldReader,
): string[] {
	const durableEvidenceMap = readFieldValue(
		body,
		"## Change details",
		"Durable evidence map",
	);
	const reviewArtifacts = readFieldValue(
		body,
		"## Change details",
		"Review artifacts",
	);
	const evidenceText = [
		...REQUIRED_CHANGE_FIELDS,
		...CONDITIONAL_EVIDENCE_FIELDS,
	]
		.filter((field) => field.label !== "Durable evidence map")
		.map((field) => readFieldValue(body, "## Change details", field.label))
		.filter((field): field is string => field !== null)
		.join("\n");

	return validateDurableEvidenceMap({
		durableEvidenceMap,
		evidenceText,
		reviewArtifacts,
	}).errors;
}

/** Collect meta-behavior evidence errors when the PR admits steering feedback. */
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
		"## Change details",
		"Meta-behavior proof",
	);
	const learning = readFieldValue(
		body,
		"## Change details",
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

/**
 * Enforces pattern-scope evidence when a PR crosses the shared threshold and
 * requires an auditable local no-system-change record otherwise.
 *
 * @param body - Complete pull-request body text.
 * @param readFieldValue - Reader for structured change-detail fields.
 * @returns Validation errors for missing or incomplete pattern evidence.
 */
function collectPatternScopeInventoryErrors(
	body: string,
	readFieldValue: PrTemplateFieldReader,
): string[] {
	const bodyWithoutInventoryField = body
		.split(/\r?\n/)
		.filter((line) => !/^-\s*Pattern scope inventory:/i.test(line))
		.join("\n");

	const inventory = readFieldValue(
		body,
		"## Change details",
		"Pattern scope inventory",
	);
	const inventoryIsNotApplicable =
		inventory !== null &&
		/^\s*(?:n\.\s*a\.?|n\/a|not applicable)\b/i.test(inventory);

	const hasPatternScopeSignal = PATTERN_SCOPE_SIGNAL_PATTERN.test(
		bodyWithoutInventoryField,
	);
	const bodyWithoutNegatedPatternScopeSignal =
		bodyWithoutInventoryField.replace(
			new RegExp(NEGATED_PATTERN_SCOPE_SIGNAL_PATTERN.source, "gi"),
			"",
		);
	const hasAffirmativePatternScopeSignal = PATTERN_SCOPE_SIGNAL_PATTERN.test(
		bodyWithoutNegatedPatternScopeSignal,
	);

	if (!hasPatternScopeSignal || !hasAffirmativePatternScopeSignal) {
		if (inventoryIsNotApplicable && !hasNoSystemChangeEvidence(inventory)) {
			return [
				"Pattern scope inventory marked n.a. must include a reason, checked scope, and no-durable-destination decision for the local closeout.",
			];
		}
		return [];
	}

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

/**
 * Enforces research evidence only when recurrence, contract contradiction, or
 * a safety boundary crosses the shared troubleshooting threshold.
 *
 * @param body - Complete pull-request body text.
 * @param readFieldValue - Reader for structured change-detail fields.
 * @returns Validation errors for missing or incomplete threshold evidence.
 */
function collectRepeatedErrorResearchErrors(
	body: string,
	readFieldValue: PrTemplateFieldReader,
): string[] {
	const bodyWithoutResearchField = body
		.split(/\r?\n/)
		.filter((line) => !/^-\s*Repeated-error research:/i.test(line))
		.join("\n");

	const hasResearchSignal = REPEATED_ERROR_RESEARCH_SIGNAL_PATTERN.test(
		bodyWithoutResearchField,
	);
	const hasNegatedThreshold = NEGATED_SHARED_THRESHOLD_PATTERN.test(
		bodyWithoutResearchField,
	);
	const bodyWithoutNegatedThreshold = bodyWithoutResearchField.replace(
		new RegExp(NEGATED_SHARED_THRESHOLD_PATTERN.source, "gi"),
		"",
	);
	const hasAffirmativeThreshold = REPEATED_ERROR_RESEARCH_SIGNAL_PATTERN.test(
		bodyWithoutNegatedThreshold,
	);
	const research = readFieldValue(
		body,
		"## Change details",
		"Repeated-error research",
	);

	if (!hasResearchSignal) {
		return collectLocalRepeatedErrorErrors(bodyWithoutResearchField, research);
	}

	if (hasNegatedThreshold && !hasAffirmativeThreshold) {
		return [];
	}

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
			"Repeated-error research must include Source, 3-5 numbered Candidate/Fix/Option entries, Chosen, and Implemented evidence when PR text admits recurrence across independent work, a contradictory contract, or a safety boundary.",
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
