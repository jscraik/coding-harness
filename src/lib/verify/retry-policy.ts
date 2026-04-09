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

function normaliseMaxAttempts(maxAttempts: number | undefined): number {
	const value = maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
	if (!Number.isInteger(value) || value < 1) {
		throw new Error("maxAttempts must be a positive integer");
	}
	return value;
}

export function isRetryEligible(
	executionClass: VerifyGateExecutionClass,
	failureClass: VerifyGateFailureClass,
): boolean {
	return (
		executionClass === "read_only_parallel" &&
		failureClass === "transient_infra"
	);
}

function containsAny(haystack: string, needles: string[]): boolean {
	const lower = haystack.toLowerCase();
	return needles.some((needle) => lower.includes(needle.toLowerCase()));
}

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
