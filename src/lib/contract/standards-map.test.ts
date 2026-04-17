import { describe, expect, it } from "vitest";
import {
	type StandardsFramework,
	generateControlMapReport,
	getAllControls,
	getControlById,
	getControlsByDomain,
	getControlsByFramework,
	getNonOverridableControls,
} from "./standards-map.js";

describe("standards-map", () => {
	describe("getAllControls", () => {
		it("returns a non-empty array of controls", () => {
			const controls = getAllControls();
			expect(controls.length).toBeGreaterThan(0);
		});

		it("each control has a unique ID", () => {
			const controls = getAllControls();
			const ids = controls.map((c) => c.id);
			const unique = new Set(ids);
			expect(unique.size).toBe(ids.length);
		});

		it("each control has required fields", () => {
			for (const control of getAllControls()) {
				expect(control.id).toBeTruthy();
				expect(control.name).toBeTruthy();
				expect(control.domain).toBeTruthy();
				expect(control.description).toBeTruthy();
				expect(control.contractConstructs.length).toBeGreaterThan(0);
				expect(control.references.length).toBeGreaterThan(0);
				expect(typeof control.nonOverridable).toBe("boolean");
			}
		});

		it("returns deep-cloned controls", () => {
			const first = getAllControls()[0];
			const second = getAllControls()[0];
			expect(first).toBeDefined();
			expect(second).toBeDefined();
			if (!first || !second) return;

			expect(first).not.toBe(second);
			expect(first.references).not.toBe(second.references);
			expect(first.references[0]).not.toBe(second.references[0]);
		});
	});

	describe("getControlsByDomain", () => {
		it.each(["source_integrity", "access_control"] as const)(
			"returns only controls matching %s",
			(domain) => {
				const controls = getControlsByDomain(domain);
				expect(Array.isArray(controls)).toBe(true);
				expect(controls.length).toBeGreaterThan(0);
				for (const control of controls) {
					expect(control.domain).toBe(domain);
				}
			},
		);
	});

	describe("getControlsByFramework", () => {
		it.each(["NIST_SP_800_218A", "NIST_AI_RMF_1_0", "NIST_AI_600_1"] as const)(
			"returns controls for framework %s",
			(framework) => {
				const controls = getControlsByFramework(framework);
				expect(controls.length).toBeGreaterThan(0);
				for (const control of controls) {
					expect(
						control.references.some(
							(reference) => reference.framework === framework,
						),
					).toBe(true);
				}
			},
		);
	});

	describe("getNonOverridableControls", () => {
		it("returns controls marked as non-overridable", () => {
			const controls = getNonOverridableControls();
			expect(controls.length).toBeGreaterThan(0);
			for (const c of controls) {
				expect(c.nonOverridable).toBe(true);
			}
		});

		it("includes contract integrity and SSRF controls", () => {
			const controls = getNonOverridableControls();
			const ids = controls.map((c) => c.id);
			expect(ids).toContain("WC-001"); // Contract integrity
			expect(ids).toContain("WC-002"); // SRI verification
			expect(ids).toContain("WC-004"); // SSRF protection
			expect(ids).toContain("WC-010"); // Control plane non-overridable
		});
	});

	describe("getControlById", () => {
		it("returns the control for a known ID", () => {
			const control = getControlById("WC-001");
			expect(control).toBeDefined();
			expect(control!.name).toBe("Contract integrity verification");
		});

		it("returns undefined for unknown ID", () => {
			const control = getControlById("WC-NONEXISTENT");
			expect(control).toBeUndefined();
		});
	});

	describe("generateControlMapReport", () => {
		it("produces a summary report", () => {
			const report = generateControlMapReport();
			expect(report.totalControls).toBe(getAllControls().length);
			expect(report.nonOverridableCount).toBe(
				getNonOverridableControls().length,
			);
			expect(report.controls.length).toBe(report.totalControls);
		});

		it("counts controls by domain", () => {
			const report = generateControlMapReport();
			expect(Object.keys(report.byDomain).length).toBeGreaterThan(0);
			const domainTotal = Object.values(report.byDomain).reduce(
				(sum, n) => sum + n,
				0,
			);
			expect(domainTotal).toBe(report.totalControls);
		});

		it("counts controls by framework", () => {
			const report = generateControlMapReport();
			const expected: Partial<Record<StandardsFramework, number>> = {};
			for (const control of getAllControls()) {
				const frameworks = new Set(
					control.references.map((ref) => ref.framework),
				);
				for (const framework of frameworks) {
					expected[framework] = (expected[framework] ?? 0) + 1;
				}
			}
			expect(report.byFramework).toEqual(expected);
		});
	});
});
