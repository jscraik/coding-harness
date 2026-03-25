import {
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import type { WorkflowSpec } from "./workflow-generate.js";
import {
	generateMermaidDiagram,
	parseSourceFile,
	parseWorkflowGenerateArgs,
	runWorkflowGenerateCLI,
} from "./workflow-generate.js";

function createWorkflowSource(
	transitionHeader: string,
	transitionDivider: string,
	transitionRow: string,
): string {
	return [
		"---",
		"title: Test Workflow",
		"type: operational-spec",
		"status: active",
		"date: 2026-03-14",
		"---",
		"",
		"# Test Workflow — Compact Operational Spec",
		"",
		"## 1. Metadata",
		"",
		"| Field | Value |",
		"|-------|-------|",
		"| `owner` | `team` |",
		"| `max_duration` | `10 turns` |",
		"| `escalation` | `Block` |",
		"",
		"## 2. Errors",
		"",
		"| Error | Condition | Routing |",
		"|-------|-----------|---------|",
		"| `VALIDATION_ERROR` | bad | fail |",
		"| `BLOCKED_DEPENDENCY` | blocked | fail |",
		"| `POLICY_FAIL` | policy | fail |",
		"| `SYSTEM_ERROR` | system | fail |",
		"",
		"## 3. States",
		"",
		"S0 IDLE (non-terminal)",
		"S1 RUNNING (non-terminal)",
		"S2 DONE (terminal)",
		"",
		"## 4. Transition Table (Canonical)",
		"",
		transitionHeader,
		transitionDivider,
		transitionRow,
		"",
		"## 5. Invariants",
		"",
		"- keep safe",
		"",
		"## 6. Idempotency",
		"",
		"- Key: workflow-id",
		"",
		"## 9. Log Schema",
		"",
		"```json",
		"{",
		'  "workflow_id": "...",',
		'  "transition_code": "...",',
		'  "from_state": "...",',
		'  "to_state": "...",',
		'  "correlation_id": "...",',
		'  "result": "success|blocked|failed"',
		"}",
		"```",
	].join("\n");
}

function createScaffoldWorkflowSource(): string {
	return [
		"---",
		"title: Scaffold Workflow",
		"type: operational-spec",
		"status: active",
		"date: 2026-03-21",
		"---",
		"",
		"# Scaffold Workflow",
		"",
		"## Metadata",
		"| Field | Value |",
		"| --- | --- |",
		"| `owner` | team |",
		"| `max_duration` | 60m |",
		"| `escalation` | Block |",
		"| `change_class` | behavior |",
		"",
		"## Invariants",
		"| Field | Value |",
		"| --- | --- |",
		"| `test_mode` | tdd-required |",
		"| `test_tier` | integration |",
		"| `tracer_bullet_first` | yes |",
		"| `red_evidence_required` | yes |",
		"",
		"## States",
		"```txt",
		"S0 TODO (non-terminal)",
		"S1 IN_PROGRESS (non-terminal)",
		"S2 DONE (terminal)",
		"```",
		"",
		"## Transition Table (Canonical)",
		"`S | E | G | A | N`",
		"",
		"| S | E | G | A | N |",
		"| --- | --- | --- | --- | --- |",
		"| `S0 TODO` | `claim` | preflight passes | `harness linear claim --issue <LK>` | `S1 IN_PROGRESS` |",
		"| `S1 IN_PROGRESS` | `approved` | review passes | `harness linear close --issue <LK>` | `S2 DONE` |",
		"",
		"## Error Handling",
		"- `VALIDATION_ERROR`: invalid input",
		"- `BLOCKED_DEPENDENCY`: dependency missing",
		"- `POLICY_FAIL`: policy violation",
		"- `SYSTEM_ERROR`: runtime failure",
		"",
		"## Idempotency",
		"- Key: workflow-id",
		"- Replayed events no-op.",
		"",
		"## Execution Modes",
		"- `STRICT`: hard-fail on policy violations.",
		"- `ADVISORY`: warn and continue for non-safety issues.",
		"",
		"## Dry-Run Simulation",
		"- Dry-run has no side effects.",
		"- Dry-run emits deterministic transition trace output.",
		"",
		"## Observability Logs",
		"- `workflow_id`",
		"- `transition_code`",
		"- `from_state`",
		"- `to_state`",
		"- `correlation_id`",
		"- `result`",
	].join("\n");
}

describe("workflow-generate", () => {
	describe("parseSourceFile", () => {
		it("returns null for non-existent file", () => {
			const result = parseSourceFile("/nonexistent/path.md");
			expect(result).toBeNull();
		});

		it("parses scaffold-style workflow headings", () => {
			const root = mkdtempSync(join(tmpdir(), "workflow-generate-scaffold-"));
			const sourcePath = join(root, "WORKFLOW.md");
			writeFileSync(sourcePath, createScaffoldWorkflowSource(), "utf8");

			try {
				const result = parseSourceFile(sourcePath);
				expect(result).not.toBeNull();
				expect(result?.metadata.owner).toBe("team");
				expect(result?.transitions).toHaveLength(2);
				expect(result?.invariants).toEqual(
					expect.arrayContaining([
						"test_mode: tdd-required",
						"test_tier: integration",
						"tracer_bullet_first: yes",
						"red_evidence_required: yes",
					]),
				);
				expect(result?.errors.map((error) => error.code)).toEqual(
					expect.arrayContaining([
						"VALIDATION_ERROR",
						"BLOCKED_DEPENDENCY",
						"POLICY_FAIL",
						"SYSTEM_ERROR",
					]),
				);
				expect(result?.logs.fields).toEqual(
					expect.arrayContaining([
						"workflow_id",
						"transition_code",
						"from_state",
						"to_state",
						"correlation_id",
						"result",
					]),
				);
			} finally {
				rmSync(root, { recursive: true, force: true });
			}
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
		it("parses --format for the standalone entrypoint", () => {
			const options = parseWorkflowGenerateArgs([
				"--source",
				"workflow.md",
				"--output",
				"generated.md",
				"--format",
				"segaprn",
				"--watch",
			]);

			expect(options).toEqual({
				source: "workflow.md",
				output: "generated.md",
				format: "segaprn",
				json: false,
				dryRun: false,
				watch: true,
			});
		});

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
			const outside = mkdtempSync(join(tmpdir(), "workflow-generate-outside-"));
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
			const outside = mkdtempSync(join(tmpdir(), "workflow-generate-outside-"));
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

		it("renders SEGAPRN output when requested", () => {
			const previousCwd = process.cwd();
			const root = mkdtempSync(join(tmpdir(), "workflow-generate-format-"));
			const sourcePath = join(root, "workflow.md");
			const outputPath = join(root, "generated.md");

			writeFileSync(
				sourcePath,
				createWorkflowSource(
					"| S | E | G | A | P | R | N |",
					"|---|---|---|---|---|---|---|",
					"| `S0 IDLE` | `start` | always | run | linear | success | `S1 RUNNING` |",
				),
				"utf8",
			);

			try {
				process.chdir(root);
				const exitCode = runWorkflowGenerateCLI({
					source: "workflow.md",
					output: "generated.md",
					format: "segaprn",
				});
				expect(exitCode).toBe(0);

				const content = readFileSync(outputPath, "utf8");
				expect(content).toContain(
					"## 4. Transition Table (Canonical) — S | E | G | A | P | R | N",
				);
				expect(content).toContain("| S | E | G | A | P | R | N |");
				expect(content).toContain(
					"| `S0 IDLE` | `start` | always | run | linear | success | `S1 RUNNING` |",
				);
				const parsedOutput = parseSourceFile(outputPath);
				expect(parsedOutput?.transitions).toHaveLength(1);
				expect(parsedOutput?.transitions[0]).toMatchObject({
					state: "S0 IDLE",
					event: "start",
					plugin: "linear",
					result: "success",
					next: "S1 RUNNING",
				});
			} finally {
				process.chdir(previousCwd);
				rmSync(root, { recursive: true, force: true });
			}
		});

		it("keeps SEGARN output as the default format", () => {
			const previousCwd = process.cwd();
			const root = mkdtempSync(
				join(tmpdir(), "workflow-generate-default-format-"),
			);
			const sourcePath = join(root, "workflow.md");
			const outputPath = join(root, "generated.md");

			writeFileSync(
				sourcePath,
				createWorkflowSource(
					"| S | E | G | A | N |",
					"|---|---|---|---|---|",
					"| `S0 IDLE` | `start` | always | run | `S1 RUNNING` |",
				),
				"utf8",
			);

			try {
				process.chdir(root);
				const exitCode = runWorkflowGenerateCLI({
					source: "workflow.md",
					output: "generated.md",
				});
				expect(exitCode).toBe(0);

				const content = readFileSync(outputPath, "utf8");
				expect(content).toContain(
					"## 4. Transition Table (Canonical) — S | E | G | A | N",
				);
				expect(content).toContain("| S | E | G | A | N |");
				expect(content).not.toContain("| S | E | G | A | P | R | N |");
			} finally {
				process.chdir(previousCwd);
				rmSync(root, { recursive: true, force: true });
			}
		});
	});
});
