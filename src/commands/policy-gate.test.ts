import { describe, expect, it } from "vitest";
import { EXIT_CODES, runPolicyGate, runPolicyGateCLI } from "./policy-gate.js";

describe("runPolicyGate", () => {
	const contractPath = "test-fixtures/contract.json";

	describe("with max-tier", () => {
		it("passes when tier equals max-tier", () => {
			const result = runPolicyGate({
				contractPath,
				files: ["src/lib/utils.ts"], // medium tier (default)
				maxTier: "medium",
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.passed).toBe(true);
				expect(result.output.tier).toBe("medium");
			}
		});

		it("passes when tier is lower than max-tier", () => {
			const result = runPolicyGate({
				contractPath,
				files: ["src/lib/utils.test.ts"], // low tier
				maxTier: "medium",
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.passed).toBe(true);
				expect(result.output.tier).toBe("low");
			}
		});

		it("fails when tier exceeds max-tier", () => {
			const result = runPolicyGate({
				contractPath,
				files: ["src/auth/login.ts"], // high tier
				maxTier: "medium",
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.passed).toBe(false);
				expect(result.output.tier).toBe("high");
				expect(result.output.maxAllowed).toBe("medium");
				expect(result.output.violatingFiles).toContain("src/auth/login.ts");
			}
		});

		it("passes high-tier files when max-tier is high", () => {
			const result = runPolicyGate({
				contractPath,
				files: ["src/auth/login.ts"],
				maxTier: "high",
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.passed).toBe(true);
			}
		});
	});

	describe("without max-tier", () => {
		it("passes all files when no max-tier specified", () => {
			const result = runPolicyGate({
				contractPath,
				files: ["src/auth/login.ts"], // high tier
			});
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.passed).toBe(true);
				expect(result.output.tier).toBe("high");
			}
		});
	});

	describe("validation", () => {
		it("rejects invalid max-tier value", () => {
			const result = runPolicyGate({
				contractPath,
				files: ["src/lib/utils.ts"],
				maxTier: "critical" as "high", // Invalid value
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("VALIDATION_ERROR");
				expect(result.error.message).toContain("Invalid max-tier");
			}
		});

		it("returns error for missing contract", () => {
			const result = runPolicyGate({
				contractPath: "nonexistent.json",
				files: ["src/lib/utils.ts"],
				maxTier: "medium",
			});
			expect(result.ok).toBe(false);
			if (!result.ok) {
				// File not found throws system error (ENOENT)
				expect(result.error.code).toBe("SYSTEM_ERROR");
			}
		});
	});
});

describe("runPolicyGateCLI", () => {
	const contractPath = "test-fixtures/contract.json";

	it("returns SUCCESS (0) when gate passes", () => {
		const exitCode = runPolicyGateCLI({
			contractPath,
			files: ["src/lib/utils.ts"],
			maxTier: "medium",
			json: true,
		});
		expect(exitCode).toBe(EXIT_CODES.SUCCESS);
	});

	it("returns POLICY_VIOLATION (1) when gate fails", () => {
		const exitCode = runPolicyGateCLI({
			contractPath,
			files: ["src/auth/login.ts"],
			maxTier: "medium",
			json: true,
		});
		expect(exitCode).toBe(EXIT_CODES.POLICY_VIOLATION);
	});

	it("returns VALIDATION_ERROR (1) for invalid max-tier", () => {
		const exitCode = runPolicyGateCLI({
			contractPath,
			files: ["src/lib/utils.ts"],
			maxTier: "invalid" as "high",
			json: true,
		});
		expect(exitCode).toBe(EXIT_CODES.VALIDATION_ERROR);
	});
});
