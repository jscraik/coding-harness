import { describe, expect, it } from "vitest";
import { DEFAULT_PRODUCT_SURFACE_REGISTRY } from "./types.js";
import { ValidationErrorCode, validateContract } from "./validator.js";

describe("validateContract", () => {
	it("accepts minimal valid contract with version only", () => {
		const result = validateContract({ version: "1.0" });
		expect(result.success).toBe(true);
		expect(result.data?.version).toBe("1.0");
	});

	it("accepts top-level $schema for editor autocomplete metadata", () => {
		const result = validateContract({
			$schema: "https://schemas.brainwav.io/harness.contract.schema.json",
			version: "1.0",
		});
		expect(result.success).toBe(true);
	});

	it("applies defaults for optional fields", () => {
		const result = validateContract({ version: "1.0" });
		expect(result.success).toBe(true);
		expect(result.data?.riskTierRules).toEqual({});
	});

	it("rejects malformed northStar decision questions", () => {
		const result = validateContract({
			version: "1.6.0",
			northStar: {
				mission: "Throughput over ceremony",
				primaryMetric: "pr_lead_time",
				primaryBottleneck: "review_rework_loop",
				autonomyBoundary: "bounded autonomy",
				safetyFloor: ["deterministic evidence"],
				nonGoals: ["manual glue loops"],
				decisionQuestions: [{ id: "invalid_question", prompt: "bad" }],
			},
		});

		expect(result.success).toBe(false);
		expect(result.errors.some((error) => error.path === "northStar")).toBe(
			true,
		);
	});

	it("rejects northStar decision questions when prompt text drifts from canonical mapping", () => {
		const result = validateContract({
			version: "1.6.0",
			northStar: {
				mission: "Throughput over ceremony",
				primaryMetric: "pr_lead_time",
				primaryBottleneck: "review_rework_loop",
				autonomyBoundary: "bounded autonomy",
				safetyFloor: ["deterministic evidence"],
				nonGoals: ["manual glue loops"],
				decisionQuestions: [
					{
						id: "lead_time_path",
						prompt: "Does this reduce lead time?",
					},
					{
						id: "manual_glue",
						prompt:
							"Does this remove repeated manual glue work rather than normalizing it?",
					},
					{
						id: "agent_reliability",
						prompt:
							"Does this make acceptable output easier for agents to produce reliably?",
					},
					{
						id: "safety_floor",
						prompt:
							"Does this preserve strict evidence, SHA discipline, and rollback safety?",
					},
				],
			},
		});

		expect(result.success).toBe(false);
		expect(result.errors.some((error) => error.path === "northStar")).toBe(
			true,
		);
	});

	it("accepts valid northStar, productSurface, and overrideReviewerRegistry", () => {
		const result = validateContract({
			version: "1.6.0",
			northStar: {
				mission: "Reduce PR lead time through reliable agent execution",
				primaryMetric: "pr_lead_time",
				primaryBottleneck: "review_rework_loop",
				autonomyBoundary:
					"Low and medium risk changes are autonomous when evidence is deterministic",
				safetyFloor: ["deterministic evidence over intuition"],
				nonGoals: ["manual recurring glue steps"],
				decisionQuestions: [
					{
						id: "lead_time_path",
						prompt:
							"Does this reduce PR lead time directly, or strengthen the path to lower PR lead time by reducing review or rework cost?",
					},
					{
						id: "manual_glue",
						prompt:
							"Does this remove repeated manual glue work rather than normalizing it?",
					},
					{
						id: "agent_reliability",
						prompt:
							"Does this make acceptable output easier for agents to produce reliably?",
					},
					{
						id: "safety_floor",
						prompt:
							"Does this preserve strict evidence, SHA discipline, and rollback safety?",
					},
				],
			},
			productSurface: {
				surfaces: [
					{
						surfaceId: "harness.review-gate",
						surfaceType: "command",
						class: "core",
						owner: "review-gate",
						northStarContribution: "Cuts review churn",
						manualGlueReductionClaim: "Removes manual check aggregation",
						reliabilityContribution: "Deterministic gate outputs",
						evidenceReference: "docs/agents/12-ai-review-governance.md",
						ownedPaths: ["src/commands/review-gate.ts"],
						lastReviewedAt: "2026-04-22",
					},
				],
			},
			overrideReviewerRegistry: {
				trustedReviewers: [
					{
						reviewerId: "ops/release",
						reviewerType: "team",
						signatureRef: "refs/heads/main",
						displayName: "Release Engineering",
						status: "active",
					},
				],
			},
		});

		expect(result.success).toBe(true);
	});

	it("rejects empty productSurface registry when provided", () => {
		const result = validateContract({
			version: "1.6.0",
			productSurface: {
				surfaces: [],
			},
		});

		expect(result.success).toBe(false);
		expect(result.errors.some((error) => error.path === "productSurface")).toBe(
			true,
		);
	});

	it("accepts exported default productSurface registry when provided", () => {
		const result = validateContract({
			version: "1.6.0",
			productSurface: DEFAULT_PRODUCT_SURFACE_REGISTRY,
		});

		expect(result.success).toBe(true);
	});

	it("rejects malformed overrideReviewerRegistry when provided", () => {
		const result = validateContract({
			version: "1.6.0",
			overrideReviewerRegistry: {
				trustedReviewers: [
					{
						reviewerId: "ops/release",
						reviewerType: "invalid",
						signatureRef: "refs/heads/main",
						displayName: "Release Engineering",
						status: "active",
					},
				],
			},
		});

		expect(result.success).toBe(false);
		expect(
			result.errors.some((error) => error.path === "overrideReviewerRegistry"),
		).toBe(true);
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

	describe("gateExtensions", () => {
		it("accepts valid preflight pre/post hook configuration", () => {
			const result = validateContract({
				version: "1.0",
				gateExtensions: {
					preflightGate: {
						pre: [{ id: "skip-all-checks" }, { id: "force-fail" }],
						post: [{ id: "fail-on-warnings", enabled: true }],
					},
				},
			});

			expect(result.success).toBe(true);
		});

		it("rejects unsupported preflight pre hook ids", () => {
			const result = validateContract({
				version: "1.0",
				gateExtensions: {
					preflightGate: {
						pre: [{ id: "fail-on-warnings" }],
					},
				},
			});

			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("gateExtensions");
			expect(result.errors[0]?.code).toBe(ValidationErrorCode.INVALID_VALUE);
		});
	});

	describe("policyChain", () => {
		it("accepts a complete policy chain mapping", () => {
			const result = validateContract({
				version: "1.0",
				policyChain: {
					tierToAction: {
						high: "block",
						medium: "warn",
						low: "allow",
					},
					actionToVerdict: {
						allow: "pass",
						block: "fail",
						warn: "pass",
					},
				},
			});

			expect(result.success).toBe(true);
		});

		it("rejects policy chain when a tier mapping is missing", () => {
			const result = validateContract({
				version: "1.0",
				policyChain: {
					tierToAction: {
						high: "block",
						medium: "warn",
					},
					actionToVerdict: {
						allow: "pass",
						block: "fail",
						warn: "pass",
					},
				},
			});

			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("policyChain");
			expect(result.errors[0]?.code).toBe(ValidationErrorCode.INVALID_VALUE);
		});

		it("rejects policy chain with unsupported action values", () => {
			const result = validateContract({
				version: "1.0",
				policyChain: {
					tierToAction: {
						high: "block",
						medium: "escalate",
						low: "allow",
					},
					actionToVerdict: {
						allow: "pass",
						block: "fail",
						warn: "pass",
					},
				},
			});

			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("policyChain");
			expect(result.errors[0]?.code).toBe(ValidationErrorCode.INVALID_VALUE);
		});
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
					requiredChecks: ["security-scan", "CodeRabbit", "Codex Review"],
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
					requiredChecks: ["security-scan", "CodeRabbit"],
				},
			});
			expect(result.success).toBe(true);
		});

		it("accepts the full non-negotiable branch protection policy surface", () => {
			const result = validateContract({
				version: "1.0",
				branchProtection: {
					requiredChecks: ["security-scan", "CodeRabbit"],
					restrictDeletions: true,
					blockForcePushes: true,
					requireLinearHistory: true,
					requirePullRequest: true,
					requiredApprovingReviewCount: 1,
					dismissStaleReviewsOnPush: true,
					requireConversationResolution: true,
					requireCodeOwnerReview: false,
					requireLastPushApproval: false,
					requireBranchesUpToDate: true,
					allowedMergeMethods: {
						mergeCommit: true,
						squash: true,
						rebase: true,
					},
					codeQuality: {
						required: true,
						severity: "all",
					},
					publicCodeScanning: {
						required: true,
						publicOnly: true,
						tool: "CodeQL",
						alertsThreshold: "errors",
						securityAlertsThreshold: "high_or_higher",
					},
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
					requiredChecks: ["security-scan", "CodeRabbit"],
				},
			});
			expect(result.success).toBe(false);
			expect(
				result.errors.some(
					(error) => error.path === "reviewPolicy.requiredChecks",
				),
			).toBe(true);
		});

		it("rejects negative requiredApprovingReviewCount", () => {
			const result = validateContract({
				version: "1.0",
				branchProtection: {
					requiredApprovingReviewCount: -1,
				},
			});
			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("branchProtection");
		});

		it("rejects invalid codeQuality severity", () => {
			const result = validateContract({
				version: "1.0",
				branchProtection: {
					codeQuality: {
						required: true,
						severity: "critical",
					},
				},
			});
			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("branchProtection");
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
					requiredChecks: ["security-scan", "CodeRabbit"],
				},
			});
			expect(result.success).toBe(true);
		});
	});

	describe("issueTrackingPolicy", () => {
		it("accepts a valid Linear enforcement policy", () => {
			const result = validateContract({
				version: "1.0",
				issueTrackingPolicy: {
					provider: "linear",
					projectUrl: "https://linear.app/acme/project/platform-123",
					requirePackageBugsUrl: true,
					disableGitHubIssues: true,
					requireBranchIssueKey: true,
					requirePrIssueKey: true,
					prReferenceMode: "either",
					branchPrefix: "codex",
				},
			});

			expect(result.success).toBe(true);
			expect(result.data?.issueTrackingPolicy?.provider).toBe("linear");
		});

		it("rejects a non-Linear project URL", () => {
			const result = validateContract({
				version: "1.0",
				issueTrackingPolicy: {
					provider: "linear",
					projectUrl: "https://example.com/issues",
				},
			});

			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("issueTrackingPolicy");
		});

		it("rejects an invalid prReferenceMode", () => {
			const result = validateContract({
				version: "1.0",
				issueTrackingPolicy: {
					provider: "linear",
					prReferenceMode: "close",
				},
			});

			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("issueTrackingPolicy");
			expect(result.errors[0]?.code).toBe(ValidationErrorCode.INVALID_VALUE);
		});
	});

	describe("toolingPolicy", () => {
		it("accepts the required tooling policy surface", () => {
			const result = validateContract({
				version: "1.5.0",
				toolingPolicy: {
					requiredDocumentationTerms: ["node", "pnpm"],
					requiredBinaries: ["node", "pnpm"],
					requiredMiseTools: [
						{ tool: "node", version: "24.13.1" },
						{ tool: "pnpm", version: "10.33.0" },
					],
					miseFilePath: ".mise.toml",
					readinessScriptPath: "scripts/check-environment.sh",
					codexEnvironment: {
						path: ".codex/environments/environment.toml",
						requiredActions: [
							{ name: "Tools", icon: "tool" },
							{ name: "Test", icon: "test" },
						],
					},
					makefile: {
						path: "Makefile",
						requiredTargets: ["check", "env-check"],
					},
					packagePolicy: {
						packageJsonPath: "package.json",
						explicitCapabilities: ["ui"],
						capabilityDetectors: [
							{ capability: "ui", dependencyMarkers: ["react", "vite"] },
						],
						requiredPackages: [
							{
								package: "@brainwav/design-system-guidance",
								dependencyType: "either",
								requiredWhenCapabilities: ["ui"],
							},
						],
					},
					projectBrainMemoryExtension: {
						enabled: true,
						requiredPaths: [
							".harness/memory/LEARNINGS.md",
							".harness/knowledge/INDEX.md",
						],
					},
				},
			});

			expect(result.success).toBe(true);
			expect(result.data?.toolingPolicy?.requiredMiseTools).toHaveLength(2);
		});

		it("rejects invalid tooling action icons", () => {
			const result = validateContract({
				version: "1.5.0",
				toolingPolicy: {
					requiredDocumentationTerms: ["node"],
					requiredBinaries: ["node"],
					requiredMiseTools: [{ tool: "node", version: "24.13.1" }],
					miseFilePath: ".mise.toml",
					readinessScriptPath: "scripts/check-environment.sh",
					codexEnvironment: {
						path: ".codex/environments/environment.toml",
						requiredActions: [{ name: "Tools", icon: "gear" }],
					},
					makefile: {
						path: "Makefile",
						requiredTargets: ["check"],
					},
					packagePolicy: {
						packageJsonPath: "package.json",
						explicitCapabilities: ["ui"],
						capabilityDetectors: [
							{ capability: "ui", dependencyMarkers: ["react"] },
						],
						requiredPackages: [
							{
								package: "@brainwav/design-system-guidance",
								dependencyType: "either",
								requiredWhenCapabilities: ["ui"],
							},
						],
					},
				},
			});

			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("toolingPolicy");
		});

		it("rejects toolingPolicy with missing mise tool version", () => {
			const result = validateContract({
				version: "1.5.0",
				toolingPolicy: {
					requiredDocumentationTerms: ["node"],
					requiredBinaries: ["node"],
					requiredMiseTools: [{ tool: "node" }],
					miseFilePath: ".mise.toml",
					readinessScriptPath: "scripts/check-environment.sh",
					codexEnvironment: {
						path: ".codex/environments/environment.toml",
						requiredActions: [{ name: "Tools", icon: "tool" }],
					},
					makefile: {
						path: "Makefile",
						requiredTargets: ["check"],
					},
					packagePolicy: {
						packageJsonPath: "package.json",
						explicitCapabilities: ["ui"],
						capabilityDetectors: [
							{ capability: "ui", dependencyMarkers: ["react"] },
						],
						requiredPackages: [
							{
								package: "@brainwav/design-system-guidance",
								dependencyType: "either",
								requiredWhenCapabilities: ["ui"],
							},
						],
					},
				},
			});

			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("toolingPolicy");
		});

		it("rejects toolingPolicy with invalid conditional package dependency type", () => {
			const result = validateContract({
				version: "1.5.0",
				toolingPolicy: {
					requiredDocumentationTerms: ["node"],
					requiredBinaries: ["node"],
					requiredMiseTools: [{ tool: "node", version: "24.13.1" }],
					miseFilePath: ".mise.toml",
					readinessScriptPath: "scripts/check-environment.sh",
					codexEnvironment: {
						path: ".codex/environments/environment.toml",
						requiredActions: [{ name: "Tools", icon: "tool" }],
					},
					makefile: {
						path: "Makefile",
						requiredTargets: ["check"],
					},
					packagePolicy: {
						packageJsonPath: "package.json",
						explicitCapabilities: ["ui"],
						capabilityDetectors: [
							{ capability: "ui", dependencyMarkers: ["react"] },
						],
						requiredPackages: [
							{
								package: "@brainwav/design-system-guidance",
								dependencyType: "optional",
								requiredWhenCapabilities: ["ui"],
							},
						],
					},
				},
			});

			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("toolingPolicy");
		});

		it("rejects toolingPolicy with invalid explicit capability", () => {
			const result = validateContract({
				version: "1.5.0",
				toolingPolicy: {
					requiredDocumentationTerms: ["node"],
					requiredBinaries: ["node"],
					requiredMiseTools: [{ tool: "node", version: "24.13.1" }],
					miseFilePath: ".mise.toml",
					readinessScriptPath: "scripts/check-environment.sh",
					codexEnvironment: {
						path: ".codex/environments/environment.toml",
						requiredActions: [{ name: "Tools", icon: "tool" }],
					},
					makefile: {
						path: "Makefile",
						requiredTargets: ["check"],
					},
					packagePolicy: {
						packageJsonPath: "package.json",
						explicitCapabilities: ["native_ui"],
						capabilityDetectors: [
							{ capability: "ui", dependencyMarkers: ["react"] },
						],
						requiredPackages: [
							{
								package: "@brainwav/design-system-guidance",
								dependencyType: "either",
								requiredWhenCapabilities: ["ui"],
							},
						],
					},
				},
			});

			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("toolingPolicy");
		});

		it("rejects toolingPolicy with invalid projectBrainMemoryExtension paths", () => {
			const result = validateContract({
				version: "1.5.0",
				toolingPolicy: {
					requiredDocumentationTerms: ["node"],
					requiredBinaries: ["node"],
					requiredMiseTools: [{ tool: "node", version: "24.13.1" }],
					miseFilePath: ".mise.toml",
					readinessScriptPath: "scripts/check-environment.sh",
					codexEnvironment: {
						path: ".codex/environments/environment.toml",
						requiredActions: [{ name: "Tools", icon: "tool" }],
					},
					makefile: {
						path: "Makefile",
						requiredTargets: ["check"],
					},
					packagePolicy: {
						packageJsonPath: "package.json",
						explicitCapabilities: ["ui"],
						capabilityDetectors: [
							{ capability: "ui", dependencyMarkers: ["react"] },
						],
						requiredPackages: [
							{
								package: "@brainwav/design-system-guidance",
								dependencyType: "either",
								requiredWhenCapabilities: ["ui"],
							},
						],
					},
					projectBrainMemoryExtension: {
						enabled: true,
						requiredPaths: [".harness/memory/LEARNINGS.md", 42],
					},
				},
			});

			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("toolingPolicy");
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
						coderabbit: {
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
						coderabbit: {
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

	// Docs Gate Policy Tests
	describe("docsGatePolicy", () => {
		it("accepts valid docsGatePolicy in advisory mode", () => {
			const result = validateContract({
				version: "1.0",
				docsGatePolicy: {
					enabled: true,
					mode: "advisory",
					rules: [
						{
							ruleId: "cli-surface-docs",
							when: { categories: ["cli_surface"] },
							requireDocs: ["README.md"],
							severity: "error",
						},
					],
				},
			});
			expect(result.success).toBe(true);
			expect(result.data?.docsGatePolicy?.enabled).toBe(true);
			expect(result.data?.docsGatePolicy?.mode).toBe("advisory");
		});

		it("accepts valid docsGatePolicy in required mode", () => {
			const result = validateContract({
				version: "1.0",
				docsGatePolicy: {
					enabled: true,
					mode: "required",
					rules: [],
				},
			});
			expect(result.success).toBe(true);
			expect(result.data?.docsGatePolicy?.mode).toBe("required");
		});

		it("accepts docsGatePolicy with surfaces", () => {
			const result = validateContract({
				version: "1.0",
				docsGatePolicy: {
					enabled: true,
					mode: "advisory",
					rules: [],
					surfaces: [
						{
							path: "README.md",
							surfaceType: "root_doc",
							owner: "implementation",
							requiredFor: ["cli_surface"],
						},
					],
				},
			});
			expect(result.success).toBe(true);
			expect(result.data?.docsGatePolicy?.surfaces).toHaveLength(1);
		});

		it("accepts docsGatePolicy with tooling and architecture categories", () => {
			const result = validateContract({
				version: "1.0",
				docsGatePolicy: {
					enabled: true,
					mode: "required",
					rules: [
						{
							ruleId: "tooling-runtime-docs",
							when: { categories: ["tooling_runtime"] },
							requireDocs: ["docs/agents/02-tooling-policy.md"],
							severity: "error",
						},
						{
							ruleId: "architecture-context-docs",
							when: { categories: ["architecture_context"] },
							requireDocs: ["docs/agents/00-architecture-bootstrap.md"],
							severity: "error",
						},
					],
					surfaces: [
						{
							path: "docs/agents/02-tooling-policy.md",
							surfaceType: "governance_doc",
							owner: "workflow",
							requiredFor: ["tooling_runtime"],
						},
						{
							path: "docs/agents/00-architecture-bootstrap.md",
							surfaceType: "governance_doc",
							owner: "workflow",
							requiredFor: ["architecture_context"],
						},
					],
				},
			});
			expect(result.success).toBe(true);
		});

		it("accepts docsGatePolicy with workflow-authority surfaces", () => {
			const result = validateContract({
				version: "1.0",
				docsGatePolicy: {
					enabled: true,
					mode: "required",
					rules: [],
					surfaces: [
						{
							path: "docs/agents/01-instruction-map.md",
							surfaceType: "workflow_doc",
							owner: "workflow",
							requiredFor: ["workflow_authority"],
						},
						{
							path: "docs/agents/14-docs-gate-rollout.md",
							surfaceType: "workflow_doc",
							owner: "workflow",
							requiredFor: ["workflow_authority"],
						},
					],
				},
			});

			expect(result.success).toBe(true);
		});

		it("accepts docsGatePolicy with tracked compound workflow artifact categories", () => {
			const result = validateContract({
				version: "1.0",
				docsGatePolicy: {
					enabled: true,
					mode: "required",
					rules: [
						{
							ruleId: "adr-artifact-docs",
							when: { categories: ["adr_artifact"] },
							requireDocs: ["docs/adr/"],
							severity: "error",
						},
						{
							ruleId: "spec-artifact-docs",
							when: { categories: ["spec_artifact"] },
							requireDocs: ["docs/specs/"],
							severity: "error",
						},
						{
							ruleId: "plan-artifact-docs",
							when: { categories: ["plan_artifact"] },
							requireDocs: ["docs/plans/"],
							severity: "error",
						},
						{
							ruleId: "brainstorm-artifact-docs",
							when: { categories: ["brainstorm_artifact"] },
							requireDocs: ["docs/brainstorms/"],
							severity: "error",
						},
					],
					surfaces: [
						{
							path: "docs/adr/",
							surfaceType: "workflow_doc",
							owner: "workflow",
							requiredFor: ["adr_artifact"],
						},
						{
							path: "docs/specs/",
							surfaceType: "workflow_doc",
							owner: "workflow",
							requiredFor: ["spec_artifact"],
						},
						{
							path: "docs/plans/",
							surfaceType: "workflow_doc",
							owner: "workflow",
							requiredFor: ["plan_artifact"],
						},
						{
							path: "docs/brainstorms/",
							surfaceType: "workflow_doc",
							owner: "workflow",
							requiredFor: ["brainstorm_artifact"],
						},
					],
				},
			});

			expect(result.success).toBe(true);
		});

		it("accepts docsGatePolicy with localHookEnabled", () => {
			const result = validateContract({
				version: "1.0",
				docsGatePolicy: {
					enabled: true,
					mode: "advisory",
					rules: [],
					localHookEnabled: true,
				},
			});
			expect(result.success).toBe(true);
			expect(result.data?.docsGatePolicy?.localHookEnabled).toBe(true);
		});

		it("rejects invalid mode value", () => {
			const result = validateContract({
				version: "1.0",
				docsGatePolicy: {
					enabled: true,
					mode: "invalid",
					rules: [],
				},
			});
			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("docsGatePolicy");
		});

		it("rejects non-boolean enabled", () => {
			const result = validateContract({
				version: "1.0",
				docsGatePolicy: {
					enabled: "yes",
					mode: "advisory",
					rules: [],
				},
			});
			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("docsGatePolicy");
		});

		it("rejects missing rules array", () => {
			const result = validateContract({
				version: "1.0",
				docsGatePolicy: {
					enabled: true,
					mode: "advisory",
				},
			});
			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("docsGatePolicy");
		});

		it("rejects rule with invalid severity", () => {
			const result = validateContract({
				version: "1.0",
				docsGatePolicy: {
					enabled: true,
					mode: "advisory",
					rules: [
						{
							ruleId: "test-rule",
							when: { categories: ["cli_surface"] },
							requireDocs: ["README.md"],
							severity: "critical",
						},
					],
				},
			});
			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("docsGatePolicy");
		});

		it("rejects rule with invalid category", () => {
			const result = validateContract({
				version: "1.0",
				docsGatePolicy: {
					enabled: true,
					mode: "advisory",
					rules: [
						{
							ruleId: "test-rule",
							when: { categories: ["invalid_category"] },
							requireDocs: ["README.md"],
							severity: "error",
						},
					],
				},
			});
			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("docsGatePolicy");
		});

		it("rejects rule with empty ruleId", () => {
			const result = validateContract({
				version: "1.0",
				docsGatePolicy: {
					enabled: true,
					mode: "advisory",
					rules: [
						{
							ruleId: "",
							when: { categories: ["cli_surface"] },
							requireDocs: ["README.md"],
							severity: "error",
						},
					],
				},
			});
			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("docsGatePolicy");
		});

		it("rejects surface with invalid surfaceType", () => {
			const result = validateContract({
				version: "1.0",
				docsGatePolicy: {
					enabled: true,
					mode: "advisory",
					rules: [],
					surfaces: [
						{
							path: "README.md",
							surfaceType: "invalid_type",
							owner: "implementation",
							requiredFor: ["cli_surface"],
						},
					],
				},
			});
			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("docsGatePolicy");
		});

		it("rejects surface with invalid owner", () => {
			const result = validateContract({
				version: "1.0",
				docsGatePolicy: {
					enabled: true,
					mode: "advisory",
					rules: [],
					surfaces: [
						{
							path: "README.md",
							surfaceType: "root_doc",
							owner: "invalid_owner",
							requiredFor: ["cli_surface"],
						},
					],
				},
			});
			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("docsGatePolicy");
		});

		it("accepts rule with fileGlobs instead of categories", () => {
			const result = validateContract({
				version: "1.0",
				docsGatePolicy: {
					enabled: true,
					mode: "advisory",
					rules: [
						{
							ruleId: "glob-rule",
							when: { fileGlobs: ["src/cli/**/*.ts"] },
							requireDocs: ["README.md"],
							severity: "error",
						},
					],
				},
			});
			expect(result.success).toBe(true);
		});

		it("accepts rule with allowDocOnly flag", () => {
			const result = validateContract({
				version: "1.0",
				docsGatePolicy: {
					enabled: true,
					mode: "advisory",
					rules: [
						{
							ruleId: "doc-only-rule",
							when: { categories: ["doc_only"] },
							requireDocs: [],
							severity: "info",
							allowDocOnly: true,
						},
					],
				},
			});
			expect(result.success).toBe(true);
		});
	});

	describe("controlPlanePolicy", () => {
		it("accepts valid controlPlane override policy", () => {
			const result = validateContract({
				version: "1.0",
				controlPlanePolicy: {
					overridePolicy: {
						authorizedPrincipals: ["jamie", "alex"],
						dualApprovalScopes: ["temporary_unblock", "temporary_promote"],
						maxTtlHours: 24,
						nonOverridableControls: [
							"canonical_runtime_invalid",
							"governance_trust_mismatch",
						],
					},
				},
			});
			expect(result.success).toBe(true);
			expect(result.data?.controlPlanePolicy?.overridePolicy.maxTtlHours).toBe(
				24,
			);
		});

		it("rejects controlPlane override policy with TTL above 24 hours", () => {
			const result = validateContract({
				version: "1.0",
				controlPlanePolicy: {
					overridePolicy: {
						authorizedPrincipals: ["jamie"],
						dualApprovalScopes: ["temporary_promote"],
						maxTtlHours: 48,
						nonOverridableControls: ["canonical_runtime_invalid"],
					},
				},
			});
			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("controlPlanePolicy");
		});
	});

	describe("contextIntegrityPolicy", () => {
		it("accepts valid contextIntegrityPolicy", () => {
			const result = validateContract({
				version: "1.5.0",
				contextIntegrityPolicy: {
					mode: "shadow",
					truthSources: [
						{
							path: "README.md",
							kind: "file",
							authority: "canonical",
							required: true,
						},
					],
					contradictionCatalog: [
						{
							id: "required-check-conflict",
							category: "required_check_conflict",
							severity: "error",
							description: "Workflow checks must match contract checks.",
						},
					],
					healthSampling: {
						fixtureSetPath: "artifacts/context-integrity/fixtures.json",
						fixtureSetId: "context-integrity-v1",
						allowedTriggerTypes: ["current_checkout", "recent_artifacts"],
						samplingCadence: "per_run",
						dedupeScope: "query",
					},
				},
			});

			expect(result.success).toBe(true);
			expect(result.data?.contextIntegrityPolicy?.mode).toBe("shadow");
		});

		it("rejects invalid contextIntegrityPolicy mode", () => {
			const result = validateContract({
				version: "1.5.0",
				contextIntegrityPolicy: {
					mode: "enforced",
					truthSources: [
						{
							path: "README.md",
							kind: "file",
							authority: "canonical",
							required: true,
						},
					],
					contradictionCatalog: [],
					healthSampling: {
						fixtureSetPath: "artifacts/context-integrity/fixtures.json",
						fixtureSetId: "context-integrity-v1",
						allowedTriggerTypes: ["current_checkout"],
						samplingCadence: "per_run",
						dedupeScope: "query",
					},
				},
			});

			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("contextIntegrityPolicy");
		});
	});

	describe("contextCompact", () => {
		it("accepts valid contextCompact policy", () => {
			const result = validateContract({
				version: "1.5.0",
				contextCompact: {
					thresholdPercent: 85,
					microCompactThresholdTokens: 1200,
					strategy: "balanced",
				},
			});

			expect(result.success).toBe(true);
			expect(result.data?.contextCompact?.strategy).toBe("balanced");
		});

		it("rejects invalid contextCompact strategy", () => {
			const result = validateContract({
				version: "1.5.0",
				contextCompact: {
					thresholdPercent: 85,
					microCompactThresholdTokens: 1200,
					strategy: "unknown",
				},
			});

			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("contextCompact");
		});
	});
});
