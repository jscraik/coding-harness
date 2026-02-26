import { describe, expect, it } from "vitest";
import { DEFAULT_CONTRACT, type HarnessContract } from "./types.js";
import { ValidationErrorCode, validateContract } from "./validator.js";

describe("validateContract", () => {
	it("accepts minimal valid contract with version only", () => {
		const result = validateContract({ version: "1.0" });
		expect(result.success).toBe(true);
		expect(result.data?.version).toBe("1.0");
	});

	it("applies defaults for optional fields", () => {
		const result = validateContract({ version: "1.0" });
		expect(result.success).toBe(true);
		expect(result.data?.riskTierRules).toEqual({});
	});

	it("rejects invalid risk tier", () => {
		const result = validateContract({
			version: "1.0",
			riskTierRules: { "src/**": "critical" },
		});
		expect(result.success).toBe(false);
		expect(result.errors[0]?.path).toBe("riskTierRules");
	});

	it("rejects missing version", () => {
		const result = validateContract({});
		expect(result.success).toBe(false);
		expect(result.errors[0]?.path).toBe("version");
		expect(result.errors[0]?.code).toBe(
			ValidationErrorCode.MISSING_REQUIRED_FIELD,
		);
	});

	it("accumulates multiple errors", () => {
		const result = validateContract({
			version: 123,
			riskTierRules: { "src/**": "invalid" },
		});
		expect(result.success).toBe(false);
		expect(result.errors.length).toBe(2);
	});

	it("accepts valid risk tier rules", () => {
		const result = validateContract({
			version: "1.0",
			riskTierRules: {
				"src/auth/**": "high",
				"**/*.test.ts": "low",
			},
		});
		expect(result.success).toBe(true);
		expect(result.data?.riskTierRules["src/auth/**"]).toBe("high");
	});

	it("rejects __proto__ key (prototype pollution)", () => {
		// Use JSON.parse to create an actual own property named __proto__
		const data = JSON.parse(
			'{"version":"1.0","riskTierRules":{"__proto__":"high"}}',
		);
		const result = validateContract(data);
		expect(result.success).toBe(false);
		expect(
			result.errors.some((e) => e.code === ValidationErrorCode.FORBIDDEN_KEY),
		).toBe(true);
	});

	it("rejects constructor key (prototype pollution)", () => {
		const result = validateContract({
			version: "1.0",
			riskTierRules: { constructor: "high" },
		});
		expect(result.success).toBe(false);
	});

	it("accepts contract with extended policy surfaces", () => {
		const result = validateContract({
			version: "1.1.0",
			reviewPolicy: { timeoutSeconds: 600, timeoutAction: "fail" },
			evidencePolicy: {
				requiredFor: ["docs/**"],
				allowedTypes: ["png", "jpeg"],
				maxFileSizeBytes: 1024,
			},
			mergePolicy: {
				high: ["review-gate"],
				medium: ["evidence-verify"],
				low: [],
			},
			docsDriftRules: {
				"docs/**": ["require-review"],
			},
			diffBudget: {
				maxFiles: 20,
				maxNetLOC: 500,
				overrideLabel: "diff-budget-override",
			},
			uiLoopPolicy: {
				fastCommand: "pnpm ui:fast",
				verifyCommand: "pnpm ui:verify",
				exploreCommand: "pnpm ui:explore",
				sloTargets: {
					fastLoopSeconds: 30,
					verifyLoopSeconds: 120,
				},
			},
			runtimePolicy: { nodeVersion: "20.x" },
			memoryPolicy: {
				enabled: true,
				provider: "local",
				sessionIdTemplate: "repo:<name>:task:<id>",
				domain: "default",
				requiredTags: ["repo", "area", "type"],
				maxObservationsPerStep: 3,
				allowedLevels: ["observation", "learning", "pattern"],
				requireStartRead: true,
				requireCloseoutSummary: true,
				forbiddenContentPatterns: ["token", "secret"],
			},
			memoryMaintenancePolicy: {
				validateSchedule: "weekly",
				reflectSchedule: "weekly",
				questionSlaDays: 7,
				duplicateThreshold: 0.8,
			},
			memoryEvalPolicy: {
				trialsPerTask: 3,
				requiredMetrics: ["pass^k"],
				passPowKThreshold: 0.8,
			},
			observabilityPolicy: {
				provider: "logs",
				collectorEndpoint: "http://localhost:4318",
			},
			packageManagerPolicy: {
				allowedManagers: ["pnpm", "npm", "yarn"],
				requiredManager: null,
			},
			remediationPolicy: {
				providerDefaults: {
					codeql: {
						autoApplyMaxTier: "medium",
						dryRunOnlyByDefault: true,
					},
					codex: {
						autoApplyMaxTier: "low",
						dryRunOnlyByDefault: false,
					},
				},
				canonicalRerunWorkflow: "greptile-rerun.yml",
				marker: "<!-- harness-remediation-rerun -->",
				timeoutMinutes: 20,
				retryLimit: 3,
				requireEvidence: true,
			},
			gapCasePolicy: {
				requiredEvidenceStatuses: ["passed", "approved"],
				requiredCloseReasons: ["fix", "workaround"],
				defaultDueDays: 7,
				caseIdPrefix: "gap-",
				caseStore: ".harness/gap-cases.json",
				allowEvidencelessResolve: false,
			},
		});

		expect(result.success).toBe(true);
		expect(result.data?.diffBudget?.maxNetLOC).toBe(500);
		expect(result.data?.uiLoopPolicy?.fastCommand).toBe("pnpm ui:fast");
		expect(result.data?.runtimePolicy?.nodeVersion).toBe("20.x");
		expect(result.data?.remediationPolicy?.timeoutMinutes).toBe(20);
		expect(result.data?.gapCasePolicy?.caseIdPrefix).toBe("gap-");
	});

	it("rejects unknown top-level fields", () => {
		const result = validateContract({
			version: "1.1.0",
			reviewPolicy: { timeoutSeconds: 600, timeoutAction: "fail" },
			validated_reserved: { future: true },
		});

		expect(result.success).toBe(false);
		expect(result.errors[0]?.path).toBe("root");
		expect(result.errors[0]?.message).toContain("Unknown top-level key");
	});

	it("rejects malformed remediation policy", () => {
		const result = validateContract({
			version: "1.2.0",
			remediationPolicy: {
				providerDefaults: {
					codeql: {
						autoApplyMaxTier: "critical",
						dryRunOnlyByDefault: true,
					},
					codex: {
						autoApplyMaxTier: "medium",
						dryRunOnlyByDefault: true,
					},
				},
				marker: "",
				timeoutMinutes: 0,
				retryLimit: -1,
				requireEvidence: true,
			},
		});

		expect(result.success).toBe(false);
		expect(result.errors[0]?.path).toBe("remediationPolicy");
	});

	it("rejects malformed gap-case policy", () => {
		const result = validateContract({
			version: "1.2.0",
			gapCasePolicy: {
				requiredEvidenceStatuses: ["passed"],
				requiredCloseReasons: ["fix"],
				defaultDueDays: 0,
				caseIdPrefix: "",
				caseStore: "",
				allowEvidencelessResolve: false,
			},
		});

		expect(result.success).toBe(false);
		expect(result.errors[0]?.path).toBe("gapCasePolicy");
	});
});

describe("field-by-field matrix tests for parity verification", () => {
	const SCAFFOLDED_FIELDS = [
		"version",
		"riskTierRules",
		"mergePolicy",
		"docsDriftRules",
		"reviewPolicy",
		"evidencePolicy",
		"diffBudget",
		"uiLoopPolicy",
		"runtimePolicy",
		"memoryPolicy",
		"memoryMaintenancePolicy",
		"memoryEvalPolicy",
		"observabilityPolicy",
		"packageManagerPolicy",
		"remediationPolicy",
		"gapCasePolicy",
		"pilotGapCasePolicy",
		"pilotRollbackPolicy",
		"pilotAuthzPolicy",
	] as const satisfies (keyof HarnessContract)[];

	it("validates all scaffolded top-level fields exist in HarnessContract", () => {
		for (const field of SCAFFOLDED_FIELDS) {
			expect(DEFAULT_CONTRACT).toHaveProperty(field);
		}
		expect(Object.keys(DEFAULT_CONTRACT).length).toBe(SCAFFOLDED_FIELDS.length);
	});

	it("rejects each policy type independently when malformed", () => {
		// diffBudget - requires numeric maxFiles and maxNetLOC
		const diffBudgetResult = validateContract({
			version: "1.2.0",
			diffBudget: { maxFiles: "invalid" as unknown as number, maxNetLOC: 100 },
		});
		expect(diffBudgetResult.success).toBe(false);

		// uiLoopPolicy - requires string commands
		const uiLoopResult = validateContract({
			version: "1.2.0",
			uiLoopPolicy: {
				fastCommand: 123 as unknown as string,
				verifyCommand: "pnpm verify",
				exploreCommand: "pnpm explore",
				sloTargets: { fastLoopSeconds: 30, verifyLoopSeconds: 120 },
			},
		});
		expect(uiLoopResult.success).toBe(false);

		// runtimePolicy - requires string nodeVersion
		const runtimeResult = validateContract({
			version: "1.2.0",
			runtimePolicy: { nodeVersion: 20 as unknown as string },
		});
		expect(runtimeResult.success).toBe(false);

		// memoryPolicy - requires boolean enabled
		const memoryResult = validateContract({
			version: "1.2.0",
			memoryPolicy: {
				enabled: "yes" as unknown as boolean,
				provider: "local",
				sessionIdTemplate: "repo:<name>:task:<id>",
				domain: "default",
				requiredTags: ["repo"],
				maxObservationsPerStep: 3,
				allowedLevels: ["observation"],
				requireStartRead: true,
				requireCloseoutSummary: true,
				forbiddenContentPatterns: [],
			},
		});
		expect(memoryResult.success).toBe(false);

		// observabilityPolicy - requires string provider
		const observabilityResult = validateContract({
			version: "1.2.0",
			observabilityPolicy: {
				provider: 123 as unknown as string,
				collectorEndpoint: "http://localhost:4318",
			},
		});
		expect(observabilityResult.success).toBe(false);

		// packageManagerPolicy - requires array allowedManagers
		const packageManagerResult = validateContract({
			version: "1.2.0",
			packageManagerPolicy: {
				allowedManagers: "pnpm" as unknown as string[],
				requiredManager: null,
			},
		});
		expect(packageManagerResult.success).toBe(false);
	});

	it("VALID_TOP_LEVEL_KEYS contains all scaffolded fields", () => {
		// Indirectly test by ensuring all known keys are accepted
		const contractWithAllFields: Record<string, unknown> = {};
		for (const field of SCAFFOLDED_FIELDS) {
			contractWithAllFields[field] = DEFAULT_CONTRACT[field];
		}

		const result = validateContract(contractWithAllFields);
		expect(result.success).toBe(true);
		expect(result.data).toBeDefined();
	});
});
