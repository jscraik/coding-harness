import { execFileSync } from "node:child_process";
import { formatRootHygieneError } from "./errors.js";
import { rootHygieneGitEnv } from "./git-env.js";
import {
	gitLsFilesMaxBufferBytes,
	type ReadGitTrackedPathsOptions,
} from "./git-tracked-paths-options.js";
import { rootHygieneRepositoryTopLevel } from "./repository-identity.js";

export type { ReadGitTrackedPathsOptions };

/** Read the repository's live git-tracked paths without invoking a shell. */
export function readGitTrackedPaths(
	repoRoot: string,
	options: ReadGitTrackedPathsOptions = {},
): string[] {
	if (repoRoot.trim() === "") {
		throw new Error("repoRoot is required for root-hygiene git inventory");
	}
	try {
		const gitTopLevel = rootHygieneRepositoryTopLevel(repoRoot);
		const output = execFileSync("git", ["-C", gitTopLevel, "ls-files", "-z"], {
			encoding: "utf8",
			env: rootHygieneGitEnv(),
			maxBuffer: gitLsFilesMaxBufferBytes(options),
		});
		return output.split("\0").filter((path) => path.length > 0);
	} catch (error) {
		throw new Error(
			`Failed to read git tracked paths for repoRoot=${repoRoot}: ${formatRootHygieneError(error)}`,
			{ cause: error },
		);
	}
}
