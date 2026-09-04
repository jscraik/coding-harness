import {
	ACCEPTANCE_TRACE_ID_PATTERN,
	PREPARATORY_NO_ACCEPTANCE_COMPLETION_PATTERN,
} from "./pr-template-validator-rules.js";
import { isAllowedLinearIssueKey } from "./linear/utils.js";

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
	allowedPrefixes?: readonly string[],
): string[] {
	const errors: string[] = [];
	const linearReference = extractFieldBlockValue(
		body,
		"## Change details",
		"Linear reference",
	);
	const linkedIssueRelationship = extractFieldBlockValue(
		body,
		"## Change details",
		"Linked issue relationship",
	);

	if (
		linearReference !== null &&
		!isValidLinearReference(linearReference, allowedPrefixes)
	) {
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
		usesClosureLinearReference(linearReference, allowedPrefixes) &&
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

/** Validate a PR template Linear reference against configured teams. */
function isValidLinearReference(
	value: string,
	allowedPrefixes?: readonly string[],
): boolean {
	const pattern = /\b(?:Refs?|Fix(?:es)?|Closes?)\s+([A-Z][A-Z0-9]*-\d+)\b/giu;
	return (
		hasNaWithReason(value) ||
		Array.from(value.matchAll(pattern)).some((match) =>
			isAllowedLinearIssueKey(match[1] ?? "", allowedPrefixes),
		)
	);
}

/** Return whether a configured Linear reference uses a closure verb. */
function usesClosureLinearReference(
	value: string,
	allowedPrefixes?: readonly string[],
): boolean {
	const pattern = /\b(?:Fix(?:es)?|Closes?)\s+([A-Z][A-Z0-9]*-\d+)\b/giu;
	return Array.from(value.matchAll(pattern)).some((match) =>
		isAllowedLinearIssueKey(match[1] ?? "", allowedPrefixes),
	);
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

/** Check that preparatory work explicitly disclaims acceptance completion. */
function hasPreparatoryNoClosureEvidence(value: string): boolean {
	return (
		PREPARATORY_NO_ACCEPTANCE_COMPLETION_PATTERN.test(value) ||
		/\bdoes\s+not\s+(?:close|complete)\b[\s\S]{0,120}\b(?:acceptance|scope|issue|[A-Z][A-Z0-9]*-\d+)\b/i.test(
			value,
		)
	);
}

/** Check that a closure relationship names completed acceptance IDs. */
function hasCompletedAcceptanceIds(value: string): boolean {
	const completedAcceptanceMatch = value.match(
		/\bcompleted\s+(?:[A-Z][A-Z0-9]*-\d+\s+)?(?:acceptance\s+)?IDs?\s*:\s*([^.;\n]+)/i,
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
