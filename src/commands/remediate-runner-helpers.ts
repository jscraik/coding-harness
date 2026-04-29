import { existsSync, readFileSync } from "node:fs";
import { loadContract } from "../lib/contract/loader.js";
import { DEFAULT_PILOT_ROLLBACK_POLICY } from "../lib/contract/types.js";
import { validatePath } from "../lib/input/validator.js";
import type {
	CanonicalFinding,
	RemediationOutcome,
} from "../lib/remediation/types.js";
import type { RemediateOptions, RemediateResult } from "./remediate.js";
import { EXIT_CODES } from "./remediate.js";

type RemediateFinalize = (
	result: RemediateResult,
	payload: Record<string, unknown>,
	options?: { emitRunRecord?: boolean },
) => RemediateResult;

/**
 * Resolve and validate a findings path before file access.
 */
export function resolveValidatedFindingsPath(
	options: RemediateOptions,
	finalize: RemediateFinalize,
): { ok: true; path: string | null } | { ok: false; result: RemediateResult } {
	if (!options.findings || options.findings === "-") {
		return { ok: true, path: null };
	}
	try {
		return {
			ok: true,
			path: validatePath(process.cwd(), options.findings),
		};
	} catch (error) {
		return {
			ok: false,
			result: finalize(
				{
					outcome: {
						ok: false,
						error: {
							code: "E_VALIDATION",
							message: `Failed to read findings: ${
								error instanceof Error ? error.message : String(error)
							}`,
						},
					},
					exitCode: EXIT_CODES.USAGE,
				},
				{ stage: "read_findings", error: "invalid_findings_path" },
				{ emitRunRecord: false },
			),
		};
	}
}

/**
 * Resolve rollback mode and apply rollback policy contract checks.
 */
export function resolveEffectiveMode(
	options: RemediateOptions,
	finalize: RemediateFinalize,
):
	| { ok: true; effectiveMode: "manual" | "autonomous" }
	| { ok: false; result: RemediateResult } {
	let rollbackPolicy = DEFAULT_PILOT_ROLLBACK_POLICY;
	if (options.contractPath) {
		try {
			const contract = loadContract(options.contractPath);
			if (contract.pilotRollbackPolicy) {
				rollbackPolicy = contract.pilotRollbackPolicy;
			}
		} catch (error) {
			return {
				ok: false,
				result: finalize(
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
					{ stage: "contract_load", error: "failed_to_load_contract" },
				),
			};
		}
	}

	const effectiveMode = options.mode ?? rollbackPolicy.mode;
	if (effectiveMode === "autonomous" && rollbackPolicy.requireManualRelease) {
		const markerPath =
			options.completionMarkerPath ?? rollbackPolicy.completionMarkerPath;
		if (!existsSync(markerPath)) {
			return {
				ok: false,
				result: finalize(
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
				),
			};
		}
	}
	return { ok: true, effectiveMode };
}

/**
 * Validate workspace preconditions for apply mode.
 */
export function validateApplyWorkspace(
	subcommand: "run" | "apply",
	effectiveMode: "manual" | "autonomous",
	isDisposableWorkspace: () => boolean,
	getWorkspaceStatus: () =>
		| { ok: true; clean: boolean }
		| { ok: false; reason: string },
	finalize: RemediateFinalize,
): RemediateResult | null {
	if (subcommand !== "apply") {
		return null;
	}
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
			{ stage: "apply_preflight", error: "non_disposable_workspace" },
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
			{ stage: "apply_preflight", error: "workspace_status_failed" },
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
			{ stage: "apply_preflight", error: "workspace_not_clean" },
		);
	}
	return null;
}

/**
 * Read findings input from stdin or a validated file path.
 */
export function readFindingsInput(
	options: RemediateOptions,
	validatedFindingsPath: string | null,
	finalize: RemediateFinalize,
): { ok: true; rawInput: string } | { ok: false; result: RemediateResult } {
	try {
		if (options.findings === "-" || !options.findings) {
			return { ok: true, rawInput: readFileSync(0, "utf-8") };
		}
		const findingsPath = validatedFindingsPath ?? options.findings;
		return { ok: true, rawInput: readFileSync(findingsPath, "utf-8") };
	} catch (error) {
		return {
			ok: false,
			result: finalize(
				{
					outcome: {
						ok: false,
						error: {
							code: "E_VALIDATION",
							message: `Failed to read findings: ${
								error instanceof Error ? error.message : String(error)
							}`,
						},
					},
					exitCode: EXIT_CODES.USAGE,
				},
				{ stage: "read_findings", error: "failed_to_read_findings" },
			),
		};
	}
}

/**
 * Map remediation outcome status into CLI exit code.
 */
export function determineRemediateExitCode(
	outcome: RemediationOutcome,
	findings: CanonicalFinding[],
): number {
	if (!outcome.ok) {
		if (outcome.error.code === "E_RACE_DETECTED") {
			return EXIT_CODES.POLICY;
		}
		if (outcome.error.code === "E_POLICY") {
			return EXIT_CODES.POLICY;
		}
		return EXIT_CODES.INTERNAL;
	}
	if (outcome.output.actions.length < findings.length) {
		return EXIT_CODES.PARTIAL;
	}
	if (
		(outcome.output.transactions ?? []).some(
			(transaction) => transaction.status !== "applied",
		)
	) {
		return EXIT_CODES.PARTIAL;
	}
	return EXIT_CODES.SUCCESS;
}
