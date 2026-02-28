import {
	GitHubClient,
	type Ruleset,
	type RulesetPayload,
	type RulesetRule,
	type RulesetSummary,
} from "../lib/github/client.js";
import { sanitizeError } from "../lib/input/sanitize.js";

const DEFAULT_RULESET_NAME = "protect";
const DEFAULT_BRANCH = "main";
const DEFAULT_REQUIRED_CHECKS = [
	"pr-template",
	"lint",
	"typecheck",
	"test",
	"audit",
	"check",
	"memory",
];

export const EXIT_CODES = {
	SUCCESS: 0,
	VALIDATION_ERROR: 1,
	NOT_FOUND: 2,
	PERMISSION_DENIED: 3,
	SYSTEM_ERROR: 10,
} as const;

export interface BranchProtectOptions {
	token?: string;
	owner?: string;
	repo?: string;
	branch?: string;
	rulesetName?: string;
	requiredChecks?: string[];
	requiredApprovingReviewCount?: number;
	dryRun?: boolean;
	json?: boolean;
}

export interface BranchProtectOutput {
	action: "created" | "updated" | "dry_run";
	repository: string;
	branch: string;
	rulesetId?: number | undefined;
	rulesetName: string;
	requiredChecks: string[];
}

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

	const requestedChecks = normalizeChecks(options.requiredChecks);
	if (requestedChecks.length === 0) {
		return {
			ok: false,
			error: {
				code: "VALIDATION_ERROR",
				message: "At least one required status check is required.",
			},
		};
	}

	const requiredApprovals = options.requiredApprovingReviewCount ?? 1;
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

		const payload = buildPayload({
			branchRef,
			rulesetName,
			requiredApprovals,
			requiredChecks: requestedChecks,
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
					requiredChecks: requestedChecks,
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

		return {
			ok: true,
			output: {
				action: existingSummary !== undefined ? "updated" : "created",
				repository: `${owner}/${repo}`,
				branch,
				rulesetId: updatedRuleset.id,
				rulesetName,
				requiredChecks: requestedChecks,
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
	requiredApprovals: number;
	requiredChecks: string[];
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

	upsertRule(baseRules, { type: "deletion" });
	upsertRule(baseRules, { type: "non_fast_forward" });

	const existingPullRequestRule = getRule(baseRules, "pull_request");
	const existingPullParameters = normalizeParameters(
		existingPullRequestRule?.parameters,
	);
	const existingRequireCodeOwnerReview = toBoolean(
		existingPullParameters.require_code_owner_review,
	);
	const existingRequireLastPushApproval = toBoolean(
		existingPullParameters.require_last_push_approval,
	);
	const existingRequiredApprovals = toNonNegativeInteger(
		existingPullParameters.required_approving_review_count,
	);
	const pullRequestRule: RulesetRule = {
		type: "pull_request",
		parameters: {
			...existingPullParameters,
			dismiss_stale_reviews_on_push: true,
			require_code_owner_review: existingRequireCodeOwnerReview ?? false,
			require_last_push_approval: existingRequireLastPushApproval ?? false,
			required_approving_review_count: Math.max(
				input.requiredApprovals,
				existingRequiredApprovals ?? 0,
			),
			required_review_thread_resolution: true,
		},
	};
	upsertRule(baseRules, pullRequestRule);

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
			strict_required_status_checks_policy: true,
			do_not_enforce_on_create: false,
			required_status_checks: mergedRequiredChecks,
		},
	};
	upsertRule(baseRules, statusChecksRule);

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

function toBoolean(value: unknown): boolean | undefined {
	if (typeof value === "boolean") {
		return value;
	}
	return undefined;
}

function toNonNegativeInteger(value: unknown): number | undefined {
	if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
		return undefined;
	}
	return value;
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
	if (existingIncludes.length === 0) {
		return [];
	}
	const normalized = normalizeStringList(existingIncludes);
	if (normalized.length === 0) {
		return [branchRef];
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

	for (const check of existingChecks) {
		if (!seenContexts.has(check.context)) {
			merged.push(check);
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
			console.info(`  checks: ${result.output.requiredChecks.join(", ")}`);
		}
		return EXIT_CODES.SUCCESS;
	}

	console.error(result.error.message);
	if (options.json) {
		console.error(JSON.stringify({ error: result.error }));
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
