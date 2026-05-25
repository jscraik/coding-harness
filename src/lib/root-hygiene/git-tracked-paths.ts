import { execFileSync } from "node:child_process";
import { rootHygieneGitEnv } from "./git-env.js";
import { rootHygieneRepositoryTopLevel } from "./repository-identity.js";

const GIT_LS_FILES_MAX_BUFFER_BYTES = 10 * 1024 * 1024;

/** Read the repository's live git-tracked paths without invoking a shell. */
export function readGitTrackedPaths(repoRoot: string): string[] {
	if (repoRoot.trim() === "") {
		throw new Error("repoRoot is required for root-hygiene git inventory");
	}
	const gitTopLevel = rootHygieneRepositoryTopLevel(repoRoot);
	const output = execFileSync("git", ["-C", gitTopLevel, "ls-files", "-z"], {
		encoding: "utf8",
		env: rootHygieneGitEnv(),
		maxBuffer: GIT_LS_FILES_MAX_BUFFER_BYTES,
	});
	return output.split("\0").filter((path) => path.length > 0);
}
