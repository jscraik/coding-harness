import { describe, expect, it } from "vitest";
import { EXIT_CODES, listPresets, showPreset } from "./preset.js";

describe("preset command", () => {
	describe("listPresets", () => {
		it("returns success with preset list", () => {
			const result = listPresets({ format: "json" });
			expect(result.ok).toBe(true);
			if (result.ok && "presets" in result.value) {
				expect(result.value.presets).toContain("typescript-base");
				expect(result.value.presets).toContain("python-base");
				expect(result.value.count).toBeGreaterThan(0);
			}
		});

		it("includes expected presets", () => {
			const result = listPresets({ format: "json" });
			expect(result.ok).toBe(true);
			if (result.ok && "presets" in result.value) {
				const expected = [
					"typescript-base",
					"python-base",
					"rust-base",
					"go-base",
					"swift-base",
					"minimal",
					"strict",
				];
				for (const preset of expected) {
					expect(result.value.presets).toContain(preset);
				}
			}
		});
	});

	describe("showPreset", () => {
		it("returns preset details for valid preset", () => {
			const result = showPreset("typescript-base", { format: "json" });
			expect(result.ok).toBe(true);
			if (result.ok && "preset" in result.value) {
				expect(result.value.name).toBe("typescript-base");
				expect(result.value.preset).toBeDefined();
				expect(result.value.preset?.version).toBe("1.0");
			}
		});

		it("returns error for unknown preset", () => {
			const result = showPreset("unknown-preset", { format: "json" });
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe(EXIT_CODES.PRESET_NOT_FOUND);
			}
		});
	});
});
