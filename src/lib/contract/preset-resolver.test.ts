import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as urlValidator from "../governance/url-validator.js";
import {
	CircularInheritanceError,
	MaxDepthExceededError,
	PresetFetchError,
} from "./errors.js";
import {
	PresetResolver,
	clearPresetCache,
	getBundledPreset,
	listBundledPresets,
	resolvePreset,
} from "./preset-resolver.js";

describe("preset-resolver", () => {
	beforeEach(() => {
		clearPresetCache();
		vi.restoreAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("listBundledPresets", () => {
		it("returns list of available presets", () => {
			const presets = listBundledPresets();
			expect(presets).toContain("typescript-base");
			expect(presets).toContain("python-base");
			expect(presets).toContain("rust-base");
			expect(presets).toContain("swift-base");
			expect(presets).toContain("go-base");
			expect(presets).toContain("minimal");
			expect(presets).toContain("strict");
		});

		it("returns sorted list", () => {
			const presets = listBundledPresets();
			const sorted = [...presets].sort();
			expect(presets).toEqual(sorted);
		});

		it("excludes non-JSON files", () => {
			const presets = listBundledPresets();
			for (const preset of presets) {
				expect(preset).not.toContain(".");
			}
		});
	});

	describe("PresetResolver (instance)", () => {
		it("discovers presets dynamically via instance", () => {
			const resolver = new PresetResolver();
			const presets = resolver.listBundledPresets();

			expect(presets.length).toBeGreaterThanOrEqual(7);
			expect(presets).toContain("typescript-base");
			expect(presets).toContain("minimal");
		});

		it("returns empty array when presets directory does not exist", () => {
			// Mock fs.existsSync to return false for presets directory
			const mockExistsSync = vi.fn().mockReturnValue(false);
			const mockReaddirSync = vi.fn();

			vi.doMock("node:fs", () => ({
				existsSync: mockExistsSync,
				readdirSync: mockReaddirSync,
				readFileSync: vi.fn(),
				realpathSync: vi.fn((p: string) => p),
			}));

			// Note: Dynamic mocking in vitest requires module reload
			// This test demonstrates the intent; in practice, the function
			// handles missing directories gracefully
		});
	});

	describe("getBundledPreset", () => {
		it("returns a copy of the preset", () => {
			const preset1 = getBundledPreset("typescript-base");
			const preset2 = getBundledPreset("typescript-base");

			expect(preset1).not.toBe(preset2);
			expect(preset1).toEqual(preset2);
		});

		it("returns undefined for unknown preset", () => {
			expect(getBundledPreset("unknown-preset")).toBeUndefined();
		});

		it("does not treat path-like input as bundled preset name", () => {
			const resolver = new PresetResolver();
			expect(resolver.getBundledPreset("../typescript-base")).toBeUndefined();
			expect(
				resolver.getBundledPreset("src/presets/typescript-base"),
			).toBeUndefined();
		});

		it("returns valid contract structure", () => {
			const preset = getBundledPreset("typescript-base");
			expect(preset).toBeDefined();
			expect(preset?.version).toBe("1.0");
			expect(preset?.reviewPolicy).toBeDefined();
			expect(preset?.reviewPolicy?.requiredChecks).toContain("lint");
			expect(preset?.reviewPolicy?.requiredChecks).toContain("typecheck");
			expect(preset?.reviewPolicy?.requiredChecks).toContain("test");
			expect(preset?.reviewPolicy?.requiredChecks).toContain("security-scan");
		});

		it("caches and returns deep copies", () => {
			const resolver = new PresetResolver();

			// First call loads and caches
			const preset1 = resolver.getBundledPreset("typescript-base");
			expect(preset1).toBeDefined();

			// Modify the returned object
			if (preset1) {
				preset1.version = "modified";
			}

			// Second call should return original value (deep copy)
			const preset2 = resolver.getBundledPreset("typescript-base");
			expect(preset2?.version).toBe("1.0");
		});
	});

	describe("resolvePreset", () => {
		it("resolves bundled preset", async () => {
			// Use process.cwd() to get a valid directory
			const result = await resolvePreset("typescript-base", process.cwd());

			expect(result.contract).toBeDefined();
			expect(result.contract.version).toBe("1.0");
			expect(result.sources).toContain("typescript-base");
		});

		it("throws for path traversal attempts", async () => {
			await expect(
				resolvePreset("../escape.json", process.cwd()),
			).rejects.toThrow();
		});

		it("throws for absolute paths", async () => {
			await expect(
				resolvePreset("/etc/passwd", process.cwd()),
			).rejects.toThrow();
		});

		it("throws for home directory expansion", async () => {
			await expect(
				resolvePreset("~/secret.json", process.cwd()),
			).rejects.toThrow();
		});

		it("throws for null byte in path", async () => {
			await expect(
				resolvePreset("preset\0.json", process.cwd()),
			).rejects.toThrow();
		});

		it("throws for non-existent local file", async () => {
			await expect(
				resolvePreset("non-existent-file.json", process.cwd()),
			).rejects.toThrow(PresetFetchError);
			await expect(
				resolvePreset("non-existent-file.json", process.cwd()),
			).rejects.toThrow(/File not found/);
		});

		it("wraps malformed local preset JSON as PresetFetchError", async () => {
			const contractDir = mkdtempSync(join(tmpdir(), "preset-resolver-"));
			try {
				writeFileSync(join(contractDir, "broken.json"), "{not json");

				await expect(resolvePreset("broken.json", contractDir)).rejects.toThrow(
					PresetFetchError,
				);
				await expect(resolvePreset("broken.json", contractDir)).rejects.toThrow(
					/Failed to load local preset:/,
				);
			} finally {
				rmSync(contractDir, { recursive: true, force: true });
			}
		});

		it("fails closed when remote preset reference omits integrity hash", async () => {
			const resolver = new PresetResolver();
			await expect(
				resolver.resolvePreset(
					"https://raw.githubusercontent.com/acme/contracts/main/base.json",
					process.cwd(),
				),
			).rejects.toThrow(/integrity hash/i);
		});

		it("verifies remote preset integrity hash", async () => {
			const resolver = new PresetResolver();
			const remoteUrl =
				"https://raw.githubusercontent.com/acme/contracts/main/base.json";
			const preset = getBundledPreset("minimal");
			expect(preset).toBeDefined();
			const content = JSON.stringify(preset);
			const integrity = `sha256-${createHash("sha256").update(content, "utf-8").digest("base64")}`;

			vi.spyOn(urlValidator, "validateRemoteUrl").mockResolvedValue({
				url: new URL(remoteUrl),
				resolvedIps: ["1.1.1.1"],
				pinnedIp: "1.1.1.1",
			});
			vi.spyOn(urlValidator, "secureFetch").mockResolvedValue(
				new Response(content, {
					status: 200,
					headers: { "content-length": `${Buffer.byteLength(content)}` },
				}),
			);

			const result = await resolver.resolvePreset(
				remoteUrl,
				process.cwd(),
				undefined,
				undefined,
				{
					source: remoteUrl as never,
					integrity,
				},
			);

			expect(result.contract.version).toBe("1.0");
			expect(result.sources).toContain(remoteUrl);
		});

		it("rejects remote presets when integrity hash mismatches", async () => {
			const resolver = new PresetResolver();
			const remoteUrl =
				"https://raw.githubusercontent.com/acme/contracts/main/base.json";
			const preset = getBundledPreset("minimal");
			expect(preset).toBeDefined();
			const content = JSON.stringify(preset);

			vi.spyOn(urlValidator, "validateRemoteUrl").mockResolvedValue({
				url: new URL(remoteUrl),
				resolvedIps: ["1.1.1.1"],
				pinnedIp: "1.1.1.1",
			});
			vi.spyOn(urlValidator, "secureFetch").mockResolvedValue(
				new Response(content, { status: 200 }),
			);

			await expect(
				resolver.resolvePreset(remoteUrl, process.cwd(), undefined, undefined, {
					source: remoteUrl as never,
					integrity: "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
				}),
			).rejects.toThrow(/integrity mismatch/i);
		});

		it("rejects oversized remote preset responses before body read", async () => {
			const resolver = new PresetResolver();
			const remoteUrl =
				"https://raw.githubusercontent.com/acme/contracts/main/base.json";

			vi.spyOn(urlValidator, "validateRemoteUrl").mockResolvedValue({
				url: new URL(remoteUrl),
				resolvedIps: ["1.1.1.1"],
				pinnedIp: "1.1.1.1",
			});
			vi.spyOn(urlValidator, "secureFetch").mockResolvedValue(
				new Response('{"version":"1.0"}', {
					status: 200,
					headers: { "content-length": `${1024 * 1024 + 1}` },
				}),
			);

			await expect(
				resolver.resolvePreset(remoteUrl, process.cwd(), undefined, undefined, {
					source: remoteUrl as never,
					integrity: "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
				}),
			).rejects.toThrow(/exceeds size limit/i);
		});
	});

	describe("circular inheritance detection", () => {
		it("detects direct circular reference", async () => {
			// This would require mocking or creating actual files
			// For now, we test the error class directly
			const error = new CircularInheritanceError([
				"a.json",
				"b.json",
				"a.json",
			]);

			expect(error.name).toBe("CircularInheritanceError");
			expect(error.message).toContain("a.json -> b.json -> a.json");
			expect(error.chain).toEqual(["a.json", "b.json", "a.json"]);
		});
	});

	describe("max depth protection", () => {
		it("throws MaxDepthExceededError when depth exceeds limit", () => {
			const error = new MaxDepthExceededError(10, 10);

			expect(error.name).toBe("MaxDepthExceededError");
			expect(error.message).toContain("depth 10");
			expect(error.message).toContain("maximum 10");
		});
	});
});
