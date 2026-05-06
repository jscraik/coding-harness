/**
 * E2E Environment Configuration
 *
 * Loads and validates environment variables for E2E testing.
 * All sensitive values are masked in logs and recordings.
 */

import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

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

export interface GitHubAppE2EEnv {
	appId: string;
	installationId: string;
	privateKey: string;
}

export interface GitHubAppTokenResult {
	token: string;
	expiresAt?: string;
}

export interface GitHubAppE2EEnvStatus {
	configured: boolean;
	partial: boolean;
	missing: string[];
	usesPrivateKeyPath: boolean;
}

function getEnvVar(name: string, required = true): string | undefined {
	const value = process.env[name];
	if (required && !value) {
		throw new Error(`Required environment variable ${name} is not set`);
	}
	return value;
}

function getFirstEnvVar(names: readonly string[]): string | undefined {
	for (const name of names) {
		const value = process.env[name]?.trim();
		if (value) {
			return value;
		}
	}
	return undefined;
}

function base64UrlEncode(value: string): string {
	return Buffer.from(value).toString("base64url");
}

function normalizePrivateKey(value: string): string {
	return value.replace(/\\n/g, "\n");
}

function loadGitHubAppPrivateKey(): string | undefined {
	const inlinePrivateKey = getFirstEnvVar([
		"E2E_GITHUB_APP_PRIVATE_KEY",
		"GITHUB_APP_PRIVATE_KEY",
	]);
	if (inlinePrivateKey) {
		return normalizePrivateKey(inlinePrivateKey);
	}

	const privateKeyPath = getFirstEnvVar([
		"E2E_GITHUB_APP_PRIVATE_KEY_PATH",
		"GITHUB_APP_PRIVATE_KEY_PATH",
	]);
	if (!privateKeyPath) {
		return undefined;
	}

	return readFileSync(privateKeyPath, "utf-8");
}

export function getGitHubAppE2EEnvStatus(): GitHubAppE2EEnvStatus {
	const appId = getFirstEnvVar(["E2E_GITHUB_APP_ID", "GITHUB_APP_ID"]);
	const installationId = getFirstEnvVar([
		"E2E_GITHUB_APP_INSTALLATION_ID",
		"GITHUB_APP_INSTALLATION_ID",
	]);
	const inlinePrivateKey = getFirstEnvVar([
		"E2E_GITHUB_APP_PRIVATE_KEY",
		"GITHUB_APP_PRIVATE_KEY",
	]);
	const privateKeyPath = getFirstEnvVar([
		"E2E_GITHUB_APP_PRIVATE_KEY_PATH",
		"GITHUB_APP_PRIVATE_KEY_PATH",
	]);
	const hasPrivateKey = Boolean(inlinePrivateKey || privateKeyPath);
	const missing = [
		...(appId ? [] : ["E2E_GITHUB_APP_ID/GITHUB_APP_ID"]),
		...(installationId
			? []
			: ["E2E_GITHUB_APP_INSTALLATION_ID/GITHUB_APP_INSTALLATION_ID"]),
		...(hasPrivateKey
			? []
			: [
					"E2E_GITHUB_APP_PRIVATE_KEY/GITHUB_APP_PRIVATE_KEY or E2E_GITHUB_APP_PRIVATE_KEY_PATH/GITHUB_APP_PRIVATE_KEY_PATH",
				]),
	];
	const configured = missing.length === 0;
	return {
		configured,
		partial: !configured && Boolean(appId || installationId || hasPrivateKey),
		missing,
		usesPrivateKeyPath: Boolean(privateKeyPath),
	};
}

export function loadGitHubAppE2EEnv(): GitHubAppE2EEnv | null {
	const appId = getFirstEnvVar(["E2E_GITHUB_APP_ID", "GITHUB_APP_ID"]);
	const installationId = getFirstEnvVar([
		"E2E_GITHUB_APP_INSTALLATION_ID",
		"GITHUB_APP_INSTALLATION_ID",
	]);
	const privateKey = loadGitHubAppPrivateKey();

	if (!appId || !installationId || !privateKey) {
		return null;
	}

	return {
		appId,
		installationId,
		privateKey,
	};
}

export function hasGitHubAuthForE2E(): boolean {
	const appStatus = getGitHubAppE2EEnvStatus();
	if (appStatus.partial) {
		return false;
	}
	return Boolean(
		process.env.GITHUB_PERSONAL_ACCESS_TOKEN || loadGitHubAppE2EEnv(),
	);
}

function createGitHubAppJwt(config: GitHubAppE2EEnv): string {
	const now = Math.floor(Date.now() / 1000);
	const header = base64UrlEncode(
		JSON.stringify({
			alg: "RS256",
			typ: "JWT",
		}),
	);
	const payload = base64UrlEncode(
		JSON.stringify({
			iat: now - 60,
			exp: now + 540,
			iss: config.appId,
		}),
	);
	const signingInput = `${header}.${payload}`;
	const signature = createSign("RSA-SHA256")
		.update(signingInput)
		.sign(config.privateKey, "base64url");

	return `${signingInput}.${signature}`;
}

function getStringField(value: unknown, field: string): string | undefined {
	if (!value || typeof value !== "object") {
		return undefined;
	}
	const fieldValue = (value as Record<string, unknown>)[field];
	return typeof fieldValue === "string" ? fieldValue : undefined;
}

export async function mintGitHubAppInstallationToken(
	config: GitHubAppE2EEnv,
): Promise<GitHubAppTokenResult> {
	const jwt = createGitHubAppJwt(config);
	const response = await fetch(
		`https://api.github.com/app/installations/${config.installationId}/access_tokens`,
		{
			method: "POST",
			headers: {
				Accept: "application/vnd.github+json",
				Authorization: `Bearer ${jwt}`,
				"X-GitHub-Api-Version": "2022-11-28",
			},
		},
	);
	const body = (await response.json().catch(() => ({}))) as unknown;

	if (!response.ok) {
		const message = getStringField(body, "message") ?? response.statusText;
		throw new Error(
			`GitHub App installation token request failed (${response.status}): ${message}`,
		);
	}

	const token = getStringField(body, "token");
	if (!token) {
		throw new Error(
			"GitHub App installation token response did not include token",
		);
	}

	const expiresAt = getStringField(body, "expires_at");
	return expiresAt ? { token, expiresAt } : { token };
}

export async function ensureGitHubTokenForE2E(): Promise<string> {
	const appStatus = getGitHubAppE2EEnvStatus();
	if (appStatus.partial) {
		throw new Error(
			`Partial GitHub App E2E credentials are configured. Missing: ${appStatus.missing.join(", ")}. ` +
				"Either provide the complete GitHub App credential set or remove the partial app variables before falling back to GITHUB_PERSONAL_ACCESS_TOKEN.",
		);
	}
	const appConfig = loadGitHubAppE2EEnv();
	if (appConfig) {
		const { token } = await mintGitHubAppInstallationToken(appConfig);
		process.env.GITHUB_PERSONAL_ACCESS_TOKEN = token;
		process.env.GITHUB_TOKEN = token;
		process.env.GH_TOKEN = token;
		return "GitHub App installation token";
	}

	const existingToken = process.env.GITHUB_PERSONAL_ACCESS_TOKEN?.trim();
	if (existingToken) {
		return "GITHUB_PERSONAL_ACCESS_TOKEN";
	}

	throw new Error(
		"E2E tests require GITHUB_PERSONAL_ACCESS_TOKEN or GitHub App credentials: E2E_GITHUB_APP_ID/GITHUB_APP_ID, E2E_GITHUB_APP_INSTALLATION_ID/GITHUB_APP_INSTALLATION_ID, and E2E_GITHUB_APP_PRIVATE_KEY/GITHUB_APP_PRIVATE_KEY or E2E_GITHUB_APP_PRIVATE_KEY_PATH/GITHUB_APP_PRIVATE_KEY_PATH.",
	);
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

	if (!hasGitHubAuthForE2E()) {
		const appStatus = getGitHubAppE2EEnvStatus();
		missing.push(
			appStatus.partial
				? `complete GitHub App credentials; missing ${appStatus.missing.join(", ")}`
				: "GITHUB_PERSONAL_ACCESS_TOKEN or GitHub App credentials (E2E_GITHUB_APP_ID/GITHUB_APP_ID, E2E_GITHUB_APP_INSTALLATION_ID/GITHUB_APP_INSTALLATION_ID, E2E_GITHUB_APP_PRIVATE_KEY/GITHUB_APP_PRIVATE_KEY or E2E_GITHUB_APP_PRIVATE_KEY_PATH/GITHUB_APP_PRIVATE_KEY_PATH)",
		);
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
