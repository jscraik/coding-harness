/**
 * P0 type tests for src/lib/output/types.ts
 *
 * Acceptance: SA1 — GateFinding and GateResult types exist and are exported.
 * These tests verify structural completeness at compile time and at runtime.
 *
 * P0-T1: TypeScript compilation succeeds with all three interfaces exported.
 * P0-T2: Hand-crafted objects satisfy each interface (catches field renames).
 */

import { describe, expect, it } from "vitest";
import type { AutoFixResult, GateFinding, GateResult } from "./types.js";

describe("GateFinding interface (SA1)", () => {
	it("P0-T2a: structurally valid GateFinding compiles and round-trips through JSON", () => {
		const finding: GateFinding = {
			id: "drift-gate.command.missing",
			severity: "error",
			gate: "drift-gate",
			message: "Missing required command",
			path: "src/commands/foo.ts",
			baseline: false,
			fix: {
				command: "harness drift-gate --fix",
				suppressible: false,
			},
		};

		const json = JSON.parse(JSON.stringify(finding)) as GateFinding;
		expect(json.id).toBe("drift-gate.command.missing");
		expect(json.severity).toBe("error");
		expect(json.gate).toBe("drift-gate");
		expect(json.baseline).toBe(false);
		expect(json.fix.suppressible).toBe(false);
	});

	it("P0-T2b: optional fields (path, command, manual) may be omitted", () => {
		const finding: GateFinding = {
			id: "policy-gate.result.error.0",
			severity: "warning",
			gate: "policy-gate",
			message: "Policy violation",
			baseline: false,
			fix: { suppressible: true },
		};

		expect(finding.path).toBeUndefined();
		expect(finding.fix.command).toBeUndefined();
		expect(finding.fix.manual).toBeUndefined();
	});

	it("P0-T2c: severity must be one of error | warning | info", () => {
		const severities: Array<GateFinding["severity"]> = ["error", "warning", "info"];
		for (const s of severities) {
			const f: GateFinding = {
				id: `test.${s}`,
				severity: s,
				gate: "test",
				message: "test",
				baseline: false,
				fix: { suppressible: false },
			};
			expect(["error", "warning", "info"]).toContain(f.severity);
		}
	});
});

describe("GateResult interface (SA1)", () => {
	it("P0-T2d: structurally valid GateResult compiles and round-trips through JSON", () => {
		const result: GateResult = {
			gate: "drift-gate",
			version: "1.0.0",
			timestamp: "2026-03-24T00:00:00.000Z",
			status: "fail",
			findings: [
				{
					id: "drift-gate.command.missing",
					severity: "error",
					gate: "drift-gate",
					message: "Missing required command",
					baseline: false,
					fix: { suppressible: false },
				},
			],
			summary: { errors: 1, warnings: 0, info: 0, total: 1 },
		};

		const json = JSON.parse(JSON.stringify(result)) as GateResult;
		expect(json.gate).toBe("drift-gate");
		expect(json.status).toBe("fail");
		expect(json.findings).toHaveLength(1);
		expect(json.summary.total).toBe(1);
		expect(json.summary.errors + json.summary.warnings + json.summary.info).toBe(
			json.summary.total,
		);
	});

	it("P0-T2e: GateResult status values cover all four states", () => {
		const statuses: Array<GateResult["status"]> = ["pass", "warn", "fail", "skipped"];
		for (const status of statuses) {
			const r: GateResult = {
				gate: "test",
				version: "1.0.0",
				timestamp: new Date().toISOString(),
				status,
				findings: [],
				summary: { errors: 0, warnings: 0, info: 0, total: 0 },
			};
			expect(["pass", "warn", "fail", "skipped"]).toContain(r.status);
		}
	});

	it("P0-T2f: GateResult.meta is optional and accepts arbitrary values", () => {
		const result: GateResult = {
			gate: "review-gate",
			version: "1.0.0",
			timestamp: new Date().toISOString(),
			status: "skipped",
			findings: [],
			summary: { errors: 0, warnings: 0, info: 0, total: 0 },
			meta: { reason: "async-gate-excluded-from-normalisation-v1" },
		};
		expect(result.meta?.["reason"]).toBe("async-gate-excluded-from-normalisation-v1");
	});

	it("P0-T2g: summary.total invariant — errors + warnings + info === total", () => {
		const result: GateResult = {
			gate: "drift-gate",
			version: "1.0.0",
			timestamp: new Date().toISOString(),
			status: "warn",
			findings: [],
			summary: { errors: 2, warnings: 3, info: 1, total: 6 },
		};
		expect(result.summary.errors + result.summary.warnings + result.summary.info).toBe(
			result.summary.total,
		);
	});
});

describe("AutoFixResult interface (SA1)", () => {
	it("P0-T2h: structurally valid AutoFixResult compiles and round-trips through JSON", () => {
		const result: AutoFixResult = {
			timestamp: "2026-03-24T00:00:00.000Z",
			dryRun: false,
			applied: [
				{
					findingId: "drift-gate.command.missing",
					command: "harness drift-gate --fix",
					exitCode: 0,
					stdout: "Fixed.",
					stderr: "",
				},
			],
			manual: [],
			summary: { total: 1, applied: 1, manual: 0, failed: 0 },
		};

		const json = JSON.parse(JSON.stringify(result)) as AutoFixResult;
		expect(json.dryRun).toBe(false);
		expect(json.applied).toHaveLength(1);
		expect(json.applied[0]?.exitCode).toBe(0);
		expect(json.manual).toHaveLength(0);
	});

	it("P0-T2i: dry-run AutoFixResult allows null exitCode and null stdout/stderr", () => {
		const result: AutoFixResult = {
			timestamp: new Date().toISOString(),
			dryRun: true,
			applied: [
				{
					findingId: "drift-gate.command.missing",
					command: "harness drift-gate --fix",
					exitCode: null,
					stdout: null,
					stderr: null,
				},
			],
			manual: [],
			summary: { total: 1, applied: 1, manual: 0, failed: 0 },
		};
		expect(result.applied[0]?.exitCode).toBeNull();
		expect(result.applied[0]?.stdout).toBeNull();
		expect(result.applied[0]?.stderr).toBeNull();
	});
});

describe("normalise.ts stub exports (SA1)", () => {
	it("P0-T3a: all six adapter functions are exported", async () => {
		const normalise = await import("./normalise.js");
		const exports = [
			"normaliseDriftGateResult",
			"normaliseDocsGateResult",
			"normalisePolicyGateResult",
			"normalisePrTemplateGateResult",
			"normalisePlanGateResult",
			"normaliseLinearGateResult",
		] as const;

		for (const name of exports) {
			expect(typeof normalise[name]).toBe("function");
		}
	});

	it("P0-T3b: P2/P2b/P3 stubs still throw 'not implemented'", async () => {
		const normalise = await import("./normalise.js");
		// Only the stubs (P2, P2b, P3) still accept unknown and throw
		const remainingStubs = [
			"normalisePolicyGateResult",
			"normalisePrTemplateGateResult",
			"normalisePlanGateResult",
			"normaliseLinearGateResult",
		] as const;

		for (const name of remainingStubs) {
			expect(() => normalise[name]({})).toThrow("not implemented");
		}
	});
});
