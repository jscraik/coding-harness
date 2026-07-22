import type { REQUIREMENTS } from "./context-contract.js";
import {
	createSynaipseContextFailure,
	type SynaipseContextFailure,
	type SynaipseContextFailureCode,
} from "./context-failures.js";

/** Internal blocker vocabulary before it is projected to the canonical envelope. */
export type ContextResolutionIssueCode =
	| "access_denied"
	| "historical_context"
	| "missing_context"
	| "provider_unavailable"
	| "stale_digest"
	| "superseded_context"
	| "unresolved_host_path";

/** One deterministic context issue ready for canonical failure projection. */
export type ContextResolutionIssue = {
	code: ContextResolutionIssueCode;
	contextId: string;
	requirement: (typeof REQUIREMENTS)[number];
	observedAt: string;
};

/** Map the pre-existing internal blocker vocabulary to the CC2 taxonomy. */
function canonicalFailureCode(
	code: ContextResolutionIssueCode,
	requirement: (typeof REQUIREMENTS)[number],
): SynaipseContextFailureCode {
	if (code === "access_denied") return "context_access_denied";
	if (code === "historical_context") return "superseded_context";
	if (code === "superseded_context") return "superseded_context";
	if (code === "missing_context")
		return requirement === "optional"
			? "missing_optional_context"
			: "missing_required_context";
	if (code === "stale_digest") return "stale_context_digest";
	return code;
}

/** Build the versioned failure record without retrieving provider bodies. */
export function contextFailureFromIssue(
	issue: ContextResolutionIssue,
): SynaipseContextFailure {
	const code = canonicalFailureCode(issue.code, issue.requirement);
	return createSynaipseContextFailure({
		code,
		requirement: issue.requirement,
		contextId: issue.contextId,
		evidenceRefs: [`context:${issue.contextId}`],
		observedAt: issue.observedAt,
	});
}
