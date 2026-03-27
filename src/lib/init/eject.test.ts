import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ejectHarness } from "./eject.js";

describe("ejectHarness", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "harness-eject-test-"));
	});

	afterEach(() => {
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
});
