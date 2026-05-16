import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runRuntimeCardCLI } from "./runtime-card.js";

const CODE = String.fromCharCode(96);

async function captureRuntimeCardCLI(args: string[]): Promise<{
	exitCode: number;
	output: string;
	error: string;
}> {
	const output: string[] = [];
	const error: string[] = [];
	const infoSpy = vi
		.spyOn(console, "info")
		.mockImplementation((message = "") => {
			output.push(String(message));
		});
	const errorSpy = vi
		.spyOn(console, "error")
		.mockImplementation((message = "") => {
			error.push(String(message));
		});
	try {
		return {
			exitCode: await runRuntimeCardCLI(args),
			output: output.join("\n"),
			error: error.join("\n"),
		};
	} finally {
		infoSpy.mockRestore();
		errorSpy.mockRestore();
	}
}

function setupRepo(): string {
	const repoRoot = mkdtempSync(join(tmpdir(), "runtime-card-cli-"));
	execFileSync("git", ["init"], {
		cwd: repoRoot,
		stdio: ["ignore", "ignore", "ignore"],
	});
	const specPath = ".harness/specs/2026-05-13-jsc-311-spec.md";
	const planPath = ".harness/plan/2026-05-13-JSC-311-plan.md";
	mkdirSync(join(repoRoot, ".harness/specs"), { recursive: true });
	mkdirSync(join(repoRoot, ".harness/plan"), { recursive: true });
	writeFileSync(join(repoRoot, specPath), "# Spec\n");
	writeFileSync(join(repoRoot, planPath), "# Plan\n");
	writeFileSync(
		join(repoRoot, ".harness/active-artifacts.md"),
		[
			"| Linear Key | Active Spec | Active Plan |",
			"| --- | --- | --- |",
			`| JSC-311 | ${CODE}${specPath}${CODE} | ${CODE}${planPath}${CODE} |`,
			"",
		].join("\n"),
	);
	return repoRoot;
}

function writeRuntimeEvidenceBundle(repoRoot: string): string {
	const evidencePath = ".harness/runtime/session-evidence.json";
	mkdirSync(join(repoRoot, ".harness/runtime"), { recursive: true });
	writeFileSync(
		join(repoRoot, evidencePath),
		JSON.stringify(
			{
				schemaVersion: "runtime-evidence-bundle/v1",
				generatedAt: "2026-05-15T12:00:00.000Z",
				issueKey: "JSC-311",
				provenance: {
					kind: "session_collector",
					ref: "session-collector:run-123",
					collectedAt: "2026-05-15T12:00:00.000Z",
				},
				pullRequest: {
					number: 255,
					state: "OPEN",
					isDraft: true,
					mergeStateStatus: "BLOCKED",
					url: "https://github.com/jscraik/coding-harness/pull/255",
				},
				sources: [
					{
						kind: "session",
						ref: "session-collector:run-123",
						freshness: "current",
						status: "usable",
						failureClass: null,
					},
				],
				blockers: ["Session evidence says the PR is still draft."],
			},
			null,
			2,
		),
		"utf8",
	);
	return evidencePath;
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe("runRuntimeCardCLI", () => {
	it("emits a valid runtime-card/v1 artifact as JSON", async () => {
		const repoRoot = setupRepo();
		const { exitCode, output, error } = await captureRuntimeCardCLI([
			"--json",
			"--repo",
			repoRoot,
			"--issue",
			"JSC-311",
		]);

		expect(exitCode).toBe(0);
		expect(error).toBe("");
		const card = JSON.parse(output);
		expect(card.schemaVersion).toBe("runtime-card/v1");
		expect(card.issueKey).toBe("JSC-311");
		expect(card.artifacts.status).toBe("current");
	});

	it("persists the generated runtime card when --out is supplied", async () => {
		const repoRoot = setupRepo();
		const outputPath = ".harness/runtime/JSC-311.json";
		const { exitCode } = await captureRuntimeCardCLI([
			"--json",
			"--repo",
			repoRoot,
			"--issue",
			"JSC-311",
			"--out",
			outputPath,
		]);

		expect(exitCode).toBe(0);
		const persistedPath = join(repoRoot, outputPath);
		expect(existsSync(persistedPath)).toBe(true);
		const card = JSON.parse(readFileSync(persistedPath, "utf8"));
		expect(card.schemaVersion).toBe("runtime-card/v1");
	});

	it("adapts normalized evidence bundles through --evidence", async () => {
		const repoRoot = setupRepo();
		const evidencePath = writeRuntimeEvidenceBundle(repoRoot);
		const { exitCode, output } = await captureRuntimeCardCLI([
			"--json",
			"--repo",
			repoRoot,
			"--issue",
			"JSC-311",
			"--evidence",
			evidencePath,
		]);

		expect(exitCode).toBe(0);
		const card = JSON.parse(output);
		expect(card.pullRequest.number).toBe(255);
		expect(card.lifecycle).toBe("blocked");
		expect(card.blockers).toEqual([
			"Session evidence says the PR is still draft.",
		]);
		expect(
			card.sources.map((source: { kind: string }) => source.kind),
		).toContain("session");
		expect(
			card.sources.filter(
				(source: { kind: string; ref: string }) =>
					source.kind === "session" &&
					source.ref === "session-collector:run-123",
			),
		).toHaveLength(1);
	});

	it("returns usage errors for missing flag values", async () => {
		const { exitCode, error } = await captureRuntimeCardCLI(["--repo"]);

		expect(exitCode).toBe(2);
		expect(error).toContain("--repo requires a path");
	});

	it("returns usage errors for missing evidence path", async () => {
		const { exitCode, error } = await captureRuntimeCardCLI(["--evidence"]);

		expect(exitCode).toBe(2);
		expect(error).toContain("--evidence requires an artifact path");
	});

	it("rejects evidence paths outside the repository", async () => {
		const repoRoot = setupRepo();
		const { exitCode, output } = await captureRuntimeCardCLI([
			"--json",
			"--repo",
			repoRoot,
			"--evidence",
			"../session-evidence.json",
		]);

		expect(exitCode).toBe(1);
		expect(JSON.parse(output)).toMatchObject({
			schemaVersion: "runtime-card-error/v1",
			status: "fail",
			error: "Error: --evidence must stay within --repo",
		});
	});
});
