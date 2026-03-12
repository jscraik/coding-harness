#!/usr/bin/env node

const { readFileSync, writeFileSync, existsSync } = require("node:fs");
const { resolve } = require("node:path");

const ACTIVE_WORKFLOW_FILES = [
	"WORKFLOW.md",
	"docs/agents/03-local-memory.md",
	"docs/agents/13-linear-production-workflow.md",
	"docs/agents/15-context-integrity-compact.md",
	"docs/agents/16-linear-production-compact.md",
	".agents/skills/coding-harness/references/setup-and-commands.md",
	"docs/specs/workflow-contract-v1.md",
];

const SECTION_TEMPLATES = [
	{
		heading: "abbreviations",
		body: `## Abbreviations
| Abbr | Meaning |
| --- | --- |
| \`S\` | state |
| \`E\` | event |
| \`G\` | guard |
| \`A\` | action |
| \`N\` | next state |
`,
	},
	{
		heading: "metadata",
		body: `## Metadata
| Field | Value |
| --- | --- |
| \`owner\` | \`TODO\` |
| \`max_duration\` | \`TODO\` |
| \`escalation\` | \`TODO\` |
`,
	},
	{
		heading: "invariants",
		body: `## Invariants
- TODO invariant 1
- TODO invariant 2
`,
	},
	{
		heading: "states",
		body: `## States
\`\`\`txt
S0 (non-terminal)
DONE (terminal)
FAIL (terminal)
BLOCKED (terminal)
\`\`\`
`,
	},
	{
		heading: "transition table (canonical)",
		body: `## Transition Table (Canonical)
\`S | E | G | A | N\`

| S | E | G | A | N |
| --- | --- | --- | --- | --- |
| \`S0\` | \`start\` | ready | execute action | \`DONE\` |
| \`S0\` | \`blocked\` | dependency missing | emit unblock payload | \`BLOCKED\` |
| \`S0\` | \`error\` | runtime/policy failure | emit fail artifact | \`FAIL\` |
`,
	},
	{
		heading: "error handling",
		body: `## Error Handling
- \`VALIDATION_ERROR\`
- \`BLOCKED_DEPENDENCY\`
- \`POLICY_FAIL\`
- \`SYSTEM_ERROR\`
`,
	},
	{
		heading: "idempotency",
		body: `## Idempotency
- Idempotency key: \`<workflow_id>|<event>|<from_state>|<correlation_id>\`
- Replay behavior: no duplicate side effects.
`,
	},
	{
		heading: "execution modes",
		body: `## Execution Modes
- \`STRICT\`: hard-fail on violations.
- \`ADVISORY\`: warn and continue when safe.
`,
	},
	{
		heading: "dry-run simulation",
		body: `## Dry-Run Simulation
- no side effects
- deterministic transition trace output
`,
	},
	{
		heading: "observability logs",
		body: `## Observability Logs
\`workflow_id, transition_code, from_state, to_state, correlation_id, result\`
`,
	},
	{
		heading: "validation checklist",
		body: `## Validation Checklist
- canonical \`S | E | G | A | N\` table exists
- every row has 5 non-empty cells
- required errors/modes/log fields exist
`,
	},
];

function normalizeHeading(line) {
	return line
		.replace(/^#{1,6}\s+/, "")
		.trim()
		.toLowerCase();
}

function collectHeadings(content) {
	return content
		.split(/\r?\n/)
		.filter((line) => /^#{1,6}\s+/.test(line))
		.map(normalizeHeading);
}

function ensureTrailingNewline(content) {
	return content.endsWith("\n") ? content : `${content}\n`;
}

function main() {
	let changedFiles = 0;

	for (const file of ACTIVE_WORKFLOW_FILES) {
		const abs = resolve(file);
		if (!existsSync(abs)) {
			console.error(`skip (missing): ${file}`);
			continue;
		}

		let content = readFileSync(abs, "utf8");
		const headings = collectHeadings(content);
		const missing = SECTION_TEMPLATES.filter(
			(section) => !headings.includes(section.heading),
		);

		if (missing.length === 0) {
			continue;
		}

		content = ensureTrailingNewline(content);
		content += "\n";
		for (const section of missing) {
			content += `${section.body}\n`;
		}

		writeFileSync(abs, content, "utf8");
		changedFiles += 1;
		console.info(
			`normalized: ${file} (inserted ${missing.length} missing section(s))`,
		);
	}

	if (changedFiles === 0) {
		console.info(
			"workflow:normalize no-op (all required sections already present)",
		);
		return;
	}

	console.info(`workflow:normalize updated ${changedFiles} file(s)`);
}

main();
