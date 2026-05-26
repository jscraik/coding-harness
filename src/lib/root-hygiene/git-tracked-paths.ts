import { execFileSync } from "node:child_process";
import { formatRootHygieneError } from "./errors.js";
import { rootHygieneGitEnv } from "./git-env.js";
import {
	gitLsFilesMaxBufferBytes,
	type ReadGitTrackedPathsOptions,
} from "./git-tracked-paths-options.js";
import { parseGitTrackedPathEntry } from "./git-tracked-stage-record.js";
import { rootHygieneRepositoryTopLevel } from "./repository-identity.js";
import type { GitTrackedPathEntry } from "./tracked-paths.js";
/** Read the repository's live git-tracked paths without invoking a shell. */
export function readGitTrackedPaths(
	repoRoot: string,
	options: ReadGitTrackedPathsOptions = {},
): string[] {
	return readGitTrackedPathEntries(repoRoot, options).map(({ path }) => path);
}
/** Read git-tracked paths with index mode metadata for root-entry projection. */
export function readGitTrackedPathEntries(
	repoRoot: string,
	options: ReadGitTrackedPathsOptions = {},
): GitTrackedPathEntry[] {
	if (repoRoot.trim() === "") {
		throw new Error("repoRoot is required for root-hygiene git inventory");
	}
	try {
		const gitTopLevel = rootHygieneRepositoryTopLevel(repoRoot);
		const output = execFileSync(
			"git",
			["-C", gitTopLevel, "ls-files", "--stage", "-z"],
			{
				encoding: "utf8",
				env: rootHygieneGitEnv(),
				maxBuffer: gitLsFilesMaxBufferBytes(options),
			},
		);
		return output.split("\0").filter(Boolean).map(parseGitTrackedPathEntry);
	} catch (error) {
		throw new Error(
			`Failed to read git tracked paths for repoRoot=${repoRoot}: ${formatRootHygieneError(error)}`,
			{ cause: error },
		);
	}
}
