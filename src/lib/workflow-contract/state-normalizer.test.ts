import { describe, expect, it } from "vitest";
import {
	ALL_CANONICAL_STATES,
	CANONICAL_NON_TERMINAL_STATES,
	CANONICAL_TERMINAL_STATES,
	type CanonicalState,
	GITHUB_STATUS_ALIASES,
	LINEAR_STATUS_ALIASES,
	type StatusAliasMap,
	createStateNormalizer,
	validateAliasMap,
	validateTransitionsUseCanonical,
} from "./state-normalizer.js";

// ─── Helpers ────────────────────────────────────────────────────────────────────

function hasCode(findings: Array<{ code: string }>, code: string): boolean {
	return findings.some((f) => f.code === code);
}

// ─── createStateNormalizer ──────────────────────────────────────────────────────

describe("createStateNormalizer", () => {
	describe("with Linear aliases", () => {
		const normalizer = createStateNormalizer(LINEAR_STATUS_ALIASES);

		it("reports correct provider", () => {
			expect(normalizer.provider).toBe("linear");
		});

		it("translates tracker label to canonical state", () => {
			expect(normalizer.toCanonical("Todo")).toBe("S0 TODO");
			expect(normalizer.toCanonical("In Progress")).toBe("S1 IN_PROGRESS");
			expect(normalizer.toCanonical("In Review")).toBe("S2 IN_REVIEW");
			expect(normalizer.toCanonical("Done")).toBe("S3 DONE");
			expect(normalizer.toCanonical("Blocked")).toBe("S4 BLOCKED");
		});

		it("handles case-insensitive lookups", () => {
			expect(normalizer.toCanonical("todo")).toBe("S0 TODO");
			expect(normalizer.toCanonical("TODO")).toBe("S0 TODO");
			expect(normalizer.toCanonical("in progress")).toBe("S1 IN_PROGRESS");
			expect(normalizer.toCanonical("IN PROGRESS")).toBe("S1 IN_PROGRESS");
		});

		it("maps secondary labels to canonical states", () => {
			expect(normalizer.toCanonical("Backlog")).toBe("S0 TODO");
			expect(normalizer.toCanonical("Triage")).toBe("S0 TODO");
			expect(normalizer.toCanonical("Canceled")).toBe("S3 DONE");
			expect(normalizer.toCanonical("Cancelled")).toBe("S3 DONE");
			expect(normalizer.toCanonical("Duplicate")).toBe("S3 DONE");
			expect(normalizer.toCanonical("Review")).toBe("S2 IN_REVIEW");
		});

		it("returns null for unknown labels", () => {
			expect(normalizer.toCanonical("Unknown")).toBeNull();
			expect(normalizer.toCanonical("")).toBeNull();
		});

		it("translates canonical state to primary tracker label", () => {
			expect(normalizer.toTracker("S0 TODO")).toBe("Todo");
			expect(normalizer.toTracker("S1 IN_PROGRESS")).toBe("In Progress");
			expect(normalizer.toTracker("S2 IN_REVIEW")).toBe("In Review");
			expect(normalizer.toTracker("S3 DONE")).toBe("Done");
			expect(normalizer.toTracker("S4 BLOCKED")).toBe("Blocked");
		});

		it("returns null for unmapped canonical states", () => {
			expect(normalizer.toTracker("FAIL")).toBeNull();
		});

		it("checks if a label is known", () => {
			expect(normalizer.isKnownLabel("Todo")).toBe(true);
			expect(normalizer.isKnownLabel("todo")).toBe(true);
			expect(normalizer.isKnownLabel("Unknown Label")).toBe(false);
		});

		it("checks terminal states", () => {
			expect(normalizer.isTerminal("S3 DONE")).toBe(true);
			expect(normalizer.isTerminal("FAIL")).toBe(true);
			expect(normalizer.isTerminal("S1 IN_PROGRESS")).toBe(false);
			expect(normalizer.isTerminal("S4 BLOCKED")).toBe(false);
		});

		it("gets all labels for a canonical state", () => {
			const todoLabels = normalizer.getLabelsForState("S0 TODO");
			expect(todoLabels).toContain("Todo");
			expect(todoLabels).toContain("Backlog");
			expect(todoLabels).toContain("Triage");
			expect(todoLabels.length).toBe(3);

			const doneLabels = normalizer.getLabelsForState("S3 DONE");
			expect(doneLabels).toContain("Done");
			expect(doneLabels).toContain("Canceled");
			expect(doneLabels).toContain("Cancelled");
			expect(doneLabels).toContain("Duplicate");
		});

		it("returns empty array for unmapped states", () => {
			expect(normalizer.getLabelsForState("FAIL")).toEqual([]);
		});

		it("gets all known labels", () => {
			const labels = normalizer.getAllLabels();
			expect(labels.length).toBe(LINEAR_STATUS_ALIASES.aliases.length);
			expect(labels).toContain("Todo");
			expect(labels).toContain("In Progress");
		});
	});

	describe("with GitHub aliases", () => {
		const normalizer = createStateNormalizer(GITHUB_STATUS_ALIASES);

		it("translates GitHub statuses", () => {
			expect(normalizer.toCanonical("open")).toBe("S0 TODO");
			expect(normalizer.toCanonical("in_progress")).toBe("S1 IN_PROGRESS");
			expect(normalizer.toCanonical("review_requested")).toBe("S2 IN_REVIEW");
			expect(normalizer.toCanonical("closed")).toBe("S3 DONE");
			expect(normalizer.toCanonical("merged")).toBe("S3 DONE");
		});

		it("reverse maps primary labels", () => {
			expect(normalizer.toTracker("S0 TODO")).toBe("open");
			expect(normalizer.toTracker("S3 DONE")).toBe("closed");
		});
	});
});

// ─── validateAliasMap ──────────────────────────────────────────────────────────

describe("validateAliasMap", () => {
	it("validates the Linear alias map", () => {
		const result = validateAliasMap(LINEAR_STATUS_ALIASES);
		// Should pass (possibly with warnings for FAIL not having an alias)
		expect(result.summary.errors).toBe(0);
	});

	it("validates the GitHub alias map", () => {
		const result = validateAliasMap(GITHUB_STATUS_ALIASES);
		expect(result.summary.errors).toBe(0);
	});

	it("rejects empty aliases", () => {
		const map: StatusAliasMap = {
			provider: "custom",
			description: "empty",
			aliases: [],
		};
		const result = validateAliasMap(map);
		expect(hasCode(result.findings, "ALIAS_EMPTY")).toBe(true);
		expect(result.pass).toBe(false);
	});

	it("rejects invalid provider", () => {
		const map: StatusAliasMap = {
			provider: "bitbucket" as StatusAliasMap["provider"],
			description: "bad provider",
			aliases: [
				{
					tracker_label: "Open",
					canonical_state: "S0 TODO",
					primary: true,
				},
			],
		};
		const result = validateAliasMap(map);
		expect(hasCode(result.findings, "ALIAS_INVALID_PROVIDER")).toBe(true);
	});

	it("rejects invalid canonical state in alias", () => {
		const map: StatusAliasMap = {
			provider: "custom",
			description: "test",
			aliases: [
				{
					tracker_label: "Pending",
					canonical_state: "S99 UNKNOWN" as CanonicalState,
					primary: true,
				},
			],
		};
		const result = validateAliasMap(map);
		expect(hasCode(result.findings, "ALIAS_INVALID_CANONICAL_STATE")).toBe(
			true,
		);
	});

	it("rejects duplicate tracker labels (case-insensitive)", () => {
		const map: StatusAliasMap = {
			provider: "custom",
			description: "test",
			aliases: [
				{
					tracker_label: "Open",
					canonical_state: "S0 TODO",
					primary: true,
				},
				{
					tracker_label: "open",
					canonical_state: "S1 IN_PROGRESS",
					primary: true,
				},
			],
		};
		const result = validateAliasMap(map);
		expect(hasCode(result.findings, "ALIAS_DUPLICATE_LABEL")).toBe(true);
	});

	it("warns when a canonical state has no alias", () => {
		const map: StatusAliasMap = {
			provider: "custom",
			description: "test",
			aliases: [
				{
					tracker_label: "Open",
					canonical_state: "S0 TODO",
					primary: true,
				},
			],
		};
		const result = validateAliasMap(map);
		expect(hasCode(result.findings, "ALIAS_MISSING_STATE")).toBe(true);
		// Should be warnings, not errors
		const missings = result.findings.filter(
			(f) => f.code === "ALIAS_MISSING_STATE",
		);
		expect(missings.every((f) => f.severity === "warning")).toBe(true);
	});

	it("rejects a canonical state with no primary alias", () => {
		const map: StatusAliasMap = {
			provider: "custom",
			description: "test",
			aliases: [
				{
					tracker_label: "Backlog",
					canonical_state: "S0 TODO",
					primary: false,
				},
				{
					tracker_label: "Triage",
					canonical_state: "S0 TODO",
					primary: false,
				},
			],
		};
		const result = validateAliasMap(map);
		expect(hasCode(result.findings, "ALIAS_NO_PRIMARY")).toBe(true);
	});

	it("rejects multiple primary aliases for same state", () => {
		const map: StatusAliasMap = {
			provider: "custom",
			description: "test",
			aliases: [
				{
					tracker_label: "Todo",
					canonical_state: "S0 TODO",
					primary: true,
				},
				{
					tracker_label: "Pending",
					canonical_state: "S0 TODO",
					primary: true,
				},
			],
		};
		const result = validateAliasMap(map);
		expect(hasCode(result.findings, "ALIAS_MULTIPLE_PRIMARY")).toBe(true);
	});
});

// ─── validateTransitionsUseCanonical ────────────────────────────────────────────

describe("validateTransitionsUseCanonical", () => {
	it("accepts transitions with canonical states", () => {
		const transitions = [
			{ S: "S0 TODO", N: "S1 IN_PROGRESS" },
			{ S: "S1 IN_PROGRESS", N: "S2 IN_REVIEW" },
			{ S: "S2 IN_REVIEW", N: "S3 DONE" },
			{ S: "S1 IN_PROGRESS", N: "S4 BLOCKED" },
		];
		const findings = validateTransitionsUseCanonical(transitions);
		expect(findings).toEqual([]);
	});

	it("accepts short-form terminal states (DONE, FAIL, BLOCKED)", () => {
		const transitions = [
			{ S: "S0 TODO", N: "DONE" },
			{ S: "S1 IN_PROGRESS", N: "FAIL" },
			{ S: "S1 IN_PROGRESS", N: "BLOCKED" },
		];
		const findings = validateTransitionsUseCanonical(transitions);
		expect(findings).toEqual([]);
	});

	it("warns on tracker-specific labels in transitions", () => {
		const transitions = [
			{ S: "Todo", N: "In Progress" },
			{ S: "In Progress", N: "Done" },
		];
		const findings = validateTransitionsUseCanonical(transitions);
		expect(findings.length).toBeGreaterThan(0);
		expect(
			findings.every((f) => f.code === "TRANSITION_NON_CANONICAL_STATE"),
		).toBe(true);
	});

	it("warns on source states that are non-canonical", () => {
		const transitions = [{ S: "My Custom State", N: "S3 DONE" }];
		const findings = validateTransitionsUseCanonical(transitions);
		expect(findings.length).toBe(1);
		expect(findings[0]?.message).toContain("My Custom State");
	});

	it("warns on target states that are non-canonical", () => {
		const transitions = [{ S: "S0 TODO", N: "Completed" }];
		const findings = validateTransitionsUseCanonical(transitions);
		expect(findings.length).toBe(1);
		expect(findings[0]?.message).toContain("Completed");
	});

	it("returns empty for empty transition list", () => {
		expect(validateTransitionsUseCanonical([])).toEqual([]);
	});
});

// ─── Constants ──────────────────────────────────────────────────────────────────

describe("canonical state constants", () => {
	it("ALL_CANONICAL_STATES includes all non-terminal and terminal", () => {
		expect(ALL_CANONICAL_STATES).toEqual([
			...CANONICAL_NON_TERMINAL_STATES,
			...CANONICAL_TERMINAL_STATES,
		]);
	});

	it("terminal states are S3 DONE and FAIL", () => {
		expect(CANONICAL_TERMINAL_STATES).toContain("S3 DONE");
		expect(CANONICAL_TERMINAL_STATES).toContain("FAIL");
	});

	it("non-terminal states include S0-S2 and S4", () => {
		expect(CANONICAL_NON_TERMINAL_STATES).toContain("S0 TODO");
		expect(CANONICAL_NON_TERMINAL_STATES).toContain("S1 IN_PROGRESS");
		expect(CANONICAL_NON_TERMINAL_STATES).toContain("S2 IN_REVIEW");
		expect(CANONICAL_NON_TERMINAL_STATES).toContain("S4 BLOCKED");
	});
});
