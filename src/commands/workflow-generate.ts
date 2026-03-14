#!/usr/bin/env node
/**
 * Workflow Generate Command
 *
 * Generates compact operational specs from source markdown files with
 * workflow annotations. Supports S|E|G|A|P|R|N format with plugin capabilities.
 */

import { existsSync, readFileSync, watch, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export interface WorkflowGenerateOptions {
	source?: string | undefined;
	output?: string | undefined;
	format?: "segarn" | "segaprn" | undefined;
	json?: boolean | undefined;
	dryRun?: boolean | undefined;
	watch?: boolean | undefined;
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

function extractMetadataSection(
	content: string,
): WorkflowSpec["metadata"] | null {
	const match = content.match(/##\s+1\.\s*Metadata[\s\S]*?(?=##\s+2\.|$)/);
	if (!match?.[0]) return null;

	const section = match[0];
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

function extractErrorsSection(content: string): WorkflowSpec["errors"] {
	const errors: WorkflowSpec["errors"] = [];

	// Try section 2 (Errors) first
	let match = content.match(/##\s+2\.\s*Errors?[\s\S]*?(?=##\s+3\.|$)/);

	// Fall back to searching for error table anywhere
	if (!match) {
		match = content.match(/(\|\s*Error\s*\|[\s\S]*?)(?=\n\s*##|\n\s*$)/);
	}

	if (!match) return errors;

	const lines = match[0].split("\n");
	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed.startsWith("|") || trimmed.includes("---")) continue;

		const cells = trimmed
			.split("|")
			.slice(1, -1)
			.map((c) => c.trim().replace(/^`|`$/g, ""));

		if (cells.length >= 3) {
			const code = cells[0];
			const condition = cells[1];
			const routing = cells[2];
			if (code && condition && routing && REQUIRED_ERROR_CODES.includes(code)) {
				errors.push({
					code,
					condition,
					routing,
				});
			}
		}
	}

	return errors;
}

function extractStatesSection(content: string): WorkflowSpec["states"] {
	const states: WorkflowSpec["states"] = [];

	const match = content.match(/##\s+3\.\s*States?[\s\S]*?(?=##\s+4\.|$)/);
	if (!match) return states;

	const lines = match[0].split("\n");
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

function extractTransitions(content: string): TransitionRow[] {
	const transitions: TransitionRow[] = [];

	// Find transition table (section 4)
	const match = content.match(
		/##\s+4\.\s*Transition Table.*?\n\s*\|\s*S\s*\|\s*E\s*\|\s*G\s*\|\s*A\s*\|\s*N\s*\|[\s\S]*?(?=##\s+5\.|$)/,
	);
	if (!match) return transitions;

	const lines = match[0].split("\n");
	let inTable = false;

	for (const line of lines) {
		const trimmed = line.trim();

		if (!inTable) {
			if (/^\|\s*S\s*\|\s*E\s*\|\s*G\s*\|\s*A\s*\|\s*N\s*\|/.test(trimmed)) {
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

		if (cells.length === 5) {
			const state = cells[0]?.replace(/^`|`$/g, "");
			const event = cells[1]?.replace(/^`|`$/g, "");
			const guard = cells[2];
			const action = cells[3];
			const next = cells[4]?.replace(/^`|`$/g, "");
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
					next,
				});
			}
		}
	}

	return transitions;
}

function extractInvariants(content: string): string[] {
	const invariants: string[] = [];

	// Section 5 in standard format
	const match = content.match(/##\s+5\.\s*Invariants?[\s\S]*?(?=##\s+6\.|$)/);
	if (!match) return invariants;

	const lines = match[0].split("\n");
	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed.startsWith("- ")) {
			invariants.push(trimmed.slice(2));
		}
	}

	return invariants;
}

function extractIdempotency(content: string): WorkflowSpec["idempotency"] {
	const result: WorkflowSpec["idempotency"] = {
		key: "",
		notes: [],
	};

	// Section 6 in standard format
	const match = content.match(/##\s+6\.\s*Idempotency[\s\S]*?(?=##\s+7\.|$)/);
	if (!match) return result;

	const section = match[0];

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

function extractModes(content: string): WorkflowSpec["modes"] {
	const modes: WorkflowSpec["modes"] = {
		strict: "",
		advisory: "",
	};

	// Usually section 10
	const match = content.match(/##\s+10\.\s*Modes?[\s\S]*?(?=##\s+11\.|$)/);
	if (!match) return modes;

	const lines = match[0].split("\n");
	let currentMode: "strict" | "advisory" | null = null;

	for (const line of lines) {
		const trimmed = line.trim();
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

function extractDryRun(content: string): WorkflowSpec["dryRun"] {
	const dryRun: WorkflowSpec["dryRun"] = {
		description: "",
		trace: "",
	};

	// Usually section 11
	const match = content.match(/##\s+11\.\s*Dry-Run[\s\S]*?(?=##\s+12\.|$)/);
	if (!match) return dryRun;

	const lines = match[0].split("\n");
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

function extractLogs(content: string): WorkflowSpec["logs"] {
	const logs: WorkflowSpec["logs"] = {
		workflow_id: "",
		fields: [],
	};

	// Usually section 9
	const match = content.match(/##\s+9\.\s*Log Schema[\s\S]*?(?=##\s+10\.|$)/);
	if (!match) return logs;

	const jsonMatch = match[0].match(/```json\n([\s\S]*?)\n```/);
	if (jsonMatch?.[1]) {
		try {
			const parsed = JSON.parse(jsonMatch[1]);
			logs.workflow_id = parsed.workflow_id || "";
			logs.fields = Object.keys(parsed);
		} catch {
			// Ignore parse errors
		}
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

function generateSpecOutput(spec: WorkflowSpec, format: string): string {
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

	output += `
## 4. Transition Table (Canonical) — S | E | G | A | N

| S | E | G | A | N |
|---|---|---|---|---|
`;

	for (const t of spec.transitions) {
		output += `| \`${t.state}\` | \`${t.event}\` | ${t.guard} | ${t.action} | \`${t.next}\` |\n`;
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

	const metadata = extractMetadataSection(content);
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
		errors: extractErrorsSection(content),
		states: extractStatesSection(content),
		transitions: extractTransitions(content),
		invariants: extractInvariants(content),
		idempotency: extractIdempotency(content),
		modes: extractModes(content),
		dryRun: extractDryRun(content),
		logs: extractLogs(content),
	};

	return spec;
}

function generateWorkflowSpec(
	sourcePath: string,
	options: {
		json?: boolean | undefined;
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
		options.json ? "json" : "markdown",
	);

	if (options.dryRun) {
		console.info("Dry-run mode: generated spec (not written)");
		console.info("---");
		console.info(outputContent);
		return 0;
	}

	if (options.output) {
		const outputPath = resolve(options.output);
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
		json = false,
		dryRun = false,
		watch: watchMode = false,
	} = options;

	if (!source) {
		console.error("Error: --source is required");
		console.error(
			"Usage: harness workflow:generate --source <path> [--output <path>] [--json] [--dry-run] [--watch]",
		);
		return 1;
	}

	const sourcePath = resolve(source);

	if (!watchMode) {
		return generateWorkflowSpec(sourcePath, { json, dryRun, output });
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
	const args = process.argv.slice(2);

	const sourceIndex = args.indexOf("--source");
	const outputIndex = args.indexOf("--output");
	const jsonFlag = args.includes("--json");
	const dryRunFlag = args.includes("--dry-run");
	const watchFlag = args.includes("--watch");

	const options: WorkflowGenerateOptions = {
		source: sourceIndex >= 0 ? args[sourceIndex + 1] : undefined,
		output: outputIndex >= 0 ? args[outputIndex + 1] : undefined,
		json: jsonFlag,
		dryRun: dryRunFlag,
		watch: watchFlag,
	};

	const exitCode = runWorkflowGenerateCLI(options);
	// In watch mode, the process stays alive - don't exit
	if (!watchFlag) {
		process.exit(exitCode);
	}
}
