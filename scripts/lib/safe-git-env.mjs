const CALLER_SCOPED_GIT_ENV_KEYS = new Set([
	"GIT_COMMON_DIR",
	"GIT_ALTERNATE_OBJECT_DIRECTORIES",
	"GIT_DIR",
	"GIT_INDEX_FILE",
	"GIT_OBJECT_DIRECTORY",
	"GIT_QUARANTINE_PATH",
	"GIT_WORK_TREE",
]);

function isCallerScopedGitEnvironmentKey(key) {
	return (
		CALLER_SCOPED_GIT_ENV_KEYS.has(key) ||
		key === "GIT_CONFIG" ||
		key.startsWith("GIT_CONFIG_")
	);
}

export function sanitizeGitEnvironment(
	environment,
	options = { policy: "minimal" },
) {
	const sanitized = {};
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
