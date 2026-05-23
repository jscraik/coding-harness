import { spawnSync } from "node:child_process";
import type { GitHubClient } from "../lib/remediation/orchestrator.js";

/** Local git worktree cleanliness result used by remediate apply-mode guards. */
export type WorkspaceStatus =
	| {
			ok: true;
			clean: boolean;
	  }
	| {
			ok: false;
			reason: string;
	  };

/**
 * Get the current local git HEAD SHA.
 *
 * @returns The trimmed SHA string of the repository's HEAD.
 * @throws Error if executing `git rev-parse HEAD` fails or returns a non-zero exit code.
 */
export function getHeadSha(): string {
	const result = spawnSync("git", ["rev-parse", "HEAD"], {
		encoding: "utf-8",
		timeout: 5000,
	});

	if (result.error || result.status !== 0) {
		throw new Error(
			`Failed to get HEAD SHA: ${result.error?.message ?? result.stderr}`,
		);
	}

	return result.stdout.trim();
}

/**
 * Detects whether the current checkout is an explicitly disposable git worktree.
 *
 * Considers the HARNESS_DISPOSABLE_WORKSPACE environment variable and whether
 * the repository's git directory path contains a `worktrees` segment.
 *
 * @returns `true` if the checkout is a disposable worktree, `false` otherwise.
 */
export function isDisposableWorkspace(): boolean {
	if (process.env.HARNESS_DISPOSABLE_WORKSPACE === "true") {
		return true;
	}
	const gitDirResult = spawnSync("git", ["rev-parse", "--git-dir"], {
		encoding: "utf-8",
		timeout: 5000,
	});

	if (gitDirResult.status !== 0 || !gitDirResult.stdout) {
		return false;
	}

	const gitDir = gitDirResult.stdout.trim();
	return gitDir.split(/[\\/]/).includes("worktrees");
}

/**
 * Determine whether the current git workspace is suitable for remediation.
 *
 * @returns `{ ok: true; clean: boolean }` when the status check succeeds — `clean` is `true` if there are no uncommitted changes; `{ ok: false; reason: string }` when the check fails, with `reason` describing the failure.
 */
export function getWorkspaceStatus(): WorkspaceStatus {
	const result = spawnSync("git", ["status", "--porcelain"], {
		encoding: "utf-8",
		timeout: 5000,
	});

	if (result.error || result.status !== 0) {
		return {
			ok: false,
			reason: result.error?.message ?? result.stderr ?? "git status failed",
		};
	}

	return {
		ok: true,
		clean: result.stdout.trim().length === 0,
	};
}

/**
 * Create a GitHubClient that uses the local git repository for SHA and ancestry checks.
 *
 * @returns An object implementing `GitHubClient`:
 * - `getHeadSha()` — returns the current repository HEAD SHA.
 * - `isAncestor(ancestorSha, descendantSha)` — `true` if `ancestorSha` is an ancestor of `descendantSha`, `false` if not; throws on git execution errors or unexpected exit codes.
 */
export function createGitHubClient(): GitHubClient {
	return {
		async getHeadSha() {
			return getHeadSha();
		},
		async isAncestor(ancestorSha: string, descendantSha: string) {
			const result = spawnSync(
				"git",
				["merge-base", "--is-ancestor", ancestorSha, descendantSha],
				{
					encoding: "utf-8",
					timeout: 5000,
				},
			);
			if (result.error) {
				throw new Error(`Failed to compare ancestry: ${result.error.message}`);
			}
			if (result.status === 0) return true;
			if (result.status === 1) return false;
			throw new Error(
				`git merge-base failed (status ${result.status}): ${result.stderr ?? "unknown error"}`,
			);
		},
	};
}
