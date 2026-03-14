import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

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

		// Security regression: --source must not accept paths outside cwd.
		it("rejects source paths outside cwd", () => {
			const previousCwd = process.cwd();
			const root = mkdtempSync(join(tmpdir(), "workflow-generate-root-"));
			const outside = mkdtempSync(
				join(tmpdir(), "workflow-generate-outside-"),
			);
			const sourcePath = join(outside, "workflow.md");
			writeFileSync(sourcePath, "# outside", "utf8");

			try {
				process.chdir(root);
				const exitCode = runWorkflowGenerateCLI({ source: sourcePath });
				expect(exitCode).toBe(1);
			} finally {
				process.chdir(previousCwd);
				rmSync(root, { recursive: true, force: true });
				rmSync(outside, { recursive: true, force: true });
			}
		});

		// Security regression: --output must not follow symlinks that escape cwd.
		// An attacker can place a symlink at a repo path pointing outside the
		// workspace; validatePath detects the dangling symlink and rejects it.
		it("rejects symlinked output paths that escape cwd", () => {
			const previousCwd = process.cwd();
			const root = mkdtempSync(join(tmpdir(), "workflow-generate-root-"));
			const outside = mkdtempSync(
				join(tmpdir(), "workflow-generate-outside-"),
			);
			const sourcePath = join(root, "workflow.md");
			const outsideOutput = join(outside, "owned.md");
			const outputLink = join(root, "out.md");
			// The symlink target doesn't exist yet — this is a dangling symlink,
			// exactly what validatePath guards against.
			symlinkSync(outsideOutput, outputLink);

			writeFileSync(
				sourcePath,
				[
					"---",
					"title: Test Workflow",
					"type: operational-spec",
					"status: active",
					"date: 2026-03-14",
					"---",
					"",
					"## 1. Metadata",
					"- Owner: team",
					"- Max Duration: 10 turns",
					"- Escalation: Block",
					"",
					"## 2. Errors",
					"| Code | Condition | Routing |",
					"|------|-----------|---------|",
					"| VALIDATION_ERROR | bad | fail |",
					"| BLOCKED_DEPENDENCY | blocked | fail |",
					"| POLICY_FAIL | policy | fail |",
					"| SYSTEM_ERROR | system | fail |",
					"",
					"## 3. States",
					"| ID | Name | Terminal |",
					"|----|------|----------|",
					"| S0 | IDLE | false |",
					"| S1 | DONE | true |",
					"",
					"## 4. Transition Table (S|E|G|A|N)",
					"| S | E | G | A | N |",
					"|---|---|---|---|---|",
					"| S0 IDLE | start | always | move | S1 DONE |",
					"",
					"## 5. Invariants",
					"- keep safe",
					"",
					"## 6. Idempotency",
					"- Key: id",
					"",
					"## 9. Logs",
					"- workflow_id",
					"- transition_code",
					"- from_state",
					"- to_state",
					"- correlation_id",
					"- result",
				].join("\n"),
				"utf8",
			);

			try {
				process.chdir(root);
				const exitCode = runWorkflowGenerateCLI({
					source: "workflow.md",
					output: "out.md",
				});
				expect(exitCode).toBe(1);
			} finally {
				process.chdir(previousCwd);
				rmSync(root, { recursive: true, force: true });
				rmSync(outside, { recursive: true, force: true });
			}
		});
	});
});

