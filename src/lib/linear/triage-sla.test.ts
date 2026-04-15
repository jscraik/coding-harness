import { describe, expect, it } from "vitest";
import {
	type TriageRoutingInput,
	type TriageSlaConfig,
	buildTriageBounceComment,
	checkTriageSla,
	routeTriageIssue,
	validateTriageExitMetadata,
} from "./triage-sla.js";

// ---------------------------------------------------------------------------
// validateTriageExitMetadata
// ---------------------------------------------------------------------------

describe("validateTriageExitMetadata", () => {
	const completeMetadata = {
		priority: 2,
		roadmapLabel: "Roadmap: Now",
		assignee: "user@example.com",
		projectLink: "coding-harness",
		title: "Test issue",
		description: "Test description",
		labels: ["Roadmap: Now", "Bug"],
	};

	it("returns valid when all required fields are present", () => {
		const result = validateTriageExitMetadata(completeMetadata);
		expect(result.valid).toBe(true);
		expect(result.missingFields).toEqual([]);
		expect(result.completeness).toBe(1);
	});

	it("detects missing priority", () => {
		const result = validateTriageExitMetadata({
			...completeMetadata,
			priority: null,
		});
		expect(result.valid).toBe(false);
		expect(result.missingFields).toContain("priority");
		expect(result.completeness).toBe(0.75);
	});

	it("detects missing assignee", () => {
		const result = validateTriageExitMetadata({
			...completeMetadata,
			assignee: null,
		});
		expect(result.valid).toBe(false);
		expect(result.missingFields).toContain("assignee");
	});

	it("detects missing project link", () => {
		const result = validateTriageExitMetadata({
			...completeMetadata,
			projectLink: null,
		});
		expect(result.valid).toBe(false);
		expect(result.missingFields).toContain("projectLink");
	});

	it("accepts roadmap lane label as substitute for roadmapLabel", () => {
		const result = validateTriageExitMetadata({
			...completeMetadata,
			roadmapLabel: null,
			labels: ["Lane A", "Bug"],
		});
		expect(result.valid).toBe(true);
	});

	it("detects missing roadmap when no label and no roadmapLabel", () => {
		const result = validateTriageExitMetadata({
			...completeMetadata,
			roadmapLabel: null,
			labels: ["Bug"],
		});
		expect(result.valid).toBe(false);
		expect(result.missingFields).toContain("roadmapLabel");
	});

	it("reports multiple missing fields", () => {
		const result = validateTriageExitMetadata({
			priority: null,
			roadmapLabel: null,
			assignee: null,
			projectLink: null,
			title: "Bare issue",
			description: null,
			labels: [],
		});
		expect(result.valid).toBe(false);
		expect(result.missingFields).toHaveLength(4);
		expect(result.completeness).toBe(0);
	});

	it("includes human-readable reasons", () => {
		const result = validateTriageExitMetadata({
			...completeMetadata,
			priority: null,
		});
		expect(result.reasons).toHaveLength(1);
		expect(result.reasons[0].field).toBe("priority");
		expect(result.reasons[0].message).toBeTruthy();
	});
});

// ---------------------------------------------------------------------------
// routeTriageIssue
// ---------------------------------------------------------------------------

describe("routeTriageIssue", () => {
	const baseRoutingInput: TriageRoutingInput = {
		metadata: {
			priority: 2,
			roadmapLabel: "Roadmap: Now",
			assignee: "user@example.com",
			projectLink: "coding-harness",
			title: "Test issue",
			description: "Test description",
			labels: ["Roadmap: Now", "Bug"],
		},
		scoreBand: "pull_now",
		hasUnresolvedDependencies: false,
		inProgressCapReached: false,
		isDuplicate: false,
		isOutOfScope: false,
	};

	it("routes duplicates to canceled (duplicate)", () => {
		const result = routeTriageIssue({
			...baseRoutingInput,
			isDuplicate: true,
		});
		expect(result.target).toBe("duplicate");
		expect(result.blocked).toBe(false);
	});

	it("routes out-of-scope to canceled", () => {
		const result = routeTriageIssue({
			...baseRoutingInput,
			isOutOfScope: true,
		});
		expect(result.target).toBe("canceled");
		expect(result.blocked).toBe(false);
	});

	it("bounces back to backlog when metadata is incomplete", () => {
		const result = routeTriageIssue({
			...baseRoutingInput,
			metadata: {
				...baseRoutingInput.metadata,
				priority: null,
				assignee: null,
			},
		});
		expect(result.target).toBe("backlog");
		expect(result.blocked).toBe(true);
		expect(result.blockedBy).toContain("priority");
		expect(result.blockedBy).toContain("assignee");
	});

	it("routes pull_now to in_progress when capacity and deps allow", () => {
		const result = routeTriageIssue(baseRoutingInput);
		expect(result.target).toBe("in_progress");
		expect(result.blocked).toBe(false);
	});

	it("routes pull_now to todo when in-progress cap is reached", () => {
		const result = routeTriageIssue({
			...baseRoutingInput,
			inProgressCapReached: true,
		});
		expect(result.target).toBe("todo");
		expect(result.blocked).toBe(false);
	});

	it("routes pull_now to todo when dependencies are unresolved", () => {
		const result = routeTriageIssue({
			...baseRoutingInput,
			hasUnresolvedDependencies: true,
		});
		expect(result.target).toBe("todo");
		expect(result.blocked).toBe(false);
	});

	it("routes next_pull to todo", () => {
		const result = routeTriageIssue({
			...baseRoutingInput,
			scoreBand: "next_pull",
		});
		expect(result.target).toBe("todo");
	});

	it("routes triage_hold to backlog", () => {
		const result = routeTriageIssue({
			...baseRoutingInput,
			scoreBand: "triage_hold",
		});
		expect(result.target).toBe("backlog");
	});

	it("routes backlog_or_rescope to backlog", () => {
		const result = routeTriageIssue({
			...baseRoutingInput,
			scoreBand: "backlog_or_rescope",
		});
		expect(result.target).toBe("backlog");
	});

	it("duplicate takes precedence over out-of-scope", () => {
		const result = routeTriageIssue({
			...baseRoutingInput,
			isDuplicate: true,
			isOutOfScope: true,
		});
		expect(result.target).toBe("duplicate");
	});
});

// ---------------------------------------------------------------------------
// checkTriageSla
// ---------------------------------------------------------------------------

describe("checkTriageSla", () => {
	const config: TriageSlaConfig = {
		decisionWindowHours: 48,
		warningWindowHours: 36,
	};

	it("reports within SLA for recent issues", () => {
		const now = new Date("2026-04-15T12:00:00Z");
		const result = checkTriageSla({
			createdAt: "2026-04-15T00:00:00Z",
			now,
			config,
		});
		expect(result.withinSla).toBe(true);
		expect(result.breached).toBe(false);
		expect(result.approaching).toBe(false);
		expect(result.hoursInTriage).toBe(12);
		expect(result.hoursRemaining).toBe(36);
	});

	it("reports approaching when in warning window", () => {
		const now = new Date("2026-04-15T12:00:00Z");
		const result = checkTriageSla({
			createdAt: "2026-04-13T12:00:00Z", // 48h total, so 48h elapsed = 48h window exactly
			now,
			config,
		});
		expect(result.approaching).toBe(true);
	});

	it("reports breached when past decision window", () => {
		const now = new Date("2026-04-15T12:00:00Z");
		const result = checkTriageSla({
			createdAt: "2026-04-13T00:00:00Z", // 60h elapsed > 48h window
			now,
			config,
		});
		expect(result.breached).toBe(true);
		expect(result.withinSla).toBe(false);
		expect(result.hoursRemaining).toBeLessThan(0);
	});

	it("uses default config when none provided", () => {
		const now = new Date("2026-04-15T12:00:00Z");
		const result = checkTriageSla({
			createdAt: "2026-04-15T00:00:00Z",
			now,
		});
		expect(result.withinSla).toBe(true);
		expect(result.hoursInTriage).toBe(12);
	});
});

// ---------------------------------------------------------------------------
// buildTriageBounceComment
// ---------------------------------------------------------------------------

describe("buildTriageBounceComment", () => {
	it("generates a comment listing missing fields", () => {
		const validation = validateTriageExitMetadata({
			priority: null,
			roadmapLabel: null,
			assignee: "user@example.com",
			projectLink: "coding-harness",
			title: "Test",
			description: null,
			labels: [],
		});
		const comment = buildTriageBounceComment(validation);
		expect(comment).toContain("Triage metadata gate");
		expect(comment).toContain("priority");
		expect(comment).toContain("roadmapLabel");
		expect(comment).toContain("50%");
	});
});
