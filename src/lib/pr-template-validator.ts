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

const STEERING_SIGNAL_PATTERN =
	/(admitted repeated steering|repeated steering (showed|exposed|drove|required|was)|same steering twice|same feedback twice|same correction across sessions|same feedback again|user had to restate correction|never give the same feedback twice|not permitted to proceed|current-session steering admission|stop-the-line|high-signal (user )?(steering|feedback|correction)|every bit of steering|failing to operate effectively|steering feedback (showed|exposed|drove|required|was|into))/i;
const REPEATED_ERROR_RESEARCH_SIGNAL_PATTERN =
	/(same error (happened|occurred)?\s*twice|same failure twice|same command failed twice|failed again with the same (error|failure|command|stack trace|exception)|same (stack trace|exception) (appeared|happened|occurred|recurred|repeated).*twice|same error repeated|don\u2019t fight (?:the )?(same )?error|don't fight (?:the )?(same )?error)/i;
const PATTERN_SCOPE_SIGNAL_PATTERN =
	/(line-level correction|line-level design feedback|example-based feedback|concrete correction|single line|single function|single class|just fix that line|do not just fix that line|not just that line|similar classes of misbehavior|similar misbehavior|class of misbehavior|same pattern|sibling implementations|sibling pattern|broader design principle|design model|API design generally|across everything we do|named sentinel error|success and failure as a bool|success\/failure boolean|boolean result)/i;
const DURABLE_META_DESTINATION_PATTERN =
	/(gate|validator|schema|scaffold|template field|validation rule|Project Brain|Linear|tracked issue|memory update|solution record|codestyle|docs-gate|guard|explicit exception)/i;
const CONCRETE_DURABLE_REFERENCE_PATTERN =
	/(\b[A-Z]+-\d+\b|(?:^|[\s`"'([<])(?:\.\/)?(?:AI|artifacts|codestyle|fixtures|scripts|src|test|tests|docs|\.harness|\.github)\/[\w./-]+|(?:^|[\s`"'([<])(?:\.\/)?(?:AGENTS\.md|README\.md|CONTRIBUTING\.md|UBIQUITOUS_LANGUAGE\.md|CODESTYLE\.md|harness\.contract\.json)|pnpm\s+[\w:-]+|bash\s+(?:\.\/)?scripts\/[\w./-]+)/i;
const PATTERN_SCOPE_EVIDENCE_PATTERNS = [
	/(principle|design principle|API design|contract)/i,
	/(sibling|similar|related|pattern|inventory|searched|misbehavior class)/i,
	/\b(changed|updated|applied|propagated)\b/i,
	/(left unchanged|unchanged|deferred|not applicable|n\.a\.|tracked issue|exception).*(reason|because|tracked issue|exception|not applicable)|reason.*(left unchanged|unchanged|deferred|not applicable|n\.a\.|tracked issue|exception)/i,
] as const;
const REPEATED_ERROR_RESEARCH_EVIDENCE_PATTERNS = [
	/(source|research|official docs|web research|upstream docs|research checked|source checked):\s*\S.{8,}/i,
	/(chosen|selected|most efficient)\s*(fix|option|candidate|way)?:\s*\S.{8,}/i,
	/(implemented|applied)\s*(fix|change|remediation|patch)?:\s*\S.{8,}/i,
] as const;
const CANDIDATE_FIX_PATTERN =
	/(?:^|[;|]\s*|\s)(?:candidate|option|fix)\s*(?:#?\d+|\d+[).:]|\b(?:one|two|three|four|five)\b)\s*[:=-]\s*\S.{7,}?(?=\s+(?:candidate|option|fix)\s*(?:#?\d+|\d+[).:]|\b(?:one|two|three|four|five)\b)\s*[:=-]|\s+(?:chosen|selected|implemented|applied)\b|[;|]|$)/gi;

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
			"for any steering feedback, review comment, or line-level correction that implies a broader design/API principle, name the principle, list sibling implementations or similar misbehavior classes searched, and state which siblings were changed, intentionally left unchanged, or deferred with tracker/evidence",
	},
	{
		label: "Meta-behavior proof",
		placeholder:
			"for repeated steering or high-signal corrections, name the durable repo/system change plus concrete repo path, command, or issue ID that prevents recurrence, or `n.a.` with tracked exception reason",
	},
	{
		label: "Repeated-error research",
		placeholder:
			"when the same error occurs twice, use `Source: ...; Candidate 1: ...; Candidate 2: ...; Candidate 3: ...; Chosen: ...; Implemented: ...`; otherwise `n.a.` with reason",
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

/**
 * Retrieves the normalized value of a labeled field from a specific markdown section.
 *
 * @param body - The full PR body markdown to search
 * @param sectionHeading - The section heading to extract (e.g., `## Work performed`)
 * @param label - The field label to find (e.g., `Meta-behavior proof`)
 * @returns The field's normalized text value if present, `null` if the section or labeled field is missing
 */
function extractFieldValue(
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
	return match ? normalizeFieldValue(match[1] ?? "") : null;
}

/**
 * Checks whether a string contains a durable evidence reference composed of a durable meta destination and a concrete durable reference.
 *
 * @param value - The string to validate; may be `null`.
 * @returns `true` if `value` contains both a durable meta destination and a concrete durable reference, `false` otherwise.
 */
function hasDurableEvidenceReference(value: string | null): boolean {
	return (
		value !== null &&
		DURABLE_META_DESTINATION_PATTERN.test(value) &&
		CONCRETE_DURABLE_REFERENCE_PATTERN.test(value)
	);
}

/**
 * Counts candidate/fix/option-style entries in the provided text.
 *
 * @param value - Text to scan for candidate/fix/option entries
 * @returns The number of candidate/fix/option-style entries found in `value`
 */
function countCandidateFixes(value: string): number {
	return Array.from(value.matchAll(CANDIDATE_FIX_PATTERN)).length;
}

/**
 * Validate meta-behavior fields when the PR text admits steering feedback or repeated user correction.
 *
 * @param body - The full PR markdown body to inspect
 * @returns An array of error messages for missing or invalid durable evidence references in `Meta-behavior proof` and `Learning / reinforcement`; returns an empty array if the steering signal is absent or both fields are valid.
 */
function collectMetaBehaviorErrors(body: string): string[] {
	const bodyWithoutMetaFields = body
		.split(/\r?\n/)
		.filter(
			(line) =>
				!/^\s*-\s*(Meta-behavior proof|Learning \/ reinforcement):/i.test(line),
		)
		.join("\n");

	if (!STEERING_SIGNAL_PATTERN.test(bodyWithoutMetaFields)) {
		return [];
	}

	const errors: string[] = [];
	const metaProof = extractFieldValue(
		body,
		"## Work performed",
		"Meta-behavior proof",
	);
	const learning = extractFieldValue(
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

/**
 * Validates the "Pattern scope inventory" field when the PR text admits line-level or design-pattern scope correction.
 *
 * Checks that, when a pattern-scope admission is present, the `Pattern scope inventory` value names the inferred principle, sibling patterns searched, siblings changed, and siblings left unchanged or deferred with reasons; otherwise returns an explanatory error.
 *
 * @returns An array of error messages; empty if the check passes or if the pattern-scope admission is not present.
 */
function collectPatternScopeInventoryErrors(body: string): string[] {
	const bodyWithoutInventoryField = body
		.split(/\r?\n/)
		.filter((line) => !/^-\s*Pattern scope inventory:/i.test(line))
		.join("\n");

	if (!PATTERN_SCOPE_SIGNAL_PATTERN.test(bodyWithoutInventoryField)) {
		return [];
	}

	const inventory = extractFieldValue(
		body,
		"## Work performed",
		"Pattern scope inventory",
	);
	if (
		inventory === null ||
		!PATTERN_SCOPE_EVIDENCE_PATTERNS.every((pattern) => pattern.test(inventory))
	) {
		return [
			"Pattern scope inventory must name the inferred principle, sibling patterns searched, siblings changed, and siblings left unchanged or deferred with reasons when PR text admits line-level or design-pattern correction.",
		];
	}

	return [];
}

/**
 * Validates the "Repeated-error research" field when the PR body admits that the same error occurred more than once.
 *
 * When the PR contains a repeated-error admission signal, ensures the `Repeated-error research` field in `## Work performed`
 * is present, matches all required evidence patterns (including Source, Chosen, and Implemented evidence), and lists between
 * three and five numbered candidate/fix/option entries.
 *
 * @param body - The full pull request body to validate
 * @returns An array of validation error messages; empty if no repeated-error admission is present or the field satisfies requirements
 */
function collectRepeatedErrorResearchErrors(body: string): string[] {
	const bodyWithoutResearchField = body
		.split(/\r?\n/)
		.filter((line) => !/^-\s*Repeated-error research:/i.test(line))
		.join("\n");

	if (!REPEATED_ERROR_RESEARCH_SIGNAL_PATTERN.test(bodyWithoutResearchField)) {
		return [];
	}

	const research = extractFieldValue(
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

	errors.push(...collectWorkPerformedFieldErrors(body));
	errors.push(...collectMetaBehaviorErrors(body));
	errors.push(...collectPatternScopeInventoryErrors(body));
	errors.push(...collectRepeatedErrorResearchErrors(body));
	errors.push(...collectChecklistErrors(body));
	errors.push(...collectTestingFieldErrors(body));
	errors.push(...collectPlaceholderErrors(body));

	return errors;
}
