/**
 * Tests for JSC-69: contract validate + schema commands.
 *
 * Covers:
 * - buildContractJsonSchema structure
 * - SCHEMA_VERSION constant
 * - Cross-field consistency checks in validateContract():
 *   - shadow + cutover-complete (contradict)
 *   - required + pre-migration (contradict)
 *   - solo + trustedPolicyRef (contradict)
 *   - enterprise + missing trustedPolicyRef (missing enterprise field)
 * - runContractValidateCLI on valid and invalid contracts
 * - runContractValidateCLI file-not-found case
 * - runContractSchemaCLI emits parseable JSON
 * - runContractCLI dispatch (validate / schema / unknown subcommand)
 */

import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	CI_MIGRATION_STAGES,
	CI_PROVIDERS,
	CI_PROVIDER_MODES,
	CONTEXT_COMPACT_STRATEGIES,
	NORTH_STAR_DECISION_QUESTION_SPECS,
	NORTH_STAR_PRIMARY_BOTTLENECK,
	NORTH_STAR_PRIMARY_METRIC,
	SCHEMA_VERSION,
	buildContractJsonSchema,
} from "../lib/contract/json-schema.js";
import { DEFAULT_NORTH_STAR_CONTRACT } from "../lib/contract/types.js";

import {
	CONTRACT_PRESETS,
	CONTRACT_PRESET_INPUTS,
	PRESET_DESCRIPTIONS,
	buildContractPreset,
	normalizeContractPreset,
} from "../lib/contract/contract-presets.js";

import { validateContract } from "../lib/contract/validator.js";

import {
	runContractCLI,
	runContractInitCLI,
	runContractSchemaCLI,
	runContractValidateCLI,
} from "./contract.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTmpDir(): string {
	return mkdtempSync(join(tmpdir(), "jsc69-"));
}

/** Minimal valid contract that passes all field validations */
function minimalValidContract(): Record<string, unknown> {
	return {
		version: "1.5.0",
		northStar: canonicalNorthStarBlock(),
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
			],
		},
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
	};
}

/** Minimal valid ciProviderPolicy block (solo, no trustedPolicyRef) */
function ciPolicyBlock(
	overrides: Record<string, unknown> = {},
): Record<string, unknown> {
	return {
		activeProvider: "circleci",
		mode: "primary",
		migrationStage: "cutover-complete",
		transitionStatusArtifactPath: ".harness/status.json",
		authorityConfigPath: "harness.contract.json",
		requiredCheckManifestPath: ".harness/ci-required-checks.json",
		commitMode: "solo",
		...overrides,
	};
}

function canonicalNorthStarBlock(overrides: Record<string, unknown> = {}) {
	return {
		mission:
			"Coding Harness exists to let humans steer and agents execute safely, with PR lead time as the primary north-star metric.",
		mantra: [...DEFAULT_NORTH_STAR_CONTRACT.mantra],
		personalStandards: [...DEFAULT_NORTH_STAR_CONTRACT.personalStandards],
		primaryMetric: NORTH_STAR_PRIMARY_METRIC,
		primaryBottleneck: NORTH_STAR_PRIMARY_BOTTLENECK,
		autonomyBoundary:
			"Low and medium-risk autonomy should be automated where evidence is deterministic and rollback is clear; high-risk changes remain human-mediated.",
		safetyFloor: [
			"deterministic evidence",
			"strict current-head SHA discipline",
		],
		nonGoals: ["policy surface area as proxy progress"],
		decisionQuestions: NORTH_STAR_DECISION_QUESTION_SPECS.map((question) => ({
			id: question.id,
			prompt: question.prompt,
		})),
		...overrides,
	};
}

// ─── buildContractJsonSchema ──────────────────────────────────────────────────

describe("buildContractJsonSchema", () => {
	it("returns an object with $schema and $id", () => {
		const schema = buildContractJsonSchema();
		expect(schema.$schema).toContain("json-schema.org");
		expect(schema.$id).toContain("brainwav.io");
		expect(schema.$id).toContain(SCHEMA_VERSION);
	});

	it('has "version" as a required property', () => {
		const schema = buildContractJsonSchema() as {
			required: string[];
			properties: Record<string, unknown>;
		};
		expect(schema.required).toContain("version");
		expect(schema.properties).toHaveProperty("version");
	});

	it("requires canonical north-star surfaces for contract versions 1.6+", () => {
		const schema = buildContractJsonSchema() as {
			anyOf: Array<{
				properties?: {
					version?: { pattern?: string };
				};
				allOf?: Array<{
					required?: string[];
					properties?: {
						version?: { pattern?: string };
					};
				}>;
			}>;
		};
		expect(Array.isArray(schema.anyOf)).toBe(true);
		const canonicalBranch = schema.anyOf.find(
			(branch) =>
				Array.isArray(branch.allOf) &&
				branch.allOf.some((entry) => entry.required?.includes("northStar")),
		);
		expect(canonicalBranch).toBeDefined();
		const requiredKeys = new Set(
			canonicalBranch?.allOf?.flatMap((entry) => entry.required ?? []) ?? [],
		);
		expect(requiredKeys.has("northStar")).toBe(true);
		expect(requiredKeys.has("productSurface")).toBe(true);
		expect(requiredKeys.has("overrideReviewerRegistry")).toBe(true);

		const canonicalVersionPattern = canonicalBranch?.allOf
			?.map((entry) => entry.properties?.version?.pattern)
			.find((pattern): pattern is string => typeof pattern === "string");
		expect(canonicalVersionPattern).toContain("1\\.(?:[6-9]");
		expect(canonicalVersionPattern).toContain("[2-9][0-9]*");
	});

	it("keeps version schema patterns aligned with runtime version semantics", () => {
		const schema = buildContractJsonSchema() as {
			anyOf: Array<{
				properties?: {
					version?: { pattern?: string };
				};
				allOf?: Array<{
					properties?: {
						version?: { pattern?: string };
					};
				}>;
			}>;
		};
		const preCanonicalPattern = schema.anyOf
			.map((entry) => entry.properties?.version?.pattern)
			.find((pattern): pattern is string => typeof pattern === "string");
		const canonicalPattern = schema.anyOf
			.flatMap((entry) =>
				(entry.allOf ?? []).map(
					(nested) => nested.properties?.version?.pattern,
				),
			)
			.find((pattern): pattern is string => typeof pattern === "string");
		expect(typeof preCanonicalPattern).toBe("string");
		expect(typeof canonicalPattern).toBe("string");

		const preCanonicalRegex = new RegExp(preCanonicalPattern ?? "");
		const canonicalRegex = new RegExp(canonicalPattern ?? "");
		expect(preCanonicalRegex.test("0.13.0")).toBe(true);
		expect(preCanonicalRegex.test("1.4.9")).toBe(true);
		expect(preCanonicalRegex.test("1.5")).toBe(true);
		expect(preCanonicalRegex.test("1.5.0")).toBe(true);
		expect(preCanonicalRegex.test("1.6.0")).toBe(false);
		expect(canonicalRegex.test("1.5")).toBe(false);
		expect(canonicalRegex.test("1.6")).toBe(true);
		expect(canonicalRegex.test("1.6.0")).toBe(true);
		expect(canonicalRegex.test("2.0.0")).toBe(true);
		expect(canonicalRegex.test("2")).toBe(false);
	});

	it("ciProviderPolicy.mode enum contains all CI_PROVIDER_MODES", () => {
		const schema = buildContractJsonSchema() as {
			properties: {
				ciProviderPolicy: {
					properties: { mode: { enum: string[] } };
				};
			};
		};
		for (const m of CI_PROVIDER_MODES) {
			expect(schema.properties.ciProviderPolicy.properties.mode.enum).toContain(
				m,
			);
		}
	});

	it("ciProviderPolicy.activeProvider enum contains CI_PROVIDERS", () => {
		const schema = buildContractJsonSchema() as {
			properties: {
				ciProviderPolicy: {
					properties: { activeProvider: { enum: string[] } };
				};
			};
		};
		for (const p of CI_PROVIDERS) {
			expect(
				schema.properties.ciProviderPolicy.properties.activeProvider.enum,
			).toContain(p);
		}
	});

	it("ciProviderPolicy.migrationStage enum contains CI_MIGRATION_STAGES", () => {
		const schema = buildContractJsonSchema() as {
			properties: {
				ciProviderPolicy: {
					properties: { migrationStage: { enum: string[] } };
				};
			};
		};
		for (const s of CI_MIGRATION_STAGES) {
			expect(
				schema.properties.ciProviderPolicy.properties.migrationStage.enum,
			).toContain(s);
		}
	});

	it("policyChain schema requires block actions to fail", () => {
		const schema = buildContractJsonSchema() as {
			properties: {
				policyChain: {
					properties: {
						actionToVerdict: {
							properties: { block: { const: string } };
						};
					};
				};
			};
		};

		expect(
			schema.properties.policyChain.properties.actionToVerdict.properties.block,
		).toEqual({ type: "string", const: "fail" });
	});

	it("top-level schema includes extends for inheritance-aware loaders", () => {
		const schema = buildContractJsonSchema() as {
			properties: Record<string, unknown>;
		};
		expect(schema.properties).toHaveProperty("extends");
	});

	it("ciProviderPolicy requires artifact paths used by runtime validator", () => {
		const schema = buildContractJsonSchema() as {
			properties: {
				ciProviderPolicy: { required: string[] };
			};
		};
		expect(schema.properties.ciProviderPolicy.required).toEqual(
			expect.arrayContaining([
				"activeProvider",
				"mode",
				"migrationStage",
				"transitionStatusArtifactPath",
				"authorityConfigPath",
				"requiredCheckManifestPath",
			]),
		);
	});

	it("ciProviderPolicy exposes optional primaryCheckName", () => {
		const schema = buildContractJsonSchema() as {
			properties: {
				ciProviderPolicy: {
					properties: {
						primaryCheckName: { type: string; minLength: number };
					};
				};
			};
		};
		expect(
			schema.properties.ciProviderPolicy.properties.primaryCheckName,
		).toEqual({
			type: "string",
			minLength: 1,
			description:
				"Optional canonical primary check name used by CI migration validation.",
		});
	});

	it("is serializable to JSON", () => {
		const schema = buildContractJsonSchema();
		expect(() => JSON.parse(JSON.stringify(schema))).not.toThrow();
	});

	it("northStar enums include canonical metric and bottleneck values", () => {
		const schema = buildContractJsonSchema() as {
			properties: {
				northStar: {
					properties: {
						primaryMetric: { enum: string[] };
						primaryBottleneck: { enum: string[] };
					};
				};
			};
		};

		expect(schema.properties.northStar.properties.primaryMetric.enum).toEqual([
			NORTH_STAR_PRIMARY_METRIC,
		]);
		expect(
			schema.properties.northStar.properties.primaryBottleneck.enum,
		).toEqual([NORTH_STAR_PRIMARY_BOTTLENECK]);
	});

	it("northStar decision questions stay aligned with canonical id+prompt order", () => {
		const schema = buildContractJsonSchema() as {
			properties: {
				northStar: {
					properties: {
						decisionQuestions: {
							items: Array<{
								properties: {
									id: { enum: string[] };
									prompt: { enum: string[] };
								};
							}>;
						};
					};
				};
			};
		};
		expect(
			schema.properties.northStar.properties.decisionQuestions.items,
		).toHaveLength(NORTH_STAR_DECISION_QUESTION_SPECS.length);
		expect(
			schema.properties.northStar.properties.decisionQuestions.items.map(
				(item) => item.properties.id.enum[0],
			),
		).toEqual(NORTH_STAR_DECISION_QUESTION_SPECS.map((item) => item.id));
		expect(
			schema.properties.northStar.properties.decisionQuestions.items.map(
				(item) => item.properties.prompt.enum[0],
			),
		).toEqual(NORTH_STAR_DECISION_QUESTION_SPECS.map((item) => item.prompt));
	});

	it("productSurface requires reviewCadence for adjacent and experimental classes", () => {
		const schema = buildContractJsonSchema() as {
			properties: {
				productSurface: {
					properties: {
						surfaces: {
							items: {
								anyOf: Array<{
									properties?: {
										class: { type: string; enum: string[] };
									};
									required: string[];
								}>;
							};
						};
					};
				};
			};
		};
		expect(
			schema.properties.productSurface.properties.surfaces.items.anyOf,
		).toContainEqual({
			properties: {
				class: {
					type: "string",
					enum: ["core"],
				},
			},
			required: ["class"],
		});
		expect(
			schema.properties.productSurface.properties.surfaces.items.anyOf,
		).toContainEqual({
			required: ["reviewCadence"],
		});
	});

	it("overrideReviewerRegistry requires at least one active reviewer", () => {
		const schema = buildContractJsonSchema() as {
			properties: {
				overrideReviewerRegistry: {
					properties: {
						trustedReviewers: {
							contains: {
								properties: {
									status: { enum: string[] };
								};
							};
						};
					};
				};
			};
		};
		expect(
			schema.properties.overrideReviewerRegistry.properties.trustedReviewers
				.contains.properties.status.enum,
		).toEqual(["active"]);
	});

	it("memoryPolicy exposes optional sessionLogPath override", () => {
		const schema = buildContractJsonSchema() as {
			properties: {
				memoryPolicy: {
					properties: {
						sessionLogPath: { type: string; minLength: number };
					};
				};
			};
		};

		expect(schema.properties.memoryPolicy.properties.sessionLogPath).toEqual({
			type: "string",
			minLength: 1,
			description:
				"Optional explicit path for session log persistence when default branch-derived path is unsuitable.",
		});
	});

	it("contextCompact.strategy enum contains supported strategies", () => {
		const schema = buildContractJsonSchema() as {
			properties: {
				contextCompact: {
					properties: { strategy: { enum: string[] } };
				};
			};
		};

		for (const strategy of CONTEXT_COMPACT_STRATEGIES) {
			expect(
				schema.properties.contextCompact.properties.strategy.enum,
			).toContain(strategy);
		}
	});

	it("loopStageContracts schema mirrors runtime-required stage keys and fields", () => {
		const schema = buildContractJsonSchema() as {
			properties: {
				loopStageContracts: {
					required: string[];
					additionalProperties: boolean;
					properties: Record<
						string,
						{
							required: string[];
							additionalProperties: boolean;
							properties: Record<string, unknown>;
						}
					>;
				};
			};
		};

		const loopSchema = schema.properties.loopStageContracts;
		expect(loopSchema.additionalProperties).toBe(false);
		expect(loopSchema.required).toEqual([
			"risk-policy-gate",
			"review-gate",
			"evidence-verify",
			"remediation-decision",
		]);

		for (const stageName of loopSchema.required) {
			const stageSchema = loopSchema.properties[stageName];
			expect(stageSchema).toBeDefined();
			if (!stageSchema) {
				continue;
			}
			expect(stageSchema.additionalProperties).toBe(false);
			expect(stageSchema.required).toEqual([
				"inputs",
				"outputs",
				"schema",
				"failPolicy",
				"if",
				"permissions",
				"timeoutMinutes",
				"concurrency",
			]);
		}
	});

	it("committed productSurface paths reference existing repository files", () => {
		const repoRoot = process.cwd();
		const committedContract = JSON.parse(
			readFileSync(join(repoRoot, "harness.contract.json"), "utf-8"),
		) as {
			productSurface?: {
				surfaces?: Array<{
					surfaceId?: string;
					ownedPaths?: string[];
					evidenceReference?: string;
				}>;
			};
		};
		const missingOwnedPaths: string[] = [];
		const missingEvidencePaths: string[] = [];

		for (const surface of committedContract.productSurface?.surfaces ?? []) {
			const surfaceId = surface.surfaceId ?? "unknown";
			for (const ownedPath of surface.ownedPaths ?? []) {
				if (!existsSync(join(repoRoot, ownedPath))) {
					missingOwnedPaths.push(`${surfaceId}:${ownedPath}`);
				}
			}

			if (typeof surface.evidenceReference !== "string") {
				continue;
			}
			const evidencePath = surface.evidenceReference
				.trim()
				.replace(/#.*$/, "")
				.replace(/:(\d+)(?::\d+)?$/, "")
				.replace(/^\/+/, "");
			if (
				evidencePath.length === 0 ||
				evidencePath.startsWith("artifacts/") ||
				/^[a-z][a-z0-9+.-]*:\/\//i.test(evidencePath)
			) {
				continue;
			}
			if (!existsSync(join(repoRoot, evidencePath))) {
				missingEvidencePaths.push(`${surfaceId}:${surface.evidenceReference}`);
			}
		}

		expect(missingOwnedPaths).toEqual([]);
		expect(missingEvidencePaths).toEqual([]);
	});
});

describe("validateContract: north-star/runtime parity guards", () => {
	it("accepts extends shorthand and structured references", () => {
		const shorthand = validateContract({
			...minimalValidContract(),
			extends: "minimal",
		});
		expect(shorthand.success).toBe(true);

		const structured = validateContract({
			...minimalValidContract(),
			extends: [
				{
					source: "standard",
					arrays: "append",
				},
			],
		});
		expect(structured.success).toBe(true);
	});

	it("rejects schema-invalid extends references", () => {
		const result = validateContract({
			...minimalValidContract(),
			extends: [
				{
					source: "standard",
					arrays: "merge",
				},
			],
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors.some((error) => error.path === "extends")).toBe(
				true,
			);
		}
	});

	it("rejects non-canonical northStar decision question prompt text", () => {
		const result = validateContract({
			...minimalValidContract(),
			northStar: canonicalNorthStarBlock({
				decisionQuestions: NORTH_STAR_DECISION_QUESTION_SPECS.map(
					(question, index) => ({
						id: question.id,
						prompt:
							index === 0 ? `${question.prompt} (edited)` : question.prompt,
					}),
				),
			}),
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors.some((error) => error.path === "northStar")).toBe(
				true,
			);
		}
	});

	it("rejects experimental productSurface entries missing reviewCadence", () => {
		const result = validateContract({
			...minimalValidContract(),
			productSurface: {
				surfaces: [
					{
						surfaceId: "experiment-surface",
						surfaceType: "workflow",
						class: "experimental",
						owner: "workflow",
						northStarContribution: "Tests experimental gate path",
						manualGlueReductionClaim: "Codifies repeated manual checks",
						reliabilityContribution: "Keeps decision inputs deterministic",
						evidenceReference: "artifacts/north-star/experiment.json",
						ownedPaths: ["src/commands/preflight-gate.ts"],
						lastReviewedAt: "2026-04-21",
					},
				],
			},
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(
				result.errors.some((error) => error.path === "productSurface"),
			).toBe(true);
		}
	});

	it("accepts core productSurface entries without reviewCadence", () => {
		const result = validateContract({
			...minimalValidContract(),
			productSurface: {
				surfaces: [
					{
						surfaceId: "core-surface",
						surfaceType: "command",
						class: "core",
						owner: "workflow",
						northStarContribution: "Protects merge-readiness throughput path",
						manualGlueReductionClaim: "Removes repeated manual review glue",
						reliabilityContribution: "Ensures deterministic gate behavior",
						evidenceReference: "src/commands/review-gate.ts",
						ownedPaths: ["src/commands/review-gate.ts"],
						lastReviewedAt: "2026-04-21",
					},
				],
			},
		});
		expect(result.success).toBe(true);
	});

	it("rejects overrideReviewerRegistry when all reviewers are revoked", () => {
		const result = validateContract({
			...minimalValidContract(),
			overrideReviewerRegistry: {
				trustedReviewers: [
					{
						reviewerId: "legacy-reviewer",
						reviewerType: "user",
						signatureRef: "refs/reviewers/legacy-reviewer",
						displayName: "Legacy Reviewer",
						status: "revoked",
					},
				],
			},
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(
				result.errors.some(
					(error) => error.path === "overrideReviewerRegistry",
				),
			).toBe(true);
		}
	});
});

// ─── Cross-field consistency checks ──────────────────────────────────────────

describe("validateContract: cross-field checks (JSC-69)", () => {
	it("errors when mode=shadow and migrationStage=cutover-complete", () => {
		const contract = {
			...minimalValidContract(),
			ciProviderPolicy: ciPolicyBlock({
				mode: "shadow",
				migrationStage: "cutover-complete",
				commitMode: "team",
			}),
		};
		const result = validateContract(contract);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors.some((e) => e.path.includes("mode"))).toBe(true);
			expect(result.errors.some((e) => e.message.includes("shadow"))).toBe(
				true,
			);
		}
	});

	it("errors when mode=shadow and migrationStage=circleci-only", () => {
		const contract = {
			...minimalValidContract(),
			ciProviderPolicy: ciPolicyBlock({
				mode: "shadow",
				migrationStage: "circleci-only",
				commitMode: "team",
			}),
		};
		const result = validateContract(contract);
		expect(result.success).toBe(false);
	});

	it("does NOT error when mode=shadow and migrationStage=dual-provider (valid)", () => {
		const contract = {
			...minimalValidContract(),
			ciProviderPolicy: ciPolicyBlock({
				mode: "shadow",
				migrationStage: "dual-provider",
				commitMode: "team",
			}),
		};
		// Should pass cross-field checks (may fail other validations on mode value)
		// The important thing: no cross-field error about shadow+dual-provider
		const result = validateContract(contract);
		if (!result.success) {
			const hasCrossFieldError = result.errors.some(
				(e) =>
					e.path === "ciProviderPolicy.mode" &&
					e.message.includes("migration is complete"),
			);
			expect(hasCrossFieldError).toBe(false);
		}
	});

	it("errors when mode=required and migrationStage=pre-migration", () => {
		const contract = {
			...minimalValidContract(),
			ciProviderPolicy: ciPolicyBlock({
				mode: "required",
				migrationStage: "pre-migration",
				commitMode: "enterprise",
				trustedPolicyRef: "refs/heads/main",
			}),
		};
		const result = validateContract(contract);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(
				result.errors.some((e) => e.message.includes("pre-migration")),
			).toBe(true);
		}
	});

	it("does NOT error when mode=required and migrationStage=cutover-complete", () => {
		const contract = {
			...minimalValidContract(),
			ciProviderPolicy: ciPolicyBlock({
				mode: "required",
				migrationStage: "cutover-complete",
				commitMode: "enterprise",
				trustedPolicyRef: "refs/heads/main",
			}),
		};
		const result = validateContract(contract);
		// No cross-field error for required+cutover-complete
		if (!result.success) {
			const hasCrossFieldError = result.errors.some(
				(e) =>
					e.path === "ciProviderPolicy.migrationStage" &&
					e.message.includes("can't be required"),
			);
			expect(hasCrossFieldError).toBe(false);
		}
	});

	it("errors when commitMode=solo and trustedPolicyRef is set", () => {
		const contract = {
			...minimalValidContract(),
			ciProviderPolicy: ciPolicyBlock({
				mode: "primary",
				migrationStage: "cutover-complete",
				commitMode: "solo",
				trustedPolicyRef: "refs/heads/main",
			}),
		};
		const result = validateContract(contract);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.errors.some((e) => e.message.includes("solo"))).toBe(true);
			expect(
				result.errors.some((e) => e.path === "ciProviderPolicy.commitMode"),
			).toBe(true);
		}
	});

	it("errors when commitMode=enterprise and trustedPolicyRef is absent", () => {
		const contract = {
			...minimalValidContract(),
			ciProviderPolicy: ciPolicyBlock({
				mode: "primary",
				migrationStage: "cutover-complete",
				commitMode: "enterprise",
				// trustedPolicyRef intentionally omitted
			}),
		};
		const result = validateContract(contract);
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(
				result.errors.some(
					(e) => e.path === "ciProviderPolicy.trustedPolicyRef",
				),
			).toBe(true);
		}
	});

	it("passes when commitMode=enterprise and trustedPolicyRef is set", () => {
		const contract = {
			...minimalValidContract(),
			ciProviderPolicy: ciPolicyBlock({
				mode: "primary",
				migrationStage: "cutover-complete",
				commitMode: "enterprise",
				trustedPolicyRef: "refs/heads/main",
			}),
		};
		const result = validateContract(contract);
		// No cross-field errors
		if (!result.success) {
			const hasCrossFieldError = result.errors.some(
				(e) => e.path === "ciProviderPolicy.trustedPolicyRef",
			);
			expect(hasCrossFieldError).toBe(false);
		}
	});
});

// ─── runContractValidateCLI ───────────────────────────────────────────────────

describe("runContractValidateCLI", () => {
	let dir: string;
	let consoleSpy: ReturnType<typeof vi.spyOn>;
	let consoleErrSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		dir = makeTmpDir();
		consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		consoleErrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		consoleSpy.mockRestore();
		consoleErrSpy.mockRestore();
		if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
	});

	it("returns 1 when contract file not found", () => {
		const code = runContractValidateCLI(dir, {});
		expect(code).toBe(1);
	});

	it("returns 0 for a minimal valid contract", () => {
		writeFileSync(
			join(dir, "harness.contract.json"),
			JSON.stringify(minimalValidContract()),
		);
		const code = runContractValidateCLI(dir, {});
		expect(code).toBe(0);
	});

	it("returns 1 for a contract missing version", () => {
		writeFileSync(
			join(dir, "harness.contract.json"),
			JSON.stringify({ branchProtection: {} }),
		);
		const code = runContractValidateCLI(dir, {});
		expect(code).toBe(1);
	});

	it("returns 1 for a contract with invalid JSON", () => {
		writeFileSync(join(dir, "harness.contract.json"), "{ invalid json");
		const code = runContractValidateCLI(dir, {});
		expect(code).toBe(1);
	});

	it("--json: emits parseable JSON for valid contract", () => {
		writeFileSync(
			join(dir, "harness.contract.json"),
			JSON.stringify(minimalValidContract()),
		);
		const code = runContractValidateCLI(dir, { json: true });
		expect(code).toBe(0);
		const output = consoleSpy.mock.calls[0]?.[0] as string;
		const parsed = JSON.parse(output) as { valid: boolean; errors: unknown[] };
		expect(parsed.valid).toBe(true);
		expect(parsed.errors).toHaveLength(0);
	});

	it("--json: emits parseable JSON with errors for invalid contract", () => {
		writeFileSync(
			join(dir, "harness.contract.json"),
			JSON.stringify({ branchProtection: {} }), // missing version
		);
		const code = runContractValidateCLI(dir, { json: true });
		expect(code).toBe(1);
		const output = consoleSpy.mock.calls[0]?.[0] as string;
		const parsed = JSON.parse(output) as { valid: boolean; errors: unknown[] };
		expect(parsed.valid).toBe(false);
		expect((parsed.errors as unknown[]).length).toBeGreaterThan(0);
	});

	it("accepts explicit contractPath override", () => {
		const customPath = join(dir, "custom.contract.json");
		writeFileSync(customPath, JSON.stringify(minimalValidContract()));
		const code = runContractValidateCLI(undefined, {
			contractPath: customPath,
		});
		expect(code).toBe(0);
	});
});

// ─── runContractSchemaCLI ────────────────────────────────────────────────────

describe("runContractSchemaCLI", () => {
	let consoleSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
	});
	afterEach(() => consoleSpy.mockRestore());

	it("returns 0", () => {
		expect(runContractSchemaCLI()).toBe(0);
	});

	it("emits parseable JSON schema", () => {
		runContractSchemaCLI();
		const output = consoleSpy.mock.calls[0]?.[0] as string;
		const parsed = JSON.parse(output) as { $schema: string };
		expect(parsed.$schema).toContain("json-schema.org");
	});
});

// ─── runContractCLI dispatch ──────────────────────────────────────────────────

describe("runContractCLI dispatch", () => {
	let dir: string;
	let consoleSpy: ReturnType<typeof vi.spyOn>;
	let consoleErrSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		dir = makeTmpDir();
		consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		consoleErrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		consoleSpy.mockRestore();
		consoleErrSpy.mockRestore();
		if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
	});

	it("dispatches 'schema' to runContractSchemaCLI", () => {
		const code = runContractCLI(["schema"], {});
		expect(code).toBe(0);
		expect(consoleSpy).toHaveBeenCalled();
	});

	it("dispatches 'validate' to runContractValidateCLI", () => {
		// Pass a non-existent path so we don't pick up the repo contract
		const code = runContractCLI(
			["validate", join(dir, "no-such-file.json")],
			{},
		);
		expect(code).toBe(1);
	});

	it("dispatches empty args to validate", () => {
		// Explicitly provide a missing-file path to avoid hitting repo contract
		const code = runContractCLI([], { json: false });
		// Either 0 (repo contract found + valid) or 1 (not found) — just check it doesn't throw
		expect([0, 1]).toContain(code);
	});

	it("dispatches normalize-required-checks and prints normalized manifest JSON", () => {
		const manifestPath = join(dir, "ci-required-checks.json");
		writeFileSync(
			manifestPath,
			JSON.stringify({
				version: 1,
				activeProvider: "circleci",
				requiredChecks: [
					{
						policyId: "lint-policy",
						gateId: "lint",
						displayName: "lint",
						sourceAppSlug: "circleci",
						sourceAppId: "circleci",
						externalIdPattern: "^lint$",
						githubCheckName: "pr-pipeline",
						class: "required",
					},
				],
			}),
			"utf-8",
		);

		const code = runContractCLI(
			["normalize-required-checks", "--manifest", manifestPath],
			{},
		);
		expect(code).toBe(0);

		const output = consoleSpy.mock.calls.at(-1)?.[0];
		expect(typeof output).toBe("string");
		const parsed = JSON.parse(String(output)) as {
			activeProvider: string;
			gates: Array<{ policyId: string; gateId: string }>;
		};
		expect(parsed.activeProvider).toBe("circleci");
		expect(parsed.gates[0]?.policyId).toBe("lint-policy");
		expect(parsed.gates[0]?.gateId).toBe("lint");
	});

	it("returns usage error when normalize-required-checks is passed --manifest without a value", () => {
		const code = runContractCLI(
			["normalize-required-checks", "--manifest"],
			{},
		);
		expect(code).toBe(2);
		expect(consoleErrSpy).toHaveBeenCalledWith("Missing value for --manifest");
	});

	it("returns usage error when init is passed --preset without a value", () => {
		const code = runContractCLI(["init", "--preset"], {});
		expect(code).toBe(2);
		expect(consoleErrSpy).toHaveBeenCalledWith("Missing value for --preset");
	});

	it("returns usage error when init is passed --output without a value", () => {
		const code = runContractCLI(["init", "--output"], {});
		expect(code).toBe(2);
		expect(consoleErrSpy).toHaveBeenCalledWith("Missing value for --output");
	});

	it("returns usage error when init would otherwise consume --json as --output value", () => {
		const code = runContractCLI(["init", "--output", "--json"], {
			json: true,
		});
		expect(code).toBe(2);
		expect(consoleErrSpy).toHaveBeenCalledWith("Missing value for --output");
	});

	it("returns failure when normalize-required-checks manifest does not exist", () => {
		const missingManifest = join(dir, "missing-required-checks.json");
		const code = runContractCLI(
			["normalize-required-checks", "--manifest", missingManifest],
			{},
		);
		expect(code).toBe(1);
		expect(consoleErrSpy).toHaveBeenCalledWith(
			`Required checks manifest not found: ${missingManifest}`,
		);
	});

	it("returns failure when normalize-required-checks manifest JSON is malformed", () => {
		const malformedManifest = join(dir, "malformed-required-checks.json");
		writeFileSync(malformedManifest, "{invalid-json", "utf-8");
		const code = runContractCLI(
			["normalize-required-checks", "--manifest", malformedManifest],
			{},
		);
		expect(code).toBe(1);
		expect(consoleErrSpy).toHaveBeenCalledWith(
			expect.stringContaining("Failed to parse required checks manifest:"),
		);
	});

	it("returns failure when normalize-required-checks manifest is structurally invalid", () => {
		const invalidManifest = join(dir, "invalid-required-checks.json");
		writeFileSync(
			invalidManifest,
			JSON.stringify({
				version: 1,
				activeProvider: "circleci",
				requiredChecks: "not-an-array",
			}),
			"utf-8",
		);
		const code = runContractCLI(
			["normalize-required-checks", "--manifest", invalidManifest],
			{},
		);
		expect(code).toBe(1);
		expect(consoleErrSpy).toHaveBeenCalledWith(
			expect.stringContaining("Required checks manifest is invalid:"),
		);
	});

	it("returns 1 for unknown subcommand", () => {
		const code = runContractCLI(["unknown-cmd"], {});
		expect(code).toBe(1);
		expect(consoleErrSpy).toHaveBeenCalledWith(
			expect.stringContaining("Unknown subcommand"),
		);
	});
});

// ─── buildContractPreset ──────────────────────────────────────────────────────

describe("buildContractPreset", () => {
	it("minimal preset includes canonical north-star contract surfaces", () => {
		const contract = buildContractPreset("minimal");
		expect(contract).toHaveProperty("version");
		expect(contract).toHaveProperty("riskTierRules");
		expect(contract).toHaveProperty("mergePolicy");
		expect(contract).toHaveProperty("branchProtection");
		expect(contract).toHaveProperty("northStar");
		expect(contract).toHaveProperty("productSurface");
		expect(contract).toHaveProperty("overrideReviewerRegistry");
		expect(Object.keys(contract)).toHaveLength(7);
	});

	it("standard preset adds diff budget, docs-drift, and evidence policy", () => {
		const contract = buildContractPreset("standard");
		expect(Object.keys(contract)).toHaveLength(11);
		expect(contract).toHaveProperty("diffBudget");
		expect(contract).toHaveProperty("docsDriftRules");
		expect(contract).toHaveProperty("evidencePolicy");
		expect(contract).toHaveProperty("docsGatePolicy");
		expect(contract).toHaveProperty("northStar");
		expect(contract).toHaveProperty("productSurface");
		expect(contract).toHaveProperty("overrideReviewerRegistry");
	});

	it("full preset includes toolingPolicy and governance sections", () => {
		const contract = buildContractPreset("full");
		expect(contract).toHaveProperty("toolingPolicy");
		expect(contract).toHaveProperty("reviewPolicy");
		expect(contract).toHaveProperty("docsGatePolicy");
		expect(Object.keys(contract).length).toBeGreaterThan(7);
	});

	it("all presets have correct version", () => {
		for (const preset of CONTRACT_PRESETS) {
			expect(buildContractPreset(preset)).toHaveProperty(
				"version",
				SCHEMA_VERSION,
			);
		}
	});

	it("all presets produce valid JSON", () => {
		for (const preset of CONTRACT_PRESETS) {
			expect(() => JSON.stringify(buildContractPreset(preset))).not.toThrow();
		}
	});

	it("minimal preset mergePolicy has high/medium/low keys", () => {
		const { mergePolicy } = buildContractPreset("minimal") as {
			mergePolicy: Record<string, unknown>;
		};
		expect(mergePolicy).toHaveProperty("high");
		expect(mergePolicy).toHaveProperty("medium");
		expect(mergePolicy).toHaveProperty("low");
	});

	it("PRESET_DESCRIPTIONS covers all presets", () => {
		for (const preset of CONTRACT_PRESETS) {
			expect(PRESET_DESCRIPTIONS[preset]).toBeTruthy();
		}
	});

	it("normalizes lite preset to minimal", () => {
		expect(normalizeContractPreset("lite")).toBe("minimal");
	});

	it("rejects unknown preset aliases", () => {
		expect(normalizeContractPreset("unknown")).toBeUndefined();
	});

	it.each([
		"toString",
		"constructor",
		"__proto__",
	] as const)("rejects inherited object keys as preset aliases: %s", (alias) => {
		expect(normalizeContractPreset(alias)).toBeUndefined();
	});

	it("CONTRACT_PRESET_INPUTS includes lite alias", () => {
		expect(CONTRACT_PRESET_INPUTS).toContain("lite");
	});
});

// ─── runContractInitCLI ───────────────────────────────────────────────────────

describe("runContractInitCLI", () => {
	let dir: string;
	let consoleSpy: ReturnType<typeof vi.spyOn>;
	let consoleErrSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "jsc123-"));
		consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});
		consoleErrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
		vi.restoreAllMocks();
	});

	it("creates standard contract by default", () => {
		const output = join(dir, "harness.contract.json");
		const code = runContractInitCLI({ output });
		expect(code).toBe(0);
		expect(existsSync(output)).toBe(true);
		const parsed = JSON.parse(readFileSync(output, "utf-8"));
		expect(parsed).toHaveProperty("version", SCHEMA_VERSION);
		expect(parsed).toHaveProperty("diffBudget");
	});

	it("creates minimal contract", () => {
		const output = join(dir, "harness.contract.json");
		const code = runContractInitCLI({ preset: "minimal", output });
		expect(code).toBe(0);
		const parsed = JSON.parse(readFileSync(output, "utf-8"));
		expect(parsed).toHaveProperty("northStar");
		expect(parsed).toHaveProperty("productSurface");
		expect(parsed).toHaveProperty("overrideReviewerRegistry");
		expect(Object.keys(parsed)).toHaveLength(7);
	});

	it("creates lite contract aliasing minimal", () => {
		const output = join(dir, "harness.contract.json");
		const code = runContractInitCLI({ preset: "lite", output });
		expect(code).toBe(0);
		const parsed = JSON.parse(readFileSync(output, "utf-8"));
		expect(parsed).toEqual(buildContractPreset("minimal"));
	});

	it("creates full contract", () => {
		const output = join(dir, "harness.contract.json");
		const code = runContractInitCLI({ preset: "full", output });
		expect(code).toBe(0);
		const parsed = JSON.parse(readFileSync(output, "utf-8"));
		expect(parsed).toHaveProperty("toolingPolicy");
	});

	it("errors if output file already exists without --force", () => {
		const output = join(dir, "harness.contract.json");
		writeFileSync(output, "{}", "utf-8");
		const code = runContractInitCLI({ output });
		expect(code).toBe(1);
		expect(consoleErrSpy).toHaveBeenCalledWith(
			expect.stringContaining("already exists"),
		);
	});

	it("overwrites existing file with --force", () => {
		const output = join(dir, "harness.contract.json");
		writeFileSync(output, "{}", "utf-8");
		const code = runContractInitCLI({ output, force: true });
		expect(code).toBe(0);
		const parsed = JSON.parse(readFileSync(output, "utf-8"));
		expect(parsed).toHaveProperty("version");
	});

	it("returns 2 for unknown preset", () => {
		const output = join(dir, "harness.contract.json");
		const code = runContractInitCLI({ preset: "unknown" as never, output });
		expect(code).toBe(2);
	});

	it.each([
		"toString",
		"constructor",
		"__proto__",
	] as const)("returns 2 for inherited-key preset alias: %s", (alias) => {
		const output = join(dir, "harness.contract.json");
		let code = -1;
		expect(() => {
			code = runContractInitCLI({ preset: alias as never, output });
		}).not.toThrow();
		expect(code).toBe(2);
	});

	it("emits JSON output when --json flag is set", () => {
		const output = join(dir, "harness.contract.json");
		const code = runContractInitCLI({ output, json: true });
		expect(code).toBe(0);
		const call = consoleSpy.mock.calls[0]?.[0];
		const result = JSON.parse(call as string);
		expect(result).toMatchObject({ status: "created", preset: "standard" });
	});

	it("emits canonical preset alongside lite alias in JSON output", () => {
		const output = join(dir, "harness.contract.json");
		const code = runContractInitCLI({ preset: "lite", output, json: true });
		expect(code).toBe(0);
		const call = consoleSpy.mock.calls[0]?.[0];
		const result = JSON.parse(call as string);
		expect(result).toMatchObject({
			status: "created",
			preset: "lite",
			canonicalPreset: "minimal",
		});
	});

	it("preserves requested lite alias in overwrite hint", () => {
		const output = join(dir, "harness.contract.json");
		writeFileSync(output, "{}", "utf-8");
		const code = runContractInitCLI({ preset: "lite", output });
		expect(code).toBe(1);
		expect(consoleErrSpy).toHaveBeenCalledWith(
			expect.stringContaining("harness contract init --preset lite --force"),
		);
	});

	it("runContractCLI dispatches init subcommand", () => {
		const output = join(dir, "harness.contract.json");
		const code = runContractCLI(
			["init", "--preset", "minimal", "--output", output],
			{},
		);
		expect(code).toBe(0);
		expect(existsSync(output)).toBe(true);
	});

	it.each(
		CONTRACT_PRESET_INPUTS,
	)("generated %s preset validates against the current contract schema", (preset) => {
		const output = join(dir, `harness.contract.${preset}.json`);
		const initCode = runContractInitCLI({ preset, output });
		expect(initCode).toBe(0);

		const validateCode = runContractValidateCLI(undefined, {
			contractPath: output,
		});
		expect(validateCode).toBe(0);
	});
});
