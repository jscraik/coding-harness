const REQUIRED_SECTIONS = [
	"## Summary",
	"## Checklist",
	"## Testing",
	"## Review artifacts",
	"## Notes",
] as const;

const MAX_BODY_LENGTH = 100_000; // 100KB limit to prevent ReDoS

const PLACEHOLDERS = [
	"pass/fail",
	"<link / artifact path / comment ID>",
	"<reviewer + link>",
	"Add one-paragraph merge rationale here.",
] as const;

const REQUIRED_TESTING_FIELDS = [
	{
		label: "verification_commands",
		placeholder: "list exact commands run here",
	},
	{
		label: "verification_outcomes",
		placeholder: "record pass/fail/blocked for each command here",
	},
	{
		label: "blocked_steps_reason",
		placeholder: "none if all planned steps ran",
	},
] as const;

/**
 * Normalize a testing-field string by trimming, unwrapping code blocks or single inline code, and collapsing whitespace.
 *
 * @param value - Raw testing field text extracted from a PR body
 * @returns The normalized string: trimmed, with fenced code block or single inline code unwrapped, and internal whitespace collapsed to single spaces
 */
function normalizeTestingFieldValue(value: string): string {
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

/**
 * Extracts the body content for the given section heading from a Markdown PR body.
 *
 * Matches the provided heading exactly (case-insensitive) and returns the text
 * after that heading up to the next top-level heading (`# ` or `## `) or the end
 * of the string.
 *
 * @param body - The full Markdown text to search
 * @param heading - The exact section heading to locate (for example `"## Testing"`)
 * @returns The section content as a string if the heading is present (may be an empty string), or `null` if the heading is not found
 */
function extractSectionBody(body: string, heading: string): string | null {
	const escapedHeading = heading.replace(/[.*+?^${}()|[\]]/g, "\\$&");
	const pattern = new RegExp(
		`${escapedHeading}([\\s\\S]*?)(?:\\n## |\\n# |$)`,
		"i",
	);
	const match = body.match(pattern);
	if (!match) {
		return null;
	}
	return match[1] ?? "";
}

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

/**
 * Validate required testing fields inside the `## Testing` section of a PR body.
 *
 * Checks for a `## Testing` section and ensures each entry from REQUIRED_TESTING_FIELDS
 * is present and not left as its placeholder value.
 *
 * @param body - The full pull-request template body to inspect
 * @returns An array of error messages discovered in the `## Testing` section; empty if no errors.
 *          If the `## Testing` section is missing, the array contains `"Missing testing block."`.
 */
function collectTestingFieldErrors(body: string): string[] {
	const testingBody = extractSectionBody(body, "## Testing");
	if (testingBody === null) {
		return ["Missing testing block."];
	}

	const errors: string[] = [];

	for (const field of REQUIRED_TESTING_FIELDS) {
		const pattern = new RegExp(`^-\\s*${field.label}:\\s*(.+)$`, "im");
		const match = testingBody.match(pattern);
		if (!match) {
			errors.push(`Missing required testing field: ${field.label}`);
			continue;
		}

		const value = normalizeTestingFieldValue(match[1] ?? "");
		const placeholder = normalizeTestingFieldValue(field.placeholder);
		if (value.length === 0 || value === placeholder) {
			errors.push(`Replace testing field placeholder: ${field.label}`);
		}
	}

	return errors;
}

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
		if (!body.includes(section)) {
			errors.push(`Missing required section: ${section}`);
		}
	}

	errors.push(...collectChecklistErrors(body));
	errors.push(...collectTestingFieldErrors(body));
	errors.push(...collectPlaceholderErrors(body));

	return errors;
}
