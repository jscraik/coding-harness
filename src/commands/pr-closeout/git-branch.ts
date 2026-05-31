import { sanitizeGitEnvironment } from "../../lib/git/safe-env.js";
import type { PrCloseoutBranchInput } from "../../lib/pr-closeout.js";
import type { CommandRunner } from "./types.js";

function inspectGitClean(
	repoRoot: string,
	env: NodeJS.ProcessEnv,
	runner: CommandRunner,
): boolean | null {
	try {
		return (
			runner("git", ["status", "--porcelain"], {
				cwd: repoRoot,
				env,
			}).length === 0
		);
	} catch {
		return null;
	}
}

function remoteBaseRefs(
	repoRoot: string,
	env: NodeJS.ProcessEnv,
	runner: CommandRunner,
	baseRefName: string | null | undefined,
): string[] {
	const trimmed = baseRefName?.trim();
	if (!trimmed) return [];
	const refs = new Set([`refs/remotes/origin/${trimmed}`]);
	try {
		const listedRefs = runner(
			"git",
			["for-each-ref", "--format=%(refname)", "refs/remotes"],
			{ cwd: repoRoot, env },
		)
			.split(/\r?\n/u)
			.map((line) => line.trim())
			.filter((line) => line.length > 0 && !line.endsWith("/HEAD"));
		for (const ref of listedRefs) {
			const remoteBranch = ref.replace(/^refs\/remotes\//u, "");
			const firstSlash = remoteBranch.indexOf("/");
			if (firstSlash === -1) continue;
			const branchName = remoteBranch.slice(firstSlash + 1);
			if (branchName === trimmed) refs.add(ref);
		}
	} catch {
		// Fall back to the conventional origin remote ref below.
	}
	return Array.from(refs);
}

/** Builds the live git branch evidence used by PR closeout. */
export function inspectGitBranch(
	repoRoot: string,
	env: NodeJS.ProcessEnv,
	runner: CommandRunner,
	baseRefName: string | null | undefined,
): PrCloseoutBranchInput {
	const gitEnv = sanitizeGitEnvironment(env, { policy: "minimal" });
	const branch: PrCloseoutBranchInput = {
		clean: inspectGitClean(repoRoot, gitEnv, runner),
		worktreeRole: "unknown",
	};
	try {
		const headSha = runner("git", ["rev-parse", "HEAD"], {
			cwd: repoRoot,
			env: gitEnv,
		}).trim();
		if (headSha.length > 0) branch.headSha = headSha;
	} catch {
		// Head SHA is optional evidence; keep the rest of the branch snapshot.
	}
	const baseRefs = remoteBaseRefs(repoRoot, gitEnv, runner, baseRefName);
	if (baseRefs.length === 0) {
		branch.behindBy = null;
		branch.aheadBy = null;
		branch.behindBase = null;
		branch.worktreeRole = "orientation";
		return branch;
	}
	const observedDrift = baseRefs.some((baseRef) => {
		try {
			const drift = runner(
				"git",
				["rev-list", "--left-right", "--count", `${baseRef}...HEAD`],
				{ cwd: repoRoot, env: gitEnv },
			)
				.trim()
				.split(/\s+/u)
				.map((value) => Number.parseInt(value, 10));
			branch.behindBy = Number.isInteger(drift[0]) ? (drift[0] ?? null) : null;
			branch.aheadBy = Number.isInteger(drift[1]) ? (drift[1] ?? null) : null;
			branch.behindBase = branch.behindBy === null ? null : branch.behindBy > 0;
			return branch.behindBy !== null && branch.aheadBy !== null;
		} catch {
			return false;
		}
	});
	if (!observedDrift) {
		branch.behindBy = null;
		branch.aheadBy = null;
		branch.behindBase = null;
	}
	branch.worktreeRole =
		branch.clean === true && branch.behindBase === false
			? "implementation"
			: "orientation";
	return branch;
}
