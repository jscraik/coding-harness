import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runRuntimeCardCLI } from "./runtime-card.js";
import { HE_PHASE_EXIT_SCHEMA_VERSION } from "../lib/decision/he-phase-exit.js";
import { loadRunRecordBundle } from "../lib/contract/run-records.js";
import { validateRuntimeCardHandoff } from "../lib/runtime/runtime-card-handoff.js";
import { validateRuntimeEvidenceBundle } from "../lib/runtime/runtime-evidence-bundle.js";
import { expectBehavior } from "../lib/testing/expect-behavior.js";

const CODE = String.fromCharCode(96);
const GIT_ENV_KEYS = [
	"GIT_COMMON_DIR",
	"GIT_DIR",
	"GIT_INDEX_FILE",
	"GIT_WORK_TREE",
] as const;

function gitFixtureEnvironment(): NodeJS.ProcessEnv {
	const env = { ...process.env };
	for (const key of GIT_ENV_KEYS) {
		delete env[key];
	}
	expectBehavior({
		given: "a git fixture environment for runtime-card subprocesses",
		should: "remove caller-scoped git worktree state",
		actual: GIT_ENV_KEYS.every((key) => env[key] === undefined),
		expected: true,
	});
	return env;
}

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
		env: gitFixtureEnvironment(),
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

function rewriteActiveArtifactsIssueRow(
	repoRoot: string,
	issueKey: string,
): void {
	const specPath = ".harness/specs/2026-05-13-jsc-311-spec.md";
	const planPath = ".harness/plan/2026-05-13-JSC-311-plan.md";
	writeFileSync(
		join(repoRoot, ".harness/active-artifacts.md"),
		[
			"| Linear Key | Active Spec | Active Plan |",
			"| --- | --- | --- |",
			`| ${issueKey} | ${CODE}${specPath}${CODE} | ${CODE}${planPath}${CODE} |`,
			"",
		].join("\n"),
	);
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

function writeCodexRuntimeEvidencePacket(
	repoRoot: string,
	overrides: Record<string, unknown> = {},
): string {
	const evidencePath = ".harness/runtime/codex-runtime-evidence.json";
	const permissionRef = "artifact:.harness/runtime/permissions.json";
	const sandboxPolicyRef = "artifact:.harness/runtime/sandbox-policy.json";
	const validationRef = "artifact:.harness/runtime/validation.json";
	const externalRef = "artifact:.harness/runtime/external-state.json";
	const reviewRef = "artifact:.harness/runtime/review-state.json";
	mkdirSync(join(repoRoot, ".harness/runtime"), { recursive: true });
	const packet = {
		schemaVersion: "codex-runtime-evidence/v1",
		generatedAt: "2026-05-15T12:00:00.000Z",
		sourceProvenance: {
			sourceKind: "sdk_typescript",
			codexRepoPath: "sdk/typescript/src/events.ts",
			commitSha: "a".repeat(40),
			dirtyState: "clean",
			sourceFileChecksums: {
				"sdk/typescript/src/events.ts": `sha256:${"b".repeat(64)}`,
			},
			capturedAt: "2026-05-15T12:00:00.000Z",
		},
		codex: {
			threadId: "thread-123",
			turnId: "turn-123",
			clientUserMessageId: "client-user-message-123",
			traceId: "trace-123",
			traceFailureClass: null,
			goalState: "active",
			model: "gpt-5.5",
		},
		permissions: {
			profile: "workspace_write",
			writableRoots: [repoRoot],
			network: "enabled",
			evidenceRef: permissionRef,
			failureClass: null,
		},
		environment: {
			environmentId: "codex-desktop:thread-123",
			cwd: repoRoot,
			expectedCwd: repoRoot,
			executorKind: "codex_desktop",
			approvalScope: "auto_review",
			expectedApprovalScope: "auto_review",
			sandboxPolicyRef,
			state: "current",
			failureClass: null,
		},
		mcp: {
			servers: [
				{
					name: "github",
					status: "available",
					failureClass: null,
				},
			],
		},
		receipts: [
			{
				schemaVersion: "evidence-receipt/v1",
				kind: "artifact",
				ref: permissionRef,
				producer: "codex-runtime",
				status: "pass",
				freshness: "current",
				evidenceUse: "claim_support",
				blockerClass: null,
				verifiedAt: "2026-05-15T12:01:00.000Z",
				headSha: "a".repeat(40),
			},
			{
				schemaVersion: "evidence-receipt/v1",
				kind: "artifact",
				ref: sandboxPolicyRef,
				producer: "codex-runtime",
				status: "pass",
				freshness: "current",
				evidenceUse: "claim_support",
				blockerClass: null,
				verifiedAt: "2026-05-15T12:01:00.000Z",
				headSha: "a".repeat(40),
			},
			{
				schemaVersion: "evidence-receipt/v1",
				kind: "validation",
				ref: validationRef,
				producer: "codex-runtime",
				status: "pass",
				freshness: "current",
				evidenceUse: "claim_support",
				blockerClass: null,
				verifiedAt: "2026-05-15T12:01:00.000Z",
				headSha: "a".repeat(40),
			},
			{
				schemaVersion: "evidence-receipt/v1",
				kind: "external_state",
				ref: externalRef,
				producer: "codex-runtime",
				status: "pass",
				freshness: "current",
				evidenceUse: "claim_support",
				blockerClass: null,
				verifiedAt: "2026-05-15T12:01:00.000Z",
				headSha: "a".repeat(40),
			},
			{
				schemaVersion: "evidence-receipt/v1",
				kind: "review_artifact",
				ref: reviewRef,
				producer: "codex-runtime",
				status: "pass",
				freshness: "current",
				evidenceUse: "claim_support",
				blockerClass: null,
				verifiedAt: "2026-05-15T12:01:00.000Z",
				headSha: "a".repeat(40),
			},
		],
		validationResults: [
			{
				name: "pnpm test",
				status: "pass",
				evidenceRef: validationRef,
				verifiedAt: "2026-05-15T12:01:00.000Z",
			},
		],
		externalState: {
			status: "provided",
			evidenceRef: externalRef,
			failureClass: null,
		},
		reviewState: {
			status: "provided",
			evidenceRef: reviewRef,
			failureClass: null,
		},
		staleState: [
			{
				subject: "external_state",
				classification: "current",
				reason: null,
				evidenceRef: externalRef,
			},
		],
		...overrides,
	};
	writeFileSync(join(repoRoot, evidencePath), JSON.stringify(packet, null, 2));
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

		expect(error).toBe("");
		expect(exitCode).toBe(0);
		const card = JSON.parse(output);
		expectBehavior({
			given: "a repo with active artifacts for JSC-311",
			should: "emit a current runtime-card/v1 packet",
			actual: {
				artifactsStatus: card.artifacts.status,
				issueKey: card.issueKey,
				schemaVersion: card.schemaVersion,
			},
			expected: {
				artifactsStatus: "current",
				issueKey: "JSC-311",
				schemaVersion: "runtime-card/v1",
			},
		});
	});

	it("matches mixed-case issue flags against active artifact rows", async () => {
		const repoRoot = setupRepo();
		rewriteActiveArtifactsIssueRow(repoRoot, "jsc-311");
		const { exitCode, output, error } = await captureRuntimeCardCLI([
			"--json",
			"--repo",
			repoRoot,
			"--issue",
			"jSc-311",
		]);

		expect(error).toBe("");
		expect(exitCode).toBe(0);
		const card = JSON.parse(output);
		expect(card.issueKey).toBe("jSc-311");
		expect(card.artifacts.status).toBe("current");
		expect(card.artifacts.activeSpec).toContain("jsc-311");
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

	it("persists a paired runtime-card handoff when --handoff-out is supplied", async () => {
		const repoRoot = setupRepo();
		const outputPath = ".harness/runtime/JSC-311-card.json";
		const evidenceOutPath = ".harness/runtime/JSC-311-evidence.json";
		const handoffOutPath = ".harness/runtime/JSC-311-handoff.json";
		const { exitCode, output, error } = await captureRuntimeCardCLI([
			"--json",
			"--repo",
			repoRoot,
			"--issue",
			"JSC-311",
			"--out",
			outputPath,
			"--evidence-out",
			evidenceOutPath,
			"--handoff-out",
			handoffOutPath,
		]);

		expect(exitCode).toBe(0);
		expect(error).toBe("");
		expect(JSON.parse(output).schemaVersion).toBe("runtime-card/v1");
		const handoff = JSON.parse(
			readFileSync(join(repoRoot, handoffOutPath), "utf8"),
		);
		expect(validateRuntimeCardHandoff(handoff)).toEqual({
			valid: true,
			errors: [],
		});
		expect(handoff).toMatchObject({
			schemaVersion: "runtime-card-handoff/v1",
			evidenceUse: "orientation",
			issueKey: "JSC-311",
			runtimeCard: {
				path: outputPath,
				schemaVersion: "runtime-card/v1",
			},
			evidenceBundle: {
				path: evidenceOutPath,
				schemaVersion: "runtime-evidence-bundle/v1",
			},
			runtimeIdentity: {
				provenanceRef: `artifact:${evidenceOutPath}`,
			},
		});
		expect(handoff.runtimeCard.sha256).toMatch(/^sha256:[a-f0-9]{64}$/u);
		expect(handoff.evidenceBundle.sha256).toMatch(/^sha256:[a-f0-9]{64}$/u);
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
		const contaminatingRepoRoot = mkdtempSync(
			join(tmpdir(), "runtime-card-env-"),
		);
		execFileSync("git", ["init"], {
			cwd: contaminatingRepoRoot,
			env: gitFixtureEnvironment(),
			stdio: ["ignore", "ignore", "ignore"],
		});
		execFileSync("git", ["checkout", "-b", "JSC-999-contaminant"], {
			cwd: contaminatingRepoRoot,
			env: gitFixtureEnvironment(),
			stdio: ["ignore", "ignore", "ignore"],
		});
		const previousGitDir = process.env.GIT_DIR;
		const previousGitWorkTree = process.env.GIT_WORK_TREE;
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

		try {
			process.env.GIT_DIR = join(contaminatingRepoRoot, ".git");
			process.env.GIT_WORK_TREE = contaminatingRepoRoot;
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
		} finally {
			if (previousGitDir === undefined) {
				delete process.env.GIT_DIR;
			} else {
				process.env.GIT_DIR = previousGitDir;
			}
			if (previousGitWorkTree === undefined) {
				delete process.env.GIT_WORK_TREE;
			} else {
				process.env.GIT_WORK_TREE = previousGitWorkTree;
			}
		}
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

	it("adapts codex-runtime-evidence/v1 packets through --evidence", async () => {
		const repoRoot = setupRepo();
		const evidencePath = writeCodexRuntimeEvidencePacket(repoRoot);
		const { exitCode, output, error } = await captureRuntimeCardCLI([
			"--json",
			"--repo",
			repoRoot,
			"--issue",
			"JSC-311",
			"--evidence",
			evidencePath,
		]);

		expect(error).toBe("");
		expect(exitCode).toBe(0);
		const card = JSON.parse(output);
		expect(card.schemaVersion).toBe("runtime-card/v1");
		expect(card.codexRuntime).toMatchObject({
			provenanceRef: `artifact:${evidencePath}`,
			blockerCount: 0,
		});
		expect(card.codexRuntime.receiptRefs).toEqual(
			expect.arrayContaining([
				"codex-source://sdk_typescript/sdk/typescript/src/events.ts@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
				"artifact:.harness/runtime/validation.json",
				"codex-mcp://github",
			]),
		);
		expect(card.codexRuntime.validationRefs).toContain(
			"artifact:.harness/runtime/validation.json",
		);
		expect(card.codexRuntime.reviewRefs).toContain(
			"artifact:.harness/runtime/review-state.json",
		);
		expect(card.codexRuntime.sessionRefs).toContain(
			"artifact:.harness/runtime/permissions.json",
		);
		expect(card.codexRuntime.environmentRefs).toContain(
			"artifact:.harness/runtime/sandbox-policy.json",
		);
	});

	it("includes environment-scoped sandbox policy evidence in environmentRefs", async () => {
		const repoRoot = setupRepo();
		const evidencePath = writeCodexRuntimeEvidencePacket(repoRoot);
		const { exitCode, output, error } = await captureRuntimeCardCLI([
			"--json",
			"--repo",
			repoRoot,
			"--issue",
			"JSC-311",
			"--evidence",
			evidencePath,
		]);

		expect(error).toBe("");
		expect(exitCode).toBe(0);
		const card = JSON.parse(output);
		expect(card.codexRuntime.environmentRefs).toBeDefined();
		expect(card.codexRuntime.environmentRefs).toEqual(
			expect.arrayContaining(["artifact:.harness/runtime/sandbox-policy.json"]),
		);
		const sandboxPolicyReceipt = card.codexRuntime.receiptRefs.find(
			(ref: string) => ref.includes("sandbox-policy"),
		);
		expect(sandboxPolicyReceipt).toBe(
			"artifact:.harness/runtime/sandbox-policy.json",
		);
	});

	it("omits environmentRefs when environment.sandboxPolicyRef is missing", async () => {
		const repoRoot = setupRepo();
		const evidencePath = writeCodexRuntimeEvidencePacket(repoRoot, {
			permissions: {
				profile: "unknown",
				writableRoots: [],
				network: "unknown",
				evidenceRef: null,
				failureClass: "source_does_not_expose_permission_profile",
			},
			environment: {
				environmentId: "codex-desktop:thread-123",
				cwd: repoRoot,
				expectedCwd: repoRoot,
				executorKind: "codex_desktop",
				approvalScope: "auto_review",
				expectedApprovalScope: "auto_review",
				sandboxPolicyRef: null,
				state: "current",
				failureClass: null,
			},
			receipts: [],
			validationResults: [],
			externalState: {
				status: "unknown",
				evidenceRef: null,
				failureClass: "source_does_not_expose_external_state",
			},
			reviewState: {
				status: "unknown",
				evidenceRef: null,
				failureClass: "source_does_not_expose_review_state",
			},
			staleState: [],
		});
		const { exitCode, output, error } = await captureRuntimeCardCLI([
			"--json",
			"--repo",
			repoRoot,
			"--issue",
			"JSC-311",
			"--evidence",
			evidencePath,
		]);

		expect(exitCode).toBe(0);
		expect(error).toBe("");
		const card = JSON.parse(output);
		expect(card.codexRuntime.environmentRefs).toBeDefined();
		expect(card.codexRuntime.environmentRefs).not.toContain(
			"artifact:.harness/runtime/sandbox-policy.json",
		);
		const sandboxPolicyReceipt = card.codexRuntime.receiptRefs.find(
			(ref: string) => ref.includes("sandbox-policy"),
		);
		expect(sandboxPolicyReceipt).toBeUndefined();
	});

	it("rejects malformed codex-runtime-evidence/v1 packets through --evidence", async () => {
		const repoRoot = setupRepo();
		const evidencePath = writeCodexRuntimeEvidencePacket(repoRoot);
		const persistedPath = join(repoRoot, evidencePath);
		const packet = JSON.parse(readFileSync(persistedPath, "utf8"));
		packet.codex.turnId = "";
		writeFileSync(persistedPath, JSON.stringify(packet, null, 2));
		const { exitCode, output } = await captureRuntimeCardCLI([
			"--json",
			"--repo",
			repoRoot,
			"--issue",
			"JSC-311",
			"--evidence",
			evidencePath,
		]);
		const error = JSON.parse(output);
		expect(exitCode).toBe(1);
		expect(error.error).toContain("codex runtime evidence failed validation");
	});

	it("blocks runtime cards when codex-runtime-evidence/v1 carries stale state", async () => {
		const repoRoot = setupRepo();
		const evidencePath = writeCodexRuntimeEvidencePacket(repoRoot, {
			staleState: [
				{
					subject: "external_state",
					classification: "stale",
					reason: "snapshot_ttl_expired",
					evidenceRef: "artifact:.harness/runtime/external-state.json",
				},
			],
		});
		const { exitCode, output, error } = await captureRuntimeCardCLI([
			"--json",
			"--repo",
			repoRoot,
			"--issue",
			"JSC-311",
			"--evidence",
			evidencePath,
		]);
		expect(exitCode).toBe(0);
		expect(error).toBe("");
		const card = JSON.parse(output);
		expect(card.lifecycle).toBe("blocked");
		expect(card.codexRuntime).toMatchObject({
			blockerCount: 1,
			blockedSourceCount: 1,
		});
		expect(card.blockers).toContain(
			"external_state is stale: snapshot_ttl_expired.",
		);
		expect(card.codexRuntime.staleStateRefs).toContain(
			"artifact:.harness/runtime/external-state.json",
		);
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

	it("writes a canonical runtime-card trace run record", async () => {
		const repoRoot = realpathSync(setupRepo());
		const { exitCode, output, error } = await captureRuntimeCardCLI([
			"--json",
			"--repo",
			repoRoot,
			"--context",
			"local",
			"--trace-out",
			"artifacts/agent-runs/runtime-card-trace-test/events.jsonl",
		]);

		expect(exitCode).toBe(0);
		expect(error).toBe("");
		expect(JSON.parse(output).schemaVersion).toBe("runtime-card/v1");

		const bundle = loadRunRecordBundle({
			cwd: repoRoot,
			runId: "runtime-card-trace-test",
		});
		expect(bundle.manifest).toMatchObject({
			schemaVersion: "agent-run-manifest/v1",
			runId: "runtime-card-trace-test",
			command: "runtime-card",
			outcome: "success",
			exit: {
				code: 0,
				classification: "ok",
			},
			policyContext: {
				mode: "advisory",
				safetyPosture: "strict",
				effectivePolicySource: "runtime-card --trace-out",
			},
		});
		expect(bundle.events.map((event) => event.eventType)).toEqual([
			"phase",
			"precondition",
			"degraded_mode",
			"phase",
		]);
		expect(bundle.events.at(-1)).toMatchObject({
			eventType: "phase",
			status: "completed",
			severity: "info",
		});
		expect(bundle.events[1]?.prevEventHash).toBe(bundle.events[0]?.eventHash);
	});

	it("writes a failure trace when runtime-card fails after argument parsing", async () => {
		const repoRoot = realpathSync(setupRepo());
		const { exitCode, output } = await captureRuntimeCardCLI([
			"--json",
			"--repo",
			repoRoot,
			"--evidence",
			".harness/runtime/missing-evidence.json",
			"--trace-out",
			"artifacts/agent-runs/runtime-card-failure-trace/events.jsonl",
		]);

		expect(exitCode).toBe(1);
		expect(JSON.parse(output)).toMatchObject({
			schemaVersion: "runtime-card-error/v1",
			status: "fail",
		});

		const bundle = loadRunRecordBundle({
			cwd: repoRoot,
			runId: "runtime-card-failure-trace",
		});
		expect(bundle.manifest).toMatchObject({
			outcome: "failed",
			exit: {
				code: 1,
				classification: "runtime_failed",
			},
			policyContext: {
				mode: "advisory",
				safetyPosture: "strict",
				effectivePolicySource: "runtime-card --trace-out",
			},
		});
		expect(
			bundle.events.map((event) => [event.eventType, event.status]),
		).toEqual([
			["phase", "started"],
			["precondition", "passed"],
			["degraded_mode", "passed"],
			["error", "failed"],
			["phase", "failed"],
		]);
		expect(bundle.events.at(-1)?.prevEventHash).toBe(
			bundle.events.at(-2)?.eventHash,
		);
	});

	it("rejects existing trace run ids before appending new events", async () => {
		const repoRoot = realpathSync(setupRepo());
		const traceOut =
			"artifacts/agent-runs/runtime-card-reused-trace/events.jsonl";
		const first = await captureRuntimeCardCLI([
			"--json",
			"--repo",
			repoRoot,
			"--context",
			"local",
			"--trace-out",
			traceOut,
		]);
		expect(first.exitCode).toBe(0);

		const second = await captureRuntimeCardCLI([
			"--json",
			"--repo",
			repoRoot,
			"--context",
			"local",
			"--trace-out",
			traceOut,
		]);
		expect(second.exitCode).toBe(1);
		expect(JSON.parse(second.output)).toMatchObject({
			schemaVersion: "runtime-card-error/v1",
			status: "fail",
			error:
				"Error: --trace-out runId already exists; choose a fresh artifacts/agent-runs/<runId>/events.jsonl path",
		});

		const bundle = loadRunRecordBundle({
			cwd: repoRoot,
			runId: "runtime-card-reused-trace",
		});
		expect(bundle.events.map((event) => event.eventType)).toEqual([
			"phase",
			"precondition",
			"degraded_mode",
			"phase",
		]);
	});

	it("rejects pre-claimed trace run ids before the first event append", async () => {
		const repoRoot = realpathSync(setupRepo());
		mkdirSync(
			join(repoRoot, "artifacts/agent-runs/runtime-card-claimed-trace"),
			{
				recursive: true,
			},
		);
		const { exitCode, output } = await captureRuntimeCardCLI([
			"--json",
			"--repo",
			repoRoot,
			"--context",
			"local",
			"--trace-out",
			"artifacts/agent-runs/runtime-card-claimed-trace/events.jsonl",
		]);
		expect(exitCode).toBe(1);
		expect(JSON.parse(output)).toMatchObject({
			schemaVersion: "runtime-card-error/v1",
			status: "fail",
			error:
				"Error: --trace-out runId already exists; choose a fresh artifacts/agent-runs/<runId>/events.jsonl path",
		});
		expect(
			existsSync(
				join(
					repoRoot,
					"artifacts/agent-runs/runtime-card-claimed-trace/events.jsonl",
				),
			),
		).toBe(false);
	});

	it("rejects invalid trace-out paths as usage errors without emitting traces", async () => {
		const repoRoot = realpathSync(setupRepo());
		const cases = [
			{
				name: "non-canonical directory",
				value: "artifacts/runtime-card-trace-test/events.jsonl",
				expectedPath: "artifacts/runtime-card-trace-test/events.jsonl",
			},
			{
				name: "absolute path",
				value: join(repoRoot, "artifacts/agent-runs/absolute/events.jsonl"),
				expectedPath: "artifacts/agent-runs/absolute/events.jsonl",
			},
			{
				name: "posix traversal",
				value: "artifacts/agent-runs/../runtime-card-trace-test/events.jsonl",
				expectedPath: "artifacts/runtime-card-trace-test/events.jsonl",
			},
			{
				name: "backslash traversal",
				value:
					"artifacts\\agent-runs\\..\\runtime-card-trace-test\\events.jsonl",
				expectedPath: "artifacts/runtime-card-trace-test/events.jsonl",
			},
		];

		for (const testCase of cases) {
			const { exitCode, error } = await captureRuntimeCardCLI([
				"--json",
				"--repo",
				repoRoot,
				"--trace-out",
				testCase.value,
			]);
			expect(exitCode, testCase.name).toBe(2);
			expect(error, testCase.name).toContain(
				"--trace-out must be artifacts/agent-runs/<runId>/events.jsonl",
			);
			expect(existsSync(join(repoRoot, testCase.expectedPath))).toBe(false);
		}
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

	it("returns usage errors for missing handoff output path", async () => {
		const { exitCode, error } = await captureRuntimeCardCLI(["--handoff-out"]);

		expect(exitCode).toBe(2);
		expect(error).toContain("--handoff-out requires a file path");
	});

	it("requires card and evidence outputs before writing a handoff", async () => {
		const repoRoot = setupRepo();
		const { exitCode, output } = await captureRuntimeCardCLI([
			"--json",
			"--repo",
			repoRoot,
			"--handoff-out",
			".harness/runtime/JSC-311-handoff.json",
		]);

		expect(exitCode).toBe(1);
		expect(JSON.parse(output)).toMatchObject({
			schemaVersion: "runtime-card-error/v1",
			status: "fail",
			error: "Error: --handoff-out requires --out and --evidence-out",
		});
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

	it("rejects colliding handoff output paths", async () => {
		const repoRoot = setupRepo();
		const { exitCode, output } = await captureRuntimeCardCLI([
			"--json",
			"--repo",
			repoRoot,
			"--out",
			".harness/runtime/card.json",
			"--evidence-out",
			".harness/runtime/evidence.json",
			"--handoff-out",
			".harness/runtime/evidence.json",
		]);

		expect(exitCode).toBe(1);
		expect(JSON.parse(output)).toMatchObject({
			schemaVersion: "runtime-card-error/v1",
			status: "fail",
			error:
				"Error: --evidence-out and --handoff-out must target different files",
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
