import { collectWorkEvidenceIntegrityErrors } from "./pr-template-behavior-evidence.js";
import { collectLinkedIssueRelationshipErrors } from "./pr-template-linked-issue-relationship.js";
import {
	MAX_BODY_LENGTH,
	PLACEHOLDERS,
	ACCEPTANCE_TRACE_ID_PATTERN,
	LINKED_ISSUE_REFERENCE_PATTERN,
	PREPARATORY_LINKED_ISSUE_TRACE_PATTERN,
	REQUIRED_BEHAVIOR_PROOF_FIELDS,
	REQUIRED_MOTIVATION_FIELDS,
	REQUIRED_RELEASE_BOUNDARY_FIELDS,
	REQUIRED_SECTIONS,
	REQUIRED_TESTING_FIELDS,
	REQUIRED_WORK_FIELDS,
} from "./pr-template-validator-rules.js";

/**
 * Normalize a field value extracted from a PR template for reliable comparison.
 *
 * Strips surrounding fenced code blocks or single backtick inline code if present,
 * collapses all consecutive whitespace to single spaces, and trims leading/trailing whitespace.
 *
 * @param value - The raw field value possibly containing code fences, inline code, or extra whitespace
 * @returns The normalized field value suitable for comparison and placeholder checks
 */
function normalizeFieldValue(value: string): string {
	let normalized = value.trim();

	const fencedMatch = normalized.match(/^```[\w-]*\s*([\s\S]*?)\s*```$/);
	if (fencedMatch) {
		normalized = fencedMatch[1] ?? "";
	}

	const inlineCodeMatch = normalized.match(/^`([^`]+)`$/);
	if (inlineCodeMatch) {
		normalized = inlineCodeMatch[1] ?? "";
	}

	return normalized.replace(/\s+/g, " ").trim();
}
function normalizeFieldBlockValue(value: string): string {
	let normalized = value.trim();

	const fencedMatch = normalized.match(/^```[\w-]*\s*([\s\S]*?)\s*```$/);
	if (fencedMatch) {
		normalized = fencedMatch[1] ?? "";
	}

	const inlineCodeMatch = normalized.match(/^`([^`]+)`$/);
	if (inlineCodeMatch) {
		normalized = inlineCodeMatch[1] ?? "";
	}

	return normalized.trim();
}

const RELEASE_MODE_PATTERN = /^(?:Prototype|Portfolio|Product|Harness)$/i;
const NOT_APPLICABLE_RELEASE_MODE_PATTERN = /^n\.?a\.?\s+because\s+\S.+/i;
/** Extract the markdown content below a named PR-template heading. */
function extractSectionBody(body: string, heading: string): string | null {
	const escapedHeading = heading.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
	const pattern = new RegExp(
		`(?:^|\\n)${escapedHeading}[ \\t]*(?:\\r?\\n)([\\s\\S]*?)(?=\\r?\\n## |\\r?\\n# |$)`,
		"i",
	);
	const match = body.match(pattern);
	if (!match) {
		return null;
	}
	return match[1] ?? "";
}

/** Collect checklist checkbox status errors from the pull request body. */
function collectChecklistErrors(body: string): string[] {
	const checklistBody = extractSectionBody(body, "## Checklist");
	if (checklistBody === null) {
		return ["Missing checklist block."];
	}

	const checklistItems = checklistBody
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => /^- \[[ xX]\]/.test(line));

	const errors: string[] = [];
	if (checklistItems.length === 0) {
		errors.push("Checklist has no checkbox items.");
		return errors;
	}

	const unchecked = checklistItems.filter((line) => /^- \[ \]/.test(line));
	const unresolvedUnchecked = unchecked.filter(
		(line) => !/\*\*\((pending|n\/a|not applicable)\)\*\*/i.test(line),
	);
	if (unresolvedUnchecked.length > 0) {
		errors.push(
			`Checklist has unchecked item(s) without explicit status marker ((Pending) or (N/A)):\n${unresolvedUnchecked.join("\n")}`,
		);
	}

	return errors;
}

/** Collect unresolved template placeholder errors from the pull request body. */
function collectPlaceholderErrors(body: string): string[] {
	const errors: string[] = [];

	for (const placeholder of PLACEHOLDERS) {
		if (body.includes(placeholder)) {
			errors.push(`Replace template placeholder: ${placeholder}`);
		}
	}

	const reviewArtifactsBody = extractSectionBody(body, "## Review artifacts");
	if (reviewArtifactsBody !== null) {
		const unresolvedTokens = reviewArtifactsBody.match(/<[^>\n]+>/g) ?? [];
		for (const token of unresolvedTokens) {
			errors.push(`Replace unresolved placeholder token: ${token}`);
		}
	}

	return errors;
}

/** Collect missing required field values from a named pull request section. */
function collectFieldErrors(
	body: string,
	sectionHeading: string,
	fields: ReadonlyArray<{ label: string; placeholder: string }>,
	errorPrefix: string,
): string[] {
	const sectionBody = extractSectionBody(body, sectionHeading);
	if (sectionBody === null) {
		return [`Missing ${errorPrefix} block.`];
	}

	const errors: string[] = [];

	for (const field of fields) {
		const escapedLabel = field.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const pattern = new RegExp(`^-\\s*${escapedLabel}:\\s*(.+)$`, "im");
		const match = sectionBody.match(pattern);
		if (!match) {
			errors.push(`Missing required ${errorPrefix} field: ${field.label}`);
			continue;
		}

		const value = normalizeFieldValue(match[1] ?? "");
		const placeholder = normalizeFieldValue(field.placeholder);
		if (value.length === 0 || value === placeholder) {
			errors.push(`Replace ${errorPrefix} field placeholder: ${field.label}`);
		}
	}

	return errors;
}

function collectTestingFieldErrors(body: string): string[] {
	const errors = collectFieldErrors(
		body,
		"## Testing",
		REQUIRED_TESTING_FIELDS,
		"testing",
	);
	const testingBody = extractSectionBody(body, "## Testing");
	if (testingBody !== null) {
		errors.push(...collectCommandEvidenceErrors(testingBody));
	}
	return errors;
}

function collectBehaviorProofFieldErrors(body: string): string[] {
	return collectFieldErrors(
		body,
		"## Behavior Proof",
		REQUIRED_BEHAVIOR_PROOF_FIELDS,
		"behavior proof",
	);
}

/** Collect missing motivation fields from the pull request body. */
function collectMotivationFieldErrors(body: string): string[] {
	return collectFieldErrors(
		body,
		"## What Problem This Solves",
		REQUIRED_MOTIVATION_FIELDS,
		"motivation",
	);
}

/** Collect missing release-boundary fields from the pull request body. */
function collectReleaseBoundaryFieldErrors(body: string): string[] {
	const errors = collectFieldErrors(
		body,
		"## Release Boundary",
		REQUIRED_RELEASE_BOUNDARY_FIELDS,
		"release boundary",
	);
	const releaseMode = extractFieldBlockValue(
		body,
		"## Release Boundary",
		"Release mode",
	);
	if (releaseMode === null) {
		return errors;
	}

	const normalizedReleaseMode = normalizeFieldValue(releaseMode);
	if (
		!RELEASE_MODE_PATTERN.test(normalizedReleaseMode) &&
		!NOT_APPLICABLE_RELEASE_MODE_PATTERN.test(normalizedReleaseMode)
	) {
		errors.push(
			"Release mode must be Prototype, Portfolio, Product, Harness, or `n.a. because <reason>`.",
		);
	}

	return errors;
}

/**
 * Validate required fields inside the "Work performed" section and collect any related errors.
 *
 * @param body - The full pull request body text to inspect
 * @returns An array of error messages describing missing or invalid required fields in the "Work performed" section; empty if no errors
 */
function collectWorkPerformedFieldErrors(body: string): string[] {
	return collectFieldErrors(
		body,
		"## Work performed",
		REQUIRED_WORK_FIELDS,
		"work performed",
	);
}

/** Collect acceptance-trace errors when linked issue references are present. */
function collectLinkedIssueAcceptanceTraceErrors(body: string): string[] {
	const planIds = extractFieldBlockValue(body, "## Work performed", "Plan IDs");
	if (planIds === null || !LINKED_ISSUE_REFERENCE_PATTERN.test(planIds)) {
		return [];
	}

	const acceptanceTrace = extractFieldBlockValue(
		body,
		"## Work performed",
		"Acceptance trace",
	);
	if (acceptanceTrace === null) {
		return [];
	}

	const issueKeys = Array.from(
		new Set(
			(planIds.match(/\bJSC-\d+\b/gi) ?? []).map((issueKey) =>
				issueKey.toUpperCase(),
			),
		),
	);
	if (traceCoversEveryLinkedIssue(issueKeys, acceptanceTrace)) {
		return [];
	}

	const issueKeyList = issueKeys.join(", ");
	return [
		`Acceptance trace for linked issue ${issueKeyList} must list specific acceptance IDs (for example SA-001 or AC-001) or explicitly state the preparatory/enabling relationship, that this PR does not complete the issue acceptance criteria, and that completed issue acceptance IDs are none. When multiple linked issues are listed, each issue key must appear in the Acceptance trace with completed acceptance IDs or an explicit no-completion classification.`,
	];
}

function traceCoversEveryLinkedIssue(
	issueKeys: string[],
	acceptanceTrace: string,
): boolean {
	return issueKeys.every((issueKey) => {
		const escapedIssueKey = issueKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const issueKeyPattern = new RegExp(`\\b${escapedIssueKey}\\b`, "i");
		if (!issueKeyPattern.test(acceptanceTrace)) {
			return false;
		}

		const segmentPattern = new RegExp(
			`\\b${escapedIssueKey}\\b([\\s\\S]*?)(?=\\bJSC-\\d+\\b|$)`,
			"i",
		);
		const segment = acceptanceTrace.match(segmentPattern)?.[0] ?? "";
		return (
			ACCEPTANCE_TRACE_ID_PATTERN.test(segment) ||
			issueHasPreparatoryNoCompletionTrace(issueKey, acceptanceTrace)
		);
	});
}

function issueHasPreparatoryNoCompletionTrace(
	issueKey: string,
	acceptanceTrace: string,
): boolean {
	const escapedIssueKey = issueKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const issueScopedNoCompletionPattern = new RegExp(
		`\\bcompleted\\s+${escapedIssueKey}\\s+acceptance\\s+IDs?\\s*:\\s*none\\b`,
		"i",
	);
	return (
		PREPARATORY_LINKED_ISSUE_TRACE_PATTERN.test(acceptanceTrace) &&
		issueScopedNoCompletionPattern.test(acceptanceTrace)
	);
}

function extractFieldBlockValue(
	body: string,
	sectionHeading: string,
	label: string,
): string | null {
	const sectionBody = extractSectionBody(body, sectionHeading);
	if (sectionBody === null) {
		return null;
	}

	const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const pattern = new RegExp(
		`^-\\s*${escapedLabel}:\\s*([\\s\\S]*?)(?=\\r?\\n-\\s*[A-Za-z][^\\n:]{0,80}:|\\r?\\n##\\s|(?![\\s\\S]))`,
		"im",
	);
	const match = sectionBody.match(pattern);
	return match ? normalizeFieldBlockValue(match[1] ?? "") : null;
}

/**
 * Validates the `- Command:` evidence lines within a Testing section.
 *
 * @param testingBody - The markdown content of the `## Testing` section to inspect
 * @returns An array of error messages describing formatting violations; empty if all command evidence lines conform to the required patterns
 */
function collectCommandEvidenceErrors(testingBody: string): string[] {
	const commandLines = testingBody
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => /^-\s*Command:\s*/i.test(line));
	const errors: string[] = [];

	if (commandLines.length === 0) {
		return ["Testing section must include at least one Command evidence line."];
	}

	const commandEvidencePattern =
		/^-\s*Command:\s*(?:`[^\n`]+`|[^\n`]+?)\s*->\s*(?:`?(?:pass|fail)`?|`?(?:n\.a\.|n\/a)`?(?:\s*\([^)]+\))?|`?blocked`?\s*\([^)]+\))\s*$/i;
	for (const line of commandLines) {
		if (!commandEvidencePattern.test(line)) {
			errors.push(
				`Command evidence must use \`Command: <exact command> -> pass|fail\`, \`-> n.a.|n/a\` (optional reason), or \`-> blocked (<required reason>)\` format: ${line}`,
			);
		}
	}

	return errors;
}

/**
 * Validate a pull request body against the repository's PR template and formatting rules.
 *
 * Performs high-level checks including required section presence, required fields in
 * "Work performed" and "Testing", checklist validation, placeholder detection, and
 * evidence-format rules for meta-behavior, pattern scope, and repeated-error research.
 *
 * @returns An array of error messages describing template or formatting violations; an empty array if no issues are found.
 */
export function validatePrTemplateBody(body: string): string[] {
	const errors: string[] = [];
	if (body.length > MAX_BODY_LENGTH) {
		errors.push(
			`PR body exceeds maximum length of ${MAX_BODY_LENGTH} characters.`,
		);
		return errors;
	}
	if (body.trim().length === 0) {
		errors.push("PR body is empty. Fill out the full PR template.");
		return errors;
	}

	for (const section of REQUIRED_SECTIONS) {
		if (extractSectionBody(body, section) === null) {
			errors.push(`Missing required section: ${section}`);
		}
	}

	errors.push(...collectMotivationFieldErrors(body));
	errors.push(...collectReleaseBoundaryFieldErrors(body));
	errors.push(...collectWorkPerformedFieldErrors(body));
	errors.push(
		...collectLinkedIssueRelationshipErrors(body, extractFieldBlockValue),
	);
	errors.push(...collectLinkedIssueAcceptanceTraceErrors(body));
	errors.push(
		...collectWorkEvidenceIntegrityErrors(body, extractFieldBlockValue),
	);
	errors.push(...collectChecklistErrors(body));
	errors.push(...collectBehaviorProofFieldErrors(body));
	errors.push(...collectTestingFieldErrors(body));
	errors.push(...collectPlaceholderErrors(body));

	return errors;
}
