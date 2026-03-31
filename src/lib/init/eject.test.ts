import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EjectCancelledError, ejectHarness } from "./eject.js";
import { sanitizePath } from "./rollback.js";
import { HARNESS_DIR, MANIFEST_FILE } from "./types.js";

function writeRestoreManifest(
	root: string,
	files: Array<{
		path: string;
		action: "created" | "modified";
		backupHash?: string;
	}>,
): void {
	mkdirSync(join(root, HARNESS_DIR), { recursive: true });
	writeFileSync(
		join(root, HARNESS_DIR, MANIFEST_FILE),
		JSON.stringify({ files }, null, 2),
	);
}

describe("ejectHarness", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "harness-eject-test-"));
	});

	afterEach(() => {
		vi.restoreAllMocks();
		try {
			rmSync(tempDir, { recursive: true, force: true });
		} catch (_e) {
			// ignore
		}
	});

	it("safely ejects the harness footprints when forced", async () => {
		// Mock out project structures
		mkdirSync(join(tempDir, ".harness"));
		mkdirSync(join(tempDir, ".greptile"));
		mkdirSync(join(tempDir, ".agents/skills/coding-harness"), {
			recursive: true,
		});
		writeFileSync(join(tempDir, "harness.contract.json"), "{}");
		writeFileSync(join(tempDir, "user.txt"), "untouched");

		await ejectHarness(tempDir, { force: true });

		expect(existsSync(join(tempDir, ".harness"))).toBe(false);
		expect(existsSync(join(tempDir, ".greptile"))).toBe(false);
		expect(existsSync(join(tempDir, ".agents/skills/coding-harness"))).toBe(
			false,
		);
		expect(existsSync(join(tempDir, "harness.contract.json"))).toBe(false);

		// Unrelated files should remain
		expect(existsSync(join(tempDir, "user.txt"))).toBe(true);
	});

	it("supports dry-run without deleting harness footprints", async () => {
		mkdirSync(join(tempDir, ".harness"));
		mkdirSync(join(tempDir, ".greptile"));
		mkdirSync(join(tempDir, ".agents/skills/coding-harness"), {
			recursive: true,
		});
		writeFileSync(join(tempDir, "harness.contract.json"), "{}");

		const result = await ejectHarness(tempDir, { dryRun: true, force: true });

		expect(existsSync(join(tempDir, ".harness"))).toBe(true);
		expect(existsSync(join(tempDir, ".greptile"))).toBe(true);
		expect(existsSync(join(tempDir, ".agents/skills/coding-harness"))).toBe(
			true,
		);
		expect(existsSync(join(tempDir, "harness.contract.json"))).toBe(true);
		expect(result.deleted).toEqual(
			expect.arrayContaining([
				".harness",
				".greptile",
				".agents/skills/coding-harness",
				"harness.contract.json",
			]),
		);
	});

	it("fails closed when the user declines the eject prompt", async () => {
		writeFileSync(join(tempDir, "harness.contract.json"), "{}");
		await expect(
			ejectHarness(tempDir, {
				confirmPrompt: async () => "n",
			}),
		).rejects.toBeInstanceOf(EjectCancelledError);
		expect(existsSync(join(tempDir, "harness.contract.json"))).toBe(true);
	});

	it("throws when no harness footprint exists", async () => {
		await expect(ejectHarness(tempDir, { force: true })).rejects.toThrow(
			"No harness integration found",
		);
	});

	it("throws when only an unrelated .harness directory exists", async () => {
		mkdirSync(join(tempDir, ".harness"));
		await expect(ejectHarness(tempDir, { force: true })).rejects.toThrow(
			"No harness integration found",
		);
	});

	it("deletes only manifest-owned created files and leaves user files intact", async () => {
		writeFileSync(join(tempDir, "harness.contract.json"), "{}");
		writeFileSync(join(tempDir, "CONTRIBUTING.md"), "user-owned");
		mkdirSync(join(tempDir, ".github/workflows"), { recursive: true });
		writeFileSync(
			join(tempDir, ".github/workflows/pr-pipeline.yml"),
			"name: keep for manual review\n",
		);
		writeRestoreManifest(tempDir, [
			{
				path: "CONTRIBUTING.md",
				action: "modified",
				backupHash: "eca12c0a30e25b4b",
			},
			{ path: ".github/workflows/pr-pipeline.yml", action: "created" },
			{ path: ".greptile/config.json", action: "created" },
		]);
		mkdirSync(join(tempDir, ".greptile"), { recursive: true });
		writeFileSync(join(tempDir, ".greptile/config.json"), "{}");

		const result = await ejectHarness(tempDir, { force: true });

		expect(result.deleted).toContain(".greptile");
		expect(result.warnings).toEqual(
			expect.arrayContaining([
				expect.stringContaining(
					"Left workflow for manual review: .github/workflows/pr-pipeline.yml",
				),
			]),
		);
		expect(existsSync(join(tempDir, "CONTRIBUTING.md"))).toBe(true);
		expect(existsSync(join(tempDir, ".github/workflows/pr-pipeline.yml"))).toBe(
			true,
		);
		expect(existsSync(join(tempDir, ".greptile"))).toBe(false);
	});

	it("rejects manifest path traversal entries without deleting outside files", async () => {
		writeFileSync(join(tempDir, "harness.contract.json"), "{}");
		const outsideDir = mkdtempSync(join(tmpdir(), "harness-eject-outside-"));
		const outsideFile = join(outsideDir, "file.txt");
		writeFileSync(outsideFile, "preserve me");
		writeRestoreManifest(tempDir, [
			{ path: "../outside-repo/file", action: "created" },
		]);

		const sanitizeResult = sanitizePath(tempDir, "../outside-repo/file");
		expect(sanitizeResult.ok).toBe(false);

		await expect(ejectHarness(tempDir, { force: true })).rejects.toThrow(
			"Path traversal blocked in manifest",
		);
		expect(existsSync(outsideFile)).toBe(true);

		rmSync(outsideDir, { recursive: true, force: true });
	});

	it("surfaces deletionFailed warnings and the failing path when deletion throws", async () => {
		writeFileSync(join(tempDir, "harness.contract.json"), "{}");
		const contractPath = join(tempDir, "harness.contract.json");
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		await expect(
			ejectHarness(tempDir, {
				force: true,
				rmSyncImpl: (path, options) => {
					if (String(path) === contractPath) {
						throw new Error("disk busy");
					}
					return rmSync(path, options);
				},
			}),
		).rejects.toThrow("harness.contract.json");
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining("deletionFailed: harness.contract.json"),
		);
		expect(existsSync(contractPath)).toBe(true);
	});

	it("suppresses console output in json mode while returning deleted paths and warnings", async () => {
		writeFileSync(join(tempDir, "harness.contract.json"), "{}");
		mkdirSync(join(tempDir, ".greptile"), { recursive: true });
		writeFileSync(join(tempDir, ".greptile/config.json"), "{}");
		mkdirSync(join(tempDir, ".github/workflows"), { recursive: true });
		writeFileSync(
			join(tempDir, ".github/workflows/pr-pipeline.yml"),
			"name: keep for manual review\n",
		);
		writeRestoreManifest(tempDir, [
			{ path: ".github/workflows/pr-pipeline.yml", action: "created" },
			{ path: ".greptile/config.json", action: "created" },
		]);
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		const result = await ejectHarness(tempDir, {
			json: true,
			force: true,
		});

		expect(infoSpy).not.toHaveBeenCalled();
		expect(warnSpy).not.toHaveBeenCalled();
		expect(result.deleted).toContain(".greptile");
		expect(result.warnings).toEqual(
			expect.arrayContaining([
				expect.stringContaining(
					"Left workflow for manual review: .github/workflows/pr-pipeline.yml",
				),
			]),
		);
	});

	it("skips prompting in json mode when force is not set", async () => {
		writeFileSync(join(tempDir, "harness.contract.json"), "{}");
		const confirmPrompt = vi.fn(async () => "n");
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		const result = await ejectHarness(tempDir, {
			json: true,
			confirmPrompt,
		});

		expect(confirmPrompt).not.toHaveBeenCalled();
		expect(infoSpy).not.toHaveBeenCalled();
		expect(warnSpy).not.toHaveBeenCalled();
		expect(result.deleted).toContain("harness.contract.json");
		expect(existsSync(join(tempDir, "harness.contract.json"))).toBe(false);
	});
});
