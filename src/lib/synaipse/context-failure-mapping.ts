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

const CONTEXT_FAILURE_RECOVERIES: Record<SynaipseContextFailureCode, string> = {
	missing_project_identity: "establish_project_identity",
	missing_context_catalog: "admit_context_catalog",
	missing_required_context: "supply_required_context",
	context_access_denied: "request_authorized_projection",
	stale_context_digest: "refresh_context_digest",
	superseded_context: "select_replacement_context",
	malformed_context_catalog: "repair_context_catalog",
	provider_unavailable: "restore_context_provider",
	unresolved_host_path: "resolve_context_host_path",
};

/** Map the pre-existing internal blocker vocabulary to the CC2 taxonomy. */
function canonicalFailureCode(
	code: ContextResolutionIssueCode,
): SynaipseContextFailureCode {
	if (code === "access_denied") return "context_access_denied";
	if (code === "historical_context" || code === "superseded_context")
		return "superseded_context";
	if (code === "missing_context") return "missing_required_context";
	if (code === "stale_digest") return "stale_context_digest";
	return code;
}

/** Mark digest failures stale and all other observations current. */
function failureFreshness(code: SynaipseContextFailureCode) {
	return code === "stale_context_digest"
		? ("stale" as const)
		: ("current" as const);
}

/** Build the versioned failure record without retrieving provider bodies. */
export function contextFailureFromIssue(
	issue: ContextResolutionIssue,
): SynaipseContextFailure {
	const code = canonicalFailureCode(issue.code);
	return createSynaipseContextFailure({
		code,
		requirement: issue.requirement,
		contextId: issue.contextId,
		recovery: CONTEXT_FAILURE_RECOVERIES[code],
		evidenceRefs: [`context:${issue.contextId}`],
		freshness: failureFreshness(code),
		observedAt: issue.observedAt,
	});
}
