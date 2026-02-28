import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runBlastRadius } from "./blast-radius.js";

describe("runBlastRadius", () => {
	const cleanup: string[] = [];

	afterEach(() => {
		for (const path of cleanup) {
			rmSync(path, { recursive: true, force: true });
		}
		cleanup.length = 0;
	});

	it("uses default rules when no contract override is provided", () => {
		const result = runBlastRadius({
			files: ["unknown/file.xyz"],
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.usedDefaults).toBe(true);
			expect(result.output.checks).toContain("typecheck");
			expect(result.output.checks).toContain("lint");
			expect(result.output.checks).toContain("test-run");
		}
	});

	it("uses contract blastRadiusRules when contract override is supplied", () => {
		const dir = join(
			process.cwd(),
			".tmp",
			`harness-blast-radius-${Date.now()}`,
		);
		mkdirSync(dir, { recursive: true });
		cleanup.push(dir);

		const contractPath = join(dir, "harness.contract.json");
		writeFileSync(
			contractPath,
			JSON.stringify({
				version: "1.2.0",
				blastRadiusRules: [
					{
						pattern: "src/special/**",
						checks: ["special-check-a", "special-check-b"],
					},
				],
			}),
			"utf-8",
		);

		const result = runBlastRadius({
			files: ["src/special/config.ts"],
			contract: contractPath,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.usedDefaults).toBe(false);
			expect(result.output.checks).toContain("special-check-a");
			expect(result.output.checks).toContain("special-check-b");
			expect(result.output.checks).not.toContain("typecheck");
		}
	});

	it("returns error when no files are supplied", () => {
		const result = runBlastRadius({
			files: [],
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.code).toBe("NO_FILES");
		}
	});
});
