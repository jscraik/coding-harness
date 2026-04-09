import type {
	VerifyGateExecutionClass,
	VerifyGateFailureClass,
} from "./run-state.js";

export interface VerifyFailureSignal {
	exitCode?: number;
	errorCode?: string;
	stderr?: string;
	timedOut?: boolean;
	classification?: VerifyGateFailureClass;
}

export interface VerifyRetryDecision {
	shouldRetry: boolean;
	nextAttempt: number | null;
	reason: string;
}

export interface VerifyRetryContext {
	executionClass: VerifyGateExecutionClass;
	failureClass: VerifyGateFailureClass;
	attempt: number;
	maxAttempts?: number;
}

export const DEFAULT_MAX_ATTEMPTS = 2;

/**
 * Validate and resolve the maximum number of attempts, defaulting to DEFAULT_MAX_ATTEMPTS when unspecified.
 *
 * @param maxAttempts - Optional user-specified maximum attempts; if `undefined`, `DEFAULT_MAX_ATTEMPTS` is used.
 * @returns The validated maximum attempts (an integer greater than or equal to 1).
 * @throws Error if `maxAttempts` is not an integer or is less than 1 (message: "maxAttempts must be a positive integer").
 */
function normaliseMaxAttempts(maxAttempts: number | undefined): number {
	const value = maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
	if (!Number.isInteger(value) || value < 1) {
		throw new Error("maxAttempts must be a positive integer");
	}
	return value;
}

/**
 * Determines whether retries are permitted for a verification gate run based on its execution mode and failure category.
 *
 * @param executionClass - The execution classification of the gate (for example, read-only parallel execution).
 * @param failureClass - The failure classification observed for the run (for example, transient infrastructure failures).
 * @returns `true` if the given combination of `executionClass` and `failureClass` is eligible for retry, `false` otherwise.
 */
export function isRetryEligible(
	executionClass: VerifyGateExecutionClass,
	failureClass: VerifyGateFailureClass,
): boolean {
	return (
		executionClass === "read_only_parallel" &&
		failureClass === "transient_infra"
	);
}

/**
 * Determines whether the given string contains any of the provided substrings using case-insensitive matching.
 *
 * @param haystack - The string to search within.
 * @param needles - Substrings to look for inside `haystack`.
 * @returns `true` if any `needle` is found in `haystack` (case-insensitive), `false` otherwise.
 */
function containsAny(haystack: string, needles: string[]): boolean {
	const lower = haystack.toLowerCase();
	return needles.some((needle) => lower.includes(needle.toLowerCase()));
}

/**
 * Determine the failure classification for a verification gate using an optional failure signal and a default.
 *
 * Inspects the provided `signal` for an explicit `classification`, timeout/exit-code indicators, and textual hints
 * in `errorCode` and `stderr` to choose between `contract_policy` and `transient_infra`. If the signal is absent
 * or contains no decisive indicators, the `defaultFailureClass` is used when it is one of those two; otherwise
 * `internal_unknown` is returned.
 *
 * @param defaultFailureClass - Fallback classification to use when the signal does not provide a decisive classification.
 * @param signal - Optional failure signal that may include an explicit `classification`, `timedOut`/`exitCode`, `errorCode`, and `stderr` hints.
 * @returns The chosen VerifyGateFailureClass: `contract_policy`, `transient_infra`, or `internal_unknown`.
 */
export function adaptFailureClass(
	defaultFailureClass: VerifyGateFailureClass,
	signal?: VerifyFailureSignal,
): VerifyGateFailureClass {
	if (!signal) {
		return defaultFailureClass;
	}

	if (signal.classification) {
		return signal.classification;
	}

	if (signal.timedOut || signal.exitCode === 124) {
		return "transient_infra";
	}

	if (signal.errorCode) {
		if (
			containsAny(signal.errorCode, [
				"contract",
				"policy",
				"validation",
				"required",
			])
		) {
			return "contract_policy";
		}
		if (containsAny(signal.errorCode, ["timeout", "network", "rate"])) {
			return "transient_infra";
		}
	}

	if (signal.stderr) {
		if (
			containsAny(signal.stderr, [
				"contract",
				"policy",
				"required",
				"must",
				"mismatch",
			])
		) {
			return "contract_policy";
		}
		if (containsAny(signal.stderr, ["timeout", "network", "unavailable"])) {
			return "transient_infra";
		}
	}

	if (defaultFailureClass === "contract_policy") {
		return "contract_policy";
	}

	if (defaultFailureClass === "transient_infra") {
		return "transient_infra";
	}

	return "internal_unknown";
}

/**
 * Determine whether a verification attempt should be retried given execution/failure classification and attempt limits.
 *
 * @param context - Decision inputs: `executionClass` and `failureClass` determine eligibility; `attempt` is the current 1-based attempt index; optional `maxAttempts` overrides the default limit.
 * @returns An object describing the decision:
 *  - `shouldRetry`: `true` if the combination is eligible for retry and `attempt` is less than the resolved max attempts, `false` otherwise.
 *  - `nextAttempt`: the next attempt number when `shouldRetry` is `true`, or `null` when not retrying.
 *  - `reason`: one of `"retry_not_eligible"`, `"retry_exhausted"`, or `"retry_transient_read_only_failure"` explaining the decision.
 * @throws Error if `context.attempt` is not an integer greater than or equal to 1.
 */
export function decideRetry(context: VerifyRetryContext): VerifyRetryDecision {
	const maxAttempts = normaliseMaxAttempts(context.maxAttempts);
	if (!Number.isInteger(context.attempt) || context.attempt < 1) {
		throw new Error("attempt must be a positive integer");
	}

	if (!isRetryEligible(context.executionClass, context.failureClass)) {
		return {
			shouldRetry: false,
			nextAttempt: null,
			reason: "retry_not_eligible",
		};
	}

	if (context.attempt >= maxAttempts) {
		return {
			shouldRetry: false,
			nextAttempt: null,
			reason: "retry_exhausted",
		};
	}

	return {
		shouldRetry: true,
		nextAttempt: context.attempt + 1,
		reason: "retry_transient_read_only_failure",
	};
}
