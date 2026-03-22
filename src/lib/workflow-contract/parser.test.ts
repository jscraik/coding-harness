import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	parseWorkflowFile,
	parseFrontmatter,
	type ParseError,
} from "./parser.js";
import { checkWorkflowContract } from "./checker.js";

// ─── Helpers ────────────────────────────────────────────────────────────────────

function hasError(errors: ParseError[], code: string): boolean {
	return errors.some((e: ParseError) => e.code === code);
}

/** Build a minimal valid workflow markdown file. */
function minimalWorkflow(): string {
	return `---
title: Test Workflow
---

# Test Workflow

## Metadata
| Field | Value |
| --- | --- |
| \`owner\` | test-team |
| \`max_duration\` | 30m |
| \`escalation\` | escalate to lead |
| \`change_class\` | behavior |

## Validation Contract
| Field | Requirement |
| --- | --- |
| \`test_mode\` | tdd-required |
| \`test_tier\` | integration |
| \`tracer_bullet_first\` | yes |
| \`red_evidence_required\` | yes |

## Transition Table (Canonical)
\`S | E | G | A | N\`

| S | E | G | A | N |
| --- | --- | --- | --- | --- |
| \`S0\` | \`start\` | preflight passes | initialize workflow | \`S1\` |
| \`S1\` | \`advance\` | validation pass | execute action | \`DONE\` |
| \`S1\` | \`blocked\` | dependency unavailable | emit unblock payload | \`BLOCKED\` |
| \`S1\` | \`error\` | unrecoverable issue | record failure | \`FAIL\` |

## Error Handling
- \`VALIDATION_ERROR\`
- \`BLOCKED_DEPENDENCY\`
- \`POLICY_FAIL\`
- \`SYSTEM_ERROR\`

## Execution Modes
- \`STRICT\`: hard-fail on violations.
- \`ADVISORY\`: emit warnings and continue.

## Dry-Run Simulation
- Dry-run has no side effects.
- Dry-run emits deterministic transition trace output.

## Observability Logs
Required fields:
- \`workflow_id\`
- \`transition_code\`
- \`from_state\`
- \`to_state\`
- \`correlation_id\`
- \`result\`
`;
}

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe("parseFrontmatter", () => {
	it("returns empty frontmatter when no --- delimiters", () => {
		const result = parseFrontmatter("# Just a heading\nSome content");
		expect(result.frontmatter).toEqual({});
		expect(result.body).toBe("# Just a heading\nSome content");
	});

	it("parses simple key-value pairs", () => {
		const content = `---
title: My Workflow
status: active
---

# Body`;
		const result = parseFrontmatter(content);
		expect(result.frontmatter.title).toBe("My Workflow");
		expect(result.frontmatter.status).toBe("active");
		expect(result.body).toBe("# Body");
	});

	it("parses arrays", () => {
		const content = `---
tags:
  - alpha
  - beta
---

body`;
		const result = parseFrontmatter(content);
		expect(result.frontmatter.tags).toEqual(["alpha", "beta"]);
	});

	it("handles quoted values", () => {
		const content = `---
name: "quoted value"
---
body`;
		const result = parseFrontmatter(content);
		expect(result.frontmatter.name).toBe("quoted value");
	});

	it("handles CRLF line endings", () => {
		const content = "---\r\ntitle: test\r\n---\r\n\r\nbody";
		const result = parseFrontmatter(content);
		expect(result.frontmatter.title).toBe("test");
		expect(result.body).toBe("body");
	});
});

describe("parseWorkflowFile", () => {
	it("parses a minimal valid workflow file", () => {
		const result = parseWorkflowFile(minimalWorkflow());
		expect(result.errors).toEqual([]);
		expect(result.contract.metadata.owner).toBe("test-team");
		expect(result.contract.metadata.change_class).toBe("behavior");
	});

	it("extracts metadata from the Metadata section", () => {
		const result = parseWorkflowFile(minimalWorkflow());
		expect(result.contract.metadata.owner).toBe("test-team");
		expect(result.contract.metadata.max_duration).toBe("30m");
		expect(result.contract.metadata.escalation).toBe("escalate to lead");
		expect(result.contract.metadata.change_class).toBe("behavior");
	});

	it("extracts validation contract", () => {
		const result = parseWorkflowFile(minimalWorkflow());
		expect(result.contract.validation_contract).toBeDefined();
		expect(result.contract.validation_contract.test_mode).toBe(
			"tdd-required",
		);
		expect(result.contract.validation_contract.test_tier).toBe(
			"integration",
		);
		expect(result.contract.validation_contract.tracer_bullet_first).toBe(
			"yes",
		);
		expect(
			result.contract.validation_contract.red_evidence_required,
		).toBe("yes");
	});

	it("extracts validation contract from an Invariants table", () => {
		const content = minimalWorkflow().replace(
			"## Validation Contract",
			"## Invariants",
		);
		const result = parseWorkflowFile(content);
		expect(result.contract.validation_contract).toBeDefined();
		expect(result.contract.validation_contract.test_mode).toBe(
			"tdd-required",
		);
		expect(result.contract.validation_contract.test_tier).toBe(
			"integration",
		);
	});

	it("extracts transitions from canonical table", () => {
		const result = parseWorkflowFile(minimalWorkflow());
		expect(result.contract.transitions).toHaveLength(4);
		expect(result.contract.transitions[0]).toEqual({
			S: "S0",
			E: "start",
			G: "preflight passes",
			A: "initialize workflow",
			N: "S1",
		});
	});

	it("extracts transitions from SEGAPRN tables", () => {
		const content = `## Metadata
| Field | Value |
| --- | --- |
| \`owner\` | team |
| \`max_duration\` | 12 turns |
| \`escalation\` | Block |
| \`change_class\` | behavior |

## Validation Contract
| Field | Requirement |
| --- | --- |
| \`test_mode\` | tdd-required |
| \`test_tier\` | integration |
| \`tracer_bullet_first\` | yes |
| \`red_evidence_required\` | yes |

## Transition Table (Canonical)
| S | E | G | A | P | R | N |
| --- | --- | --- | --- | --- | --- | --- |
| \`S0\` | \`start\` | ok | init | linear | success | \`S1\` |

## Error Handling
- \`VALIDATION_ERROR\`
- \`BLOCKED_DEPENDENCY\`
- \`POLICY_FAIL\`
- \`SYSTEM_ERROR\`

## Execution Modes
- \`STRICT\`

## Dry-Run Simulation
- no side effects
- deterministic trace

## Observability Logs
- \`workflow_id\`
- \`transition_code\`
- \`from_state\`
- \`to_state\`
- \`correlation_id\`
- \`result\`
`;
		const result = parseWorkflowFile(content);
		expect(result.errors).toEqual([]);
		expect(result.contract.transitions[0]).toEqual({
			S: "S0",
			E: "start",
			G: "ok",
			A: "init",
			P: "linear",
			R: "success",
			N: "S1",
		});
	});

	it("extracts error codes", () => {
		const result = parseWorkflowFile(minimalWorkflow());
		expect(result.contract.error_codes).toContain("VALIDATION_ERROR");
		expect(result.contract.error_codes).toContain("BLOCKED_DEPENDENCY");
		expect(result.contract.error_codes).toContain("POLICY_FAIL");
		expect(result.contract.error_codes).toContain("SYSTEM_ERROR");
	});

	it("extracts execution modes", () => {
		const result = parseWorkflowFile(minimalWorkflow());
		expect(result.contract.execution_modes).toContain("STRICT");
		expect(result.contract.execution_modes).toContain("ADVISORY");
	});

	it("extracts dry-run semantics", () => {
		const result = parseWorkflowFile(minimalWorkflow());
		expect(result.contract.dry_run.no_side_effects).toBe(true);
		expect(result.contract.dry_run.deterministic_trace).toBe(true);
	});

	it("extracts log fields", () => {
		const result = parseWorkflowFile(minimalWorkflow());
		expect(result.contract.log_fields).toContain("workflow_id");
		expect(result.contract.log_fields).toContain("transition_code");
		expect(result.contract.log_fields).toContain("from_state");
		expect(result.contract.log_fields).toContain("to_state");
		expect(result.contract.log_fields).toContain("correlation_id");
		expect(result.contract.log_fields).toContain("result");
	});

	it("reports error when metadata section is missing", () => {
		const content = `# No metadata here
## Transition Table (Canonical)
| S | E | G | A | N |
| --- | --- | --- | --- | --- |
| S0 | start | ok | go | S1 |
`;
		const result = parseWorkflowFile(content);
		expect(hasError(result.errors, "PARSE_MISSING_SECTION")).toBe(true);
	});

	it("reports error when transition table is missing", () => {
		const content = `## Metadata
| Field | Value |
| --- | --- |
| \`owner\` | team |
| \`max_duration\` | 10m |
| \`escalation\` | call someone |
| \`change_class\` | behavior |
`;
		const result = parseWorkflowFile(content);
		expect(hasError(result.errors, "PARSE_MISSING_SECTION")).toBe(true);
	});

	it("handles 'Execution contract' as alternate metadata heading", () => {
		const content = `## Execution contract
| Field | Value |
| --- | --- |
| \`owner\` | team |
| \`max_duration\` | 12 turns |
| \`escalation\` | Block at S4 BLOCKED |

## Transition Table (Canonical)
| S | E | G | A | N |
| --- | --- | --- | --- | --- |
| S0 | start | ok | init | DONE |

## Error Handling
- \`VALIDATION_ERROR\`
- \`BLOCKED_DEPENDENCY\`
- \`POLICY_FAIL\`
- \`SYSTEM_ERROR\`

## Execution Modes
- STRICT: hard-fail
- ADVISORY: warn

## Dry-Run Simulation
No side effects. Deterministic trace output.

## Observability Logs
- \`workflow_id\`
- \`transition_code\`
- \`from_state\`
- \`to_state\`
- \`correlation_id\`
- \`result\`
`;
		const result = parseWorkflowFile(content);
		expect(result.contract.metadata.owner).toBe("team");
		expect(result.contract.metadata.max_duration).toBe("12 turns");
	});

	it("extracts frontmatter separately from contract", () => {
		const result = parseWorkflowFile(minimalWorkflow());
		expect(result.frontmatter.title).toBe("Test Workflow");
	});
});

describe("parse → check integration", () => {
	it("minimal workflow passes both parse and check", () => {
		const parseResult = parseWorkflowFile(minimalWorkflow());
		expect(parseResult.errors).toEqual([]);

		const checkResult = checkWorkflowContract(parseResult.contract);
		expect(checkResult.pass).toBe(true);
		expect(checkResult.summary.errors).toBe(0);
	});
});

describe("real WORKFLOW.md integration", () => {
	it("parses the real WORKFLOW.md file", () => {
		const repoRoot = resolve(__dirname, "../../..");
		const content = readFileSync(
			resolve(repoRoot, "WORKFLOW.md"),
			"utf-8",
		);
		const result = parseWorkflowFile(content);

		// Should extract metadata
		expect(result.contract.metadata.owner).toBe(
			"coding-harness-maintainers",
		);
		expect(result.contract.metadata.max_duration).toBeTruthy();
		expect(result.contract.metadata.escalation).toBeTruthy();

		// Should have frontmatter (Symphony config)
		expect(result.frontmatter).toBeDefined();
	});

	it("extracts transitions from real WORKFLOW.md", () => {
		const repoRoot = resolve(__dirname, "../../..");
		const content = readFileSync(
			resolve(repoRoot, "WORKFLOW.md"),
			"utf-8",
		);
		const result = parseWorkflowFile(content);

		expect(result.contract.transitions.length).toBeGreaterThan(0);
		// First transition should be S0 TODO → start
		const first = result.contract.transitions[0];
		expect(first?.S).toContain("S0");
	});

	it("extracts all 4 error codes from real WORKFLOW.md", () => {
		const repoRoot = resolve(__dirname, "../../..");
		const content = readFileSync(
			resolve(repoRoot, "WORKFLOW.md"),
			"utf-8",
		);
		const result = parseWorkflowFile(content);

		expect(result.contract.error_codes).toContain("VALIDATION_ERROR");
		expect(result.contract.error_codes).toContain("BLOCKED_DEPENDENCY");
		expect(result.contract.error_codes).toContain("POLICY_FAIL");
		expect(result.contract.error_codes).toContain("SYSTEM_ERROR");
	});

	it("extracts both execution modes from real WORKFLOW.md", () => {
		const repoRoot = resolve(__dirname, "../../..");
		const content = readFileSync(
			resolve(repoRoot, "WORKFLOW.md"),
			"utf-8",
		);
		const result = parseWorkflowFile(content);

		expect(result.contract.execution_modes).toContain("STRICT");
		expect(result.contract.execution_modes).toContain("ADVISORY");
	});

	it("extracts dry-run semantics from real WORKFLOW.md", () => {
		const repoRoot = resolve(__dirname, "../../..");
		const content = readFileSync(
			resolve(repoRoot, "WORKFLOW.md"),
			"utf-8",
		);
		const result = parseWorkflowFile(content);

		expect(result.contract.dry_run.no_side_effects).toBe(true);
		expect(result.contract.dry_run.deterministic_trace).toBe(true);
	});

	it("extracts observability log fields from real WORKFLOW.md", () => {
		const repoRoot = resolve(__dirname, "../../..");
		const content = readFileSync(
			resolve(repoRoot, "WORKFLOW.md"),
			"utf-8",
		);
		const result = parseWorkflowFile(content);

		expect(result.contract.log_fields).toContain("workflow_id");
		expect(result.contract.log_fields).toContain("transition_code");
		expect(result.contract.log_fields).toContain("correlation_id");
		expect(result.contract.log_fields).toContain("result");
	});
});
