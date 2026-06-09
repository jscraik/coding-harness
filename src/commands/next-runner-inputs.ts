import { execFileSync } from "node:child_process";
import { gitEnvironmentForRepoRoot } from "../lib/runtime/git-environment.js";
import type { HarnessNextWorktreeRole } from "./next-args.js";
import { parseGitStatusShort, type NextWorktreeState } from "./next-support.js";

/** File-inspection summary produced by changed-file resolution. */
export type ChangedFilesResult = {
	files: string[];
	filesSource: "override" | "git";
};

/** Options needed to resolve local changed files for harness next. */
export type ChangedFilesResolutionOptions = {
	files?: string[];
	inspectChangedFiles?: (repoRoot: string) => string[];
};

/** Inspect changed files via `git status --short` and normalize them. */
export function inspectGitChangedFiles(repoRoot: string): string[] {
	const output = execFileSync(
		"git",
		["status", "--short", "--untracked-files=all"],
		{
			cwd: repoRoot,
			env: gitEnvironmentForRepoRoot(),
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 10_000,
		},
	);
	return parseGitStatusShort(output);
}

/** Resolve local worktree state from git metadata required for role-aware nexting. */
export function inspectWorktreeState(repoRoot: string): NextWorktreeState {
	const run = (
		args: string[],
		options?: { emptyIsValue?: boolean },
	): string | null => {
		try {
			const output = execFileSync("git", args, {
				cwd: repoRoot,
				env: gitEnvironmentForRepoRoot(),
				encoding: "utf-8",
				stdio: ["ignore", "pipe", "ignore"],
				timeout: 10_000,
			}).trim();
			if (output.length > 0) return output;
			return options?.emptyIsValue === true ? "" : null;
		} catch {
			return null;
		}
	};

	const parseCount = (value: string | null): number | null => {
		if (value === null) return null;
		const parsed = Number.parseInt(value, 10);
		return Number.isNaN(parsed) ? null : parsed;
	};

	const status = run(["status", "--short", "--untracked-files=all"], {
		emptyIsValue: true,
	});
	const branch = run(["rev-parse", "--abbrev-ref", "HEAD"]);
	const upstream = run([
		"rev-parse",
		"--abbrev-ref",
		"--symbolic-full-name",
		"@{upstream}",
	]);
	const ahead =
		upstream === null
			? null
			: parseCount(run(["rev-list", "--count", `${upstream}..HEAD`]));
	const behind =
		upstream === null
			? null
			: parseCount(run(["rev-list", "--count", `HEAD..${upstream}`]));
	return {
		branch,
		clean: status !== null ? status.length === 0 : false,
		upstream,
		ahead,
		behind,
	};
}

/** Return whether the current worktree state blocks the requested role. */
export function blocksDirtyWorktree(
	role: HarnessNextWorktreeRole | undefined,
	state: NextWorktreeState,
): boolean {
	if (role === "dirty-with-justification") return false;
	if (!state.clean) return true;
	if (state.upstream === null) return role === "fresh-worktree";
	if (state.ahead === null || state.behind === null) return true;
	if (state.ahead > 0 || state.behind > 0) return true;
	return false;
}

/** Resolve changed files from overrides or git inspection. */
export function resolveChangedFiles(
	repoRoot: string,
	options: ChangedFilesResolutionOptions,
): ChangedFilesResult {
	if (options.files !== undefined) {
		return { files: [...options.files].sort(), filesSource: "override" };
	}
	return {
		files: (options.inspectChangedFiles ?? inspectGitChangedFiles)(repoRoot),
		filesSource: "git",
	};
}
