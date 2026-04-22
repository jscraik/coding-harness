/**
 * Unit tests for src/commands/preflight-gate.ts CLI entry point.
 *
 * runPreflightGate is mocked so tests run without filesystem access.
 */

import {
	type MockInstance,
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

// Mock the underlying validator before importing the CLI (hoisting required)
vi.mock("../lib/preflight/validator.js", () => ({
	runPreflightGate: vi.fn(),
	EXIT_CODES: {
		SUCCESS: 0,
		POLICY_VIOLATION: 1,
		VALIDATION_ERROR: 2,
		CONTRACT_ERROR: 3,
		SYSTEM_ERROR: 10,
	},
}));

import type {
	PreflightAdmissionDeclaration,
	PreflightGateResult,
	PreflightNorthStarSummary,
} from "../lib/preflight/types.js";
import { runPreflightGate } from "../lib/preflight/validator.js";
import { EXIT_CODES, runPreflightGateCLI } from "./preflight-gate.js";

const mockRunPreflightGate = vi.mocked(runPreflightGate);

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makePassingResult(
	overrides: Partial<PreflightGateResult> = {},
): PreflightGateResult {
	return {
		passed: true,
		checks: [
			{
				id: "git-repository",
				description: "git repository",
				severity: "error",
				passed: true,
				durationMs: 2,
			},
		],
		summary: { total: 1, passed: 1, failed: 0, warnings: 0, durationMs: 2 },
		...overrides,
	};
}

function makeFailingResult(
	overrides: Partial<PreflightGateResult> = {},
): PreflightGateResult {
	return {
		passed: false,
		checks: [
			{
				id: "risk-tier",
				description: "Risk tier check",
				severity: "error",
				passed: false,
				message: "Risk tier high exceeds max medium",
				files: ["src/auth/login.ts"],
				durationMs: 5,
			},
		],
		summary: { total: 1, passed: 0, failed: 1, warnings: 0, durationMs: 5 },
		...overrides,
	};
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("runPreflightGateCLI", () => {
	let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
	let stdoutSpy: MockInstance<typeof process.stdout.write>;

	beforeEach(() => {
		vi.clearAllMocks();
		consoleInfoSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);
		consoleErrorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		stdoutSpy = vi
			.spyOn(process.stdout, "write")
			.mockImplementation(() => true);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("exit codes", () => {
		it("returns SUCCESS (0) when gate passes", async () => {
			mockRunPreflightGate.mockResolvedValue(makePassingResult());
			const code = await runPreflightGateCLI({
				contractPath: "harness.contract.json",
			});
			expect(code).toBe(EXIT_CODES.SUCCESS);
		});

		it("returns POLICY_VIOLATION (1) when gate fails", async () => {
			mockRunPreflightGate.mockResolvedValue(makeFailingResult());
			const code = await runPreflightGateCLI({
				contractPath: "harness.contract.json",
			});
			expect(code).toBe(EXIT_CODES.POLICY_VIOLATION);
		});

		it("returns CONTRACT_ERROR (3) when contract-load check fails", async () => {
			mockRunPreflightGate.mockResolvedValue(
				makeFailingResult({
					checks: [
						{
							id: "contract-load",
							description: "Load harness contract",
							severity: "error",
							passed: false,
							message: "Invalid contract: malformed JSON",
							durationMs: 1,
						},
					],
				}),
			);
			const code = await runPreflightGateCLI({
				contractPath: "harness.contract.json",
			});
			expect(code).toBe(EXIT_CODES.CONTRACT_ERROR);
		});

		it("returns CONTRACT_ERROR (3) when contract-exists check fails", async () => {
			mockRunPreflightGate.mockResolvedValue(
				makeFailingResult({
					checks: [
						{
							id: "contract-exists",
							description: "Verify harness contract exists",
							severity: "error",
							passed: false,
							message: "Contract not found: harness.contract.json",
							durationMs: 1,
						},
					],
				}),
			);
			const code = await runPreflightGateCLI({
				contractPath: "harness.contract.json",
			});
			expect(code).toBe(EXIT_CODES.CONTRACT_ERROR);
		});

		it("returns SYSTEM_ERROR (10) when validator throws unexpectedly", async () => {
			mockRunPreflightGate.mockRejectedValue(new Error("boom"));
			const code = await runPreflightGateCLI({
				contractPath: "harness.contract.json",
			});
			expect(code).toBe(EXIT_CODES.SYSTEM_ERROR);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining(
					"Preflight Gate Error: unexpected failure: Error: boom",
				),
			);
		});
	});

	describe("json output", () => {
		it("writes canonical GateResult JSON to stdout", async () => {
			mockRunPreflightGate.mockResolvedValue(makePassingResult());
			await runPreflightGateCLI({
				contractPath: "harness.contract.json",
				json: true,
			});

			expect(stdoutSpy).toHaveBeenCalledTimes(1);
			const written = stdoutSpy.mock.calls[0]?.[0] as string;
			const parsed = JSON.parse(written) as Record<string, unknown>;

			expect(parsed.gate).toBe("preflight-gate");
			expect(parsed.status).toBe("pass");
			expect(parsed).toHaveProperty("reason");
			expect(parsed).toHaveProperty("action_now");
			expect(parsed).toHaveProperty("action_later");
			expect(parsed).toHaveProperty("evidence_ref");
		});

		it("JSON output for failing gate contains findings", async () => {
			mockRunPreflightGate.mockResolvedValue(makeFailingResult());
			await runPreflightGateCLI({
				contractPath: "harness.contract.json",
				json: true,
			});

			const written = stdoutSpy.mock.calls[0]?.[0] as string;
			const parsed = JSON.parse(written) as Record<string, unknown>;

			expect(parsed.status).toBe("fail");
			expect(Array.isArray(parsed.findings)).toBe(true);
			expect((parsed.findings as unknown[]).length).toBeGreaterThan(0);
		});

		it("json=true does not write to console.info", async () => {
			mockRunPreflightGate.mockResolvedValue(makePassingResult());
			await runPreflightGateCLI({
				contractPath: "harness.contract.json",
				json: true,
			});

			expect(consoleInfoSpy).not.toHaveBeenCalled();
		});

		it("JSON output has summary with errors/warnings/info/total", async () => {
			mockRunPreflightGate.mockResolvedValue(makeFailingResult());
			await runPreflightGateCLI({
				contractPath: "harness.contract.json",
				json: true,
			});

			const written = stdoutSpy.mock.calls[0]?.[0] as string;
			const parsed = JSON.parse(written) as {
				summary: {
					errors: number;
					warnings: number;
					info: number;
					total: number;
				};
			};

			expect(typeof parsed.summary.errors).toBe("number");
			expect(typeof parsed.summary.total).toBe("number");
		});

		it("includes north-star summary and admission declaration in meta when present", async () => {
			const expectedNorthStarSummary: PreflightNorthStarSummary = {
				mission:
					"Coding Harness exists to let humans steer and agents execute safely, with PR lead time as the primary north-star metric.",
				primary_metric: "pr_lead_time",
				primary_bottleneck: "review_rework_loop",
				autonomy_boundary:
					"Low and medium-risk autonomy only; high-risk changes stay human-mediated.",
				safety_floor: [
					"deterministic evidence over intuition",
					"strict current-head SHA discipline",
				],
			};
			const expectedAdmissionDeclaration: PreflightAdmissionDeclaration = {
				north_star_metric: "pr_lead_time",
				primary_bottleneck: "review_rework_loop",
				affected_surface_ids: ["review-gate"],
				affected_surface_classes: ["core"],
				policy_surface_delta: 0,
				manual_glue_delta: -1,
				metric_impact_declared: "path_strengthening",
				evidence_links: ["docs/roadmap/north-star.md"],
				why_this_improves_throughput_or_reliability:
					"Reduces repeated reviewer correction loops.",
			};
			mockRunPreflightGate.mockResolvedValue(
				makePassingResult({
					northStarSummary: expectedNorthStarSummary,
					admissionDeclaration: expectedAdmissionDeclaration,
				}),
			);
			await runPreflightGateCLI({
				contractPath: "harness.contract.json",
				json: true,
			});

			const written = stdoutSpy.mock.calls[0]?.[0] as string;
			const parsed = JSON.parse(written) as {
				meta: Record<string, unknown>;
			};

			expect(parsed.meta.northStarSummary).toEqual(expectedNorthStarSummary);
			expect(parsed.meta.admissionDeclaration).toEqual(
				expectedAdmissionDeclaration,
			);
		});
	});

	describe("human-readable output", () => {
		it("prints ✓ icon and pass status on success", async () => {
			mockRunPreflightGate.mockResolvedValue(makePassingResult());
			await runPreflightGateCLI({
				contractPath: "harness.contract.json",
				json: false,
			});

			const lines = consoleInfoSpy.mock.calls.map((c) => String(c[0]));
			expect(lines.some((l) => l.includes("✓"))).toBe(true);
			expect(lines.some((l) => l.includes("pass"))).toBe(true);
		});

		it("prints ✗ icon and fail status on failure", async () => {
			mockRunPreflightGate.mockResolvedValue(makeFailingResult());
			await runPreflightGateCLI({
				contractPath: "harness.contract.json",
				json: false,
			});

			const lines = consoleInfoSpy.mock.calls.map((c) => String(c[0]));
			expect(lines.some((l) => l.includes("✗"))).toBe(true);
			expect(lines.some((l) => l.includes("fail"))).toBe(true);
		});

		it("prints Reason line", async () => {
			mockRunPreflightGate.mockResolvedValue(makePassingResult());
			await runPreflightGateCLI({
				contractPath: "harness.contract.json",
				json: false,
			});

			const lines = consoleInfoSpy.mock.calls.map((c) => String(c[0]));
			expect(lines.some((l) => l.startsWith("Reason:"))).toBe(true);
		});

		it("prints Action now section when gate fails", async () => {
			mockRunPreflightGate.mockResolvedValue(makeFailingResult());
			await runPreflightGateCLI({
				contractPath: "harness.contract.json",
				json: false,
			});

			const lines = consoleInfoSpy.mock.calls.map((c) => String(c[0]));
			expect(lines.some((l) => l.includes("Action now:"))).toBe(true);
		});

		it("prints summary line with check counts", async () => {
			mockRunPreflightGate.mockResolvedValue(makePassingResult());
			await runPreflightGateCLI({
				contractPath: "harness.contract.json",
				json: false,
			});

			const lines = consoleInfoSpy.mock.calls.map((c) => String(c[0]));
			expect(lines.some((l) => l.startsWith("Summary:"))).toBe(true);
		});

		it("prints Risk tier when riskTier is present", async () => {
			mockRunPreflightGate.mockResolvedValue(
				makePassingResult({ riskTier: "high" }),
			);
			await runPreflightGateCLI({
				contractPath: "harness.contract.json",
				json: false,
			});

			const lines = consoleInfoSpy.mock.calls.map((c) => String(c[0]));
			expect(
				lines.some((l) => l.includes("Risk tier") && l.includes("high")),
			).toBe(true);
		});

		it("does not print Risk tier line when riskTier is absent", async () => {
			mockRunPreflightGate.mockResolvedValue(makePassingResult());
			await runPreflightGateCLI({
				contractPath: "harness.contract.json",
				json: false,
			});

			const lines = consoleInfoSpy.mock.calls.map((c) => String(c[0]));
			expect(lines.some((l) => l.includes("Risk tier"))).toBe(false);
		});

		it("prints ⚠ icon when normalised status is warn", async () => {
			// passed=true, but a failing warning-severity check → normaliser produces warn
			mockRunPreflightGate.mockResolvedValue({
				passed: true,
				checks: [
					{
						id: "advisory-check",
						description: "Advisory check",
						severity: "warning",
						passed: false,
						message: "Consider updating",
						durationMs: 1,
					},
				],
				summary: {
					total: 1,
					passed: 0,
					failed: 0,
					warnings: 1,
					durationMs: 1,
				},
			});
			await runPreflightGateCLI({
				contractPath: "harness.contract.json",
				json: false,
			});

			const lines = consoleInfoSpy.mock.calls.map((c) => String(c[0]));
			expect(lines.some((l) => l.includes("⚠"))).toBe(true);
		});

		it("does not print json to stdout in human-readable mode", async () => {
			mockRunPreflightGate.mockResolvedValue(makePassingResult());
			await runPreflightGateCLI({
				contractPath: "harness.contract.json",
				json: false,
			});

			expect(stdoutSpy).not.toHaveBeenCalled();
		});
	});
});
