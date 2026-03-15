/**
 * src/lib/review-gate/types.ts
 *
 * Canonical type definitions for the review-gate domain.
 * Extracted from src/commands/review-gate.ts to break the circular import
 * between src/commands/review-gate.ts and src/lib/review-gate/decision-packet.ts.
 *
 * Consumers should import from here; src/commands/review-gate.ts re-exports
 * for backward compatibility.
 */

export type ReviewDecisionState =
	| "green-and-ready"
	| "blocked-with-remediation"
	| "escalated-for-decision";

export type ReviewPRClosureStatus =
	| "ready-to-merge"
	| "awaiting-remediation"
	| "awaiting-operator-decision";

export type ReviewGateErrorCode =
	| "VALIDATION_ERROR"
	| "NOT_FOUND"
	| "PERMISSION_DENIED"
	| "TIMEOUT"
	| "SYSTEM_ERROR";

export interface ReviewGateOptions {
	contractPath: string;
	token: string;
	owner: string;
	repo: string;
	prNumber: number;
	headSha: string;
	checkName: string;
	botLogin?: string;
	autoResolveBotThreads?: boolean;
	json?: boolean;
	runRecordsDir?: string;
}

export interface ReviewGateOutput {
	verified: boolean;
	headSha: string;
	checkStatus: "completed" | "in_progress" | "queued" | "pending" | "not_found";
	checkConclusion?: string | undefined;
	needsRerun: boolean;
	timedOut?: boolean;
	policy_gate_status: "pass" | "fail" | "pending" | "missing";
	plan_traceability_status: "pass" | "fail" | "missing";
	plan_ids: string[];
	blockers: string[];
	actionable_count: number;
	informational_count: number;
	confidence_rubric: {
		score: 1 | 2 | 3 | 4 | 5;
		level: "low" | "medium" | "high";
		rationale: string[];
	};
}

export type ReviewGateResult =
	| { ok: true; output: ReviewGateOutput }
	| { ok: false; error: { code: string; message: string } };
