import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { deriveRequiredCheckMetadata } from "../lib/ci/required-check-metadata.js";
import { loadContract } from "../lib/contract/loader.js";
import {
	type BranchProtectionCodeQualityPolicy,
	type BranchProtectionCodeScanningPolicy,
	type BranchProtectionMergeMethods,
	type BranchProtectionPolicy,
	DEFAULT_BRANCH_PROTECTION_POLICY,
} from "../lib/contract/types.js";
import {
	GitHubClient,
	type Ruleset,
	type RulesetPayload,
	type RulesetRule,
	type RulesetSummary,
} from "../lib/github/client.js";
import type { CIProvider } from "../lib/init/types.js";
import { sanitizeError } from "../lib/input/sanitize.js";
import {
	BRANCH_PROTECTION_REQUIRED_CHECKS,
	getEcosystemChecks,
	listEcosystemProfiles,
	normalizeRequiredChecksManifest,
} from "../lib/policy/required-checks.js";

const DEFAULT_RULESET_NAME = "protect";
const DEFAULT_BRANCH = "main";
const DEFAULT_CONTRACT_PATH = "harness.contract.json";
const DEFAULT_REQUIRED_CHECKS = [...BRANCH_PROTECTION_REQUIRED_CHECKS];
const DEFAULT_MERGE_METHODS: BranchProtectionMergeMethods = {
	mergeCommit: true,
	squash: true,
	rebase: true,
};

export const EXIT_CODES = {
	SUCCESS: 0,
	VALIDATION_ERROR: 1,
	NOT_FOUND: 2,
	PERMISSION_DENIED: 3,
	SYSTEM_ERROR: 10,
} as const;

/**
 * CLI options for configuring GitHub branch protection rulesets.
 */
export interface BranchProtectOptions {
	token?: string;
	owner?: string;
	repo?: string;
	branch?: string;
	rulesetName?: string;
	contractPath?: string;
	requiredChecks?: string[];
	ecosystem?: string;
	requiredApprovingReviewCount?: number;
	dryRun?: boolean;
	json?: boolean;
}

/**
 * Structured output returned after applying or simulating branch protection.
 */
export interface BranchProtectOutput {
	action: "created" | "updated" | "dry_run";
	repository: string;
	branch: string;
	rulesetId?: number | undefined;
	rulesetName: string;
	requiredChecks: string[];
	ecosystem?: string | undefined;
	repositoryVisibility?: string | undefined;
	managedPolicy: {
		requiredApprovingReviewCount: number;
		restrictDeletions: boolean;
		blockForcePushes: boolean;
		requireLinearHistory: boolean;
		requirePullRequest: boolean;
		dismissStaleReviewsOnPush: boolean;
		requireConversationResolution: boolean;
		requireCodeOwnerReview: boolean;
		requireLastPushApproval: boolean;
		requireBranchesUpToDate: boolean;
		allowedMergeMethods: BranchProtectionMergeMethods;
		codeQuality?: BranchProtectionCodeQualityPolicy | undefined;
		publicCodeScanning?: BranchProtectionCodeScanningPolicy | undefined;
	};
}

/**
 * Result envelope for branch protection operations.
 */
export type BranchProtectResult =
	| { ok: true; output: BranchProtectOutput }
	| { ok: false; error: { code: string; message: string } };

function normalizeToken(value: string | undefined): string | undefined {
	if (typeof value !== "string") {
		return undefined;
	}
	const trimmed = value.trim();
	if (
		trimmed.length === 0 ||
		trimmed.toLowerCase() === "undefined" ||
		trimmed.toLowerCase() === "null"
	) {
		return undefined;
	}
	return trimmed;
}

/**
 * Resolves required checks from ecosystem profile, explicit checks, or contract.
 * Priority: explicit --required-checks > --ecosystem > contract > defaults
 */
type RequiredChecksResolutionSource =
	| "explicit"
	| "ecosystem"
	| "contract"
	| "default";

function resolveRequiredChecks(
	options: BranchProtectOptions,
	contractPolicy: BranchProtectionPolicy,
): {
	checks: string[];
	source: RequiredChecksResolutionSource;
	ecosystem?: string;
} {
	// 1. Explicit checks take highest priority
	if (options.requiredChecks && options.requiredChecks.length > 0) {
		return {
			checks: normalizeChecks(options.requiredChecks),
			source: "explicit",
		};
	}

	// 2. Ecosystem profile
	if (options.ecosystem) {
		const ecosystemChecks = getEcosystemChecks(options.ecosystem);
		if (ecosystemChecks) {
			return {
				checks: normalizeChecks([...ecosystemChecks]),
				source: "ecosystem",
				ecosystem: options.ecosystem,
			};
		}
	}

	// 3. Contract
	const contractChecks = contractPolicy.requiredChecks;
	if (contractChecks && contractChecks.length > 0) {
		return { checks: normalizeChecks(contractChecks), source: "contract" };
	}

	// 4. Defaults
	return {
		checks: normalizeChecks([...DEFAULT_REQUIRED_CHECKS]),
		source: "default",
	};
}

interface ResolvedBranchProtectionPolicy {
	requiredApprovals: number;
	restrictDeletions: boolean;
	blockForcePushes: boolean;
	requireLinearHistory: boolean;
	requirePullRequest: boolean;
	dismissStaleReviewsOnPush: boolean;
	requireConversationResolution: boolean;
	requireCodeOwnerReview: boolean;
	requireLastPushApproval: boolean;
	requireBranchesUpToDate: boolean;
	allowedMergeMethods: BranchProtectionMergeMethods;
	codeQuality: BranchProtectionCodeQualityPolicy | undefined;
	publicCodeScanning: BranchProtectionCodeScanningPolicy | undefined;
}

interface ContractBranchProtectionResolution {
	branchProtectionPolicy: BranchProtectionPolicy;
	activeProvider?: CIProvider;
	requiredCheckManifestPath?: string;
}

function resolveContractBranchProtectionPolicy(
	contractPath: string,
): ContractBranchProtectionResolution {
	try {
		const contract = loadContract(contractPath);
		const ciProviderPolicy = contract.ciProviderPolicy;
		const activeProvider = ciProviderPolicy?.activeProvider;
		const requiredCheckManifestPath =
			ciProviderPolicy?.requiredCheckManifestPath;
		const legacyRequiredChecks =
			contract.branchProtection?.requiredChecks &&
			contract.branchProtection.requiredChecks.length > 0
				? contract.branchProtection.requiredChecks
				: contract.reviewPolicy?.requiredChecks;
		return {
			branchProtectionPolicy: {
				...DEFAULT_BRANCH_PROTECTION_POLICY,
				...(contract.branchProtection ?? {}),
				requiredChecks:
					legacyRequiredChecks ??
					DEFAULT_BRANCH_PROTECTION_POLICY.requiredChecks,
				allowedMergeMethods: {
					...DEFAULT_MERGE_METHODS,
					...(contract.branchProtection?.allowedMergeMethods ?? {}),
				},
				codeQuality: contract.branchProtection?.codeQuality
					? {
							...(DEFAULT_BRANCH_PROTECTION_POLICY.codeQuality ?? {}),
							...contract.branchProtection.codeQuality,
						}
					: DEFAULT_BRANCH_PROTECTION_POLICY.codeQuality,
				publicCodeScanning: contract.branchProtection?.publicCodeScanning
					? {
							...(DEFAULT_BRANCH_PROTECTION_POLICY.publicCodeScanning ?? {}),
							...contract.branchProtection.publicCodeScanning,
						}
					: DEFAULT_BRANCH_PROTECTION_POLICY.publicCodeScanning,
			},
			...(activeProvider ? { activeProvider } : {}),
			...(requiredCheckManifestPath ? { requiredCheckManifestPath } : {}),
		};
	} catch (error) {
		// Contract not found or invalid - fall back to defaults.
		// This is intentional to allow running without a contract file.
		if (process.env.DEBUG) {
			console.warn(
				`[branch-protect] Contract loading failed, using defaults: ${error}`,
			);
		}
		return {
			branchProtectionPolicy: { ...DEFAULT_BRANCH_PROTECTION_POLICY },
		};
	}
}

/**
 * Maps requested required-check identifiers to GitHub check context names using a manifest file and returns the normalized contexts.
 *
 * @param input.requiredChecks - List of required-check identifiers (e.g., gate IDs or display names) to resolve
 * @param input.contractPath - File path of the contract used to resolve the manifest file's directory
 * @param input.requiredCheckManifestPath - Path to the required-check manifest file (resolved relative to `contractPath`)
 * @param input.activeProvider - Optional CI provider to select which manifest gates to remap against; when omitted, the manifest's `activeProvider` is used
 * @returns An array of normalized GitHub check names corresponding to the requested checks, or `null` if the manifest cannot be read, parsed, or validated
 */
function resolveManifestBackedRequiredCheckContexts(input: {
	requiredChecks: string[];
	contractPath: string;
	requiredCheckManifestPath: string;
	activeProvider?: CIProvider;
}): string[] | null {
	const manifestPath = resolve(
		dirname(input.contractPath),
		input.requiredCheckManifestPath,
	);

	let parsedManifest: unknown;
	try {
		parsedManifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
	} catch {
		return null;
	}

	const normalized = normalizeRequiredChecksManifest(parsedManifest);
	if (!normalized.ok) {
		return null;
	}

	const providerForRemap =
		input.activeProvider ?? normalized.value.activeProvider;
	const gateByName = new Map(
		normalized.value.gates
			.filter((gate) => gate.provider === providerForRemap)
			.flatMap((gate) => [
				[gate.gateId, gate],
				[gate.displayName, gate],
			]),
	);

	const remappedChecks = input.requiredChecks.map((check) => {
		const matchedGate = gateByName.get(check);
		return matchedGate?.githubCheckName ?? check;
	});
	return normalizeChecks(remappedChecks);
}

/**
 * Resolve required check identifiers into normalized GitHub check context names, using the active CI provider when available.
 *
 * @param requiredChecks - Identifiers for required checks (provider-specific IDs or generic names)
 * @param activeProvider - Optional CI provider used to map identifiers to provider-specific GitHub check names
 * @returns A normalized list of GitHub check context names; when `activeProvider` is provided each identifier is mapped to its provider-specific `githubCheckName`, otherwise the input identifiers are normalized unchanged
 */
function resolveProviderBackedRequiredCheckContexts(input: {
	requiredChecks: string[];
	activeProvider?: CIProvider;
}): string[] {
	const { activeProvider } = input;
	if (!activeProvider) {
		return normalizeChecks(input.requiredChecks);
	}
	return normalizeChecks(
		input.requiredChecks.map(
			(check) =>
				deriveRequiredCheckMetadata(activeProvider, check).githubCheckName,
		),
	);
}

function resolveManagedPolicy(
	options: BranchProtectOptions,
	contractPolicy: BranchProtectionPolicy,
): ResolvedBranchProtectionPolicy {
	return {
		requiredApprovals:
			options.requiredApprovingReviewCount ??
			contractPolicy.requiredApprovingReviewCount ??
			DEFAULT_BRANCH_PROTECTION_POLICY.requiredApprovingReviewCount ??
			0,
		restrictDeletions:
			contractPolicy.restrictDeletions ??
			DEFAULT_BRANCH_PROTECTION_POLICY.restrictDeletions ??
			true,
		blockForcePushes:
			contractPolicy.blockForcePushes ??
			DEFAULT_BRANCH_PROTECTION_POLICY.blockForcePushes ??
			true,
		requireLinearHistory:
			contractPolicy.requireLinearHistory ??
			DEFAULT_BRANCH_PROTECTION_POLICY.requireLinearHistory ??
			true,
		requirePullRequest:
			contractPolicy.requirePullRequest ??
			DEFAULT_BRANCH_PROTECTION_POLICY.requirePullRequest ??
			true,
		dismissStaleReviewsOnPush:
			contractPolicy.dismissStaleReviewsOnPush ??
			DEFAULT_BRANCH_PROTECTION_POLICY.dismissStaleReviewsOnPush ??
			true,
		requireConversationResolution:
			contractPolicy.requireConversationResolution ??
			DEFAULT_BRANCH_PROTECTION_POLICY.requireConversationResolution ??
			true,
		requireCodeOwnerReview:
			contractPolicy.requireCodeOwnerReview ??
			DEFAULT_BRANCH_PROTECTION_POLICY.requireCodeOwnerReview ??
			false,
		requireLastPushApproval:
			contractPolicy.requireLastPushApproval ??
			DEFAULT_BRANCH_PROTECTION_POLICY.requireLastPushApproval ??
			false,
		requireBranchesUpToDate:
			contractPolicy.requireBranchesUpToDate ??
			DEFAULT_BRANCH_PROTECTION_POLICY.requireBranchesUpToDate ??
			true,
		allowedMergeMethods: {
			...DEFAULT_MERGE_METHODS,
			...(contractPolicy.allowedMergeMethods ?? {}),
		},
		codeQuality:
			contractPolicy.codeQuality ??
			DEFAULT_BRANCH_PROTECTION_POLICY.codeQuality,
		publicCodeScanning:
			contractPolicy.publicCodeScanning ??
			DEFAULT_BRANCH_PROTECTION_POLICY.publicCodeScanning,
	};
}

function formatManagedPolicyOutput(
	policy: ResolvedBranchProtectionPolicy,
): BranchProtectOutput["managedPolicy"] {
	return {
		requiredApprovingReviewCount: policy.requiredApprovals,
		restrictDeletions: policy.restrictDeletions,
		blockForcePushes: policy.blockForcePushes,
		requireLinearHistory: policy.requireLinearHistory,
		requirePullRequest: policy.requirePullRequest,
		dismissStaleReviewsOnPush: policy.dismissStaleReviewsOnPush,
		requireConversationResolution: policy.requireConversationResolution,
		requireCodeOwnerReview: policy.requireCodeOwnerReview,
		requireLastPushApproval: policy.requireLastPushApproval,
		requireBranchesUpToDate: policy.requireBranchesUpToDate,
		allowedMergeMethods: { ...policy.allowedMergeMethods },
		...(policy.codeQuality !== undefined
			? { codeQuality: { ...policy.codeQuality } }
			: {}),
		...(policy.publicCodeScanning !== undefined
			? { publicCodeScanning: { ...policy.publicCodeScanning } }
			: {}),
	};
}

/**
 * Applies or simulates branch protection configuration for a repository branch.
 */
export async function runBranchProtect(
	options: BranchProtectOptions,
): Promise<BranchProtectResult> {
	const token =
		normalizeToken(options.token) ??
		normalizeToken(process.env.GITHUB_TOKEN) ??
		normalizeToken(process.env.GITHUB_PERSONAL_ACCESS_TOKEN);
	const owner = options.owner?.trim();
	const repo = options.repo?.trim();
	const branch = options.branch?.trim() || DEFAULT_BRANCH;
	const rulesetName = options.rulesetName?.trim() || DEFAULT_RULESET_NAME;
	const contractPath = options.contractPath?.trim() || DEFAULT_CONTRACT_PATH;

	if (!token) {
		return {
			ok: false,
			error: {
				code: "VALIDATION_ERROR",
				message:
					"Missing GitHub token. Provide --token or set GITHUB_TOKEN/GITHUB_PERSONAL_ACCESS_TOKEN.",
			},
		};
	}
	if (!owner || !repo) {
		return {
			ok: false,
			error: {
				code: "VALIDATION_ERROR",
				message: "Missing required --owner and --repo values.",
			},
		};
	}

	// Validate ecosystem if provided (and not overridden by explicit checks)
	if (options.ecosystem && !options.requiredChecks) {
		const validEcosystems = listEcosystemProfiles();
		if (!validEcosystems.includes(options.ecosystem)) {
			return {
				ok: false,
				error: {
					code: "VALIDATION_ERROR",
					message: `Invalid ecosystem "${options.ecosystem}". Available: ${validEcosystems.join(", ")}`,
				},
			};
		}
	}

	const contractResolution =
		resolveContractBranchProtectionPolicy(contractPath);
	const contractPolicy = contractResolution.branchProtectionPolicy;
	const { checks: requestedChecks, ecosystem } = resolveRequiredChecks(
		options,
		contractPolicy,
	);
	const requiredCheckContexts =
		(contractResolution.requiredCheckManifestPath
			? resolveManifestBackedRequiredCheckContexts({
					requiredChecks: requestedChecks,
					contractPath,
					requiredCheckManifestPath:
						contractResolution.requiredCheckManifestPath,
					...(contractResolution.activeProvider
						? { activeProvider: contractResolution.activeProvider }
						: {}),
				})
			: null) ??
		resolveProviderBackedRequiredCheckContexts({
			requiredChecks: requestedChecks,
			...(contractResolution.activeProvider
				? { activeProvider: contractResolution.activeProvider }
				: {}),
		});

	if (requiredCheckContexts.length === 0) {
		return {
			ok: false,
			error: {
				code: "VALIDATION_ERROR",
				message: "At least one required status check is required.",
			},
		};
	}

	const managedPolicy = resolveManagedPolicy(options, contractPolicy);
	const requiredApprovals = managedPolicy.requiredApprovals;
	if (!Number.isInteger(requiredApprovals) || requiredApprovals < 0) {
		return {
			ok: false,
			error: {
				code: "VALIDATION_ERROR",
				message: "--required-approvals must be a non-negative integer.",
			},
		};
	}

	const client = new GitHubClient({ token, owner, repo });
	const branchRef = `refs/heads/${branch}`;

	try {
		const defaultBranchRef = await resolveDefaultBranchRef(client);
		const rulesets = await client.listRulesets();
		const existingSummary = findMatchingRuleset(
			rulesets,
			branchRef,
			rulesetName,
			defaultBranchRef,
		);
		const existingRuleset =
			existingSummary !== undefined
				? await client.getRuleset(existingSummary.id)
				: undefined;
		const repositoryVisibility = await resolveRepositoryVisibility(client);

		const payload = buildPayload({
			branchRef,
			rulesetName,
			requiredChecks: requiredCheckContexts,
			policy: managedPolicy,
			repositoryVisibility,
			existingRuleset,
		});

		if (options.dryRun) {
			return {
				ok: true,
				output: {
					action: "dry_run",
					repository: `${owner}/${repo}`,
					branch,
					rulesetName,
					requiredChecks: requiredCheckContexts,
					ecosystem,
					repositoryVisibility,
					managedPolicy: formatManagedPolicyOutput(managedPolicy),
					...(existingSummary !== undefined
						? { rulesetId: existingSummary.id }
						: {}),
				},
			};
		}

		const updatedRuleset =
			existingSummary !== undefined
				? await client.updateRuleset(existingSummary.id, payload)
				: await client.createRuleset(payload);
		try {
			await applyRepositoryMergeSettings(client, {
				allowMergeCommit: managedPolicy.allowedMergeMethods.mergeCommit,
				allowSquashMerge: managedPolicy.allowedMergeMethods.squash,
				allowRebaseMerge: managedPolicy.allowedMergeMethods.rebase,
			});
		} catch (error) {
			const safeError = sanitizeError(error);
			return {
				ok: false,
				error: {
					code: "SYSTEM_ERROR",
					message: `Configured branch protection ruleset, but failed to apply repository merge settings: ${safeError}`,
				},
			};
		}

		return {
			ok: true,
			output: {
				action: existingSummary !== undefined ? "updated" : "created",
				repository: `${owner}/${repo}`,
				branch,
				rulesetId: updatedRuleset.id,
				rulesetName,
				requiredChecks: requiredCheckContexts,
				ecosystem,
				repositoryVisibility,
				managedPolicy: formatManagedPolicyOutput(managedPolicy),
			},
		};
	} catch (error) {
		const safeError = sanitizeError(error);
		const errorName =
			error instanceof Error && typeof error.name === "string"
				? error.name
				: "UnknownError";

		if (errorName === "NotFoundError") {
			return {
				ok: false,
				error: {
					code: "NOT_FOUND",
					message: `Repository or ruleset not found: ${safeError}`,
				},
			};
		}
		if (errorName === "ForbiddenError" || errorName === "UnauthorizedError") {
			return {
				ok: false,
				error: {
					code: "PERMISSION_DENIED",
					message: `Permission denied configuring ruleset: ${safeError}`,
				},
			};
		}

		return {
			ok: false,
			error: {
				code: "SYSTEM_ERROR",
				message: `Failed to configure branch protection: ${safeError}`,
			},
		};
	}
}

interface BuildPayloadInput {
	branchRef: string;
	rulesetName: string;
	requiredChecks: string[];
	policy: ResolvedBranchProtectionPolicy;
	repositoryVisibility: string | undefined;
	existingRuleset?: Ruleset | undefined;
}

type RequiredStatusCheckEntry = {
	context: string;
	[key: string]: unknown;
};

/**
 * Constructs a branch ruleset payload by merging the existing ruleset with the resolved policy, required checks, and repository context.
 *
 * @param input - Inputs required to build the payload: an optional existing ruleset, the resolved branch protection policy, normalized required check identifiers, target branch reference, repository visibility, and desired ruleset name.
 * @returns The finalized `RulesetPayload` object containing `name`, `target`, `enforcement`, `bypass_actors`, `conditions.ref_name` (include/exclude), and `rules` where rules have been upserted, removed, or merged to reflect the provided policy and required checks.
 */
function buildPayload(input: BuildPayloadInput): RulesetPayload {
	const baseRules = Array.isArray(input.existingRuleset?.rules)
		? [...input.existingRuleset.rules]
		: [];

	toggleRule(baseRules, "deletion", input.policy.restrictDeletions);
	toggleRule(baseRules, "non_fast_forward", input.policy.blockForcePushes);
	toggleRule(
		baseRules,
		"required_linear_history",
		input.policy.requireLinearHistory,
	);

	if (input.policy.requirePullRequest) {
		const existingPullRequestRule = getRule(baseRules, "pull_request");
		const existingPullParameters = normalizeParameters(
			existingPullRequestRule?.parameters,
		);
		const pullRequestRule: RulesetRule = {
			type: "pull_request",
			parameters: {
				...existingPullParameters,
				dismiss_stale_reviews_on_push: input.policy.dismissStaleReviewsOnPush,
				require_code_owner_review: input.policy.requireCodeOwnerReview,
				require_last_push_approval: input.policy.requireLastPushApproval,
				// Policy is authoritative: always use the resolved policy value so
				// the harness can reduce approvals (e.g. solo-dev posture → 0) and
				// not be permanently overridden by existing GitHub state.
				required_approving_review_count: input.policy.requiredApprovals,
				required_review_thread_resolution:
					input.policy.requireConversationResolution,
			},
		};
		upsertRule(baseRules, pullRequestRule);
	} else {
		removeRule(baseRules, "pull_request");
	}

	const existingChecksRule = getRule(baseRules, "required_status_checks");
	const existingChecksParameters = normalizeParameters(
		existingChecksRule?.parameters,
	);
	const requiredContexts = normalizeChecks(input.requiredChecks);
	const statusChecksRule: RulesetRule = {
		type: "required_status_checks",
		parameters: {
			...existingChecksParameters,
			strict_required_status_checks_policy:
				input.policy.requireBranchesUpToDate,
			do_not_enforce_on_create: false,
			required_status_checks: mergeRequiredStatusChecks(
				normalizeRequiredStatusCheckEntries(
					existingChecksParameters.required_status_checks,
				),
				requiredContexts,
			),
		},
	};
	upsertRule(baseRules, statusChecksRule);

	if (input.policy.codeQuality?.required) {
		upsertRule(baseRules, {
			type: "code_quality",
			parameters: {
				severity: input.policy.codeQuality.severity,
			},
		});
	} else {
		removeRule(baseRules, "code_quality");
	}

	const shouldRequirePublicCodeScanning =
		input.policy.publicCodeScanning?.required === true &&
		(input.policy.publicCodeScanning.publicOnly !== true ||
			input.repositoryVisibility === "public" ||
			input.repositoryVisibility === undefined);
	if (shouldRequirePublicCodeScanning && input.policy.publicCodeScanning) {
		upsertRule(baseRules, {
			type: "code_scanning",
			parameters: {
				code_scanning_tools: [
					{
						tool: input.policy.publicCodeScanning.tool,
						alerts_threshold: input.policy.publicCodeScanning.alertsThreshold,
						security_alerts_threshold:
							input.policy.publicCodeScanning.securityAlertsThreshold,
					},
				],
			},
		});
	} else if (
		input.policy.publicCodeScanning?.publicOnly !== true ||
		input.repositoryVisibility !== undefined
	) {
		removeRule(baseRules, "code_scanning");
	}

	return {
		name: input.existingRuleset?.name ?? input.rulesetName,
		target: "branch",
		enforcement:
			(input.existingRuleset?.enforcement as
				| "active"
				| "disabled"
				| "evaluate"
				| undefined) ?? "active",
		bypass_actors: input.existingRuleset?.bypass_actors ?? [],
		conditions: {
			ref_name: {
				include: mergeRefNameIncludes(
					input.existingRuleset?.conditions?.ref_name?.include,
					input.branchRef,
				),
				exclude: normalizeStringList(
					input.existingRuleset?.conditions?.ref_name?.exclude,
				),
			},
		},
		rules: baseRules,
	};
}

function normalizeParameters(value: unknown): Record<string, unknown> {
	if (typeof value === "object" && value !== null && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}
	return {};
}

function normalizeStringList(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	const list: string[] = [];
	for (const item of value) {
		if (typeof item === "string" && item.trim().length > 0) {
			list.push(item.trim());
		}
	}
	return list;
}

/**
 * Merge a branch ref into an existing list of ref_name include patterns, normalizing and deduplicating entries.
 *
 * @param existingIncludes - The current include list (may be any value); non-array values are treated as absent.
 * @param branchRef - The branch ref to ensure is included (e.g. `refs/heads/main`).
 * @returns An array of normalized, deduplicated include strings with `branchRef` present; if `existingIncludes` normalizes to no valid entries, returns an empty array. If `existingIncludes` is not an array, returns `[branchRef]`.
 */
function mergeRefNameIncludes(
	existingIncludes: unknown,
	branchRef: string,
): string[] {
	if (!Array.isArray(existingIncludes)) {
		return [branchRef];
	}
	const normalized = normalizeStringList(existingIncludes);
	if (normalized.length === 0) {
		return [];
	}
	const merged = new Set(normalized);
	merged.add(branchRef);
	return Array.from(merged);
}

/**
 * Extracts structured required-status-check entries from an arbitrary value.
 *
 * Accepts an array-like value and returns a list of objects that contain a non-empty, trimmed `context` string; other properties from each source item are preserved.
 *
 * @param value - The input to normalize (expected to be an array of objects).
 * @returns An array of entries where each entry has a trimmed, non-empty `context` string and any other preserved properties from the original item.
 */
function normalizeRequiredStatusCheckEntries(
	value: unknown,
): RequiredStatusCheckEntry[] {
	if (!Array.isArray(value)) return [];
	const checks: RequiredStatusCheckEntry[] = [];
	for (const item of value) {
		if (
			typeof item === "object" &&
			item !== null &&
			typeof (item as { context?: unknown }).context === "string"
		) {
			const context = (item as { context: string }).context.trim();
			if (context.length > 0) {
				checks.push({
					...(item as Record<string, unknown>),
					context,
				});
			}
		}
	}
	return checks;
}

/**
 * Merge existing required status check entries with additional required contexts, preserving existing entries and order.
 *
 * @param existingChecks - Array of existing required status check entries; each entry must include a `context` string and may include other properties.
 * @param requiredContexts - List of context names that must be present in the resulting entries.
 * @returns The merged list of `RequiredStatusCheckEntry` objects where entries are deduplicated by `context`: existing entries are kept (in order) and any missing `requiredContexts` are appended as `{ context }`.
 */
function mergeRequiredStatusChecks(
	existingChecks: RequiredStatusCheckEntry[],
	requiredContexts: string[],
): RequiredStatusCheckEntry[] {
	const merged: RequiredStatusCheckEntry[] = [];
	const seenContexts = new Set<string>();
	const requiredContextSet = new Set(requiredContexts);

	for (const check of existingChecks) {
		if (!seenContexts.has(check.context)) {
			merged.push(
				requiredContextSet.has(check.context)
					? { context: check.context }
					: check,
			);
			seenContexts.add(check.context);
		}
	}

	for (const context of requiredContexts) {
		if (!seenContexts.has(context)) {
			merged.push({ context });
			seenContexts.add(context);
		}
	}

	return merged;
}

/**
 * Resolve the repository's default branch reference, using a conservative fallback when lookup fails or is unavailable.
 *
 * @returns The branch ref in the form `refs/heads/<branchName>` where `<branchName>` is the repository's default branch when obtainable, or `DEFAULT_BRANCH` (e.g., `"main"`) when not.
 */
async function resolveDefaultBranchRef(client: GitHubClient): Promise<string> {
	try {
		const defaultBranchResolver = (
			client as GitHubClient & {
				getDefaultBranch?: () => Promise<string>;
			}
		).getDefaultBranch;
		if (typeof defaultBranchResolver !== "function") {
			return `refs/heads/${DEFAULT_BRANCH}`;
		}
		const defaultBranch = await defaultBranchResolver.call(client);
		if (typeof defaultBranch === "string" && defaultBranch.trim().length > 0) {
			return `refs/heads/${defaultBranch.trim()}`;
		}
	} catch {
		// Ignore lookup failures and continue with conservative fallback.
	}
	return `refs/heads/${DEFAULT_BRANCH}`;
}

async function resolveRepositoryVisibility(
	client: GitHubClient,
): Promise<string | undefined> {
	try {
		return await client.getRepositoryVisibility();
	} catch {
		return undefined;
	}
}

/**
 * Apply repository-level merge method settings via the provided GitHub client.
 *
 * @param client - GitHub API client used to update repository merge settings
 * @param settings - Flags controlling which merge methods are allowed on the repository
 * @param settings.allowMergeCommit - Enable or disable merge commits
 * @param settings.allowSquashMerge - Enable or disable squash merges
 * @param settings.allowRebaseMerge - Enable or disable rebase merges
 * @throws Re-throws any non-TypeError error raised by the client's update call
 */
async function applyRepositoryMergeSettings(
	client: GitHubClient,
	settings: {
		allowMergeCommit: boolean;
		allowSquashMerge: boolean;
		allowRebaseMerge: boolean;
	},
): Promise<void> {
	const mergeSettingsUpdater = (
		client as GitHubClient & {
			updateRepositoryMergeSettings?: (settings: {
				allowMergeCommit: boolean;
				allowSquashMerge: boolean;
				allowRebaseMerge: boolean;
			}) => Promise<void>;
		}
	).updateRepositoryMergeSettings;
	if (typeof mergeSettingsUpdater !== "function") {
		return;
	}
	await mergeSettingsUpdater.call(client, settings);
}

/**
 * Determines whether a branch reference matches a ref selector.
 *
 * The selector may be a special token `~ALL` (matches any branch), `~DEFAULT_BRANCH` (matches when the branch equals the default branch), an exact branch ref, or a wildcard pattern using `*` where `*` matches any sequence of characters.
 *
 * @param selector - The ref selector to evaluate (may contain `*` or be a special token)
 * @param branchRef - The branch ref to test (e.g., `refs/heads/main`)
 * @param defaultBranchRef - The repository default branch ref for `~DEFAULT_BRANCH` comparisons
 * @returns `true` if `branchRef` satisfies the `selector`, `false` otherwise.
 */
function refSelectorMatches(
	selector: string,
	branchRef: string,
	defaultBranchRef: string,
): boolean {
	const normalized = selector.trim();
	if (normalized.length === 0) {
		return false;
	}
	if (normalized === "~ALL") {
		return true;
	}
	if (normalized === "~DEFAULT_BRANCH") {
		return branchRef === defaultBranchRef;
	}
	if (normalized === branchRef) {
		return true;
	}
	if (!normalized.includes("*")) {
		return false;
	}

	const escaped = normalized
		.replace(/[.+?^${}()|[\]\\]/g, "\\$&")
		.replace(/\*/g, ".*");
	const pattern = new RegExp(`^${escaped}$`);
	return pattern.test(branchRef);
}

/**
 * Selects a branch-targeting ruleset with the given name that applies to the specified branch reference.
 *
 * @param rulesets - Array of ruleset summaries to search
 * @param branchRef - Fully qualified branch ref to test (for example, `refs/heads/main`)
 * @param rulesetName - Name of the ruleset to match
 * @param defaultBranchRef - Fully qualified default branch ref used when evaluating default-branch selectors
 * @returns The matching ruleset summary if one is found, `undefined` otherwise
 */
function findMatchingRuleset(
	rulesets: RulesetSummary[],
	branchRef: string,
	rulesetName: string,
	defaultBranchRef: string,
): RulesetSummary | undefined {
	return rulesets.find((ruleset) => {
		if (ruleset.target !== "branch" || ruleset.name !== rulesetName) {
			return false;
		}
		const includes = ruleset.conditions?.ref_name?.include;
		const excludes = ruleset.conditions?.ref_name?.exclude;
		if (
			Array.isArray(excludes) &&
			excludes.some((exclude) =>
				refSelectorMatches(exclude, branchRef, defaultBranchRef),
			)
		) {
			return false;
		}
		if (!Array.isArray(includes) || includes.length === 0) {
			return true;
		}
		return includes.some((include) =>
			refSelectorMatches(include, branchRef, defaultBranchRef),
		);
	});
}

/**
 * Normalize a list of required check identifiers by trimming, removing empties, and deduplicating.
 *
 * @param checks - The input check identifiers; if `undefined` or an empty array, `DEFAULT_REQUIRED_CHECKS` will be used instead.
 * @returns A deduplicated array of trimmed, non-empty check identifiers (order is not guaranteed).
 */
function normalizeChecks(checks: string[] | undefined): string[] {
	const baseChecks = checks === undefined ? DEFAULT_REQUIRED_CHECKS : checks;
	const deduped = new Set<string>();
	for (const check of baseChecks) {
		const trimmed = check.trim();
		if (trimmed.length > 0) {
			deduped.add(trimmed);
		}
	}
	return Array.from(deduped);
}

function getRule(rules: RulesetRule[], type: string): RulesetRule | undefined {
	return rules.find((rule) => rule.type === type);
}

function upsertRule(rules: RulesetRule[], nextRule: RulesetRule): void {
	const existingIndex = rules.findIndex((rule) => rule.type === nextRule.type);
	if (existingIndex >= 0) {
		rules[existingIndex] = nextRule;
		return;
	}
	rules.push(nextRule);
}

function removeRule(rules: RulesetRule[], type: string): void {
	const existingIndex = rules.findIndex((rule) => rule.type === type);
	if (existingIndex >= 0) {
		rules.splice(existingIndex, 1);
	}
}

function toggleRule(
	rules: RulesetRule[],
	type: string,
	enabled: boolean,
	parameters?: Record<string, unknown>,
): void {
	if (!enabled) {
		removeRule(rules, type);
		return;
	}
	upsertRule(rules, parameters ? { type, parameters } : { type });
}

/**
 * CLI entrypoint wrapper for branch protection with exit-code mapping.
 */
export async function runBranchProtectCLI(
	options: BranchProtectOptions,
): Promise<number> {
	const result = await runBranchProtect(options);
	if (result.ok) {
		if (options.json) {
			console.info(JSON.stringify(result.output));
		} else {
			console.info(
				`✓ Branch protection ${result.output.action} for ${result.output.repository}:${result.output.branch}`,
			);
			console.info(`  ruleset: ${result.output.rulesetName}`);
			if (result.output.ecosystem) {
				console.info(`  ecosystem: ${result.output.ecosystem}`);
			}
			console.info(`  checks: ${result.output.requiredChecks.join(", ")}`);
		}
		return EXIT_CODES.SUCCESS;
	}

	if (options.json) {
		console.error(JSON.stringify({ error: result.error }));
	} else {
		console.error(result.error.message);
	}
	if (result.error.code === "VALIDATION_ERROR") {
		return EXIT_CODES.VALIDATION_ERROR;
	}
	if (result.error.code === "NOT_FOUND") {
		return EXIT_CODES.NOT_FOUND;
	}
	if (result.error.code === "PERMISSION_DENIED") {
		return EXIT_CODES.PERMISSION_DENIED;
	}
	return EXIT_CODES.SYSTEM_ERROR;
}

export { listEcosystemProfiles };
