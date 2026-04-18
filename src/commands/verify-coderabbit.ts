/**
 * Verify CodeRabbit setup command
 *
 * Verifies that CodeRabbit is properly configured for a repository:
 * - .coderabbit.yaml config exists and has required sections
 * - CodeRabbit check has run on the default branch
 * - Ruleset requires "CodeRabbit" status check
 * - .npmrc security posture
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

export interface VerifyCodeRabbitOptions {
	token?: string;
	owner?: string;
	repo?: string;
	repoPath?: string;
	json?: boolean;
	verbose?: boolean;
}

export interface CodeRabbitVerificationResult {
	ok: boolean;
	checks: CodeRabbitCheck[];
	summary: {
		passed: number;
		failed: number;
		warnings: number;
	};
}

export interface CodeRabbitCheck {
	name: string;
	status: "pass" | "fail" | "warn";
	message: string;
	details?: Record<string, unknown>;
}

const CODERABBIT_CHECK_NAME = "CodeRabbit";
const CODERABBIT_CONFIG_FILE = ".coderabbit.yaml";

/**
 * Normalize a potential token string into a trimmed token or `undefined`.
 *
 * Trims surrounding whitespace and treats empty strings or the literals `"undefined"` and `"null"` (case-insensitive) as absent.
 *
 * @param value - The raw token value (e.g., from an environment variable or CLI option)
 * @returns The trimmed token string, or `undefined` when the input is missing, empty, or equals `"undefined"`/`"null"` (case-insensitive)
 */
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

/**
 * Validate the repository's .coderabbit.yaml and report any missing or misconfigured settings.
 *
 * Inspects the resolved .coderabbit.yaml for a top-level `reviews:` section, the `commit_status` boolean,
 * and whether `auto_review` is disabled. The returned check indicates whether the configuration is valid,
 * contains warnings, or is missing critical elements.
 *
 * @param repoPath - Path to the repository root where `.coderabbit.yaml` will be read.
 * @returns A `CodeRabbitCheck` describing the outcome. `details.path` is always included; when applicable,
 * `details.issues` lists human-readable problems and `details.features` lists detected positive settings.
 */
function verifyCodeRabbitConfig(repoPath: string): CodeRabbitCheck {
	const configPath = resolve(repoPath, CODERABBIT_CONFIG_FILE);

	if (!existsSync(configPath)) {
		return {
			name: `${CODERABBIT_CONFIG_FILE} config`,
			status: "fail",
			message: `${CODERABBIT_CONFIG_FILE} not found. Run \`harness init\` to scaffold a baseline configuration.`,
			details: { path: configPath },
		};
	}

	try {
		const content = readFileSync(configPath, "utf-8");
		const issues: string[] = [];
		const features: string[] = [];

		// Required: reviews section
		if (!/^reviews:/m.test(content)) {
			issues.push("missing top-level 'reviews:' section");
		} else {
			features.push("reviews section present");
		}

		// Required: commit_status should be true for branch protection to work.
		// Anchor the key so fail_commit_status does not trigger a false warning.
		if (/^\s*commit_status:\s*false\b/m.test(content)) {
			issues.push(
				"'commit_status: false' disables the CodeRabbit check — branch protection will not work",
			);
		} else if (/^\s*commit_status:\s*true\b/m.test(content)) {
			features.push("commit_status enabled");
		}

		// Warn if auto_review is disabled
		if (/auto_review:\s*\n\s+enabled:\s*false/m.test(content)) {
			issues.push(
				"auto_review is disabled — CodeRabbit will not review PRs automatically",
			);
		}

		if (issues.length > 0) {
			return {
				name: `${CODERABBIT_CONFIG_FILE} config`,
				status: issues.some((i) => i.includes("missing")) ? "fail" : "warn",
				message: `${CODERABBIT_CONFIG_FILE} has issues: ${issues.join(", ")}`,
				details: { path: configPath, issues, features },
			};
		}

		return {
			name: `${CODERABBIT_CONFIG_FILE} config`,
			status: "pass",
			message: `Valid ${CODERABBIT_CONFIG_FILE}: ${features.join(", ")}`,
			details: { path: configPath, features },
		};
	} catch (e) {
		return {
			name: `${CODERABBIT_CONFIG_FILE} config`,
			status: "fail",
			message: `Failed to read ${CODERABBIT_CONFIG_FILE}: ${e instanceof Error ? e.message : "Unknown error"}`,
			details: { path: configPath },
		};
	}
}

/**
 * Inspect the repository's .npmrc for security-relevant settings.
 *
 * Checks for presence of the file, scoped registry entries, an embedded `_authToken`, and whether `ignore-scripts=true` is set; provides recommendations when insecure or missing settings are found.
 *
 * @param repoPath - Filesystem path to the repository root where `.npmrc` should be inspected
 * @returns A `CodeRabbitCheck` describing the outcome: `status` is `"pass"` when `.npmrc` exists and no recommendations are needed (features included when present), `"warn"` when the file is missing or contains recommendations (for example missing `ignore-scripts=true` or presence of `_authToken`), and `"fail"` if the file cannot be read (message includes the read error)
 */
function verifyNpmrc(repoPath: string): CodeRabbitCheck {
	const npmrcPath = resolve(repoPath, ".npmrc");

	if (!existsSync(npmrcPath)) {
		return {
			name: ".npmrc configuration",
			status: "warn",
			message:
				"No .npmrc file found. Run 'harness init' to scaffold a baseline .npmrc with security defaults (ignore-scripts=true).",
			details: { path: npmrcPath },
		};
	}

	try {
		const content = readFileSync(npmrcPath, "utf-8");
		const issues: string[] = [];
		const features: string[] = [];
		const activeLines = content
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(
				(line) =>
					line.length > 0 && !line.startsWith("#") && !line.startsWith(";"),
			);

		const hasBrainwavScopedRegistry = activeLines.some((line) =>
			/^@brainwav:registry\s*=\s*https:\/\/registry\.npmjs\.org\/?$/i.test(
				line,
			),
		);
		const hasAuthToken = activeLines.some((line) =>
			/_authToken\s*=/.test(line),
		);
		const hasIgnoreScripts = activeLines.some((line) =>
			/^ignore-scripts\s*=\s*true$/i.test(line),
		);

		if (hasBrainwavScopedRegistry) features.push("@brainwav scoped registry");
		if (hasIgnoreScripts) features.push("ignore-scripts=true (security)");

		if (!hasBrainwavScopedRegistry) {
			issues.push(
				"add @brainwav:registry=https://registry.npmjs.org/ for scope routing",
			);
		}
		if (!hasIgnoreScripts) {
			issues.push("consider setting ignore-scripts=true for security");
		}
		if (hasAuthToken) {
			issues.push(
				"move auth token config to user-level ~/.npmrc or CI-injected ~/.npmrc instead of repo .npmrc",
			);
		}

		if (issues.length > 0) {
			// Fail if scoped registry is missing or auth token is present
			const hasCriticalIssue = !hasBrainwavScopedRegistry || hasAuthToken;
			return {
				name: ".npmrc configuration",
				status: hasCriticalIssue ? "fail" : "warn",
				message: `.npmrc exists but has ${hasCriticalIssue ? "critical issues" : "recommendations"}: ${issues.join(", ")}`,
				details: { path: npmrcPath, features, issues },
			};
		}

		return {
			name: ".npmrc configuration",
			status: "pass",
			message: `Valid .npmrc${features.length > 0 ? ` with: ${features.join(", ")}` : ""}`,
			details: { path: npmrcPath, features },
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

/**
 * Verify GitHub-side CodeRabbit configuration for the given repository.
 *
 * Performs two remote checks: whether a CodeRabbit check run exists on the repository's default branch,
 * and whether a branch-protection ruleset named "protect" (targeting branches) requires the `CodeRabbit` status check.
 *
 * @param token - GitHub authentication token; when absent, the function returns two `warn` checks indicating remote verification was skipped.
 * @param owner - Repository owner (GitHub organization or user).
 * @param repo - Repository name.
 * @returns An array of `CodeRabbitCheck` entries describing the outcome of each remote verification step. Each check has `name`, `status` (`pass`/`warn`/`fail`), a human-readable `message`, and optional `details`. Errors encountered while querying GitHub are surfaced as `warn` checks with a sanitized error message.
 */
async function verifyRemoteCodeRabbitSetup(
	token: string | undefined,
	owner: string,
	repo: string,
): Promise<CodeRabbitCheck[]> {
	const checks: CodeRabbitCheck[] = [];

	if (!token) {
		checks.push({
			name: "CodeRabbit check run presence",
			status: "warn",
			message:
				"Skipped check run verification: provide --token (or GITHUB_TOKEN / GITHUB_PERSONAL_ACCESS_TOKEN).",
		});
		checks.push({
			name: "Ruleset Configuration",
			status: "warn",
			message:
				"Skipped ruleset verification: provide --token (or GITHUB_TOKEN / GITHUB_PERSONAL_ACCESS_TOKEN).",
		});
		return checks;
	}

	const client = new GitHubClient({ token, owner, repo });

	// Check that CodeRabbit has run on the default branch
	try {
		const defaultBranch = await client.getDefaultBranch();
		const checkRuns = await client.listCheckRunsForRef(
			`refs/heads/${defaultBranch}`,
		);
		const codeRabbitRuns = checkRuns.filter(
			(run) => run.name === CODERABBIT_CHECK_NAME,
		);

		if (codeRabbitRuns.length === 0) {
			checks.push({
				name: "CodeRabbit check run presence",
				status: "warn",
				message: `No "${CODERABBIT_CHECK_NAME}" check run found on ${defaultBranch}. CodeRabbit may not be installed or has not reviewed a PR yet.`,
				details: {
					hint: "Install the CodeRabbit GitHub App from https://github.com/marketplace/coderabbitai",
					branch: defaultBranch,
				},
			});
		} else {
			// biome-ignore lint/style/noNonNullAssertion: length checked above
			const latest = codeRabbitRuns[0]!;
			checks.push({
				name: "CodeRabbit check run presence",
				status: "pass",
				message: `CodeRabbit check found on ${defaultBranch} (status: ${latest.status}, conclusion: ${latest.conclusion ?? "pending"})`,
				details: { branch: defaultBranch, checkRunId: latest.id },
			});
		}
	} catch (e) {
		checks.push({
			name: "CodeRabbit check run presence",
			status: "warn",
			message: `Failed to verify check runs: ${sanitizeError(e)}`,
		});
	}

	// Check ruleset requires "CodeRabbit" status check
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

			const hasCodeRabbit = requiredChecks.some(
				(c) => c.context === CODERABBIT_CHECK_NAME,
			);

			if (hasCodeRabbit) {
				checks.push({
					name: "Ruleset Configuration",
					status: "pass",
					message: `Ruleset "protect" requires "${CODERABBIT_CHECK_NAME}" status check`,
					details: { rulesetId: protectRuleset.id },
				});
			} else {
				checks.push({
					name: "Ruleset Configuration",
					status: "fail",
					message: `Ruleset "protect" does not require "${CODERABBIT_CHECK_NAME}" status check. Run \`harness branch-protect\` to update.`,
					details: {
						rulesetId: protectRuleset.id,
						currentChecks: requiredChecks.map((c) => c.context),
						hint: "Add CodeRabbit to required checks: harness branch-protect --add-check CodeRabbit",
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

	return checks;
}

/**
 * Verify a repository's CodeRabbit setup by running local and optional GitHub checks and summarizing results.
 *
 * Runs local validations against the repository at `options.repoPath` (or current working directory) and,
 * when `options.owner` and `options.repo` are provided, performs GitHub checks using a token (from `options.token`
 * or common environment variables). If `owner`/`repo` are not supplied the function records a warning that remote
 * checks were skipped. Tokens are normalized (trimmed and treated as missing for empty/"null"/"undefined" values).
 *
 * @param options - Configuration for which repository to check, credentials to use, and output preferences.
 *   Only non-obvious behavior: `repoPath` defaults to `process.cwd()`; `token` falls back to `GITHUB_TOKEN`
 *   or `GITHUB_PERSONAL_ACCESS_TOKEN` environment variables if not provided.
 * @returns An object containing:
 *   - `ok`: `true` when no checks have status `"fail"`, `false` otherwise.
 *   - `checks`: an array of per-check results (`name`, `status`, `message`, and optional `details`).
 *   - `summary`: counts of `passed`, `failed`, and `warnings`.
 */
export async function runVerifyCodeRabbit(
	options: VerifyCodeRabbitOptions,
): Promise<CodeRabbitVerificationResult> {
	const repoPath = options.repoPath ?? process.cwd();

	const localChecks: CodeRabbitCheck[] = [
		verifyCodeRabbitConfig(repoPath),
		verifyNpmrc(repoPath),
	];

	const token =
		normalizeToken(options.token) ??
		normalizeToken(process.env.GITHUB_TOKEN) ??
		normalizeToken(process.env.GITHUB_PERSONAL_ACCESS_TOKEN);

	const remoteChecks =
		options.owner && options.repo
			? await verifyRemoteCodeRabbitSetup(token, options.owner, options.repo)
			: [
					{
						name: "Remote checks",
						status: "warn" as const,
						message:
							"Skipped remote checks: provide --owner and --repo to verify GitHub integration.",
					},
				];

	const allChecks = [...localChecks, ...remoteChecks];
	const summary = {
		passed: allChecks.filter((c) => c.status === "pass").length,
		failed: allChecks.filter((c) => c.status === "fail").length,
		warnings: allChecks.filter((c) => c.status === "warn").length,
	};

	return {
		ok: summary.failed === 0,
		checks: allChecks,
		summary,
	};
}

/**
 * Run the CodeRabbit setup verification and print either a formatted console report or JSON.
 *
 * Prints check results to stdout; when `options.json` is true the function emits the full
 * verification result as JSON, otherwise it prints a colored, icon-prefixed summary.
 * When `options.verbose` is true, per-check `details` (if present) are included in the human-readable output.
 *
 * @param options - Controls verification and output. Relevant fields:
 *   - `token`, `owner`, `repo`: enable remote GitHub checks when provided
 *   - `repoPath`: local repository path to inspect
 *   - `json`: if true, output is JSON instead of a formatted console report
 *   - `verbose`: if true, include per-check `details` in the human-readable report
 * @returns `EXIT_CODES.SUCCESS` when all checks passed, `EXIT_CODES.VALIDATION_ERROR` when one or more checks failed.
 */
export async function runVerifyCodeRabbitCLI(
	options: VerifyCodeRabbitOptions,
): Promise<number> {
	const result = await runVerifyCodeRabbit(options);

	if (options.json) {
		console.info(JSON.stringify(result, null, 2));
	} else {
		console.info("\n🐰 CodeRabbit Setup Verification\n");
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