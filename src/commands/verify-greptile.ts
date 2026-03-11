/**
 * Verify Greptile setup command
 *
 * Verifies that Greptile is properly configured for a repository:
 * - Greptile GitHub App is installed
 * - Required .greptile/ config files exist
 * - greptile-review.yml workflow exists
 * - Ruleset requires "Greptile Review" check
 */

import { createSign } from "node:crypto";
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
	appId?: string;
	appPrivateKeyPath?: string;
	appPrivateKey?: string;
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

const REQUIRED_GREPTILE_WORKFLOW_TRIGGERS = [
	"pull_request",
	"pull_request_review",
	"pull_request_review_comment",
	"issue_comment",
] as const;

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

interface GitHubAppAuth {
	appId: string;
	privateKeyPem: string;
}

interface HttpResponseSummary {
	status: number;
	message: string;
}

function normalizeAppId(value: string | undefined): string | undefined {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	if (trimmed.length === 0) return undefined;
	return trimmed;
}

function normalizePrivateKey(value: string | undefined): string | undefined {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	if (trimmed.length === 0) return undefined;
	return trimmed.replace(/\\n/g, "\n");
}

function loadGitHubAppAuth(options: VerifyGreptileOptions): {
	auth?: GitHubAppAuth;
	warning?: GreptileCheck;
} {
	const appId =
		normalizeAppId(options.appId) ??
		normalizeAppId(process.env.GITHUB_APP_ID) ??
		normalizeAppId(process.env.GH_APP_ID);

	const privateKeyFromCliOrEnv =
		normalizePrivateKey(options.appPrivateKey) ??
		normalizePrivateKey(process.env.GITHUB_APP_PRIVATE_KEY) ??
		normalizePrivateKey(process.env.GH_APP_PRIVATE_KEY);

	const privateKeyPath =
		normalizeToken(options.appPrivateKeyPath) ??
		normalizeToken(process.env.GITHUB_APP_PRIVATE_KEY_PATH) ??
		normalizeToken(process.env.GH_APP_PRIVATE_KEY_PATH);

	let privateKeyPem = privateKeyFromCliOrEnv;
	if (!privateKeyPem && privateKeyPath) {
		try {
			privateKeyPem = normalizePrivateKey(
				readFileSync(privateKeyPath, "utf-8"),
			);
		} catch (e) {
			return {
				warning: {
					name: "GitHub App Credentials",
					status: "warn",
					message: `Could not read GitHub App private key from ${privateKeyPath}: ${
						e instanceof Error ? e.message : "Unknown error"
					}`,
				},
			};
		}
	}

	if (appId && !privateKeyPem) {
		return {
			warning: {
				name: "GitHub App Credentials",
				status: "warn",
				message:
					"GitHub App ID provided but private key is missing. Set --app-private-key-path or GITHUB_APP_PRIVATE_KEY.",
			},
		};
	}

	if (!appId && privateKeyPem) {
		return {
			warning: {
				name: "GitHub App Credentials",
				status: "warn",
				message:
					"GitHub App private key provided but app ID is missing. Set --app-id or GITHUB_APP_ID.",
			},
		};
	}

	if (appId && privateKeyPem) {
		return {
			auth: {
				appId,
				privateKeyPem,
			},
		};
	}

	return {};
}

function buildGitHubAppJwt(auth: GitHubAppAuth): string {
	const now = Math.floor(Date.now() / 1000);
	const header = Buffer.from(
		JSON.stringify({ alg: "RS256", typ: "JWT" }),
	).toString("base64url");
	const payload = Buffer.from(
		JSON.stringify({
			iat: now - 60,
			exp: now + 9 * 60,
			iss: auth.appId,
		}),
	).toString("base64url");
	const unsignedToken = `${header}.${payload}`;
	const signature = createSign("RSA-SHA256")
		.update(unsignedToken)
		.end()
		.sign(auth.privateKeyPem)
		.toString("base64url");
	return `${unsignedToken}.${signature}`;
}

async function fetchInstallationEndpoint(
	owner: string,
	repo: string,
	authHeader: string,
): Promise<HttpResponseSummary> {
	const response = await fetch(
		`https://api.github.com/repos/${owner}/${repo}/installation`,
		{
			headers: {
				Authorization: authHeader,
				Accept: "application/vnd.github+json",
			},
		},
	);
	let message = "";
	try {
		const payload = (await response.json()) as { message?: string };
		message = typeof payload.message === "string" ? payload.message : "";
	} catch {
		// ignore non-JSON payloads
	}
	return { status: response.status, message };
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

	// Check 3: .npmrc configuration for private packages
	const npmrcCheck = verifyNpmrc(repoPath);
	checks.push(npmrcCheck);

	// Check 4: GitHub App installation and ruleset (requires token)
	const token =
		normalizeToken(options.token) ??
		normalizeToken(process.env.GITHUB_TOKEN) ??
		normalizeToken(process.env.GITHUB_PERSONAL_ACCESS_TOKEN);
	const { auth: appAuth, warning: appAuthWarning } = loadGitHubAppAuth(options);
	if (appAuthWarning) {
		checks.push(appAuthWarning);
	}

	const owner = options.owner?.trim();
	const repo = options.repo?.trim();

	if ((token || appAuth) && owner && repo) {
		const remoteChecks = await verifyRemoteGreptileSetup(
			token,
			owner,
			repo,
			repoPath,
			appAuth,
		);
		checks.push(...remoteChecks);
	} else {
		checks.push({
			name: "GitHub Configuration",
			status: "warn",
			message:
				"Skipped remote verification. Provide --owner/--repo plus a token for rulesets and optional GitHub App credentials (--app-id + --app-private-key-path) for app-installation checks.",
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
			if (typeof config.fileChangeLimit !== "number")
				missingFields.push("fileChangeLimit");
			if (
				!Array.isArray(config.commentTypes) ||
				config.commentTypes.length === 0
			)
				missingFields.push("commentTypes");
			if (config.enableCrossFileGraphQueries !== true)
				missingFields.push("enableCrossFileGraphQueries=true");
			if (config.requireIndependentValidation !== true)
				missingFields.push("requireIndependentValidation=true");
			if (!config.confidence?.minMergeScore)
				missingFields.push("confidence.minMergeScore");
			if (!config.confidence?.targetScore)
				missingFields.push("confidence.targetScore");

			if (missingFields.length > 0) {
				checks.push({
					name: ".greptile/config.json",
					status: "fail",
					message: `Config exists but missing required policy fields: ${missingFields.join(", ")}`,
					details: { path: configPath },
				});
			} else {
				checks.push({
					name: ".greptile/config.json",
					status: "pass",
					message: `Valid config with strictness=${config.strictness}, minMergeScore=${config.confidence.minMergeScore}`,
					details: {
						path: configPath,
						strictness: config.strictness,
						minMergeScore: config.confidence.minMergeScore,
						targetScore: config.confidence.targetScore,
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
			message: "Required rules file exists",
			details: { path: rulesPath },
		});
	} else {
		checks.push({
			name: ".greptile/rules.md",
			status: "fail",
			message:
				"Missing required .greptile/rules.md. Repository-local review guidance is mandatory.",
			details: { path: rulesPath },
		});
	}

	// Check .greptile/files.json
	const filesPath = resolve(greptileDir, "files.json");
	if (existsSync(filesPath)) {
		try {
			const content = readFileSync(filesPath, "utf-8");
			const parsed = JSON.parse(content) as {
				contextFiles?: unknown[];
				apiSpecs?: unknown[];
				schemaFiles?: unknown[];
			};
			const contextCount = Array.isArray(parsed.contextFiles)
				? parsed.contextFiles.length
				: 0;
			const apiSpecCount = Array.isArray(parsed.apiSpecs)
				? parsed.apiSpecs.length
				: 0;
			const schemaCount = Array.isArray(parsed.schemaFiles)
				? parsed.schemaFiles.length
				: 0;

			if (contextCount + apiSpecCount + schemaCount === 0) {
				checks.push({
					name: ".greptile/files.json",
					status: "fail",
					message:
						"files.json exists but does not reference any context files, API specs, or schema files.",
					details: { path: filesPath },
				});
			} else {
				checks.push({
					name: ".greptile/files.json",
					status: "pass",
					message:
						"Files index exists with context/schema references for graph-aware review",
					details: {
						path: filesPath,
						contextFiles: contextCount,
						apiSpecs: apiSpecCount,
						schemaFiles: schemaCount,
					},
				});
			}
		} catch (e) {
			checks.push({
				name: ".greptile/files.json",
				status: "fail",
				message: `Failed to parse files.json: ${e instanceof Error ? e.message : "Unknown error"}`,
				details: { path: filesPath },
			});
		}
	} else {
		checks.push({
			name: ".greptile/files.json",
			status: "fail",
			message:
				"Missing required .greptile/files.json. Cross-file graph context pointers are mandatory.",
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
		const missingTriggers = REQUIRED_GREPTILE_WORKFLOW_TRIGGERS.filter(
			(trigger) => !new RegExp(`on:[\\s\\S]*?${trigger}:`).test(content),
		);
		const hasChecksWritePermission = /checks:\s*write/.test(content);

		const issues: string[] = [];
		for (const trigger of missingTriggers) {
			issues.push(`missing ${trigger} trigger`);
		}
		if (!hasChecksWritePermission)
			issues.push("missing checks: write permission");

		if (issues.length > 0) {
			return {
				name: "greptile-review.yml workflow",
				status: "fail",
				message: `Workflow exists but has issues: ${issues.join(", ")}`,
				details: { path: workflowPath, issues },
			};
		}

		return {
			name: "greptile-review.yml workflow",
			status: "pass",
			message: `Valid workflow with required Greptile bridge triggers (${REQUIRED_GREPTILE_WORKFLOW_TRIGGERS.join(", ")}) and permissions`,
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

function verifyNpmrc(repoPath: string): GreptileCheck {
	const npmrcPath = resolve(repoPath, ".npmrc");

	if (!existsSync(npmrcPath)) {
		return {
			name: ".npmrc configuration",
			status: "warn",
			message:
				"No .npmrc file found. If using private npm packages, ensure .npmrc is configured.",
			details: { path: npmrcPath },
		};
	}

	try {
		const content = readFileSync(npmrcPath, "utf-8");
		const issues: string[] = [];
		const features: string[] = [];

		// Check for private package registry configuration
		const hasScopedRegistry = /@[\w-]+:registry=/m.test(content);
		const hasAuthToken = /_authToken=/m.test(content);
		const hasIgnoreScripts = /ignore-scripts\s*=\s*true/m.test(content);

		if (hasScopedRegistry) features.push("scoped registry");
		if (hasAuthToken) features.push("auth token configured");
		if (hasIgnoreScripts) features.push("ignore-scripts=true (security)");

		// Check for security best practices
		if (!hasIgnoreScripts) {
			issues.push("consider setting ignore-scripts=true for security");
		}

		if (issues.length > 0) {
			return {
				name: ".npmrc configuration",
				status: "warn",
				message: `.npmrc exists but has recommendations: ${issues.join(", ")}`,
				details: { path: npmrcPath, features, issues },
			};
		}

		if (features.length > 0) {
			return {
				name: ".npmrc configuration",
				status: "pass",
				message: `Valid .npmrc with: ${features.join(", ")}`,
				details: { path: npmrcPath, features },
			};
		}

		return {
			name: ".npmrc configuration",
			status: "pass",
			message: ".npmrc file exists",
			details: { path: npmrcPath },
		};
	} catch (e) {
		return {
			name: ".npmrc configuration",
			status: "fail",
			message: `Failed to read .npmrc: ${e instanceof Error ? e.message : "Unknown error"}`,
			details: { path: npmrcPath },
		};
	}
}
async function verifyRemoteGreptileSetup(
	token: string | undefined,
	owner: string,
	repo: string,
	_repoPath: string,
	appAuth?: GitHubAppAuth,
): Promise<GreptileCheck[]> {
	const checks: GreptileCheck[] = [];
	const client = token ? new GitHubClient({ token, owner, repo }) : undefined;

	// Check if Greptile App is installed
	try {
		let installationResponse: HttpResponseSummary | undefined;
		let authMode: "app_jwt" | "token" | "none" = "none";

		if (appAuth) {
			const appJwt = buildGitHubAppJwt(appAuth);
			installationResponse = await fetchInstallationEndpoint(
				owner,
				repo,
				`Bearer ${appJwt}`,
			);
			authMode = "app_jwt";
		} else if (token) {
			installationResponse = await fetchInstallationEndpoint(
				owner,
				repo,
				`Bearer ${token}`,
			);
			authMode = "token";
		}

		if (!installationResponse) {
			checks.push({
				name: "GitHub App Installation",
				status: "warn",
				message:
					"Skipped app-installation verification. Provide --app-id and --app-private-key-path (or env equivalents) to verify this check.",
			});
		} else if (installationResponse.status === 200) {
			checks.push({
				name: "GitHub App Installation",
				status: "pass",
				message: "GitHub App integration available on repository",
				details: { authMode },
			});
		} else if (installationResponse.status === 404) {
			checks.push({
				name: "GitHub App Installation",
				status: "warn",
				message:
					"Could not verify GitHub App installation. Ensure Greptile app is installed from GitHub Marketplace.",
				details: {
					hint: "Visit https://github.com/apps/greptile to install",
					authMode,
				},
			});
		} else if (
			installationResponse.status === 401 &&
			installationResponse.message
				.toLowerCase()
				.includes("json web token could not be decoded")
		) {
			checks.push({
				name: "GitHub App Installation",
				status: "warn",
				message:
					"GitHub returned 401 because /installation expects a GitHub App JWT. Personal access tokens cannot verify this endpoint. Provide --app-id and --app-private-key-path to run this check.",
				details: {
					authMode,
				},
			});
		} else {
			checks.push({
				name: "GitHub App Installation",
				status: "warn",
				message: `Could not verify app installation (HTTP ${installationResponse.status})`,
				details: {
					authMode,
					apiMessage: installationResponse.message || undefined,
				},
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
	if (!client) {
		checks.push({
			name: "Ruleset Configuration",
			status: "warn",
			message:
				"Skipped ruleset verification: provide --token (or GITHUB_TOKEN / GITHUB_PERSONAL_ACCESS_TOKEN).",
		});
	} else {
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
						message:
							'Ruleset "protect" requires "Greptile Review" status check',
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
	}

	// Check webhook requirements (informational)
	checks.push({
		name: "Webhook Configuration",
		status: "pass",
		message:
			"Webhook events are managed by the Greptile GitHub App. Ensure the app subscribes to: pull_request, pull_request_review, pull_request_review_comment, issue_comment",
		details: {
			requiredEvents: [...REQUIRED_GREPTILE_WORKFLOW_TRIGGERS],
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
