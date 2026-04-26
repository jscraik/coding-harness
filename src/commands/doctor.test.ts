import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
/**
 * Tests for harness doctor command (JSC-65)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	NORTH_STAR_ARTIFACT_SCHEMA_VERSIONS,
	getNorthStarSurfaceClassificationSnapshotPath,
} from "../lib/contract/north-star-artifacts.js";
import { runDoctor, runDoctorCLI } from "./doctor.js";

// Mock spawnSync for tool checks (node, pnpm, git, gh)
vi.mock("node:child_process", async (importOriginal) => {
	const original = await importOriginal<typeof import("node:child_process")>();
	return { ...original, spawnSync: vi.fn(original.spawnSync) };
});

const mockSpawnSync = vi.mocked(spawnSync);

function makeTmpDir(): string {
	const d = join(tmpdir(), `doctor-test-${Date.now()}`);
	mkdirSync(d, { recursive: true });
	return d;
}

function makeSpawnResult(
	status: number,
	stdout = "",
): ReturnType<typeof spawnSync> {
	return {
		status,
		stdout,
		stderr: "",
		pid: 1,
		output: [],
		signal: null,
	} as ReturnType<typeof spawnSync>;
}

function writeRepoPackageVersion(dir: string, version: string): void {
	writeFileSync(
		join(dir, "package.json"),
		JSON.stringify({ name: "@brainwav/coding-harness", version }),
		{ encoding: "utf-8" },
	);
}

function copyRepoFile(dir: string, relativePath: string): void {
	const destinationPath = join(dir, relativePath);
	mkdirSync(dirname(destinationPath), { recursive: true });
	writeFileSync(
		destinationPath,
		readFileSync(join(process.cwd(), relativePath), "utf-8"),
		"utf-8",
	);
}

/** Set up a happy-path spawn mock: node 24, pnpm, git all present; gh auth ok */
function mockAllToolsOk(): void {
	mockSpawnSync.mockImplementation((cmd, args) => {
		const cmdStr = String(cmd);
		const argsArr = Array.isArray(args) ? args.map(String) : [];

		if (cmdStr === "command" || argsArr.includes("-v")) {
			return makeSpawnResult(0, "found");
		}
		if (cmdStr === "node") return makeSpawnResult(0, "v24.0.0");
		if (cmdStr === "pnpm") return makeSpawnResult(0, "10.33.0");
		if (cmdStr === "git") return makeSpawnResult(0, "git version 2.44.0");
		if (cmdStr === "gh") return makeSpawnResult(0, "gh version 2.0.0");
		return makeSpawnResult(0, "");
	});
}

describe("runDoctor — tool checks", () => {
	let dir: string;

	beforeEach(() => {
		dir = makeTmpDir();
		mockSpawnSync.mockClear();
	});

	afterEach(() => {
		if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
		vi.restoreAllMocks();
	});

	it("reports ok for node 24", () => {
		mockAllToolsOk();
		mockSpawnSync.mockImplementation((cmd) => {
			if (String(cmd) === "node") return makeSpawnResult(0, "v24.1.0");
			return makeSpawnResult(0, "found");
		});

		const report = runDoctor({ dir });
		const nodeCheck = report.checks.find((c) => c.id === "tool:node");
		expect(nodeCheck?.status).toBe("ok");
	});

	it("warns for node <24", () => {
		mockAllToolsOk();
		mockSpawnSync.mockImplementation((cmd) => {
			if (String(cmd) === "node") return makeSpawnResult(0, "v20.0.0");
			return makeSpawnResult(0, "found");
		});

		const report = runDoctor({ dir });
		const nodeCheck = report.checks.find((c) => c.id === "tool:node");
		expect(nodeCheck?.status).toBe("warn");
		expect(nodeCheck?.fix).toContain("mise");
	});

	it("fails when node is not found", () => {
		mockSpawnSync.mockReturnValue(makeSpawnResult(1, ""));

		const report = runDoctor({ dir });
		const nodeCheck = report.checks.find((c) => c.id === "tool:node");
		expect(nodeCheck?.status).toBe("fail");
	});

	it("warns when gh is not authenticated", () => {
		mockAllToolsOk();
		// gh --version ok, gh auth status fails
		mockSpawnSync.mockImplementation((cmd, args) => {
			const cmdStr = String(cmd);
			const argsArr = Array.isArray(args) ? args.map(String) : [];
			if (cmdStr === "gh" && argsArr.includes("status")) {
				return makeSpawnResult(1, "");
			}
			return makeSpawnResult(0, "v24.0.0");
		});

		const report = runDoctor({ dir });
		const ghCheck = report.checks.find((c) => c.id === "tool:gh");
		expect(ghCheck?.status).toBe("warn");
		expect(ghCheck?.fix).toBe("gh auth login");
	});

	it("fails when harness version drift is detected", () => {
		mkdirSync(join(dir, "scripts"), { recursive: true });
		writeFileSync(
			join(dir, "scripts/harness-cli.sh"),
			"#!/usr/bin/env bash\necho 'harness v0.12.0'\n",
		);
		writeRepoPackageVersion(dir, "0.12.0");
		mockSpawnSync.mockImplementation((cmd, args) => {
			const cmdStr = String(cmd);
			const argsArr = Array.isArray(args) ? args.map(String) : [];

			if (cmdStr === "node") return makeSpawnResult(0, "v24.0.0");
			if (cmdStr === "pnpm") return makeSpawnResult(0, "10.33.0");
			if (cmdStr === "git") return makeSpawnResult(0, "git version 2.44.0");
			if (cmdStr === "gh" && argsArr.includes("status")) {
				return makeSpawnResult(0, "ok");
			}
			if (cmdStr === "gh") return makeSpawnResult(0, "gh version 2.0.0");
			if (cmdStr === "which" && argsArr[0] === "harness") {
				return makeSpawnResult(0, "/opt/homebrew/bin/harness");
			}
			if (cmdStr === "/opt/homebrew/bin/harness") {
				return makeSpawnResult(0, "harness v0.6.0");
			}
			if (cmdStr === "which") return makeSpawnResult(0, "found");
			return makeSpawnResult(0, "");
		});

		const report = runDoctor({ dir });
		const coherenceCheck = report.checks.find(
			(c) => c.id === "tool:harness-version-coherence",
		);
		expect(coherenceCheck?.status).toBe("fail");
		expect(coherenceCheck?.message).toContain("Version drift detected");
		expect(coherenceCheck?.fix).toContain("scripts/harness-cli.sh");
	});

	it("skips harness version coherence check when no repo-local runner found", () => {
		// No scripts/harness-cli.sh — coherence returns skip
		mockAllToolsOk();

		const report = runDoctor({ dir });
		const coherenceCheck = report.checks.find(
			(c) => c.id === "tool:harness-version-coherence",
		);
		expect(coherenceCheck?.status).toBe("skip");
		expect(coherenceCheck?.message).toContain("no repo-local harness runner");
	});

	it("warns when repo-local version cannot be determined", () => {
		mkdirSync(join(dir, "scripts"), { recursive: true });
		writeFileSync(
			join(dir, "scripts/harness-cli.sh"),
			"#!/usr/bin/env bash\necho 'not-a-version'\n",
		);
		mockSpawnSync.mockImplementation((cmd, args) => {
			const cmdStr = String(cmd);
			const argsArr = Array.isArray(args) ? args.map(String) : [];

			if (cmdStr === "node") return makeSpawnResult(0, "v24.0.0");
			if (cmdStr === "pnpm") return makeSpawnResult(0, "10.33.0");
			if (cmdStr === "git") return makeSpawnResult(0, "git version 2.44.0");
			if (cmdStr === "gh" && argsArr.includes("status")) {
				return makeSpawnResult(0, "ok");
			}
			if (cmdStr === "gh") return makeSpawnResult(0, "gh version 2.0.0");
			if (cmdStr === "which") return makeSpawnResult(0, "found");
			return makeSpawnResult(0, "");
		});

		const report = runDoctor({ dir });
		const coherenceCheck = report.checks.find(
			(c) => c.id === "tool:harness-version-coherence",
		);
		expect(coherenceCheck?.status).toBe("warn");
		expect(coherenceCheck?.message).toContain("Could not determine");
	});

	it("reports ok for harness version coherence when versions match", () => {
		mkdirSync(join(dir, "scripts"), { recursive: true });
		writeFileSync(
			join(dir, "scripts/harness-cli.sh"),
			"#!/usr/bin/env bash\necho 'harness v1.0.0'\n",
		);
		writeRepoPackageVersion(dir, "1.0.0");
		mockSpawnSync.mockImplementation((cmd, args) => {
			const cmdStr = String(cmd);
			const argsArr = Array.isArray(args) ? args.map(String) : [];

			if (cmdStr === "node") return makeSpawnResult(0, "v24.0.0");
			if (cmdStr === "pnpm") return makeSpawnResult(0, "10.33.0");
			if (cmdStr === "git") return makeSpawnResult(0, "git version 2.44.0");
			if (cmdStr === "gh" && argsArr.includes("status")) {
				return makeSpawnResult(0, "ok");
			}
			if (cmdStr === "gh") return makeSpawnResult(0, "gh version 2.0.0");
			if (cmdStr === "which" && argsArr[0] === "harness") {
				return makeSpawnResult(0, "/usr/local/bin/harness");
			}
			if (cmdStr === "/usr/local/bin/harness") {
				return makeSpawnResult(0, "harness v1.0.0");
			}
			if (cmdStr === "which") return makeSpawnResult(0, "found");
			return makeSpawnResult(0, "");
		});

		const report = runDoctor({ dir });
		const coherenceCheck = report.checks.find(
			(c) => c.id === "tool:harness-version-coherence",
		);
		expect(coherenceCheck?.status).toBe("ok");
		expect(coherenceCheck?.fix).toBeUndefined();
	});
});

describe("runDoctor — file checks", () => {
	let dir: string;

	beforeEach(() => {
		dir = makeTmpDir();
		mockSpawnSync.mockClear();
		mockAllToolsOk();
	});

	afterEach(() => {
		if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
		vi.restoreAllMocks();
	});

	it("fails when harness.contract.json is missing", () => {
		mockAllToolsOk();
		const report = runDoctor({ dir });
		const check = report.checks.find(
			(c) => c.id === "file:harness.contract.json",
		);
		expect(check?.status).toBe("fail");
		expect(check?.fix).toContain("harness init");
		expect(report.hasFailures).toBe(true);
	});

	it("fails when harness.contract.json is invalid JSON", () => {
		writeFileSync(join(dir, "harness.contract.json"), "NOT JSON");
		mockAllToolsOk();

		const report = runDoctor({ dir });
		const check = report.checks.find(
			(c) => c.id === "file:harness.contract.json",
		);
		expect(check?.status).toBe("fail");
		expect(check?.message).toContain("not valid JSON");
	});

	it("ok when harness.contract.json is valid", () => {
		writeFileSync(
			join(dir, "harness.contract.json"),
			JSON.stringify({ version: "1.0.0" }),
		);
		mockAllToolsOk();

		const report = runDoctor({ dir });
		const check = report.checks.find(
			(c) => c.id === "file:harness.contract.json",
		);
		expect(check?.status).toBe("ok");
	});

	it("fails when harness.contract.json is schema-invalid", () => {
		writeFileSync(
			join(dir, "harness.contract.json"),
			JSON.stringify({ version: "not-a-contract-version" }),
		);
		mockAllToolsOk();

		const report = runDoctor({ dir });
		const check = report.checks.find(
			(c) => c.id === "file:harness.contract.json",
		);
		expect(check?.status).toBe("fail");
		expect(check?.message).toContain("fails contract validation");
	});

	it("warns when memory.json is missing", () => {
		mockAllToolsOk();
		const report = runDoctor({ dir });
		const check = report.checks.find((c) => c.id === "file:memory.json");
		expect(check?.status).toBe("warn");
		expect(check?.fix).toContain("harness init");
	});

	it("warns when memory.json missing closeout.forjamie_updated", () => {
		writeFileSync(
			join(dir, "memory.json"),
			JSON.stringify({ closeout: { date: "2026-01-01" } }),
		);
		mockAllToolsOk();

		const report = runDoctor({ dir });
		const check = report.checks.find((c) => c.id === "file:memory.json");
		expect(check?.status).toBe("warn");
		expect(check?.message).toContain("forjamie_updated");
	});

	it("ok when memory.json has full closeout structure", () => {
		writeFileSync(
			join(dir, "memory.json"),
			JSON.stringify({
				closeout: { date: "2026-01-01", forjamie_updated: true },
			}),
		);
		mockAllToolsOk();

		const report = runDoctor({ dir });
		const check = report.checks.find((c) => c.id === "file:memory.json");
		expect(check?.status).toBe("ok");
	});

	it("warns when drift-gate baseline is missing", () => {
		mockAllToolsOk();
		const report = runDoctor({ dir });
		const check = report.checks.find(
			(c) => c.id === "file:consistency-baseline",
		);
		expect(check?.status).toBe("warn");
		expect(check?.fix).toContain("--seed-baseline");
	});

	it("ok when drift-gate baseline is present and valid", () => {
		const baselineDir = join(dir, "artifacts/consistency-gate");
		mkdirSync(baselineDir, { recursive: true });
		writeFileSync(
			join(baselineDir, "consistency-baseline-latest.json"),
			JSON.stringify({ findings: [] }),
		);
		mockAllToolsOk();

		const report = runDoctor({ dir });
		const check = report.checks.find(
			(c) => c.id === "file:consistency-baseline",
		);
		expect(check?.status).toBe("ok");
	});

	it("warns when agent-first-status.md is missing", () => {
		mockAllToolsOk();
		const report = runDoctor({ dir });
		const check = report.checks.find((c) => c.id === "file:agent-first-status");
		expect(check?.status).toBe("warn");
		expect(check?.message).toContain("health mode blocks");
	});

	it("ok when agent-first-status.md is present", () => {
		const statusDir = join(dir, "docs/roadmap");
		mkdirSync(statusDir, { recursive: true });
		writeFileSync(
			join(statusDir, "agent-first-status.md"),
			"# Agent First Status\n",
		);
		mockAllToolsOk();

		const report = runDoctor({ dir });
		const check = report.checks.find((c) => c.id === "file:agent-first-status");
		expect(check?.status).toBe("ok");
	});

	it("fails when the canonical north-star doc is missing", () => {
		copyRepoFile(dir, "harness.contract.json");
		mockAllToolsOk();

		const report = runDoctor({ dir });
		const check = report.checks.find((c) => c.id === "file:north-star-doc");
		expect(check?.status).toBe("fail");
		expect(check?.message).toContain("canonical north-star parity");
	});

	it("fails when the contract omits the north-star runtime slice", () => {
		const contract = JSON.parse(
			readFileSync(join(process.cwd(), "harness.contract.json"), "utf-8"),
		) as Record<string, unknown>;
		contract.version = "1.5.0";
		contract.northStar = undefined;
		contract.productSurface = undefined;
		contract.overrideReviewerRegistry = undefined;

		writeFileSync(
			join(dir, "harness.contract.json"),
			`${JSON.stringify(contract, null, 2)}\n`,
			"utf-8",
		);
		copyRepoFile(dir, "docs/roadmap/north-star.md");
		mockAllToolsOk();

		const report = runDoctor({ dir });
		const check = report.checks.find(
			(c) => c.id === "config:north-star-contract",
		);
		expect(check?.status).toBe("fail");
		expect(check?.message).toContain("northStar block missing");
	});

	it("passes when canonical north-star contract surfaces are present", () => {
		copyRepoFile(dir, "harness.contract.json");
		copyRepoFile(dir, "docs/roadmap/north-star.md");
		mockAllToolsOk();

		const report = runDoctor({ dir });
		const check = report.checks.find(
			(c) => c.id === "config:north-star-contract",
		);
		expect(check?.status).toBe("ok");
	});

	it("writes a north-star surface classification snapshot artifact", () => {
		copyRepoFile(dir, "harness.contract.json");
		copyRepoFile(dir, "docs/roadmap/north-star.md");
		mockAllToolsOk();

		const report = runDoctor({ dir });
		const artifactPath = getNorthStarSurfaceClassificationSnapshotPath();
		const resolvedArtifactPath = join(dir, artifactPath);

		expect(report.artifact_refs).toEqual([
			{
				type: "north-star-surface-classification",
				path: artifactPath,
				schemaVersion:
					NORTH_STAR_ARTIFACT_SCHEMA_VERSIONS.surfaceClassificationSnapshot,
			},
		]);

		const artifact = JSON.parse(
			readFileSync(resolvedArtifactPath, "utf-8"),
		) as {
			schemaVersion: string;
			command: string;
			repoRoot: string;
			sourceReport: {
				hasFailures: boolean;
				counts: typeof report.counts;
			};
			summary: {
				checkCount: number;
				northStarSurfaceCount: number;
			};
			surfaces: { id: string }[];
		};

		expect(artifact.schemaVersion).toBe(
			NORTH_STAR_ARTIFACT_SCHEMA_VERSIONS.surfaceClassificationSnapshot,
		);
		expect(artifact.command).toBe("doctor");
		expect(artifact.repoRoot).toBe(dir);
		expect(artifact.sourceReport.hasFailures).toBe(report.hasFailures);
		expect(artifact.sourceReport.counts).toEqual(report.counts);
		expect(artifact.summary.checkCount).toBe(report.checks.length);
		expect(artifact.summary.northStarSurfaceCount).toBeGreaterThanOrEqual(2);
		expect(artifact.surfaces.map((surface) => surface.id)).toContain(
			"config:north-star-contract",
		);
		expect(artifact.surfaces.map((surface) => surface.id)).toContain(
			"file:north-star-doc",
		);
	});
});

describe("runDoctorCLI", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns 0 for --help", () => {
		expect(runDoctorCLI(["--help"], () => "0.0.0-test")).toBe(0);
	});

	it("returns 0 for --checklist", () => {
		expect(runDoctorCLI(["--checklist"], () => "0.0.0-test")).toBe(0);
	});

	it("returns 2 when --dir is missing a value", () => {
		const consoleErrorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		try {
			expect(runDoctorCLI(["--dir", "--json"], () => "0.0.0-test")).toBe(2);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"Error: --dir requires a path",
			);
		} finally {
			consoleErrorSpy.mockRestore();
		}
	});

	it("emits JSON report when --json is provided", () => {
		const dir = makeTmpDir();
		mockAllToolsOk();
		writeFileSync(
			join(dir, "harness.contract.json"),
			JSON.stringify({ version: "1.0.0" }),
		);
		const consoleInfoSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);
		try {
			const exitCode = runDoctorCLI(
				["--json", "--dir", dir],
				() => "0.0.0-test",
			);
			expect(exitCode).toBeTypeOf("number");
			expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
			const payload = JSON.parse(String(consoleInfoSpy.mock.calls[0]?.[0])) as {
				version: string;
				dir: string;
				checks: unknown[];
			};
			expect(payload.version).toBe("0.0.0-test");
			expect(payload.dir).toBe(dir);
			expect(Array.isArray(payload.checks)).toBe(true);
		} finally {
			consoleInfoSpy.mockRestore();
			if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("runDoctorCLI", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns 0 for --help", () => {
		expect(runDoctorCLI(["--help"], () => "0.0.0-test")).toBe(0);
	});

	it("returns 0 for --checklist", () => {
		expect(runDoctorCLI(["--checklist"], () => "0.0.0-test")).toBe(0);
	});

	it("returns 2 when --dir is missing a value", () => {
		const consoleErrorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		try {
			expect(runDoctorCLI(["--dir", "--json"], () => "0.0.0-test")).toBe(2);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"Error: --dir requires a path",
			);
		} finally {
			consoleErrorSpy.mockRestore();
		}
	});

	it("emits JSON report when --json is provided", () => {
		const dir = makeTmpDir();
		mockAllToolsOk();
		writeFileSync(
			join(dir, "harness.contract.json"),
			JSON.stringify({ version: "1.0.0" }),
		);
		const consoleInfoSpy = vi
			.spyOn(console, "info")
			.mockImplementation(() => undefined);
		try {
			const exitCode = runDoctorCLI(
				["--json", "--dir", dir],
				() => "0.0.0-test",
			);
			expect(exitCode).toBeTypeOf("number");
			expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
			const payload = JSON.parse(String(consoleInfoSpy.mock.calls[0]?.[0])) as {
				version: string;
				dir: string;
				checks: unknown[];
			};
			expect(payload.version).toBe("0.0.0-test");
			expect(payload.dir).toBe(dir);
			expect(Array.isArray(payload.checks)).toBe(true);
		} finally {
			consoleInfoSpy.mockRestore();
			if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("runDoctor — config checks", () => {
	let dir: string;

	beforeEach(() => {
		dir = makeTmpDir();
		mockSpawnSync.mockClear();
		mockAllToolsOk();
	});

	afterEach(() => {
		if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
		vi.restoreAllMocks();
	});

	it("skips config checks when contract is missing", () => {
		mockAllToolsOk();
		const report = runDoctor({ dir });
		const ctxCheck = report.checks.find(
			(c) => c.id === "config:contextIntegrityPolicy",
		);
		expect(ctxCheck?.status).toBe("skip");
	});

	it("warns when contextIntegrityPolicy missing from contract", () => {
		writeFileSync(
			join(dir, "harness.contract.json"),
			JSON.stringify({ version: "1.0.0" }),
		);
		mockAllToolsOk();

		const report = runDoctor({ dir });
		const check = report.checks.find(
			(c) => c.id === "config:contextIntegrityPolicy",
		);
		expect(check?.status).toBe("warn");
		expect(check?.fix).toBeTruthy();
	});

	it("warns when contextIntegrityPolicy exists only on Object.prototype", () => {
		const priorDescriptor = Object.getOwnPropertyDescriptor(
			Object.prototype,
			"contextIntegrityPolicy",
		);
		Object.defineProperty(Object.prototype, "contextIntegrityPolicy", {
			value: { minCoverage: 0.9 },
			configurable: true,
			writable: true,
		});
		try {
			writeFileSync(
				join(dir, "harness.contract.json"),
				JSON.stringify({ version: "1.0.0" }),
			);
			mockAllToolsOk();

			const report = runDoctor({ dir });
			const check = report.checks.find(
				(c) => c.id === "config:contextIntegrityPolicy",
			);
			expect(check?.status).toBe("warn");
		} finally {
			if (priorDescriptor) {
				Object.defineProperty(
					Object.prototype,
					"contextIntegrityPolicy",
					priorDescriptor,
				);
			} else {
				Reflect.deleteProperty(Object.prototype, "contextIntegrityPolicy");
			}
		}
	});

	it("ok when contextIntegrityPolicy present in contract", () => {
		writeFileSync(
			join(dir, "harness.contract.json"),
			JSON.stringify({ contextIntegrityPolicy: { minCoverage: 0.9 } }),
		);
		mockAllToolsOk();

		const report = runDoctor({ dir });
		const check = report.checks.find(
			(c) => c.id === "config:contextIntegrityPolicy",
		);
		expect(check?.status).toBe("ok");
	});

	it("warns when contextIntegrityPolicy exists only on parsed object prototype", () => {
		writeFileSync(join(dir, "harness.contract.json"), JSON.stringify({}));
		mockAllToolsOk();
		vi.spyOn(JSON, "parse").mockImplementation(() =>
			Object.create({ contextIntegrityPolicy: { minCoverage: 0.9 } }),
		);

		const report = runDoctor({ dir });
		const check = report.checks.find(
			(c) => c.id === "config:contextIntegrityPolicy",
		);
		expect(check?.status).toBe("warn");
	});

	it("warns when ciProviderPolicy exists only on prototype", () => {
		writeFileSync(join(dir, "harness.contract.json"), JSON.stringify({}));
		mockAllToolsOk();
		vi.spyOn(JSON, "parse").mockImplementation(() =>
			Object.create({ ciProviderPolicy: { mode: "required" } }),
		);

		const report = runDoctor({ dir });
		const check = report.checks.find((c) => c.id === "config:ciProviderPolicy");
		expect(check?.status).toBe("warn");
	});

	it("does not treat prototype-inherited keys as own keys (Object.hasOwn guard)", () => {
		writeFileSync(join(dir, "harness.contract.json"), JSON.stringify({}));
		mockAllToolsOk();
		// Inject an object where both keys live only on the prototype
		vi.spyOn(JSON, "parse").mockImplementation(() =>
			Object.create({
				contextIntegrityPolicy: { minCoverage: 0.8 },
				ciProviderPolicy: { mode: "optional" },
			}),
		);

		const report = runDoctor({ dir });

		const ctxCheck = report.checks.find(
			(c) => c.id === "config:contextIntegrityPolicy",
		);
		const ciCheck = report.checks.find(
			(c) => c.id === "config:ciProviderPolicy",
		);

		// Both should warn because Object.hasOwn returns false for prototype keys
		expect(ctxCheck?.status).toBe("warn");
		expect(ciCheck?.status).toBe("warn");
	});
});

describe("runDoctor — report structure", () => {
	let dir: string;

	beforeEach(() => {
		dir = makeTmpDir();
		mockSpawnSync.mockClear();
	});

	afterEach(() => {
		if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
		vi.restoreAllMocks();
	});

	it("report has required fields", () => {
		mockAllToolsOk();
		const report = runDoctor({ dir });

		expect(report).toHaveProperty("version");
		expect(report).toHaveProperty("dir");
		expect(report).toHaveProperty("timestamp");
		expect(report).toHaveProperty("checks");
		expect(report).toHaveProperty("counts");
		expect(report).toHaveProperty("hasFailures");
		expect(report).toHaveProperty("postInitChecklist");
		expect(Array.isArray(report.postInitChecklist)).toBe(true);
		expect(report.postInitChecklist?.length ?? 0).toBeGreaterThan(0);
	});

	it("every failing check has a fix command", () => {
		mockSpawnSync.mockReturnValue(makeSpawnResult(1, ""));
		// No contract, no memory.json, no baseline, etc.
		const report = runDoctor({ dir });

		for (const check of report.checks) {
			if (check.status === "fail") {
				expect(check.fix, `check ${check.id} has no fix`).toBeTruthy();
			}
		}
	});

	it("hasFailures is false when only warnings are present", () => {
		mockAllToolsOk();
		copyRepoFile(dir, "harness.contract.json");
		copyRepoFile(dir, "docs/roadmap/north-star.md");

		const report = runDoctor({ dir });
		// With the canonical north-star surfaces present and tools ok, the
		// remaining gaps in this fixture should be advisory only.
		expect(report.hasFailures).toBe(false);
		expect(report.counts.warn).toBeGreaterThan(0);
	});
});

describe("runDoctor — ci:check-alignment check", () => {
	let dir: string;

	beforeEach(() => {
		dir = makeTmpDir();
		mockAllToolsOk();
	});

	afterEach(() => {
		if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
		vi.restoreAllMocks();
	});

	it("skips when .harness/ci-required-checks.json is missing", () => {
		const report = runDoctor({ dir });
		const check = report.checks.find((c) => c.id === "ci:check-alignment");
		expect(check?.status).toBe("skip");
	});

	it("warns when githubCheckName fields are absent", () => {
		mkdirSync(`${dir}/.harness`, { recursive: true });
		writeFileSync(
			`${dir}/.harness/ci-required-checks.json`,
			JSON.stringify({
				version: 1,
				activeProvider: "circleci",
				requiredChecks: [
					{
						policyId: "c1",
						gateId: "lint",
						displayName: "lint",
						sourceAppSlug: "circleci",
						sourceAppId: "circleci",
						externalIdPattern: "^lint$",
						class: "required",
					},
				],
			}),
		);
		const report = runDoctor({ dir });
		const check = report.checks.find((c) => c.id === "ci:check-alignment");
		expect(check?.status).toBe("warn");
		expect(check?.message).toContain("no githubCheckName");
		expect(check?.message).toContain("ci-check-alignment");
		expect(check?.message).toContain("pr-pipeline");
		expect(check?.fix).toContain("docs/agents/17-ci-required-checks.md");
	});

	it("warns when a CircleCI entry uses a job name as githubCheckName", () => {
		mkdirSync(`${dir}/.harness`, { recursive: true });
		writeFileSync(
			`${dir}/.harness/ci-required-checks.json`,
			JSON.stringify({
				version: 1,
				activeProvider: "circleci",
				requiredChecks: [
					{
						policyId: "c1",
						gateId: "lint",
						displayName: "lint",
						sourceAppSlug: "circleci",
						sourceAppId: "circleci",
						externalIdPattern: "^lint$",
						githubCheckName: "lint",
						class: "required",
					},
				],
			}),
		);
		const report = runDoctor({ dir });
		const check = report.checks.find((c) => c.id === "ci:check-alignment");
		expect(check?.status).toBe("warn");
		expect(check?.message).toContain("ci-check-alignment");
		expect(check?.message).toContain("lint");
		expect(check?.message).toContain("pr-pipeline");
		expect(check?.fix).toContain("docs/agents/17-ci-required-checks.md");
	});

	it("reports ok when CircleCI entries use workflow name as githubCheckName", () => {
		mkdirSync(`${dir}/.harness`, { recursive: true });
		writeFileSync(
			`${dir}/.harness/ci-required-checks.json`,
			JSON.stringify({
				version: 1,
				activeProvider: "circleci",
				requiredChecks: [
					{
						policyId: "c1",
						gateId: "lint",
						displayName: "lint",
						sourceAppSlug: "circleci",
						sourceAppId: "circleci",
						externalIdPattern: "^lint$",
						githubCheckName: "pr-pipeline",
						class: "required",
					},
					{
						policyId: "c2",
						gateId: "docs-gate",
						displayName: "docs-gate",
						sourceAppSlug: "circleci",
						sourceAppId: "circleci",
						externalIdPattern: "^docs-gate$",
						githubCheckName: "harness-gates",
						class: "required",
					},
				],
			}),
		);
		const report = runDoctor({ dir });
		const check = report.checks.find((c) => c.id === "ci:check-alignment");
		expect(check?.status).toBe("ok");
		expect(check?.message).toContain("circleci");
	});

	it("ignores non-CircleCI entries when checking CircleCI job-name bindings", () => {
		mkdirSync(`${dir}/.harness`, { recursive: true });
		writeFileSync(
			`${dir}/.harness/ci-required-checks.json`,
			JSON.stringify({
				version: 1,
				activeProvider: "circleci",
				requiredChecks: [
					{
						policyId: "c1",
						gateId: "lint",
						displayName: "lint",
						sourceAppSlug: "circleci",
						sourceAppId: "circleci",
						externalIdPattern: "^lint$",
						githubCheckName: "pr-pipeline",
						class: "required",
					},
					{
						policyId: "c2",
						gateId: "security-scan",
						displayName: "security-scan",
						sourceAppSlug: "github-actions",
						sourceAppId: "github-actions",
						externalIdPattern: "^security-scan$",
						githubCheckName: "security-scan",
						class: "required",
					},
				],
			}),
		);

		const report = runDoctor({ dir });
		const check = report.checks.find((c) => c.id === "ci:check-alignment");
		expect(check?.status).toBe("ok");
	});

	it("uses only active-provider entries when evaluating githubCheckName presence", () => {
		mkdirSync(`${dir}/.harness`, { recursive: true });
		writeFileSync(
			`${dir}/.harness/ci-required-checks.json`,
			JSON.stringify({
				version: 1,
				activeProvider: "github-actions",
				requiredChecks: [
					{
						policyId: "gha-1",
						gateId: "security-scan",
						displayName: "security-scan",
						sourceAppSlug: "github-actions",
						sourceAppId: "github-actions",
						externalIdPattern: "^security-scan$",
						githubCheckName: "security-scan",
						class: "required",
					},
					{
						policyId: "c1",
						gateId: "lint",
						displayName: "lint",
						sourceAppSlug: "circleci",
						sourceAppId: "circleci",
						externalIdPattern: "^lint$",
						githubCheckName: "lint",
						class: "required",
					},
				],
			}),
		);

		const report = runDoctor({ dir });
		const check = report.checks.find((c) => c.id === "ci:check-alignment");
		expect(check?.status).toBe("ok");
		expect(check?.message).toContain("github-actions");
	});
});
