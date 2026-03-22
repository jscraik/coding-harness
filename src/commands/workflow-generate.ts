#!/usr/bin/env node
/**
 * Workflow Generate Command
 *
 * Generates compact operational specs from source markdown files with
 * workflow annotations. Supports S|E|G|A|P|R|N format with plugin capabilities.
 */

import { existsSync, readFileSync, watch, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { PathTraversalError, validatePath } from "../lib/input/validator.js";

export interface WorkflowGenerateOptions {
	source?: string | undefined;
	output?: string | undefined;
	format?: "segarn" | "segaprn" | undefined;
	json?: boolean | undefined;
	dryRun?: boolean | undefined;
	watch?: boolean | undefined;
}

export function parseWorkflowGenerateArgs(
	args: string[],
): WorkflowGenerateOptions {
	const sourceIndex = args.indexOf("--source");
	const outputIndex = args.indexOf("--output");
	const formatIndex = args.indexOf("--format");

	const formatCandidate = formatIndex >= 0 ? args[formatIndex + 1] : undefined;
	const format =
		formatCandidate === "segarn" || formatCandidate === "segaprn"
			? formatCandidate
			: undefined;

	return {
		source: sourceIndex >= 0 ? args[sourceIndex + 1] : undefined,
		output: outputIndex >= 0 ? args[outputIndex + 1] : undefined,
		format,
		json: args.includes("--json"),
		dryRun: args.includes("--dry-run"),
		watch: args.includes("--watch"),
	};
}

export interface TransitionRow {
	state: string;
	event: string;
	guard: string;
	action: string;
	plugin?: string;
	result?: string;
	next: string;
}

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

type WorkflowOutputFormat = "json" | "segarn" | "segaprn";

const REQUIRED_ERROR_CODES = [
	"VALIDATION_ERROR",
	"BLOCKED_DEPENDENCY",
	"POLICY_FAIL",
	"SYSTEM_ERROR",
];

const REQUIRED_LOG_FIELDS = [
	"workflow_id",
	"transition_code",
	"from_state",
	"to_state",
	"correlation_id",
	"result",
];

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
				sections.set(normalizeHeading(currentHeading), currentContent.join("\n").trim());
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
		sections.set(normalizeHeading(currentHeading), currentContent.join("\n").trim());
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
	const section = getSection(sections, "errors", "error handling", "error taxonomy");
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
					REQUIRED_ERROR_CODES.includes(code)
				) {
					errors.push({
						code,
						condition,
						routing,
					});
				}
			}
			continue;
		}

		const bulletMatch = trimmed.match(
			/^[-*]\s+`?([A-Z_]+)`?\s*:\s*(.+)$/,
		);
		if (
			bulletMatch?.[1] &&
			bulletMatch[2] &&
			REQUIRED_ERROR_CODES.includes(bulletMatch[1])
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

	const lines = section.split("\n");
	for (const line of lines) {
		const trimmed = line.trim();

		// Match S0 TODO (non-terminal) or S3 DONE (terminal) format
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

function extractTransitions(sections: Map<string, string>): TransitionRow[] {
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

	const lines = section.split("\n");
	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed.startsWith("- ")) {
			invariants.push(trimmed.slice(2));
			continue;
		}

		if (
			trimmed.startsWith("|") &&
			!/^\|\s*[-:\s|]+\|?$/.test(trimmed)
		) {
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

	// Extract key
	const keyMatch = section.match(/[Kk]ey:\s*([^\n]+)/);
	if (keyMatch?.[1]) result.key = keyMatch[1].trim();

	// Extract notes
	const lines = section.split("\n");
	for (const line of lines) {
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

	const lines = section.split("\n");
	let currentMode: "strict" | "advisory" | null = null;

	for (const line of lines) {
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

	const lines = section.split("\n");
	for (const line of lines) {
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
			// Ignore parse errors
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

export function generateMermaidDiagram(spec: WorkflowSpec): string {
	const stateLabels: Record<string, string> = {};
	for (const state of spec.states) {
		stateLabels[state.id] = `${state.id}_${state.name.replace(/\s+/g, "_")}`;
	}

	let diagram = "stateDiagram-v2\n";

	// State definitions with labels
	for (const state of spec.states) {
		const label = stateLabels[state.id];
		diagram += `    ${label}: ${state.id} ${state.name}\n`;
	}
	diagram += "\n";

	// Transitions
	for (const t of spec.transitions) {
		const fromState = spec.states.find(
			(s) => t.state.includes(s.id) || t.state.includes(s.name),
		);
		const toState = spec.states.find(
			(s) => t.next.includes(s.id) || t.next.includes(s.name),
		);

		if (fromState && toState) {
			const fromLabel = stateLabels[fromState.id];
			const toLabel = stateLabels[toState.id];
			diagram += `    ${fromLabel} --> ${toLabel} : ${t.event}\n`;
		}
	}

	return diagram;
}

function generateSpecOutput(
	spec: WorkflowSpec,
	format: WorkflowOutputFormat,
): string {
	if (format === "json") {
		return JSON.stringify(spec, null, 2);
	}

	// Markdown format (compact operational spec)
	// Avoid duplicating the suffix if the title already has it
	const titleBase = spec.title
		.replace(/\s*[—-]\s*Compact Operational Spec.*$/i, "")
		.trim();

	let output = `---
title: ${titleBase} — Compact Operational Spec
type: operational-spec
status: ${spec.status}
date: ${spec.date}
`;

	if (spec.origin) {
		output += `origin: ${spec.origin}\n`;
	}

	output += `---

# ${titleBase} — Compact Operational Spec

## 1. Metadata

| Field | Value |
|-------|-------|
| \`owner\` | \`${spec.metadata.owner}\` |
| \`max_duration\` | \`${spec.metadata.max_duration}\` |
| \`escalation\` | \`${spec.metadata.escalation}\` |

## 2. Errors

| Error | Condition | Routing |
|-------|-----------|---------|
`;

	for (const error of spec.errors) {
		output += `| \`${error.code}\` | ${error.condition} | ${error.routing} |\n`;
	}

	output += `
## 3. States

`;
	for (const state of spec.states) {
		output += `${state.id} ${state.name} (${state.terminal ? "terminal" : "non-terminal"})\n`;
	}

	const isSegaprn = format === "segaprn";
	output += isSegaprn
		? `
## 4. Transition Table (Canonical) — S | E | G | A | P | R | N

| S | E | G | A | P | R | N |
|---|---|---|---|---|---|---|
`
		: `
## 4. Transition Table (Canonical) — S | E | G | A | N

| S | E | G | A | N |
|---|---|---|---|---|
`;

	for (const t of spec.transitions) {
		output += isSegaprn
			? `| \`${t.state}\` | \`${t.event}\` | ${t.guard} | ${t.action} | ${t.plugin || ""} | ${t.result || ""} | \`${t.next}\` |\n`
			: `| \`${t.state}\` | \`${t.event}\` | ${t.guard} | ${t.action} | \`${t.next}\` |\n`;
	}

	output += `
## 5. Invariants

`;
	for (const invariant of spec.invariants) {
		output += `- ${invariant}\n`;
	}

	output += `
## 6. Idempotency

`;
	if (spec.idempotency.key) {
		output += `- Key: ${spec.idempotency.key}\n`;
	}
	for (const note of spec.idempotency.notes) {
		output += `- ${note}\n`;
	}

	output += `
## 7. Mermaid State Diagram (Derived Strictly from Table)

\`\`\`mermaid
${generateMermaidDiagram(spec)}
\`\`\`

## 8. Pseudocode (Executor)

\`\`\`ts
function execute(event: E): Transition {
  const key = computeIdempotencyKey(event, currentState);

  // Guards evaluated in order (first-match)
  switch (currentState) {
`;

	// Group transitions by state
	const byState: Record<string, TransitionRow[]> = {};
	for (const t of spec.transitions) {
		const arr = byState[t.state] ?? [];
		arr.push(t);
		byState[t.state] = arr;
	}

	for (const [state, trans] of Object.entries(byState)) {
		output += `    case "${state}":\n`;
		for (const t of trans) {
			output += `      if (event === "${t.event}" && guard("${t.guard}")) {\n`;
			output += `        action("${t.action}");\n`;
			output += `        return {N: "${t.next}"};\n`;
			output += "      }\n";
		}
		output += "      break;\n";
	}

	output += "  }\n";

	output += `}
\`\`\`

## 9. Log Schema

\`\`\`json
{
`;

	for (const field of spec.logs.fields) {
		output += `  "${field}": "...",\n`;
	}

	output += `  "result": "success|blocked|failed"
}
\`\`\`

## 10. Modes: STRICT | ADVISORY

| Mode | Behavior |
|------|----------|
| \`STRICT\` | ${spec.modes.strict || "Hard-fail on policy violations"} |
| \`ADVISORY\` | ${spec.modes.advisory || "Warning-only for non-safety violations"} |

## 11. Dry-Run Simulation

`;
	if (spec.dryRun.description) {
		output += `- ${spec.dryRun.description}\n`;
	}
	output += `- Evaluate all guards without side effects
- Emit trace: \`[S,E,G,A,N,decision]\` per transition attempt
- No writes to external systems (commands logged, not executed)
- Returns full transition path without mutation
`;

	return output;
}

export function parseSourceFile(sourcePath: string): WorkflowSpec | null {
	if (!existsSync(sourcePath)) {
		console.error(`Source file not found: ${sourcePath}`);
		return null;
	}

	const content = readFileSync(sourcePath, "utf8");
	const frontmatter = extractFrontmatter(content);
	const sections = extractSections(content);

	// Parse title from first heading or frontmatter
	let title = frontmatter.title || "";
	if (!title) {
		const h1Match = content.match(/^#\s+(.+)$/m);
		if (h1Match?.[1]) {
			// Remove " — Compact Operational Spec" suffix if present
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

	const spec: WorkflowSpec = {
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

	return spec;
}

function generateWorkflowSpec(
	sourcePath: string,
	options: {
		json?: boolean | undefined;
		format?: "segarn" | "segaprn" | undefined;
		dryRun?: boolean | undefined;
		output?: string | undefined;
	},
): number {
	const spec = parseSourceFile(sourcePath);

	if (!spec) {
		return 1;
	}

	// Validation
	const errors: string[] = [];

	if (spec.transitions.length === 0) {
		errors.push("No transitions found in source file");
	}

	for (const code of REQUIRED_ERROR_CODES) {
		if (!spec.errors.some((e) => e.code === code)) {
			errors.push(`Missing required error code: ${code}`);
		}
	}

	for (const field of REQUIRED_LOG_FIELDS) {
		if (!spec.logs.fields.includes(field)) {
			errors.push(`Missing required log field: ${field}`);
		}
	}

	if (errors.length > 0) {
		console.error("Validation errors:");
		for (const error of errors) {
			console.error(`  - ${error}`);
		}
		return 1;
	}

	const outputContent = generateSpecOutput(
		spec,
		options.json ? "json" : (options.format ?? "segarn"),
	);

	if (options.dryRun) {
		console.info("Dry-run mode: generated spec (not written)");
		console.info("---");
		console.info(outputContent);
		return 0;
	}

	if (options.output) {
		let outputPath: string;
		try {
			outputPath = validatePath(process.cwd(), options.output);
		} catch (error) {
			if (error instanceof PathTraversalError) {
				console.error(
					`Output path escapes working directory: ${options.output}`,
				);
				return 1;
			}
			console.error(
				`Invalid output path: ${
					error instanceof Error ? error.message : "Unknown error"
				}`,
			);
			return 1;
		}
		writeFileSync(outputPath, outputContent, "utf8");
		console.info(`Generated operational spec: ${outputPath}`);
	} else {
		console.info(outputContent);
	}

	return 0;
}

export function runWorkflowGenerateCLI(
	options: WorkflowGenerateOptions = {},
): number {
	const {
		source,
		output,
		format = "segarn",
		json = false,
		dryRun = false,
		watch: watchMode = false,
	} = options;

	if (!source) {
		console.error("Error: --source is required");
		console.error(
			"Usage: harness workflow:generate --source <path> [--output <path>] [--format <segarn|segaprn>] [--json] [--dry-run] [--watch]",
		);
		return 1;
	}

	let sourcePath: string;
	try {
		sourcePath = validatePath(process.cwd(), source);
	} catch (error) {
		if (error instanceof PathTraversalError) {
			console.error(`Source path escapes working directory: ${source}`);
			return 1;
		}
		console.error(
			`Invalid source path: ${
				error instanceof Error ? error.message : "Unknown error"
			}`,
		);
		return 1;
	}

	if (!watchMode) {
		return generateWorkflowSpec(sourcePath, {
			json,
			format,
			dryRun,
			output,
		});
	}

	// Watch mode
	if (!output) {
		console.error("Error: --output is required when using --watch");
		return 1;
	}

	console.info(`Watching: ${sourcePath}`);
	console.info(`Output: ${resolve(output)}`);
	console.info("Press Ctrl+C to stop\n");

	// Initial generation
	let lastResult = generateWorkflowSpec(sourcePath, {
		json,
		format,
		dryRun: false,
		output,
	});

	// Set up file watcher
	const watcher = watch(sourcePath, (eventType) => {
		if (eventType === "change") {
			console.info(
				`\n[${new Date().toISOString()}] File changed, regenerating...`,
			);
			lastResult = generateWorkflowSpec(sourcePath, {
				json,
				format,
				dryRun: false,
				output,
			});
			if (lastResult === 0) {
				console.info("✓ Regenerated successfully\n");
			} else {
				console.info("✗ Regeneration failed\n");
			}
		}
	});

	// Handle graceful shutdown
	process.on("SIGINT", () => {
		console.info("\nStopping watcher...");
		watcher.close();
		process.exit(0);
	});

	process.on("SIGTERM", () => {
		watcher.close();
		process.exit(0);
	});

	// Keep process alive
	return lastResult;
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
	const options = parseWorkflowGenerateArgs(process.argv.slice(2));

	const exitCode = runWorkflowGenerateCLI(options);
	// In watch mode, the process stays alive - don't exit
	if (!options.watch) {
		process.exit(exitCode);
	}
}
