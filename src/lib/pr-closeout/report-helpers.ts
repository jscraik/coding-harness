import type { PrCloseoutCheckInput, PrCloseoutInput } from "./types.js";
import { isFailedCheck, isPassingCheck, isPendingCheck } from "./evidence.js";

/** Compact check-state counters included in pr-closeout/v1 reports. */
export function summarizeChecks(checks: readonly PrCloseoutCheckInput[]): {
	total: number;
	failed: number;
	pending: number;
	passed: number;
	unknown: number;
} {
	let failed = 0;
	let pending = 0;
	let passed = 0;
	let unknown = 0;
	for (const check of checks) {
		if (isFailedCheck(check)) failed += 1;
		else if (isPendingCheck(check)) pending += 1;
		else if (isPassingCheck(check)) passed += 1;
		else unknown += 1;
	}
	return { total: checks.length, failed, pending, passed, unknown };
}

/** Compact traceability projection included in pr-closeout/v1 reports. */
export interface PrCloseoutTraceabilitySummary {
	sessionIds: string[];
	traceIds: string[];
	aiSessionTraceability: string | null;
	complete: boolean;
}

/** Build PR closeout traceability from explicit session, trace, or text evidence. */
export function buildTraceabilitySummary(
	input: PrCloseoutInput,
): PrCloseoutTraceabilitySummary {
	const traceability = input.traceability ?? {};
	const sessionIds = traceability.sessionIds ?? [];
	const traceIds = traceability.traceIds ?? [];
	const aiSessionTraceability = traceability.aiSessionTraceability ?? null;
	const complete =
		sessionIds.length > 0 ||
		traceIds.length > 0 ||
		hasConcreteTraceabilityText(aiSessionTraceability);
	return { sessionIds, traceIds, aiSessionTraceability, complete };
}

function hasConcreteTraceabilityText(value: string | null): boolean {
	const trimmed = value?.trim() ?? "";
	return (
		trimmed.length > 0 &&
		!/^(?:n\.?a\.?|not applicable|none required)\b/iu.test(trimmed)
	);
}
