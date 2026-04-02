import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
/**
 * Tests for harness health command (JSC-67)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type HealthOptions, runAutoFix, runHealth } from "./health.js";

// Mock spawnSync to control gate subprocess results
vi.mock("node:child_process", async (importOriginal) => {
	const original = await importOriginal<typeof import("node:child_process")>();
	return { ...original, spawnSync: vi.fn(original.spawnSync) };
});

const mockSpawnSync = vi.mocked(spawnSync);

function makeTmpDir(): string {
	const dir = join(tmpdir(), `health-test-${Date.now()}`);
	mkdirSync(dir, { recursive: true });
	return dir;
}

function writeContract(dir: string): void {
	writeFileSync(
		join(dir, "harness.contract.json"),
		JSON.stringify({ version: "1.0.0" }),
	);
}

describe("runHealth", () => {
	let dir: string;

	beforeEach(() => {
		dir = makeTmpDir();
		mockSpawnSync.mockClear();
	});

	afterEach(() => {
		if (existsSync(dir)) {
			rmSync(dir, { recursive: true, force: true });
		}
		vi.restoreAllMocks();
	});

	it("skips all gates when no config files present", () => {
		const report = runHealth({ dir });

		expect(report.overall).toBe("green"); // no applicable gates → green
		expect(report.counts.skipped).toBeGreaterThan(0);
		expect(report.counts.error).toBe(0);
		// spawnSync should NOT be called for skipped gates
		expect(mockSpawnSync).not.toHaveBeenCalled();
	});

	it("reports green when all gates exit 0", () => {
		writeContract(dir);
		// All gate subprocesses return exit code 0
		mockSpawnSync.mockReturnValue({
			status: 0,
			stdout: "",
			stderr: "",
			pid: 1,
			output: [],
			signal: null,
		});

		const report = runHealth({ dir });

		expect(report.overall).toBe("green");
		expect(report.counts.error).toBe(0);
		expect(report.counts.warning).toBe(0);
		expect(report.counts.ok).toBeGreaterThan(0);
	});

	it("reports warning when one gate exits 1", () => {
		writeContract(dir);
		// drift-gate exits 1, others exit 0
		let callCount = 0;
		mockSpawnSync.mockImplementation(() => ({
			status: callCount++ === 0 ? 1 : 0,
			stdout: "",
			stderr: "",
			pid: 1,
			output: [],
			signal: null,
		}));

		const report = runHealth({ dir, gates: ["drift-gate"] });

		expect(report.overall).toBe("warning");
		expect(report.counts.warning).toBe(1);
		const driftResult = report.gates.find((g) => g.gate === "drift-gate");
		expect(driftResult?.status).toBe("warning");
	});

	it("reports error when gate exits 2+", () => {
		writeContract(dir);
		mockSpawnSync.mockReturnValue({
			status: 2,
			stdout: "",
			stderr: "",
			pid: 1,
			output: [],
			signal: null,
		});

		const report = runHealth({ dir, gates: ["drift-gate"] });

		expect(report.overall).toBe("error");
		expect(report.counts.error).toBe(1);
	});

	it("filters to only requested gates", () => {
		writeContract(dir);
		mockSpawnSync.mockReturnValue({
			status: 0,
			stdout: "",
			stderr: "",
			pid: 1,
			output: [],
			signal: null,
		});

		const options: HealthOptions = { dir, gates: ["drift-gate"] };
		const report = runHealth(options);

		// Only drift-gate should be in the results
		const gateNames = report.gates.map((g) => g.gate);
		expect(gateNames).toContain("drift-gate");
		// Other gates should not be present
		expect(gateNames).not.toContain("context-health");
	});

	it("handles gate subprocess timeout gracefully", () => {
		writeContract(dir);
		mockSpawnSync.mockReturnValue({
			status: null,
			stdout: "",
			stderr: "",
			pid: 1,
			output: [],
			signal: "SIGTERM",
			error: new Error("spawnSync: timeout"),
		});

		const report = runHealth({ dir, gates: ["drift-gate"] });

		// null status + signal → treated as error (exit code 2)
		const driftResult = report.gates.find((g) => g.gate === "drift-gate");
		expect(driftResult?.status).toBe("error");
	});

	it("never executes a cwd-controlled harness binary", () => {
		writeContract(dir);
		mockSpawnSync.mockReturnValue({
			status: 0,
			stdout: "",
			stderr: "",
			pid: 1,
			output: [],
			signal: null,
		});

		runHealth({ dir, gates: ["drift-gate"] });

		const firstCall = mockSpawnSync.mock.calls[0];
		expect(firstCall).toBeDefined();
		const command = firstCall?.[0];
		const args = firstCall?.[1];
		expect(command).toBe(process.execPath);
		expect(Array.isArray(args)).toBe(true);
		if (!Array.isArray(args)) {
			throw new Error("Expected spawn args to be an array");
		}
		expect(
			args.some(
				(arg: string) => arg.endsWith("cli.ts") || arg.endsWith("cli.js"),
			),
		).toBe(true);
		expect(args).toContain("drift-gate");
		if (process.execArgv.length === 0) {
			expect(args).toEqual(expect.arrayContaining(["--import", "tsx"]));
		} else {
			expect(args.slice(0, process.execArgv.length)).toEqual(process.execArgv);
		}
		// Must NOT invoke a bare "harness" string from PATH/node_modules
		expect(command).not.toBe("harness");
	});

	it("memory-gate is skipped when memory.json is missing", () => {
		writeContract(dir);
		// No memory.json, so memory-gate is not applicable
		// Don't write memory.json

		mockSpawnSync.mockReturnValue({
			status: 0,
			stdout: "",
			stderr: "",
			pid: 1,
			output: [],
			signal: null,
		});

		const report = runHealth({ dir, gates: ["memory-gate"] });
		const memGate = report.gates.find((g) => g.gate === "memory-gate");
		expect(memGate?.status).toBe("skipped");
	});

	it("includes all expected gate IDs in default run (with contract)", () => {
		writeContract(dir);
		mockSpawnSync.mockReturnValue({
			status: 0,
			stdout: "",
			stderr: "",
			pid: 1,
			output: [],
			signal: null,
		});

		const report = runHealth({ dir });
		const gateNames = report.gates.map((g) => g.gate);

		// All gates that require just a contract should be present
		expect(gateNames).toContain("drift-gate");
		expect(gateNames).toContain("gardener");
		expect(gateNames).toContain("context-health");
		expect(gateNames).toContain("ci-migrate");
	});

	it("report has valid structure with all required fields", () => {
		const report = runHealth({ dir });

		expect(report).toHaveProperty("version");
		expect(report).toHaveProperty("dir");
		expect(report).toHaveProperty("timestamp");
		expect(report).toHaveProperty("gates");
		expect(report).toHaveProperty("overall");
		expect(report).toHaveProperty("counts");
		expect(Array.isArray(report.gates)).toBe(true);
		expect(typeof report.timestamp).toBe("string");
		// timestamp should be a valid ISO date
		expect(new Date(report.timestamp).getTime()).toBeGreaterThan(0);
	});
});

// ─── P5: runAutoFix tests ─────────────────────────────────────────────────────

function makeGateResult(
	gate: string,
	findings: Array<{ id: string; command?: string; severity?: string }>,
): string {
	return JSON.stringify({
		gate,
		version: "0.8.2",
		timestamp: new Date().toISOString(),
		status: findings.length === 0 ? "pass" : "fail",
		findings: findings.map((f) => ({
			id: f.id,
			severity: f.severity ?? "error",
			gate,
			message: `${f.id} issue`,
			baseline: false,
			fix: {
				command: f.command,
				suppressible: false,
			},
		})),
		summary: {
			errors: findings.length,
			warnings: 0,
			info: 0,
			total: findings.length,
		},
	});
}

describe("runAutoFix (P5)", () => {
	let dir: string;

	beforeEach(() => {
		dir = makeTmpDir();
		writeContract(dir);
		mockSpawnSync.mockClear();
	});

	afterEach(() => {
		if (existsSync(dir)) {
			rmSync(dir, { recursive: true, force: true });
		}
		vi.restoreAllMocks();
	});

	it("P5-T1: dry-run returns findings but does not call spawnSync for fixes", () => {
		// First call = gate --json subprocess; returns a fixable finding
		mockSpawnSync.mockReturnValue({
			status: 1,
			stdout: makeGateResult("drift-gate", [
				{
					id: "drift-gate.test.rule",
					command: "harness drift-gate --seed-baseline",
				},
			]),
			stderr: "",
			pid: 1,
			output: [],
			signal: null,
		});

		const result = runAutoFix({ dir, gates: ["drift-gate"], dryRun: true });

		// Should have collected the fixable finding
		expect(result.dryRun).toBe(true);
		expect(result.findings.length).toBeGreaterThanOrEqual(1);
		expect(result.findings[0]?.outcome).toBe("dry_run");
		// spawnSync called once for the gate --json scan, NOT for fix execution
		expect(mockSpawnSync).toHaveBeenCalledTimes(1);
	});

	it("P5-T2: two fixable findings → spawnSync called twice (once each) after collection", () => {
		let callCount = 0;
		mockSpawnSync.mockImplementation(() => {
			callCount++;
			if (callCount === 1) {
				// First call: gate --json — return two fixable findings
				return {
					status: 1,
					stdout: makeGateResult("drift-gate", [
						{
							id: "drift-gate.test.rule1",
							command: "harness drift-gate --seed-baseline",
						},
						{
							id: "drift-gate.test.rule2",
							command: "harness drift-gate --seed-baseline",
						},
					]),
					stderr: "",
					pid: 1,
					output: [],
					signal: null,
				};
			}
			// calls 2 + 3: fix commands → success
			return {
				status: 0,
				stdout: "ok",
				stderr: "",
				pid: 1,
				output: [],
				signal: null,
			};
		});

		const result = runAutoFix({ dir, gates: ["drift-gate"], dryRun: false });

		expect(result.findings.length).toBe(2);
		// 1 gate scan + 2 fix executions
		expect(mockSpawnSync).toHaveBeenCalledTimes(3);
		expect(result.summary.applied).toBe(2);
		expect(result.summary.failed).toBe(0);
	});

	it("P5-T3: excluded command prefix is skipped, not executed", () => {
		mockSpawnSync.mockReturnValue({
			status: 1,
			stdout: makeGateResult("drift-gate", [
				{
					id: "drift-gate.branch.rule",
					// Excluded prefix command
					command: "harness branch-protect --repo org/repo",
				},
			]),
			stderr: "",
			pid: 1,
			output: [],
			signal: null,
		});

		const result = runAutoFix({ dir, gates: ["drift-gate"], dryRun: false });

		expect(result.findings[0]?.outcome).toBe("skipped");
		expect(result.summary.skipped).toBe(1);
		expect(result.summary.applied).toBe(0);
		// Only the gate --json collection call should have been made (not the excluded fix)
		expect(mockSpawnSync).toHaveBeenCalledTimes(1);
	});

	it("P5-T4: result has AutoFixResult shape with required fields", () => {
		mockSpawnSync.mockReturnValue({
			status: 0,
			stdout: makeGateResult("drift-gate", []),
			stderr: "",
			pid: 1,
			output: [],
			signal: null,
		});

		const result = runAutoFix({ dir, gates: ["drift-gate"], dryRun: true });

		expect(result).toHaveProperty("dir");
		expect(result).toHaveProperty("timestamp");
		expect(result).toHaveProperty("dryRun", true);
		expect(result).toHaveProperty("findings");
		expect(result).toHaveProperty("summary");
		expect(result.summary).toHaveProperty("total");
		expect(result.summary).toHaveProperty("applied");
		expect(result.summary).toHaveProperty("failed");
		expect(result.summary).toHaveProperty("skipped");
	});

	it("P5-T5: fix command exits non-zero → outcome=failed, remaining fixes continue", () => {
		let callCount = 0;
		mockSpawnSync.mockImplementation(() => {
			callCount++;
			if (callCount === 1) {
				// Gate scan: two fixable findings
				return {
					status: 1,
					stdout: makeGateResult("drift-gate", [
						{
							id: "drift-gate.rule.a",
							command: "harness drift-gate --seed-baseline",
						},
						{
							id: "drift-gate.rule.b",
							command: "harness drift-gate --seed-baseline",
						},
					]),
					stderr: "",
					pid: 1,
					output: [],
					signal: null,
				};
			}
			if (callCount === 2) {
				// First fix: fails
				return {
					status: 1,
					stdout: "",
					stderr: "error output",
					pid: 1,
					output: [],
					signal: null,
				};
			}
			// Second fix: succeeds
			return {
				status: 0,
				stdout: "done",
				stderr: "",
				pid: 1,
				output: [],
				signal: null,
			};
		});

		const result = runAutoFix({ dir, gates: ["drift-gate"], dryRun: false });

		// Both findings processed (continues after failure)
		expect(result.findings.length).toBe(2);
		expect(result.summary.failed).toBe(1);
		expect(result.summary.applied).toBe(1);
		// 1 scan + 2 fix attempts = 3 calls
		expect(mockSpawnSync).toHaveBeenCalledTimes(3);
		// Failed finding has outcome "failed"
		const failedFinding = result.findings.find((f) => f.outcome === "failed");
		expect(failedFinding).toBeTruthy();
		expect(failedFinding?.exitCode).toBe(1);
	});
});
