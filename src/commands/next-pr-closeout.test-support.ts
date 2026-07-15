import {
	PR_CLOSEOUT_SCHEMA_VERSION,
	type PrCloseoutClaim,
	type PrCloseoutReport,
} from "../lib/pr-closeout.js";
import { HARNESS_CLOSEOUT_GATE_IDS } from "../lib/decision/he-phase-exit.js";
import type { HarnessAssuranceEntry } from "../lib/harness-assurance.js";

function readyClaim(claim: PrCloseoutClaim["claim"]): PrCloseoutClaim {
	return {
		claim,
		status: "pass",
		evidenceRef: `claim:${claim}`,
		source: "harness_gates",
		headSha: "abc123",
		freshness: "current",
		blockerClass: null,
		missingContext: null,
		verifiedAt: "2026-06-19T00:00:00.000Z",
	};
}

/** Provide complete passing claim evidence for next-pr closeout fixtures. */
export function readyClaims(): PrCloseoutClaim[] {
	const claims: PrCloseoutClaim["claim"][] = [
		"tests_passed",
		"ci_green",
		"review_threads_resolved",
		"pr_metadata_ready",
		"branch_current_with_base",
		"linear_tracker_state_aligned",
		"independent_review_status_known",
		"required_checks_match_current_head",
		"rollback_path_named_or_not_applicable",
	];
	return claims.map(readyClaim);
}

/** Provide the complete passing closeout-gate fixture set. */
export function readyHarnessGates(): PrCloseoutReport["harnessGates"]["gates"] {
	return HARNESS_CLOSEOUT_GATE_IDS.map((gateId) => ({
		gateId,
		required:
			gateId !== "he_fix_bugs" &&
			gateId !== "autofix" &&
			gateId !== "ubiquitous_language",
		status:
			gateId === "he_fix_bugs" || gateId === "autofix"
				? "not_applicable"
				: "pass",
		evidenceRefs: ["artifact:closeout-gates.json"],
		requiresHuman: false,
		blocker: null,
	}));
}

/** Provide passing and not-applicable assurance entries for fixture reports. */
export function readyAssuranceEntries(): HarnessAssuranceEntry[] {
	const evidence = ["artifact:assurance.json"];
	return [
		{ layer: "unit", status: "pass", evidence },
		{ layer: "boundary", status: "pass", evidence },
		{ layer: "mock_integration", status: "pass", evidence },
		{ layer: "e2e", status: "pass", evidence },
		{ layer: "security", status: "pass", evidence },
		{
			layer: "load_stress",
			status: "n.a.",
			evidence,
			reason: "Fixture does not exercise a load-sensitive production path.",
		},
		{
			layer: "lifecycle_closeout",
			status: "n.a.",
			evidence,
			reason: "Fixture covers consumer validation, not hosted closeout state.",
		},
	];
}

const READY_PR_CLOSEOUT_REPORT: PrCloseoutReport = {
	schemaVersion: PR_CLOSEOUT_SCHEMA_VERSION,
	generatedAt: "2026-06-19T00:00:00.000Z",
	pr: 437,
	url: "https://github.com/jscraik/coding-harness/pull/437",
	status: "ready",
	mergeable: true,
	nextAction: "ready_to_merge",
	blockers: [],
	claims: readyClaims(),
	checks: {
		total: 3,
		failed: 0,
		pending: 0,
		passed: 3,
		unknown: 0,
	},
	ciTelemetry: [],
	reviewThreads: {
		unresolved: 0,
		needsHuman: 0,
		autofixable: 0,
	},
	traceability: {
		sessionIds: ["codex-session:next-pr-closeout"],
		traceIds: ["trace:pr-closeout"],
		aiSessionTraceability: "Codex session captured closeout evidence.",
		complete: true,
	},
	harnessGates: {
		evidenceSource: "closeout_gates",
		closeoutGatesPresent: true,
		phaseExitPresent: false,
		recommendation: "continue",
		commitAllowed: true,
		exitAllowed: true,
		gates: readyHarnessGates(),
	},
	assurance: {
		present: true,
		valid: true,
		entries: readyAssuranceEntries(),
		findings: [],
	},
	runtimeEvidence: {
		present: false,
		valid: false,
		verifierStatus: null,
		outcome: null,
		exitClassification: null,
		findings: [],
	},
	deliveryTruth: {
		present: false,
		verdicts: [],
		blockingVerdicts: [],
		mergeReady: null,
	},
	lifecycleSnapshot: {
		schemaVersion: "delivery-lifecycle-snapshot/v1",
		generatedAt: "2026-06-19T00:00:00.000Z",
		worktreeRole: "implementation",
		linearMutation: "unknown",
		releaseReadinessImpact: "none",
		staleEvidenceClasses: [],
		handoffRequiredEvidence: [],
		lanes: [],
		latestValidationBlocker: null,
		reviewArtifacts: {
			expected: 0,
			missing: 0,
			empty: 0,
			ignoredRuntimePath: 0,
			unknown: 0,
			artifacts: [],
		},
		continuation: {
			nextSafeAction: "ready_to_merge",
			waitingOwner: "unknown",
			blocker: null,
		},
	},
	tools: [],
	dirtyPathsExcluded: [],
	attemptLedger: {
		schemaVersion: "attempt-ledger/v1",
		command: "pr-closeout",
		attempt: 1,
		maxAttempts: 1,
		firstFailure: null,
		retryDecision: "none",
		owner: "codex",
		stopReason: null,
		nextAction: "ready_to_merge",
		evidenceRefs: [],
	},
	recoveryEvent: null,
};

/** Build a complete ready report fixture with targeted test overrides. */
export function prCloseoutReport(
	overrides: Partial<PrCloseoutReport> = {},
): PrCloseoutReport {
	return { ...READY_PR_CLOSEOUT_REPORT, ...overrides };
}
