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
import type { PlanGateResult } from "../plan-gate/types.js";
import type { GateFailureClass } from "../policy/required-checks.js";
import type { PreflightGateResult } from "../preflight/types.js";
import type {
	ReviewGateOutput,
	ReviewGateResult,
} from "../review-gate/types.js";
import { getVersion } from "../version.js";
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

interface GateDecisionOverrides {
	reason?: string;
	actionNow?: string[];
	actionLater?: string[];
	evidenceRef?: string[];
}

interface BuildGateResultParams {
	gate: string;
	status: GateResult["status"];
	findings: GateFinding[];
	timestamp?: string;
	meta?: Record<string, unknown>;
	decision?: GateDecisionOverrides;
}

function uniqueStrings(values: Array<string | undefined>): string[] {
	const out: string[] = [];
	for (const value of values) {
		if (!value) continue;
		const trimmed = value.trim();
		if (!trimmed || out.includes(trimmed)) continue;
		out.push(trimmed);
	}
	return out;
}

function defaultReason(
	gate: string,
	status: GateResult["status"],
	findings: GateFinding[],
): string {
	if (status === "pass") {
		return `${gate} passed with no blocking findings.`;
	}
	if (status === "warn") {
		const warningCount = findings.filter(
			(f) => f.severity === "warning",
		).length;
		return `${gate} reported non-blocking warnings (${warningCount}).`;
	}
	if (status === "skipped") {
		return `${gate} was skipped.`;
	}
	const errorCount = findings.filter((f) => f.severity === "error").length;
	return `${gate} reported blocking findings (${errorCount}).`;
}

function defaultActionNow(
	gate: string,
	status: GateResult["status"],
	findings: GateFinding[],
): string[] {
	if (status === "pass") {
		return [];
	}
	const fixes = uniqueStrings(
		findings.flatMap((finding) => [finding.fix.command, finding.fix.manual]),
	);
	if (fixes.length > 0) {
		return fixes;
	}
	if (status === "warn") {
		return [`Review warnings and rerun harness ${gate}.`];
	}
	if (status === "skipped") {
		return [`Run harness ${gate} once prerequisites are available.`];
	}
	return [`Resolve blocking findings and rerun harness ${gate}.`];
}

function defaultActionLater(
	gate: string,
	status: GateResult["status"],
): string[] {
	if (status === "pass") {
		return [`Re-run harness ${gate} after the next relevant change.`];
	}
	if (status === "warn") {
		return [`Automate repeated warning remediation for ${gate}.`];
	}
	if (status === "skipped") {
		return [`Add ${gate} to the regular validation flow.`];
	}
	return [`Add regression coverage to prevent future ${gate} failures.`];
}

function defaultEvidenceRef(gate: string, findings: GateFinding[]): string[] {
	const refs = uniqueStrings(
		findings.flatMap((finding) => [
			finding.path ? `path:${finding.path}` : undefined,
			`finding:${finding.id}`,
		]),
	);
	return refs.length > 0 ? refs : [`gate:${gate}`];
}

function buildGateResult(params: BuildGateResultParams): GateResult {
	const { gate, status, findings, timestamp, meta, decision } = params;
	const errors = findings.filter((f) => f.severity === "error").length;
	const warnings = findings.filter((f) => f.severity === "warning").length;
	const info = findings.filter((f) => f.severity === "info").length;

	const reason = decision?.reason ?? defaultReason(gate, status, findings);
	const action_now =
		decision?.actionNow ?? defaultActionNow(gate, status, findings);
	const action_later =
		decision?.actionLater ?? defaultActionLater(gate, status);
	const evidence_ref =
		decision?.evidenceRef ?? defaultEvidenceRef(gate, findings);

	return {
		gate,
		version: getVersion(),
		timestamp: timestamp ?? new Date().toISOString(),
		status,
		findings,
		summary: { errors, warnings, info, total: errors + warnings + info },
		reason,
		action_now,
		action_later,
		evidence_ref,
		...(meta ? { meta } : {}),
	};
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
		fix: {
			...(f.fix?.command !== undefined ? { command: f.fix.command } : {}),
			...(f.fix?.manual !== undefined ? { manual: f.fix.manual } : {}),
			suppressible: f.fix?.suppressible ?? false,
		},
	};
}

/**
 * Normalise a DriftGateResult to canonical GateResult.
 * Status mapping:
 *   report.outcome === "error" → "fail"
 *   report.status  === "blocked" → "fail"
 *   report.status  === "partial" → "warn"
 *   otherwise → "pass"
 */
export function normaliseDriftGateResult(result: DriftGateResult): GateResult {
	const gate = "drift-gate";
	const timestamp = result.report.generated_at ?? new Date().toISOString();

	const findings = result.report.findings.map(adaptDriftFinding);

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

function reviewStatusFromOutput(
	output: ReviewGateOutput,
): GateResult["status"] {
	if (output.verified) {
		return "pass";
	}
	if (
		output.timedOut ||
		output.checkStatus === "in_progress" ||
		output.checkStatus === "queued" ||
		output.checkStatus === "pending"
	) {
		return "warn";
	}
	return "fail";
}

type ReviewGateFailureClass =
	| "contract_invalid"
	| "admission_incomplete"
	| "admission_unjustified"
	| "review_evidence_contradiction"
	| "surface_registration_gap"
	| "drift_blocking"
	| "safety_floor_violation"
	| "cadence_breach"
	| "required_check_missing"
	| "required_check_pending"
	| "required_check_failed"
	| "required_check_source_mismatch"
	| "review_missing"
	| "reviewer_independence"
	| "review_thread_unresolved"
	| "plan_traceability_gap"
	| "review_blocked_unknown";

function classifyReviewGateBlocker(blocker: string): ReviewGateFailureClass {
	const explicitFailureClass = blocker.match(
		/\b(contract_invalid|admission_incomplete|admission_unjustified|review_evidence_contradiction|surface_registration_gap|drift_blocking|safety_floor_violation|cadence_breach):/u,
	)?.[1] as ReviewGateFailureClass | undefined;
	if (explicitFailureClass) {
		return explicitFailureClass;
	}

	if (
		blocker.includes("non-authoritative providers") ||
		blocker.includes("expected source:")
	) {
		return "required_check_source_mismatch";
	}
	if (
		blocker.includes("was not found for current HEAD SHA") ||
		blocker.includes("check run not found for HEAD SHA")
	) {
		return "required_check_missing";
	}
	if (
		blocker.includes("is not complete") ||
		blocker.includes("verification is incomplete") ||
		/\bpending\b/iu.test(blocker)
	) {
		return "required_check_pending";
	}
	if (
		blocker.includes("did not pass") ||
		blocker.includes("conclusion:") ||
		/\bfailed\b/iu.test(blocker)
	) {
		return "required_check_failed";
	}
	if (
		blocker.includes("No APPROVED reviews found") ||
		/\bmissing approval\b/iu.test(blocker)
	) {
		return "review_missing";
	}
	if (blocker.includes("Reviewer independence failed")) {
		return "reviewer_independence";
	}
	if (blocker.includes("Unresolved review thread comments remain")) {
		return "review_thread_unresolved";
	}
	if (blocker.startsWith("Plan traceability:")) {
		return "plan_traceability_gap";
	}

	return "review_blocked_unknown";
}

/**
 * Normalise preflight-gate output to canonical GateResult.
 */
export function normalisePreflightGateResult(
	result: PreflightGateResult,
): GateResult {
	const gate = "preflight-gate";
	type AdmissionFailureClass =
		| "admission_incomplete"
		| "admission_unjustified"
		| "surface_registration_gap";
	const admissionFailureClasses = new Set<AdmissionFailureClass>([
		"admission_incomplete",
		"admission_unjustified",
		"surface_registration_gap",
	]);
	const admissionFailureClassRegex =
		/\b(admission_incomplete|admission_unjustified|surface_registration_gap):/g;
	const extractAdmissionFailureClasses = (
		message: string | undefined,
	): AdmissionFailureClass[] => {
		if (!message) {
			return ["admission_incomplete"];
		}
		const matches = [...message.matchAll(admissionFailureClassRegex)]
			.map((match) => match[1] as AdmissionFailureClass)
			.filter((failureClass) => admissionFailureClasses.has(failureClass));
		const deduped = uniqueStrings(matches).filter(
			(candidate): candidate is AdmissionFailureClass =>
				admissionFailureClasses.has(candidate as AdmissionFailureClass),
		);
		return deduped.length > 0 ? deduped : ["admission_incomplete"];
	};
	const findings = result.checks
		.filter((check) => !check.passed)
		.flatMap((check): GateFinding[] => {
			if (check.id !== "admission-declaration") {
				const findingId = `preflight-gate.check.${check.id}`;
				return [
					{
						id: findingId,
						severity: check.severity,
						gate,
						message: check.message ?? check.description,
						...(check.files?.[0] ? { path: check.files[0] } : {}),
						baseline: false,
						fix: {
							manual: `Resolve '${findingId}' and rerun harness preflight-gate.`,
							suppressible: false,
						},
					},
				];
			}
			return extractAdmissionFailureClasses(check.message).map(
				(failureClass) => {
					const findingId = `preflight-gate.blocker.${failureClass}`;
					return {
						id: findingId,
						severity: check.severity,
						gate,
						message: check.message ?? check.description,
						...(check.files?.[0] ? { path: check.files[0] } : {}),
						baseline: false,
						fix: {
							manual: `Resolve '${findingId}' and rerun harness preflight-gate.`,
							suppressible: false,
						},
					};
				},
			);
		});

	const status: GateResult["status"] = result.passed
		? findings.some((finding) => finding.severity === "error")
			? "fail"
			: findings.some((finding) => finding.severity === "warning")
				? "warn"
				: "pass"
		: "fail";

	return buildGateResult({
		gate,
		status,
		findings,
		meta: {
			passed: result.passed,
			totalChecks: result.summary.total,
			passedChecks: result.summary.passed,
			failedChecks: result.summary.failed,
			warningChecks: result.summary.warnings,
			durationMs: result.summary.durationMs,
			blockedFailureClasses: uniqueStrings(
				findings
					.filter((finding) => finding.id.startsWith("preflight-gate.blocker."))
					.map((finding) => finding.id.replace("preflight-gate.blocker.", "")),
			),
			...(result.riskTier ? { riskTier: result.riskTier } : {}),
			...(result.northStarSummary
				? { northStarSummary: result.northStarSummary }
				: {}),
			...(result.admissionDeclaration
				? { admissionDeclaration: result.admissionDeclaration }
				: {}),
		},
		decision: {
			reason: result.passed
				? findings.length > 0
					? "Preflight passed with warning findings."
					: "Preflight checks passed."
				: "Preflight checks found blocking issues.",
			evidenceRef: (() => {
				const refs = uniqueStrings([
					...(result.riskTier ? [`risk-tier:${result.riskTier}`] : []),
					...findings.flatMap((finding) => [
						...(finding.path ? [`path:${finding.path}`] : []),
						`finding:${finding.id}`,
					]),
				]);
				return refs.length > 0 ? refs : ["gate:preflight-gate"];
			})(),
		},
	});
}

/**
 * Normalise review-gate output to canonical GateResult.
 */
export function normaliseReviewGateResult(
	result: ReviewGateResult,
	recoveryHint?: string,
): GateResult {
	const gate = "review-gate";

	if (!result.ok) {
		const finding: GateFinding = {
			id: "review-gate.result.internal",
			severity: "error",
			gate,
			message: result.error.message,
			baseline: false,
			fix: {
				...(recoveryHint ? { manual: recoveryHint } : {}),
				suppressible: false,
			},
		};
		return buildGateResult({
			gate,
			status: "fail",
			findings: [finding],
			meta: { errorCode: result.error.code },
			decision: {
				reason: result.error.message,
				actionNow: recoveryHint
					? [recoveryHint]
					: ["Resolve review-gate error and rerun harness review-gate."],
				evidenceRef: ["error:review-gate.result.internal"],
			},
		});
	}

	const status = reviewStatusFromOutput(result.output);
	const findingSeverity: GateFinding["severity"] =
		status === "warn" ? "warning" : "error";
	const blockerClassCounts = new Map<ReviewGateFailureClass, number>();
	const blockerClasses: ReviewGateFailureClass[] = [];
	const findings: GateFinding[] = result.output.blockers.map((blocker) => {
		const failureClass = classifyReviewGateBlocker(blocker);
		blockerClasses.push(failureClass);
		const occurrence = (blockerClassCounts.get(failureClass) ?? 0) + 1;
		blockerClassCounts.set(failureClass, occurrence);
		const findingId =
			occurrence === 1
				? `review-gate.blocker.${failureClass}`
				: `review-gate.blocker.${failureClass}.${occurrence}`;
		return {
			id: findingId,
			severity: findingSeverity,
			gate,
			message: blocker,
			baseline: false,
			fix: {
				manual: "Address blocker and rerun harness review-gate.",
				suppressible: false,
			},
		};
	});

	return buildGateResult({
		gate,
		status,
		findings,
		meta: {
			...(blockerClasses.length > 0
				? { blockedFailureClasses: uniqueStrings(blockerClasses) }
				: {}),
			headSha: result.output.headSha,
			checkStatus: result.output.checkStatus,
			checkConclusion: result.output.checkConclusion,
			needsRerun: result.output.needsRerun,
			timedOut: result.output.timedOut ?? false,
			policyGateStatus: result.output.policy_gate_status,
			planTraceabilityStatus: result.output.plan_traceability_status,
			planIds: result.output.plan_ids,
			actionableCount: result.output.actionable_count,
			informationalCount: result.output.informational_count,
			confidenceRubric: result.output.confidence_rubric,
		},
		decision: {
			reason: result.output.verified
				? `Review verified for SHA ${result.output.headSha}.`
				: result.output.blockers.length > 0
					? `Review is not merge-ready: ${result.output.blockers[0]}.`
					: `Review is not merge-ready (status: ${result.output.checkStatus}).`,
			...(result.output.blockers.length
				? { actionNow: result.output.blockers }
				: result.output.needsRerun
					? { actionNow: ["Rerun review checks and retry review-gate."] }
					: {}),
			actionLater: [
				"Re-run harness review-gate after blockers are resolved.",
				"Capture decision artifacts for merge readiness audits.",
			],
			evidenceRef: uniqueStrings([
				`sha:${result.output.headSha}`,
				...result.output.plan_ids.map((planId) => `plan:${planId}`),
				...findings.map((finding) => `finding:${finding.id}`),
			]),
		},
	});
}
