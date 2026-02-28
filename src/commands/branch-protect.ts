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
	"Greptile Review",
	"Socket Security: Pull Request Alerts",
	"Socket Security: Project Report",
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

export async function runBranchProtect(
	options: BranchProtectOptions,
): Promise<BranchProtectResult> {
	const token =
		options.token ??
		process.env.GITHUB_TOKEN ??
		process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
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

	const requiredApprovals = options.requiredApprovingReviewCount ?? 0;
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
		const rulesets = await client.listRulesets();
		const existingSummary = findMatchingRuleset(
			rulesets,
			branchRef,
			rulesetName,
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
	const pullRequestRule: RulesetRule = {
		type: "pull_request",
		parameters: {
			...existingPullParameters,
			dismiss_stale_reviews_on_push: true,
			require_code_owner_review: false,
			require_last_push_approval: false,
			required_approving_review_count: input.requiredApprovals,
			required_review_thread_resolution: true,
		},
	};
	upsertRule(baseRules, pullRequestRule);

	const existingChecksRule = getRule(baseRules, "required_status_checks");
	const existingChecksParameters = normalizeParameters(
		existingChecksRule?.parameters,
	);
	const existingContexts = extractCheckContexts(
		existingChecksParameters.required_status_checks,
	);
	const requiredContexts = normalizeChecks([
		...existingContexts,
		...input.requiredChecks,
	]);
	const statusChecksRule: RulesetRule = {
		type: "required_status_checks",
		parameters: {
			...existingChecksParameters,
			strict_required_status_checks_policy: true,
			do_not_enforce_on_create: false,
			required_status_checks: requiredContexts.map((context) => ({ context })),
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
				include: [input.branchRef],
				exclude: input.existingRuleset?.conditions?.ref_name?.exclude ?? [],
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

function extractCheckContexts(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	const contexts: string[] = [];
	for (const item of value) {
		if (
			typeof item === "object" &&
			item !== null &&
			typeof (item as { context?: unknown }).context === "string"
		) {
			contexts.push((item as { context: string }).context);
		}
	}
	return contexts;
}

function findMatchingRuleset(
	rulesets: RulesetSummary[],
	branchRef: string,
	rulesetName: string,
): RulesetSummary | undefined {
	return rulesets.find((ruleset) => {
		if (ruleset.target !== "branch" || ruleset.name !== rulesetName) {
			return false;
		}
		const includes = ruleset.conditions?.ref_name?.include;
		if (!Array.isArray(includes) || includes.length === 0) {
			return true;
		}
		return includes.includes(branchRef);
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
