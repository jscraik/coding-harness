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

		const value = match[1]?.trim() ?? "";
		if (value.length === 0 || value === field.placeholder) {
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
