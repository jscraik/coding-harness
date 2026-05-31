const CALLER_SCOPED_GIT_ENV_KEYS = new Set([
	"GIT_COMMON_DIR",
	"GIT_ALTERNATE_OBJECT_DIRECTORIES",
	"GIT_DIR",
	"GIT_INDEX_FILE",
	"GIT_OBJECT_DIRECTORY",
	"GIT_QUARANTINE_PATH",
	"GIT_WORK_TREE",
]);

export function isGitEnvironmentKey(key: string): boolean {
	return key.startsWith("GIT_");
}

function isCallerScopedGitEnvironmentKey(key: string): boolean {
	return (
		CALLER_SCOPED_GIT_ENV_KEYS.has(key) ||
		key === "GIT_CONFIG" ||
		key.startsWith("GIT_CONFIG_")
	);
}

/** Git subprocess environment cleanup policy. */
export type GitEnvironmentPolicy = "minimal" | "strict";

/** Options for git subprocess environment sanitization. */
export interface SanitizeGitEnvironmentOptions {
	policy: GitEnvironmentPolicy;
}

function isSanitizeGitEnvironmentOptions(
	value: NodeJS.ProcessEnv | SanitizeGitEnvironmentOptions,
): value is SanitizeGitEnvironmentOptions {
	return "policy" in value;
}

/** Return an environment safe for git subprocesses under the selected policy. */
export function sanitizeGitEnvironment(
	environmentOrOptions:
		| NodeJS.ProcessEnv
		| SanitizeGitEnvironmentOptions = process.env,
	maybeOptions?: SanitizeGitEnvironmentOptions,
): NodeJS.ProcessEnv {
	const environment = maybeOptions ? environmentOrOptions : process.env;
	const options =
		maybeOptions ??
		(isSanitizeGitEnvironmentOptions(environmentOrOptions)
			? environmentOrOptions
			: { policy: "minimal" });
	const sanitized: NodeJS.ProcessEnv = {};
	for (const [key, value] of Object.entries(environment)) {
		if (value === undefined) continue;
		if (options.policy === "strict" && key.startsWith("GIT_")) continue;
		if (options.policy === "minimal" && isCallerScopedGitEnvironmentKey(key)) {
			continue;
		}
		sanitized[key] = value;
	}
	return sanitized;
}
