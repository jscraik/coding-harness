import { sanitizeGitEnvironment } from "../git/safe-env.js";

/** Return a git command environment scoped to an explicit repository root. */
export function gitEnvironmentForRepoRoot(): NodeJS.ProcessEnv {
	return sanitizeGitEnvironment({ policy: "minimal" });
}
