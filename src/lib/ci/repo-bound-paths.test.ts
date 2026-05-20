import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import {
	isSafeAllowedRestorePath,
	resolveRepoBoundFileUrl,
	resolveRepoBoundPath,
} from "./repo-bound-paths.js";

describe("repo-bound path seams", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "repo-bound-paths-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("resolves files inside the repository root", () => {
		mkdirSync(join(tempDir, ".harness"), { recursive: true });
		writeFileSync(join(tempDir, ".harness", "evidence.json"), "{}");

		const result = resolveRepoBoundPath(
			tempDir,
			".harness/evidence.json",
			"Evidence",
			true,
		);

		expect(result).toEqual({
			ok: true,
			absolutePath: join(tempDir, ".harness", "evidence.json"),
		});
	});

	it("rejects missing paths that would escape the repository root", () => {
		const result = resolveRepoBoundPath(
			tempDir,
			"../outside.json",
			"Evidence",
			false,
		);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("escapes repository root");
		}
	});

	it("rejects file URLs outside the repository root", () => {
		const outsidePath = join(tempDir, "..", "outside-file-url.json");
		writeFileSync(outsidePath, "{}");

		const result = resolveRepoBoundFileUrl(
			tempDir,
			pathToFileURL(outsidePath).toString(),
			"Downloaded artifact",
		);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain("escapes repository root");
		}
	});

	it("rejects allowlisted restore paths that resolve through a symlink", () => {
		const allowedPath = ".harness/control-plane/github-rulesets.json";
		const allowed = new Set([allowedPath]);
		const outsidePath = join(tempDir, "..", "outside-restore.json");
		writeFileSync(outsidePath, "{}");
		mkdirSync(join(tempDir, ".harness", "control-plane"), { recursive: true });
		symlinkSync(outsidePath, join(tempDir, allowedPath));

		expect(isSafeAllowedRestorePath(tempDir, allowedPath, allowed)).toBe(false);
	});

	it("allows missing allowlisted restore paths when the nearest parent is safe", () => {
		const allowedPath = ".harness/control-plane/github-rulesets.json";
		mkdirSync(resolve(tempDir, ".harness", "control-plane"), {
			recursive: true,
		});

		expect(
			isSafeAllowedRestorePath(tempDir, allowedPath, new Set([allowedPath])),
		).toBe(true);
	});
});
