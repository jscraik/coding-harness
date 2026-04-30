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

	return normalizeChecks(
		input.requiredChecks.map((check) => {
			const matchedGate = gateByName.get(check);
			return matchedGate?.githubCheckName ?? check;
		}),
	);
}

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
	const existingRequiredChecks = normalizeRequiredStatusCheckEntries(
		existingChecksParameters.required_status_checks,
	);
	const requiredContexts = normalizeChecks(input.requiredChecks);
	const mergedRequiredChecks = mergeRequiredStatusChecks(
		existingRequiredChecks,
		requiredContexts,
	);
	const statusChecksRule: RulesetRule = {
		type: "required_status_checks",
		parameters: {
			...existingChecksParameters,
			strict_required_status_checks_policy:
				input.policy.requireBranchesUpToDate,
			do_not_enforce_on_create: false,
			required_status_checks: mergedRequiredChecks,
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

async function applyRepositoryMergeSettings(
	client: GitHubClient,
	settings: {
		allowMergeCommit: boolean;
		allowSquashMerge: boolean;
		allowRebaseMerge: boolean;
	},
): Promise<void> {
	try {
		await client.updateRepositoryMergeSettings(settings);
	} catch (error) {
		if (error instanceof TypeError) {
			return;
		}
		throw error;
	}
}

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

function normalizeChecks(checks: string[] | undefined): string[] {
	const baseChecks =
		checks === undefined || checks.length === 0
			? DEFAULT_REQUIRED_CHECKS
			: checks;
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
