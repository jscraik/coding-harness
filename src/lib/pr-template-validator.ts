const REQUIRED_SECTIONS = [
	"## Summary",
	"## Work performed",
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

const REQUIRED_WORK_FIELDS = [
	{
		label: "Plan IDs",
		placeholder:
			"list Linear keys, spec paths, plan paths, or `n.a.` with reason",
	},
	{
		label: "Phase / slice",
		placeholder:
			"list completed phase, implementation slice, or `n.a.` with reason",
	},
	{
		label: "Session IDs",
		placeholder:
			"list Codex thread/session IDs, session-collector artifact IDs or paths, harness run IDs, or `n.a.` with reason. For AI-assisted work, include at least one session reference or explain why no session artifact was captured.",
	},
	{
		label: "Trace IDs",
		placeholder:
			"list CI workflow/job URLs, harness/eval/runtime trace IDs, runtime-card/evidence bundle artifact paths, review trace IDs, or `n.a.` with reason. For traced or evaluated work, include the trace or artifact reference used to verify the claim.",
	},
	{
		label: "AI session / traceability",
		placeholder:
			"map the AI session or trace reference to the work it supports; do not paste raw transcripts, prompts, secrets, or bulky telemetry into the PR body.",
	},
	{
		label: "Completed work",
		placeholder:
			"list implementation units, docs/config changes, or evidence-only work completed in this PR",
	},
	{
		label: "Affected surfaces",
		placeholder:
			"list code, tests, docs, PR template, CLI reference, workflow config, generated artifacts, examples, or `n.a.` with reason",
	},
	{
		label: "Expected outcome alignment",
		placeholder:
			"state how this change preserves Coding Harness as a portable agent operating system for greenfield and brownfield repos, or mark `n.a.` with reason",
	},
	{
		label: "Pattern scope inventory",
		placeholder:
			"for any steering feedback, review comment, or line-level correction that implies a broader design principle, name the principle, list sibling implementations searched, and state which siblings were changed, intentionally left unchanged, or deferred with tracker/evidence",
	},
	{
		label: "Acceptance trace",
		placeholder:
			"map completed acceptance items to evidence refs, or `n.a.` with reason",
	},
	{
		label: "Validation evidence",
		placeholder:
			"list command outcomes, CI jobs, artifact paths, or `n.a.` with reason",
	},
	{
		label: "Review artifacts",
		placeholder:
			"list CodeRabbit, Codex, reviewer, or harness review artifacts, or `n.a.` with reason",
	},
	{
		label: "Runtime impact",
		placeholder:
			"state direct, transitive, dev-only, CI-only, runtime-facing, or `n.a.` with reason",
	},
	{
		label: "CodeRabbit mode coverage",
		placeholder:
			"list analysis, validation, gate, closeout, promotion, or `n.a.` with reason",
	},
	{
		label: "Closeout state",
		placeholder:
			"classify PR state, merge or auto-merge state, branch/worktree state, Linear state, next-lane routing, and any remaining blocker or waiting owner",
	},
	{
		label: "Learning / reinforcement",
		placeholder:
			"list promoted learnings, memory updates, or `none` with reason",
	},
	{
		label: "Deferred work",
		placeholder: "list follow-up work intentionally left out, or `none`",
	},
] as const;

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

function extractSectionBody(body: string, heading: string): string | null {
	const escapedHeading = heading.replace(/[.*+?^${}()|[\]]/g, "\\$&");
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

function collectWorkPerformedFieldErrors(body: string): string[] {
	return collectFieldErrors(
		body,
		"## Work performed",
		REQUIRED_WORK_FIELDS,
		"work performed",
	);
}

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
		/^-\s*Command:\s*(?:`[^\n`]+`|[^\n`]+?)\s*->\s*(?:`?(?:pass|fail)`?|(?:`?blocked`?|`?n\.a\.`?|`?n\/a`?)\s*\([^)]+\))\s*$/i;
	for (const line of commandLines) {
		if (!commandEvidencePattern.test(line)) {
			errors.push(
				`Command evidence must use \`Command: <exact command> -> pass|fail|blocked (<reason>)\` format: ${line}`,
			);
		}
	}

	return errors;
}

/**
 * Validate a pull request body against the repository PR template contract.
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

	errors.push(...collectWorkPerformedFieldErrors(body));
	errors.push(...collectChecklistErrors(body));
	errors.push(...collectTestingFieldErrors(body));
	errors.push(...collectPlaceholderErrors(body));

	return errors;
}
