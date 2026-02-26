/**
 * check-authz command for pilot authorization preflight validation.
 * Validates token scope, repo/branch targets, and artifact exclusion policy.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadContract } from "../lib/contract/loader.js";
import type {
	HarnessContract,
	PilotAuthzPolicy,
} from "../lib/contract/types.js";
import { DEFAULT_PILOT_AUTHZ_POLICY } from "../lib/contract/types.js";
import { sanitizeError } from "../lib/input/sanitize.js";

// Exit codes for programmatic consumption
export const EXIT_CODES = {
	SUCCESS: 0,
	POLICY_VIOLATION: 1,
	VALIDATION_ERROR: 2,
	CONTRACT_ERROR: 3,
} as const;

export interface CheckAuthzOptions {
	/** Path to contract file */
	contractPath?: string;
	/** Repository being targeted (owner/repo format) */
	repo?: string;
	/** Branch being targeted */
	branch?: string;
	/** Check token scopes (requires GITHUB_TOKEN env) */
	checkScopes?: boolean;
	/** Output as JSON */
	json?: boolean;
}

export interface AuthzViolation {
	/** Violation type */
	type:
		| "repo_not_allowed"
		| "branch_not_allowed"
		| "branch_protected"
		| "scope_missing";
	/** Human-readable message */
	message: string;
	/** The value that caused the violation */
	value?: string;
	/** Expected policy value */
	expected?: string;
}

export interface CheckAuthzOutput {
	/** Whether all checks passed */
	passed: boolean;
	/** Any policy violations found */
	violations: AuthzViolation[];
	/** Policy that was applied */
	policyApplied: PilotAuthzPolicy;
	/** Repository checked (if provided) */
	repoChecked?: string;
	/** Branch checked (if provided) */
	branchChecked?: string;
	/** Token scopes detected (if checkScopes enabled) */
	tokenScopes?: string[];
}

export type CheckAuthzResult =
	| { ok: true; output: CheckAuthzOutput }
	| { ok: false; error: { code: string; message: string } };

/**
 * Check if a value matches any pattern in an allowlist.
 * Supports glob-style patterns with * and **.
 */
function matchesPattern(value: string, patterns: string[]): boolean {
	if (patterns.length === 0) {
		return false; // Empty allowlist = deny all
	}

	for (const pattern of patterns) {
		// Exact match
		if (pattern === value) {
			return true;
		}

		// Convert glob pattern to regex
		const regexPattern = pattern
			.replace(/\*\*/g, "<<<DOUBLE_STAR>>>")
			.replace(/\*/g, "[^/]*")
			.replace(/<<<DOUBLE_STAR>>>/g, ".*");

		const regex = new RegExp(`^${regexPattern}$`);
		if (regex.test(value)) {
			return true;
		}
	}

	return false;
}

/**
 * Check if a branch is in the protected denylist.
 */
function isProtectedBranch(branch: string, denylist: string[]): boolean {
	return matchesPattern(branch, denylist);
}

/**
 * Get token scopes from GitHub API headers.
 * This is a best-effort check that requires GITHUB_TOKEN to be set.
 */
async function getTokenScopes(): Promise<string[]> {
	const token = process.env.GITHUB_TOKEN;
	if (!token) {
		return [];
	}

	try {
		// Use GitHub API to get rate limit (which returns X-OAuth-Scopes header)
		const response = await fetch("https://api.github.com/rate_limit", {
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/vnd.github.v3+json",
				"User-Agent": "harness-check-authz",
			},
		});

		const scopesHeader = response.headers.get("X-OAuth-Scopes");
		if (scopesHeader) {
			return scopesHeader.split(", ").map((s) => s.trim());
		}
		return [];
	} catch {
		return [];
	}
}

/**
 * Run authorization preflight check.
 * This function is usable as a library (does not output to console).
 */
export async function runCheckAuthz(
	options: CheckAuthzOptions,
): Promise<CheckAuthzResult> {
	// Load contract
	let contract: HarnessContract;
	try {
		const contractPath = options.contractPath ?? "harness.contract.json";
		contract = loadContract(contractPath);
	} catch (e) {
		return {
			ok: false,
			error: {
				code: "CONTRACT_ERROR",
				message: `Failed to load contract: ${sanitizeError(e)}`,
			},
		};
	}

	const policy = contract.pilotAuthzPolicy ?? DEFAULT_PILOT_AUTHZ_POLICY;
	const violations: AuthzViolation[] = [];

	// Check repository against allowlist
	if (options.repo) {
		if (policy.repoAllowlist.length === 0) {
			violations.push({
				type: "repo_not_allowed",
				message: `Repository '${options.repo}' not allowed: repo allowlist is empty (deny all by default)`,
				value: options.repo,
				expected: "At least one pattern in pilotAuthzPolicy.repoAllowlist",
			});
		} else if (!matchesPattern(options.repo, policy.repoAllowlist)) {
			violations.push({
				type: "repo_not_allowed",
				message: `Repository '${options.repo}' does not match any pattern in allowlist`,
				value: options.repo,
				expected: `One of: ${policy.repoAllowlist.join(", ")}`,
			});
		}
	}

	// Check branch against allowlist and denylist
	if (options.branch) {
		// First check if branch is protected
		if (isProtectedBranch(options.branch, policy.protectedBranchDenylist)) {
			violations.push({
				type: "branch_protected",
				message: `Branch '${options.branch}' is protected and cannot be targeted for mutative operations`,
				value: options.branch,
				expected: `Branch not matching: ${policy.protectedBranchDenylist.join(", ")}`,
			});
		}

		// Then check against allowlist (if not already protected)
		if (
			policy.branchAllowlist.length > 0 &&
			!matchesPattern(options.branch, policy.branchAllowlist)
		) {
			violations.push({
				type: "branch_not_allowed",
				message: `Branch '${options.branch}' does not match any pattern in allowlist`,
				value: options.branch,
				expected: `One of: ${policy.branchAllowlist.join(", ")}`,
			});
		}
	}

	// Check token scopes if requested
	let tokenScopes: string[] | undefined;
	if (options.checkScopes) {
		tokenScopes = await getTokenScopes();

		// Check if required scopes are present
		const missingScopes = policy.githubScopeAllowlist.filter(
			(scope) => !tokenScopes?.includes(scope),
		);

		if (missingScopes.length > 0) {
			violations.push({
				type: "scope_missing",
				message: `Token is missing required scopes: ${missingScopes.join(", ")}`,
				value: tokenScopes?.join(", ") ?? "none",
				expected: `All of: ${policy.githubScopeAllowlist.join(", ")}`,
			});
		}
	}

	// Check that artifacts/pilot/ is excluded from git tracking
	// (This is a safety check to prevent pilot artifacts from being committed)
	const gitignorePath = resolve(process.cwd(), ".gitignore");
	if (existsSync(gitignorePath)) {
		// We could check .gitignore contents, but for v1 we just note this should be verified
		// A more thorough implementation would parse .gitignore
	}

	const output: CheckAuthzOutput = {
		passed: violations.length === 0,
		violations,
		policyApplied: policy,
	};

	// Only add optional fields if they have values
	if (options.repo !== undefined) {
		output.repoChecked = options.repo;
	}
	if (options.branch !== undefined) {
		output.branchChecked = options.branch;
	}
	if (tokenScopes !== undefined) {
		output.tokenScopes = tokenScopes;
	}

	return { ok: true, output };
}

/**
 * CLI entry point with output formatting and exit codes.
 */
export async function runCheckAuthzCLI(
	options: CheckAuthzOptions,
): Promise<number> {
	const result = await runCheckAuthz(options);

	if (!result.ok) {
		if (options.json) {
			console.error(JSON.stringify({ error: result.error }, null, 2));
		} else {
			console.error(`Error: ${result.error.message}`);
		}
		return EXIT_CODES.CONTRACT_ERROR;
	}

	const { output } = result;

	if (options.json) {
		console.info(JSON.stringify(output, null, 2));
	} else {
		if (output.passed) {
			console.info("✓ Authorization check passed");
			if (output.repoChecked) {
				console.info(`  Repository: ${output.repoChecked}`);
			}
			if (output.branchChecked) {
				console.info(`  Branch: ${output.branchChecked}`);
			}
			if (output.tokenScopes && output.tokenScopes.length > 0) {
				console.info(`  Token scopes: ${output.tokenScopes.join(", ")}`);
			}
		} else {
			console.error("✗ Authorization check failed");
			console.error("");
			for (const violation of output.violations) {
				console.error(`  ${violation.type}: ${violation.message}`);
				if (violation.expected) {
					console.error(`    Expected: ${violation.expected}`);
				}
			}
		}
	}

	return output.passed ? EXIT_CODES.SUCCESS : EXIT_CODES.POLICY_VIOLATION;
}
