import { describe, expect, it, vi } from "vitest";
import { EXIT_CODES, listPresets, runPresetCLI, showPreset } from "./preset.js";

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

		it("emits YAML output when format is yaml", () => {
			const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {
				// noop
			});
			const result = listPresets({ format: "yaml" });

			expect(result.ok).toBe(true);
			expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining("presets:"));
			infoSpy.mockRestore();
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

		it("emits YAML output for preset show", () => {
			const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {
				// noop
			});
			const result = showPreset("typescript-base", { format: "yaml" });

			expect(result.ok).toBe(true);
			expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining("name:"));
			expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining("preset:"));
			infoSpy.mockRestore();
		});
	});

	describe("input validation", () => {
		it("emits JSON errors for preset show failures", async () => {
			const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {
				// noop
			});
			const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
				// noop
			});

			const result = await runPresetCLI(["show", "unknown-preset", "--json"]);

			expect(result.exitCode).toBe(EXIT_CODES.PRESET_NOT_FOUND);
			expect(errorSpy).not.toHaveBeenCalled();
			expect(JSON.parse(infoSpy.mock.calls[0]?.[0] as string)).toEqual(
				expect.objectContaining({
					ok: false,
					error: expect.objectContaining({
						code: EXIT_CODES.PRESET_NOT_FOUND,
					}),
				}),
			);
			infoSpy.mockRestore();
			errorSpy.mockRestore();
		});

		it("returns invalid argument for unknown subcommands", async () => {
			const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {
				// noop
			});

			const result = await runPresetCLI(["wat"]);

			expect(result.exitCode).toBe(EXIT_CODES.INVALID_ARGUMENT);
			infoSpy.mockRestore();
		});

		it("rejects preset name with path traversal in CLI", async () => {
			const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
				// noop
			});

			const result = await runPresetCLI(["show", "../etc/passwd"]);

			expect(result.exitCode).toBe(EXIT_CODES.INVALID_ARGUMENT);
			errorSpy.mockRestore();
		});

		it("rejects preset name with shell characters in CLI", async () => {
			const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
				// noop
			});

			const result = await runPresetCLI(["show", "test;rm -rf /"]);

			expect(result.exitCode).toBe(EXIT_CODES.INVALID_ARGUMENT);
			errorSpy.mockRestore();
		});

		it("rejects preset name with command substitution", async () => {
			const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
				// noop
			});

			const result = await runPresetCLI(["show", "test$(whoami)"]);

			expect(result.exitCode).toBe(EXIT_CODES.INVALID_ARGUMENT);
			errorSpy.mockRestore();
		});
	});
});
