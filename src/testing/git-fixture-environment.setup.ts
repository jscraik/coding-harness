import { buildFixtureEnvironment } from "./git-fixture-environment.js";

/**
 * Keep raw disposable Git fixtures independent of the host signing policy
 * and isolated from inherited Git routing variables.
 */

// Strip Git routing keys that sanitizeGitEnvironment with "minimal" policy removes
const routingKeys = [
	"GIT_DIR",
	"GIT_WORK_TREE",
	"GIT_INDEX_FILE",
	"GIT_COMMON_DIR",
	"GIT_OBJECT_DIRECTORY",
	"GIT_ALTERNATE_OBJECT_DIRECTORIES",
	"GIT_QUARANTINE_PATH",
];

for (const key of routingKeys) {
	delete process.env[key];
}

// Also strip GIT_CONFIG and GIT_CONFIG_* keys
for (const key of Object.keys(process.env)) {
	if (key === "GIT_CONFIG" || key.startsWith("GIT_CONFIG_")) {
		delete process.env[key];
	}
}

// Apply sanitized + signing-disabled environment
Object.assign(process.env, buildFixtureEnvironment(process.env));
