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

/** Return the current local git HEAD SHA. */
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

/** Return whether the current checkout is an explicitly disposable git worktree. */
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

/** Return whether the current git workspace is clean enough for remediation. */
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
 * Create a GitHubClient that performs SHA operations against the local git repository.
 *
 * @returns A GitHubClient that obtains the repository HEAD SHA and verifies commit ancestry using the local repository.
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
			return result.status === 0;
		},
	};
}
