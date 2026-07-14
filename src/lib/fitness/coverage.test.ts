import { describe, expect, it } from "vitest";
import { FITNESS_COMMANDS } from "./commands.js";
import { fitnessCoverage } from "./coverage.js";

describe("fitnessCoverage", () => {
	it("returns fresh coverage entries and nested arrays", () => {
		const first = fitnessCoverage();
		first[0]?.laneIds.push("mutated-lane");
		first[0]?.commands.push("mutated-command");

		const second = fitnessCoverage();

		expect(second[0]?.laneIds).not.toContain("mutated-lane");
		expect(second[0]?.commands).not.toContain("mutated-command");
	});

	it("routes expressive intent and boundary correctness without inventing a dead-code lane", () => {
		const coverage = fitnessCoverage();
		const expressiveIntent = coverage.find(
			(entry) => entry.category === "expressive-intent",
		);
		const boundaryCorrectness = coverage.find(
			(entry) => entry.category === "boundary-correctness",
		);

		expect(expressiveIntent).toMatchObject({
			laneIds: ["quality-structure", "feedback-learning"],
			commands: [
				"pnpm run quality:docstrings",
				"bash scripts/validate-codestyle.sh --fast",
				FITNESS_COMMANDS.AUTOREVIEW,
			],
		});
		expect(expressiveIntent?.claimBoundary).toContain("CODESTYLE");
		expect(expressiveIntent?.claimBoundary).toContain("review");

		expect(boundaryCorrectness).toMatchObject({
			laneIds: ["architecture-fitness", "behavior-proof"],
			commands: [
				FITNESS_COMMANDS.BEHAVIOR_TESTS,
				FITNESS_COMMANDS.ARCHITECTURE_CHECK,
				FITNESS_COMMANDS.AUTOREVIEW,
			],
		});
		expect(boundaryCorrectness?.coverage).toContain("corner cases");

		expect(coverage.map((entry) => entry.category)).not.toContain("dead-code");
		expect(coverage.flatMap((entry) => entry.commands)).not.toContain(
			"pnpm run quality:dead-code",
		);
	});
});
