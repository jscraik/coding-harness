import { describe, expect, it } from "vitest";
import {
	dedupeCommandHelpRows,
	renderCommandHelpRows,
	renderGroupedCommandHelpRows,
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

		expect(lines).toEqual([
			"  risk-tier                Classify files by risk tier",
		]);
	});

	it("renders category-grouped command rows", () => {
		const lines = renderGroupedCommandHelpRows([
			{
				name: "next",
				summary: "Recommend next safe command",
				category: "bootstrap-governance",
				tier: "cockpit",
			},
			{
				name: "check",
				summary: "Zero-config repo health snapshot",
				category: "bootstrap-governance",
				tier: "cockpit",
			},
			{
				name: "policy-gate",
				summary: "Validate policy expectations from changed files",
				category: "review-policy",
			},
		]);

		expect(lines).toEqual([
			"  Agent Cockpit:",
			"    next                     Recommend next safe command",
			"    check                    Zero-config repo health snapshot",
			"",
			"  Review & Policy:",
			"    policy-gate              Validate policy expectations from changed files",
		]);
	});

	it("falls back to uncategorized heading when category is missing", () => {
		const lines = renderGroupedCommandHelpRows([
			{
				name: "commands",
				summary: "List machine-readable command metadata",
			},
		]);

		expect(lines).toEqual([
			"  Other:",
			"    commands                 List machine-readable command metadata",
		]);
	});

	it("renders known categories in deterministic order", () => {
		const lines = renderGroupedCommandHelpRows([
			{
				name: "policy-gate",
				summary: "Validate policy expectations from changed files",
				category: "review-policy",
			},
			{
				name: "commands",
				summary: "List machine-readable command metadata",
				category: "discovery",
			},
			{
				name: "check",
				summary: "Zero-config repo health snapshot",
				category: "bootstrap-governance",
			},
		]);

		expect(lines).toEqual([
			"  Discovery:",
			"    commands                 List machine-readable command metadata",
			"",
			"  Bootstrap & Governance:",
			"    check                    Zero-config repo health snapshot",
			"",
			"  Review & Policy:",
			"    policy-gate              Validate policy expectations from changed files",
		]);
	});
});
