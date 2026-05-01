import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { ContractLoadError, loadContract } from "../lib/contract/loader.js";
import { resolveActiveOverrides } from "../lib/contract/north-star-artifact-io.js";
import type { HarnessContract } from "../lib/contract/types.js";
import { sanitizeError } from "../lib/input/sanitize.js";
import { validatePath } from "../lib/input/validator.js";
import { normaliseDriftGateResult } from "../lib/output/normalise.js";
import {
	createNorthStarDriftArtifactRef,
	getNorthStarDriftArtifactPath,
	summarizeDriftFindings,
	writeNorthStarDriftFindingsArtifact,
} from "./drift-gate-artifacts.js";
import {
	emitGuardrailsForFindings,
	evaluate,
	push,
} from "./drift-gate-rules.js";
import {
	DEFAULT_BASELINE_PATH,
	DEFAULT_OUT_PATH,
	type DriftBaselineInfo,
	type DriftErrorClass,
	type DriftFinding,
	type DriftGateOptions,
	type DriftGateResult,
	type DriftOutcome,
	type DriftReport,
	type DriftStatus,
	loadBaselineFingerprints,
	normalizePath,
} from "./drift-gate-types.js";

function loadDriftGateContract(repoRoot: string): {
	contract?: HarnessContract;
	error?: string;
} {
	const contractPath = join(repoRoot, "harness.contract.json");
	if (!existsSync(contractPath)) {
		return {};
	}
	try {
		return { contract: loadContract(contractPath, repoRoot) };
	} catch (error) {
		return {
			error:
				error instanceof ContractLoadError
					? sanitizeError(error)
					: `Failed to load contract: ${sanitizeError(error)}`,
		};
	}
}

function separateSuppressions(
	allFindings: DriftFinding[],
	suppressions: Set<string>,
): { findings: DriftFinding[]; suppressed: DriftFinding[] } {
	const suppressed: DriftFinding[] = [];
	const findings: DriftFinding[] = [];
	for (const finding of allFindings) {
		if (suppressions.has(finding.rule_id)) {
			suppressed.push(finding);
		} else {
			findings.push(finding);
		}
	}
	return { findings, suppressed };
}

function applyNorthStarOverrides(
	findings: DriftFinding[],
	suppressed: DriftFinding[],
	contract: HarnessContract | undefined,
	repoRoot: string,
): { findings: DriftFinding[]; suppressed: DriftFinding[] } {
	if (
		!contract?.overrideReviewerRegistry ||
		contract.overrideReviewerRegistry.trustedReviewers.length === 0
	) {
		return { findings, suppressed };
	}
	const northStarFindingIds = findings
		.filter((f) => f.failureClass)
		.map((f) => f.rule_id);
	if (northStarFindingIds.length === 0) {
		return { findings, suppressed };
	}
	const activeOverrides = resolveActiveOverrides(
		repoRoot,
		contract.overrideReviewerRegistry,
		{ activeFindingIds: northStarFindingIds },
	);
	if (activeOverrides.size === 0) {
		return { findings, suppressed };
	}
	const remaining: DriftFinding[] = [];
	for (const finding of findings) {
		if (activeOverrides.has(finding.rule_id)) {
			suppressed.push(finding);
		} else {
			remaining.push(finding);
		}
	}
	return { findings: remaining, suppressed };
}

function handleBaselineState(
	repoRoot: string,
	baseline: ReturnType<typeof loadBaselineFingerprints>,
	findings: DriftFinding[],
	options: DriftGateOptions,
): { baselineSeeded: boolean; baselineInfo: DriftBaselineInfo } {
	if (baseline.info.loaded) {
		return { baselineSeeded: false, baselineInfo: baseline.info };
	}

	if (options.seedBaseline !== false) {
		try {
			const resolvedBaseline = normalizePath(repoRoot, baseline.info.path);
			mkdirSync(dirname(resolvedBaseline), { recursive: true });
			const baselineReport = {
				schemaVersion: "1.0.0",
				generated_at: new Date().toISOString(),
				findings: findings.map((f) => ({
					rule_id: f.rule_id,
					surface: f.surface,
					path: f.path,
				})),
			};
			writeFileSync(
				resolvedBaseline,
				`${JSON.stringify(baselineReport, null, 2)}\n`,
				"utf-8",
			);
			for (const f of findings) {
				f.baseline_state = "preexisting";
			}
			return {
				baselineSeeded: true,
				baselineInfo: { path: baseline.info.path, loaded: true },
			};
		} catch {
			push(
				findings,
				{
					rule_id: "baseline.seed.missing",
					surface: "status",
					rule_result: "not_applicable",
					severity: "info",
					message:
						"Baseline seed is missing and auto-seed failed; reporting current findings as new.",
					path: baseline.info.path,
				},
				baseline.fingerprints,
			);
		}
	} else {
		push(
			findings,
			{
				rule_id: "baseline.seed.missing",
				surface: "status",
				rule_result: "not_applicable",
				severity: "info",
				message:
					"Baseline seed is missing; reporting current findings as new until default-branch baseline is published.",
				path: baseline.info.path,
			},
			baseline.fingerprints,
		);
	}

	return { baselineSeeded: false, baselineInfo: baseline.info };
}

function buildDriftReport(
	mode: import("./drift-gate-types.js").DriftGateMode,
	repoRoot: string,
	outcome: DriftOutcome,
	errorClass: DriftErrorClass,
	baselineInfo: DriftBaselineInfo,
	findings: DriftFinding[],
	suppressed: DriftFinding[],
	baselineSeeded: boolean,
	guardrailPaths: string[],
): DriftReport {
	let status: DriftStatus = "success";
	if (outcome === "error") {
		status = "blocked";
	} else if (findings.length > 0) {
		status = "partial";
	}

	return {
		schemaVersion: "1.0.0",
		command: "drift-gate",
		mode,
		status,
		outcome,
		error_class: errorClass,
		generated_at: new Date().toISOString(),
		repo_root: repoRoot,
		baseline: baselineInfo,
		summary: summarizeDriftFindings(findings, suppressed),
		findings,
		...(suppressed.length > 0 ? { suppressed } : {}),
		...(baselineSeeded ? { baseline_seeded: true } : {}),
		...(guardrailPaths.length > 0 ? { guardrail_refs: guardrailPaths } : {}),
	};
}

function writeDriftGateArtifacts(
	repoRoot: string,
	report: DriftReport,
	baseline: ReturnType<typeof loadBaselineFingerprints>,
): { report: DriftReport } {
	try {
		writeNorthStarDriftFindingsArtifact(repoRoot, report);
		report.artifact_refs = [createNorthStarDriftArtifactRef()];
	} catch (error) {
		report.outcome = "error";
		report.error_class = "io";
		report.status = "blocked";
		push(
			report.findings,
			{
				rule_id: "status.north_star.drift_artifact.write_error",
				surface: "status",
				rule_result: "error",
				severity: "error",
				message: `Failed to write north-star drift artifact: ${sanitizeError(error)}`,
				path: getNorthStarDriftArtifactPath(),
			},
			baseline.fingerprints,
		);
		report.summary = summarizeDriftFindings(
			report.findings,
			report.suppressed ?? [],
		);
	}
	return { report };
}

function writeDriftGateOutput(
	repoRoot: string,
	report: DriftReport,
	options: DriftGateOptions,
	baseline: ReturnType<typeof loadBaselineFingerprints>,
): void {
	const outPath =
		options.outPath ??
		(report.mode === "advisory" ? DEFAULT_OUT_PATH : undefined);
	if (!outPath) {
		return;
	}
	try {
		const resolvedOutPath = validatePath(repoRoot, outPath);
		mkdirSync(dirname(resolvedOutPath), { recursive: true });
		writeFileSync(
			resolvedOutPath,
			`${JSON.stringify(report, null, 2)}\n`,
			"utf-8",
		);
	} catch (error) {
		report.outcome = "error";
		report.error_class = "io";
		report.status = "blocked";
		push(
			report.findings,
			{
				rule_id: "report.output.write_error",
				surface: "status",
				rule_result: "error",
				severity: "error",
				message: `Failed to write report output: ${sanitizeError(error)}`,
				path: outPath,
			},
			baseline.fingerprints,
		);
		report.summary = summarizeDriftFindings(
			report.findings,
			report.suppressed ?? [],
		);
	}
}

/**
 * Run repository drift checks, handle baseline and contract interactions, emit artifacts, and produce a final report.
 *
 * @param options - Configuration for the run (mode, repoRoot, baselinePath, suppressions, outPath, json, etc.)
 * @returns An object with `report` containing the generated DriftReport and `exitCode` containing the process-style exit code
 */
export function runDriftGate(options: DriftGateOptions = {}): DriftGateResult {
	const mode = options.mode ?? "advisory";
	const repoRoot = resolve(options.repoRoot ?? process.cwd());
	const baselinePath = options.baselinePath ?? DEFAULT_BASELINE_PATH;
	const suppressions = new Set(options.suppressions ?? []);
	const baseline = loadBaselineFingerprints(repoRoot, baselinePath);

	const { contract, error: contractLoadingError } =
		loadDriftGateContract(repoRoot);

	let outcome: DriftOutcome = "ok";
	let errorClass: DriftErrorClass = "none";
	const allFindings = evaluate(repoRoot, baseline.fingerprints, contract);

	let { findings, suppressed } = separateSuppressions(
		allFindings,
		suppressions,
	);
	({ findings, suppressed } = applyNorthStarOverrides(
		findings,
		suppressed,
		contract,
		repoRoot,
	));

	if (contractLoadingError) {
		outcome = "error";
		errorClass = "schema";
		push(
			findings,
			{
				rule_id: "status.north_star.contract.invalid",
				surface: "status",
				rule_result: "error",
				severity: "error",
				message: contractLoadingError,
				path: "harness.contract.json",
			},
			baseline.fingerprints,
		);
	}

	if (baseline.loadingError) {
		outcome = "error";
		errorClass = baseline.loadingError.errorClass;
		push(
			findings,
			{
				rule_id: "baseline.load.error",
				surface: "status",
				rule_result: "error",
				severity: "error",
				message: baseline.loadingError.message,
				path: baselinePath,
			},
			baseline.fingerprints,
		);
	}

	let baselineSeeded = false;
	let baselineInfo = baseline.info;
	if (!baseline.loadingError) {
		({ baselineSeeded, baselineInfo } = handleBaselineState(
			repoRoot,
			baseline,
			findings,
			options,
		));
	}

	let guardrailPaths: string[] = [];
	try {
		guardrailPaths = emitGuardrailsForFindings(repoRoot, findings, contract);
	} catch (error) {
		outcome = "error";
		errorClass = "io";
		push(
			findings,
			{
				rule_id: "status.north_star.drift_artifact.write_error",
				surface: "status",
				rule_result: "error",
				severity: "error",
				message: `Failed to write north-star durable guardrail artifact: ${sanitizeError(error)}`,
				path: ".harness/guardrails/north-star",
			},
			baseline.fingerprints,
		);
	}

	let report = buildDriftReport(
		mode,
		repoRoot,
		outcome,
		errorClass,
		baselineInfo,
		findings,
		suppressed,
		baselineSeeded,
		guardrailPaths,
	);

	const hasHealthBlockingFinding = report.findings.some(
		(finding) =>
			finding.severity === "error" ||
			(finding.surface === "status" && finding.rule_result === "fail"),
	);
	if (
		mode === "health" &&
		report.outcome !== "error" &&
		hasHealthBlockingFinding
	) {
		report.status = "blocked";
	}

	({ report } = writeDriftGateArtifacts(repoRoot, report, baseline));
	writeDriftGateOutput(repoRoot, report, options, baseline);

	const exitCode =
		mode !== "health"
			? 0
			: report.outcome === "error"
				? 2
				: hasHealthBlockingFinding
					? 1
					: 0;
	return { report, exitCode };
}

/**
 * Runs the drift-gate process and writes either JSON or human-readable CLI output.
 *
 * If `options.json` is true, writes a normalized JSON result to stdout; otherwise prints a concise human-readable summary and per-finding details.
 *
 * @returns The exit code to use for the process: `0` for success (or non-blocking advisory runs), `1` when health-mode findings block the gate, `2` for error conditions encountered during execution.
 */
export function runDriftGateCLI(options: DriftGateOptions = {}): number {
	const result = runDriftGate(options);

	if (options.json) {
		const gateResult = normaliseDriftGateResult(result);
		process.stdout.write(`${JSON.stringify(gateResult, null, 2)}\n`);
	} else {
		const icon =
			result.report.status === "success"
				? "✓"
				: result.report.status === "partial"
					? "⚠"
					: "✗";
		console.info(
			`${icon} drift-gate (${result.report.mode}) ${result.report.status}`,
		);
		console.info(
			`Findings: ${result.report.summary.finding_count} (new: ${result.report.summary.new_count}, preexisting: ${result.report.summary.preexisting_count})`,
		);
		if (result.report.summary.suppressed_count > 0) {
			console.info(`Suppressed: ${result.report.summary.suppressed_count}`);
		}
		if (result.report.baseline_seeded) {
			console.info(
				`Baseline: seeded with ${result.report.summary.preexisting_count} findings`,
			);
		} else if (result.report.baseline.loaded) {
			console.info(`Baseline: loaded from ${result.report.baseline.path}`);
		} else {
			console.info(
				`Baseline: unavailable (${result.report.baseline.reason ?? "unknown"})`,
			);
		}

		if (result.report.findings.length > 0) {
			console.info("");
			for (const finding of result.report.findings) {
				const level = finding.severity === "error" ? "ERROR" : "WARN";
				const suffix = finding.path ? ` (${finding.path})` : "";
				console.info(
					`- [${level}] ${finding.rule_id}: ${finding.message}${suffix}`,
				);
				if (finding.fix) {
					if (finding.fix.command) {
						console.info(`  Fix: ${finding.fix.command}`);
					} else if (finding.fix.manual) {
						console.info(`  Fix: ${finding.fix.manual}`);
					}
				}
			}
		}
	}

	return result.exitCode;
}
