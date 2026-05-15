/**
 * Per-gate adapter functions: translate gate-internal result types to the canonical GateResult.
 *
 * All adapters are pure functions — no I/O, no side effects.
 * Implementations are added incrementally per plan phases P1–P3 + P2b.
 *
 * @see docs/plans/2026-03-24-feature-structured-output-auto-fix-plan.md
 */

import type { DocsFinding, DocsGateResult } from "../../commands/docs-gate.js";
import type {
	DriftFinding,
	DriftGateResult,
} from "../../commands/drift-gate.js";
import type { LinearGateResult } from "../../commands/linear-gate.js";
import type { PolicyGateResult } from "../../commands/policy-gate.js";
import type { PrTemplateGateResult } from "../../commands/pr-template-gate.js";
import type { HeGateResult, HePhaseExit } from "../decision/he-phase-exit.js";
import type { PlanGateResult } from "../plan-gate/types.js";
import type { GateFailureClass } from "../policy/required-checks.js";
import { buildGateResult, uniqueStrings } from "./normalise-core.js";
import type { GateFinding, GateResult } from "./types.js";

// ─── Re-export canonical types for convenience ────────────────────────────────
export type { GateFinding, GateResult, AutoFixResult } from "./types.js";

/**
 * Render a gate result to the console with consistent formatting.
 * Shared across all gate CLI entry points.
 *
 * @param gateResult - The normalized GateResult to render
 * @param summary - Optional summary object with passed/total counts and durationMs
 * @param riskTier - Optional risk tier to display
 */
export function renderGateDecision(
	gateResult: GateResult,
	summary?: { passed: number; total: number; durationMs: number },
	riskTier?: string,
): void {
	const icon =
		gateResult.status === "pass"
			? "✓"
			: gateResult.status === "warn"
				? "⚠"
				: "✗";
	console.info(`${icon} ${gateResult.gate} ${gateResult.status}`);
	console.info(`Reason: ${gateResult.reason}`);
	if (gateResult.action_now.length > 0) {
		console.info("Action now:");
		for (const step of gateResult.action_now) {
			console.info(`- ${step}`);
		}
	}
	if (gateResult.action_later.length > 0) {
		console.info("Action later:");
		for (const step of gateResult.action_later) {
			console.info(`- ${step}`);
		}
	}
	if (summary) {
		console.info(
			`Summary: ${summary.passed}/${summary.total} checks passed (${summary.durationMs}ms)`,
		);
	}
	if (riskTier) {
		console.info(`Risk tier: ${riskTier}`);
	}
}

/** Failure class and next action derived from a linear-gate error code. */
export interface LinearGateFailureClassification {
	failureClass: GateFailureClass;
	nextAction: string;
}

const LINEAR_GATE_CONTRACT_POLICY_NEXT_ACTION =
	"Fix contract/policy mismatch, then rerun linear-gate.";
const LINEAR_GATE_TRANSIENT_INFRA_NEXT_ACTION =
	"Retry once after infrastructure recovers, then rerun linear-gate.";
const LINEAR_GATE_INTERNAL_UNKNOWN_NEXT_ACTION =
	"Inspect gate output, fix root cause, and rerun linear-gate.";

function defaultEvidenceRef(gate: string, findings: GateFinding[]): string[] {
	const refs = uniqueStrings(
		findings.flatMap((finding) => [
			finding.path ? `path:${finding.path}` : undefined,
			`finding:${finding.id}`,
		]),
	);
	return refs.length > 0 ? refs : [`gate:${gate}`];
}

/**
 * Maps a linear-gate error code to a failure classification used for next-action guidance.
 *
 * @param errorCode - Error code reported by the linear gate
 * @returns `contract_policy` for policy/contract validation failures, `transient_infra` for retryable infra/network classes, `internal_unknown` otherwise
 */
function classifyLinearGateErrorCode(errorCode: string): GateFailureClass {
	if (errorCode === "CONTRACT_ERROR" || errorCode === "VALIDATION_ERROR") {
		return "contract_policy";
	}
	const normalizedCode = errorCode.trim().toUpperCase();
	if (
		normalizedCode.includes("TIMEOUT") ||
		normalizedCode.includes("RATE_LIMIT") ||
		normalizedCode.includes("TRANSIENT") ||
		normalizedCode.includes("NETWORK") ||
		normalizedCode.includes("UNAVAILABLE") ||
		normalizedCode === "ECONNRESET" ||
		normalizedCode === "ETIMEDOUT" ||
		normalizedCode === "EAI_AGAIN"
	) {
		return "transient_infra";
	}
	return "internal_unknown";
}

/**
 * Selects the user-facing next-action string for a linear gate failure class.
 *
 * @param failureClass - The classified failure type for a linear gate; determines the recommended next action.
 * @returns The next-action string corresponding to `failureClass`: the contract-policy guidance when `failureClass` is `"contract_policy"`, otherwise the internal-unknown guidance.
 */
function resolveLinearGateNextAction(failureClass: GateFailureClass): string {
	switch (failureClass) {
		case "contract_policy":
			return LINEAR_GATE_CONTRACT_POLICY_NEXT_ACTION;
		case "transient_infra":
			return LINEAR_GATE_TRANSIENT_INFRA_NEXT_ACTION;
		case "internal_unknown":
			return LINEAR_GATE_INTERNAL_UNKNOWN_NEXT_ACTION;
	}
}

/**
 * Classify a linear-gate result into a failure category and a user-facing next action.
 *
 * @param result - The linear gate result to evaluate; used to determine whether the run passed or failed and, if failed, which error code to classify.
 * @returns A `LinearGateFailureClassification` describing the failure class and recommended next action when the result represents a failure, or `null` when the result indicates success.
 */
export function classifyLinearGateFailure(
	result: LinearGateResult,
): LinearGateFailureClassification | null {
	if (result.ok) {
		if (result.output.passed) {
			return null;
		}
		return {
			failureClass: "contract_policy",
			nextAction: resolveLinearGateNextAction("contract_policy"),
		};
	}

	const failureClass = classifyLinearGateErrorCode(result.error.code);
	return {
		failureClass,
		nextAction: resolveLinearGateNextAction(failureClass),
	};
}

// ─── P1: drift-gate adapter ───────────────────────────────────────────────────

/** Map a DriftFinding to canonical GateFinding. Pure. */
function adaptDriftFinding(f: DriftFinding): GateFinding {
	const id = `drift-gate.${f.surface}.${f.rule_id}`;

	// DriftSeverity vocab already matches canonical: error | warning | info
	const severity = f.severity as GateFinding["severity"];

	return {
		id,
		severity,
		gate: "drift-gate",
		message: f.message,
		...(f.path !== undefined ? { path: f.path } : {}),
		// baseline_state === "preexisting" means this existed before current run
		baseline: f.baseline_state === "preexisting",
		...(f.failureClass !== undefined ? { failureClass: f.failureClass } : {}),
		fix: {
			...(f.fix?.command !== undefined ? { command: f.fix.command } : {}),
			...(f.fix?.manual !== undefined ? { manual: f.fix.manual } : {}),
			suppressible: f.fix?.suppressible ?? false,
		},
	};
}

/**
 * Convert a DriftGateResult into a canonical GateResult for the drift-gate.
 *
 * The returned GateResult contains findings mapped from the drift report, a
 * timestamp taken from the report (or now), and a status derived from the
 * report outcome/status:
 * - `report.outcome === "error"` or `report.status === "blocked"` → `fail`
 * - `report.status === "partial"` → `warn`
 * - otherwise → `pass`
 *
 * When the drift report provides artifact references, those paths are included
 * in `meta.artifactRefs` and are merged into the result `decision.evidenceRef`.
 *
 * @param result - The raw DriftGateResult produced by the drift gate
 * @returns A canonical GateResult representing the normalized drift-gate output
 */
export function normaliseDriftGateResult(result: DriftGateResult): GateResult {
	const gate = "drift-gate";
	const timestamp = result.report.generated_at ?? new Date().toISOString();

	const findings = result.report.findings.map(adaptDriftFinding);
	const artifactRefs = result.report.artifact_refs ?? [];
	const artifactEvidenceRefs = artifactRefs.map(
		(artifact) => `artifact:${artifact.path}`,
	);
	const evidenceRef = uniqueStrings([
		...defaultEvidenceRef(gate, findings),
		...artifactEvidenceRefs,
	]);

	let status: GateResult["status"];
	if (result.report.outcome === "error" || result.report.status === "blocked") {
		status = "fail";
	} else if (result.report.status === "partial") {
		status = "warn";
	} else {
		status = "pass";
	}

	return buildGateResult({
		gate,
		timestamp,
		status,
		findings,
		...(artifactRefs.length > 0
			? {
					meta: { artifactRefs },
					decision: { evidenceRef },
				}
			: {}),
	});
}

// ─── P1: docs-gate adapter ────────────────────────────────────────────────────

/** Map a DocsFinding to canonical GateFinding. Pure. */
function adaptDocsFinding(f: DocsFinding): GateFinding {
	const id = `docs-gate.${f.surface}.${f.rule_id}`;

	// DocsSeverity vocab already matches canonical: error | warning | info
	const severity = f.severity as GateFinding["severity"];

	return {
		id,
		severity,
		gate: "docs-gate",
		message: f.message,
		...(f.path !== undefined ? { path: f.path } : {}),
		// docs-gate has no baseline concept
		baseline: false,
		// docs-gate findings have no fix.command — no automatable remediation
		fix: { suppressible: false },
	};
}

/**
 * Normalise a DocsGateResult to canonical GateResult.
 * Status mapping:
 *   report.outcome === "ok" → "pass"
 *   report.status  === "partial" → "warn"
 *   otherwise → "fail"
 */
export function normaliseDocsGateResult(result: DocsGateResult): GateResult {
	const gate = "docs-gate";
	const timestamp = result.report.generated_at ?? new Date().toISOString();

	const findings = result.report.findings.map(adaptDocsFinding);

	let status: GateResult["status"];
	if (result.report.outcome === "ok") {
		status = "pass";
	} else if (result.report.status === "partial") {
		status = "warn";
	} else {
		status = "fail";
	}

	return buildGateResult({
		gate,
		timestamp,
		status,
		findings,
		meta: {
			version: "v1-legacy",
			mode: result.report.mode,
			outcome: result.report.outcome,
			reportStatus: result.report.status,
			error_class: result.report.error_class,
			execution_context: result.report.execution_context,
			changed_files: result.report.changed_files,
			categories: result.report.categories,
			repo_root: result.report.repo_root,
			base_ref: result.report.base_ref,
			summary: result.report.summary,
		},
	});
}

// ─── P2: policy-gate adapter (binary-result) ─────────────────────────────────

/**
 * Normalise a PolicyGateResult (binary-result class) to canonical GateResult.
 *
 * Synthesis rules (spec §4.2):
 *   ok:false           → one internal finding, status=fail
 *   ok:true, passed    → findings=[], status=pass
 *   ok:true, !passed   → one finding per violating file, status=fail
 *                        (guard: if violatingFiles empty → synthetic unknown finding)
 */
export function normalisePolicyGateResult(
	result: PolicyGateResult,
): GateResult {
	const gate = "policy-gate";
	const timestamp = new Date().toISOString();

	// ok:false — internal error before gate logic ran
	if (!result.ok) {
		const finding: GateFinding = {
			id: "policy-gate.result.internal",
			severity: "error",
			gate,
			message: result.error.message,
			baseline: false,
			fix: { suppressible: false },
		};
		return buildGateResult({
			gate,
			timestamp,
			status: "fail",
			findings: [finding],
			decision: {
				reason: result.error.message,
				actionNow: ["Investigate policy-gate internal error and rerun."],
				evidenceRef: ["error:policy-gate.result.internal"],
			},
		});
	}

	// ok:true, passed — clean run
	if (result.output.passed) {
		return buildGateResult({
			gate,
			timestamp,
			status: "pass",
			findings: [],
			meta: {
				tier: result.output.tier,
				verdict: result.output.verdict,
				action: result.output.action,
			},
			decision: {
				reason: `Policy gate passed for tier '${result.output.tier}'.`,
				evidenceRef: [`tier:${result.output.tier}`],
			},
		});
	}

	// ok:true, !passed — synthesise one finding per violating file
	// Guard: never emit empty findings when status=fail (spec §7 edge cases)
	const violatingFiles = result.output.violatingFiles;
	const findings: GateFinding[] =
		violatingFiles.length > 0
			? violatingFiles.map(
					(file, index): GateFinding => ({
						id: `policy-gate.result.error.${index}`,
						severity: "error",
						gate,
						message: `File '${file}' exceeds policy tier (actual: ${result.output.tier}, max: ${result.output.maxAllowed ?? "unset"})`,
						...(file ? { path: file } : {}),
						baseline: false,
						fix: { suppressible: false },
					}),
				)
			: [
					{
						id: "policy-gate.result.error.unknown",
						severity: "error" as const,
						gate,
						message: "Gate reported failure without file details",
						baseline: false,
						fix: { suppressible: false },
					},
				];

	return buildGateResult({
		gate,
		timestamp,
		status: "fail",
		findings,
		meta: {
			tier: result.output.tier,
			maxAllowed: result.output.maxAllowed,
			verdict: result.output.verdict,
			action: result.output.action,
		},
		decision: {
			reason: `Tier '${result.output.tier}' exceeds allowed '${result.output.maxAllowed ?? "unset"}'.`,
			evidenceRef: uniqueStrings(
				(result.output.violatingFiles ?? []).map((file) => `path:${file}`),
			),
		},
	});
}

// ─── P2: pr-template-gate adapter (binary-result) ────────────────────────────

/**
 * Normalise a PrTemplateGateResult (binary-result class) to canonical GateResult.
 *
 * Synthesis rules (spec §4.2):
 *   ok:false           → one internal finding, status=fail
 *   ok:true, passed    → findings=[], status=pass
 *   ok:true, !passed   → one finding per errors[index], status=fail
 *                        (guard: if errors empty → synthetic unknown finding)
 */
export function normalisePrTemplateGateResult(
	result: PrTemplateGateResult,
): GateResult {
	const gate = "pr-template-gate";
	const timestamp = new Date().toISOString();

	// ok:false — internal error
	if (!result.ok) {
		const finding: GateFinding = {
			id: "pr-template-gate.result.internal",
			severity: "error",
			gate,
			message: result.error.message,
			baseline: false,
			fix: { suppressible: false },
		};
		return buildGateResult({
			gate,
			timestamp,
			status: "fail",
			findings: [finding],
			decision: {
				reason: result.error.message,
				actionNow: ["Fix the internal pr-template-gate error and rerun."],
				evidenceRef: ["error:pr-template-gate.result.internal"],
			},
		});
	}

	// ok:true, passed — clean run
	if (result.output.passed) {
		return buildGateResult({
			gate,
			timestamp,
			status: "pass",
			findings: [],
		});
	}

	// ok:true, !passed — synthesise one finding per error string
	// Guard: never emit empty findings when status=fail (spec §7 edge cases)
	const errors = result.output.errors;
	const findings: GateFinding[] =
		errors.length > 0
			? errors.map(
					(msg, index): GateFinding => ({
						id: `pr-template-gate.result.error.${index}`,
						severity: "error",
						gate,
						message: msg,
						baseline: false,
						fix: { suppressible: false },
					}),
				)
			: [
					{
						id: "pr-template-gate.result.error.unknown",
						severity: "error" as const,
						gate,
						message: "Gate reported failure without error details",
						baseline: false,
						fix: { suppressible: false },
					},
				];

	return buildGateResult({
		gate,
		timestamp,
		status: "fail",
		findings,
	});
}

// ─── P2b: plan-gate adapter (coded-error) ────────────────────────────────────

/**
 * Normalise a PlanGateResult (coded-error class) to canonical GateResult.
 *
 * @param result - The PlanGateResult from runPlanGate()
 * @param recoveryHints - Caller-provided map of { code → hint string } to avoid
 *                        a lib→commands import violation. Build in runPlanGateCLI
 *                        by calling getRecoveryHint() per error code before invoking.
 */
export function normalisePlanGateResult(
	result: PlanGateResult,
	recoveryHints: Record<string, string | undefined> = {},
): GateResult {
	const gate = "plan-gate";
	const timestamp = new Date().toISOString();

	if (result.passed) {
		return buildGateResult({
			gate,
			timestamp,
			status: "pass",
			findings: [],
		});
	}

	const findings: GateFinding[] = result.errors.map((e) => {
		const hint = recoveryHints[e.code];
		return {
			id: `plan-gate.result.error.${e.code}`,
			severity: "error" as const,
			gate,
			message: e.message,
			...(e.path !== undefined ? { path: e.path } : {}),
			baseline: false,
			fix: {
				...(hint !== undefined ? { manual: hint } : {}),
				suppressible: false,
			},
		};
	});

	return buildGateResult({
		gate,
		timestamp,
		status: "fail",
		findings,
	});
}

// ─── P3: linear-gate adapter (check-list) ────────────────────────────────────

/**
 * Convert a raw LinearGateResult into the canonical GateResult with standardized findings, summary counts, status, and optional meta information.
 *
 * When the gate call failed (result.ok === false) the returned GateResult contains a single internal error finding and `meta.errorCode`. When the gate call succeeded, the returned GateResult contains one error finding for each failing check. If a failure classification is available, its `nextAction` is attached to each finding's `fix.manual` and `meta.failureClass` / `meta.nextAction` are included.
 *
 * @param result - The raw linear-gate response to normalize.
 * @returns A canonical GateResult with normalized `findings`, `summary` (errors/warnings/info/total), `status` ("pass" or "fail"), and optional `meta` fields (`failureClass`, `nextAction`, `errorCode`).
 */
export function normaliseLinearGateResult(
	result: LinearGateResult,
): GateResult {
	const gate = "linear-gate";
	const timestamp = new Date().toISOString();
	const failure = classifyLinearGateFailure(result);

	if (!result.ok) {
		const finding: GateFinding = {
			id: "linear-gate.result.internal",
			severity: "error",
			gate,
			message: result.error.message,
			baseline: false,
			fix: {
				...(failure ? { manual: failure.nextAction } : {}),
				suppressible: false,
			},
		};
		return buildGateResult({
			gate,
			timestamp,
			status: "fail",
			findings: [finding],
			meta: {
				...(failure ? { failureClass: failure.failureClass } : {}),
				...(failure ? { nextAction: failure.nextAction } : {}),
				errorCode: result.error.code,
			},
			decision: {
				reason: result.error.message,
				actionNow: failure
					? [failure.nextAction]
					: ["Inspect linear-gate internal error and rerun."],
				evidenceRef: ["error:linear-gate.result.internal"],
			},
		});
	}

	const failingChecks = result.output.checks.filter((c) => !c.passed);
	if (!result.output.passed && failingChecks.length === 0) {
		const finding: GateFinding = {
			id: "linear-gate.result.internal",
			severity: "error",
			gate,
			message:
				"Linear gate reported passed=false but provided no failing checks; treating payload as a contract violation.",
			baseline: false,
			fix: {
				...(failure ? { manual: failure.nextAction } : {}),
				suppressible: false,
			},
		};
		return buildGateResult({
			gate,
			timestamp,
			status: "fail",
			findings: [finding],
			...(failure
				? {
						meta: {
							failureClass: failure.failureClass,
							nextAction: failure.nextAction,
						},
					}
				: {}),
			decision: {
				reason: "linear-gate returned passed=false with no failing checks.",
				actionNow: failure
					? [failure.nextAction]
					: ["Inspect linear-gate payload contract and rerun."],
				evidenceRef: ["error:linear-gate.result.internal"],
			},
		});
	}

	const findings: GateFinding[] = failingChecks.map((c) => ({
		id: `linear-gate.check.${c.code}`,
		severity: "error" as const,
		gate,
		message: c.message,
		baseline: false,
		fix: {
			...(failure ? { manual: failure.nextAction } : {}),
			suppressible: false,
		},
	}));

	const status = findings.length > 0 ? "fail" : "pass";
	return buildGateResult({
		gate,
		timestamp,
		status,
		findings,
		...(failure
			? {
					meta: {
						failureClass: failure.failureClass,
						nextAction: failure.nextAction,
					},
				}
			: {}),
	});
}

// --- HE phase-exit adapter ----------------------------------------------------

function phaseExitStatus(result: HePhaseExit): GateResult["status"] {
	if (result.blockers.length > 0 || result.recommendation !== "continue") {
		return "fail";
	}
	return result.warnings.length > 0 ? "warn" : "pass";
}

function adaptPhaseExitIssue(
	message: string,
	index: number,
	kind: "blocker" | "warning",
): GateFinding {
	return {
		id: `he-phase-exit.${kind}.${index}`,
		severity: kind === "blocker" ? "error" : "warning",
		gate: "he-phase-exit",
		message,
		baseline: false,
		failureClass:
			kind === "blocker" ? "phase_exit_blocked" : "phase_exit_warning",
		fix: {
			manual:
				kind === "blocker"
					? "Resolve the blocking HE gate evidence, then rerun phase-exit aggregation."
					: "Review optional HE gate warning before handoff.",
			suppressible: false,
		},
	};
}

function phaseExitActionNow(result: HePhaseExit): string[] {
	switch (result.recommendation) {
		case "continue":
			return result.warnings.length > 0
				? ["Review optional HE phase-exit warnings before handoff."]
				: [];
		case "human_review_required":
			return [
				"Run the required human review gate, record artifact-backed evidence, then rerun phase-exit aggregation.",
			];
		case "commit_blocked":
			return [
				"Resolve required HE phase-exit blockers before commit readiness.",
			];
		case "stop":
			return [
				"Stop the current HE phase and repair the blocking gate evidence before continuing.",
			];
	}
}

function phaseExitRecommendationFinding(result: HePhaseExit): GateFinding[] {
	if (result.recommendation === "continue" || result.blockers.length > 0) {
		return [];
	}
	return [
		adaptPhaseExitIssue(
			`HE phase exit recommendation is ${result.recommendation}.`,
			0,
			"blocker",
		),
	];
}

function phaseExitFindings(result: HePhaseExit): GateFinding[] {
	return [
		...phaseExitRecommendationFinding(result),
		...result.blockers.map((blocker, index) =>
			adaptPhaseExitIssue(blocker, index, "blocker"),
		),
		...result.warnings.map((warning, index) =>
			adaptPhaseExitIssue(warning, index, "warning"),
		),
	];
}

function phaseExitReason(result: HePhaseExit): string {
	if (result.blockers.length > 0) {
		return `HE phase exit is blocked: ${result.blockers.join("; ")}`;
	}
	if (result.recommendation !== "continue") {
		return `HE phase exit is blocked by recommendation: ${result.recommendation}`;
	}
	if (result.warnings.length > 0) {
		return `HE phase exit may continue with warnings: ${result.warnings.join("; ")}`;
	}
	return "HE phase exit passed with all required gate evidence satisfied.";
}

function phaseExitEvidenceRefs(result: HePhaseExit): string[] {
	return uniqueStrings([
		`schema:${result.schemaVersion}`,
		`recommendation:${result.recommendation}`,
		...result.gates.map((gate) => `gate:${gate.gateId}:${gate.status}`),
		...result.gates.flatMap((gate) =>
			gate.evidenceRefs.map((ref) => `gate-evidence:${gate.gateId}:${ref.id}`),
		),
	]);
}

function phaseExitGateSummary(
	gates: HeGateResult[],
): Record<string, unknown>[] {
	return gates.map((gate) => ({
		gateId: gate.gateId,
		required: gate.required,
		executionMode: gate.executionMode,
		status: gate.status,
		safeToContinue: gate.safeToContinue,
		requiresHuman: gate.requiresHuman,
		reason: gate.reason,
		blockedReason: gate.blockedReason,
		evidenceRefs: gate.evidenceRefs.map((ref) => ref.id),
	}));
}

/**
 * Convert a validated HE phase-exit decision into the canonical operator-visible GateResult.
 *
 * The adapter is intentionally pure: it does not validate, read artifacts, run
 * tools, or mutate tracker state. It only exposes phase-exit blockers,
 * optional warnings, gate statuses, and compact evidence references in the same
 * shape as other harness gate outputs.
 *
 * @param result - The HE phase-exit decision to expose to gate consumers
 * @returns A canonical GateResult for operator-facing phase-exit visibility
 */
export function normaliseHePhaseExitResult(result: HePhaseExit): GateResult {
	const gate = "he-phase-exit";
	const findings = phaseExitFindings(result);

	return buildGateResult({
		gate,
		status: phaseExitStatus(result),
		findings,
		meta: {
			schemaVersion: result.schemaVersion,
			phase: result.phaseContext.phase,
			failingEvidencePresent: result.phaseContext.failingEvidencePresent,
			reviewFeedbackPresent: result.phaseContext.reviewFeedbackPresent,
			recommendation: result.recommendation,
			commitAllowed: result.commitAllowed,
			exitAllowed: result.exitAllowed,
			gateSummary: phaseExitGateSummary(result.gates),
		},
		decision: {
			reason: phaseExitReason(result),
			actionNow: phaseExitActionNow(result),
			actionLater: [
				"Re-run HE phase-exit aggregation after the next gate evidence change.",
			],
			evidenceRef: phaseExitEvidenceRefs(result),
		},
	});
}

export {
	normalisePreflightGateResult,
	normaliseReviewGateResult,
} from "./normalise-review-preflight.js";
