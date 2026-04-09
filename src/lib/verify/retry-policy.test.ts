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
});
