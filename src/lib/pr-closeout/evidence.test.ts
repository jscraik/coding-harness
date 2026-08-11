import { describe, expect, it } from "vitest";
import { hasLinearReference } from "./evidence.js";

describe("hasLinearReference", () => {
	it("rejects one-character team prefixes by default", () => {
		expect(hasLinearReference("Refs X-42")).toBe(false);
	});

	it("accepts the existing multi-character team form", () => {
		expect(hasLinearReference("Fixes JSC-388")).toBe(true);
	});

	it("accepts one-character teams when explicitly configured", () => {
		expect(hasLinearReference("Refs X-42", ["X"])).toBe(true);
	});

	it("honors configured team prefixes", () => {
		expect(hasLinearReference("Refs X-42", ["X"])).toBe(true);
		expect(hasLinearReference("Refs EXPANSION-509", ["JSC"])).toBe(false);
	});

	it("rejects malformed or missing issue references", () => {
		expect(hasLinearReference("Refs X-")).toBe(false);
		expect(hasLinearReference("No issue reference")).toBe(false);
	});
});
