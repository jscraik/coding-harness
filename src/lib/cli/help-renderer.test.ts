import { describe, expect, it } from "vitest";
import {
	dedupeCommandHelpRows,
	renderCommandHelpRows,
} from "./help-renderer.js";

describe("help renderer", () => {
	it("dedupes duplicate command names while preserving first occurrence", () => {
		const rows = dedupeCommandHelpRows([
			{ name: "policy-gate", summary: "first" },
			{ name: "risk-tier", summary: "second" },
			{ name: "policy-gate", summary: "third" },
		]);

		expect(rows).toEqual([
			{ name: "policy-gate", summary: "first" },
			{ name: "risk-tier", summary: "second" },
		]);
	});

	it("renders deterministic aligned command rows", () => {
		const lines = renderCommandHelpRows([
			{ name: "risk-tier", summary: "Classify files by risk tier" },
			{ name: "risk-tier", summary: "duplicate" },
		]);

		expect(lines).toEqual(["  risk-tier        Classify files by risk tier"]);
	});
});
