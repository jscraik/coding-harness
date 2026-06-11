import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	ensureGitHubTokenForE2E,
	getGitHubAppE2EEnvStatus,
	hasGitHubAuthForE2E,
	loadCodexEnvForE2E,
	loadGitHubAppE2EEnv,
} from "./env.js";

const managedEnvKeys = [
	"GITHUB_PERSONAL_ACCESS_TOKEN",
	"LINEAR_API_KEY",
	"GITHUB_TOKEN",
	"GH_TOKEN",
	"E2E_GITHUB_APP_ID",
	"GITHUB_APP_ID",
	"E2E_GITHUB_APP_INSTALLATION_ID",
	"GITHUB_APP_INSTALLATION_ID",
	"E2E_GITHUB_APP_PRIVATE_KEY",
	"GITHUB_APP_PRIVATE_KEY",
	"E2E_GITHUB_APP_PRIVATE_KEY_PATH",
	"GITHUB_APP_PRIVATE_KEY_PATH",
] as const;

const originalEnv = new Map(
	managedEnvKeys.map((key) => [key, process.env[key]] as const),
);

function clearManagedEnv(): void {
	for (const key of managedEnvKeys) {
		delete process.env[key];
	}
}

describe("E2E GitHub App env loading", () => {
	afterEach(() => {
		clearManagedEnv();
		for (const [key, value] of originalEnv) {
			if (value === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = value;
			}
		}
	});

	it("loads complete GitHub App credentials from a private key path", () => {
		clearManagedEnv();
		const dir = mkdtempSync(join(tmpdir(), "e2e-github-app-env-"));
		const privateKeyPath = join(dir, "app.pem");
		writeFileSync(privateKeyPath, "fixture-private-key", "utf-8");
		process.env.GITHUB_APP_ID = "123";
		process.env.GITHUB_APP_INSTALLATION_ID = "456";
		process.env.GITHUB_APP_PRIVATE_KEY_PATH = privateKeyPath;

		expect(getGitHubAppE2EEnvStatus()).toEqual({
			configured: true,
			partial: false,
			missing: [],
			usesPrivateKeyPath: true,
		});
		expect(loadGitHubAppE2EEnv()).toEqual({
			appId: "123",
			installationId: "456",
			privateKey: "fixture-private-key",
		});
	});

	it("rejects partial GitHub App config before silently falling back to PAT", async () => {
		clearManagedEnv();
		process.env.GITHUB_PERSONAL_ACCESS_TOKEN = "ghp_fixturetoken";
		process.env.GITHUB_APP_ID = "123";

		expect(getGitHubAppE2EEnvStatus()).toMatchObject({
			configured: false,
			partial: true,
			missing: [
				"E2E_GITHUB_APP_INSTALLATION_ID/GITHUB_APP_INSTALLATION_ID",
				"E2E_GITHUB_APP_PRIVATE_KEY/GITHUB_APP_PRIVATE_KEY or E2E_GITHUB_APP_PRIVATE_KEY_PATH/GITHUB_APP_PRIVATE_KEY_PATH",
			],
		});
		await expect(ensureGitHubTokenForE2E()).rejects.toThrow(
			"Partial GitHub App E2E credentials are configured",
		);
	});

	it("treats unreadable private key paths as incomplete GitHub App config", () => {
		clearManagedEnv();
		process.env.GITHUB_APP_ID = "123";
		process.env.GITHUB_APP_INSTALLATION_ID = "456";
		process.env.GITHUB_APP_PRIVATE_KEY_PATH = join(
			tmpdir(),
			"missing-e2e-github-app-key.pem",
		);

		expect(getGitHubAppE2EEnvStatus()).toMatchObject({
			configured: false,
			partial: true,
			missing: [
				"E2E_GITHUB_APP_PRIVATE_KEY/GITHUB_APP_PRIVATE_KEY or E2E_GITHUB_APP_PRIVATE_KEY_PATH/GITHUB_APP_PRIVATE_KEY_PATH",
			],
			usesPrivateKeyPath: true,
		});
		expect(loadGitHubAppE2EEnv()).toBeNull();
	});

	it("uses PAT only when no GitHub App credential set is present", async () => {
		clearManagedEnv();
		process.env.GITHUB_PERSONAL_ACCESS_TOKEN = "  ghp_fixturetoken  ";

		expect(hasGitHubAuthForE2E()).toBe(true);
		await expect(ensureGitHubTokenForE2E()).resolves.toBe(
			"GITHUB_PERSONAL_ACCESS_TOKEN",
		);
	});

	it("loads missing E2E credentials from a regular Codex env file without exposing values", () => {
		clearManagedEnv();
		const dir = mkdtempSync(join(tmpdir(), "e2e-codex-env-"));
		const envPath = join(dir, ".env");
		try {
			writeFileSync(
				envPath,
				[
					"GITHUB_PERSONAL_ACCESS_TOKEN=ghp_fixturetoken",
					"LINEAR_API_KEY=lin_api_fixture",
					"UNRELATED_SECRET=must_not_load",
				].join("\n"),
				"utf-8",
			);

			const result = loadCodexEnvForE2E(envPath);

			expect(result).toEqual({
				status: "loaded",
				path: envPath,
				loadedNames: ["GITHUB_PERSONAL_ACCESS_TOKEN", "LINEAR_API_KEY"],
				missingNames: [],
			});
			expect(process.env.GITHUB_PERSONAL_ACCESS_TOKEN).toBe("ghp_fixturetoken");
			expect(process.env.LINEAR_API_KEY).toBe("lin_api_fixture");
			expect(process.env.UNRELATED_SECRET).toBeUndefined();
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("classifies FIFO Codex env surfaces without reading from them", () => {
		clearManagedEnv();
		const dir = mkdtempSync(join(tmpdir(), "e2e-codex-env-fifo-"));
		const envPath = join(dir, ".env");
		try {
			execFileSync("mkfifo", [envPath]);

			const result = loadCodexEnvForE2E(envPath);

			expect(result).toEqual({
				status: "blocked_env_fifo_timeout",
				path: envPath,
				loadedNames: [],
				missingNames: [
					"GITHUB_PERSONAL_ACCESS_TOKEN/GitHub App credentials",
					"LINEAR_API_KEY",
				],
			});
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
