import { describe, expect, it } from "vitest";
import {
	REQUIRED_CODEX_ACTION_PAIRS,
	REQUIRED_CODEX_TOOL_ACTIONS,
} from "./tooling-baseline.js";

describe("tooling baseline codex actions", () => {
	it("includes a hardened Release Finalize action", () => {
		const action = REQUIRED_CODEX_TOOL_ACTIONS.find(
			(candidate) => candidate.name === "Release Finalize",
		);

		expect(action).toBeDefined();
		expect(action?.icon).toBe("tool");
		expect(action?.command).toContain('case "$release_branch" in');
		expect(action?.command).toContain(
			"Expected a release branch matching codex/release-* or release-*",
		);
		expect(action?.command).toContain(
			'git fetch --prune origin main "$release_branch"',
		);
		expect(action?.command).toContain(
			'git merge --ff-only "origin/$release_branch"',
		);
	});

	it("exposes Release Finalize in required action parity", () => {
		expect(REQUIRED_CODEX_ACTION_PAIRS).toEqual(
			expect.arrayContaining([{ name: "Release Finalize", icon: "tool" }]),
		);
	});
});
