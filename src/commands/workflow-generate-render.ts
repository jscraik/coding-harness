import type {
	TransitionRow,
	WorkflowOutputFormat,
	WorkflowSpec,
} from "./workflow-generate-parser.js";

function renderFrontmatterHeader(spec: WorkflowSpec): string {
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

	return output;
}

function renderErrorsRows(spec: WorkflowSpec): string {
	let output = "";
	for (const error of spec.errors) {
		output += `| \`${error.code}\` | ${error.condition} | ${error.routing} |\n`;
	}
	return output;
}

function renderStatesAndTransitions(
	spec: WorkflowSpec,
	isSegaprn: boolean,
): string {
	let output = `
## 3. States

`;
	for (const state of spec.states) {
		output += `${state.id} ${state.name} (${state.terminal ? "terminal" : "non-terminal"})\n`;
	}

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

	return output;
}

function renderInvariantsAndIdempotency(spec: WorkflowSpec): string {
	let output = `
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

	return output;
}

function renderMermaidSection(spec: WorkflowSpec): string {
	return `
## 7. Mermaid State Diagram (Derived Strictly from Table)

\`\`\`mermaid
${generateMermaidDiagram(spec)}
\`\`\`
`;
}

function renderPseudocode(spec: WorkflowSpec): string {
	let output = `
## 8. Pseudocode (Executor)

\`\`\`ts
function execute(event: E): Transition {
  const key = computeIdempotencyKey(event, currentState);

  // Guards evaluated in order (first-match)
  switch (currentState) {
`;

	const byState: Record<string, TransitionRow[]> = {};
	for (const t of spec.transitions) {
		const arr = byState[t.state] ?? [];
		arr.push(t);
		byState[t.state] = arr;
	}

	for (const [state, trans] of Object.entries(byState)) {
		output += `    case "${state}":
`;
		for (const t of trans) {
			output += `      if (event === "${t.event}" && guard("${t.guard}")) {
`;
			output += `        action("${t.action}");
`;
			output += `        return {N: "${t.next}"};
`;
			output += "      \n";
		}
		output += `      break;
`;
	}

	output += `  }
}
\`\`\`
`;

	return output;
}

function renderLogSchema(spec: WorkflowSpec): string {
	let output = `
## 9. Log Schema

\`\`\`json
{
`;

	for (const field of spec.logs.fields) {
		output += `  "${field}": "...",
`;
	}

	output += `  "result": "success|blocked|failed"
}
\`\`\`
`;

	return output;
}

function renderModesTable(spec: WorkflowSpec): string {
	return `
## 10. Modes: STRICT | ADVISORY

| Mode | Behavior |
|------|----------|
| \`STRICT\` | ${spec.modes.strict || "Hard-fail on policy violations"} |
| \`ADVISORY\` | ${spec.modes.advisory || "Warning-only for non-safety violations"} |
`;
}

function renderDryRunSection(spec: WorkflowSpec): string {
	let output = `
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

/**
 * Render a Mermaid state diagram from a normalized workflow spec.
 */
export function generateMermaidDiagram(spec: WorkflowSpec): string {
	const stateLabels: Record<string, string> = {};
	for (const state of spec.states) {
		stateLabels[state.id] = `${state.id}_${state.name.replace(/\s+/g, "_")}`;
	}

	let diagram = "stateDiagram-v2\n";

	for (const state of spec.states) {
		const label = stateLabels[state.id];
		diagram += `    ${label}: ${state.id} ${state.name}\n`;
	}
	diagram += "\n";

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

/**
 * Render workflow output in the requested machine or markdown format.
 */
export function generateSpecOutput(
	spec: WorkflowSpec,
	format: WorkflowOutputFormat,
): string {
	if (format === "json") {
		return JSON.stringify(spec, null, 2);
	}

	const isSegaprn = format === "segaprn";

	let output = renderFrontmatterHeader(spec);
	output += renderErrorsRows(spec);
	output += renderStatesAndTransitions(spec, isSegaprn);
	output += renderInvariantsAndIdempotency(spec);
	output += renderMermaidSection(spec);
	output += renderPseudocode(spec);
	output += renderLogSchema(spec);
	output += renderModesTable(spec);
	output += renderDryRunSection(spec);

	return output;
}
