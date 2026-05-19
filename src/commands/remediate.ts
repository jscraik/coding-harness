/**
 * Remediate CLI command
 *
 * Entry point for the remediation loop. Uses the finding normalizer
 * and orchestrator to process findings from CodeQL or Codex providers.
 */

import { spawnSync } from "node:child_process";
import {
	emitTerminalRunRecord,
	hashRunRecordValue,
} from "../lib/contract/run-record-emitter.js";
import type {
	ExitClassification,
	RunOutcome,
} from "../lib/contract/run-records.js";
import { DEFAULT_REMEDIATION_POLICY } from "../lib/contract/types.js";
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
import { applyRemediationTransactions } from "./remediate-apply-transactions.js";
import { renderRemediationOutput } from "./remediate-cli-output.js";
import {
	determineRemediateExitCode,
	EXIT_CODES,
	readFindingsInput,
	resolveEffectiveMode,
	resolveValidatedFindingsPath,
	validateApplyWorkspace,
} from "./remediate-runner-helpers.js";

export { EXIT_CODES };

/**
 * CLI options for `harness remediate`.
 */
export interface RemediateOptions {
	/** Execution subcommand: "run" (plan only) or "apply" (execute) */
	subcommand?: "run" | "apply";
	/** Behavioral mode: "manual" (default) or "autonomous" */
	mode?: "manual" | "autonomous";
	/** Repository owner */
	owner?: string;
	/** Repository name */
	repo?: string;
	/** PR number */
	prNumber?: number;
	/** Provider: "codeql" or "codex" */
	provider?: "codeql" | "codex";
	/** Maximum severity tier for auto-apply */
	maxAutoTier?: "high" | "medium" | "low";
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
	/** Skip interactive prompts */
	noInput?: boolean;
	/** Force execution in apply mode */
	force?: boolean;
	/** Override rollback mode (manual/autonomous) */
	/** Path to completion marker file */
	completionMarkerPath?: string;
	/** Optional override for canonical run-record base dir */
	runRecordsDir?: string;
}

/**
 * Result envelope returned by remediation execution.
 */
export interface RemediateResult {
	outcome: RemediationOutcome;
	exitCode: number;
}

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

function isDisposableWorkspace(): boolean {
	if (process.env.HARNESS_DISPOSABLE_WORKSPACE === "true") {
		return true;
	}
	const gitDirResult = spawnSync("git", ["rev-parse", "--git-dir"], {
		encoding: "utf-8",
		timeout: 5000,
	});

	if (gitDirResult.status !== 0 || !gitDirResult.stdout) {
		return false;
	}

	const gitDir = gitDirResult.stdout.trim();
	return gitDir.split(/[\\/]/).includes("worktrees");
}

function getWorkspaceStatus():
	| {
			ok: true;
			clean: boolean;
	  }
	| {
			ok: false;
			reason: string;
	  } {
	const result = spawnSync("git", ["status", "--porcelain"], {
		encoding: "utf-8",
		timeout: 5000,
	});

	if (result.error || result.status !== 0) {
		return {
			ok: false,
			reason: result.error?.message ?? result.stderr ?? "git status failed",
		};
	}

	return {
		ok: true,
		clean: result.stdout.trim().length === 0,
	};
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
 * Determine the source provider for a raw finding object.
 *
 * Recognizes CodeQL findings when the object contains a nested `location` with a `startLine`,
 * and recognizes Codex findings when the object contains a `filePath` string and a `line` number.
 *
 * @param finding - Raw finding value to inspect; may be any JSON-decoded value.
 * @returns `"codeql"` if the value appears to be a CodeQL finding, `"codex"` if it appears to be a Codex finding, or `null` if the provider cannot be determined.
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
 * Convert a raw finding input into a canonical finding representation.
 *
 * Detects the finding format (e.g., CodeQL or Codex shapes) and produces a
 * normalized CanonicalFinding suitable for downstream remediation. If the input
 * cannot be associated with a supported provider or normalization fails, an
 * error message is returned explaining the failure.
 *
 * @param raw - The provider-specific finding payload to normalize.
 * @param repoRoot - Repository root path used to resolve or normalize file paths.
 * @returns `{ ok: true, finding }` with the normalized `CanonicalFinding`, or
 * `{ ok: false, error }` where `error` is a human-readable reason for detection
 * or normalization failure.
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
 * Create a GitHubClient that performs SHA operations against the local git repository.
 *
 * @returns A GitHubClient that obtains the repository HEAD SHA and verifies commit ancestry using the local repository (avoids external GitHub API calls).
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
 * Build the list of artifacts to include in a remediation run record.
 */
function buildRemediationArtifacts(
	options: RemediateOptions,
	result: RemediateResult,
): Array<{ type: string; path: string; checksum?: string }> {
	const artifacts: Array<{ type: string; path: string; checksum?: string }> =
		[];
	if (options.findings && options.findings !== "-") {
		artifacts.push({ type: "findings-input", path: options.findings });
	}
	if (result.outcome.ok && result.outcome.output.transactions) {
		for (const transaction of result.outcome.output.transactions) {
			artifacts.push({
				type: "remediation-transaction",
				path: transaction.artifactUri,
				checksum: transaction.artifactChecksum,
			});
		}
	}
	return artifacts;
}

/**
 * Determine the run-record outcome and classification for a remediation result.
 */
function classifyRemediationResult(result: RemediateResult): {
	outcome: RunOutcome;
	classification: ExitClassification;
} {
	const outcome: RunOutcome = !result.outcome.ok
		? "failed"
		: result.exitCode === EXIT_CODES.PARTIAL
			? "hold"
			: "success";
	const classification: ExitClassification = !result.outcome.ok
		? result.outcome.error.code === "E_POLICY"
			? "policy_blocked"
			: result.outcome.error.code === "E_ROLLBACK_MODE"
				? "precondition_failed"
				: result.outcome.error.code === "E_RACE_DETECTED"
					? "manual_intervention_required"
					: result.outcome.error.code === "E_VALIDATION" ||
							result.outcome.error.code === "E_CONTRACT"
						? "validation_failed"
						: "runtime_failed"
		: result.exitCode === EXIT_CODES.PARTIAL
			? "manual_intervention_required"
			: "ok";
	return { outcome, classification };
}

type RemediateFinalize = (
	result: RemediateResult,
	payload: Record<string, unknown>,
	options?: { emitRunRecord?: boolean },
) => RemediateResult;

function createRemediateFinalizer(
	options: RemediateOptions,
	startedAt: string,
): RemediateFinalize {
	return (result, payload, finalizeOptions) => {
		if (finalizeOptions?.emitRunRecord === false) {
			return result;
		}
		try {
			const { outcome, classification } = classifyRemediationResult(result);
			const artifacts = buildRemediationArtifacts(options, result);
			emitTerminalRunRecord({
				command: "remediate",
				startedAt,
				outcome,
				classification,
				exitCode: result.exitCode,
				...(options.runRecordsDir ? { baseDir: options.runRecordsDir } : {}),
				contract: { path: options.contractPath ?? "harness.contract.json" },
				policyContext: {
					mode: options.subcommand ?? "run",
					safetyPosture: "strict",
					effectivePolicySource: "remediation-policy",
					hash: hashRunRecordValue({
						policy: "remediation-policy",
						defaultRemediationPolicy: DEFAULT_REMEDIATION_POLICY,
						mode: options.subcommand ?? "run",
						dryRun: options.dryRun ?? false,
						force: options.force ?? false,
					}),
				},
				preconditions: {
					dryRun: options.dryRun ?? false,
					force: options.force ?? false,
				},
				artifacts,
				event: {
					eventType: "decision",
					status:
						classification === "ok"
							? "completed"
							: classification === "policy_blocked" ||
									classification === "precondition_failed" ||
									classification === "manual_intervention_required"
								? "blocked"
								: "failed",
					severity:
						classification === "ok"
							? "info"
							: classification === "manual_intervention_required"
								? "warn"
								: "error",
					payload,
				},
			});
		} catch (error) {
			const runRecordError =
				error instanceof Error ? error.message : String(error);
			if (result.outcome.ok) {
				return {
					outcome: {
						ok: false,
						error: {
							code: "E_INTERNAL",
							message: `Failed to emit canonical run record: ${runRecordError}`,
						},
					},
					exitCode: EXIT_CODES.INTERNAL,
				};
			}
			return {
				outcome: {
					ok: false,
					error: {
						...result.outcome.error,
						context: {
							...(result.outcome.error.context ?? {}),
							runRecordError,
						},
					},
				},
				exitCode: result.exitCode,
			};
		}
		return result;
	};
}

function resolveHeadSha(
	options: RemediateOptions,
	finalize: RemediateFinalize,
): { ok: true; headSha: string } | { ok: false; result: RemediateResult } {
	try {
		return { ok: true, headSha: options.headSha ?? getHeadSha() };
	} catch (error) {
		return {
			ok: false,
			result: finalize(
				{
					outcome: {
						ok: false,
						error: {
							code: "E_INTERNAL",
							message: `Failed to get HEAD SHA: ${
								error instanceof Error ? error.message : String(error)
							}`,
						},
					},
					exitCode: EXIT_CODES.INTERNAL,
				},
				{ stage: "head_sha", error: "failed_to_get_head_sha" },
			),
		};
	}
}

function normalizeFindingsOrFail(
	rawInput: string,
	repoRoot: string,
	finalize: RemediateFinalize,
):
	| { ok: true; findings: CanonicalFinding[] }
	| { ok: false; result: RemediateResult } {
	let rawFindings: unknown[];
	try {
		rawFindings = parseFindings(rawInput);
	} catch (error) {
		return {
			ok: false,
			result: finalize(
				{
					outcome: {
						ok: false,
						error: {
							code: "E_VALIDATION",
							message: error instanceof Error ? error.message : String(error),
						},
					},
					exitCode: EXIT_CODES.USAGE,
				},
				{ stage: "parse_findings", error: "failed_to_parse_findings" },
			),
		};
	}

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

	if (findings.length === 0 && parseErrors.length > 0) {
		return {
			ok: false,
			result: finalize(
				{
					outcome: {
						ok: false,
						error: {
							code: "E_VALIDATION",
							message: `All findings failed to parse. First error: ${parseErrors[0]?.error}`,
							context: { parseErrors },
						},
					},
					exitCode: EXIT_CODES.USAGE,
				},
				{
					stage: "normalize_findings",
					error: "all_findings_invalid",
					parseErrorCount: parseErrors.length,
				},
			),
		};
	}
	return { ok: true, findings };
}

/**
 * Run remediation workflow.
 */
export async function runRemediate(
	options: RemediateOptions,
): Promise<RemediateResult> {
	const startedAt = new Date().toISOString();
	const finalize = createRemediateFinalizer(options, startedAt);
	const headShaResult = resolveHeadSha(options, finalize);
	if (!headShaResult.ok) {
		return headShaResult.result;
	}
	const validatedPathResult = resolveValidatedFindingsPath(options, finalize);
	if (!validatedPathResult.ok) {
		return validatedPathResult.result;
	}
	const policy = DEFAULT_REMEDIATION_POLICY;
	const modeResult = resolveEffectiveMode(options, finalize);
	if (!modeResult.ok) {
		return modeResult.result;
	}
	const effectiveMode = modeResult.effectiveMode;
	const applyWorkspaceError = validateApplyWorkspace(
		options.subcommand ?? "run",
		effectiveMode,
		isDisposableWorkspace,
		getWorkspaceStatus,
		finalize,
	);
	if (applyWorkspaceError) {
		return applyWorkspaceError;
	}
	const rawInputResult = readFindingsInput(
		options,
		validatedPathResult.path,
		finalize,
	);
	if (!rawInputResult.ok) {
		return rawInputResult.result;
	}
	const repoRoot = process.cwd();
	const normalizedFindingsResult = normalizeFindingsOrFail(
		rawInputResult.rawInput,
		repoRoot,
		finalize,
	);
	if (!normalizedFindingsResult.ok) {
		return normalizedFindingsResult.result;
	}
	const findings = normalizedFindingsResult.findings;

	const githubClient = createGitHubClient();
	const orchestrator = new RemediationOrchestrator(
		{
			policy,
			findings,
			dryRun: options.dryRun ?? false,
			headSha: headShaResult.headSha,
		},
		githubClient,
	);

	let outcome: RemediationOutcome;
	try {
		outcome = await orchestrator.remediate();
	} catch (error) {
		return finalize(
			{
				outcome: {
					ok: false,
					error: {
						code: "E_INTERNAL",
						message: `Remediation failed: ${
							error instanceof Error ? error.message : String(error)
						}`,
					},
				},
				exitCode: EXIT_CODES.INTERNAL,
			},
			{
				stage: "orchestrator",
				error: "remediation_failed",
			},
		);
	}

	if (outcome.ok && options.subcommand === "apply") {
		applyRemediationTransactions(outcome, findings, repoRoot, getHeadSha);
	}
	const exitCode = determineRemediateExitCode(outcome, findings);

	return finalize(
		{ outcome, exitCode },
		{
			stage: "complete",
			outcome: outcome.ok ? "ok" : "error",
			findingsProcessed: findings.length,
			effectiveMode,
		},
	);
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
		renderRemediationOutput(outcome);
	}

	return exitCode;
}
