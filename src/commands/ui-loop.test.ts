import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { type PartialDeep, fromPartial } from "@total-typescript/shoehorn";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadContract } from "../lib/contract/loader.js";
import { EXIT_CODES, runUIExplore, runUIFast, runUIVerify } from "./ui-loop.js";

vi.mock("../lib/contract/loader.js", () => ({
	loadContract: vi.fn(),
}));

vi.mock("node:fs", () => ({
	existsSync: vi.fn(),
	mkdirSync: vi.fn(),
	writeFileSync: vi.fn(),
}));

vi.mock("node:child_process", () => ({
	spawnSync: vi.fn(),
}));

const MOCK_POLICY = {
	version: "1.1.0",
	riskTierRules: {},
	uiLoopPolicy: {
		fastCommand: "npm run ui:fast",
		verifyCommand: "npm run ui:verify",
		exploreCommand: "npm run ui:explore",
		sloTargets: {
			fastLoopSeconds: 25,
			verifyLoopSeconds: 90,
		},
	},
};

type LoadedContract = ReturnType<typeof loadContract>;

const mockLoadedContract = (contract: PartialDeep<LoadedContract>) =>
	fromPartial<LoadedContract>(contract);

describe("ui-loop commands", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		process.env.HARNESS_UI_EXECUTION_DISABLED = undefined;
		vi.mocked(spawnSync).mockReturnValue({
			status: 0,
			stdout: "ok",
			stderr: "",
		} as never);
		vi.mocked(existsSync).mockImplementation((path) => {
			const p = String(path);
			return (
				p.includes("pnpm-lock.yaml") ||
				p.includes(".storybook") ||
				p.includes("playwright.config.ts")
			);
		});
	});

	describe("runUIFast", () => {
		it("supports prepare mode and writes artifact metadata", () => {
			vi.mocked(loadContract).mockReturnValue(mockLoadedContract(MOCK_POLICY));

			const result = runUIFast({
				mode: "prepare",
				ci: true,
				port: 1234,
				json: true,
			});

			expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
			expect(spawnSync).not.toHaveBeenCalled();
			expect(mkdirSync).toHaveBeenCalled();
			expect(writeFileSync).toHaveBeenCalled();

			const payload = JSON.parse(result.message);
			expect(payload.mode).toBe("prepare");
			expect(payload.executed).toBe(false);
			expect(payload.command).toContain("npm run ui:fast -- --ci");
			expect(payload.head_sha).toEqual(expect.any(String));
			expect(payload.contract_version).toBe("1.1.0");
			expect(payload.artifact_uri).toContain("artifacts/ui-loop");
			expect(payload.artifact_checksum).toHaveLength(64);
		});

		it("defaults to execute mode", () => {
			const result = runUIFast();

			expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
			expect(spawnSync).toHaveBeenCalledTimes(1);
			expect(result.message).toContain("UI fast execute executed");
		});

		it("treats fast-loop timeout as success", () => {
			const timeoutError = new Error("timed out") as NodeJS.ErrnoException;
			timeoutError.code = "ETIMEDOUT";
			vi.mocked(spawnSync).mockReturnValue({
				status: null,
				stdout: "",
				stderr: "",
				error: timeoutError,
			} as never);

			const result = runUIFast({ mode: "execute" });
			expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
			expect(result.artifact?.timedOut).toBe(true);
			expect(result.artifact?.passed).toBe(true);
		});

		it("returns COMMAND_FAILED when execute mode command fails", () => {
			vi.mocked(spawnSync).mockReturnValue({
				status: 1,
				stdout: "",
				stderr: "boom",
			} as never);

			const result = runUIFast({ mode: "execute" });

			expect(result.exitCode).toBe(EXIT_CODES.COMMAND_FAILED);
			expect(result.artifact?.passed).toBe(false);
		});

		it("returns execution_disabled when kill switch is enabled in execute mode", () => {
			process.env.HARNESS_UI_EXECUTION_DISABLED = "true";

			const result = runUIFast({ mode: "execute", json: true });

			expect(result.exitCode).toBe(EXIT_CODES.EXECUTION_DISABLED);
			expect(spawnSync).not.toHaveBeenCalled();
			const payload = JSON.parse(result.message);
			expect(payload.mode).toBe("execute");
			expect(payload.executed).toBe(false);
			expect(payload.error.code).toBe("execution_disabled");
			expect(payload.error.message).toContain("kill switch");
		});

		it("rejects quoted fast policy commands that require shell parsing", () => {
			vi.mocked(loadContract).mockReturnValue(
				mockLoadedContract({
					...MOCK_POLICY,
					uiLoopPolicy: {
						...MOCK_POLICY.uiLoopPolicy,
						fastCommand: 'npm run "ui:fast"',
					},
				}),
			);

			const result = runUIFast({ mode: "prepare" });

			expect(result.exitCode).toBe(EXIT_CODES.VALIDATION_ERROR);
			expect(result.message).toContain("quoted or escaped");
		});
	});

	describe("runUIVerify", () => {
		it("supports prepare mode with contract command and args", () => {
			vi.mocked(loadContract).mockReturnValue(mockLoadedContract(MOCK_POLICY));

			const result = runUIVerify({
				mode: "prepare",
				shard: "1/3",
				timeout: 45000,
				outputDir: "./test-results",
			});

			expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
			expect(spawnSync).not.toHaveBeenCalled();
			expect(result.evidence?.mode).toBe("prepare");
			expect(result.evidence?.command).toContain("--shard=1/3");
			expect(result.evidence?.command).toContain("--timeout=45000");
			expect(result.evidence?.command).toContain("--output=./test-results");
			expect(result.evidence?.artifactUri).toContain("artifacts/ui-loop");
			expect(result.evidence?.artifactChecksum).toHaveLength(64);
		});

		it("returns NOT_FOUND when Playwright is missing", () => {
			vi.mocked(existsSync).mockReturnValue(false);

			const result = runUIVerify({ mode: "prepare" });

			expect(result.exitCode).toBe(EXIT_CODES.NOT_FOUND);
			expect(result.message).toContain("Playwright not found");
		});

		it("executes in default mode and can fail with COMMAND_FAILED", () => {
			vi.mocked(spawnSync).mockReturnValue({
				status: 2,
				stdout: "",
				stderr: "test failures",
			} as never);

			const result = runUIVerify();

			expect(result.exitCode).toBe(EXIT_CODES.COMMAND_FAILED);
			expect(result.evidence?.mode).toBe("execute");
			expect(result.evidence?.executed).toBe(true);
		});

		it("maps dryRun to prepare even when mode=execute is provided", () => {
			const result = runUIVerify({ mode: "execute", dryRun: true });

			expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
			expect(result.evidence?.mode).toBe("prepare");
			expect(result.evidence?.executed).toBe(false);
			expect(spawnSync).not.toHaveBeenCalled();
		});

		it("returns execution_disabled when kill switch is enabled in execute mode", () => {
			process.env.HARNESS_UI_EXECUTION_DISABLED = "1";

			const result = runUIVerify({ mode: "execute", json: true });

			expect(result.exitCode).toBe(EXIT_CODES.EXECUTION_DISABLED);
			expect(spawnSync).not.toHaveBeenCalled();
			const payload = JSON.parse(result.message);
			expect(payload.mode).toBe("execute");
			expect(payload.executed).toBe(false);
			expect(payload.error.code).toBe("execution_disabled");
		});

		it("returns JSON payload with artifact fields", () => {
			const result = runUIVerify({ mode: "prepare", json: true });

			expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
			const payload = JSON.parse(result.message);
			expect(payload.mode).toBe("prepare");
			expect(payload.executed).toBe(false);
			expect(payload.head_sha).toEqual(expect.any(String));
			expect(payload.contract_version).toEqual(expect.any(String));
			expect(payload.artifact_uri).toContain("artifacts/ui-loop");
			expect(payload.artifact_checksum).toHaveLength(64);
		});

		it("passes user-controlled verify args as literal argv without shell parsing", () => {
			const outputDir = "./test-results;touch_/tmp/not-executed";
			const result = runUIVerify({
				mode: "execute",
				shard: "1/3",
				outputDir,
			});

			expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
			expect(spawnSync).toHaveBeenCalledWith(
				"pnpm",
				["playwright", "test", "--shard=1/3", `--output=${outputDir}`],
				expect.objectContaining({ shell: false }),
			);
		});

		it("forwards verify policy args through npm run separator", () => {
			vi.mocked(loadContract).mockReturnValue(mockLoadedContract(MOCK_POLICY));

			const result = runUIVerify({
				mode: "execute",
				shard: "1/3",
				outputDir: "./test-results",
			});

			expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
			expect(spawnSync).toHaveBeenCalledWith(
				"npm",
				[
					"run",
					"ui:verify",
					"--",
					"test",
					"--shard=1/3",
					"--output=./test-results",
				],
				expect.objectContaining({ shell: false }),
			);
		});

		it("rejects quoted verify policy commands that require shell parsing", () => {
			vi.mocked(loadContract).mockReturnValue(
				mockLoadedContract({
					...MOCK_POLICY,
					uiLoopPolicy: {
						...MOCK_POLICY.uiLoopPolicy,
						verifyCommand: 'npm run "ui:verify"',
					},
				}),
			);

			const result = runUIVerify({ mode: "prepare" });

			expect(result.exitCode).toBe(EXIT_CODES.VALIDATION_ERROR);
			expect(result.message).toContain("quoted or escaped");
		});

		it("rejects verify policy commands with leading env assignments", () => {
			vi.mocked(loadContract).mockReturnValue(
				mockLoadedContract({
					...MOCK_POLICY,
					uiLoopPolicy: {
						...MOCK_POLICY.uiLoopPolicy,
						verifyCommand: "NODE_ENV=test npm run ui:verify",
					},
				}),
			);

			const result = runUIVerify({ mode: "prepare" });

			expect(result.exitCode).toBe(EXIT_CODES.VALIDATION_ERROR);
			expect(result.message).toContain(
				"leading environment variable assignments",
			);
			expect(spawnSync).not.toHaveBeenCalled();
		});
	});

	describe("runUIExplore", () => {
		it("supports prepare mode and emits artifact metadata", () => {
			const result = runUIExplore({
				mode: "prepare",
				url: "http://localhost:8080",
				outputDir: "./explore-results",
				interactions: true,
				json: true,
			});

			expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
			expect(spawnSync).not.toHaveBeenCalled();
			const payload = JSON.parse(result.message);
			expect(payload.mode).toBe("prepare");
			expect(payload.executed).toBe(false);
			expect(payload.interactions).toBe(true);
			expect(payload.head_sha).toEqual(expect.any(String));
			expect(payload.contract_version).toEqual(expect.any(String));
			expect(payload.artifact_uri).toContain("artifacts/ui-loop");
			expect(payload.artifact_checksum).toHaveLength(64);
		});

		it("executes by default", () => {
			const result = runUIExplore();

			expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
			expect(spawnSync).toHaveBeenCalledTimes(1);
			expect(result.evidence?.mode).toBe("execute");
		});

		it("returns COMMAND_FAILED when execute mode command fails", () => {
			vi.mocked(spawnSync).mockReturnValue({
				status: 127,
				stdout: "",
				stderr: "not found",
			} as never);

			const result = runUIExplore({ mode: "execute" });

			expect(result.exitCode).toBe(EXIT_CODES.COMMAND_FAILED);
			expect(result.evidence?.passed).toBe(false);
		});

		it("returns execution_disabled when kill switch is enabled in execute mode", () => {
			process.env.HARNESS_UI_EXECUTION_DISABLED = "yes";

			const result = runUIExplore({ mode: "execute", json: true });

			expect(result.exitCode).toBe(EXIT_CODES.EXECUTION_DISABLED);
			expect(spawnSync).not.toHaveBeenCalled();
			const payload = JSON.parse(result.message);
			expect(payload.mode).toBe("execute");
			expect(payload.executed).toBe(false);
			expect(payload.error.code).toBe("execution_disabled");
		});

		it("keeps canonical policy fields aligned across command adapters", () => {
			vi.mocked(loadContract).mockReturnValue(mockLoadedContract(MOCK_POLICY));

			const payloads = [
				JSON.parse(runUIFast({ mode: "prepare", json: true }).message),
				JSON.parse(runUIVerify({ mode: "prepare", json: true }).message),
				JSON.parse(runUIExplore({ mode: "prepare", json: true }).message),
			];

			for (const payload of payloads) {
				expect(payload.mode).toBe("prepare");
				expect(payload.executed).toBe(false);
				expect(payload.passed).toBe(true);
				expect(payload.exitCode).toBe(EXIT_CODES.SUCCESS);
				expect(payload.head_sha).toEqual(expect.any(String));
				expect(payload.contract_version).toBe("1.1.0");
				expect(payload.artifact_uri).toContain("artifacts/ui-loop");
				expect(payload.artifact_checksum).toHaveLength(64);
			}
		});

		it("passes explore URL/output as literal argv without shell parsing", () => {
			const url = "http://localhost:3000/?q=$(whoami)&n=1";
			const outputDir = "./ui-output;touch_/tmp/not-executed";

			const result = runUIExplore({
				mode: "execute",
				url,
				outputDir,
				interactions: true,
			});

			expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
			expect(spawnSync).toHaveBeenCalledWith(
				"agent-browser",
				["explore", url, "--output", outputDir, "--interactions"],
				expect.objectContaining({ shell: false }),
			);
		});

		it("rejects quoted explore policy commands that require shell parsing", () => {
			vi.mocked(loadContract).mockReturnValue(
				mockLoadedContract({
					...MOCK_POLICY,
					uiLoopPolicy: {
						...MOCK_POLICY.uiLoopPolicy,
						exploreCommand: 'npm run "ui:explore"',
					},
				}),
			);

			const result = runUIExplore({ mode: "prepare" });

			expect(result.exitCode).toBe(EXIT_CODES.VALIDATION_ERROR);
			expect(result.message).toContain("quoted or escaped");
		});

		it("enforces kill-switch mode matrix across adapters", () => {
			process.env.HARNESS_UI_EXECUTION_DISABLED = "true";
			vi.mocked(loadContract).mockReturnValue(mockLoadedContract(MOCK_POLICY));

			const executePayloads = [
				JSON.parse(runUIFast({ mode: "execute", json: true }).message),
				JSON.parse(runUIVerify({ mode: "execute", json: true }).message),
				JSON.parse(runUIExplore({ mode: "execute", json: true }).message),
			];

			for (const payload of executePayloads) {
				expect(payload.mode).toBe("execute");
				expect(payload.executed).toBe(false);
				expect(payload.exitCode).toBe(EXIT_CODES.EXECUTION_DISABLED);
				expect(payload.error.code).toBe("execution_disabled");
				expect(payload.artifact_uri).toContain("artifacts/ui-loop");
				expect(payload.artifact_checksum).toHaveLength(64);
			}

			const preparePayloads = [
				JSON.parse(runUIFast({ mode: "prepare", json: true }).message),
				JSON.parse(runUIVerify({ mode: "prepare", json: true }).message),
				JSON.parse(runUIExplore({ mode: "prepare", json: true }).message),
			];

			for (const payload of preparePayloads) {
				expect(payload.mode).toBe("prepare");
				expect(payload.executed).toBe(false);
				expect(payload.exitCode).toBe(EXIT_CODES.SUCCESS);
				expect(payload.error).toBeUndefined();
				expect(payload.artifact_uri).toContain("artifacts/ui-loop");
				expect(payload.artifact_checksum).toHaveLength(64);
			}
		});
	});
});
