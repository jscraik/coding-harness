/**
 * E2E Environment Configuration
 *
 * Loads and validates environment variables for E2E testing.
 * All sensitive values are masked in logs and recordings.
 */

import { createSign } from "node:crypto";
import { readFileSync, statSync, type Stats } from "node:fs";
import { homedir } from "node:os";

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

export const DEFAULT_CODEX_ENV_FILE = `${homedir()}/.codex/.env`;
const CODEX_E2E_GITHUB_PAT_RECOVERY_KEYS = [
	"GITHUB_PERSONAL_ACCESS_TOKEN",
] as const;
const CODEX_E2E_GITHUB_APP_ID_RECOVERY_KEYS = [
	"E2E_GITHUB_APP_ID",
	"GITHUB_APP_ID",
] as const;
const CODEX_E2E_GITHUB_APP_INSTALLATION_RECOVERY_KEYS = [
	"E2E_GITHUB_APP_INSTALLATION_ID",
	"GITHUB_APP_INSTALLATION_ID",
] as const;
const CODEX_E2E_GITHUB_APP_PRIVATE_KEY_RECOVERY_KEYS = [
	"E2E_GITHUB_APP_PRIVATE_KEY",
	"GITHUB_APP_PRIVATE_KEY",
	"E2E_GITHUB_APP_PRIVATE_KEY_PATH",
	"GITHUB_APP_PRIVATE_KEY_PATH",
] as const;
const CODEX_E2E_LINEAR_RECOVERY_KEYS = ["LINEAR_API_KEY"] as const;

export type CodexE2EEnvRecoveryStatus =
	| "not_needed"
	| "loaded"
	| "missing"
	| "blocked_env_fifo_timeout"
	| "not_regular_file"
	| "unreadable"
	| "incomplete";

export interface CodexE2EEnvRecoveryResult {
	status: CodexE2EEnvRecoveryStatus;
	path: string;
	loadedNames: string[];
	missingNames: string[];
}

/**
 * Retrieve an environment variable by name, optionally enforcing that it exists.
 *
 * @param name - The environment variable name to read.
 * @param required - If `true`, throws an `Error` when the variable is missing; if `false`, returns `undefined` when absent.
 * @returns The environment variable value, or `undefined` if it is not set and `required` is `false`.
 */
function getEnvVar(name: string, required = true): string | undefined {
	const value = process.env[name]?.trim();
	if (required && !value) {
		throw new Error(`Required environment variable ${name} is not set`);
	}
	return value;
}

/**
 * Selects the first configured environment variable from an ordered list of candidates.
 *
 * Trims each found value and returns the first non-empty result.
 *
 * @param names - Candidate environment variable names to check, in priority order.
 * @returns The first trimmed, non-empty environment variable value, or `undefined` if none are present.
 */
function getFirstEnvVar(names: readonly string[]): string | undefined {
	for (const name of names) {
		const value = process.env[name]?.trim();
		if (value) {
			return value;
		}
	}
	return undefined;
}

function getMissingE2ECredentialNames(): string[] {
	const missing: string[] = [];
	if (!hasGitHubAuthForE2E()) {
		missing.push("GITHUB_PERSONAL_ACCESS_TOKEN/GitHub App credentials");
	}
	if (!process.env.LINEAR_API_KEY?.trim()) {
		missing.push("LINEAR_API_KEY");
	}
	return missing;
}

function parseCodexEnvLine(line: string): [string, string] | null {
	const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(
		line.trim(),
	);
	if (!match) {
		return null;
	}
	const [, name, rawValue] = match;
	if (!name || rawValue === undefined) {
		return null;
	}
	let value = rawValue.trim();
	if (
		(value.startsWith('"') && value.endsWith('"')) ||
		(value.startsWith("'") && value.endsWith("'"))
	) {
		value = value.slice(1, -1);
	}
	return [name, value];
}

function getRecoveryValue(
	envValues: ReadonlyMap<string, string>,
	names: readonly string[],
): [string, string] | null {
	for (const name of names) {
		const value = envValues.get(name)?.trim();
		if (value) {
			return [name, value];
		}
	}
	return null;
}

function getCompleteGitHubAppRecoveryValues(
	envValues: ReadonlyMap<string, string>,
): Array<[string, string]> {
	const appId = getRecoveryValue(
		envValues,
		CODEX_E2E_GITHUB_APP_ID_RECOVERY_KEYS,
	);
	const installationId = getRecoveryValue(
		envValues,
		CODEX_E2E_GITHUB_APP_INSTALLATION_RECOVERY_KEYS,
	);
	const privateKey = getRecoveryValue(
		envValues,
		CODEX_E2E_GITHUB_APP_PRIVATE_KEY_RECOVERY_KEYS,
	);
	return appId && installationId && privateKey
		? [appId, installationId, privateKey]
		: [];
}

function getCodexE2EEnvRecoveryValues(
	envValues: ReadonlyMap<string, string>,
	missingBefore: readonly string[],
): Array<[string, string]> {
	const recoveryValues: Array<[string, string]> = [];
	if (
		missingBefore.includes(
			"GITHUB_PERSONAL_ACCESS_TOKEN/GitHub App credentials",
		)
	) {
		const pat = getRecoveryValue(envValues, CODEX_E2E_GITHUB_PAT_RECOVERY_KEYS);
		recoveryValues.push(
			...(pat ? [pat] : getCompleteGitHubAppRecoveryValues(envValues)),
		);
	}
	if (missingBefore.includes("LINEAR_API_KEY")) {
		const linearToken = getRecoveryValue(
			envValues,
			CODEX_E2E_LINEAR_RECOVERY_KEYS,
		);
		if (linearToken) {
			recoveryValues.push(linearToken);
		}
	}
	return recoveryValues;
}

export function loadCodexEnvForE2E(
	envFilePath = DEFAULT_CODEX_ENV_FILE,
): CodexE2EEnvRecoveryResult {
	const missingBefore = getMissingE2ECredentialNames();
	if (missingBefore.length === 0) {
		return {
			status: "not_needed",
			path: envFilePath,
			loadedNames: [],
			missingNames: [],
		};
	}

	let envStat: Stats;
	try {
		envStat = statSync(envFilePath);
	} catch (error) {
		const errorCode =
			error && typeof error === "object" && "code" in error
				? (error as { code?: unknown }).code
				: undefined;
		if (errorCode === "EACCES" || errorCode === "EPERM") {
			return {
				status: "unreadable",
				path: envFilePath,
				loadedNames: [],
				missingNames: missingBefore,
			};
		}
		if (errorCode !== "ENOENT") {
			throw error;
		}
		return {
			status: "missing",
			path: envFilePath,
			loadedNames: [],
			missingNames: missingBefore,
		};
	}

	if (envStat.isFIFO()) {
		return {
			status: "blocked_env_fifo_timeout",
			path: envFilePath,
			loadedNames: [],
			missingNames: missingBefore,
		};
	}
	if (!envStat.isFile()) {
		return {
			status: "not_regular_file",
			path: envFilePath,
			loadedNames: [],
			missingNames: missingBefore,
		};
	}

	let content: string;
	try {
		content = readFileSync(envFilePath, "utf-8");
	} catch {
		return {
			status: "unreadable",
			path: envFilePath,
			loadedNames: [],
			missingNames: missingBefore,
		};
	}

	const envValues = new Map<string, string>();
	for (const line of content.split(/\r?\n/)) {
		const parsed = parseCodexEnvLine(line);
		if (!parsed) {
			continue;
		}
		const [name, value] = parsed;
		envValues.set(name, value);
	}

	const loadedNames: string[] = [];
	for (const [name, value] of getCodexE2EEnvRecoveryValues(
		envValues,
		missingBefore,
	)) {
		if (!process.env[name]?.trim() && value.trim()) {
			process.env[name] = value;
			loadedNames.push(name);
		}
	}

	const missingAfter = getMissingE2ECredentialNames();
	return {
		status: missingAfter.length === 0 ? "loaded" : "incomplete",
		path: envFilePath,
		loadedNames,
		missingNames: missingAfter,
	};
}

/**
 * Encodes the given string using URL-safe Base64 encoding.
 *
 * @param value - The input string to encode
 * @returns The Base64 URL-safe representation of `value`
 */
function base64UrlEncode(value: string): string {
	return Buffer.from(value).toString("base64url");
}

/**
 * Convert escaped newline sequences (`\\n`) in a private key string into actual newline characters.
 *
 * @param value - The private key string that may contain escaped newline sequences.
 * @returns The private key string with all `\\n` sequences replaced by real newline characters.
 */
function normalizePrivateKey(value: string): string {
	return value.replace(/\\n/g, "\n");
}

/**
 * Loads the GitHub App private key from environment variables or a file path, preferring an inline key if present.
 *
 * The function checks common environment variables for an inline private key first; if none is found it checks
 * alternate environment variables for a file path and reads the file as UTF-8. Returns `undefined` when no key
 * or path is available.
 *
 * @returns The private key string if available, otherwise `undefined`.
 */
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

	return readGitHubAppPrivateKeyPath(privateKeyPath);
}

function readGitHubAppPrivateKeyPath(
	privateKeyPath: string,
): string | undefined {
	try {
		const privateKey = readFileSync(privateKeyPath, "utf-8").trim();
		return privateKey ? privateKey : undefined;
	} catch {
		return undefined;
	}
}

/**
 * Evaluates presence and completeness of GitHub App E2E credentials in environment variables.
 *
 * Checks for app id, installation id, and a private key (inline or via path) using both
 * E2E-prefixed and standard env var names. Reports whether all required pieces are present,
 * whether a partial set exists, which specific groups are missing, and if a private-key path is used.
 *
 * @returns An object describing the GitHub App E2E credential status:
 * - `configured`: `true` when all required credential groups are present.
 * - `partial`: `true` when at least one credential group exists but not all are present.
 * - `missing`: an array of human-readable env-var group identifiers that are absent.
 * - `usesPrivateKeyPath`: `true` when a private-key file path env var is present.
 */
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
	const filePrivateKey = privateKeyPath
		? readGitHubAppPrivateKeyPath(privateKeyPath)
		: undefined;
	const hasPrivateKey = Boolean(inlinePrivateKey || filePrivateKey);
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

/**
 * Load GitHub App E2E credentials from environment variables.
 *
 * Attempts to read the app id, installation id, and private key (inline or from a file path).
 *
 * @returns `GitHubAppE2EEnv` containing `appId`, `installationId`, and `privateKey` when all values are present; `null` otherwise.
 */
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

/**
 * Determines whether valid GitHub authentication is available for end-to-end tests.
 *
 * Considers a personal access token or a complete GitHub App configuration as valid authentication. If a partial GitHub App configuration is present this function reports that authentication is unavailable.
 *
 * @returns `true` if a usable personal access token is present or a full GitHub App configuration can be loaded, `false` otherwise.
 */
export function hasGitHubAuthForE2E(): boolean {
	const appStatus = getGitHubAppE2EEnvStatus();
	if (appStatus.partial) {
		return false;
	}
	return Boolean(
		getFirstEnvVar(["GITHUB_PERSONAL_ACCESS_TOKEN"]) || loadGitHubAppE2EEnv(),
	);
}

/**
 * Create a signed JWT for GitHub App authentication.
 *
 * @param config - GitHub App credentials containing `appId` (the app's identifier) and `privateKey` (PEM-format RSA private key) used to sign the token.
 * @returns A RS256-signed JSON Web Token string issued for the provided app ID suitable for use as a GitHub App bearer token.
 */
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

/**
 * Extracts the named property from an arbitrary value when that property is a string.
 *
 * Attempts to read `field` from `value` if `value` is a non-null object and the property is a string.
 *
 * @param value - The value to inspect for the property.
 * @param field - The property name to extract.
 * @returns The string value of the property if present and a string, otherwise `undefined`.
 */
function getStringField(value: unknown, field: string): string | undefined {
	if (!value || typeof value !== "object") {
		return undefined;
	}
	const fieldValue = (value as Record<string, unknown>)[field];
	return typeof fieldValue === "string" ? fieldValue : undefined;
}

/**
 * Mint an installation access token for a GitHub App installation.
 *
 * @param config - GitHub App credentials and installation identifier used to authenticate the request
 * @returns The minted installation token and optional expiration timestamp (`expiresAt`) when provided by GitHub
 * @throws Error if the HTTP request fails or the response does not include a token
 */
export async function mintGitHubAppInstallationToken(
	config: GitHubAppE2EEnv,
): Promise<GitHubAppTokenResult> {
	const jwt = createGitHubAppJwt(config);
	const response = await fetch(
		`https://api.github.com/app/installations/${config.installationId}/access_tokens`,
		{
			method: "POST",
			signal: AbortSignal.timeout(15_000),
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

/**
 * Ensure a usable GitHub token is available for E2E tests.
 *
 * If complete GitHub App credentials are configured, mints an installation token and writes it into the environment; otherwise uses an existing `GITHUB_PERSONAL_ACCESS_TOKEN` if present.
 *
 * @returns A label identifying the token source: `"GitHub App installation token"` when a token was minted from a GitHub App, or `"GITHUB_PERSONAL_ACCESS_TOKEN"` when an existing personal access token is used.
 * @throws Error if only partial GitHub App credentials are configured.
 * @throws Error if neither a personal access token nor complete GitHub App credentials are available.
 */
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

/**
 * Load E2E runtime configuration from environment variables.
 *
 * Reads required and optional E2E settings and returns a populated E2EEnv.
 * Required environment variables:
 * - `GITHUB_PERSONAL_ACCESS_TOKEN`
 * - `LINEAR_API_KEY`
 *
 * Optional variables and defaults:
 * - `GITHUB_TEST_OWNER` (default: `"jscraik"`)
 * - `GITHUB_TEST_REPO` (default: `"coding-harness-e2e-test"`)
 * - `LINEAR_TEST_TEAM` (default: `"JSC"`)
 * - `E2E_MODE` (`"true"` enables E2E mode)
 * - `E2E_RECORDING_DIR` (default: `"./e2e/recordings"`)
 * - `E2E_CLEANUP` (`"false"` disables cleanup; default is enabled)
 * - `E2E_PRESERVE_DATA` (`"true"` preserves test data; default is false)
 *
 * @returns The assembled `E2EEnv` object with the following properties:
 * - `githubToken`: GitHub personal access token (from `GITHUB_PERSONAL_ACCESS_TOKEN`)
 * - `githubOwner`: repository owner used for tests
 * - `githubTestRepo`: repository name used for tests
 * - `linearToken`: Linear API key (from `LINEAR_API_KEY`)
 * - `linearTestTeam`: Linear team identifier used for tests
 * - `e2eMode`: whether E2E mode is enabled
 * - `recordingsDir`: filesystem path where recordings are stored
 * - `cleanupAfterTest`: whether test artifacts should be removed after runs
 * - `preserveTestData`: whether to preserve test data between runs
 */
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

/**
 * Validates that all required environment variables for E2E tests are present.
 *
 * Checks for either a usable GitHub authentication method (a personal access token or complete GitHub App credentials)
 * and a Linear API key. If any required values are missing, throws an Error that lists the missing entries and
 * provides example export commands.
 *
 * @throws Error if one or more required environment variables are missing; the thrown error's message contains the missing items and example exports.
 */
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
