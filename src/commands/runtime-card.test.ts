import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runRuntimeCardCLI } from "./runtime-card.js";
import { HE_PHASE_EXIT_SCHEMA_VERSION } from "../lib/decision/he-phase-exit.js";
import { validateRuntimeEvidenceBundle } from "../lib/runtime/runtime-evidence-bundle.js";

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

function writePassingPhaseExit(repoRoot: string): string {
	const phaseExitPath = ".harness/runtime/phase-exit.json";
	mkdirSync(join(repoRoot, ".harness/runtime"), { recursive: true });
	writeFileSync(
		join(repoRoot, phaseExitPath),
		JSON.stringify(
			{
				schemaVersion: HE_PHASE_EXIT_SCHEMA_VERSION,
				phaseContext: {
					phase: "closeout",
					failingEvidencePresent: false,
					reviewFeedbackPresent: false,
				},
				recommendation: "continue",
				commitAllowed: true,
				exitAllowed: true,
				blockers: [],
				warnings: [],
				gates: [],
			},
			null,
			2,
		),
		"utf8",
	);
	return phaseExitPath;
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

	it("persists normalized runtime evidence when --evidence-out is supplied", async () => {
		const repoRoot = setupRepo();
		const evidenceOutPath = ".harness/runtime/JSC-311-evidence.json";
		const { exitCode, output, error } = await captureRuntimeCardCLI([
			"--json",
			"--repo",
			repoRoot,
			"--issue",
			"JSC-311",
			"--evidence-out",
			evidenceOutPath,
		]);

		expect(exitCode).toBe(0);
		expect(error).toBe("");
		expect(JSON.parse(output).schemaVersion).toBe("runtime-card/v1");
		const persistedPath = join(repoRoot, evidenceOutPath);
		expect(existsSync(persistedPath)).toBe(true);
		const evidence = JSON.parse(readFileSync(persistedPath, "utf8"));
		expect(validateRuntimeEvidenceBundle(evidence)).toEqual({
			valid: true,
			errors: [],
		});
		expect(evidence).toMatchObject({
			schemaVersion: "runtime-evidence-bundle/v1",
			issueKey: "JSC-311",
			provenance: {
				kind: "runtime_card_adapter",
				ref: `artifact:${evidenceOutPath}`,
			},
		});
		expect(evidence.phaseExit).toBeUndefined();
		expect(evidence.phaseExitSourceCompleteness).toBeUndefined();
		expect(
			evidence.sources.map((source: { kind: string }) => source.kind),
		).toEqual(["git", "artifact"]);
	});

	it("marks runtime-card-derived phase-exit evidence as summary-only", async () => {
		const repoRoot = setupRepo();
		const phaseExitPath = writePassingPhaseExit(repoRoot);
		const evidenceOutPath = ".harness/runtime/JSC-311-evidence.json";
		const { exitCode, error } = await captureRuntimeCardCLI([
			"--json",
			"--repo",
			repoRoot,
			"--issue",
			"JSC-311",
			"--phase-exit",
			phaseExitPath,
			"--evidence-out",
			evidenceOutPath,
		]);

		expect(exitCode).toBe(0);
		expect(error).toBe("");
		const evidence = JSON.parse(
			readFileSync(join(repoRoot, evidenceOutPath), "utf8"),
		);
		expect(validateRuntimeEvidenceBundle(evidence)).toEqual({
			valid: true,
			errors: [],
		});
		expect(evidence.phaseExit).toMatchObject({
			schemaVersion: HE_PHASE_EXIT_SCHEMA_VERSION,
			recommendation: "continue",
			commitAllowed: true,
			exitAllowed: true,
			gates: [],
		});
		expect(evidence.phaseExitSourceCompleteness).toBe("summary_only");
	});

	it("can consume runtime evidence produced by --evidence-out", async () => {
		const repoRoot = setupRepo();
		const evidenceOutPath = ".harness/runtime/JSC-311-evidence.json";
		const first = await captureRuntimeCardCLI([
			"--json",
			"--repo",
			repoRoot,
			"--issue",
			"JSC-311",
			"--evidence-out",
			evidenceOutPath,
		]);
		expect(first.exitCode).toBe(0);

		const second = await captureRuntimeCardCLI([
			"--json",
			"--repo",
			repoRoot,
			"--evidence",
			evidenceOutPath,
		]);

		expect(second.exitCode).toBe(0);
		const card = JSON.parse(second.output);
		expect(card.issueKey).toBe("JSC-311");
		expect(card.phaseExit.status).toBe("not_run");
		expect(card.sources).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind: "artifact",
					ref: `artifact:${evidenceOutPath}`,
				}),
			]),
		);
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

	it("blocks missing phase-exit evidence in closeout context", async () => {
		const repoRoot = setupRepo();
		const { exitCode, output, error } = await captureRuntimeCardCLI([
			"--json",
			"--repo",
			repoRoot,
			"--issue",
			"JSC-311",
			"--context",
			"closeout",
		]);

		expect(exitCode).toBe(0);
		expect(error).toBe("");
		const card = JSON.parse(output);
		expect(card.lifecycle).toBe("blocked");
		expect(card.phaseExit.status).toBe("not_run");
		expect(card.blockers).toEqual([
			"Phase-exit artifact is required for this runtime-card context.",
		]);
		expect(card.attemptLedger).toMatchObject({
			schemaVersion: "attempt-ledger/v1",
			command: "runtime-card",
			retryDecision: "stop",
			owner: "codex",
			stopReason:
				"Phase-exit artifact is required for this runtime-card context.",
		});
		expect(card.recoveryEvent).toMatchObject({
			schemaVersion: "recovery-event/v1",
			command: "runtime-card",
			failureClass: "phase_exit_missing",
			retryDecision: "stop",
		});
		expect(card.sources).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind: "phase_exit",
					failureClass: "phase_exit_missing",
				}),
			]),
		);
	});

	it("returns usage errors for invalid runtime-card context", async () => {
		const { exitCode, error } = await captureRuntimeCardCLI([
			"--context",
			"review",
		]);

		expect(exitCode).toBe(2);
		expect(error).toContain("invalid context review");
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

	it("returns usage errors for missing evidence output path", async () => {
		const { exitCode, error } = await captureRuntimeCardCLI(["--evidence-out"]);

		expect(exitCode).toBe(2);
		expect(error).toContain("--evidence-out requires a file path");
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

	it("rejects evidence output paths outside the repository", async () => {
		const repoRoot = setupRepo();
		const { exitCode, output } = await captureRuntimeCardCLI([
			"--json",
			"--repo",
			repoRoot,
			"--evidence-out",
			"../runtime-evidence.json",
		]);

		expect(exitCode).toBe(1);
		expect(JSON.parse(output)).toMatchObject({
			schemaVersion: "runtime-card-error/v1",
			status: "fail",
			error: "Error: --evidence-out must stay within --repo",
		});
	});

	it("rejects colliding runtime-card and evidence output paths", async () => {
		const repoRoot = setupRepo();
		const { exitCode, output } = await captureRuntimeCardCLI([
			"--json",
			"--repo",
			repoRoot,
			"--out",
			".harness/runtime/card.json",
			"--evidence-out",
			".harness/runtime/card.json",
		]);

		expect(exitCode).toBe(1);
		expect(JSON.parse(output)).toMatchObject({
			schemaVersion: "runtime-card-error/v1",
			status: "fail",
			error: "Error: --out and --evidence-out must target different files",
		});
	});

	it("rejects colliding output paths through repo-internal symlink parents", async () => {
		const repoRoot = setupRepo();
		mkdirSync(join(repoRoot, ".harness/runtime/real"), { recursive: true });
		symlinkSync(
			join(repoRoot, ".harness/runtime/real"),
			join(repoRoot, ".harness/runtime/link"),
		);
		const { exitCode, output } = await captureRuntimeCardCLI([
			"--json",
			"--repo",
			repoRoot,
			"--out",
			".harness/runtime/real/card.json",
			"--evidence-out",
			".harness/runtime/link/card.json",
		]);

		expect(exitCode).toBe(1);
		expect(JSON.parse(output)).toMatchObject({
			schemaVersion: "runtime-card-error/v1",
			status: "fail",
			error: "Error: --out and --evidence-out must target different files",
		});
	});

	it("rejects evidence output symlinks that point outside the repository", async () => {
		const repoRoot = setupRepo();
		const outsideRoot = mkdtempSync(join(tmpdir(), "runtime-card-outside-"));
		const evidenceOutPath = ".harness/runtime/session-evidence.json";
		mkdirSync(join(repoRoot, ".harness/runtime"), { recursive: true });
		symlinkSync(
			join(outsideRoot, "session-evidence.json"),
			join(repoRoot, evidenceOutPath),
		);

		const { exitCode, output } = await captureRuntimeCardCLI([
			"--json",
			"--repo",
			repoRoot,
			"--evidence-out",
			evidenceOutPath,
		]);

		expect(exitCode).toBe(1);
		expect(JSON.parse(output)).toMatchObject({
			schemaVersion: "runtime-card-error/v1",
			status: "fail",
			error: "Error: --evidence-out must stay within --repo",
		});
	});

	it("rejects evidence output paths under symlinked parent directories outside the repository", async () => {
		const repoRoot = setupRepo();
		const outsideRoot = mkdtempSync(join(tmpdir(), "runtime-card-outside-"));
		const outsideEvidence = join(outsideRoot, "session-evidence.json");
		symlinkSync(outsideRoot, join(repoRoot, ".harness/runtime"), "dir");

		const { exitCode, output } = await captureRuntimeCardCLI([
			"--json",
			"--repo",
			repoRoot,
			"--evidence-out",
			".harness/runtime/session-evidence.json",
		]);

		expect(exitCode).toBe(1);
		expect(existsSync(outsideEvidence)).toBe(false);
		expect(JSON.parse(output)).toMatchObject({
			schemaVersion: "runtime-card-error/v1",
			status: "fail",
			error: "Error: --evidence-out must stay within --repo",
		});
	});
});
