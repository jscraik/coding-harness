import { describe, expect, it } from "vitest";
import { NORTH_STAR_DECISION_QUESTION_SPECS } from "./types.js";
import { ValidationErrorCode, validateContract } from "./validator.js";

const canonicalDecisionQuestions = NORTH_STAR_DECISION_QUESTION_SPECS.map(
	(question) => ({
		id: question.id,
		prompt: question.prompt,
	}),
);

const validNorthStar = {
	mission:
		"Coding Harness exists to let humans steer and agents execute safely, with PR lead time as the primary north-star metric.",
	mantra: [
		"Thin Surface",
		"Strong Guardrails",
		"Durable Memory",
		"Simplicity / Minimalism",
		"Self Improvement",
		"Professional Output",
	],
	personalStandards: [
		"moral courage",
		"self-discipline",
		"respect for others",
		"integrity",
		"loyalty to self and others",
		"selfless commitment",
	],
	primaryMetric: "pr_lead_time",
	primaryBottleneck: "review_rework_loop",
	autonomyBoundary:
		"Low and medium-risk autonomy should be automated where evidence is deterministic and rollback is clear; high-risk changes remain human-mediated.",
	safetyFloor: ["deterministic evidence", "strict current-head SHA discipline"],
	nonGoals: ["policy surface area as proxy progress"],
	decisionQuestions: canonicalDecisionQuestions,
} as const;

const validProductSurface = {
	surfaces: [
		{
			surfaceId: "review-gate",
			surfaceType: "command",
			class: "core",
			owner: "workflow",
			northStarContribution:
				"Constrains merge-readiness decisions to throughput path",
			manualGlueReductionClaim:
				"Converts repeated review comments into deterministic checks",
			reliabilityContribution: "Ensures the same questions are asked every run",
			evidenceReference: "artifacts/north-star/review-gate.json",
			ownedPaths: ["src/commands/review-gate.ts"],
			lastReviewedAt: "2026-04-21",
		},
	],
} as const;

const validOverrideReviewerRegistry = {
	trustedReviewers: [
		{
			reviewerId: "jamie-craik",
			reviewerType: "user",
			signatureRef: "refs/reviewers/jamie-craik",
			displayName: "Jamie Craik",
			status: "active",
		},
	],
} as const;

function withCanonicalNorthStarSurfaces(
	contract: Record<string, unknown>,
): Record<string, unknown> {
	return {
		northStar: validNorthStar,
		productSurface: validProductSurface,
		overrideReviewerRegistry: validOverrideReviewerRegistry,
		...contract,
	};
}

function validToolingPolicy(
	overrides: Record<string, unknown> = {},
): Record<string, unknown> {
	return {
		requiredDocumentationTerms: ["node"],
		requiredBinaries: ["node"],
		requiredMiseTools: [{ tool: "node", version: "26.3.0" }],
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
			capabilityDetectors: [{ capability: "ui", dependencyMarkers: ["react"] }],
			requiredPackages: [
				{
					package: "@brainwav/design-system-guidance",
					dependencyType: "either",
					requiredWhenCapabilities: ["ui"],
				},
			],
		},
		...overrides,
	};
}

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

	describe("extends field validation", () => {
		it.each([
			{ version: "1.0", extends: "preset://base" },
			{
				version: "1.0",
				extends: {
					source: "preset://typescript",
					arrays: "append",
					integrity: "sha256-abc123",
				},
			},
			{
				version: "1.0",
				extends: [
					"preset://base",
					{
						source: "preset://typescript",
						arrays: "prepend",
					},
				],
			},
		])("accepts valid extends shape: %j", (contract) => {
			const result = validateContract(contract);
			expect(result.success).toBe(true);
		});

		it.each([
			{ version: "1.0", extends: [] },
			{
				version: "1.0",
				extends: {
					source: "preset://typescript",
					arrays: "merge",
				},
			},
			{
				version: "1.0",
				extends: {
					source: "preset://typescript",
					integrity: "sha1-deadbeef",
				},
			},
		])("rejects invalid extends shape: %j", (contract) => {
			const result = validateContract(contract);
			expect(result.success).toBe(false);
			expect(
				result.errors.some(
					(error) =>
						error.path === "extends" &&
						error.code === ValidationErrorCode.INVALID_VALUE,
				),
			).toBe(true);
		});
	});

	describe("north-star contract surfaces", () => {
		it("requires canonical north-star surfaces for contract versions 1.6+", () => {
			const result = validateContract({ version: "1.6.0" });

			expect(result.success).toBe(false);
			expect(result.errors.map((error) => error.path)).toEqual(
				expect.arrayContaining([
					"northStar",
					"productSurface",
					"overrideReviewerRegistry",
				]),
			);
		});

		it.each([
			{ version: "1.4.9", expectsRequired: false },
			{ version: "1.5", expectsRequired: false },
			{ version: "1.5.0", expectsRequired: false },
			{ version: "1.6", expectsRequired: true },
			{ version: "1.6.0", expectsRequired: true },
			{ version: "2.0.0", expectsRequired: true },
		])("enforces canonical north-star surfaces only from version boundary ($version)", ({
			version,
			expectsRequired,
		}) => {
			const result = validateContract({ version });
			const hasNorthStarRequiredError = result.errors.some(
				(error) => error.path === "northStar",
			);
			if (expectsRequired) {
				expect(hasNorthStarRequiredError).toBe(true);
				return;
			}
			expect(hasNorthStarRequiredError).toBe(false);
		});

		it.each([
			"v1.5.0",
			"1.5.x",
			"01.5.0",
		])("rejects malformed contract version format (%s)", (version) => {
			const result = validateContract({ version });
			expect(result.success).toBe(false);
			expect(
				result.errors.some(
					(error) =>
						error.path === "version" &&
						error.code === ValidationErrorCode.INVALID_VALUE,
				),
			).toBe(true);
		});

		it("accepts a canonical northStar block", () => {
			const result = validateContract(
				withCanonicalNorthStarSurfaces({
					version: "1.5.0",
					northStar: validNorthStar,
				}),
			);

			expect(result.success).toBe(true);
			expect(result.data?.northStar?.primaryMetric).toBe("pr_lead_time");
			expect(result.data?.northStar?.decisionQuestions).toEqual(
				canonicalDecisionQuestions,
			);
		});

		it("backfills new northStar orientation fields for existing 1.6 contracts", () => {
			const legacyNorthStar = {
				mission: validNorthStar.mission,
				primaryMetric: validNorthStar.primaryMetric,
				primaryBottleneck: validNorthStar.primaryBottleneck,
				autonomyBoundary: validNorthStar.autonomyBoundary,
				safetyFloor: validNorthStar.safetyFloor,
				nonGoals: validNorthStar.nonGoals,
				decisionQuestions: validNorthStar.decisionQuestions,
			};
			const result = validateContract(
				withCanonicalNorthStarSurfaces({
					version: "1.6.0",
					northStar: legacyNorthStar,
				}),
			);

			expect(result.success).toBe(true);
			expect(result.data?.northStar?.mantra).toEqual(validNorthStar.mantra);
			expect(result.data?.northStar?.personalStandards).toEqual(
				validNorthStar.personalStandards,
			);
		});

		it("rejects explicitly invalid northStar orientation fields", () => {
			const legacyNorthStar = {
				mission: validNorthStar.mission,
				primaryMetric: validNorthStar.primaryMetric,
				primaryBottleneck: validNorthStar.primaryBottleneck,
				autonomyBoundary: validNorthStar.autonomyBoundary,
				safetyFloor: validNorthStar.safetyFloor,
				nonGoals: validNorthStar.nonGoals,
				decisionQuestions: validNorthStar.decisionQuestions,
				mantra: [],
			};
			const result = validateContract(
				withCanonicalNorthStarSurfaces({
					version: "1.6.0",
					northStar: legacyNorthStar,
				}),
			);

			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("northStar");
			expect(result.errors[0]?.code).toBe(ValidationErrorCode.INVALID_VALUE);
		});

		it("rejects northStar with non-canonical decision question order", () => {
			const reversedQuestions = [...canonicalDecisionQuestions].reverse();
			const result = validateContract(
				withCanonicalNorthStarSurfaces({
					version: "1.5.0",
					northStar: {
						...validNorthStar,
						decisionQuestions: reversedQuestions,
					},
				}),
			);

			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("northStar");
			expect(result.errors[0]?.code).toBe(ValidationErrorCode.INVALID_VALUE);
		});

		it("rejects productSurface entries missing reviewCadence for adjacent class", () => {
			const result = validateContract(
				withCanonicalNorthStarSurfaces({
					version: "1.5.0",
					productSurface: {
						surfaces: [
							{
								surfaceId: "preflight-gate",
								surfaceType: "command",
								class: "adjacent",
								owner: "workflow",
								northStarContribution:
									"Blocks non-throughput policy surface expansion",
								manualGlueReductionClaim:
									"Codifies recurring admission comments",
								reliabilityContribution:
									"Normalizes admission requirements before review",
								evidenceReference: "artifacts/north-star/preflight-gate.json",
								ownedPaths: ["src/commands/preflight-gate.ts"],
								lastReviewedAt: "2026-04-21",
							},
						],
					},
				}),
			);

			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("productSurface");
			expect(result.errors[0]?.code).toBe(ValidationErrorCode.INVALID_VALUE);
		});

		it("rejects invalid reviewCadence values", () => {
			const result = validateContract(
				withCanonicalNorthStarSurfaces({
					version: "1.5.0",
					productSurface: {
						surfaces: [
							{
								surfaceId: "drift-gate",
								surfaceType: "command",
								class: "adjacent",
								owner: "workflow",
								northStarContribution:
									"Monitors contract and quality drift automatically",
								manualGlueReductionClaim:
									"Replaces manual status checks with deterministic drift reporting",
								reliabilityContribution:
									"Flags stale policy surfaces before they block throughput",
								evidenceReference: "artifacts/north-star/drift-gate.json",
								reviewCadence: "daily",
								ownedPaths: ["src/commands/drift-gate.ts"],
								lastReviewedAt: "2026-04-21",
							},
						],
					},
				}),
			);

			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("productSurface");
			expect(result.errors[0]?.code).toBe(ValidationErrorCode.INVALID_VALUE);
		});

		it("accepts productSurface entries with required cadence on non-core classes", () => {
			const result = validateContract(
				withCanonicalNorthStarSurfaces({
					version: "1.5.0",
					productSurface: {
						surfaces: [
							{
								surfaceId: "review-gate",
								surfaceType: "command",
								class: "core",
								owner: "workflow",
								northStarContribution:
									"Constrains merge-readiness decisions to throughput path",
								manualGlueReductionClaim:
									"Converts repeated review comments into deterministic checks",
								reliabilityContribution:
									"Ensures the same questions are asked every run",
								evidenceReference: "artifacts/north-star/review-gate.json",
								ownedPaths: ["src/commands/review-gate.ts"],
								lastReviewedAt: "2026-04-21",
							},
							{
								surfaceId: "agent-first-status",
								surfaceType: "document",
								class: "adjacent",
								owner: "workflow",
								northStarContribution:
									"Tracks outcomes directly against primary throughput metric",
								manualGlueReductionClaim:
									"Removes manual status interpretation for release reviews",
								reliabilityContribution:
									"Makes drift visible in one canonical matrix",
								evidenceReference: "docs/roadmap/agent-first-status.md",
								reviewCadence: "per_release",
								ownedPaths: ["docs/roadmap/agent-first-status.md"],
								lastReviewedAt: "2026-04-21",
							},
						],
					},
				}),
			);

			expect(result.success).toBe(true);
			expect(result.data?.productSurface?.surfaces).toHaveLength(2);
		});

		it("rejects productSurface registries with no registered surfaces", () => {
			const result = validateContract(
				withCanonicalNorthStarSurfaces({
					version: "1.5.0",
					productSurface: {
						surfaces: [],
					},
				}),
			);

			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("productSurface");
			expect(result.errors[0]?.code).toBe(ValidationErrorCode.INVALID_VALUE);
		});

		it("rejects overrideReviewerRegistry without an active trusted reviewer", () => {
			const result = validateContract(
				withCanonicalNorthStarSurfaces({
					version: "1.5.0",
					overrideReviewerRegistry: {
						trustedReviewers: [
							{
								reviewerId: "legacy-reviewer",
								reviewerType: "user",
								signatureRef: "refs/reviewers/legacy",
								displayName: "Legacy Reviewer",
								status: "revoked",
							},
						],
					},
				}),
			);

			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("overrideReviewerRegistry");
			expect(result.errors[0]?.code).toBe(ValidationErrorCode.INVALID_VALUE);
		});

		it("accepts overrideReviewerRegistry with unique trusted reviewer refs", () => {
			const result = validateContract(
				withCanonicalNorthStarSurfaces({
					version: "1.5.0",
					overrideReviewerRegistry: {
						trustedReviewers: [
							{
								reviewerId: "jamie-craik",
								reviewerType: "user",
								signatureRef: "refs/reviewers/jamie-craik",
								displayName: "Jamie Craik",
								status: "active",
							},
						],
					},
				}),
			);

			expect(result.success).toBe(true);
			expect(
				result.data?.overrideReviewerRegistry?.trustedReviewers[0]?.status,
			).toBe("active");
		});

		it("rejects duplicate productSurface surfaceId values", () => {
			const result = validateContract(
				withCanonicalNorthStarSurfaces({
					version: "1.5.0",
					productSurface: {
						surfaces: [
							{
								surfaceId: "review-gate",
								surfaceType: "command",
								class: "core",
								owner: "workflow",
								northStarContribution:
									"Constrains merge-readiness decisions to throughput path",
								manualGlueReductionClaim:
									"Converts repeated review comments into deterministic checks",
								reliabilityContribution:
									"Ensures the same questions are asked every run",
								evidenceReference: "artifacts/north-star/review-gate.json",
								ownedPaths: ["src/commands/review-gate.ts"],
								lastReviewedAt: "2026-04-21",
							},
							{
								surfaceId: "review-gate",
								surfaceType: "document",
								class: "adjacent",
								owner: "workflow",
								northStarContribution:
									"Tracks throughput posture in the status matrix",
								manualGlueReductionClaim:
									"Removes manual summarization for release reviews",
								reliabilityContribution:
									"Creates one canonical reporting surface",
								evidenceReference: "docs/roadmap/agent-first-status.md",
								reviewCadence: "per_release",
								ownedPaths: ["docs/roadmap/agent-first-status.md"],
								lastReviewedAt: "2026-04-21",
							},
						],
					},
				}),
			);

			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("productSurface");
			expect(result.errors[0]?.code).toBe(ValidationErrorCode.INVALID_VALUE);
		});

		it("rejects productSurface surfaceId values that only differ by whitespace", () => {
			const result = validateContract(
				withCanonicalNorthStarSurfaces({
					version: "1.5.0",
					productSurface: {
						surfaces: [
							{
								surfaceId: "review-gate",
								surfaceType: "command",
								class: "core",
								owner: "workflow",
								northStarContribution:
									"Constrains merge-readiness decisions to throughput path",
								manualGlueReductionClaim:
									"Converts repeated review comments into deterministic checks",
								reliabilityContribution:
									"Ensures the same questions are asked every run",
								evidenceReference: "artifacts/north-star/review-gate.json",
								ownedPaths: ["src/commands/review-gate.ts"],
								lastReviewedAt: "2026-04-21",
							},
							{
								surfaceId: "review-gate ",
								surfaceType: "document",
								class: "adjacent",
								owner: "workflow",
								northStarContribution:
									"Tracks throughput posture in the status matrix",
								manualGlueReductionClaim:
									"Removes manual summarization for release reviews",
								reliabilityContribution:
									"Creates one canonical reporting surface",
								evidenceReference: "docs/roadmap/agent-first-status.md",
								reviewCadence: "per_release",
								ownedPaths: ["docs/roadmap/agent-first-status.md"],
								lastReviewedAt: "2026-04-21",
							},
						],
					},
				}),
			);

			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("productSurface");
			expect(result.errors[0]?.code).toBe(ValidationErrorCode.INVALID_VALUE);
		});

		it("rejects duplicate overrideReviewerRegistry reviewerId values", () => {
			const result = validateContract(
				withCanonicalNorthStarSurfaces({
					version: "1.5.0",
					overrideReviewerRegistry: {
						trustedReviewers: [
							{
								reviewerId: "jamie-craik",
								reviewerType: "user",
								signatureRef: "refs/reviewers/jamie-craik",
								displayName: "Jamie Craik",
								status: "active",
							},
							{
								reviewerId: "jamie-craik",
								reviewerType: "service",
								signatureRef: "refs/reviewers/jamie-craik-agent",
								displayName: "Jamie Agent",
								status: "revoked",
							},
						],
					},
				}),
			);

			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("overrideReviewerRegistry");
			expect(result.errors[0]?.code).toBe(ValidationErrorCode.INVALID_VALUE);
			expect(result.errors[0]?.message).toContain("unique trusted reviewers");
		});

		it("rejects duplicate overrideReviewerRegistry signatureRef values", () => {
			const result = validateContract(
				withCanonicalNorthStarSurfaces({
					version: "1.5.0",
					overrideReviewerRegistry: {
						trustedReviewers: [
							{
								reviewerId: "jamie-craik",
								reviewerType: "user",
								signatureRef: "refs/reviewers/shared-signature",
								displayName: "Jamie Craik",
								status: "active",
							},
							{
								reviewerId: "automation-bot",
								reviewerType: "service",
								signatureRef: "refs/reviewers/shared-signature",
								displayName: "Automation Bot",
								status: "revoked",
							},
						],
					},
				}),
			);

			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("overrideReviewerRegistry");
			expect(result.errors[0]?.code).toBe(ValidationErrorCode.INVALID_VALUE);
			expect(result.errors[0]?.message).toContain("unique trusted reviewers");
		});
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

		it("rejects policy chain when block actions map to pass", () => {
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
						block: "pass",
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

		it("accepts automated review evidence for solo-maintainer repositories", () => {
			const result = validateContract({
				version: "1.0",
				reviewPolicy: {
					timeoutSeconds: 600,
					timeoutAction: "fail",
					approvalMode: "automated_review",
					automatedReviewers: [
						"coderabbitai[bot]",
						"chatgpt-codex-connector[bot]",
					],
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

		it("rejects an unknown review approval mode", () => {
			const result = validateContract({
				version: "1.0",
				reviewPolicy: {
					timeoutSeconds: 600,
					timeoutAction: "fail",
					approvalMode: "solo_bypass",
				},
			});
			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("reviewPolicy");
		});

		it("rejects automated review mode without named reviewers", () => {
			const result = validateContract({
				version: "1.0",
				reviewPolicy: {
					timeoutSeconds: 600,
					timeoutAction: "fail",
					approvalMode: "automated_review",
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

	describe("ciOwnership", () => {
		it("accepts CI ownership with release-only GitHub Actions workflow metadata", () => {
			const result = validateContract({
				version: "1.0",
				ciOwnership: {
					schemaVersion: "ci-ownership/v1",
					primaryPrGate: "circleci",
					reviewProvider: "coderabbit",
					securityChecks: ["semgrep-cloud-platform/scan"],
					fallbackWorkflows: [
						{
							path: ".github/workflows/release-private-npm.yml",
							role: "release_publishing",
							purpose: "Release publishing only.",
							allowAutomaticPrTriggers: false,
						},
					],
				},
			});

			expect(result.success).toBe(true);
		});

		it("rejects unsupported CI ownership migrations without schema evolution", () => {
			const result = validateContract({
				version: "1.0",
				ciOwnership: {
					schemaVersion: "ci-ownership/v1",
					primaryPrGate: "github-actions",
					reviewProvider: "coderabbit",
					securityChecks: ["semgrep-cloud-platform/scan"],
				},
			});

			expect(result.success).toBe(false);
			expect(result.errors.some((error) => error.path === "ciOwnership")).toBe(
				true,
			);
		});

		it("rejects CI ownership security checks missing from branch protection", () => {
			const result = validateContract({
				version: "1.0",
				branchProtection: {
					requiredChecks: ["CodeRabbit"],
				},
				ciOwnership: {
					schemaVersion: "ci-ownership/v1",
					primaryPrGate: "circleci",
					reviewProvider: "coderabbit",
					securityChecks: ["semgrep-cloud-platform/scan"],
				},
			});

			expect(result.success).toBe(false);
			expect(
				result.errors.some(
					(error) => error.path === "ciOwnership.securityChecks",
				),
			).toBe(true);
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
				version: "1.0",
				toolingPolicy: {
					requiredDocumentationTerms: ["node", "pnpm"],
					requiredBinaries: ["node", "pnpm"],
					requiredMiseTools: [
						{ tool: "node", version: "26.3.0" },
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
					sharedStateActions: [
						{
							name: "commit",
							authority: "user_or_explicit_request",
							writesGitState: true,
						},
						{
							name: "deploy",
							authority: "release_policy",
							writesExternalState: true,
						},
					],
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
			expect(result.data?.toolingPolicy?.sharedStateActions).toHaveLength(2);
		});

		it.each([
			{
				name: "non-array shared state actions",
				sharedStateActions: "commit",
			},
			{
				name: "missing authority",
				sharedStateActions: [{ name: "commit" }],
			},
			{
				name: "unknown authority",
				sharedStateActions: [{ name: "commit", authority: "autonomous" }],
			},
			{
				name: "invalid optional mutation flag",
				sharedStateActions: [
					{
						name: "commit",
						authority: "user_or_explicit_request",
						writesGitState: "yes",
					},
				],
			},
		])("rejects toolingPolicy with $name", ({ sharedStateActions }) => {
			const result = validateContract({
				version: "1.0",
				toolingPolicy: validToolingPolicy({ sharedStateActions }),
			});

			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("toolingPolicy");
			expect(result.errors[0]?.code).toBe(ValidationErrorCode.INVALID_VALUE);
		});

		it("rejects invalid tooling action icons", () => {
			const result = validateContract({
				version: "1.0",
				toolingPolicy: {
					requiredDocumentationTerms: ["node"],
					requiredBinaries: ["node"],
					requiredMiseTools: [{ tool: "node", version: "26.3.0" }],
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
				version: "1.0",
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
				version: "1.0",
				toolingPolicy: {
					requiredDocumentationTerms: ["node"],
					requiredBinaries: ["node"],
					requiredMiseTools: [{ tool: "node", version: "26.3.0" }],
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
				version: "1.0",
				toolingPolicy: {
					requiredDocumentationTerms: ["node"],
					requiredBinaries: ["node"],
					requiredMiseTools: [{ tool: "node", version: "26.3.0" }],
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
				version: "1.0",
				toolingPolicy: {
					requiredDocumentationTerms: ["node"],
					requiredBinaries: ["node"],
					requiredMiseTools: [{ tool: "node", version: "26.3.0" }],
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

	describe("memoryPolicy", () => {
		const baseMemoryPolicy = {
			enabled: true,
			provider: "local-memory",
			sessionIdTemplate: "{branch}-{timestamp}",
			domain: "coding-harness",
			requiredTags: ["session", "review"],
			maxObservationsPerStep: 10,
			allowedLevels: ["info", "warn", "error"],
			requireStartRead: true,
			requireCloseoutSummary: true,
			forbiddenContentPatterns: ["password", "secret"],
		} as const;

		it("accepts memoryPolicy with optional sessionLogPath", () => {
			const result = validateContract({
				version: "1.0",
				memoryPolicy: {
					...baseMemoryPolicy,
					sessionLogPath: ".harness/memory/sessions.log",
				},
			});
			expect(result.success).toBe(true);
			expect(result.data?.memoryPolicy?.sessionLogPath).toBe(
				".harness/memory/sessions.log",
			);
		});

		it("rejects memoryPolicy with empty sessionLogPath", () => {
			const result = validateContract({
				version: "1.0",
				memoryPolicy: {
					...baseMemoryPolicy,
					sessionLogPath: "   ",
				},
			});
			expect(result.success).toBe(false);
			expect(result.errors[0]?.path).toBe("memoryPolicy");
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
				version: "1.0",
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
				version: "1.0",
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
				version: "1.0",
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
				version: "1.0",
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
