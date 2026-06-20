import { describe, expect, it } from "vitest";
import { validateFitnessReport } from "./validation.js";

function fitnessReport(overrides: Record<string, unknown> = {}) {
	return {
		schemaVersion: "harness-fitness/v1",
		status: "pass",
		generatedAt: "2026-06-20T00:00:00.000Z",
		summary: {
			lanes: 1,
			findings: 0,
			failures: 0,
			warnings: 0,
			lanesNeedingEvidence: 0,
		},
		lanes: [
			{
				id: "quality-budget",
				label: "Quality budget",
				command: "pnpm run quality:size",
				principle: "reduce_cognitive_load",
				enforcement: "quality_budget",
				status: "pass",
				evidenceSource: "artifacts/quality-size.json",
				findings: [],
			},
		],
		topDeterministicFinding: null,
		claimBoundaries: ["Fitness reports normalize local gate evidence only."],
		...overrides,
	};
}

function warningFinding() {
	return {
		id: "quality-budget:warning",
		title: "Advisory warning",
		severity: "warning",
		lane: "quality-budget",
		principle: "reduce_cognitive_load",
		enforcement: "advisory",
		evidence: { message: "warning" },
		risk: "Low severity advisory.",
		recommendedCommand: "pnpm run quality:size",
		claimBoundary: "Quality size evidence only.",
	};
}

function errorFinding() {
	return {
		...warningFinding(),
		id: "quality-budget:error",
		severity: "error",
		enforcement: "quality_budget",
	};
}

describe("validateFitnessReport", () => {
	it("rejects fail status without derived failures", () => {
		const result = validateFitnessReport(fitnessReport({ status: "fail" }));

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "status must be pass for derived lane/finding counts",
				}),
			]),
		);
	});

	it("rejects warn status without derived warnings", () => {
		const result = validateFitnessReport(fitnessReport({ status: "warn" }));

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "status must be pass for derived lane/finding counts",
				}),
			]),
		);
	});

	it("rejects warn status when failures require fail", () => {
		const finding = errorFinding();
		const result = validateFitnessReport(
			fitnessReport({
				status: "warn",
				summary: {
					lanes: 1,
					findings: 1,
					failures: 1,
					warnings: 0,
					lanesNeedingEvidence: 0,
				},
				lanes: [
					{
						id: "quality-budget",
						label: "Quality budget",
						command: "pnpm run quality:size",
						principle: "reduce_cognitive_load",
						enforcement: "quality_budget",
						status: "fail",
						evidenceSource: "artifacts/quality-size.json",
						findings: [finding],
					},
				],
				topDeterministicFinding: finding,
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "status must be fail for derived lane/finding counts",
				}),
			]),
		);
	});

	it("rejects warn status when missing lanes require evidence", () => {
		const result = validateFitnessReport(
			fitnessReport({
				status: "warn",
				summary: {
					lanes: 1,
					findings: 0,
					failures: 0,
					warnings: 0,
					lanesNeedingEvidence: 1,
				},
				lanes: [
					{
						id: "quality-budget",
						label: "Quality budget",
						command: "pnpm run quality:size",
						principle: "reduce_cognitive_load",
						enforcement: "quality_budget",
						status: "not_run",
						evidenceSource: "missing",
						findings: [],
					},
				],
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "status must be needs_evidence for derived lane/finding counts",
				}),
			]),
		);
	});

	it("rejects pass status when a lane status still fails", () => {
		const result = validateFitnessReport(
			fitnessReport({
				lanes: [
					{
						id: "quality-budget",
						label: "Quality budget",
						command: "pnpm run quality:size",
						principle: "reduce_cognitive_load",
						enforcement: "quality_budget",
						status: "fail",
						evidenceSource: "artifacts/quality-size.json",
						findings: [],
					},
				],
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "status must be fail for derived lane/finding counts",
				}),
			]),
		);
	});

	it("rejects fail lane status without failure finding evidence", () => {
		const result = validateFitnessReport(
			fitnessReport({
				status: "fail",
				lanes: [
					{
						id: "quality-budget",
						label: "Quality budget",
						command: "pnpm run quality:size",
						principle: "reduce_cognitive_load",
						enforcement: "quality_budget",
						status: "fail",
						evidenceSource: "artifacts/quality-size.json",
						findings: [],
					},
				],
			}),
		);

		expect(result.valid).toBe(false);
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "lanes[0].status fail requires failure finding evidence",
				}),
			]),
		);
	});

	it("accepts warn status when derived warnings exist without failures", () => {
		const finding = warningFinding();
		const result = validateFitnessReport(
			fitnessReport({
				status: "warn",
				summary: {
					lanes: 1,
					findings: 1,
					failures: 0,
					warnings: 1,
					lanesNeedingEvidence: 0,
				},
				lanes: [
					{
						id: "quality-budget",
						label: "Quality budget",
						command: "pnpm run quality:size",
						principle: "reduce_cognitive_load",
						enforcement: "quality_budget",
						status: "warn",
						evidenceSource: "artifacts/quality-size.json",
						findings: [finding],
					},
				],
			}),
		);

		expect(result).toEqual({ valid: true, errors: [] });
	});
});
