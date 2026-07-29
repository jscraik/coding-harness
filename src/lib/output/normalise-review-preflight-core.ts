import type { PreflightGateResult } from "../preflight/types.js";
import type {
	ReviewGateOutput,
	ReviewGateResult,
} from "../review-gate/types.js";
import { buildGateResult, uniqueStrings } from "./normalise-core.js";
import type { GateFinding, GateResult } from "./types.js";

type ReviewGateFailureClass =
	| "contract_invalid"
	| "admission_incomplete"
	| "admission_unjustified"
	| "review_evidence_incomplete"
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

/** Preserve a compact-contract exemption without presenting it as review evidence. */
function normaliseNotApplicableReviewGateResult(
	output: ReviewGateOutput,
): GateResult {
	return buildGateResult({
		gate: "review-gate",
		status: "skipped",
		findings: [],
		meta: {
			notApplicable: output.notApplicable,
			headSha: output.headSha,
			checkStatus: output.checkStatus,
			policyGateStatus: output.policy_gate_status,
			planTraceabilityStatus: output.plan_traceability_status,
			confidenceRubric: output.confidence_rubric,
		},
		decision: {
			reason: `Review gate is not applicable for SHA ${output.headSha}; no review evidence was evaluated.`,
			actionLater: [
				"Add a review policy before treating this lane as review evidence.",
			],
			evidenceRef: [
				`sha:${output.headSha}`,
				`review:not-applicable:${output.notApplicable}`,
			],
		},
	});
}

/** Map a review-gate blocker diagnostic to its stable failure classification. */
function classifyReviewGateBlocker(blocker: string): ReviewGateFailureClass {
	const explicitFailureClass = blocker.match(
		/\b(contract_invalid|admission_incomplete|admission_unjustified|review_evidence_incomplete|review_evidence_contradiction|surface_registration_gap|drift_blocking|safety_floor_violation|cadence_breach):/u,
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
						failureClass,
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

/** Normalise a structured review-gate error to canonical GateResult. */
function normaliseReviewGateError(
	error: Extract<ReviewGateResult, { ok: false }>["error"],
	recoveryHint?: string,
): GateResult {
	const gate = "review-gate";
	const finding: GateFinding = {
		id: "review-gate.result.internal",
		severity: "error",
		gate,
		message: error.message,
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
		meta: { errorCode: error.code },
		decision: {
			reason: error.message,
			actionNow: recoveryHint
				? [recoveryHint]
				: ["Resolve review-gate error and rerun harness review-gate."],
			evidenceRef: ["error:review-gate.result.internal"],
		},
	});
}

/** Normalise an evaluated review-gate result to canonical GateResult. */
function normaliseEvaluatedReviewGateResult(
	output: ReviewGateOutput,
): GateResult {
	const gate = "review-gate";
	const status = reviewStatusFromOutput(output);
	const findingSeverity: GateFinding["severity"] =
		status === "warn" ? "warning" : "error";
	const blockerClassCounts = new Map<ReviewGateFailureClass, number>();
	const blockerClasses: ReviewGateFailureClass[] = [];
	const findings: GateFinding[] = output.blockers.map((blocker) => {
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
			failureClass,
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
			headSha: output.headSha,
			checkStatus: output.checkStatus,
			checkConclusion: output.checkConclusion,
			needsRerun: output.needsRerun,
			timedOut: output.timedOut ?? false,
			policyGateStatus: output.policy_gate_status,
			planTraceabilityStatus: output.plan_traceability_status,
			planIds: output.plan_ids,
			actionableCount: output.actionable_count,
			informationalCount: output.informational_count,
			confidenceRubric: output.confidence_rubric,
		},
		decision: {
			reason: output.verified
				? `Review verified for SHA ${output.headSha}.`
				: output.blockers.length > 0
					? `Review is not merge-ready: ${output.blockers[0]}.`
					: `Review is not merge-ready (status: ${output.checkStatus}).`,
			...(output.blockers.length
				? { actionNow: output.blockers }
				: output.needsRerun
					? { actionNow: ["Rerun review checks and retry review-gate."] }
					: {}),
			actionLater: [
				"Re-run harness review-gate after blockers are resolved.",
				"Capture decision artifacts for merge readiness audits.",
			],
			evidenceRef: uniqueStrings([
				`sha:${output.headSha}`,
				...output.plan_ids.map((planId) => `plan:${planId}`),
				...findings.map((finding) => `finding:${finding.id}`),
			]),
		},
	});
}

/** Normalise review-gate output to canonical GateResult. */
export function normaliseReviewGateResult(
	result: ReviewGateResult,
	recoveryHint?: string,
): GateResult {
	if (!result.ok) {
		return normaliseReviewGateError(result.error, recoveryHint);
	}
	return result.output.notApplicable
		? normaliseNotApplicableReviewGateResult(result.output)
		: normaliseEvaluatedReviewGateResult(result.output);
}
