import { describe, expect, it } from "vitest";
import {
	type DecisionSource,
	type RecommendationCandidate,
	type RunDecisionSource,
	collectSourceErrors,
	findBlockingSource,
	selectRecentRunSource,
	sortRecommendationCandidates,
} from "./sources.js";

function source(overrides: Partial<DecisionSource> = {}): DecisionSource {
	return {
		kind: "contract",
		ref: "harness.contract.json",
		freshness: "current",
		sha: "a".repeat(40),
		status: "usable",
		failureClass: null,
		...overrides,
	};
}

function candidate(
	overrides: Partial<RecommendationCandidate> = {},
): RecommendationCandidate {
	return {
		command: "harness validation-plan --files src/commands/next.ts --json",
		reason: "Generate focused validation.",
		sourceRefs: ["git:status"],
		score: 50,
		riskTier: "medium",
		safeToRun: true,
		requiresHuman: false,
		requiresNetwork: false,
		writesFiles: false,
		...overrides,
	};
}

function runSource(overrides: Partial<RunDecisionSource>): RunDecisionSource {
	return {
		...source({
			kind: "run",
			ref: "artifact:.harness/runs/001.json",
			freshness: "current",
			status: "usable",
		}),
		timestamp: "2026-05-06T00:00:00.000Z",
		...overrides,
	};
}

describe("collectSourceErrors", () => {
	it("classifies missing, empty, invalid, stale, blocked, and network-unavailable sources", () => {
		const errors = collectSourceErrors([
			source(),
			source({
				ref: "harness.contract.json",
				freshness: "missing",
				status: "invalid",
				failureClass: "contract_missing",
			}),
			source({
				kind: "learning",
				ref: ".harness/learnings/coderabbit.local.json",
				freshness: "current",
				status: "empty",
				failureClass: "learning_empty",
			}),
			source({
				kind: "run",
				ref: ".harness/runs/stale.json",
				freshness: "stale",
				status: "usable",
				failureClass: "run_head_mismatch",
			}),
			source({
				kind: "config",
				ref: ".harness/config.json",
				freshness: "unknown",
				status: "blocked",
				failureClass: "config_blocked",
			}),
			source({
				kind: "pr",
				ref: "network:github",
				freshness: "unknown",
				sha: null,
				status: "blocked",
				failureClass: "network_unavailable",
			}),
		]);

		expect(errors.map((error) => error.failureClass)).toEqual([
			"config_blocked",
			"contract_missing",
			"learning_empty",
			"network_unavailable",
			"run_head_mismatch",
		]);
	});

	it("selects required local blocked sources as fail-closed blockers", () => {
		expect(
			findBlockingSource([
				source({
					kind: "config",
					ref: ".harness/config.json",
					status: "blocked",
					failureClass: "config_blocked",
				}),
				source({
					kind: "pr",
					ref: "network:github",
					status: "blocked",
					failureClass: "network_unavailable",
				}),
				source({
					kind: "contract",
					ref: "harness.contract.json",
					status: "blocked",
					failureClass: "contract_blocked",
				}),
			]),
		).toMatchObject({
			kind: "config",
			failureClass: "config_blocked",
		});
	});
});

describe("sortRecommendationCandidates", () => {
	it("uses stable safety and lexical tie-breakers", () => {
		const sorted = sortRecommendationCandidates([
			candidate({
				command: "harness review-context --files src/a.ts --json",
				riskTier: "medium",
				score: 90,
				sourceRefs: ["git:status", "command-catalog"],
			}),
			candidate({
				command: "harness validation-plan --files src/a.ts --json",
				riskTier: "low",
				score: 10,
				sourceRefs: ["git:status"],
			}),
			candidate({
				command: "harness doctor --json",
				riskTier: "low",
				requiresHuman: true,
				score: 100,
				sourceRefs: ["git:status"],
			}),
		]);

		expect(sorted.map((entry) => entry.command)).toEqual([
			"harness validation-plan --files src/a.ts --json",
			"harness doctor --json",
			"harness review-context --files src/a.ts --json",
		]);
	});
});

describe("selectRecentRunSource", () => {
	it("prefers parseable current-head runs, newest timestamp, then path", () => {
		const currentHeadSha = "c".repeat(40);
		const { selected } = selectRecentRunSource(
			[
				runSource({
					ref: ".harness/runs/stale.json",
					sha: "b".repeat(40),
					timestamp: "2026-05-06T02:00:00.000Z",
				}),
				runSource({
					ref: ".harness/runs/b.json",
					sha: currentHeadSha,
					timestamp: "2026-05-06T01:00:00.000Z",
				}),
				runSource({
					ref: ".harness/runs/a.json",
					sha: currentHeadSha,
					timestamp: "2026-05-06T01:00:00.000Z",
				}),
			],
			currentHeadSha,
		);

		expect(selected?.ref).toBe(".harness/runs/a.json");
	});

	it("reports invalid run artifacts as source errors", () => {
		const { sourceErrors } = selectRecentRunSource(
			[
				runSource({
					ref: ".harness/runs/invalid.json",
					status: "invalid",
					failureClass: "run_invalid_json",
				}),
			],
			"c".repeat(40),
		);

		expect(sourceErrors).toEqual([
			expect.objectContaining({
				ref: ".harness/runs/invalid.json",
				status: "invalid",
				failureClass: "run_invalid_json",
			}),
		]);
	});

	it("does not select stale runs when no current-head run exists", () => {
		const currentHeadSha = "c".repeat(40);
		const { selected, sourceErrors } = selectRecentRunSource(
			[
				runSource({
					ref: ".harness/runs/stale-newest.json",
					sha: "b".repeat(40),
					timestamp: "2026-05-06T02:00:00.000Z",
				}),
			],
			currentHeadSha,
		);

		expect(selected).toBeNull();
		expect(sourceErrors).toEqual([
			expect.objectContaining({
				ref: ".harness/runs/stale-newest.json",
				freshness: "stale",
				status: "usable",
				failureClass: "run_head_mismatch",
			}),
		]);
	});
});
