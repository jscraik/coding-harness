/** Agent testing layers that must be named explicitly in harness assurance evidence. */
export const HARNESS_ASSURANCE_LAYERS = [
	"unit",
	"boundary",
	"mock_integration",
	"e2e",
	"security",
	"load_stress",
	"lifecycle_closeout",
] as const;

/** Canonical agent testing layer names used by assurance plans and handoff evidence. */
export type HarnessAssuranceLayer = (typeof HARNESS_ASSURANCE_LAYERS)[number];

/** Status values for one assurance layer in a handoff or closeout matrix. */
export type HarnessAssuranceStatus = "pass" | "partial" | "blocked" | "n.a.";

/** Named blocker classes returned by the harness assurance validator. */
export type HarnessAssuranceBlockerClass =
	| "duplicate_layer"
	| "missing_evidence"
	| "missing_follow_up"
	| "missing_layer"
	| "missing_lifecycle_state"
	| "missing_reason"
	| "missing_threshold"
	| "unobserved_horizon";

/** Numeric load or stress threshold required before performance coverage can be claimed. */
export interface HarnessAssuranceThreshold {
	metric: string;
	operator: "<=" | ">=";
	unit: string;
	value: number;
	observed?: number;
}

/** Live-state proof required before a lifecycle closeout layer can be marked passing. */
export interface HarnessAssuranceLifecycleState {
	automationState: string;
	branchWorktreeState: string;
	linearState: string;
	mergeState: string;
	nextLaneRouting: string;
	prState: string;
	reviewThreadState: string;
	unobservedHorizon?: string | null;
}

/** One assurance-layer entry in a plan receipt, PR body, or closeout artifact. */
export interface HarnessAssuranceEntry {
	evidence?: string[];
	followUp?: string | null;
	layer: HarnessAssuranceLayer;
	lifecycleState?: HarnessAssuranceLifecycleState | null;
	reason?: string | null;
	status: HarnessAssuranceStatus;
	threshold?: HarnessAssuranceThreshold | null;
}

/** Validation finding for a malformed or overclaimed assurance entry. */
export interface HarnessAssuranceFinding {
	blockerClass: HarnessAssuranceBlockerClass;
	layer: HarnessAssuranceLayer;
	message: string;
}

/** Validation result for a set of assurance-layer entries. */
export interface HarnessAssuranceValidationResult {
	findings: HarnessAssuranceFinding[];
	valid: boolean;
}

const lifecycleFields = [
	"automationState",
	"branchWorktreeState",
	"linearState",
	"mergeState",
	"nextLaneRouting",
	"prState",
	"reviewThreadState",
] as const;

const thresholdOperators = new Set<HarnessAssuranceThreshold["operator"]>([
	"<=",
	">=",
]);

/** Validate assurance entries so handoff artifacts cannot silently overclaim test coverage. */
export function validateHarnessAssuranceEntries(
	entries: readonly HarnessAssuranceEntry[],
): HarnessAssuranceValidationResult {
	const findings: HarnessAssuranceFinding[] = [];
	const seenLayers = new Set<HarnessAssuranceLayer>();

	for (const entry of entries) {
		if (seenLayers.has(entry.layer)) {
			findings.push({
				blockerClass: "duplicate_layer",
				layer: entry.layer,
				message: `${entry.layer} assurance entries must appear at most once.`,
			});
		}
		seenLayers.add(entry.layer);

		if (!hasEvidence(entry)) {
			findings.push({
				blockerClass: "missing_evidence",
				layer: entry.layer,
				message: `${entry.layer} assurance entries require at least one evidence reference.`,
			});
		}

		if (entry.status !== "pass" && isBlank(entry.reason)) {
			findings.push({
				blockerClass: "missing_reason",
				layer: entry.layer,
				message: `${entry.layer} assurance entries marked ${entry.status} require a concrete reason.`,
			});
		}

		if (entry.status === "blocked" && isBlank(entry.followUp)) {
			findings.push({
				blockerClass: "missing_follow_up",
				layer: entry.layer,
				message: `${entry.layer} assurance entries marked blocked require a named follow-up owner or action.`,
			});
		}

		if (
			entry.layer === "load_stress" &&
			entry.status === "pass" &&
			!hasNumericThreshold(entry.threshold)
		) {
			findings.push({
				blockerClass: "missing_threshold",
				layer: entry.layer,
				message:
					"load_stress assurance entries marked pass require a finite numeric threshold.",
			});
		}

		if (entry.layer === "lifecycle_closeout" && entry.status === "pass") {
			validateLifecycleCloseout(entry, findings);
		}
	}

	for (const layer of HARNESS_ASSURANCE_LAYERS) {
		if (!seenLayers.has(layer)) {
			findings.push({
				blockerClass: "missing_layer",
				layer,
				message: `${layer} assurance entries must be present in the seven-layer matrix.`,
			});
		}
	}

	return {
		findings,
		valid: findings.length === 0,
	};
}

function hasEvidence(entry: HarnessAssuranceEntry): boolean {
	return (entry.evidence ?? []).some((item) => !isBlank(item));
}

function hasNumericThreshold(
	threshold: HarnessAssuranceThreshold | null | undefined,
): boolean {
	return (
		threshold !== null &&
		threshold !== undefined &&
		!isBlank(threshold.metric) &&
		!isBlank(threshold.unit) &&
		thresholdOperators.has(threshold.operator) &&
		Number.isFinite(threshold.value)
	);
}

function isBlank(value: string | null | undefined): boolean {
	return value === null || value === undefined || value.trim().length === 0;
}

function validateLifecycleCloseout(
	entry: HarnessAssuranceEntry,
	findings: HarnessAssuranceFinding[],
): void {
	const state = entry.lifecycleState;
	const missingState =
		state === null ||
		state === undefined ||
		lifecycleFields.some((field) => isBlank(state[field]));

	if (missingState) {
		findings.push({
			blockerClass: "missing_lifecycle_state",
			layer: entry.layer,
			message:
				"lifecycle_closeout assurance entries marked pass require PR, merge, branch/worktree, Linear, review-thread, automation, and next-lane state.",
		});
	}

	if (
		state !== null &&
		state !== undefined &&
		!isBlank(state.unobservedHorizon)
	) {
		findings.push({
			blockerClass: "unobserved_horizon",
			layer: entry.layer,
			message:
				"lifecycle_closeout assurance entries with an unobserved horizon cannot be marked pass.",
		});
	}
}
