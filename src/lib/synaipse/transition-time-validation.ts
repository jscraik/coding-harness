import { isRecord } from "../decision/validators.js";
import { isRfc3339DateTime } from "./date-time.js";
import type { SynaipseTransitionValidationResult } from "./transition-contract.js";

type Errors = SynaipseTransitionValidationResult["errors"];

/** Add an error when an evidence observation postdates the transition decision. */
function rejectFutureObservation(
	observedAt: unknown,
	decidedAt: string,
	path: string,
	errors: Errors,
): void {
	if (
		isRfc3339DateTime(observedAt) &&
		Date.parse(observedAt) > Date.parse(decidedAt)
	)
		errors.push({
			path,
			message: "must not be later than decidedAt",
		});
}

/** Reject transition decisions that predate their cited evidence. */
export function validateEvidenceTimeOrder(
	value: Record<string, unknown>,
	errors: Errors,
): void {
	if (!isRfc3339DateTime(value.decidedAt)) return;
	const evidence = isRecord(value.evidence) ? value.evidence : null;
	if (!evidence) return;
	rejectFutureObservation(
		evidence.observedAt,
		value.decidedAt,
		"evidence.observedAt",
		errors,
	);
	const hostedMain = isRecord(evidence.hostedMain) ? evidence.hostedMain : null;
	if (hostedMain)
		rejectFutureObservation(
			hostedMain.observedAt,
			value.decidedAt,
			"evidence.hostedMain.observedAt",
			errors,
		);
}
