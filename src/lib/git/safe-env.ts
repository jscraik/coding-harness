const CALLER_SCOPED_GIT_ENV_KEYS = new Set([
	"GIT_COMMON_DIR",
	"GIT_ALTERNATE_OBJECT_DIRECTORIES",
	"GIT_DIR",
	"GIT_INDEX_FILE",
	"GIT_OBJECT_DIRECTORY",
	"GIT_QUARANTINE_PATH",
	"GIT_WORK_TREE",
]);

/** Git subprocess environment cleanup policy. */
export type GitEnvironmentPolicy = "minimal" | "strict";

/** Options for git subprocess environment sanitization. */
export interface SanitizeGitEnvironmentOptions {
	policy: GitEnvironmentPolicy;
}

/** Return an environment safe for git subprocesses under the selected policy. */
export function sanitizeGitEnvironment(
	environment: NodeJS.ProcessEnv = process.env,
	options: SanitizeGitEnvironmentOptions,
): NodeJS.ProcessEnv {
	const sanitized: NodeJS.ProcessEnv = {};
	for (const [key, value] of Object.entries(environment)) {
		if (value === undefined) continue;
		if (options.policy === "strict" && key.startsWith("GIT_")) continue;
		if (options.policy === "minimal" && CALLER_SCOPED_GIT_ENV_KEYS.has(key)) {
			continue;
		}
		sanitized[key] = value;
	}
	return sanitized;
}
