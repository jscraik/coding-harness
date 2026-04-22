import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EXIT_CODES, runLicenseGateCLI } from "./license-gate.js";

describe("license-gate command", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		for (const tempDir of tempDirs.splice(0)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
		vi.restoreAllMocks();
	});

	function makeRepo(setup: (repoRoot: string) => void): string {
		const repoRoot = mkdtempSync(join(tmpdir(), "license-gate-test-"));
		tempDirs.push(repoRoot);
		mkdirSync(repoRoot, { recursive: true });
		setup(repoRoot);
		return repoRoot;
	}

	it("returns success and structured JSON for an allowed license", () => {
		const repoRoot = makeRepo((root) => {
			writeFileSync(
				join(root, "package.json"),
				JSON.stringify({ name: "demo", version: "1.0.0", license: "MIT" }),
				"utf-8",
			);
		});
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		const exitCode = runLicenseGateCLI({
			repoRoot,
			json: true,
		});

		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		expect(logSpy).toHaveBeenCalledTimes(1);
		const payload = logSpy.mock.calls[0]?.[0];
		expect(typeof payload).toBe("string");
		expect(payload).toContain('"ok": true');
		expect(payload).toContain('"license": "MIT"');
	});

	it("returns NO_LICENSE when no detectable license exists", () => {
		const repoRoot = makeRepo((root) => {
			writeFileSync(
				join(root, "package.json"),
				JSON.stringify({ name: "demo", version: "1.0.0" }),
				"utf-8",
			);
		});
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		const exitCode = runLicenseGateCLI({ repoRoot });

		expect(exitCode).toBe(EXIT_CODES.NO_LICENSE);
		expect(errorSpy).toHaveBeenCalledWith("✗ License validation failed");
	});

	it("returns DISALLOWED_LICENSE when license is outside allowlist", () => {
		const repoRoot = makeRepo((root) => {
			writeFileSync(
				join(root, "package.json"),
				JSON.stringify({ name: "demo", version: "1.0.0", license: "GPL-3.0" }),
				"utf-8",
			);
		});
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		const exitCode = runLicenseGateCLI({
			repoRoot,
			allowedLicenses: ["MIT"],
		});

		expect(exitCode).toBe(EXIT_CODES.DISALLOWED_LICENSE);
		expect(errorSpy).toHaveBeenCalledWith("✗ License validation failed");
		expect(
			errorSpy.mock.calls.some((call) =>
				String(call[0]).includes("not in the allowed licenses list"),
			),
		).toBe(true);
	});
});
