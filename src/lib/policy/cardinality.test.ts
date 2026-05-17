import { describe, expect, it } from "vitest";
import {
	estimateCardinality,
	hashString,
	isPayloadLoggingAllowed,
	looksLikeUserInput,
	sanitizeLabelValue,
	validateLabelValue,
	validateMetricLabels,
} from "./cardinality.js";

describe("hashString", () => {
	it("returns consistent hash for same input", () => {
		expect(hashString("test")).toBe("hash_00364492");
	});

	it("returns different hashes for different inputs", () => {
		const hash1 = hashString("test1");
		const hash2 = hashString("test2");
		expect(hash1).not.toBe(hash2);
	});

	it("produces fixed-length output", () => {
		const hash = hashString("a very long string with lots of content");
		expect(hash.length).toBeLessThanOrEqual(16);
	});
});

describe("sanitizeLabelValue", () => {
	it("returns short values unchanged", () => {
		const result = sanitizeLabelValue("short");
		expect(result).toBe("short");
	});

	it("hashes long values", () => {
		const longValue = "a".repeat(200);
		const result = sanitizeLabelValue(longValue);
		expect(result).toMatch(/^hash_/);
		expect(result.length).toBeLessThan(longValue.length);
	});
});

describe("looksLikeUserInput", () => {
	it("detects long strings as user input", () => {
		expect(looksLikeUserInput("a".repeat(60))).toBe(true);
	});

	it("detects sentences as user input", () => {
		expect(looksLikeUserInput("This is a user query.")).toBe(true);
	});

	it("allows short categorical values", () => {
		expect(looksLikeUserInput("error")).toBe(false);
		expect(looksLikeUserInput("GET")).toBe(false);
	});
});

describe("validateLabelValue", () => {
	it("returns null for valid label", () => {
		const result = validateLabelValue("status", "success");
		expect(result).toBeNull();
	});

	it("detects JSON in label", () => {
		const result = validateLabelValue("data", '{"key":"value"}');
		expect(result).not.toBeNull();
		expect(result?.type).toBe("HIGH_CARDINALITY_LABEL");
	});

	it("detects email-like values", () => {
		const result = validateLabelValue("user", "test@example.com");
		expect(result).not.toBeNull();
		expect(result?.type).toBe("HIGH_CARDINALITY_LABEL");
	});

	it("detects user input", () => {
		const result = validateLabelValue("query", "How do I reset my password?");
		expect(result).not.toBeNull();
		expect(result?.type).toBe("USER_INPUT_IN_LABEL");
	});

	it("detects long or user-input-like values", () => {
		const result = validateLabelValue("hash", "a".repeat(200));
		expect(result).not.toBeNull();
		// Long values may trigger either violation type
		expect(result?.type).toMatch(/HIGH_CARDINALITY_LABEL|USER_INPUT_IN_LABEL/);
	});
});

describe("validateMetricLabels", () => {
	it("returns empty array for valid labels", () => {
		const result = validateMetricLabels({
			status: "success",
			method: "GET",
		});
		expect(result).toHaveLength(0);
	});

	it("collects all violations", () => {
		const result = validateMetricLabels({
			status: "success",
			query: "user search query here",
			data: '{"json":"value"}',
		});
		expect(result.length).toBeGreaterThanOrEqual(2);
	});
});

describe("isPayloadLoggingAllowed", () => {
	it("allows when debug is enabled", () => {
		expect(isPayloadLoggingAllowed(true)).toBe(true);
	});

	it("denies when debug is disabled", () => {
		expect(isPayloadLoggingAllowed(false)).toBe(false);
	});
});

describe("estimateCardinality", () => {
	it("calculates unique count", () => {
		const result = estimateCardinality(["a", "b", "c", "a", "b"]);
		expect(result.unique).toBe(3);
	});

	it("calculates ratio", () => {
		const result = estimateCardinality(["a", "b", "c"]);
		expect(result.ratio).toBe(1);
	});

	it("detects high cardinality", () => {
		const values = Array.from({ length: 150 }, (_, i) => `value${i}`);
		const result = estimateCardinality(values);
		expect(result.highCardinality).toBe(true);
	});

	it("handles empty array", () => {
		const result = estimateCardinality([]);
		expect(result.unique).toBe(0);
		expect(result.ratio).toBe(0);
	});
});
