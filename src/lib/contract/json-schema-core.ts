/**
 * JSC-69: Programmatic JSON Schema for harness.contract.json.
 *
 * Generates a JSON Schema Draft-07 document that:
 * 1. Documents every known top-level policy block with descriptions
 * 2. Enumerates all valid enum values
 * 3. Enables VS Code / JetBrains autocomplete via "$schema" reference
 * 4. Can be printed with `harness contract schema`
 *
 * Design notes
 * ─────────────
 * - Schema is expressed as plain TypeScript objects (no external deps)
 * - VALID_MODES / VALID_MIGRATION_STAGES must stay in sync with validator.ts
 * - Each $defs block mirrors the isValid* guard functions in validator.ts
 */

import {
	NORTH_STAR_DECISION_QUESTION_SPECS,
	NORTH_STAR_PRIMARY_BOTTLENECK,
	NORTH_STAR_PRIMARY_METRIC,
	PREFLIGHT_POST_HOOK_IDS,
	PREFLIGHT_PRE_HOOK_IDS,
} from "./types.js";
export {
	NORTH_STAR_DECISION_QUESTION_SPECS,
	NORTH_STAR_PRIMARY_BOTTLENECK,
	NORTH_STAR_PRIMARY_METRIC,
	PREFLIGHT_POST_HOOK_IDS,
	PREFLIGHT_PRE_HOOK_IDS,
} from "./types.js";

// ─── Schema version ───────────────────────────────────────────────────────────

export const SCHEMA_VERSION = "1.6.0" as const;
export const SCHEMA_ID =
	`https://schema.brainwav.io/coding-harness/contract/v${SCHEMA_VERSION}.json` as const;

// ─── Shared enum arrays ───────────────────────────────────────────────────────

/** Valid values for ciProviderPolicy.activeProvider */
export const CI_PROVIDERS = ["github-actions", "circleci"] as const;

/** Valid values for ciProviderPolicy.mode */
export const CI_PROVIDER_MODES = ["shadow", "primary", "required"] as const;

/** Valid values for ciProviderPolicy.migrationStage */
export const CI_MIGRATION_STAGES = [
	"pre-migration",
	"dual-provider",
	"circleci-primary",
	"circleci-only",
	"gha-primary",
	"gha-only",
	"cutover-complete",
] as const;

/** Valid values for ciProviderPolicy.commitMode */
export const COMMIT_MODES = ["solo", "team", "enterprise"] as const;

/** Valid values for contextIntegrityPolicy.mode */
export const CONTEXT_INTEGRITY_MODES = [
	"shadow",
	"advisory",
	"required",
] as const;

/** Valid values for contextCompact.strategy */
export const CONTEXT_COMPACT_STRATEGIES = [
	"balanced",
	"aggressive",
	"micro",
] as const;

/** Valid values for preflight gate extension hook IDs */
export const GATE_EXTENSION_HOOK_IDS = [
	...PREFLIGHT_PRE_HOOK_IDS,
	...PREFLIGHT_POST_HOOK_IDS,
] as const;

/** Valid risk tiers */
export const RISK_TIERS = ["high", "medium", "low"] as const;
export const POLICY_ACTIONS = ["allow", "block", "warn"] as const;
export const GATE_VERDICTS = ["pass", "fail"] as const;
export const PRODUCT_SURFACE_CLASSES = [
	"core",
	"adjacent",
	"experimental",
] as const;
export const PRODUCT_SURFACE_TYPES = [
	"command",
	"document",
	"policy",
	"workflow",
] as const;
export const TRUSTED_REVIEWER_TYPES = ["user", "team", "service"] as const;
export const TRUSTED_REVIEWER_STATUSES = ["active", "revoked"] as const;

// ─── JSON Schema factory ──────────────────────────────────────────────────────

/**
 * Return the full JSON Schema for harness.contract.json.
 * The result is a plain object — serialize it to JSON for output.
 */
export function buildContractJsonSchema(): Record<string, unknown> {
	const loopStageContractSchema = {
		type: "object",
		required: [
			"inputs",
			"outputs",
			"schema",
			"failPolicy",
			"if",
			"permissions",
			"timeoutMinutes",
			"concurrency",
		],
		additionalProperties: false,
		properties: {
			inputs: {
				type: "array",
				minItems: 1,
				items: { type: "string", minLength: 1 },
			},
			outputs: {
				type: "array",
				minItems: 1,
				items: { type: "string", minLength: 1 },
			},
			schema: {
				type: "string",
				minLength: 1,
			},
			failPolicy: {
				type: "string",
				enum: ["fail_closed", "warn_only"],
			},
			if: {
				type: "string",
				minLength: 1,
			},
			permissions: {
				type: "array",
				minItems: 1,
				items: { type: "string", minLength: 1 },
			},
			timeoutMinutes: {
				type: "integer",
				minimum: 1,
			},
			concurrency: {
				type: "string",
				minLength: 1,
			},
		},
	} as const;

	return {
		$schema: "http://json-schema.org/draft-07/schema#",
		$id: SCHEMA_ID,
		title: "Harness Contract",
		description:
			"The harness.contract.json file declares governance policy for a coding-harness managed project.",
		type: "object",
		required: ["version"],
		anyOf: [
			{
				properties: {
					version: {
						type: "string",
						pattern: "^(?:(?:0\\.[0-9]+)|(?:1\\.(?:[0-5])))(?:\\.[0-9]+)?$",
					},
				},
				required: ["version"],
			},
			{
				allOf: [
					{
						required: ["version"],
					},
					{
						properties: {
							version: {
								type: "string",
								pattern:
									"^(?:(?:1\\.(?:[6-9]|[1-9][0-9]))|(?:[2-9][0-9]*\\.[0-9]+))(?:\\.[0-9]+)?$",
							},
						},
					},
					{
						required: [
							"northStar",
							"productSurface",
							"overrideReviewerRegistry",
						],
					},
				],
			},
		],
		additionalProperties: false,
		properties: {
			$schema: {
				type: "string",
				description: "JSON Schema reference URL for editor autocomplete.",
			},
			extends: {
				description:
					"Optional contract preset references. Supports string shorthand, structured sources, or arrays of either form.",
				oneOf: [
					{ type: "string", minLength: 1 },
					{
						type: "object",
						required: ["source"],
						additionalProperties: false,
						properties: {
							source: { type: "string", minLength: 1 },
							arrays: {
								type: "string",
								enum: ["replace", "append", "prepend"],
							},
							integrity: {
								type: "string",
								pattern: "^sha256-.+",
							},
						},
					},
					{
						type: "array",
						minItems: 1,
						items: {
							oneOf: [
								{ type: "string", minLength: 1 },
								{
									type: "object",
									required: ["source"],
									additionalProperties: false,
									properties: {
										source: { type: "string", minLength: 1 },
										arrays: {
											type: "string",
											enum: ["replace", "append", "prepend"],
										},
										integrity: {
											type: "string",
											pattern: "^sha256-.+",
										},
									},
								},
							],
						},
					},
				],
			},
			version: {
				type: "string",
				description:
					'Contract schema version. Example: "1.6.0". Increment on breaking changes.',
				examples: ["1.0", "1.6.0"],
			},
			northStar: {
				type: "object",
				description:
					"Canonical north-star contract that defines throughput mission, metric, bottleneck, autonomy boundary, and decision rubric.",
				required: [
					"mission",
					"primaryMetric",
					"primaryBottleneck",
					"autonomyBoundary",
					"safetyFloor",
					"nonGoals",
					"decisionQuestions",
				],
				additionalProperties: false,
				properties: {
					mission: {
						type: "string",
						minLength: 1,
						description: "Canonical mission statement.",
					},
					mantra: {
						type: "array",
						minItems: 1,
						items: { type: "string", minLength: 1 },
						description:
							"Canonical compact mantra used by north-star orientation surfaces.",
					},
					personalStandards: {
						type: "array",
						minItems: 1,
						items: { type: "string", minLength: 1 },
						description:
							"Personal values and standards that constrain planning, implementation, review, and closeout.",
					},
					primaryMetric: {
						type: "string",
						enum: [NORTH_STAR_PRIMARY_METRIC],
						description: "Canonical primary outcome metric.",
					},
					primaryBottleneck: {
						type: "string",
						enum: [NORTH_STAR_PRIMARY_BOTTLENECK],
						description: "Canonical bottleneck this system optimizes.",
					},
					autonomyBoundary: {
						type: "string",
						minLength: 1,
						description: "Boundary statement for autonomous execution scope.",
					},
					safetyFloor: {
						type: "array",
						minItems: 1,
						items: { type: "string", minLength: 1 },
						description: "Non-negotiable safety controls.",
					},
					nonGoals: {
						type: "array",
						minItems: 1,
						items: { type: "string", minLength: 1 },
						description: "Explicitly out-of-scope optimization targets.",
					},
					decisionQuestions: {
						type: "array",
						minItems: NORTH_STAR_DECISION_QUESTION_SPECS.length,
						maxItems: NORTH_STAR_DECISION_QUESTION_SPECS.length,
						description:
							"Canonical ordered decision-question set used by alignment gates.",
						items: NORTH_STAR_DECISION_QUESTION_SPECS.map((question) => ({
							type: "object",
							required: ["id", "prompt"],
							additionalProperties: false,
							properties: {
								id: {
									type: "string",
									enum: [question.id],
								},
								prompt: {
									type: "string",
									enum: [question.prompt],
								},
							},
						})),
						additionalItems: false,
					},
				},
			},
			productSurface: {
				type: "object",
				description:
					"Governed inventory of product surfaces and their north-star contribution claims.",
				required: ["surfaces"],
				additionalProperties: false,
				properties: {
					surfaces: {
						type: "array",
						items: {
							type: "object",
							required: [
								"surfaceId",
								"surfaceType",
								"class",
								"owner",
								"northStarContribution",
								"manualGlueReductionClaim",
								"reliabilityContribution",
								"evidenceReference",
								"ownedPaths",
								"lastReviewedAt",
							],
							additionalProperties: false,
							properties: {
								surfaceId: { type: "string", minLength: 1 },
								surfaceType: {
									type: "string",
									enum: [...PRODUCT_SURFACE_TYPES],
								},
								class: {
									type: "string",
									enum: [...PRODUCT_SURFACE_CLASSES],
								},
								owner: { type: "string", minLength: 1 },
								northStarContribution: { type: "string", minLength: 1 },
								manualGlueReductionClaim: { type: "string", minLength: 1 },
								reliabilityContribution: { type: "string", minLength: 1 },
								evidenceReference: { type: "string", minLength: 1 },
								// Restrict cadence to known governance intervals.
								reviewCadence: {
									type: "string",
									enum: ["weekly", "per_release"],
								},
								ownedPaths: {
									type: "array",
									minItems: 1,
									items: { type: "string", minLength: 1 },
								},
								lastReviewedAt: { type: "string", minLength: 1 },
							},
							anyOf: [
								{
									properties: {
										class: {
											type: "string",
											enum: ["core"],
										},
									},
									required: ["class"],
								},
								{
									required: ["reviewCadence"],
								},
							],
						},
					},
				},
			},
			overrideReviewerRegistry: {
				type: "object",
				description:
					"Trusted reviewer registry used for override acknowledgement signature checks.",
				required: ["trustedReviewers"],
				additionalProperties: false,
				properties: {
					trustedReviewers: {
						type: "array",
						minItems: 1,
						contains: {
							type: "object",
							required: ["status"],
							properties: {
								status: { type: "string", enum: ["active"] },
							},
						},
						items: {
							type: "object",
							required: [
								"reviewerId",
								"reviewerType",
								"signatureRef",
								"displayName",
								"status",
							],
							additionalProperties: false,
							properties: {
								reviewerId: { type: "string", minLength: 1 },
								reviewerType: {
									type: "string",
									enum: [...TRUSTED_REVIEWER_TYPES],
								},
								signatureRef: { type: "string", minLength: 1 },
								displayName: { type: "string", minLength: 1 },
								status: {
									type: "string",
									enum: [...TRUSTED_REVIEWER_STATUSES],
								},
							},
						},
					},
				},
			},

			// ── CI Provider Policy ─────────────────────────────────────────────
			ciProviderPolicy: {
				type: "object",
				description:
					"Controls which CI provider is active, migration stage, and enforcement mode.",
				required: [
					"activeProvider",
					"mode",
					"migrationStage",
					"transitionStatusArtifactPath",
					"authorityConfigPath",
					"requiredCheckManifestPath",
				],
				additionalProperties: false,
				properties: {
					activeProvider: {
						type: "string",
						enum: [...CI_PROVIDERS],
						description:
							'The CI provider currently routing work. "github-actions" or "circleci".',
					},
					mode: {
						type: "string",
						enum: [...CI_PROVIDER_MODES],
						description:
							'"shadow": CI runs but results don\'t gate PRs. "primary": CI results gate PRs. "required": CI is mandatory for all merge paths.',
					},
					migrationStage: {
						type: "string",
						enum: [...CI_MIGRATION_STAGES],
						description:
							"Describes how far along the CI migration is. Must be consistent with mode.",
					},
					commitMode: {
						type: "string",
						enum: [...COMMIT_MODES],
						description:
							'"solo": minimal ceremony for single-developer projects. "team": branch-protection and PR gates. "enterprise": full proof-pack + merge-queue.',
					},
					transitionStatusArtifactPath: {
						type: "string",
						minLength: 1,
						description:
							"Path to the JSON artifact that records per-run migration status.",
					},
					authorityConfigPath: {
						type: "string",
						minLength: 1,
						description:
							"Path to the file that acts as the authoritative contract (usually harness.contract.json).",
					},
					requiredCheckManifestPath: {
						type: "string",
						minLength: 1,
						description:
							"Path to ci-required-checks.json that declares which GitHub checks must pass.",
					},
					primaryCheckName: {
						type: "string",
						minLength: 1,
						description:
							"Optional canonical primary check name used by CI migration validation.",
					},
					trustedPolicyRef: {
						type: "string",
						description:
							'Git ref (e.g., "refs/heads/main") used as the trusted policy source for enterprise mode.',
					},
				},
			},

			// ── Branch Protection ──────────────────────────────────────────────
			branchProtection: {
				type: "object",
				description:
					"Declares GitHub branch protection rules that harness manages.",
				additionalProperties: false,
				properties: {
					requiredChecks: {
						type: "array",
						items: { type: "string" },
						description: "List of required check names for the default branch.",
					},
					restrictDeletions: { type: "boolean" },
					blockForcePushes: { type: "boolean" },
					requireLinearHistory: { type: "boolean" },
					requirePullRequest: { type: "boolean" },
					requiredApprovingReviewCount: {
						type: "integer",
						minimum: 0,
					},
					dismissStaleReviewsOnPush: { type: "boolean" },
					requireConversationResolution: { type: "boolean" },
					requireCodeOwnerReview: { type: "boolean" },
					requireLastPushApproval: { type: "boolean" },
					requireBranchesUpToDate: { type: "boolean" },
					allowedMergeMethods: {
						type: "object",
						properties: {
							mergeCommit: { type: "boolean" },
							squash: { type: "boolean" },
							rebase: { type: "boolean" },
						},
					},
					codeQuality: {
						type: "object",
						properties: {
							required: { type: "boolean" },
							severity: {
								type: "string",
								enum: [
									"errors",
									"warnings_and_higher",
									"notes_and_higher",
									"all",
								],
							},
						},
					},
					publicCodeScanning: {
						type: "object",
						properties: {
							required: { type: "boolean" },
							publicOnly: { type: "boolean" },
							tool: { type: "string" },
							alertsThreshold: {
								type: "string",
								enum: ["errors", "errors_and_warnings", "all"],
							},
							securityAlertsThreshold: {
								type: "string",
								enum: ["high_or_higher", "medium_or_higher", "all"],
							},
						},
					},
				},
			},

			// ── Risk Tier Rules ────────────────────────────────────────────────
			riskTierRules: {
				type: "object",
				description:
					'Maps glob patterns to risk tiers. Example: {"src/auth/**": "high"}.',
				additionalProperties: {
					type: "string",
					enum: [...RISK_TIERS],
				},
			},

			// ── Policy Chain ───────────────────────────────────────────────────
			policyChain: {
				type: "object",
				description:
					"Explicit mapping from RiskTier -> PolicyAction -> GateVerdict.",
				required: ["tierToAction", "actionToVerdict"],
				additionalProperties: false,
				properties: {
					tierToAction: {
						type: "object",
						description: "Maps each risk tier to a policy action.",
						required: ["high", "medium", "low"],
						additionalProperties: false,
						properties: {
							high: { type: "string", enum: [...POLICY_ACTIONS] },
							medium: { type: "string", enum: [...POLICY_ACTIONS] },
							low: { type: "string", enum: [...POLICY_ACTIONS] },
						},
					},
					actionToVerdict: {
						type: "object",
						description: "Maps policy actions to gate verdicts.",
						required: ["allow", "block", "warn"],
						additionalProperties: false,
						properties: {
							allow: { type: "string", enum: [...GATE_VERDICTS] },
							block: { type: "string", const: "fail" },
							warn: { type: "string", enum: [...GATE_VERDICTS] },
						},
					},
				},
			},

			// ── Merge Policy ───────────────────────────────────────────────────
			mergePolicy: {
				type: "object",
				description:
					"Maps risk tier to required gate names that must pass before merge.",
				properties: {
					high: { type: "array", items: { type: "string" } },
					medium: { type: "array", items: { type: "string" } },
					low: { type: "array", items: { type: "string" } },
				},
			},

			// ── Gate Extensions ────────────────────────────────────────────────
			gateExtensions: {
				type: "object",
				description:
					"Optional pre/post gate hook configuration for supported gates.",
				additionalProperties: false,
				properties: {
					preflightGate: {
						type: "object",
						additionalProperties: false,
						properties: {
							pre: {
								type: "array",
								description:
									"Preflight pre-hooks that can short-circuit or override execution.",
								items: {
									type: "object",
									additionalProperties: false,
									required: ["id"],
									properties: {
										id: {
											type: "string",
											enum: [...PREFLIGHT_PRE_HOOK_IDS],
										},
										enabled: { type: "boolean" },
									},
								},
							},
							post: {
								type: "array",
								description:
									"Preflight post-hooks that can adjust or block final results.",
								items: {
									type: "object",
									additionalProperties: false,
									required: ["id"],
									properties: {
										id: {
											type: "string",
											enum: [...PREFLIGHT_POST_HOOK_IDS],
										},
										enabled: { type: "boolean" },
									},
								},
							},
						},
					},
				},
			},

			// ── Review Policy ──────────────────────────────────────────────────
			reviewPolicy: {
				type: "object",
				description: "Controls PR review gate behaviour and timeouts.",
				required: ["timeoutSeconds", "timeoutAction"],
				additionalProperties: false,
				properties: {
					timeoutSeconds: {
						type: "integer",
						minimum: 1,
						description:
							"Seconds before a pending review is considered timed out.",
					},
					timeoutAction: {
						type: "string",
						enum: ["fail", "warn"],
						description:
							'"fail" aborts the gate; "warn" emits a warning but allows merge.',
					},
					requiredChecks: {
						type: "array",
						items: { type: "string" },
						description:
							"Checks that must pass inside the review gate. Must be a subset of branchProtection.requiredChecks.",
					},
					approvalMode: {
						type: "string",
						enum: ["human_approval", "automated_review"],
						description:
							"Require a current-SHA human approval, or use the configured independent automated review check for solo-maintainer repositories.",
					},
					automatedReviewers: {
						type: "array",
						minItems: 1,
						uniqueItems: true,
						items: { type: "string", minLength: 1 },
						description:
							"Reviewer logins that must submit COMMENTED or APPROVED review evidence for the current SHA in automated_review mode.",
					},
					enforceReviewerIndependence: {
						type: "boolean",
						description: "Reject self-reviews.",
					},
				},
			},

			// ── Memory Policy ──────────────────────────────────────────────────
			memoryPolicy: {
				type: "object",
				description:
					"Controls how coding agents record and retrieve session memory.",
				additionalProperties: false,
				properties: {
					enabled: { type: "boolean" },
					provider: { type: "string" },
					sessionIdTemplate: { type: "string" },
					domain: { type: "string" },
					requiredTags: { type: "array", items: { type: "string" } },
					maxObservationsPerStep: { type: "integer", minimum: 1 },
					allowedLevels: { type: "array", items: { type: "string" } },
					requireStartRead: { type: "boolean" },
					requireCloseoutSummary: { type: "boolean" },
					forbiddenContentPatterns: {
						type: "array",
						items: { type: "string" },
					},
					sessionLogPath: {
						type: "string",
						minLength: 1,
						description:
							"Optional explicit path for session log persistence when default branch-derived path is unsuitable.",
					},
				},
			},

			// ── Context Integrity Policy ───────────────────────────────────────
			contextCompact: {
				type: "object",
				description:
					"Threshold-driven context compaction policy for context retrieval commands.",
				required: [
					"thresholdPercent",
					"microCompactThresholdTokens",
					"strategy",
				],
				additionalProperties: false,
				properties: {
					thresholdPercent: {
						type: "number",
						exclusiveMinimum: 0,
						maximum: 100,
						description:
							"Percent threshold used to derive retrieval compaction defaults.",
					},
					microCompactThresholdTokens: {
						type: "integer",
						minimum: 1,
						description:
							"Token threshold where micro strategy becomes eligible for context retrieval.",
					},
					strategy: {
						type: "string",
						enum: [...CONTEXT_COMPACT_STRATEGIES],
						description:
							'Compaction profile. "balanced" for default behavior, "aggressive" for stronger compaction, "micro" for tighter retrieval.',
					},
				},
			},

			// ── Context Integrity Policy ───────────────────────────────────────
			contextIntegrityPolicy: {
				type: "object",
				description:
					"Checks for contradictions between canonical governance documents.",
				required: [
					"mode",
					"truthSources",
					"contradictionCatalog",
					"healthSampling",
				],
				additionalProperties: false,
				properties: {
					mode: {
						type: "string",
						enum: [...CONTEXT_INTEGRITY_MODES],
						description:
							'"shadow" logs findings; "advisory" warns; "required" fails gates.',
					},
					truthSources: {
						type: "array",
						items: {
							type: "object",
							required: ["path", "kind", "authority", "required"],
							properties: {
								path: { type: "string" },
								kind: { type: "string", enum: ["file", "directory"] },
								authority: {
									type: "string",
									enum: ["canonical", "governed"],
								},
								required: { type: "boolean" },
							},
						},
					},
					contradictionCatalog: {
						type: "array",
						items: {
							type: "object",
							required: ["id", "category", "severity", "description"],
							properties: {
								id: { type: "string" },
								category: { type: "string" },
								severity: { type: "string", enum: ["warning", "error"] },
								description: { type: "string" },
							},
						},
					},
					healthSampling: {
						type: "object",
						required: [
							"fixtureSetPath",
							"fixtureSetId",
							"allowedTriggerTypes",
							"samplingCadence",
							"dedupeScope",
						],
						properties: {
							fixtureSetPath: { type: "string" },
							fixtureSetId: { type: "string" },
							allowedTriggerTypes: {
								type: "array",
								items: {
									type: "string",
									enum: ["current_checkout", "recent_artifacts"],
								},
							},
							samplingCadence: {
								type: "string",
								enum: ["per_run", "daily", "weekly"],
							},
							dedupeScope: {
								type: "string",
								enum: ["query", "run"],
							},
						},
					},
				},
			},

			// ── Issue Tracking Policy ──────────────────────────────────────────
			issueTrackingPolicy: {
				type: "object",
				description: "Configures Linear as the issue tracker.",
				required: ["provider"],
				additionalProperties: false,
				properties: {
					provider: { type: "string", enum: ["linear"] },
					projectUrl: { type: "string", format: "uri" },
					requirePackageBugsUrl: { type: "boolean" },
					disableGitHubIssues: { type: "boolean" },
					requireBranchIssueKey: { type: "boolean" },
					requirePrIssueKey: { type: "boolean" },
					prReferenceMode: {
						type: "string",
						enum: ["refs", "fixes", "either"],
					},
					branchPrefix: { type: "string" },
				},
			},

			// ── Docs Drift Rules ───────────────────────────────────────────────
			docsDriftRules: {
				type: "object",
				description: "Maps glob patterns to required doc review tags.",
				additionalProperties: {
					type: "array",
					items: { type: "string" },
				},
			},

			// ── Diff Budget ────────────────────────────────────────────────────
			diffBudget: {
				type: "object",
				description:
					"Enforces PR size limits to prevent excessively large changesets.",
				required: ["maxFiles", "maxNetLOC"],
				additionalProperties: false,
				properties: {
					maxFiles: { type: "integer", minimum: 1 },
					maxNetLOC: { type: "integer", minimum: 1 },
					overrideLabel: { type: "string" },
				},
			},

			// ── Evidence Policy ────────────────────────────────────────────────
			evidencePolicy: {
				type: "object",
				description: "Controls required UI evidence for high-risk changes.",
				required: ["requiredFor", "allowedTypes"],
				additionalProperties: false,
				properties: {
					requiredFor: { type: "array", items: { type: "string" } },
					allowedTypes: {
						type: "array",
						items: { type: "string", enum: ["png", "jpeg"] },
					},
					maxFileSizeBytes: { type: "integer", minimum: 1 },
				},
			},

			// ── Tooling Policy ─────────────────────────────────────────────────
			toolingPolicy: {
				type: "object",
				description:
					"Declares required binaries, tools, Codex environment actions, and Makefile targets.",
				additionalProperties: true, // Complex; allow additional properties
			},

			// ── Remaining policies (permissive — validator.ts holds the truth) ─
			uiLoopPolicy: {
				type: "object",
				additionalProperties: true,
				description:
					"Defines fast/verify/explore loop timing targets for UI development.",
			},
			runtimePolicy: {
				type: "object",
				additionalProperties: true,
				description: "Declares Node.js version requirements.",
			},
			memoryMaintenancePolicy: {
				type: "object",
				additionalProperties: true,
				description: "Controls scheduled memory validation and reflection.",
			},
			memoryEvalPolicy: {
				type: "object",
				additionalProperties: true,
				description: "Controls memory evaluation trials and thresholds.",
			},
			observabilityPolicy: {
				type: "object",
				additionalProperties: true,
				description: "Configures telemetry provider and collector endpoint.",
			},
			packageManagerPolicy: {
				type: "object",
				additionalProperties: true,
				description: "Restricts which package managers are allowed.",
			},
			remediationPolicy: {
				type: "object",
				additionalProperties: true,
				description: "Controls how gate findings are auto-remediated.",
			},
			loopStageContracts: {
				type: "object",
				required: [
					"risk-policy-gate",
					"review-gate",
					"evidence-verify",
					"remediation-decision",
				],
				additionalProperties: false,
				properties: {
					"risk-policy-gate": loopStageContractSchema,
					"review-gate": loopStageContractSchema,
					"evidence-verify": loopStageContractSchema,
					"remediation-decision": loopStageContractSchema,
				},
				description:
					"Semantic contracts for each gate loop stage (inputs, outputs, permissions).",
			},
			pilotGapCasePolicy: {
				type: "object",
				additionalProperties: true,
				description: "Controls pilot gap-case SLA and evidence requirements.",
			},
			pilotRollbackPolicy: {
				type: "object",
				additionalProperties: true,
				description: "Controls when pilot mode auto-triggers rollback.",
			},
			pilotAuthzPolicy: {
				type: "object",
				additionalProperties: true,
				description:
					"Controls which repos/branches are authorized for pilot mode.",
			},
			controlPlanePolicy: {
				type: "object",
				additionalProperties: true,
				description:
					"Controls emergency override authorization and dual-approval scopes.",
			},
			blastRadiusRules: {
				type: "array",
				items: { type: "object" },
				description:
					"Maps path patterns to additional required checks for high-blast-radius changes.",
			},
			blastRadiusRulesMode: {
				type: "string",
				enum: ["merge", "replace"],
				description:
					'"merge": combine with default rules. "replace": override all defaults.',
			},
		},
	};
}
