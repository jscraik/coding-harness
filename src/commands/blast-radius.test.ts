import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearContractCache } from "../lib/contract/loader.js";
import {
	EXIT_CODES,
	runBlastRadius,
	runBlastRadiusCLI,
} from "./blast-radius.js";

describe("runBlastRadius", () => {
	let tempDir: string;
	let originalCwd: string;

	beforeEach(() => {
		// Clear contract cache to prevent stale contract data between tests
		clearContractCache();
		originalCwd = process.cwd();
		tempDir = join(tmpdir(), `harness-blast-radius-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });
		process.chdir(tempDir);
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
		process.chdir(originalCwd);
	});

	it("uses custom blastRadiusRules from contract in merge mode", () => {
		const contractPath = "harness.contract.json";
		writeFileSync(
			contractPath,
			JSON.stringify({
				version: "1.0",
				blastRadiusRules: [
					{
						pattern: "scripts/**/*.sh",
						checks: ["shellcheck", "bash-syntax"],
					},
				],
				blastRadiusRulesMode: "merge",
			}),
		);

		const result = runBlastRadius({
			files: ["scripts/build.sh"],
			contractPath,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.rulesMode).toBe("merge");
			expect(result.output.checks).toContain("shellcheck");
			expect(result.output.checks).toContain("bash-syntax");
			expect(result.output.usedDefaults).toBe(false);
		}
	});

	it("respects replace mode and ignores default blast rules", () => {
		const contractPath = "harness.contract.json";
		writeFileSync(
			contractPath,
			JSON.stringify({
				version: "1.0",
				blastRadiusRules: [
					{
						pattern: "scripts/**/*.sh",
						checks: ["shellcheck"],
					},
				],
				blastRadiusRulesMode: "replace",
			}),
		);

		const result = runBlastRadius({
			files: ["src/auth/login.ts", "scripts/build.sh"],
			contractPath,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.rulesMode).toBe("replace");
			expect(result.output.checks).toContain("shellcheck");
			expect(result.output.checks).not.toContain("auth-flows");
			expect(result.output.checks).not.toContain("typecheck");
		}
	});

	it("treats replace mode without custom rules as no blast-radius rules", () => {
		const contractPath = "harness.contract.json";
		writeFileSync(
			contractPath,
			JSON.stringify({
				version: "1.0",
				blastRadiusRulesMode: "replace",
			}),
		);

		const result = runBlastRadius({
			files: ["src/auth/login.ts"],
			contractPath,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.rulesMode).toBe("replace");
			expect(result.output.rules).toEqual([]);
			expect(result.output.usedDefaults).toBe(true);
			expect(result.output.checks).not.toContain("auth-flows");
		}
	});

	it("returns VALIDATION_ERROR when contract is invalid", () => {
		const contractPath = "harness.contract.json";
		writeFileSync(
			contractPath,
			JSON.stringify({
				version: "1.0",
				blastRadiusRulesMode: "invalid",
			}),
		);

		const exitCode = runBlastRadiusCLI({
			files: ["scripts/build.sh"],
			contractPath,
		});

		expect(exitCode).toBe(EXIT_CODES.VALIDATION_ERROR);
	});

	it("falls back to default blast-radius rules when contract file is missing", () => {
		const result = runBlastRadius({
			files: ["src/auth/login.ts"],
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.output.usedDefaults).toBe(false);
			expect(result.output.checks).toContain("auth-flows");
			expect(result.output.rulesMode).toBe("merge");
			expect(result.output.rules).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						pattern: "src/auth/**",
						checks: expect.arrayContaining(["auth-flows"]),
					}),
				]),
			);
		}
	});

	it("returns VALIDATION_ERROR when explicit contract path is missing", () => {
		const exitCode = runBlastRadiusCLI({
			files: ["src/auth/login.ts"],
			contractPath: "missing.contract.json",
		});

		expect(exitCode).toBe(EXIT_CODES.VALIDATION_ERROR);
	});
});
