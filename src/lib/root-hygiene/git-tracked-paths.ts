import { execFileSync } from "node:child_process";
import { rootHygieneGitEnv } from "./git-env.js";
import { rootHygieneRepositoryTopLevel } from "./repository-identity.js";

/**
 * Maximum buffer size for git ls-files output.
 *
 * Set to 10MB to handle large repositories. If git ls-files output exceeds this
 * limit, Node.js child_process will throw an error with code 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER'.
 * For repositories with more than ~200,000 tracked files, this limit may need to be increased
 * via the GIT_LS_FILES_MAX_BUFFER_BYTES environment variable or by passing a larger
 * maxBuffer option to execFileSync.
 */
const GIT_LS_FILES_MAX_BUFFER_BYTES =
	Number.parseInt(process.env.GIT_LS_FILES_MAX_BUFFER_BYTES ?? "", 10) ||
	10 * 1024 * 1024;

/** Read the repository's live git-tracked paths without invoking a shell. */
export function readGitTrackedPaths(repoRoot: string): string[] {
	if (repoRoot.trim() === "") {
		throw new Error("repoRoot is required for root-hygiene git inventory");
	}
	try {
		const gitTopLevel = rootHygieneRepositoryTopLevel(repoRoot);
		const output = execFileSync("git", ["-C", gitTopLevel, "ls-files", "-z"], {
			encoding: "utf8",
			env: rootHygieneGitEnv(),
			maxBuffer: GIT_LS_FILES_MAX_BUFFER_BYTES,
		});
		return output.split("\0").filter((path) => path.length > 0);
	} catch (error) {
		throw new Error(
			`Failed to read git tracked paths for repoRoot=${repoRoot}: ${error instanceof Error ? error.message : String(error)}`,
			{ cause: error },
		);
	}
}
