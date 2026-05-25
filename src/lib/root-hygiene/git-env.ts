/** Return an environment for git subprocesses without caller-scoped git state. */
export function rootHygieneGitEnv(
	env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
	const sanitizedEnv: NodeJS.ProcessEnv = {};
	for (const [key, value] of Object.entries(env)) {
		if (key.startsWith("GIT_") || value === undefined) {
			continue;
		}
		sanitizedEnv[key] = value;
	}
	return sanitizedEnv;
}
