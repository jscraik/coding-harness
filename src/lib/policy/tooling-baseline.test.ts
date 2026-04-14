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
				'local_main_ahead_count="$(git rev-list --count origin/main..HEAD)"',
			);
			expect(action?.command).toContain(
				"Local main is ahead of origin/main; aborting.",
			);
			expect(action?.command).toContain("if ! git pull --ff-only origin main;");
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
