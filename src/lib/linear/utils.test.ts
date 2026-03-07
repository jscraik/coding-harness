import { describe, expect, it } from "vitest";
import type { LinearIssueSummary } from "./client.js";
import {
	ISSUE_IDENTIFIER_PATTERN,
	issueMatchesTeam,
	normalizeIssueReference,
	normalizeTeamMatch,
	normalizeToken,
	selectIssue,
} from "./utils.js";

describe("normalizeToken", () => {
	it("returns undefined for undefined input", () => {
		expect(normalizeToken(undefined)).toBeUndefined();
	});

	it("returns undefined for empty string", () => {
		expect(normalizeToken("")).toBeUndefined();
	});

	it("returns undefined for whitespace-only string", () => {
		expect(normalizeToken("   ")).toBeUndefined();
	});

	it("returns undefined for 'undefined' string", () => {
		expect(normalizeToken("undefined")).toBeUndefined();
	});

	it("returns undefined for 'null' string", () => {
		expect(normalizeToken("null")).toBeUndefined();
	});

	it("returns trimmed string for valid input", () => {
		expect(normalizeToken("  valid-token  ")).toBe("valid-token");
	});
});

describe("normalizeIssueReference", () => {
	it("extracts issue identifier from URL", () => {
		expect(
			normalizeIssueReference(
				"https://linear.app/team/issue/TEAM-123/description",
			),
		).toBe("TEAM-123");
	});

	it("uppercases identifier from URL", () => {
		expect(
			normalizeIssueReference("https://linear.app/team/issue/team-123"),
		).toBe("TEAM-123");
	});

	it("uppercases valid identifier pattern", () => {
		expect(normalizeIssueReference("team-123")).toBe("TEAM-123");
	});

	it("returns trimmed value for non-matching input", () => {
		expect(normalizeIssueReference("  some-random-text  ")).toBe(
			"some-random-text",
		);
	});
});

describe("normalizeTeamMatch", () => {
	it("returns undefined for undefined input", () => {
		expect(normalizeTeamMatch(undefined)).toBeUndefined();
	});

	it("returns undefined for empty string", () => {
		expect(normalizeTeamMatch("")).toBeUndefined();
	});

	it("returns lowercase for valid input", () => {
		expect(normalizeTeamMatch("  MyTeam  ")).toBe("myteam");
	});
});

describe("issueMatchesTeam", () => {
	const createMockIssue = (
		teamKey: string,
		teamName: string,
	): LinearIssueSummary => ({
		id: "issue-1",
		identifier: "TEST-1",
		title: "Test issue",
		url: "https://linear.app/test/issue/TEST-1",
		team: { id: "team-1", key: teamKey, name: teamName },
		state: { id: "state-1", name: "Backlog", type: "backlog" },
	});

	it("returns true when team is undefined", () => {
		const issue = createMockIssue("ENG", "Engineering");
		expect(issueMatchesTeam(issue, undefined)).toBe(true);
	});

	it("returns true when team matches team key", () => {
		const issue = createMockIssue("ENG", "Engineering");
		expect(issueMatchesTeam(issue, "eng")).toBe(true);
	});

	it("returns true when team matches team name", () => {
		const issue = createMockIssue("ENG", "Engineering");
		expect(issueMatchesTeam(issue, "engineering")).toBe(true);
	});

	it("returns false when team does not match", () => {
		const issue = createMockIssue("ENG", "Engineering");
		expect(issueMatchesTeam(issue, "design")).toBe(false);
	});
});

describe("selectIssue", () => {
	const issues: LinearIssueSummary[] = [
		{
			id: "issue-1",
			identifier: "ENG-123",
			title: "Engineering task",
			url: "https://linear.app/test/issue/ENG-123",
			team: { id: "team-1", key: "ENG", name: "Engineering" },
			state: { id: "state-1", name: "Backlog", type: "backlog" },
		},
		{
			id: "issue-2",
			identifier: "DES-456",
			title: "Design task",
			url: "https://linear.app/test/issue/DES-456",
			team: { id: "team-2", key: "DES", name: "Design" },
			state: { id: "state-1", name: "Backlog", type: "backlog" },
		},
	];

	it("returns undefined for empty issues array", () => {
		expect(selectIssue([], "ENG-123", undefined)).toBeUndefined();
	});

	it("returns exact match by identifier", () => {
		const result = selectIssue(issues, "ENG-123", undefined);
		expect(result?.identifier).toBe("ENG-123");
	});

	it("filters by team before matching", () => {
		const result = selectIssue(issues, "DES-456", "design");
		expect(result?.identifier).toBe("DES-456");
	});

	it("returns undefined when team filter excludes all", () => {
		expect(selectIssue(issues, "ENG-123", "marketing")).toBeUndefined();
	});

	it("returns single issue when only one matches team", () => {
		const result = selectIssue(issues, "UNKNOWN", "engineering");
		expect(result?.identifier).toBe("ENG-123");
	});

	it("returns undefined when multiple issues match team but none by identifier", () => {
		const multiIssues: LinearIssueSummary[] = [
			{
				id: "issue-1",
				identifier: "ENG-100",
				title: "Task 1",
				url: "https://linear.app/test/issue/ENG-100",
				team: { id: "team-1", key: "ENG", name: "Engineering" },
				state: { id: "state-1", name: "Backlog", type: "backlog" },
			},
			{
				id: "issue-2",
				identifier: "ENG-200",
				title: "Task 2",
				url: "https://linear.app/test/issue/ENG-200",
				team: { id: "team-1", key: "ENG", name: "Engineering" },
				state: { id: "state-1", name: "Backlog", type: "backlog" },
			},
		];
		expect(selectIssue(multiIssues, "UNKNOWN", "engineering")).toBeUndefined();
	});
});

describe("ISSUE_IDENTIFIER_PATTERN", () => {
	it("matches valid issue identifiers", () => {
		expect(ISSUE_IDENTIFIER_PATTERN.test("ABC-123")).toBe(true);
		expect(ISSUE_IDENTIFIER_PATTERN.test("TEAM-1")).toBe(true);
		expect(ISSUE_IDENTIFIER_PATTERN.test("XYZ-99999")).toBe(true);
	});

	it("does not match invalid identifiers", () => {
		expect(ISSUE_IDENTIFIER_PATTERN.test("A-1")).toBe(false); // too short
		expect(ISSUE_IDENTIFIER_PATTERN.test("123-ABC")).toBe(false); // numbers first
		expect(ISSUE_IDENTIFIER_PATTERN.test("ABC123")).toBe(false); // no hyphen
	});
});
