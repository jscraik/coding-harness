import { describe, expect, it } from "vitest";
import { hasLinearReference } from "./evidence.js";

describe("hasLinearReference", () => {
	it("accepts one-character team prefixes", () => {
		expect(hasLinearReference("Refs X-42")).toBe(true);
	});

	it("accepts the existing multi-character team form", () => {
		expect(hasLinearReference("Fixes JSC-388")).toBe(true);
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
