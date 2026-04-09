import { describe, expect, it } from "vitest";
import {
	DEFAULT_MAX_ATTEMPTS,
	adaptFailureClass,
	decideRetry,
	isRetryEligible,
} from "./retry-policy.js";

describe("verify retry-policy", () => {
	it("retries only transient read-only failures", () => {
		expect(isRetryEligible("read_only_parallel", "transient_infra")).toBe(true);
		expect(isRetryEligible("serial_guarded", "transient_infra")).toBe(false);
		expect(isRetryEligible("read_only_parallel", "contract_policy")).toBe(
			false,
		);

		const decision = decideRetry({
			executionClass: "read_only_parallel",
			failureClass: "transient_infra",
			attempt: 1,
			maxAttempts: DEFAULT_MAX_ATTEMPTS,
		});
		expect(decision).toEqual({
			shouldRetry: true,
			nextAttempt: 2,
			reason: "retry_transient_read_only_failure",
		});
	});

	it("stops retrying when attempts are exhausted", () => {
		const decision = decideRetry({
			executionClass: "read_only_parallel",
			failureClass: "transient_infra",
			attempt: 2,
			maxAttempts: 2,
		});

		expect(decision).toEqual({
			shouldRetry: false,
			nextAttempt: null,
			reason: "retry_exhausted",
		});
	});

	it("classifies explicit policy signals as contract-policy failures", () => {
		const adapted = adaptFailureClass("transient_infra", {
			errorCode: "POLICY_MISMATCH",
			stderr: "required check mismatch for branch",
		});

		expect(adapted).toBe("contract_policy");
	});

	it("classifies timeout-style signals as transient infra failures", () => {
		const timeoutAdapted = adaptFailureClass("internal_unknown", {
			timedOut: true,
		});
		expect(timeoutAdapted).toBe("transient_infra");

		const networkAdapted = adaptFailureClass("internal_unknown", {
			stderr: "network unavailable during gate execution",
		});
		expect(networkAdapted).toBe("transient_infra");
	});

	it("returns default when no signal is provided", () => {
		expect(adaptFailureClass("contract_policy")).toBe("contract_policy");
		expect(adaptFailureClass("transient_infra")).toBe("transient_infra");
		expect(adaptFailureClass("internal_unknown")).toBe("internal_unknown");
	});

	it("uses explicit classification from signal over all other heuristics", () => {
		// Even if errorCode suggests contract, explicit classification wins
		const adapted = adaptFailureClass("contract_policy", {
			classification: "transient_infra",
			errorCode: "POLICY_CONFLICT",
		});
		expect(adapted).toBe("transient_infra");
	});

	it("classifies exitCode 124 as transient_infra", () => {
		const adapted = adaptFailureClass("internal_unknown", { exitCode: 124 });
		expect(adapted).toBe("transient_infra");
	});

	it("classifies rate-limit error codes as transient_infra", () => {
		const adapted = adaptFailureClass("internal_unknown", {
			errorCode: "RATE_LIMIT_EXCEEDED",
		});
		expect(adapted).toBe("transient_infra");
	});

	it("classifies timeout error codes as transient_infra", () => {
		const adapted = adaptFailureClass("internal_unknown", {
			errorCode: "GATEWAY_TIMEOUT",
		});
		expect(adapted).toBe("transient_infra");
	});

	it("classifies validation error codes as contract_policy", () => {
		const adapted = adaptFailureClass("transient_infra", {
			errorCode: "VALIDATION_FAILED",
		});
		expect(adapted).toBe("contract_policy");
	});

	it("classifies required-check error codes as contract_policy", () => {
		const adapted = adaptFailureClass("internal_unknown", {
			errorCode: "REQUIRED_CHECK_MISSING",
		});
		expect(adapted).toBe("contract_policy");
	});

	it("falls back to defaultFailureClass for unrecognized signals", () => {
		// An error code that doesn't match any heuristic
		expect(
			adaptFailureClass("contract_policy", { errorCode: "UNKNOWN_ERROR_XYZ" }),
		).toBe("contract_policy");
		expect(
			adaptFailureClass("transient_infra", { errorCode: "UNKNOWN_ERROR_XYZ" }),
		).toBe("transient_infra");
		expect(
			adaptFailureClass("internal_unknown", { errorCode: "UNKNOWN_ERROR_XYZ" }),
		).toBe("internal_unknown");
	});

	it("is not retry eligible for internal_unknown on read_only_parallel", () => {
		expect(isRetryEligible("read_only_parallel", "internal_unknown")).toBe(
			false,
		);
	});

	it("is not retry eligible for contract_policy on serial_guarded", () => {
		expect(isRetryEligible("serial_guarded", "contract_policy")).toBe(false);
	});

	it("does not retry when failureClass is internal_unknown on read_only_parallel", () => {
		const decision = decideRetry({
			executionClass: "read_only_parallel",
			failureClass: "internal_unknown",
			attempt: 1,
		});
		expect(decision.shouldRetry).toBe(false);
		expect(decision.reason).toBe("retry_not_eligible");
	});

	it("does not retry contract_policy failures even on read-only gates", () => {
		const decision = decideRetry({
			executionClass: "read_only_parallel",
			failureClass: "contract_policy",
			attempt: 1,
		});
		expect(decision.shouldRetry).toBe(false);
		expect(decision.reason).toBe("retry_not_eligible");
	});

	it("throws when attempt is zero", () => {
		expect(() =>
			decideRetry({
				executionClass: "read_only_parallel",
				failureClass: "transient_infra",
				attempt: 0,
			}),
		).toThrow("attempt must be a positive integer");
	});

	it("throws when maxAttempts is zero", () => {
		expect(() =>
			decideRetry({
				executionClass: "read_only_parallel",
				failureClass: "transient_infra",
				attempt: 1,
				maxAttempts: 0,
			}),
		).toThrow("maxAttempts must be a positive integer");
	});

	it("throws when maxAttempts is non-integer", () => {
		expect(() =>
			decideRetry({
				executionClass: "read_only_parallel",
				failureClass: "transient_infra",
				attempt: 1,
				maxAttempts: 1.5,
			}),
		).toThrow("maxAttempts must be a positive integer");
	});

	it("uses DEFAULT_MAX_ATTEMPTS when maxAttempts is not specified", () => {
		const decision = decideRetry({
			executionClass: "read_only_parallel",
			failureClass: "transient_infra",
			attempt: DEFAULT_MAX_ATTEMPTS,
		});
		// At the limit, should NOT retry
		expect(decision.shouldRetry).toBe(false);
		expect(decision.reason).toBe("retry_exhausted");
	});

	it("classifies stderr containing 'must' as contract_policy", () => {
		const adapted = adaptFailureClass("internal_unknown", {
			stderr: "Branch name must include a Linear issue key",
		});
		expect(adapted).toBe("contract_policy");
	});

	it("classifies stderr containing 'mismatch' as contract_policy", () => {
		const adapted = adaptFailureClass("internal_unknown", {
			stderr: "Check name mismatch detected in ci-required-checks.json",
		});
		expect(adapted).toBe("contract_policy");
	});
});
