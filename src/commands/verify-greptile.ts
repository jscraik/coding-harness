/**
 * Verify Greptile setup command
 *
 * Verifies that Greptile is properly configured for a repository:
 * - Greptile GitHub App is installed
 * - Required .greptile/ config files exist
 * - greptile-review.yml workflow exists
 * - Ruleset requires "Greptile Review" check
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { GitHubClient } from "../lib/github/client.js";
import { sanitizeError } from "../lib/input/sanitize.js";

export const EXIT_CODES = {
	SUCCESS: 0,
	VALIDATION_ERROR: 1,
	NOT_FOUND: 2,
	PERMISSION_DENIED: 3,
	SYSTEM_ERROR: 10,
} as const;

export interface VerifyGreptileOptions {
	token?: string;
	owner?: string;
	repo?: string;
	repoPath?: string;
	json?: boolean;
	verbose?: boolean;
}

export interface GreptileVerificationResult {
	ok: boolean;
	checks: GreptileCheck[];
	summary: {
		passed: number;
		failed: number;
		warnings: number;
	};
}

export interface GreptileCheck {
	name: string;
	status: "pass" | "fail" | "warn";
	message: string;
	details?: Record<string, unknown>;
}

function normalizeToken(value: string | undefined): string | undefined {
	if (typeof value !== "string") return undefined;
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

export async function runVerifyGreptile(
	options: VerifyGreptileOptions,
): Promise<GreptileVerificationResult> {
	const checks: GreptileCheck[] = [];
	const repoPath = options.repoPath || process.cwd();

	// Check 1: Local .greptile/ directory structure
	const greptileDir = resolve(repoPath, ".greptile");
	const localChecks = verifyLocalGreptileConfig(greptileDir);
	checks.push(...localChecks);

	// Check 2: greptile-review.yml workflow exists
	const workflowCheck = verifyGreptileWorkflow(repoPath);
	checks.push(workflowCheck);

	// Check 3: GitHub App installation and ruleset (requires token)
	const token =
		normalizeToken(options.token) ??
		normalizeToken(process.env.GITHUB_TOKEN) ??
		normalizeToken(process.env.GITHUB_PERSONAL_ACCESS_TOKEN);

	const owner = options.owner?.trim();
	const repo = options.repo?.trim();

	if (token && owner && repo) {
		const remoteChecks = await verifyRemoteGreptileSetup(
			token,
			owner,
			repo,
			repoPath,
		);
		checks.push(...remoteChecks);
	} else {
		checks.push({
			name: "GitHub Configuration",
			status: "warn",
			message:
				"Skipped remote verification. Provide --token, --owner, and --repo to verify GitHub App installation and ruleset.",
		});
	}

	const summary = {
		passed: checks.filter((c) => c.status === "pass").length,
		failed: checks.filter((c) => c.status === "fail").length,
		warnings: checks.filter((c) => c.status === "warn").length,
	};

	return {
		ok: summary.failed === 0,
		checks,
		summary,
	};
}

function verifyLocalGreptileConfig(greptileDir: string): GreptileCheck[] {
	const checks: GreptileCheck[] = [];

	// Check .greptile/config.json
	const configPath = resolve(greptileDir, "config.json");
	if (existsSync(configPath)) {
		try {
			const content = readFileSync(configPath, "utf-8");
			const config = JSON.parse(content);
			const missingFields: string[] = [];

			if (!config.version) missingFields.push("version");
			if (typeof config.strictness !== "number")
				missingFields.push("strictness");
			if (!config.confidence?.minMergeScore)
				missingFields.push("confidence.minMergeScore");

			if (missingFields.length > 0) {
				checks.push({
					name: ".greptile/config.json",
					status: "warn",
					message: `Config exists but missing recommended fields: ${missingFields.join(", ")}`,
					details: { path: configPath },
				});
			} else {
				checks.push({
					name: ".greptile/config.json",
					status: "pass",
					message: `Valid config with minMergeScore=${config.confidence.minMergeScore}`,
					details: {
						path: configPath,
						minMergeScore: config.confidence.minMergeScore,
					},
				});
			}
		} catch (e) {
			checks.push({
				name: ".greptile/config.json",
				status: "fail",
				message: `Failed to parse config: ${e instanceof Error ? e.message : "Unknown error"}`,
				details: { path: configPath },
			});
		}
	} else {
		checks.push({
			name: ".greptile/config.json",
			status: "fail",
			message: "Missing required .greptile/config.json",
			details: { path: configPath },
		});
	}

	// Check .greptile/rules.md
	const rulesPath = resolve(greptileDir, "rules.md");
	if (existsSync(rulesPath)) {
		checks.push({
			name: ".greptile/rules.md",
			status: "pass",
			message: "Custom rules file exists",
			details: { path: rulesPath },
		});
	} else {
		checks.push({
			name: ".greptile/rules.md",
			status: "warn",
			message: "Optional rules.md not found. Using Greptile defaults.",
			details: { path: rulesPath },
		});
	}

	// Check .greptile/files.json
	const filesPath = resolve(greptileDir, "files.json");
	if (existsSync(filesPath)) {
		checks.push({
			name: ".greptile/files.json",
			status: "pass",
			message: "Files index exists",
			details: { path: filesPath },
		});
	} else {
		checks.push({
			name: ".greptile/files.json",
			status: "warn",
			message: "Optional files.json not found.",
			details: { path: filesPath },
		});
	}

	return checks;
}

function verifyGreptileWorkflow(repoPath: string): GreptileCheck {
	const workflowPath = resolve(
		repoPath,
		".github/workflows/greptile-review.yml",
	);

	if (!existsSync(workflowPath)) {
		return {
			name: "greptile-review.yml workflow",
			status: "fail",
			message:
				"Missing .github/workflows/greptile-review.yml. This workflow is required to create Greptile Review check runs.",
			details: { path: workflowPath },
		};
	}

	try {
		const content = readFileSync(workflowPath, "utf-8");

		// Verify workflow triggers
		const hasPullRequestTrigger = /on:[\s\S]*?pull_request:/.test(content);
		const hasIssueCommentTrigger = /on:[\s\S]*?issue_comment:/.test(content);
		const hasChecksWritePermission = /checks:\s*write/.test(content);

		const issues: string[] = [];
		if (!hasPullRequestTrigger) issues.push("missing pull_request trigger");
		if (!hasIssueCommentTrigger)
			issues.push(
				"missing issue_comment trigger (required for Greptile bridge)",
			);
		if (!hasChecksWritePermission)
			issues.push("missing checks: write permission");

		if (issues.length > 0) {
			return {
				name: "greptile-review.yml workflow",
				status: "warn",
				message: `Workflow exists but has issues: ${issues.join(", ")}`,
				details: { path: workflowPath, issues },
			};
		}

		return {
			name: "greptile-review.yml workflow",
			status: "pass",
			message:
				"Valid workflow with required triggers (pull_request, issue_comment) and permissions",
			details: { path: workflowPath },
		};
	} catch (e) {
		return {
			name: "greptile-review.yml workflow",
			status: "fail",
			message: `Failed to read workflow: ${e instanceof Error ? e.message : "Unknown error"}`,
			details: { path: workflowPath },
		};
	}
}

async function verifyRemoteGreptileSetup(
	token: string,
	owner: string,
	repo: string,
	_repoPath: string,
): Promise<GreptileCheck[]> {
	const checks: GreptileCheck[] = [];
	const client = new GitHubClient({ token, owner, repo });

	// Check if Greptile App is installed
	try {
		// Try to get app installation info
		// Note: This requires the token to have appropriate permissions
		const response = await fetch(
			`https://api.github.com/repos/${owner}/${repo}/installation`,
			{
				headers: {
					Authorization: `Bearer ${token}`,
					Accept: "application/vnd.github+json",
				},
			},
		);

		if (response.ok) {
			checks.push({
				name: "GitHub App Installation",
				status: "pass",
				message: "GitHub App integration available on repository",
			});
		} else if (response.status === 404) {
			checks.push({
				name: "GitHub App Installation",
				status: "warn",
				message:
					"Could not verify GitHub App installation. Ensure Greptile app is installed from GitHub Marketplace.",
				details: {
					hint: "Visit https://github.com/apps/greptile to install",
				},
			});
		} else {
			checks.push({
				name: "GitHub App Installation",
				status: "warn",
				message: `Could not verify app installation (HTTP ${response.status})`,
			});
		}
	} catch (e) {
		checks.push({
			name: "GitHub App Installation",
			status: "warn",
			message: `Failed to check app installation: ${e instanceof Error ? e.message : "Unknown error"}`,
		});
	}

	// Check if ruleset requires "Greptile Review"
	try {
		const rulesets = await client.listRulesets();
		const protectRuleset = rulesets.find(
			(r) => r.name === "protect" && r.target === "branch",
		);

		if (!protectRuleset) {
			checks.push({
				name: "Ruleset Configuration",
				status: "warn",
				message:
					'No "protect" ruleset found. Run `harness branch-protect` to create one.',
			});
		} else {
			const fullRuleset = await client.getRuleset(protectRuleset.id);
			const statusChecksRule = fullRuleset.rules.find(
				(r) => r.type === "required_status_checks",
			);
			const requiredChecks =
				(statusChecksRule?.parameters?.required_status_checks as
					| { context: string }[]
					| undefined) || [];

			const hasGreptileReview = requiredChecks.some(
				(c) => c.context === "Greptile Review",
			);

			if (hasGreptileReview) {
				checks.push({
					name: "Ruleset Configuration",
					status: "pass",
					message: 'Ruleset "protect" requires "Greptile Review" status check',
					details: { rulesetId: protectRuleset.id },
				});
			} else {
				checks.push({
					name: "Ruleset Configuration",
					status: "fail",
					message:
						'Ruleset "protect" does not require "Greptile Review" status check. Update the ruleset to enforce Greptile review.',
					details: {
						rulesetId: protectRuleset.id,
						currentChecks: requiredChecks.map((c) => c.context),
					},
				});
			}
		}
	} catch (e) {
		checks.push({
			name: "Ruleset Configuration",
			status: "warn",
			message: `Failed to check ruleset: ${sanitizeError(e)}`,
		});
	}

	// Check webhook requirements (informational)
	checks.push({
		name: "Webhook Configuration",
		status: "pass",
		message:
			"Webhook events are managed by the Greptile GitHub App. Ensure the app subscribes to: pull_request, issue_comment",
		details: {
			requiredEvents: ["pull_request", "issue_comment"],
			note: "These events are configured at the GitHub App level, not the repository level.",
		},
	});

	return checks;
}

export async function runVerifyGreptileCLI(
	options: VerifyGreptileOptions,
): Promise<number> {
	const result = await runVerifyGreptile(options);

	if (options.json) {
		console.info(JSON.stringify(result, null, 2));
	} else {
		console.info("\n🔍 Greptile Setup Verification\n");
		console.info("=".repeat(50));

		for (const check of result.checks) {
			const icon =
				check.status === "pass" ? "✓" : check.status === "fail" ? "✗" : "⚠";
			const color =
				check.status === "pass"
					? "\x1b[32m"
					: check.status === "fail"
						? "\x1b[31m"
						: "\x1b[33m";

			console.info(`\n${color}${icon}\x1b[0m ${check.name}`);
			console.info(`  ${check.message}`);

			if (options.verbose && check.details) {
				console.info(
					`  Details: ${JSON.stringify(check.details, null, 2).replace(/\n/g, "\n  ")}`,
				);
			}
		}

		console.info(`\n${"=".repeat(50)}`);
		console.info(
			`\n📊 Summary: ${result.summary.passed} passed, ${result.summary.failed} failed, ${result.summary.warnings} warnings\n`,
		);
	}

	return result.ok ? EXIT_CODES.SUCCESS : EXIT_CODES.VALIDATION_ERROR;
}
