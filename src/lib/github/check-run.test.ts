import { describe, expect, it } from "vitest";
import {
	findReviewCheckRun,
	isCheckRunInProgress,
	isCheckRunPassing,
} from "./check-run.js";
import type { CheckRun } from "./client.js";

const HEAD_SHA = "0123456789abcdef0123456789abcdef01234567";

describe("check-run helpers", () => {
	it("returns not_found when no check run matches", () => {
		const runs: CheckRun[] = [
			{
				id: 1,
				name: "lint",
				status: "completed",
				conclusion: "success",
				head_sha: HEAD_SHA,
			},
		];

		const result = findReviewCheckRun(runs, "review-check");
		expect(result).toEqual({
			found: false,
			status: "not_found",
			conclusion: null,
		});
	});

	it("selects the newest matching check run by id", () => {
		const runs: CheckRun[] = [
			{
				id: 10,
				name: "review-check",
				status: "completed",
				conclusion: "failure",
				head_sha: HEAD_SHA,
			},
			{
				id: 42,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: HEAD_SHA,
			},
		];

		const result = findReviewCheckRun(runs, "review-check");
		expect(result.found).toBe(true);
		expect(result.checkRun?.id).toBe(42);
		expect(result.conclusion).toBe("success");
	});

	it("ignores check runs from different head SHAs when a headSha filter is provided", () => {
		const otherSha = "fedcba9876543210fedcba9876543210fedcba98";
		const runs: CheckRun[] = [
			{
				id: 100,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: otherSha,
			},
			{
				id: 42,
				name: "review-check",
				status: "completed",
				conclusion: "failure",
				head_sha: HEAD_SHA,
			},
		];

		const result = findReviewCheckRun(runs, "review-check", {
			headSha: HEAD_SHA,
		});
		expect(result.found).toBe(true);
		expect(result.checkRun?.id).toBe(42);
		expect(result.checkRun?.head_sha).toBe(HEAD_SHA);
		expect(result.conclusion).toBe("failure");
	});

	it("treats malformed check head_sha values as non-matching when a SHA filter is provided", () => {
		const runs = [
			{
				id: 50,
				name: "review-check",
				status: "completed",
				conclusion: "success",
				head_sha: null,
			},
		] as unknown as CheckRun[];

		const result = findReviewCheckRun(runs, "review-check", {
			headSha: HEAD_SHA,
		});

		expect(result).toEqual({
			found: false,
			status: "not_found",
			conclusion: null,
		});
	});

	it("filters same-named check runs by expected provider identity when provided", () => {
		const runs: CheckRun[] = [
			{
				id: 12,
				name: "pr-pipeline",
				status: "completed",
				conclusion: "success",
				head_sha: HEAD_SHA,
				app: {
					id: 1001,
					slug: "github-actions",
					name: "GitHub Actions",
				},
			},
			{
				id: 35,
				name: "pr-pipeline",
				status: "completed",
				conclusion: "failure",
				head_sha: HEAD_SHA,
				app: {
					id: 1002,
					slug: "circleci",
					name: "CircleCI",
				},
			},
		];

		const result = findReviewCheckRun(runs, "pr-pipeline", {
			headSha: HEAD_SHA,
			providerSlugs: new Set(["circleci"]),
			sourceAppIds: new Set(["circleci"]),
		});
		expect(result.found).toBe(true);
		expect(result.checkRun?.id).toBe(35);
		expect(result.conclusion).toBe("failure");
	});

	it.each(["in_progress", "queued", "pending"] as const)(
		"treats %s as in-progress",
		(status) => {
			expect(
				isCheckRunInProgress({
					found: true,
					status,
					conclusion: null,
				}),
			).toBe(true);
		},
	);

	it("reports passing only for completed + success", () => {
		expect(
			isCheckRunPassing({
				found: true,
				status: "completed",
				conclusion: "success",
			}),
		).toBe(true);
		expect(
			isCheckRunPassing({
				found: true,
				status: "completed",
				conclusion: "failure",
			}),
		).toBe(false);
	});
});
