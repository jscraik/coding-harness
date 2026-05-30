/** Git environment sanitation policy for repo-scoped subprocesses. */
export type GitEnvironmentSanitationPolicy = "minimal" | "strict";

const MINIMAL_GIT_ENV_KEYS = [
	"GIT_COMMON_DIR",
	"GIT_DIR",
	"GIT_INDEX_FILE",
	"GIT_WORK_TREE",
] as const;

/** Options for constructing a sanitized git subprocess environment. */
export interface SanitizeGitEnvironmentOptions {
	/** Source environment. Defaults to the current process environment. */
	env?: NodeJS.ProcessEnv;
	/** Sanitation policy to apply. Defaults to strict. */
	policy?: GitEnvironmentSanitationPolicy;
}

/** Return a git subprocess environment with caller-scoped git state removed. */
export function sanitizeGitEnvironment(
	options: SanitizeGitEnvironmentOptions = {},
): NodeJS.ProcessEnv {
	const env = options.env ?? process.env;
	const policy = options.policy ?? "strict";
	const sanitizedEnv: NodeJS.ProcessEnv = {};
	for (const [key, value] of Object.entries(env)) {
		if (value === undefined) {
			continue;
		}
		if (shouldDropGitEnvironmentKey(key, policy)) {
			continue;
		}
		sanitizedEnv[key] = value;
	}
	return sanitizedEnv;
}

function shouldDropGitEnvironmentKey(
	key: string,
	policy: GitEnvironmentSanitationPolicy,
): boolean {
	if (policy === "strict") {
		return isGitEnvironmentKey(key);
	}
	return MINIMAL_GIT_ENV_KEYS.includes(
		key as (typeof MINIMAL_GIT_ENV_KEYS)[number],
	);
}

/** Return whether an environment variable belongs to git's namespace. */
export function isGitEnvironmentKey(key: string): boolean {
	return key.startsWith("GIT_");
}
