import { describe, expect, it } from "vitest";
import {
	EXIT_CODES,
	runObservabilityGate,
	runObservabilityGateCLI,
} from "./observability-gate.js";

describe("observability-gate", () => {
	describe("runObservabilityGate", () => {
		it("passes with valid labels", () => {
			const result = runObservabilityGate({
				labels: JSON.stringify({ status: "success", method: "GET" }),
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.passed).toBe(true);
				expect(result.output.violations).toHaveLength(0);
			}
		});

		it("detects violations in labels", () => {
			const result = runObservabilityGate({
				labels: JSON.stringify({
					status: "success",
					query: "user search with lots of text content here",
				}),
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.passed).toBe(false);
				expect(result.output.violations.length).toBeGreaterThan(0);
			}
		});

		it("returns error for invalid JSON", () => {
			const result = runObservabilityGate({
				labels: "not valid json",
			});

			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error.code).toBe("VALIDATION_ERROR");
			}
		});

		it("handles empty labels", () => {
			const result = runObservabilityGate({});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.output.passed).toBe(true);
				expect(result.output.labelsChecked).toBe(0);
			}
		});
	});

	describe("runObservabilityGateCLI", () => {
		it("returns SUCCESS for valid labels", () => {
			const exitCode = runObservabilityGateCLI({
				labels: JSON.stringify({ status: "success" }),
				json: true,
			});

			expect(exitCode).toBe(EXIT_CODES.SUCCESS);
		});

		it("returns VIOLATION_FOUND when violations exist", () => {
			const exitCode = runObservabilityGateCLI({
				labels: JSON.stringify({ email: "test@example.com" }),
				json: true,
			});

			expect(exitCode).toBe(EXIT_CODES.VIOLATION_FOUND);
		});

		it("returns VALIDATION_ERROR for invalid JSON", () => {
			const exitCode = runObservabilityGateCLI({
				labels: "invalid",
				json: true,
			});

			expect(exitCode).toBe(EXIT_CODES.VALIDATION_ERROR);
		});
	});
});
