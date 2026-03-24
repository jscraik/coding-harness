/**
 * Tests for harness health command (JSC-67)
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { runHealth, type HealthOptions } from "./health.js";

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
