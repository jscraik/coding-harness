import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateSynaipseImprovementCase } from "./improvement-case.js";

const VALID_CASE = {
	schemaVersion: "synaipse-improvement-case/v1",
	caseId: "ch_case_7K4M2P9QX3DR",
	observedAt: "2026-07-13T14:00:00Z",
	observation: "Repeated stale collector evidence required manual steering.",
	classification: "systemic",
	siblingInventory: ["admission guardrail", "phase heartbeat"],
	candidates: [
		{
			mechanism: "validator",
			disposition: "selected",
			rationale: "Fail closed before routing.",
		},
		{
			mechanism: "prompt reminder",
			disposition: "rejected",
			rationale: "Does not prevent recurrence.",
		},
	],
	selectedMechanism: "validator",
	canary: "Run Slice 3 admission with stale collector fixture.",
	measurement: "Zero implementation routes when collector evidence is stale.",
	disposition: "change",
	owner: "SynAIpse",
	retirementCondition:
		"Remove after two clean release cycles with no recurrence.",
} as const;

describe("synaipse-improvement-case/v1", () => {
	it("accepts a complete systemic improvement case", () => {
		expect(validateSynaipseImprovementCase(VALID_CASE)).toEqual({
			valid: true,
			errors: [],
		});
	});

	it("requires a measurable canary and measurement", () => {
		const result = validateSynaipseImprovementCase({
			...VALID_CASE,
			measurement: " ",
		});
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({ path: "measurement" }),
		);
	});

	it("rejects more than one selected improvement mechanism", () => {
		const result = validateSynaipseImprovementCase({
			...VALID_CASE,
			candidates: VALID_CASE.candidates.map((candidate) => ({
				...candidate,
				disposition: "selected",
			})),
		});
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({ path: "selectedMechanism" }),
		);
	});

	it("keeps the schema contract's semantic selected-candidate binding explicit", () => {
		const result = validateSynaipseImprovementCase({
			...VALID_CASE,
			selectedMechanism: "prompt reminder",
		});
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({ path: "selectedMechanism" }),
		);
	});

	it("rejects unknown top-level properties", () => {
		const result = validateSynaipseImprovementCase({
			...VALID_CASE,
			unexpected: true,
		});
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({ path: "case.unexpected" }),
		);
	});

	it("rejects cases with no selected candidate", () => {
		const result = validateSynaipseImprovementCase({
			...VALID_CASE,
			candidates: VALID_CASE.candidates.map((candidate) => ({
				...candidate,
				disposition: "rejected",
			})),
		});
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({ path: "selectedMechanism" }),
		);
	});

	it("rejects unknown dispositions instead of silently accepting them", () => {
		const result = validateSynaipseImprovementCase({
			...VALID_CASE,
			disposition: "keep_everything",
		});
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({ path: "disposition" }),
		);
	});

	it("rejects an improvement case with no sibling inventory", () => {
		const result = validateSynaipseImprovementCase({
			...VALID_CASE,
			siblingInventory: [],
		});
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({ path: "siblingInventory" }),
		);
	});

	it("rejects an improvement case with unknown top-level properties", () => {
		const result = validateSynaipseImprovementCase({
			...VALID_CASE,
			unknownProperty: "unexpected",
		});
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({ path: "case.unknownProperty" }),
		);
	});

	it("rejects an improvement case with no selected candidate", () => {
		const result = validateSynaipseImprovementCase({
			...VALID_CASE,
			candidates: VALID_CASE.candidates.map((candidate) => ({
				...candidate,
				disposition: "rejected",
			})),
		});
		expect(result.valid).toBe(false);
		expect(result.errors).toContainEqual(
			expect.objectContaining({ path: "selectedMechanism" }),
		);
	});

	it("resolves a relative example path from an external cwd", () => {
		const result = spawnSync(
			process.execPath,
			[
				resolve("scripts/validate-synaipse-improvement-case.cjs"),
				"contracts/examples/synaipse-improvement-case.example.json",
			],
			{ cwd: "/tmp", encoding: "utf8" },
		);
		expect(result.status).toBe(0);
		expect(JSON.parse(result.stdout)).toEqual({ valid: true, errors: [] });
	});
});
