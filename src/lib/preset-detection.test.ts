import { describe, expect, it } from "vitest";
import {
	detectEcosystem,
	detectEcosystemDetailed,
	ecosystemSupportsTypeCheck,
	getDefaultPresetForEcosystem,
	getEcosystemDescription,
} from "./preset-detection.js";

describe("preset-detection", () => {
	describe("detectEcosystem", () => {
		it("detects TypeScript from package.json", () => {
			// Use the current project as a test case
			const ecosystem = detectEcosystem(process.cwd());
			expect(ecosystem).toBe("typescript");
		});

		it("returns undefined when no ecosystem detected", () => {
			// Use a directory that doesn't have any ecosystem markers
			const ecosystem = detectEcosystem("/tmp");
			expect(ecosystem).toBeUndefined();
		});
	});

	describe("detectEcosystemDetailed", () => {
		it("returns detailed results with confidence", () => {
			const results = detectEcosystemDetailed(process.cwd());
			expect(results.length).toBeGreaterThan(0);
			expect(results[0]?.ecosystem).toBe("typescript");
			expect(results[0]?.confidence).toBeGreaterThan(0);
			expect(results[0]?.description).toBeDefined();
		});
	});

	describe("getDefaultPresetForEcosystem", () => {
		it("returns correct preset for each ecosystem", () => {
			expect(getDefaultPresetForEcosystem("typescript")).toBe(
				"typescript-base",
			);
			expect(getDefaultPresetForEcosystem("python")).toBe("python-base");
			expect(getDefaultPresetForEcosystem("rust")).toBe("rust-base");
			expect(getDefaultPresetForEcosystem("go")).toBe("go-base");
			expect(getDefaultPresetForEcosystem("swift")).toBe("swift-base");
		});

		it("returns undefined for unknown ecosystem", () => {
			expect(getDefaultPresetForEcosystem(undefined)).toBeUndefined();
		});
	});

	describe("getEcosystemDescription", () => {
		it("returns description for known ecosystems", () => {
			expect(getEcosystemDescription("typescript")).toBe(
				"TypeScript/JavaScript (Node.js)",
			);
			expect(getEcosystemDescription("python")).toBe("Python");
			expect(getEcosystemDescription("rust")).toBe("Rust");
		});

		it("returns Unknown for undefined", () => {
			expect(getEcosystemDescription(undefined)).toBe("Unknown");
		});
	});

	describe("ecosystemSupportsTypeCheck", () => {
		it("returns true for TypeScript", () => {
			expect(ecosystemSupportsTypeCheck("typescript")).toBe(true);
		});

		it("returns false for other ecosystems", () => {
			expect(ecosystemSupportsTypeCheck("python")).toBe(false);
			expect(ecosystemSupportsTypeCheck("rust")).toBe(false);
			expect(ecosystemSupportsTypeCheck("go")).toBe(false);
			expect(ecosystemSupportsTypeCheck(undefined)).toBe(false);
		});
	});
});
