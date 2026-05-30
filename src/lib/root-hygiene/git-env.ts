import { sanitizeGitEnvironment } from "../git/safe-env.js";

/** Return an environment for git subprocesses without caller-scoped git state. */
export function rootHygieneGitEnv(
	env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
	return sanitizeGitEnvironment({ env, policy: "strict" });
}
