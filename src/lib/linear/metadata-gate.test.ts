import { describe, expect, it } from "vitest";
import {
	type ExecutionGateMetadata,
	validateBaseFields,
	validateBatchExecutionGate,
	validateExecutionGate,
} from "./metadata-gate.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const completeMetadata: ExecutionGateMetadata = {
	priority: 2,
	roadmapLabel: "Roadmap: Now",
	assignee: "user@example.com",
	projectLink: "coding-harness",
	title: "Test issue",
	description:
		"## Goal\nBuild something useful.\n\n## Acceptance criteria\n- Must pass tests",
	labels: ["Roadmap: Now", "Bug"],
};

// ---------------------------------------------------------------------------
// validateBaseFields
// ---------------------------------------------------------------------------

describe("validateBaseFields", () => {
	it("passes when all base fields are present", () => {
		const result = validateBaseFields(completeMetadata);
		expect(result.valid).toBe(true);
		expect(result.missingFields).toHaveLength(0);
	});

	it("detects missing priority", () => {
		const result = validateBaseFields({
			...completeMetadata,
			priority: null,
		});
		expect(result.valid).toBe(false);
		expect(result.missingFields).toContain("priority");
	});

	it("detects missing assignee", () => {
		const result = validateBaseFields({
			...completeMetadata,
			assignee: null,
		});
		expect(result.valid).toBe(false);
		expect(result.missingFields).toContain("assignee");
	});

	it("detects missing project link", () => {
		const result = validateBaseFields({
			...completeMetadata,
			projectLink: null,
		});
		expect(result.valid).toBe(false);
		expect(result.missingFields).toContain("projectLink");
	});

	it("accepts lane label as substitute for roadmapLabel", () => {
		const result = validateBaseFields({
			...completeMetadata,
			roadmapLabel: null,
			labels: ["Lane A", "Bug"],
		});
		expect(result.valid).toBe(true);
	});

	it("detects missing roadmap when no label match", () => {
		const result = validateBaseFields({
			...completeMetadata,
			roadmapLabel: null,
			labels: ["Bug"],
		});
		expect(result.valid).toBe(false);
		expect(result.missingFields).toContain("roadmapLabel");
	});

	it("reports multiple missing fields", () => {
		const result = validateBaseFields({
			priority: null,
			roadmapLabel: null,
			assignee: null,
			projectLink: null,
			title: "Bare issue",
			description: null,
			labels: [],
		});
		expect(result.valid).toBe(false);
		expect(result.missingFields).toHaveLength(4);
	});
});

// ---------------------------------------------------------------------------
// validateExecutionGate — Todo target
// ---------------------------------------------------------------------------

describe("validateExecutionGate (Todo target)", () => {
	it("passes when all required fields are present", () => {
		const result = validateExecutionGate({
			metadata: completeMetadata,
			targetState: "todo",
		});
		expect(result.pass).toBe(true);
		expect(result.fallback.action).toBe("allow");
		expect(result.failedFields).toHaveLength(0);
	});

	it("fails when priority is missing", () => {
		const result = validateExecutionGate({
			metadata: { ...completeMetadata, priority: null },
			targetState: "todo",
		});
		expect(result.pass).toBe(false);
		expect(result.failedFields.some((f) => f.field === "priority")).toBe(true);
	});

	it("fails when assignee is missing", () => {
		const result = validateExecutionGate({
			metadata: { ...completeMetadata, assignee: null },
			targetState: "todo",
		});
		expect(result.pass).toBe(false);
		expect(result.failedFields.some((f) => f.field === "assignee")).toBe(true);
	});

	it("fails when problem statement pattern is missing", () => {
		const result = validateExecutionGate({
			metadata: {
				...completeMetadata,
				description: "Just some text without any structured sections",
			},
			targetState: "todo",
		});
		expect(result.pass).toBe(false);
		expect(
			result.failedFields.some((f) => f.field === "problemStatement"),
		).toBe(true);
	});

	it("detects problem statement from description patterns", () => {
		const result = validateExecutionGate({
			metadata: {
				...completeMetadata,
				description: "## Goal\nBuild the metadata gate module.",
			},
			targetState: "todo",
		});
		expect(result.pass).toBe(true);
	});

	it("acceptance criteria is optional for Todo", () => {
		const result = validateExecutionGate({
			metadata: {
				...completeMetadata,
				description: "## Goal\nBuild something.\nNo acceptance criteria here.",
			},
			targetState: "todo",
		});
		expect(result.pass).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// validateExecutionGate — In Progress target
// ---------------------------------------------------------------------------

describe("validateExecutionGate (In Progress target)", () => {
	it("passes when all 6 fields are present", () => {
		const result = validateExecutionGate({
			metadata: completeMetadata,
			targetState: "in_progress",
		});
		expect(result.pass).toBe(true);
		expect(result.completeness).toBe(1);
	});

	it("fails when acceptance criteria pattern is missing", () => {
		const result = validateExecutionGate({
			metadata: {
				...completeMetadata,
				description: "## Goal\nBuild something.\nNo criteria here.",
			},
			targetState: "in_progress",
		});
		expect(result.pass).toBe(false);
		expect(
			result.failedFields.some((f) => f.field === "acceptanceCriteria"),
		).toBe(true);
	});

	it("detects acceptance criteria from description patterns", () => {
		const result = validateExecutionGate({
			metadata: {
				...completeMetadata,
				description:
					"## Goal\nBuild something.\n\nAcceptance criteria: must pass all tests.",
			},
			targetState: "in_progress",
		});
		expect(result.pass).toBe(true);
	});

	it("bounces to triage when base metadata is missing", () => {
		const result = validateExecutionGate({
			metadata: {
				...completeMetadata,
				priority: null,
				assignee: null,
			},
			targetState: "in_progress",
		});
		expect(result.pass).toBe(false);
		expect(result.fallback.bounceTarget).toBe("triage");
		expect(result.fallback.action).toBe("block");
	});

	it("bounces to todo when only acceptance criteria is missing", () => {
		const result = validateExecutionGate({
			metadata: {
				...completeMetadata,
				description: "## Goal\nBuild something.\nNo criteria here.",
			},
			targetState: "in_progress",
		});
		expect(result.pass).toBe(false);
		expect(result.fallback.bounceTarget).toBe("todo");
	});

	it("generates comment body for failed gate", () => {
		const result = validateExecutionGate({
			metadata: {
				...completeMetadata,
				priority: null,
			},
			targetState: "in_progress",
		});
		expect(result.fallback.commentBody).toContain("Metadata gate");
		expect(result.fallback.commentBody).toContain("priority");
	});

	it("warns when Todo target has only problem statement missing", () => {
		const result = validateExecutionGate({
			metadata: {
				...completeMetadata,
				description: "No structured sections at all just text.",
			},
			targetState: "todo",
		});
		expect(result.pass).toBe(false);
		expect(result.fallback.action).toBe("warn");
	});
});

// ---------------------------------------------------------------------------
// validateBatchExecutionGate
// ---------------------------------------------------------------------------

describe("validateBatchExecutionGate", () => {
	it("reports correct totals for mixed results", () => {
		const result = validateBatchExecutionGate({
			issues: [
				{
					identifier: "JSC-1",
					title: "Complete issue",
					metadata: completeMetadata,
				},
				{
					identifier: "JSC-2",
					title: "Missing priority",
					metadata: { ...completeMetadata, priority: null },
				},
				{
					identifier: "JSC-3",
					title: "Another complete",
					metadata: completeMetadata,
				},
			],
			targetState: "in_progress",
		});

		expect(result.total).toBe(3);
		expect(result.passed).toBe(2);
		expect(result.blocked).toBe(1);
		expect(result.details).toHaveLength(3);
		expect(result.details[1].missingFields).toContain("priority");
	});

	it("reports warned for Todo with partial metadata", () => {
		const result = validateBatchExecutionGate({
			issues: [
				{
					identifier: "JSC-4",
					title: "Missing problem statement",
					metadata: {
						...completeMetadata,
						description: "Plain text no structure.",
					},
				},
			],
			targetState: "todo",
		});

		expect(result.total).toBe(1);
		expect(result.warned).toBe(1);
		expect(result.details[0].action).toBe("warn");
	});
});
