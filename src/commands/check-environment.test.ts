import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CONTRACT } from "../lib/contract/types.js";
import { PREFLIGHT_UV_VERSION_PIN } from "../lib/deps/environment-runtime.js";

vi.mock("node:child_process", () => ({
	spawnSync: vi.fn(),
}));

describe("runCheckEnvironment runtime dependency checks", () => {
	let tempDir: string;
	const contractPath = "harness.contract.json";
	const originalCwd = process.cwd();
	const originalEnv = { ...process.env };

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "check-environment-test-"));
		writeFileSync(
			join(tempDir, contractPath),
			JSON.stringify(DEFAULT_CONTRACT, null, 2),
			"utf-8",
		);
		process.chdir(tempDir);
		process.env = {
			...originalEnv,
			CLAUDE_APPROVAL_POSTURE: "require",
			CLAUDE_SECRET_FILTER: "configured",
		};
		vi.resetModules();
	});

	afterEach(() => {
		process.chdir(originalCwd);
		process.env = { ...originalEnv };
		rmSync(tempDir, { recursive: true, force: true });
		vi.clearAllMocks();
	});

	it("passes when python and uv are present with expected versions", async () => {
		const { spawnSync } = await import("node:child_process");
		const { runCheckEnvironment } = await import("./check-environment.js");
		vi.mocked(spawnSync).mockImplementation((command) => {
			if (command === "python3") {
				return {
					status: 0,
					stdout: "Python 3.12.10\n",
					stderr: "",
				} as never;
			}
			if (command === "uv") {
				return {
					status: 0,
					stdout: `uv ${PREFLIGHT_UV_VERSION_PIN}\n`,
					stderr: "",
				} as never;
			}
			return { status: 127, stdout: "", stderr: "unexpected command" } as never;
		});

		const result = await runCheckEnvironment({ contractPath });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.output.passed).toBe(true);
		expect(result.output.violations).toHaveLength(0);
		expect(result.output.posture.runtime?.pythonVersion).toBe("3.12.10");
		expect(result.output.posture.runtime?.uvVersion).toBe(
			PREFLIGHT_UV_VERSION_PIN,
		);
	});

	it("uses the consumer contract uv pin instead of the harness fallback", async () => {
		const defaultToolingPolicy = DEFAULT_CONTRACT.toolingPolicy;
		expect(defaultToolingPolicy).toBeDefined();
		if (!defaultToolingPolicy) return;
		writeFileSync(
			join(tempDir, contractPath),
			JSON.stringify(
				{
					...DEFAULT_CONTRACT,
					toolingPolicy: {
						...defaultToolingPolicy,
						requiredMiseTools: defaultToolingPolicy.requiredMiseTools.map(
							(tool) =>
								tool.tool === "uv" ? { ...tool, version: "0.10.9" } : tool,
						),
					},
				},
				null,
				2,
			),
			"utf-8",
		);
		const { spawnSync } = await import("node:child_process");
		const { runCheckEnvironment } = await import("./check-environment.js");
		vi.mocked(spawnSync).mockImplementation((command) => {
			if (command === "python3") {
				return {
					status: 0,
					stdout: "Python 3.12.10\n",
					stderr: "",
				} as never;
			}
			if (command === "uv") {
				return { status: 0, stdout: "uv 0.10.9\n", stderr: "" } as never;
			}
			return { status: 127, stdout: "", stderr: "unexpected command" } as never;
		});

		const result = await runCheckEnvironment({ contractPath });

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.output.passed).toBe(true);
		expect(result.output.violations).toHaveLength(0);
		expect(result.output.posture.runtime?.uvVersion).toBe("0.10.9");
	});

	it("reports a mismatch violation using the consumer contract pin, not the harness fallback", async () => {
		const defaultToolingPolicy = DEFAULT_CONTRACT.toolingPolicy;
		expect(defaultToolingPolicy).toBeDefined();
		if (!defaultToolingPolicy) return;
		writeFileSync(
			join(tempDir, contractPath),
			JSON.stringify(
				{
					...DEFAULT_CONTRACT,
					toolingPolicy: {
						...defaultToolingPolicy,
						requiredMiseTools: defaultToolingPolicy.requiredMiseTools.map(
							(tool) =>
								tool.tool === "uv" ? { ...tool, version: "0.10.9" } : tool,
						),
					},
				},
				null,
				2,
			),
			"utf-8",
		);
		const { spawnSync } = await import("node:child_process");
		const { runCheckEnvironment } = await import("./check-environment.js");
		vi.mocked(spawnSync).mockImplementation((command) => {
			if (command === "python3") {
				return { status: 0, stdout: "Python 3.12.10\n", stderr: "" } as never;
			}
			if (command === "uv") {
				return {
					status: 0,
					stdout: `uv ${PREFLIGHT_UV_VERSION_PIN}\n`,
					stderr: "",
				} as never;
			}
			return { status: 127, stdout: "", stderr: "unexpected command" } as never;
		});

		const result = await runCheckEnvironment({ contractPath });

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.output.passed).toBe(false);
		expect(
			result.output.violations.find(
				(v) => v.type === "runtime_dependency_version_mismatch",
			)?.expected,
		).toBe("0.10.9");
	});
	it("fails closed when mise cannot resolve pinned runtime probes", async () => {
		writeFileSync(
			join(tempDir, ".mise.toml"),
			'[tools]\npython = "3.12"\nuv = "0.11.3"\n',
		);
		const { spawnSync } = await import("node:child_process");
		const { runCheckEnvironment } = await import("./check-environment.js");
		vi.mocked(spawnSync).mockImplementation((command) => {
			if (command === "mise") {
				return {
					status: 127,
					stdout: "",
					stderr: "mise: command not found",
					error: new Error("ENOENT"),
				} as never;
			}
			return {
				status: 0,
				stdout: "unexpected system runtime\n",
				stderr: "",
			} as never;
		});

		const result = await runCheckEnvironment({ contractPath });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.output.passed).toBe(false);
		expect(
			result.output.violations.filter(
				(v) => v.type === "runtime_dependency_missing",
			),
		).toHaveLength(2);
		expect(vi.mocked(spawnSync)).not.toHaveBeenCalledWith(
			"python3",
			expect.anything(),
			expect.anything(),
		);
		expect(vi.mocked(spawnSync)).not.toHaveBeenCalledWith(
			"uv",
			expect.anything(),
			expect.anything(),
		);
	});

	it("rejects attestation paths that traverse symlinked segments", async () => {
		const { spawnSync } = await import("node:child_process");
		const { runCheckEnvironment } = await import("./check-environment.js");
		vi.mocked(spawnSync).mockImplementation((command) => {
			if (command === "python3") {
				return { status: 0, stdout: "Python 3.12.10\n", stderr: "" } as never;
			}
			if (command === "uv") {
				return {
					status: 0,
					stdout: `uv ${PREFLIGHT_UV_VERSION_PIN}\n`,
					stderr: "",
				} as never;
			}
			return { status: 127, stdout: "", stderr: "unexpected command" } as never;
		});

		// Create a real directory outside tempDir, then symlink artifacts/ → it
		const outsideDir = mkdtempSync(join(tmpdir(), "check-env-outside-"));
		try {
			symlinkSync(outsideDir, join(tempDir, "artifacts"), "dir");

			const attestationPath = join(
				tempDir,
				"artifacts/policy/environment-attestation.json",
			);

			const result = await runCheckEnvironment({
				contractPath,
				attestationPath,
			});
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.output.passed).toBe(false);
			expect(result.output.attestationPath).toBeUndefined();
			expect(
				result.output.violations.some(
					(v) =>
						v.type === "artifact_path_traversal" &&
						v.value?.includes("environment-attestation.json"),
				),
			).toBe(true);
		} finally {
			rmSync(outsideDir, { recursive: true, force: true });
		}
	});

	it("falls back to default contract when contract file is missing", async () => {
		rmSync(join(tempDir, contractPath), { force: true });
		const { spawnSync } = await import("node:child_process");
		const { runCheckEnvironment } = await import("./check-environment.js");
		vi.mocked(spawnSync).mockImplementation((command) => {
			if (command === "python3") {
				return {
					status: 0,
					stdout: "Python 3.12.10\n",
					stderr: "",
				} as never;
			}
			if (command === "uv") {
				return {
					status: 0,
					stdout: `uv ${PREFLIGHT_UV_VERSION_PIN}\n`,
					stderr: "",
				} as never;
			}
			return { status: 127, stdout: "", stderr: "unexpected command" } as never;
		});

		const result = await runCheckEnvironment({ contractPath });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.output.passed).toBe(true);
	});

	it("fails closed when attestation write errors for non-traversal reasons", async () => {
		const { spawnSync } = await import("node:child_process");
		const { runCheckEnvironment } = await import("./check-environment.js");
		vi.mocked(spawnSync).mockImplementation((command) => {
			if (command === "python3") {
				return { status: 0, stdout: "Python 3.12.10\n", stderr: "" } as never;
			}
			if (command === "uv") {
				return {
					status: 0,
					stdout: `uv ${PREFLIGHT_UV_VERSION_PIN}\n`,
					stderr: "",
				} as never;
			}
			return { status: 127, stdout: "", stderr: "unexpected command" } as never;
		});
		const attestationDir = join(process.cwd(), "attestation-dir");
		mkdirSync(attestationDir, { recursive: true });

		const result = await runCheckEnvironment({
			contractPath,
			// Writing JSON to an existing directory triggers a non-traversal write error (EISDIR).
			attestationPath: attestationDir,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.output.passed).toBe(false);
		expect(result.output.attestationPath).toBeUndefined();
		expect(
			result.output.violations.some(
				(v) =>
					v.type === "artifact_write_failed" &&
					v.message.includes("Failed to write attestation artifact"),
			),
		).toBe(true);
	});

	it("emits checkpoint evidence metadata for preflight attestation artifacts", async () => {
		const { spawnSync } = await import("node:child_process");
		const { runCheckEnvironment } = await import("./check-environment.js");
		vi.mocked(spawnSync).mockImplementation((command) => {
			if (command === "python3") {
				return { status: 0, stdout: "Python 3.12.10\n", stderr: "" } as never;
			}
			if (command === "uv") {
				return {
					status: 0,
					stdout: `uv ${PREFLIGHT_UV_VERSION_PIN}\n`,
					stderr: "",
				} as never;
			}
			if (command === "git") {
				return {
					status: 0,
					stdout: `${"a".repeat(40)}\n`,
					stderr: "",
				} as never;
			}
			return { status: 127, stdout: "", stderr: "unexpected command" } as never;
		});

		const attestationPath = join(
			process.cwd(),
			"artifacts/policy/environment-attestation.json",
		);
		const result = await runCheckEnvironment({
			contractPath,
			attestationPath,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.output.attestationPath).toBe(attestationPath);
		expect(result.output.evidenceReference).toEqual(
			expect.objectContaining({
				command: "check-environment",
				evidencePostureRef: "preflight_only",
				attestationVerificationStatus: "preflight_only",
				artifactPath: attestationPath,
				exitCode: 0,
				headSha: "a".repeat(40),
			}),
		);
		expect(result.output.evidenceReference?.claimId).toHaveLength(64);
		expect(result.output.evidenceReference?.artifactChecksum).toHaveLength(64);
	});
});
