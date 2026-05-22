/**
 * Remediate CLI command
 *
 * Entry point for the remediation loop. Uses the finding normalizer
 * and orchestrator to process findings from CodeQL or Codex providers.
 */

import { DEFAULT_REMEDIATION_POLICY } from "../lib/contract/types.js";
import type {
	RemediateOptions,
	RemediateResult,
} from "../lib/remediate/types.js";
import { RemediationOrchestrator } from "../lib/remediation/orchestrator.js";
import type {
	CanonicalFinding,
	RemediationOutcome,
} from "../lib/remediation/types.js";
import { applyRemediationTransactions } from "./remediate-apply-transactions.js";
import { renderRemediationOutput } from "./remediate-cli-output.js";
import { normalizeFindingsOrFail } from "./remediate-findings.js";
import {
	createGitHubClient,
	getHeadSha,
	getWorkspaceStatus,
	isDisposableWorkspace,
} from "./remediate-git.js";
import {
	createRemediateFinalizer,
	type RemediateFinalize,
} from "./remediate-run-record.js";
import {
	determineRemediateExitCode,
	EXIT_CODES,
	readFindingsInput,
	resolveEffectiveMode,
	resolveValidatedFindingsPath,
	validateApplyWorkspace,
} from "./remediate-runner-helpers.js";

export { EXIT_CODES };
export type { RemediateOptions, RemediateResult };

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

async function executeRemediation(args: {
	options: RemediateOptions;
	findings: CanonicalFinding[];
	headSha: string;
	repoRoot: string;
	finalize: RemediateFinalize;
}): Promise<
	| { ok: true; outcome: RemediationOutcome }
	| { ok: false; result: RemediateResult }
> {
	const orchestrator = new RemediationOrchestrator(
		{
			policy: DEFAULT_REMEDIATION_POLICY,
			findings: args.findings,
			dryRun: args.options.dryRun ?? false,
			headSha: args.headSha,
		},
		createGitHubClient(),
	);

	try {
		const outcome = await orchestrator.remediate();
		if (outcome.ok && args.options.subcommand === "apply") {
			applyRemediationTransactions(
				outcome,
				args.findings,
				args.repoRoot,
				getHeadSha,
			);
		}
		return { ok: true, outcome };
	} catch (error) {
		return {
			ok: false,
			result: args.finalize(
				{
					outcome: {
						ok: false,
						error: {
							code: "E_INTERNAL",
							message:
								"Remediation failed: " +
								(error instanceof Error ? error.message : String(error)),
						},
					},
					exitCode: EXIT_CODES.INTERNAL,
				},
				{
					stage: "orchestrator",
					error: "remediation_failed",
				},
			),
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
	const finalize = createRemediateFinalizer(options, startedAt);
	const headShaResult = resolveHeadSha(options, finalize);
	if (!headShaResult.ok) {
		return headShaResult.result;
	}
	const validatedPathResult = resolveValidatedFindingsPath(options, finalize);
	if (!validatedPathResult.ok) {
		return validatedPathResult.result;
	}
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

	const remediationResult = await executeRemediation({
		options,
		findings,
		headSha: headShaResult.headSha,
		repoRoot,
		finalize,
	});
	if (!remediationResult.ok) {
		return remediationResult.result;
	}
	const outcome = remediationResult.outcome;
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
