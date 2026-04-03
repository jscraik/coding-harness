/**
 * Remediate CLI command
 *
 * Entry point for the remediation loop. Uses the finding normalizer
 * and orchestrator to process findings from CodeQL or Codex providers.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { loadContract } from "../lib/contract/loader.js";
import {
	emitTerminalRunRecord,
	hashRunRecordValue,
} from "../lib/contract/run-record-emitter.js";
import {
	DEFAULT_PILOT_ROLLBACK_POLICY,
	DEFAULT_REMEDIATION_POLICY,
} from "../lib/contract/types.js";
import { validatePath } from "../lib/input/validator.js";
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
	RemediationTransaction,
} from "../lib/remediation/types.js";

export const EXIT_CODES = {
	SUCCESS: 0,
	USAGE: 2,
	POLICY: 3,
	PARTIAL: 4,
	INTERNAL: 10,
} as const;

export interface RemediateOptions {
	/** Remediation mode: "run" (plan only) or "apply" (execute) */
	mode?: "run" | "apply" | "manual" | "autonomous";
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

interface ReplaceRangePatch {
	op: "replace_range";
	content: string;
	startLine?: number;
	endLine?: number;
}

function safeFindingArtifactName(findingId: string): string {
	return findingId.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 128);
}

function parsePatchFromEvidence(
	finding: CanonicalFinding,
): { ok: true; patch: ReplaceRangePatch } | { ok: false; reason: string } {
	if (!finding.evidence) {
		return {
			ok: false,
			reason:
				'No patch payload in finding evidence. Include evidence as JSON: {"op":"replace_range","content":"..."}',
		};
	}

	const raw = finding.evidence.startsWith("harness_patch:")
		? finding.evidence.slice("harness_patch:".length).trim()
		: finding.evidence.trim();

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (error) {
		return {
			ok: false,
			reason: `Patch payload parse error: ${error instanceof Error ? error.message : String(error)}`,
		};
	}

	if (typeof parsed !== "object" || parsed === null) {
		return {
			ok: false,
			reason: "Patch payload must be a JSON object",
		};
	}

	const value = parsed as Record<string, unknown>;
	if (value.op !== "replace_range") {
		return {
			ok: false,
			reason: 'Patch payload op must be "replace_range"',
		};
	}
	if (typeof value.content !== "string") {
		return {
			ok: false,
			reason: "Patch payload content must be a string",
		};
	}

	const startLine =
		typeof value.startLine === "number" ? value.startLine : undefined;
	const endLine = typeof value.endLine === "number" ? value.endLine : undefined;
	if (
		(startLine !== undefined &&
			(!Number.isInteger(startLine) || startLine < 1)) ||
		(endLine !== undefined && (!Number.isInteger(endLine) || endLine < 1))
	) {
		return {
			ok: false,
			reason: "Patch startLine/endLine must be positive integers",
		};
	}
	if (startLine !== undefined && endLine !== undefined && endLine < startLine) {
		return {
			ok: false,
			reason: "Patch endLine cannot be less than startLine",
		};
	}

	return {
		ok: true,
		patch: {
			op: "replace_range",
			content: value.content,
			...(startLine !== undefined ? { startLine } : {}),
			...(endLine !== undefined ? { endLine } : {}),
		},
	};
}

function applyReplaceRange(
	originalContent: string,
	startLine: number,
	endLine: number,
	replacement: string,
): string {
	const lines = originalContent.split("\n");
	const startIdx = startLine - 1;
	const endIdx = endLine - 1;
	if (startIdx < 0 || endIdx >= lines.length || startIdx > endIdx) {
		throw new Error(
			`Patch range [${startLine}, ${endLine}] is out of bounds for ${lines.length} line(s)`,
		);
	}
	const replacementLines = replacement.split("\n");
	return [
		...lines.slice(0, startIdx),
		...replacementLines,
		...lines.slice(endIdx + 1),
	].join("\n");
}

function applyFindingTransaction(
	finding: CanonicalFinding,
	workspaceRoot: string,
): RemediationTransaction {
	const preSha = getHeadSha();
	const artifactDir = join(workspaceRoot, "artifacts/remediation/transactions");
	mkdirSync(artifactDir, { recursive: true });
	const artifactUri = join(
		artifactDir,
		`${safeFindingArtifactName(finding.id)}.json`,
	);

	const patchResult = parsePatchFromEvidence(finding);
	if (!patchResult.ok) {
		const transactionPayload = {
			findingId: finding.id,
			status: "skipped",
			reason: patchResult.reason,
			preSha,
			postSha: preSha,
			artifactUri,
		};
		const artifactChecksum = createHash("sha256")
			.update(JSON.stringify(transactionPayload))
			.digest("hex");
		writeFileSync(
			artifactUri,
			JSON.stringify(
				{
					...transactionPayload,
					artifactChecksum,
					timestamp: new Date().toISOString(),
				},
				null,
				2,
			),
			"utf-8",
		);
		return {
			findingId: finding.id,
			status: "skipped",
			reason: patchResult.reason,
			preSha,
			postSha: preSha,
			artifactUri,
			artifactChecksum,
		};
	}

	const targetPath = join(workspaceRoot, finding.filePath);
	const backupPath = `${targetPath}.harness-bak.${Date.now()}`;
	const tempPath = `${targetPath}.harness-tmp.${Date.now()}`;

	try {
		const originalContent = readFileSync(targetPath, "utf-8");
		writeFileSync(backupPath, originalContent, "utf-8");

		const startLine = patchResult.patch.startLine ?? finding.lineStart;
		const endLine =
			patchResult.patch.endLine ??
			(finding.lineEnd !== undefined ? finding.lineEnd : finding.lineStart);
		const updatedContent = applyReplaceRange(
			originalContent,
			startLine,
			endLine,
			patchResult.patch.content,
		);
		writeFileSync(tempPath, updatedContent, "utf-8");
		renameSync(tempPath, targetPath);

		const postSha = getHeadSha();
		if (postSha !== preSha) {
			writeFileSync(targetPath, originalContent, "utf-8");
			unlinkSync(backupPath);
			const transactionPayload = {
				findingId: finding.id,
				status: "rolled_back",
				reason:
					"HEAD changed during apply transaction; patch rolled back for safety",
				preSha,
				postSha,
				artifactUri,
			};
			const artifactChecksum = createHash("sha256")
				.update(JSON.stringify(transactionPayload))
				.digest("hex");
			writeFileSync(
				artifactUri,
				JSON.stringify(
					{
						...transactionPayload,
						artifactChecksum,
						timestamp: new Date().toISOString(),
					},
					null,
					2,
				),
				"utf-8",
			);
			return {
				findingId: finding.id,
				status: "rolled_back",
				reason:
					"HEAD changed during apply transaction; patch rolled back for safety",
				preSha,
				postSha,
				artifactUri,
				artifactChecksum,
			};
		}

		unlinkSync(backupPath);
		const transactionPayload = {
			findingId: finding.id,
			status: "applied",
			reason: "Applied low-risk patch in single-finding transaction",
			preSha,
			postSha,
			artifactUri,
		};
		const artifactChecksum = createHash("sha256")
			.update(JSON.stringify(transactionPayload))
			.digest("hex");
		writeFileSync(
			artifactUri,
			JSON.stringify(
				{
					...transactionPayload,
					artifactChecksum,
					timestamp: new Date().toISOString(),
				},
				null,
				2,
			),
			"utf-8",
		);
		return {
			findingId: finding.id,
			status: "applied",
			reason: "Applied low-risk patch in single-finding transaction",
			preSha,
			postSha,
			artifactUri,
			artifactChecksum,
		};
	} catch (error) {
		let postSha = preSha;
		try {
			postSha = getHeadSha();
		} catch {
			postSha = preSha;
		}

		try {
			if (existsSync(backupPath)) {
				const originalContent = readFileSync(backupPath, "utf-8");
				writeFileSync(targetPath, originalContent, "utf-8");
				unlinkSync(backupPath);
			}
		} catch {
			// Best effort rollback for transaction scope.
		}

		const reason = `Patch apply failed and was rolled back: ${
			error instanceof Error ? error.message : String(error)
		}`;
		const transactionPayload = {
			findingId: finding.id,
			status: "rolled_back",
			reason,
			preSha,
			postSha,
			artifactUri,
		};
		const artifactChecksum = createHash("sha256")
			.update(JSON.stringify(transactionPayload))
			.digest("hex");
		writeFileSync(
			artifactUri,
			JSON.stringify(
				{
					...transactionPayload,
					artifactChecksum,
					timestamp: new Date().toISOString(),
				},
				null,
				2,
			),
			"utf-8",
		);
		return {
			findingId: finding.id,
			status: "rolled_back",
			reason,
			preSha,
			postSha,
			artifactUri,
			artifactChecksum,
		};
	}
}

/**
 * Run remediation workflow.
 */
export async function runRemediate(
	options: RemediateOptions,
): Promise<RemediateResult> {
	const startedAt = new Date().toISOString();
	const finalize = (
		result: RemediateResult,
		payload: Record<string, unknown>,
		finalizeOptions?: { emitRunRecord?: boolean },
	): RemediateResult => {
		if (finalizeOptions?.emitRunRecord === false) {
			return result;
		}
		try {
			const artifacts: Array<{
				type: string;
				path: string;
				checksum?: string;
			}> = [];
			if (options.findings && options.findings !== "-") {
				artifacts.push({
					type: "findings-input",
					path: options.findings,
				});
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

			const outcome = !result.outcome.ok
				? "failed"
				: result.exitCode === EXIT_CODES.PARTIAL
					? "hold"
					: "success";
			const classification = !result.outcome.ok
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

			emitTerminalRunRecord({
				command: "remediate",
				startedAt,
				outcome,
				classification,
				exitCode: result.exitCode,
				...(options.runRecordsDir ? { baseDir: options.runRecordsDir } : {}),
				contract: {
					path: options.contractPath ?? "harness.contract.json",
				},
				policyContext: {
					mode: options.mode ?? "run",
					safetyPosture: "strict",
					effectivePolicySource: "remediation-policy",
					hash: hashRunRecordValue({
						policy: "remediation-policy",
						defaultRemediationPolicy: DEFAULT_REMEDIATION_POLICY,
						mode: options.mode ?? "run",
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

	// 1. Get HEAD SHA
	let headSha: string;
	try {
		headSha = options.headSha ?? getHeadSha();
	} catch (e) {
		return finalize(
			{
				outcome: {
					ok: false,
					error: {
						code: "E_INTERNAL",
						message: `Failed to get HEAD SHA: ${e instanceof Error ? e.message : String(e)}`,
					},
				},
				exitCode: EXIT_CODES.INTERNAL,
			},
			{
				stage: "head_sha",
				error: "failed_to_get_head_sha",
			},
		);
	}

	let validatedFindingsPath: string | null = null;
	if (options.findings && options.findings !== "-") {
		try {
			validatedFindingsPath = validatePath(process.cwd(), options.findings);
		} catch (error) {
			return finalize(
				{
					outcome: {
						ok: false,
						error: {
							code: "E_VALIDATION",
							message: `Failed to read findings: ${error instanceof Error ? error.message : String(error)}`,
						},
					},
					exitCode: EXIT_CODES.USAGE,
				},
				{
					stage: "read_findings",
					error: "invalid_findings_path",
				},
				{ emitRunRecord: false },
			);
		}
	}

	// 2. Load contract for policy (use defaults if not available)
	const policy = DEFAULT_REMEDIATION_POLICY;

	let rollbackPolicy = DEFAULT_PILOT_ROLLBACK_POLICY;
	if (options.contractPath) {
		try {
			const contract = loadContract(options.contractPath);
			// SECURITY: Remediation policy is process-controlled and not overridable
			// from repo-controlled contract content. Accepting autoApplyMaxTier or
			// dryRunOnlyByDefault from an untrusted contract would allow policy injection.
			// Use contract's rollback policy if available
			if (contract.pilotRollbackPolicy) {
				rollbackPolicy = contract.pilotRollbackPolicy;
			}
		} catch (error) {
			return finalize(
				{
					outcome: {
						ok: false,
						error: {
							code: "E_CONTRACT",
							message: `Failed to load remediation contract: ${
								error instanceof Error ? error.message : String(error)
							}`,
						},
					},
					exitCode: EXIT_CODES.USAGE,
				},
				{
					stage: "contract_load",
					error: "failed_to_load_contract",
				},
			);
		}
	}

	// 2b. Check rollback mode - fail closed if autonomous mode not allowed
	const effectiveMode = options.mode ?? rollbackPolicy.mode;
	if (effectiveMode === "autonomous" && rollbackPolicy.requireManualRelease) {
		// Check for completion marker
		const markerPath =
			options.completionMarkerPath ?? rollbackPolicy.completionMarkerPath;
		const markerExists = existsSync(markerPath);
		if (!markerExists) {
			return finalize(
				{
					outcome: {
						ok: false,
						error: {
							code: "E_ROLLBACK_MODE",
							message: `Autonomous mode requires completion marker at ${markerPath}. Run in manual mode or create marker file.`,
							context: { mode: effectiveMode, markerPath },
						},
					},
					exitCode: EXIT_CODES.POLICY,
				},
				{
					stage: "rollback_gate",
					error: "missing_completion_marker",
					markerPath,
				},
			);
		}
	}

	// 2c. v1.1 safety contract: apply mode only runs in clean disposable workspaces.
	if (effectiveMode === "apply") {
		const cwd = process.cwd();
		if (!isDisposableWorkspace()) {
			return finalize(
				{
					outcome: {
						ok: false,
						error: {
							code: "E_POLICY",
							message:
								"Apply mode requires a disposable workspace (for example, a git worktree). Set HARNESS_DISPOSABLE_WORKSPACE=true only for controlled disposable environments.",
							context: { cwd, mode: effectiveMode },
						},
					},
					exitCode: EXIT_CODES.POLICY,
				},
				{
					stage: "apply_preflight",
					error: "non_disposable_workspace",
				},
			);
		}

		const workspaceStatus = getWorkspaceStatus();
		if (!workspaceStatus.ok) {
			return finalize(
				{
					outcome: {
						ok: false,
						error: {
							code: "E_POLICY",
							message: `Apply mode failed preflight workspace check: ${workspaceStatus.reason}`,
							context: { mode: effectiveMode },
						},
					},
					exitCode: EXIT_CODES.POLICY,
				},
				{
					stage: "apply_preflight",
					error: "workspace_status_failed",
				},
			);
		}

		if (!workspaceStatus.clean) {
			return finalize(
				{
					outcome: {
						ok: false,
						error: {
							code: "E_POLICY",
							message:
								"Apply mode requires a clean disposable workspace. Commit or stash changes before retrying.",
							context: { mode: effectiveMode },
						},
					},
					exitCode: EXIT_CODES.POLICY,
				},
				{
					stage: "apply_preflight",
					error: "workspace_not_clean",
				},
			);
		}
	}

	// 3. Parse findings from input
	let rawInput: string;
	try {
		if (options.findings === "-" || !options.findings) {
			// Read from stdin
			rawInput = readFileSync(0, "utf-8");
		} else {
			const findingsPath = validatedFindingsPath ?? options.findings;
			rawInput = readFileSync(findingsPath, "utf-8");
		}
	} catch (e) {
		return finalize(
			{
				outcome: {
					ok: false,
					error: {
						code: "E_VALIDATION",
						message: `Failed to read findings: ${e instanceof Error ? e.message : String(e)}`,
					},
				},
				exitCode: EXIT_CODES.USAGE,
			},
			{
				stage: "read_findings",
				error: "failed_to_read_findings",
			},
		);
	}

	// 4. Parse and normalize findings
	let rawFindings: unknown[];
	try {
		rawFindings = parseFindings(rawInput);
	} catch (e) {
		return finalize(
			{
				outcome: {
					ok: false,
					error: {
						code: "E_VALIDATION",
						message: e instanceof Error ? e.message : String(e),
					},
				},
				exitCode: EXIT_CODES.USAGE,
			},
			{
				stage: "parse_findings",
				error: "failed_to_parse_findings",
			},
		);
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
		return finalize(
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
		);
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
		return finalize(
			{
				outcome: {
					ok: false,
					error: {
						code: "E_INTERNAL",
						message: `Remediation failed: ${e instanceof Error ? e.message : String(e)}`,
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

	// 6b. v1.1 apply mode: execute low-risk commit actions as single-finding transactions.
	if (outcome.ok && effectiveMode === "apply") {
		const findingById = new Map(
			findings.map((finding) => [finding.id, finding]),
		);
		const transactions: RemediationTransaction[] = [];

		for (const action of outcome.output.actions) {
			if (action.type !== "commit" || action.dryRun) {
				continue;
			}
			const finding = findingById.get(action.findingId);
			if (!finding) {
				const preSha = getHeadSha();
				const artifactUri = join(
					repoRoot,
					"artifacts/remediation/transactions",
					`${safeFindingArtifactName(action.findingId)}.json`,
				);
				mkdirSync(join(repoRoot, "artifacts/remediation/transactions"), {
					recursive: true,
				});
				const transactionPayload = {
					findingId: action.findingId,
					status: "rolled_back",
					reason:
						"Remediation action referenced an unknown finding id; no patch applied",
					preSha,
					postSha: preSha,
					artifactUri,
				};
				const artifactChecksum = createHash("sha256")
					.update(JSON.stringify(transactionPayload))
					.digest("hex");
				writeFileSync(
					artifactUri,
					JSON.stringify(
						{
							...transactionPayload,
							artifactChecksum,
							timestamp: new Date().toISOString(),
						},
						null,
						2,
					),
					"utf-8",
				);
				transactions.push({
					findingId: action.findingId,
					status: "rolled_back",
					reason:
						"Remediation action referenced an unknown finding id; no patch applied",
					preSha,
					postSha: preSha,
					artifactUri,
					artifactChecksum,
				});
				continue;
			}

			const transaction = applyFindingTransaction(finding, repoRoot);
			transactions.push(transaction);
		}

		outcome.output.transactions = transactions;
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
	} else if (
		(outcome.output.transactions ?? []).some(
			(transaction) => transaction.status !== "applied",
		)
	) {
		exitCode = EXIT_CODES.PARTIAL;
	} else {
		exitCode = EXIT_CODES.SUCCESS;
	}

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

			if (output.transactions && output.transactions.length > 0) {
				console.info("\nTransactions:");
				for (const transaction of output.transactions) {
					console.info(
						`  - ${transaction.status}: ${transaction.findingId} (${transaction.reason})`,
					);
				}
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
