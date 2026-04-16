import { describe, expect, it } from "vitest";
import {
	type ControlDomain,
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
	});

	describe("getControlsByDomain", () => {
		it("returns only controls matching the domain", () => {
			const controls = getControlsByDomain("source_integrity");
			expect(controls.length).toBeGreaterThan(0);
			for (const c of controls) {
				expect(c.domain).toBe("source_integrity");
			}
		});

		it("returns empty for domains with no controls", () => {
			// All domains should have at least one control, but test the shape
			const result = getControlsByDomain("access_control" as ControlDomain);
			expect(Array.isArray(result)).toBe(true);
		});
	});

	describe("getControlsByFramework", () => {
		it("returns NIST_SP_800_218A controls", () => {
			const controls = getControlsByFramework("NIST_SP_800_218A");
			expect(controls.length).toBeGreaterThan(0);
			for (const c of controls) {
				const hasRef = c.references.some(
					(r) => r.framework === "NIST_SP_800_218A",
				);
				expect(hasRef).toBe(true);
			}
		});

		it("returns NIST_AI_RMF_1_0 controls", () => {
			const controls = getControlsByFramework("NIST_AI_RMF_1_0");
			expect(controls.length).toBeGreaterThan(0);
		});

		it("returns NIST_AI_600_1 controls", () => {
			const controls = getControlsByFramework("NIST_AI_600_1");
			expect(controls.length).toBeGreaterThan(0);
		});
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

		it("counts references by framework", () => {
			const report = generateControlMapReport();
			expect(report.byFramework.NIST_SP_800_218A).toBeGreaterThan(0);
			expect(report.byFramework.NIST_AI_RMF_1_0).toBeGreaterThan(0);
			expect(report.byFramework.NIST_AI_600_1).toBeGreaterThan(0);
		});
	});
});
