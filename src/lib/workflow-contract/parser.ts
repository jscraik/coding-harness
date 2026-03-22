/**
 * Workflow Contract Parser
 *
 * Extracts structured `WorkflowContract` data from markdown files
 * that follow the `workflow-contract-v1` format. Handles:
 *
 * 1. YAML frontmatter (Symphony config — returned separately)
 * 2. Markdown tables → metadata, transitions, error codes, etc.
 * 3. Markdown sections → execution modes, dry-run, log fields
 *
 * Usage:
 *   const { contract, frontmatter, errors } = parseWorkflowFile(content);
 *   if (errors.length === 0) {
 *     const result = checkWorkflowContract(contract);
 *   }
 */

import type {
	ChangeClass,
	DryRunSemantics,
	ExecutionMode,
	LogField,
	TransitionRow,
	ValidationContract,
	WorkflowContract,
	WorkflowMetadata,
} from "./types.js";

// ─── Types ──────────────────────────────────────────────────────────────────────

/** Result of parsing a workflow file. */
export interface ParseResult {
	/** Extracted workflow contract (may be incomplete if errors exist). */
	contract: WorkflowContract;
	/** YAML frontmatter key-value pairs (Symphony config). */
	frontmatter: Record<string, unknown>;
	/** Body content (markdown after frontmatter). */
	body: string;
	/** Parse errors encountered. */
	errors: ParseError[];
}

/** A parsing error. */
export interface ParseError {
	code: string;
	message: string;
	/** Line number in the source file (1-indexed), if available. */
	line?: number;
}

// ─── Frontmatter Parser ─────────────────────────────────────────────────────────

/**
 * Parse YAML frontmatter from markdown content.
 *
 * Handles nested objects, arrays, multiline strings, and quoted values.
 * This is a lightweight parser — not a full YAML implementation.
 */
export function parseFrontmatter(content: string): {
	frontmatter: Record<string, unknown>;
	body: string;
} {
	const match = content.match(
		/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n([\s\S]*))?$/,
	);
	if (!match) {
		return { frontmatter: {}, body: content };
	}

	const yamlBlock = match[1];
	if (!yamlBlock) {
		return { frontmatter: {}, body: content };
	}

	const frontmatter: Record<string, unknown> = {};
	const lines = yamlBlock.split(/\r?\n/);
	let currentKey: string | null = null;
	let currentArray: string[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line === undefined) continue;
		const trimmed = line.trim();
		if (trimmed === "") continue;

		// Array item
		if (trimmed.startsWith("- ") && currentKey) {
			currentArray.push(trimmed.slice(2).replace(/^["']|["']$/g, ""));
			continue;
		}

		// Flush pending array
		if (currentKey && currentArray.length > 0) {
			frontmatter[currentKey] = currentArray;
			currentArray = [];
		}

		// Key-value pair (only top-level, ignore indented/nested)
		const colonIndex = line.indexOf(":");
		if (colonIndex > 0 && !line.startsWith(" ") && !line.startsWith("\t")) {
			currentKey = line.slice(0, colonIndex).trim();
			const value = line.slice(colonIndex + 1).trim();

			if (value === "") {
				// Could be a nested object or array start
				const nextLine = lines[i + 1]?.trim();
				if (nextLine?.startsWith("- ")) {
					currentArray = [];
				}
				// nested objects are not extracted (kept as undefined keys)
			} else {
				frontmatter[currentKey] = value.replace(/^["']|["']$/g, "");
				currentKey = null;
			}
		}
	}

	// Flush final array
	if (currentKey && currentArray.length > 0) {
		frontmatter[currentKey] = currentArray;
	}

	const bodyContent = match[2];
	return { frontmatter, body: bodyContent ? bodyContent.trim() : "" };
}

// ─── Markdown Table Parser ──────────────────────────────────────────────────────

/** Parse a markdown table into rows of cells. Skips the header separator row. */
function parseMarkdownTable(tableText: string): string[][] {
	const lines = tableText
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter((l) => l.startsWith("|"));

	if (lines.length < 2) return [];

	const rows: string[][] = [];
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]!;

		// Skip header separator (e.g. | --- | --- |)
		if (/^\|[\s-:|]+\|$/.test(line)) continue;

		const cells = line
			.split("|")
			.slice(1, -1) // drop empty first/last from split
			.map((c) => c.trim().replace(/^`|`$/g, ""));
		rows.push(cells);
	}

	return rows;
}

// ─── Section Extractor ──────────────────────────────────────────────────────────

/**
 * Extract content under specific markdown headings.
 * Returns a map of heading → content (everything until the next same-level+ heading).
 */
function extractSections(
	body: string,
): Map<string, string> {
	const sections = new Map<string, string>();
	const lines = body.split(/\r?\n/);

	let currentHeading: string | null = null;
	let currentContent: string[] = [];

	for (const line of lines) {
		const headingMatch = line.match(/^#{1,3}\s+(.+)/);
		if (headingMatch) {
			// Flush previous section
			if (currentHeading) {
				sections.set(
					currentHeading.toLowerCase(),
					currentContent.join("\n").trim(),
				);
			}
			currentHeading = headingMatch[1]!.trim();
			currentContent = [];
		} else {
			currentContent.push(line);
		}
	}

	// Flush final section
	if (currentHeading) {
		sections.set(
			currentHeading.toLowerCase(),
			currentContent.join("\n").trim(),
		);
	}

	return sections;
}

// ─── Field Extractors ───────────────────────────────────────────────────────────

/** Extract metadata from a 2-column Field|Value table. */
function extractMetadata(
	tableContent: string,
	errors: ParseError[],
): WorkflowMetadata {
	const rows = parseMarkdownTable(tableContent);
	const fieldMap = new Map<string, string>();

	for (const row of rows) {
		if (row.length >= 2) {
			const key = row[0]!.replace(/^`|`$/g, "").trim();
			const value = row[1]!.replace(/^`|`$/g, "").trim();
			fieldMap.set(key, value);
		}
	}

	const owner = fieldMap.get("owner") ?? "";
	const maxDuration = fieldMap.get("max_duration") ?? "";
	const escalation = fieldMap.get("escalation") ?? "";
	const changeClass = fieldMap.get("change_class") ?? "";

	if (!owner) errors.push({ code: "PARSE_MISSING_FIELD", message: "Metadata table missing 'owner' row" });
	if (!maxDuration) errors.push({ code: "PARSE_MISSING_FIELD", message: "Metadata table missing 'max_duration' row" });
	if (!escalation) errors.push({ code: "PARSE_MISSING_FIELD", message: "Metadata table missing 'escalation' row" });

	return {
		owner,
		max_duration: maxDuration,
		escalation,
		change_class: changeClass as ChangeClass,
	};
}

/** Extract validation contract from a 2-column Field|Requirement table. */
function extractValidationContract(
	tableContent: string,
): ValidationContract {
	const rows = parseMarkdownTable(tableContent);
	const fieldMap = new Map<string, string>();

	for (const row of rows) {
		if (row.length >= 2) {
			const key = row[0]!.replace(/^`|`$/g, "").trim();
			const value = row[1]!.replace(/^`|`$/g, "").trim();
			fieldMap.set(key, value);
		}
	}

	const vc: ValidationContract = {
		test_mode: (fieldMap.get("test_mode") ?? "n/a") as ValidationContract["test_mode"],
		test_tier: (fieldMap.get("test_tier") ?? "n/a") as ValidationContract["test_tier"],
		tracer_bullet_first: (fieldMap.get("tracer_bullet_first") ?? "no") as "yes" | "no",
		red_evidence_required: (fieldMap.get("red_evidence_required") ?? "no") as "yes" | "no",
	};

	const exemptionReason = fieldMap.get("exemption_reason");
	if (exemptionReason) vc.exemption_reason = exemptionReason;

	const reviewedBy = fieldMap.get("reviewed_by");
	if (reviewedBy) vc.reviewed_by = reviewedBy;

	return vc;
}

function containsValidationContractFields(sectionContent: string): boolean {
	return (
		sectionContent.includes("test_mode") ||
		sectionContent.includes("test_tier") ||
		sectionContent.includes("tracer_bullet_first") ||
		sectionContent.includes("red_evidence_required")
	);
}

/** Extract transitions from canonical S|E|G|A|N or S|E|G|A|P|R|N tables. */
function extractTransitions(
	tableContent: string,
	errors: ParseError[],
): TransitionRow[] {
	const rows = parseMarkdownTable(tableContent);
	const transitions: TransitionRow[] = [];

	// Skip header row when present.
	const dataRows = rows.length > 0 && isHeaderRow(rows[0]!) ? rows.slice(1) : rows;

	for (const row of dataRows) {
		if (row.length !== 5 && row.length !== 7) {
			errors.push({
				code: "PARSE_INCOMPLETE_ROW",
				message: `Transition row has ${row.length} cells, expected 5 or 7`,
			});
			continue;
		}

		const transition: TransitionRow = {
			S: row[0]!.trim(),
			E: row[1]!.trim(),
			G: row[2]!.trim(),
			A: row[3]!.trim(),
			N: row[row.length === 7 ? 6 : 4]!.trim(),
		};

		if (row.length === 7) {
			transition.P = row[4]!.trim();
			transition.R = row[5]!.trim();
		}

		transitions.push(transition);
	}

	return transitions;
}

/** Check if a table row looks like a canonical transition header. */
function isHeaderRow(row: string[]): boolean {
	if (row.length !== 5 && row.length !== 7) return false;
	const normalized = row.map((c) => c.trim().toLowerCase());
	if (
		normalized[0] !== "s" ||
		normalized[1] !== "e" ||
		normalized[2] !== "g" ||
		normalized[3] !== "a"
	) {
		return false;
	}

	if (row.length === 7) {
		return (
			normalized[4] === "p" &&
			normalized[5] === "r" &&
			normalized[6] === "n"
		);
	}

	return normalized[4] === "n";
}

/** Extract error codes from a bullet list or text content. */
function extractErrorCodes(sectionContent: string): string[] {
	const codes: string[] = [];

	// Match backtick-wrapped codes in bullet lists: - `CODE_NAME`
	const bulletMatches = sectionContent.matchAll(/[-*]\s+`([A-Z_]+)`/g);
	for (const m of bulletMatches) {
		if (m[1]) codes.push(m[1]);
	}

	// Also match codes at start of bullet lines: - CODE_NAME: ...
	const plainMatches = sectionContent.matchAll(/[-*]\s+([A-Z][A-Z_]+)(?::|\.|\s)/g);
	for (const m of plainMatches) {
		if (m[1] && !codes.includes(m[1])) codes.push(m[1]);
	}

	return codes;
}

/** Extract execution modes from section content. */
function extractExecutionModes(sectionContent: string): ExecutionMode[] {
	const modes: ExecutionMode[] = [];
	if (/\bSTRICT\b/.test(sectionContent)) modes.push("STRICT");
	if (/\bADVISORY\b/.test(sectionContent)) modes.push("ADVISORY");
	return modes;
}

/** Extract dry-run semantics from section content. */
function extractDryRun(sectionContent: string): DryRunSemantics {
	return {
		no_side_effects: /no side[- ]?effects/i.test(sectionContent),
		deterministic_trace: /deterministic\s+(transition\s+)?trace/i.test(sectionContent),
	};
}

/** Extract log fields from section content. */
function extractLogFields(sectionContent: string): LogField[] {
	const fields: LogField[] = [];

	// Match backtick-wrapped field names: `field_name`
	const backtickMatches = sectionContent.matchAll(/`([a-z_]+)`/g);
	for (const m of backtickMatches) {
		if (m[1] && !fields.includes(m[1] as LogField)) {
			fields.push(m[1] as LogField);
		}
	}

	// Match JSON-style quoted keys: "field_name":
	const jsonMatches = sectionContent.matchAll(/"([a-z_]+)"\s*:/g);
	for (const m of jsonMatches) {
		if (m[1] && !fields.includes(m[1] as LogField)) {
			fields.push(m[1] as LogField);
		}
	}

	return fields;
}

// ─── Main Parser ────────────────────────────────────────────────────────────────

/**
 * Parse a workflow file into a structured `WorkflowContract`.
 *
 * @param content - Full file content (including frontmatter)
 * @returns ParseResult with contract, frontmatter, body, and any errors
 */
export function parseWorkflowFile(content: string): ParseResult {
	const errors: ParseError[] = [];
	const { frontmatter, body } = parseFrontmatter(content);
	const sections = extractSections(body);

	// ── Metadata ────────────────────────────────────────────────────────────
	let metadata: WorkflowMetadata = {
		owner: "",
		max_duration: "",
		escalation: "",
		change_class: "behavior",
	};

	// Try "Metadata" section first, then "Execution contract"
	const metadataSection =
		sections.get("metadata") || sections.get("execution contract") || "";
	if (metadataSection) {
		metadata = extractMetadata(metadataSection, errors);
	} else {
		errors.push({
			code: "PARSE_MISSING_SECTION",
			message: 'No "Metadata" or "Execution contract" section found',
		});
	}

	// ── Validation Contract ─────────────────────────────────────────────────
	let validationContract: ValidationContract | undefined;
	const vcSection =
		sections.get("validation contract") ||
		sections.get("validation checklist") ||
		sections.get("invariants") ||
		"";
	if (
		vcSection &&
		vcSection.includes("|") &&
		containsValidationContractFields(vcSection)
	) {
		validationContract = extractValidationContract(vcSection);
	}

	// ── Transitions ─────────────────────────────────────────────────────────
	let transitions: TransitionRow[] = [];
	const transitionSection =
		sections.get("transition table (canonical)") ||
		sections.get("transition table") ||
		sections.get("transitions") ||
		"";
	if (transitionSection) {
		transitions = extractTransitions(transitionSection, errors);
	} else {
		errors.push({
			code: "PARSE_MISSING_SECTION",
			message: "No transition table section found",
		});
	}

	// ── Error Codes ─────────────────────────────────────────────────────────
	const errorSection = sections.get("error handling") || sections.get("error taxonomy") || "";
	const errorCodes = errorSection ? extractErrorCodes(errorSection) : [];

	// ── Execution Modes ─────────────────────────────────────────────────────
	const modesSection = sections.get("execution modes") || sections.get("modes") || "";
	const executionModes = modesSection ? extractExecutionModes(modesSection) : [];

	// ── Dry-Run ─────────────────────────────────────────────────────────────
	const dryRunSection =
		sections.get("dry-run simulation") ||
		sections.get("dry-run") ||
		sections.get("dry run") ||
		"";
	const dryRun = extractDryRun(dryRunSection);

	// ── Log Fields ──────────────────────────────────────────────────────────
	const logSection = sections.get("observability logs") || sections.get("observability") || sections.get("logging schema") || "";
	const logFields = logSection ? extractLogFields(logSection) : [];

	const contract: WorkflowContract = {
		metadata,
		...(validationContract ? { validation_contract: validationContract } : {}),
		transitions,
		error_codes: errorCodes,
		execution_modes: executionModes,
		dry_run: dryRun,
		log_fields: logFields,
	} as WorkflowContract;

	return { contract, frontmatter, body, errors };
}
