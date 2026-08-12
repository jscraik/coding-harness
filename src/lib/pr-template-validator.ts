import { collectWorkEvidenceIntegrityErrors } from "./pr-template-behavior-evidence.js";
import { collectLinkedIssueRelationshipErrors } from "./pr-template-linked-issue-relationship.js";
import { extractLinearIssueKeys } from "./linear/utils.js";
import {
	MAX_BODY_LENGTH,
	PLACEHOLDERS,
	ACCEPTANCE_TRACE_ID_PATTERN,
	PREPARATORY_LINKED_ISSUE_TRACE_PATTERN,
	REQUIRED_BEHAVIOR_PROOF_FIELDS,
	REQUIRED_SUMMARY_FIELDS,
	REQUIRED_RELEASE_BOUNDARY_FIELDS,
	REQUIRED_SECTIONS,
	REQUIRED_VALIDATION_FIELDS,
	REQUIRED_CHANGE_FIELDS,
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
/** Normalize a multi-line PR-template field value and drop guidance comments. */
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
	while (/<!--\s*[\s\S]*?\s*-->/.test(normalized)) {
		normalized = normalized.replace(/<!--\s*[\s\S]*?\s*-->/g, "");
	}
	return normalized.trim();
}

const RELEASE_MODE_PATTERN = /^(?:Prototype|Portfolio|Product|Harness)$/i;
const NOT_APPLICABLE_RELEASE_MODE_PATTERN =
	/^(?:n\.a\.|n\/a|not applicable)\s+because\s+(?!reason\b)(?!<reason>\b)\S.{6,}\S$/i;
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
	const reviewArtifactsBody = extractSectionBody(
		body,
		"## Review and closeout",
	);
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
		const value = extractFieldBlockValue(body, sectionHeading, field.label);
		if (value === null) {
			errors.push(`Missing required ${errorPrefix} field: ${field.label}`);
			continue;
		}

		const normalizedValue = normalizeFieldValue(value);
		const placeholder = normalizeFieldValue(field.placeholder);
		if (normalizedValue.length === 0 || normalizedValue === placeholder) {
			errors.push(`Replace ${errorPrefix} field placeholder: ${field.label}`);
		}
	}

	return errors;
}
/** Collect required validation fields and command-evidence errors. */
function collectValidationFieldErrors(body: string): string[] {
	const errors = collectFieldErrors(
		body,
		"## Validation",
		REQUIRED_VALIDATION_FIELDS,
		"validation",
	);
	const validationBody = extractSectionBody(body, "## Validation");
	if (validationBody !== null) {
		errors.push(...collectCommandEvidenceErrors(validationBody));
	}
	return errors;
}
/** Collect required behavior-proof field errors. */
function collectBehaviorProofFieldErrors(body: string): string[] {
	return collectFieldErrors(
		body,
		"## Behavior Proof",
		REQUIRED_BEHAVIOR_PROOF_FIELDS,
		"behavior proof",
	);
}
/** Collect missing summary fields from the pull request body. */
function collectSummaryFieldErrors(body: string): string[] {
	return collectFieldErrors(
		body,
		"## Summary",
		REQUIRED_SUMMARY_FIELDS,
		"summary",
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
 * Validate required fields inside the "Change details" section.
 *
 * @param body - The full pull request body text to inspect
 * @returns Errors for missing or invalid change-detail fields; empty if none
 */
function collectChangeDetailsFieldErrors(body: string): string[] {
	return collectFieldErrors(
		body,
		"## Change details",
		REQUIRED_CHANGE_FIELDS,
		"change details",
	);
}

/** Collect acceptance-trace errors when linked issue references are present. */
function collectLinkedIssueAcceptanceTraceErrors(
	body: string,
	allowedPrefixes?: readonly string[],
): string[] {
	const planIds = extractFieldBlockValue(body, "## Change details", "Plan IDs");
	if (planIds === null) {
		return [];
	}
	const issueKeys = extractLinearIssueKeys(planIds, allowedPrefixes);
	if (issueKeys.length === 0) return [];

	const acceptanceTrace = extractFieldBlockValue(
		body,
		"## Change details",
		"Acceptance trace",
	);
	if (acceptanceTrace === null) {
		return [];
	}

	if (traceCoversEveryLinkedIssue(issueKeys, acceptanceTrace)) {
		return [];
	}

	const issueKeyList = issueKeys.join(", ");
	return [
		`Acceptance trace for linked issue ${issueKeyList} must list specific acceptance IDs (for example SA-001 or AC-001) or explicitly state the preparatory/enabling relationship, that this PR does not complete the issue acceptance criteria, and that completed issue acceptance IDs are none. When multiple linked issues are listed, each issue key must appear in the Acceptance trace with completed acceptance IDs or an explicit no-completion classification.`,
	];
}

/** Return whether each linked issue has acceptance or preparatory trace evidence. */
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
			`\\b${escapedIssueKey}\\b([\\s\\S]*?)(?=\\b[A-Z][A-Z0-9]*-\\d+\\b(?!-\\d)|$)`,
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

/** Extract and normalize a named field from a bounded PR-template section. */
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
		`^-\\s*${escapedLabel}:[ \\t]*([\\s\\S]*?)(?=\\r?\\n-\\s*[A-Za-z][^\\n:]{0,80}:|\\r?\\n##\\s|(?![\\s\\S]))`,
		"im",
	);
	const match = sectionBody.match(pattern);
	return match ? normalizeFieldBlockValue(match[1] ?? "") : null;
}

/**
 * Validates the `- Command:` evidence lines within a Validation section.
 *
 * @param validationBody - The markdown content of the `## Validation` section to inspect
 * @returns An array of error messages describing formatting violations; empty if all command evidence lines conform to the required patterns
 */
function collectCommandEvidenceErrors(validationBody: string): string[] {
	const commandLines = validationBody
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => /^-\s*Command:\s*/i.test(line));
	const errors: string[] = [];

	if (commandLines.length === 0) {
		return [
			"Validation section must include at least one Command evidence line.",
		];
	}

	const commandEvidencePattern =
		/^-\s*Command:\s*(?:`[^\n`]+`|(?=\S).*?\S)\s*->\s*(?:(?:pass|fail|`(?:pass|fail)`)(?:\s*\([^)]+\)\.?)?|(?:n\.a\.|n\/a|`(?:n\.a\.|n\/a)`)(?:\s*\([^)]+\))?|(?:blocked|`blocked`)\s*\([^)]+\))\s*$/i;
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
 * "Change details" and "Validation", checklist validation, placeholder detection, and
 * evidence-format rules for meta-behavior, pattern scope, and repeated-error research.
 *
 * @returns An array of error messages describing template or formatting violations; an empty array if no issues are found.
 */
export function validatePrTemplateBody(
	body: string,
	options: { issueKeyPrefixes?: readonly string[] } = {},
): string[] {
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

	errors.push(...collectSummaryFieldErrors(body));
	errors.push(...collectReleaseBoundaryFieldErrors(body));
	errors.push(...collectChangeDetailsFieldErrors(body));
	errors.push(
		...collectLinkedIssueRelationshipErrors(
			body,
			extractFieldBlockValue,
			options.issueKeyPrefixes,
		),
	);
	errors.push(
		...collectLinkedIssueAcceptanceTraceErrors(body, options.issueKeyPrefixes),
	);
	errors.push(
		...collectWorkEvidenceIntegrityErrors(body, extractFieldBlockValue),
	);
	errors.push(...collectChecklistErrors(body));
	errors.push(...collectBehaviorProofFieldErrors(body));
	errors.push(...collectValidationFieldErrors(body));
	errors.push(...collectPlaceholderErrors(body));

	return errors;
}
