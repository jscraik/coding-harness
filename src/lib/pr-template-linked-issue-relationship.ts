import {
	ACCEPTANCE_TRACE_ID_PATTERN,
	PREPARATORY_NO_ACCEPTANCE_COMPLETION_PATTERN,
} from "./pr-template-validator-rules.js";

type FieldValueExtractor = (
	body: string,
	sectionHeading: string,
	label: string,
) => string | null;

type LinkedIssueRelationship =
	| "implementation"
	| "preparatory"
	| "standalone"
	| "na"
	| "unknown";

/**
 * Validate Linear references and linked-issue relationship classification.
 *
 * @param body - The full pull request body text to inspect
 * @param extractFieldBlockValue - Field extractor shared with the PR body validator
 * @returns Linked issue relationship validation errors, or an empty array
 */
export function collectLinkedIssueRelationshipErrors(
	body: string,
	extractFieldBlockValue: FieldValueExtractor,
): string[] {
	const errors: string[] = [];
	const linearReference = extractFieldBlockValue(
		body,
		"## Work performed",
		"Linear reference",
	);
	const linkedIssueRelationship = extractFieldBlockValue(
		body,
		"## Work performed",
		"Linked issue relationship",
	);

	if (linearReference !== null && !isValidLinearReference(linearReference)) {
		errors.push(
			"Linear reference must use Refs, Fixes, or Closes with a Linear issue key, or n.a. with reason; URL-only references do not satisfy linear-gate.",
		);
	}

	if (linkedIssueRelationship === null) {
		return errors;
	}

	const relationship = classifyLinkedIssueRelationship(linkedIssueRelationship);
	if (relationship === "unknown") {
		errors.push(
			"Linked issue relationship must classify the PR as implementation closure, preparatory/enabling work, standalone/untracked work, or n.a. with reason.",
		);
		return errors;
	}

	if (
		relationship === "preparatory" &&
		!hasPreparatoryNoClosureEvidence(linkedIssueRelationship)
	) {
		errors.push(
			"Preparatory/enabling linked issue relationship must state completed acceptance IDs are none or explicitly say it does not close the linked acceptance scope.",
		);
	}

	if (
		linearReference !== null &&
		usesClosureLinearReference(linearReference) &&
		!(
			relationship === "implementation" &&
			hasCompletedAcceptanceIds(linkedIssueRelationship)
		)
	) {
		errors.push(
			"Linear reference uses a closure token, so Linked issue relationship must be implementation closure with completed acceptance IDs; use Refs for preparatory/enabling or standalone work.",
		);
	}

	return errors;
}

function isValidLinearReference(value: string): boolean {
	return (
		hasNaWithReason(value) ||
		/\b(?:Refs?|Fix(?:es)?|Closes?)\s+JSC-\d+\b/i.test(value)
	);
}

function usesClosureLinearReference(value: string): boolean {
	return /\b(?:Fix(?:es)?|Closes?)\s+JSC-\d+\b/i.test(value);
}

function classifyLinkedIssueRelationship(
	value: string,
): LinkedIssueRelationship {
	if (/\bimplementation\s+closure\b/i.test(value)) {
		return "implementation";
	}
	if (/\b(?:preparatory|enabling)\b/i.test(value)) {
		return "preparatory";
	}
	if (/\b(?:standalone|untracked)\b/i.test(value)) {
		return "standalone";
	}
	if (hasNaWithReason(value)) {
		return "na";
	}
	return "unknown";
}

function hasNaWithReason(value: string): boolean {
	return /\b(?:n\.a\.|n\/a|not applicable)\b.{6,}/i.test(value);
}

function hasPreparatoryNoClosureEvidence(value: string): boolean {
	return (
		PREPARATORY_NO_ACCEPTANCE_COMPLETION_PATTERN.test(value) ||
		/\bdoes\s+not\s+(?:close|complete)\b[\s\S]{0,120}\b(?:acceptance|scope|issue|JSC-\d+)\b/i.test(
			value,
		)
	);
}

function hasCompletedAcceptanceIds(value: string): boolean {
	const completedAcceptanceMatch = value.match(
		/\bcompleted\s+(?:JSC-\d+\s+)?(?:acceptance\s+)?IDs?\s*:\s*([^.;\n]+)/i,
	);
	if (!completedAcceptanceMatch) {
		return false;
	}

	const completedAcceptanceValue = completedAcceptanceMatch[1] ?? "";
	return (
		ACCEPTANCE_TRACE_ID_PATTERN.test(completedAcceptanceValue) &&
		!/\b(?:none|n\.a\.|n\/a)\b/i.test(completedAcceptanceValue)
	);
}
