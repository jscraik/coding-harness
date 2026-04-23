import { spawnSync } from "node:child_process";
import {
	chmodSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const ACTIVE_WORKFLOW_FILES = [
	"WORKFLOW.md",
	"docs/agents/03-local-memory.md",
	"docs/agents/13-linear-production-workflow.md",
	"docs/agents/15-context-integrity-compact.md",
	"docs/agents/16-linear-production-compact.md",
	".agents/skills/coding-harness/references/setup-and-commands.md",
	"docs/specs/workflow-contract-v1.md",
];

const VALID_WORKFLOW_DOC = `## Abbreviations
| Abbr | Meaning |
| --- | --- |
| \`S\` | state |
| \`E\` | event |
| \`G\` | guard |
| \`A\` | action |
| \`N\` | next state |

## Metadata
| Field | Value |
| --- | --- |
| \`owner\` | \`repo-maintainers\` |
| \`max_duration\` | \`30m\` |

## Invariants
- Transition rows always preserve \`S | E | G | A | N\` semantics.

## States
\`\`\`txt
S0
DONE
FAIL
BLOCKED
\`\`\`

## Transition Table (Canonical)
\`S | E | G | A | N\`

| S | E | G | A | N |
| --- | --- | --- | --- | --- |
| \`S0\` | \`start\` | ready | run action | \`DONE\` |
| \`S0\` | \`blocked\` | dependency missing | emit unblock payload | \`BLOCKED\` |
| \`S0\` | \`error\` | policy fail | emit fail artifact | \`FAIL\` |

## Error Handling
- \`VALIDATION_ERROR\`
- \`BLOCKED_DEPENDENCY\`
- \`POLICY_FAIL\`
- \`SYSTEM_ERROR\`

## Idempotency
- Replay key: \`<workflow_id>|<event>|<from_state>|<correlation_id>\`

## Execution Modes
- \`STRICT\`
- \`ADVISORY\`

## Dry-Run Simulation
- no side effects
- deterministic transition trace output

## Observability Logs
\`workflow_id, transition_code, from_state, to_state, correlation_id, result\`

## Validation Checklist
- canonical transition table exists
- transition rows contain five cells
`;

function installScriptFixture(tempDir: string, filename: string): void {
	const source = join(process.cwd(), "scripts", filename);
	const target = join(tempDir, "scripts", filename);
	writeFileSync(target, readFileSync(source, "utf-8"), "utf-8");
	chmodSync(target, 0o755);
}

function scaffoldWorkspace(
	tempDir: string,
	contentByPath: Record<string, string>,
): void {
	mkdirSync(join(tempDir, "scripts"), { recursive: true });
	installScriptFixture(tempDir, "validate-workflow-contracts.cjs");
	installScriptFixture(tempDir, "normalize-workflow-contracts.cjs");

	for (const relativePath of ACTIVE_WORKFLOW_FILES) {
		const absolutePath = join(tempDir, relativePath);
		mkdirSync(dirname(absolutePath), { recursive: true });
		writeFileSync(absolutePath, contentByPath[relativePath] ?? "", "utf-8");
	}
}

function runScript(tempDir: string, scriptName: string) {
	return spawnSync("node", [join(tempDir, "scripts", scriptName)], {
		cwd: tempDir,
		encoding: "utf-8",
	});
}

describe("workflow contract scripts", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		for (const tempDir of tempDirs.splice(0)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("passes workflow validation for fully compliant documents", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "workflow-contract-pass-"));
		tempDirs.push(tempDir);

		const contentByPath = Object.fromEntries(
			ACTIVE_WORKFLOW_FILES.map((path) => [path, VALID_WORKFLOW_DOC]),
		);
		scaffoldWorkspace(tempDir, contentByPath);

		const result = runScript(tempDir, "validate-workflow-contracts.cjs");
		expect(result.status).toBe(0);
		expect(result.stdout).toContain("workflow-contract-v1: pass");
	});

	it("fails workflow validation when required headings are missing", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "workflow-contract-fail-"));
		tempDirs.push(tempDir);

		const invalidDoc = VALID_WORKFLOW_DOC.replace(
			"## Execution Modes",
			"## Execution Mode",
		);
		const contentByPath = Object.fromEntries(
			ACTIVE_WORKFLOW_FILES.map((path) => [path, invalidDoc]),
		);
		scaffoldWorkspace(tempDir, contentByPath);

		const result = runScript(tempDir, "validate-workflow-contracts.cjs");
		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"missing required section heading: execution modes",
		);
	});

	it.each([
		{
			name: "transition rows must have exactly five cells",
			mutate: (doc: string) =>
				doc.replace(
					"| `S0` | `start` | ready | run action | `DONE` |",
					"| `S0` | `start` | ready | run action |",
				),
			expectedError: "row does not contain exactly 5 cells",
		},
		{
			name: "blocked/fail/error path is required",
			mutate: (doc: string) =>
				doc
					.replace(
						"| `S0` | `blocked` | dependency missing | emit unblock payload | `BLOCKED` |\n",
						"",
					)
					.replace(
						"| `S0` | `error` | policy fail | emit fail artifact | `FAIL` |\n",
						"",
					),
			expectedError: "missing blocked/fail/error path in transition table",
		},
		{
			name: "required error codes must be present",
			mutate: (doc: string) => doc.replace("- `SYSTEM_ERROR`", ""),
			expectedError: "missing required error code: SYSTEM_ERROR",
		},
		{
			name: "STRICT and ADVISORY modes are required",
			mutate: (doc: string) =>
				doc.replace("- `STRICT`\n", "").replace("- `ADVISORY`\n", ""),
			expectedError: "missing required modes: STRICT and ADVISORY",
		},
		{
			name: "required observability fields must be present",
			mutate: (doc: string) => doc.replaceAll("correlation_id", "corr_id"),
			expectedError: "missing required observability field: correlation_id",
		},
		{
			name: "dry-run semantics must include deterministic no-side-effect guarantees",
			mutate: (doc: string) =>
				doc.replace(
					"- no side effects\n- deterministic transition trace output",
					"- best effort dry run output",
				),
			expectedError:
				"dry-run simulation must include no side effects + deterministic trace semantics",
		},
	])("fails workflow validation when $name", ({ mutate, expectedError }) => {
		const tempDir = mkdtempSync(join(tmpdir(), "workflow-contract-invariant-"));
		tempDirs.push(tempDir);

		const invalidDoc = mutate(VALID_WORKFLOW_DOC);
		const contentByPath = Object.fromEntries(
			ACTIVE_WORKFLOW_FILES.map((path) => [path, invalidDoc]),
		);
		scaffoldWorkspace(tempDir, contentByPath);

		const result = runScript(tempDir, "validate-workflow-contracts.cjs");
		expect(result.status).toBe(1);
		expect(result.stderr).toContain(expectedError);
	});

	it("normalizes missing sections and then validates successfully", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "workflow-contract-normalize-"));
		tempDirs.push(tempDir);

		const contentByPath = Object.fromEntries(
			ACTIVE_WORKFLOW_FILES.map((path) => [path, "# Workflow Contract\n"]),
		);
		scaffoldWorkspace(tempDir, contentByPath);

		const normalizeResult = runScript(
			tempDir,
			"normalize-workflow-contracts.cjs",
		);
		expect(normalizeResult.status).toBe(0);
		expect(normalizeResult.stdout).toContain("workflow:normalize updated");

		const validateResult = runScript(
			tempDir,
			"validate-workflow-contracts.cjs",
		);
		expect(validateResult.status).toBe(0);

		const normalizeNoOpResult = runScript(
			tempDir,
			"normalize-workflow-contracts.cjs",
		);
		expect(normalizeNoOpResult.status).toBe(0);
		expect(normalizeNoOpResult.stdout).toContain("workflow:normalize no-op");
	});
});
