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

// ─── Schema version ───────────────────────────────────────────────────────────

export const SCHEMA_VERSION = "1.5.0" as const;
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

/** Valid risk tiers */
export const RISK_TIERS = ["high", "medium", "low"] as const;

// ─── JSON Schema factory ──────────────────────────────────────────────────────

/**
 * Return the full JSON Schema for harness.contract.json.
 * The result is a plain object — serialize it to JSON for output.
 */
export function buildContractJsonSchema(): Record<string, unknown> {
	return {
		$schema: "http://json-schema.org/draft-07/schema#",
		$id: SCHEMA_ID,
		title: "Harness Contract",
		description:
			"The harness.contract.json file declares governance policy for a coding-harness managed project.",
		type: "object",
		required: ["version"],
		additionalProperties: false,
		properties: {
			$schema: {
				type: "string",
				description: "JSON Schema reference URL for editor autocomplete.",
			},
			version: {
				type: "string",
				description:
					'Contract schema version. Example: "1.5.0". Increment on breaking changes.',
				examples: ["1.0", "1.5.0"],
			},

			// ── CI Provider Policy ─────────────────────────────────────────────
			ciProviderPolicy: {
				type: "object",
				description:
					"Controls which CI provider is active, migration stage, and enforcement mode.",
				required: ["activeProvider", "mode", "migrationStage"],
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
						description:
							"Path to the JSON artifact that records per-run migration status.",
					},
					authorityConfigPath: {
						type: "string",
						description:
							"Path to the file that acts as the authoritative contract (usually harness.contract.json).",
					},
					requiredCheckManifestPath: {
						type: "string",
						description:
							"Path to ci-required-checks.json that declares which GitHub checks must pass.",
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
											enum: ["skip-all-checks", "force-fail"],
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
											enum: ["fail-on-warnings"],
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
				additionalProperties: true,
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
