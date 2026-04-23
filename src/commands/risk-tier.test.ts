import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EXIT_CODES, runRiskTierCLI } from "./risk-tier.js";

describe("risk-tier command", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		for (const tempDir of tempDirs.splice(0)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
		vi.restoreAllMocks();
	});

	function writeContract(
		rules: Record<string, "high" | "medium" | "low">,
	): string {
		const artifactsRoot = resolve("artifacts");
		mkdirSync(artifactsRoot, { recursive: true });
		const tempDir = mkdtempSync(join(artifactsRoot, "risk-tier-test-"));
		tempDirs.push(tempDir);
		const contractPath = join(tempDir, "harness.contract.json");
		writeFileSync(
			contractPath,
			JSON.stringify({ version: "1.0", riskTierRules: rules }),
			"utf-8",
		);
		return contractPath;
	}

	it("returns success and renders human-readable output", () => {
		const contractPath = writeContract({
			"src/auth/**": "high",
			"src/**": "medium",
			"**": "low",
		});
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		const exitCode = runRiskTierCLI({
			contractPath,
			files: ["src/auth/login.ts", "README.md"],
		});

		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		expect(infoSpy).toHaveBeenCalledWith("Risk Tier: high");
		expect(infoSpy).toHaveBeenCalledWith("Files analyzed: 2");
	});

	it("returns success and emits JSON output", () => {
		const contractPath = writeContract({
			"src/**": "medium",
			"**": "low",
		});
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		const exitCode = runRiskTierCLI({
			contractPath,
			files: ["src/index.ts"],
			json: true,
		});

		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		const payload = infoSpy.mock.calls[0]?.[0];
		expect(typeof payload).toBe("string");
		expect(payload).toContain('"tier":"medium"');
		expect(payload).toContain('"filesAnalyzed":1');
	});

	it("returns validation error when contract payload is invalid", () => {
		const artifactsRoot = resolve("artifacts");
		mkdirSync(artifactsRoot, { recursive: true });
		const tempDir = mkdtempSync(join(artifactsRoot, "risk-tier-invalid-"));
		tempDirs.push(tempDir);
		const contractPath = join(tempDir, "harness.contract.json");
		writeFileSync(contractPath, "{ not-json }", "utf-8");
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		const exitCode = runRiskTierCLI({
			contractPath,
			files: ["src/index.ts"],
			json: true,
		});

		expect(exitCode).toBe(EXIT_CODES.VALIDATION_ERROR);
		expect(errorSpy).toHaveBeenCalled();
		expect(errorSpy.mock.calls[0]?.[0]).toContain("ContractLoadError");
		expect(errorSpy.mock.calls[1]?.[0]).toContain('"error"');
	});
});
