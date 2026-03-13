/**
 * E2E Environment Configuration
 *
 * Loads and validates environment variables for E2E testing.
 * All sensitive values are masked in logs and recordings.
 */

export interface E2EEnv {
	// GitHub Configuration
	githubToken: string;
	githubOwner: string;
	githubTestRepo: string;

	// Linear Configuration
	linearToken: string;
	linearTestTeam: string;

	// E2E Configuration
	e2eMode: boolean;
	recordingsDir: string;
	cleanupAfterTest: boolean;
	preserveTestData: boolean;
}

function getEnvVar(name: string, required = true): string | undefined {
	const value = process.env[name];
	if (required && !value) {
		throw new Error(`Required environment variable ${name} is not set`);
	}
	return value;
}

export function loadE2EEnv(): E2EEnv {
	return {
		// GitHub
		githubToken: getEnvVar("GITHUB_PERSONAL_ACCESS_TOKEN")!,
		githubOwner: getEnvVar("GITHUB_TEST_OWNER") || "jscraik",
		githubTestRepo: getEnvVar("GITHUB_TEST_REPO") || "coding-harness-e2e-test",

		// Linear
		linearToken: getEnvVar("LINEAR_API_KEY")!,
		linearTestTeam: getEnvVar("LINEAR_TEST_TEAM") || "JSC",

		// E2E Options
		e2eMode: process.env.E2E_MODE === "true",
		recordingsDir: process.env.E2E_RECORDING_DIR || "./e2e/recordings",
		cleanupAfterTest: process.env.E2E_CLEANUP !== "false", // default true
		preserveTestData: process.env.E2E_PRESERVE_DATA === "true", // default false
	};
}

export function validateE2EEnv(): void {
	const missing: string[] = [];

	if (!process.env.GITHUB_PERSONAL_ACCESS_TOKEN) {
		missing.push("GITHUB_PERSONAL_ACCESS_TOKEN");
	}
	if (!process.env.LINEAR_API_KEY) {
		missing.push("LINEAR_API_KEY");
	}

	if (missing.length > 0) {
		throw new Error(
			`E2E tests require the following environment variables:\n${missing.map((v) => `  - ${v}`).join("\n")}\n\nSet them before running E2E tests:\n  export GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxx\n  export LINEAR_API_KEY=lin_api_xxx\n`,
		);
	}
}

export function maskSensitiveData(obj: unknown): unknown {
	if (typeof obj === "string") {
		return obj
			.replace(/ghp_[a-zA-Z0-9]{36}/g, "[GITHUB_TOKEN_MASKED]")
			.replace(/lin_api_[a-zA-Z0-9]{32}/g, "[LINEAR_TOKEN_MASKED]")
			.replace(/[a-f0-9]{40}/g, "[SHA_MASKED]");
	}
	if (Array.isArray(obj)) {
		return obj.map(maskSensitiveData);
	}
	if (obj && typeof obj === "object") {
		const masked: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(obj)) {
			// Mask sensitive keys
			if (/token|secret|password|key|auth/i.test(key)) {
				masked[key] = "[MASKED]";
			} else {
				masked[key] = maskSensitiveData(value);
			}
		}
		return masked;
	}
	return obj;
}
