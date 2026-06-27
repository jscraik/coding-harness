import { describe, expect, it } from "vitest";
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
});
