import { describe, expect, it } from "vitest";
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

	it("accepts blastRadiusRules and blastRadiusRulesMode", () => {
		const result = validateContract({
			version: "1.0",
			blastRadiusRules: [
				{
					pattern: "**/*.sh",
					checks: ["shellcheck", "bash-syntax"],
					description: "Shell scripts",
				},
			],
			blastRadiusRulesMode: "replace",
		});

		expect(result.success).toBe(true);
		expect(result.data?.blastRadiusRules).toHaveLength(1);
		expect(result.data?.blastRadiusRules?.[0]?.pattern).toBe("**/*.sh");
		expect(result.data?.blastRadiusRulesMode).toBe("replace");
	});

	it("rejects invalid blastRadiusRulesMode", () => {
		const result = validateContract({
			version: "1.0",
			blastRadiusRulesMode: "invalid",
		});

		expect(result.success).toBe(false);
		expect(result.errors[0]?.path).toBe("blastRadiusRulesMode");
		expect(result.errors[0]?.code).toBe(ValidationErrorCode.INVALID_VALUE);
	});

	it("rejects malformed blastRadiusRules", () => {
		const result = validateContract({
			version: "1.0",
			blastRadiusRules: [
				{
					pattern: "**/*.sh",
					checks: "shellcheck",
				},
			],
		});

		expect(result.success).toBe(false);
		expect(result.errors[0]?.path).toBe("blastRadiusRules");
		expect(result.errors[0]?.code).toBe(ValidationErrorCode.INVALID_VALUE);
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

	describe("reviewPolicy", () => {
		it("accepts reviewPolicy with optional requiredChecks", () => {
			const result = validateContract({
				version: "1.0",
				reviewPolicy: {
					timeoutSeconds: 600,
					timeoutAction: "fail",
					requiredChecks: ["security-scan", "Greptile Review", "Codex Review"],
				},
			});
			expect(result.success).toBe(true);
		});

		it("accepts reviewPolicy with optional enforceReviewerIndependence", () => {
			const result = validateContract({
				version: "1.0",
				reviewPolicy: {
					timeoutSeconds: 600,
					timeoutAction: "fail",
					enforceReviewerIndependence: false,
				},
			});
			expect(result.success).toBe(true);
		});

		it("rejects reviewPolicy when requiredChecks is not an array", () => {
			const result = validateContract({
				version: "1.0",
				reviewPolicy: {
					timeoutSeconds: 600,
					timeoutAction: "fail",
					requiredChecks: "security-scan",
				},
			});
			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("reviewPolicy");
		});

		it("rejects reviewPolicy when enforceReviewerIndependence is not boolean", () => {
			const result = validateContract({
				version: "1.0",
				reviewPolicy: {
					timeoutSeconds: 600,
					timeoutAction: "fail",
					enforceReviewerIndependence: "no",
				},
			});
			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("reviewPolicy");
		});
	});

	describe("branchProtection", () => {
		it("accepts branchProtection with requiredChecks", () => {
			const result = validateContract({
				version: "1.0",
				branchProtection: {
					requiredChecks: ["security-scan", "Greptile Review"],
				},
			});
			expect(result.success).toBe(true);
		});

		it("rejects branchProtection when requiredChecks is not an array", () => {
			const result = validateContract({
				version: "1.0",
				branchProtection: {
					requiredChecks: "security-scan",
				},
			});
			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("branchProtection");
		});

		it("rejects when reviewPolicy.requiredChecks is not a subset of branchProtection.requiredChecks", () => {
			const result = validateContract({
				version: "1.0",
				reviewPolicy: {
					timeoutSeconds: 600,
					timeoutAction: "fail",
					requiredChecks: ["security-scan", "Codex Review"],
				},
				branchProtection: {
					requiredChecks: ["security-scan", "Greptile Review"],
				},
			});
			expect(result.success).toBe(false);
			expect(
				result.errors.some(
					(error) => error.path === "reviewPolicy.requiredChecks",
				),
			).toBe(true);
		});

		it("accepts when reviewPolicy.requiredChecks is a subset of branchProtection.requiredChecks", () => {
			const result = validateContract({
				version: "1.0",
				reviewPolicy: {
					timeoutSeconds: 600,
					timeoutAction: "fail",
					requiredChecks: ["security-scan"],
				},
				branchProtection: {
					requiredChecks: ["security-scan", "Greptile Review"],
				},
			});
			expect(result.success).toBe(true);
		});
	});

	describe("runtimePolicy", () => {
		it("accepts runtimePolicy with optional createIssueOnAgentFindings", () => {
			const result = validateContract({
				version: "1.0",
				runtimePolicy: {
					nodeVersion: "20.x",
					createIssueOnAgentFindings: true,
				},
			});
			expect(result.success).toBe(true);
		});

		it("rejects non-boolean createIssueOnAgentFindings", () => {
			const result = validateContract({
				version: "1.0",
				runtimePolicy: {
					nodeVersion: "20.x",
					createIssueOnAgentFindings: "yes",
				},
			});
			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("runtimePolicy");
		});
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

	// Pilot Gap-Case Policy Tests
	describe("pilotGapCasePolicy", () => {
		it("accepts valid pilot gap-case policy", () => {
			const result = validateContract({
				version: "1.0",
				pilotGapCasePolicy: {
					enabled: true,
					defaultSlaHours: 72,
					requireClosureEvidence: true,
				},
			});
			expect(result.success).toBe(true);
			expect(result.data?.pilotGapCasePolicy?.enabled).toBe(true);
			expect(result.data?.pilotGapCasePolicy?.defaultSlaHours).toBe(72);
		});

		it("accepts pilot gap-case policy with optional storePath", () => {
			const result = validateContract({
				version: "1.0",
				pilotGapCasePolicy: {
					enabled: true,
					defaultSlaHours: 48,
					requireClosureEvidence: false,
					storePath: ".harness/custom-gap-cases.json",
				},
			});
			expect(result.success).toBe(true);
			expect(result.data?.pilotGapCasePolicy?.storePath).toBe(
				".harness/custom-gap-cases.json",
			);
		});

		it("rejects invalid defaultSlaHours (non-positive)", () => {
			const result = validateContract({
				version: "1.0",
				pilotGapCasePolicy: {
					enabled: true,
					defaultSlaHours: 0,
					requireClosureEvidence: true,
				},
			});
			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("pilotGapCasePolicy");
		});

		it("rejects invalid enabled (non-boolean)", () => {
			const result = validateContract({
				version: "1.0",
				pilotGapCasePolicy: {
					enabled: "yes",
					defaultSlaHours: 72,
					requireClosureEvidence: true,
				},
			});
			expect(result.success).toBe(false);
		});
	});

	// Pilot Rollback Policy Tests
	describe("pilotRollbackPolicy", () => {
		it("accepts valid pilot rollback policy in manual mode", () => {
			const result = validateContract({
				version: "1.0",
				pilotRollbackPolicy: {
					autoTrigger: true,
					requireManualRelease: true,
					completionMarkerPath: ".harness/rollback-marker.json",
					mode: "manual",
				},
			});
			expect(result.success).toBe(true);
			expect(result.data?.pilotRollbackPolicy?.mode).toBe("manual");
		});

		it("accepts valid pilot rollback policy in autonomous mode", () => {
			const result = validateContract({
				version: "1.0",
				pilotRollbackPolicy: {
					autoTrigger: false,
					requireManualRelease: false,
					completionMarkerPath: ".harness/rollback-marker.json",
					mode: "autonomous",
				},
			});
			expect(result.success).toBe(true);
			expect(result.data?.pilotRollbackPolicy?.mode).toBe("autonomous");
		});

		it("rejects invalid mode", () => {
			const result = validateContract({
				version: "1.0",
				pilotRollbackPolicy: {
					autoTrigger: true,
					requireManualRelease: true,
					completionMarkerPath: ".harness/rollback-marker.json",
					mode: "invalid",
				},
			});
			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("pilotRollbackPolicy");
		});

		it("rejects missing completionMarkerPath", () => {
			const result = validateContract({
				version: "1.0",
				pilotRollbackPolicy: {
					autoTrigger: true,
					requireManualRelease: true,
					mode: "manual",
				},
			});
			expect(result.success).toBe(false);
		});
	});

	// Pilot Authz Policy Tests
	describe("pilotAuthzPolicy", () => {
		it("accepts valid pilot authz policy", () => {
			const result = validateContract({
				version: "1.0",
				pilotAuthzPolicy: {
					githubScopeAllowlist: ["pull_requests:write", "contents:read"],
					repoAllowlist: ["owner/*"],
					branchAllowlist: ["feature/*"],
					protectedBranchDenylist: ["main", "master"],
					enforceBranchProtection: true,
				},
			});
			expect(result.success).toBe(true);
			expect(result.data?.pilotAuthzPolicy?.githubScopeAllowlist).toContain(
				"pull_requests:write",
			);
		});

		it("accepts empty allowlists (deny-all default)", () => {
			const result = validateContract({
				version: "1.0",
				pilotAuthzPolicy: {
					githubScopeAllowlist: [],
					repoAllowlist: [],
					branchAllowlist: [],
					protectedBranchDenylist: ["main"],
					enforceBranchProtection: true,
				},
			});
			expect(result.success).toBe(true);
		});

		it("rejects non-array githubScopeAllowlist", () => {
			const result = validateContract({
				version: "1.0",
				pilotAuthzPolicy: {
					githubScopeAllowlist: "pull_requests:write",
					repoAllowlist: [],
					branchAllowlist: [],
					protectedBranchDenylist: [],
					enforceBranchProtection: true,
				},
			});
			expect(result.success).toBe(false);
		});

		it("rejects non-boolean enforceBranchProtection", () => {
			const result = validateContract({
				version: "1.0",
				pilotAuthzPolicy: {
					githubScopeAllowlist: [],
					repoAllowlist: [],
					branchAllowlist: [],
					protectedBranchDenylist: [],
					enforceBranchProtection: "yes",
				},
			});
			expect(result.success).toBe(false);
		});

		it("rejects __proto__ in repoAllowlist (prototype pollution)", () => {
			const result = validateContract({
				version: "1.0",
				pilotAuthzPolicy: {
					githubScopeAllowlist: [],
					repoAllowlist: ["__proto__"],
					branchAllowlist: [],
					protectedBranchDenylist: [],
					enforceBranchProtection: true,
				},
			});
			expect(result.success).toBe(false);
		});
	});

	// Remediation Policy Tests
	describe("remediationPolicy", () => {
		it("accepts valid remediation policy", () => {
			const result = validateContract({
				version: "1.0",
				remediationPolicy: {
					providerDefaults: {
						greptile: {
							autoApplyMaxTier: "medium",
							dryRunOnlyByDefault: false,
						},
					},
					marker: "[auto-remediate]",
					timeoutMinutes: 10,
					retryLimit: 3,
					requireEvidence: true,
				},
			});
			expect(result.success).toBe(true);
			expect(result.data?.remediationPolicy?.marker).toBe("[auto-remediate]");
		});

		it("rejects invalid autoApplyMaxTier", () => {
			const result = validateContract({
				version: "1.0",
				remediationPolicy: {
					providerDefaults: {
						greptile: {
							autoApplyMaxTier: "critical",
							dryRunOnlyByDefault: false,
						},
					},
					marker: "[auto-remediate]",
					timeoutMinutes: 10,
					retryLimit: 3,
					requireEvidence: true,
				},
			});
			expect(result.success).toBe(false);
		});

		it("rejects negative retryLimit", () => {
			const result = validateContract({
				version: "1.0",
				remediationPolicy: {
					providerDefaults: {},
					marker: "[auto-remediate]",
					timeoutMinutes: 10,
					retryLimit: -1,
					requireEvidence: true,
				},
			});
			expect(result.success).toBe(false);
		});

		it("rejects missing required fields", () => {
			const result = validateContract({
				version: "1.0",
				remediationPolicy: {
					providerDefaults: {},
					marker: "[auto-remediate]",
				},
			});
			expect(result.success).toBe(false);
		});
	});

	describe("loopStageContracts", () => {
		const validLoopStageContracts = {
			"risk-policy-gate": {
				inputs: ["changed_files", "harness.contract.json"],
				outputs: ["risk-policy-gate.result"],
				schema: "loop-stage-contract/v1",
				failPolicy: "fail_closed",
				if: "always()",
				permissions: ["contents:read", "pull-requests:read"],
				timeoutMinutes: 15,
				concurrency: "none",
			},
			"review-gate": {
				inputs: [
					"risk-policy-gate.result",
					"head_sha",
					"harness.contract.json",
				],
				outputs: ["review-gate.result"],
				schema: "loop-stage-contract/v1",
				failPolicy: "fail_closed",
				if: "always()",
				permissions: ["contents:read", "pull-requests:read"],
				timeoutMinutes: 15,
				concurrency: "none",
			},
			"evidence-verify": {
				inputs: [
					"review-gate.result",
					"evidence_files",
					"harness.contract.json",
				],
				outputs: ["evidence-verify.result", "browser-evidence-artifacts"],
				schema: "loop-stage-contract/v1",
				failPolicy: "fail_closed",
				if: "always()",
				permissions: ["contents:read"],
				timeoutMinutes: 15,
				concurrency: "none",
			},
			"remediation-decision": {
				inputs: [
					"evidence-verify.result",
					"findings.json",
					"harness.contract.json",
				],
				outputs: [
					"remediation-decision.result",
					"remediation-decision-artifacts",
				],
				schema: "loop-stage-contract/v1",
				failPolicy: "fail_closed",
				if: "always()",
				permissions: ["contents:read", "pull-requests:write"],
				timeoutMinutes: 15,
				concurrency: "none",
			},
		};

		it("accepts complete loop stage semantic contracts", () => {
			const result = validateContract({
				version: "1.0",
				loopStageContracts: validLoopStageContracts,
			});
			expect(result.success).toBe(true);
			expect(result.data?.loopStageContracts?.["review-gate"]?.failPolicy).toBe(
				"fail_closed",
			);
		});

		it("rejects missing required loop stages", () => {
			const result = validateContract({
				version: "1.0",
				loopStageContracts: {
					"risk-policy-gate": validLoopStageContracts["risk-policy-gate"],
				},
			});
			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("loopStageContracts");
		});

		it("rejects invalid fail policy values", () => {
			const result = validateContract({
				version: "1.0",
				loopStageContracts: {
					...validLoopStageContracts,
					"review-gate": {
						...validLoopStageContracts["review-gate"],
						failPolicy: "best_effort",
					},
				},
			});
			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("loopStageContracts");
		});
	});
});
