/**
 * Remediate CLI command
 *
 * Entry point for the remediation loop. Uses the finding normalizer
 * and orchestrator to process findings from CodeQL or Codex providers.
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { loadContract } from "../lib/contract/loader.js";
import type { RemediationPolicy } from "../lib/contract/types.js";
import {
	type CodeqlFindingInput,
	type CodexFindingInput,
	normalizeCodeqlFinding,
	normalizeCodexFinding,
} from "../lib/remediation/finding-normalizer.js";
import {
	type GitHubClient,
	RemediationOrchestrator,
} from "../lib/remediation/orchestrator.js";
import type {
	CanonicalFinding,
	RemediationOutcome,
} from "../lib/remediation/types.js";

export const EXIT_CODES = {
	SUCCESS: 0,
	USAGE: 2,
	POLICY: 3,
	PARTIAL: 4,
	INTERNAL: 10,
} as const;

export interface RemediateOptions {
	/** JSON file path for findings, or "-" for stdin */
	findings?: string;
	/** Run in dry-run mode (no actual changes) */
	dryRun?: boolean;
	/** Output as JSON */
	json?: boolean;
	/** Path to contract file */
	contractPath?: string;
	/** HEAD SHA (defaults to current git HEAD) */
	headSha?: string;
}

export interface RemediateResult {
	outcome: RemediationOutcome;
	exitCode: number;
}

/**
 * Default remediation policy when no contract is available.
 */
const DEFAULT_REMEDIATION_POLICY: RemediationPolicy = {
	providerDefaults: {
		codeql: { autoApplyMaxTier: "medium", dryRunOnlyByDefault: false },
		codex: { autoApplyMaxTier: "low", dryRunOnlyByDefault: true },
	},
	marker: "<!-- harness-remediation -->",
	timeoutMinutes: 5,
	retryLimit: 3,
	requireEvidence: false,
};

/**
 * Get current HEAD SHA from git.
 */
function getHeadSha(): string {
	const result = spawnSync("git", ["rev-parse", "HEAD"], {
		encoding: "utf-8",
		timeout: 5000,
	});

	if (result.error || result.status !== 0) {
		throw new Error(
			`Failed to get HEAD SHA: ${result.error?.message ?? result.stderr}`,
		);
	}

	return result.stdout.trim();
}

/**
 * Parse findings from JSON input.
 * Accepts either a single finding or an array of findings.
 */
function parseFindings(input: string): unknown[] {
	let data: unknown;
	try {
		data = JSON.parse(input);
	} catch (e) {
		throw new Error(
			`Failed to parse JSON: ${e instanceof Error ? e.message : "unknown error"}`,
		);
	}

	// Accept single finding or array
	if (Array.isArray(data)) {
		return data;
	}
	return [data];
}

/**
 * Detect provider type from finding structure.
 */
function detectProvider(finding: unknown): "codeql" | "codex" | null {
	if (typeof finding !== "object" || finding === null) {
		return null;
	}

	const f = finding as Record<string, unknown>;

	// CodeQL has nested rule and location objects
	if (
		typeof f.location === "object" &&
		f.location !== null &&
		"startLine" in f.location
	) {
		return "codeql";
	}

	// Codex has flat structure with filePath and line
	if (typeof f.filePath === "string" && typeof f.line === "number") {
		return "codex";
	}

	return null;
}

/**
 * Normalize a raw finding to canonical format.
 */
function normalizeFinding(
	raw: unknown,
	repoRoot: string,
): { ok: true; finding: CanonicalFinding } | { ok: false; error: string } {
	const provider = detectProvider(raw);

	if (provider === "codeql") {
		const result = normalizeCodeqlFinding(raw as CodeqlFindingInput, repoRoot);
		if (result.ok) {
			return { ok: true, finding: result.finding };
		}
		return {
			ok: false,
			error: result.error.message,
		};
	}

	if (provider === "codex") {
		const result = normalizeCodexFinding(raw as CodexFindingInput, repoRoot);
		if (result.ok) {
			return { ok: true, finding: result.finding };
		}
		return {
			ok: false,
			error: result.error.message,
		};
	}

	return { ok: false, error: "Unable to detect provider type" };
}

/**
 * Create a mock GitHub client for CLI usage.
 * In production, this would use the actual GitHub API.
 */
function createGitHubClient(): GitHubClient {
	return {
		async getHeadSha() {
			return getHeadSha();
		},
		async isAncestor(ancestorSha: string, descendantSha: string) {
			const result = spawnSync(
				"git",
				["merge-base", "--is-ancestor", ancestorSha, descendantSha],
				{
					encoding: "utf-8",
					timeout: 5000,
				},
			);
			return result.status === 0;
		},
	};
}

/**
 * Run remediation workflow.
 */
export async function runRemediate(
	options: RemediateOptions,
): Promise<RemediateResult> {
	// 1. Get HEAD SHA
	let headSha: string;
	try {
		headSha = options.headSha ?? getHeadSha();
	} catch (e) {
		return {
			outcome: {
				ok: false,
				error: {
					code: "E_INTERNAL",
					message: `Failed to get HEAD SHA: ${e instanceof Error ? e.message : String(e)}`,
				},
			},
			exitCode: EXIT_CODES.INTERNAL,
		};
	}

	// 2. Load contract for policy (use defaults if not available)
	let policy = DEFAULT_REMEDIATION_POLICY;
	if (options.contractPath) {
		try {
			loadContract(options.contractPath);
			// If contract has remediation policy, use it
			// For now, use defaults as RemediationPolicy is not in HarnessContract
			policy = DEFAULT_REMEDIATION_POLICY;
		} catch {
			// Use defaults if contract load fails
		}
	}

	// 3. Parse findings from input
	let rawInput: string;
	try {
		if (options.findings === "-" || !options.findings) {
			// Read from stdin
			rawInput = readFileSync(0, "utf-8");
		} else {
			rawInput = readFileSync(options.findings, "utf-8");
		}
	} catch (e) {
		return {
			outcome: {
				ok: false,
				error: {
					code: "E_VALIDATION",
					message: `Failed to read findings: ${e instanceof Error ? e.message : String(e)}`,
				},
			},
			exitCode: EXIT_CODES.USAGE,
		};
	}

	// 4. Parse and normalize findings
	let rawFindings: unknown[];
	try {
		rawFindings = parseFindings(rawInput);
	} catch (e) {
		return {
			outcome: {
				ok: false,
				error: {
					code: "E_VALIDATION",
					message: e instanceof Error ? e.message : String(e),
				},
			},
			exitCode: EXIT_CODES.USAGE,
		};
	}

	const repoRoot = process.cwd();
	const findings: CanonicalFinding[] = [];
	const parseErrors: Array<{ index: number; error: string }> = [];

	for (let i = 0; i < rawFindings.length; i++) {
		const result = normalizeFinding(rawFindings[i], repoRoot);
		if (result.ok) {
			findings.push(result.finding);
		} else {
			parseErrors.push({ index: i, error: result.error });
		}
	}

	// If all findings failed to parse, return usage error
	if (findings.length === 0 && parseErrors.length > 0) {
		return {
			outcome: {
				ok: false,
				error: {
					code: "E_VALIDATION",
					message: `All findings failed to parse. First error: ${parseErrors[0]?.error}`,
					context: { parseErrors },
				},
			},
			exitCode: EXIT_CODES.USAGE,
		};
	}

	// 5. Create orchestrator with policy
	const githubClient = createGitHubClient();
	const orchestrator = new RemediationOrchestrator(
		{
			policy,
			findings,
			dryRun: options.dryRun ?? false,
			headSha,
		},
		githubClient,
	);

	// 6. Run remediation
	let outcome: RemediationOutcome;
	try {
		outcome = await orchestrator.remediate();
	} catch (e) {
		return {
			outcome: {
				ok: false,
				error: {
					code: "E_INTERNAL",
					message: `Remediation failed: ${e instanceof Error ? e.message : String(e)}`,
				},
			},
			exitCode: EXIT_CODES.INTERNAL,
		};
	}

	// 7. Determine exit code
	let exitCode: number;
	if (!outcome.ok) {
		if (outcome.error.code === "E_RACE_DETECTED") {
			exitCode = EXIT_CODES.POLICY;
		} else if (outcome.error.code === "E_POLICY") {
			exitCode = EXIT_CODES.POLICY;
		} else {
			exitCode = EXIT_CODES.INTERNAL;
		}
	} else if (outcome.output.actions.length < findings.length) {
		// Some findings were skipped
		exitCode = EXIT_CODES.PARTIAL;
	} else {
		exitCode = EXIT_CODES.SUCCESS;
	}

	return { outcome, exitCode };
}

/**
 * CLI entry point for remediate command.
 */
export async function runRemediateCLI(
	options: RemediateOptions,
): Promise<number> {
	const { outcome, exitCode } = await runRemediate(options);

	if (options.json) {
		console.info(JSON.stringify(outcome, null, 2));
	} else {
		if (outcome.ok) {
			const { output } = outcome;
			console.info("Remediation complete:");
			console.info(`  Findings processed: ${output.findingsProcessed}`);
			console.info(`  Actions taken: ${output.actions.length}`);
			console.info(`  Skipped: ${output.skipped.length}`);

			if (output.actions.length > 0) {
				console.info("\nActions:");
				for (const action of output.actions) {
					const dryRunLabel = action.dryRun ? " (dry-run)" : "";
					console.info(
						`  - ${action.type}${dryRunLabel}: ${action.findingId} - ${action.reason}`,
					);
				}
			}

			if (output.skipped.length > 0) {
				console.info("\nSkipped:");
				for (const skip of output.skipped) {
					console.info(`  - ${skip.findingId}: ${skip.reason}`);
				}
			}

			if (output.telemetry) {
				console.info("\nTelemetry:");
				console.info(`  API calls: ${output.telemetry.apiCalls}`);
				console.info(`  Cache hits: ${output.telemetry.cacheHits}`);
			}
		} else {
			console.error(`Remediation failed: ${outcome.error.message}`);
			if (outcome.error.code === "E_RACE_DETECTED") {
				console.error("  A concurrent change was detected. Please retry.");
			}
			if (outcome.error.context) {
				console.error(`  Context: ${JSON.stringify(outcome.error.context)}`);
			}
		}
	}

	return exitCode;
}
