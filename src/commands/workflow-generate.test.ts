import { describe, expect, it } from "vitest";
import type { WorkflowSpec } from "./workflow-generate.js";
import {
	generateMermaidDiagram,
	parseSourceFile,
	runWorkflowGenerateCLI,
} from "./workflow-generate.js";

describe("workflow-generate", () => {
	describe("parseSourceFile", () => {
		it("returns null for non-existent file", () => {
			const result = parseSourceFile("/nonexistent/path.md");
			expect(result).toBeNull();
		});
	});

	describe("generateMermaidDiagram", () => {
		it("generates correct state diagram", () => {
			const spec: WorkflowSpec = {
				title: "Test Workflow",
				type: "operational-spec",
				status: "active",
				date: "2026-03-14",
				origin: undefined,
				metadata: {
					owner: "test",
					max_duration: "10 turns",
					escalation: "Block",
				},
				errors: [],
				states: [
					{ id: "S0", name: "IDLE", terminal: false },
					{ id: "S1", name: "RUNNING", terminal: false },
					{ id: "S2", name: "DONE", terminal: true },
				],
				transitions: [
					{
						state: "S0 IDLE",
						event: "start",
						guard: "always",
						action: "run",
						next: "S1 RUNNING",
					},
					{
						state: "S1 RUNNING",
						event: "complete",
						guard: "success",
						action: "finish",
						next: "S2 DONE",
					},
				],
				invariants: [],
				idempotency: { key: "", notes: [] },
				modes: { strict: "", advisory: "" },
				dryRun: { description: "", trace: "" },
				logs: { workflow_id: "", fields: [] },
			};

			const diagram = generateMermaidDiagram(spec);
			expect(diagram).toContain("stateDiagram-v2");
			expect(diagram).toContain("S0_IDLE");
			expect(diagram).toContain("S1_RUNNING");
			expect(diagram).toContain("S2_DONE");
			expect(diagram).toContain("S0_IDLE --> S1_RUNNING");
		});
	});

	describe("runWorkflowGenerateCLI", () => {
		it("returns error when source is not provided", () => {
			const exitCode = runWorkflowGenerateCLI({});
			expect(exitCode).toBe(1);
		});

		it("returns error for non-existent source", () => {
			const exitCode = runWorkflowGenerateCLI({ source: "/nonexistent.md" });
			expect(exitCode).toBe(1);
		});
	});
});
