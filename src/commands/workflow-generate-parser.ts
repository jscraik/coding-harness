import { existsSync, readFileSync } from "node:fs";

/**
 * CLI options supported by the workflow generate command.
 */
export interface WorkflowGenerateOptions {
	source?: string | undefined;
	output?: string | undefined;
	format?: "segarn" | "segaprn" | undefined;
	json?: boolean | undefined;
	dryRun?: boolean | undefined;
	watch?: boolean | undefined;
}

/**
 * Parsed row describing one workflow transition.
 */
export interface TransitionRow {
	state: string;
	event: string;
	guard: string;
	action: string;
	plugin?: string;
	result?: string;
	next: string;
}

/**
 * Normalized workflow specification extracted from source markdown.
 */
export interface WorkflowSpec {
	title: string;
	type: string;
	status: string;
	date: string;
	origin: string | undefined;
	metadata: {
		owner: string;
		max_duration: string;
		escalation: string;
	};
	errors: Array<{
		code: string;
		condition: string;
		routing: string;
	}>;
	states: Array<{
		id: string;
		name: string;
		terminal: boolean;
	}>;
	transitions: TransitionRow[];
	invariants: string[];
	idempotency: {
		key: string;
		notes: string[];
	};
	modes: {
		strict: string;
		advisory: string;
	};
	dryRun: {
		description: string;
		trace: string;
	};
	logs: {
		workflow_id: string;
		fields: string[];
	};
}

/**
 * Output formats supported by spec rendering.
 */
export type WorkflowOutputFormat = "json" | "segarn" | "segaprn";

/**
 * Required error taxonomy codes that every workflow spec must define.
 */
export const REQUIRED_ERROR_CODES = [
	"VALIDATION_ERROR",
	"BLOCKED_DEPENDENCY",
	"POLICY_FAIL",
	"SYSTEM_ERROR",
] as const;

/**
 * Required observability log fields that every workflow spec must define.
 */
export const REQUIRED_LOG_FIELDS = [
	"workflow_id",
	"transition_code",
	"from_state",
	"to_state",
	"correlation_id",
	"result",
] as const;

function extractFrontmatter(content: string): Record<string, string> {
	const match = content.match(/^---\n([\s\S]*?)\n---/);
	if (!match?.[1]) return {};

	const frontmatter: Record<string, string> = {};
	const lines = match[1].split("\n");

	for (const line of lines) {
		const colonIndex = line.indexOf(":");
		if (colonIndex > 0) {
			const key = line.slice(0, colonIndex).trim();
			const value = line
				.slice(colonIndex + 1)
				.trim()
				.replace(/^["']|["']$/g, "");
			frontmatter[key] = value;
		}
	}

	return frontmatter;
}

function normalizeHeading(heading: string): string {
	return heading
		.replace(/^\d+\.\s*/, "")
		.replace(/\s+[—-]\s+[A-Z]\s*(?:\|\s*[A-Z]\s*)+$/i, "")
		.trim()
		.toLowerCase();
}

function extractSections(content: string): Map<string, string> {
	const sections = new Map<string, string>();
	const lines = content.split("\n");
	let currentHeading: string | null = null;
	let currentContent: string[] = [];

	for (const line of lines) {
		const headingMatch = line.match(/^##\s+(.+)$/);
		if (headingMatch?.[1]) {
			if (currentHeading) {
				sections.set(
					normalizeHeading(currentHeading),
					currentContent.join("\n").trim(),
				);
			}
			currentHeading = headingMatch[1];
			currentContent = [];
			continue;
		}
		if (currentHeading) {
			currentContent.push(line);
		}
	}

	if (currentHeading) {
		sections.set(
			normalizeHeading(currentHeading),
			currentContent.join("\n").trim(),
		);
	}

	return sections;
}

function getSection(
	sections: Map<string, string>,
	...candidates: string[]
): string {
	const normalizedCandidates = candidates.map((candidate) =>
		normalizeHeading(candidate),
	);

	for (const candidate of normalizedCandidates) {
		const section = sections.get(candidate);
		if (section) {
			return section;
		}
	}

	for (const [heading, section] of sections) {
		if (
			normalizedCandidates.some(
				(candidate) =>
					heading === candidate ||
					heading.startsWith(`${candidate} `) ||
					heading.startsWith(`${candidate} —`) ||
					heading.startsWith(`${candidate} -`),
			)
		) {
			return section;
		}
	}

	return "";
}

function extractMetadataSection(
	sections: Map<string, string>,
): WorkflowSpec["metadata"] | null {
	const section = getSection(sections, "metadata", "execution contract");
	if (!section) return null;

	const metadata: WorkflowSpec["metadata"] = {
		owner: "",
		max_duration: "",
		escalation: "",
	};

	const ownerMatch = section.match(/\|\s*`?owner`?\s*\|\s*([^|]+)\|/);
	if (ownerMatch?.[1]) metadata.owner = ownerMatch[1].trim();

	const durationMatch = section.match(/\|\s*`?max_duration`?\s*\|\s*([^|]+)\|/);
	if (durationMatch?.[1]) metadata.max_duration = durationMatch[1].trim();

	const escalationMatch = section.match(/\|\s*`?escalation`?\s*\|\s*([^|]+)\|/);
	if (escalationMatch?.[1]) metadata.escalation = escalationMatch[1].trim();

	return metadata;
}

function extractErrorsSection(
	sections: Map<string, string>,
): WorkflowSpec["errors"] {
	const errors: WorkflowSpec["errors"] = [];
	const section = getSection(
		sections,
		"errors",
		"error handling",
		"error taxonomy",
	);
	if (!section) return errors;

	const lines = section.split("\n");
	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed.startsWith("|") && !trimmed.includes("---")) {
			const cells = trimmed
				.split("|")
				.slice(1, -1)
				.map((c) => c.trim().replace(/^`|`$/g, ""));

			if (cells.length >= 3) {
				const code = cells[0];
				const condition = cells[1];
				const routing = cells[2];
				if (
					code &&
					condition &&
					routing &&
					(REQUIRED_ERROR_CODES as readonly string[]).includes(code)
				) {
					errors.push({ code, condition, routing });
				}
			}
			continue;
		}

		const bulletMatch = trimmed.match(/^[-*]\s+`?([A-Z_]+)`?\s*:\s*(.+)$/);
		if (
			bulletMatch?.[1] &&
			bulletMatch[2] &&
			(REQUIRED_ERROR_CODES as readonly string[]).includes(bulletMatch[1])
		) {
			errors.push({
				code: bulletMatch[1],
				condition: bulletMatch[2],
				routing: bulletMatch[2],
			});
		}
	}

	return errors;
}

function extractStatesSection(
	sections: Map<string, string>,
): WorkflowSpec["states"] {
	const states: WorkflowSpec["states"] = [];
	const section = getSection(sections, "states");
	if (!section) return states;

	for (const line of section.split("\n")) {
		const trimmed = line.trim();
		const stateMatch = trimmed.match(
			/^(S\d+)\s+(\S+)\s*\((terminal|non-terminal)\)/,
		);
		if (stateMatch?.[1] && stateMatch[2] && stateMatch[3]) {
			states.push({
				id: stateMatch[1],
				name: stateMatch[2],
				terminal: stateMatch[3] === "terminal",
			});
		}
	}

	return states;
}

/**
 * Parse transition rows from workflow section content.
 */
export function extractTransitions(
	sections: Map<string, string>,
): TransitionRow[] {
	const transitions: TransitionRow[] = [];
	const section = getSection(
		sections,
		"transition table (canonical)",
		"transition table",
		"transitions",
	);
	if (!section) return transitions;

	const lines = section.split("\n");
	let inTable = false;

	for (const line of lines) {
		const trimmed = line.trim();

		if (!inTable) {
			if (
				/^\|\s*S\s*\|\s*E\s*\|\s*G\s*\|\s*A\s*(?:\|\s*P\s*\|\s*R\s*)?\|\s*N\s*\|/.test(
					trimmed,
				)
			) {
				inTable = true;
			}
			continue;
		}

		if (!trimmed.startsWith("|")) break;
		if (/^\|\s*[-:]+/.test(trimmed)) continue;

		const cells = trimmed
			.split("|")
			.slice(1, -1)
			.map((c) => c.trim());

		if (cells.length === 5 || cells.length === 7) {
			const state = cells[0]?.replace(/^`|`$/g, "");
			const event = cells[1]?.replace(/^`|`$/g, "");
			const guard = cells[2];
			const action = cells[3];
			const plugin = cells.length === 7 ? cells[4] : undefined;
			const result = cells.length === 7 ? cells[5] : undefined;
			const next = cells[cells.length - 1]?.replace(/^`|`$/g, "");
			if (
				state &&
				event &&
				guard !== undefined &&
				action !== undefined &&
				next
			) {
				transitions.push({
					state,
					event,
					guard,
					action,
					...(plugin !== undefined ? { plugin } : {}),
					...(result !== undefined ? { result } : {}),
					next,
				});
			}
		}
	}

	return transitions;
}

function extractInvariants(sections: Map<string, string>): string[] {
	const invariants: string[] = [];
	const section = getSection(sections, "invariants");
	if (!section) return invariants;

	for (const line of section.split("\n")) {
		const trimmed = line.trim();
		if (trimmed.startsWith("- ")) {
			invariants.push(trimmed.slice(2));
			continue;
		}

		if (trimmed.startsWith("|") && !/^\|\s*[-:\s|]+\|?$/.test(trimmed)) {
			const cells = trimmed
				.split("|")
				.slice(1, -1)
				.map((cell) => cell.trim().replace(/^`|`$/g, ""));
			const field = cells[0];
			const value = cells[1];
			if (
				field &&
				value &&
				field.toLowerCase() !== "field" &&
				value.toLowerCase() !== "value"
			) {
				invariants.push(`${field}: ${value}`);
			}
		}
	}

	return invariants;
}

function extractIdempotency(
	sections: Map<string, string>,
): WorkflowSpec["idempotency"] {
	const result: WorkflowSpec["idempotency"] = {
		key: "",
		notes: [],
	};
	const section = getSection(sections, "idempotency");
	if (!section) return result;

	const keyMatch = section.match(/[Kk]ey:\s*([^\n]+)/);
	if (keyMatch?.[1]) result.key = keyMatch[1].trim();

	for (const line of section.split("\n")) {
		const trimmed = line.trim();
		if (trimmed.startsWith("- ")) {
			result.notes.push(trimmed.slice(2));
		}
	}

	return result;
}

function extractModes(sections: Map<string, string>): WorkflowSpec["modes"] {
	const modes: WorkflowSpec["modes"] = {
		strict: "",
		advisory: "",
	};
	const section = getSection(sections, "execution modes", "modes");
	if (!section) return modes;

	let currentMode: "strict" | "advisory" | null = null;
	for (const line of section.split("\n")) {
		const trimmed = line.trim();
		const strictMatch = trimmed.match(/^[-*]\s+`?STRICT`?\s*:\s*(.+)$/);
		if (strictMatch?.[1]) {
			modes.strict = strictMatch[1];
			continue;
		}
		const advisoryMatch = trimmed.match(/^[-*]\s+`?ADVISORY`?\s*:\s*(.+)$/);
		if (advisoryMatch?.[1]) {
			modes.advisory = advisoryMatch[1];
			continue;
		}

		if (trimmed.includes("STRICT")) currentMode = "strict";
		if (trimmed.includes("ADVISORY")) currentMode = "advisory";

		if (currentMode && trimmed.startsWith("| ")) {
			const cells = trimmed.split("|").map((c) => c.trim());
			const value = cells[2];
			if (value) {
				modes[currentMode] = value;
				currentMode = null;
			}
		}
	}

	return modes;
}

function extractDryRun(sections: Map<string, string>): WorkflowSpec["dryRun"] {
	const dryRun: WorkflowSpec["dryRun"] = {
		description: "",
		trace: "",
	};
	const section = getSection(
		sections,
		"dry-run simulation",
		"dry-run",
		"dry run",
	);
	if (!section) return dryRun;

	for (const line of section.split("\n")) {
		const trimmed = line.trim();
		if (trimmed.startsWith("- ")) {
			if (!dryRun.description) {
				dryRun.description = trimmed.slice(2);
			}
			if (trimmed.includes("trace")) {
				dryRun.trace = trimmed.slice(2);
			}
		}
	}

	return dryRun;
}

function extractLogs(sections: Map<string, string>): WorkflowSpec["logs"] {
	const logs: WorkflowSpec["logs"] = {
		workflow_id: "",
		fields: [],
	};
	const section = getSection(
		sections,
		"observability logs",
		"observability",
		"log schema",
		"logging schema",
	);
	if (!section) return logs;

	const jsonMatch = section.match(/```json\n([\s\S]*?)\n```/);
	if (jsonMatch?.[1]) {
		try {
			const parsed = JSON.parse(jsonMatch[1]);
			logs.workflow_id = parsed.workflow_id || "";
			logs.fields = Object.keys(parsed);
		} catch {
			// Ignore parse errors.
		}
	}

	if (logs.fields.length === 0) {
		const fieldMatches = section.matchAll(/`([a-z_]+)`/g);
		for (const match of fieldMatches) {
			if (match[1] && !logs.fields.includes(match[1])) {
				logs.fields.push(match[1]);
			}
		}
	}

	if (logs.workflow_id === "" && logs.fields.includes("workflow_id")) {
		logs.workflow_id = "workflow_id";
	}

	return logs;
}

/**
 * Parse a source markdown file into a normalized workflow spec.
 */
export function parseSourceFile(sourcePath: string): WorkflowSpec | null {
	if (!existsSync(sourcePath)) {
		console.error(`Source file not found: ${sourcePath}`);
		return null;
	}

	const content = readFileSync(sourcePath, "utf8");
	const frontmatter = extractFrontmatter(content);
	const sections = extractSections(content);

	let title = frontmatter.title || "";
	if (!title) {
		const h1Match = content.match(/^#\s+(.+)$/m);
		if (h1Match?.[1]) {
			title = h1Match[1]
				.replace(/\s*[—-]\s*Compact Operational Spec.*$/i, "")
				.trim();
		}
	}

	const metadata = extractMetadataSection(sections);
	if (!metadata) {
		console.error("Could not extract metadata section");
		return null;
	}

	return {
		title,
		type: frontmatter.type || "operational-spec",
		status: frontmatter.status || "active",
		date: frontmatter.date || new Date().toISOString().slice(0, 10),
		origin: frontmatter.origin,
		metadata,
		errors: extractErrorsSection(sections),
		states: extractStatesSection(sections),
		transitions: extractTransitions(sections),
		invariants: extractInvariants(sections),
		idempotency: extractIdempotency(sections),
		modes: extractModes(sections),
		dryRun: extractDryRun(sections),
		logs: extractLogs(sections),
	};
}
