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
		expect(action?.command).toContain("git pull --ff-only origin main");
		expect(action?.command).toContain("pull_status=$?");
		expect(action?.command).toContain(
			'git merge --ff-only "origin/$release_branch"',
		);
	});

	it("exposes Release Finalize in required action parity", () => {
		expect(REQUIRED_CODEX_ACTION_PAIRS).toEqual(
			expect.arrayContaining([{ name: "Release Finalize", icon: "tool" }]),
		);
	});

	it("exposes Context7 in required action parity", () => {
		const action = REQUIRED_CODEX_TOOL_ACTIONS.find(
			(candidate) => candidate.name === "Context7",
		);

		expect(action).toBeDefined();
		expect(action?.icon).toBe("tool");
		expect(action?.command).toContain("command -v ctx7");
		expect(action?.command).toContain("ctx7 --help");
		expect(REQUIRED_CODEX_ACTION_PAIRS).toEqual(
			expect.arrayContaining([{ name: "Context7", icon: "tool" }]),
		);
	});

	it("hardens Mise action for detached worktree bootstrap", () => {
		const action = REQUIRED_CODEX_TOOL_ACTIONS.find(
			(candidate) => candidate.name === "Mise",
		);

		expect(action).toBeDefined();
		expect(action?.icon).toBe("tool");
		expect(action?.command).toContain("git rev-parse --is-inside-work-tree");
		expect(action?.command).toContain("bash scripts/prepare-worktree.sh");
		expect(action?.command).toContain("origin_branch_exists() {");
		expect(action?.command).toContain(
			'git ls-remote --exit-code --heads origin "$branch_name"',
		);
		expect(action?.command).toContain(
			'echo "[codex] failed to check origin branch: $branch_name"',
		);
		expect(action?.command).toContain(
			[
				'branch_base="${BRANCH_PREFIX:',
				'-jscraik/feature}/$repo_slug-worktree-$short_sha"',
			].join(""),
		);
		expect(action?.command).toContain(
			'while git show-ref --verify --quiet "refs/heads/$branch_name" || origin_branch_exists "$branch_name"; do',
		);
		expect(action?.command).toContain(
			'echo "[codex] detached HEAD detected; creating branch $branch_name"',
		);
		expect(action?.command).toContain('git switch -c "$branch_name"');
		expect(action?.command).toContain(
			'git branch --set-upstream-to=origin/main "$branch_name"',
		);
		expect(action?.command).toContain(
			'echo "[codex] tracking origin/main for $branch_name"',
		);
		expect(action?.command).toContain(
			'echo "[codex] fast-forwarding $branch_name with origin/main"',
		);
		expect(action?.command).toContain("git fetch --quiet origin main");
		expect(action?.command).toContain('git merge --ff-only "$target_ref"');
		expect(action?.command).toContain("mise trust --yes .mise.toml || true");
		expect(action?.command).toContain("mise install");
	});
});
