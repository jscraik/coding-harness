import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	collectSessionContext,
	runSessionContextCLI,
} from "./session-context.js";

describe("session-context command", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		for (const tempDir of tempDirs.splice(0)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
		vi.restoreAllMocks();
	});

	it("emits a read-only session-context/v1 packet with local orientation refs", () => {
		const repoRoot = makeSessionRepo(tempDirs);
		writeRepoFile(repoRoot, ".harness/runtime/runtime-card.json", "{}\n");
		writeRepoFile(repoRoot, "artifacts/reviews/reviewer.md", "# Review\n");
		writeRepoFile(
			repoRoot,
			"docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl",
			'{"id":"R001"}\n',
		);
		initializeGitRepo(repoRoot);

		const report = collectSessionContext({
			repoRoot,
			now: new Date("2026-05-27T09:00:00.000Z"),
		});

		expect(report).toMatchObject({
			schemaVersion: "session-context/v1",
			generatedAt: "2026-05-27T09:00:00.000Z",
			producer: "harness:session-context",
			status: "pass",
			evidenceUse: "orientation",
			runtimeStatus: "emitted",
			issueRef: "JSC-363",
		});
		expect(report.activeArtifacts.map((artifact) => artifact.path)).toContain(
			".harness/active-artifacts.md",
		);
		expect(report.runtimeCards.map((artifact) => artifact.path)).toContain(
			".harness/runtime/runtime-card.json",
		);
		expect(report.reviewArtifacts.map((artifact) => artifact.path)).toContain(
			"artifacts/reviews/reviewer.md",
		);
		expect(report.sessionEvidence.map((artifact) => artifact.path)).toContain(
			"docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl",
		);
		expect(report.nextTraversalHints.map((hint) => hint.command)).toEqual(
			expect.arrayContaining([expect.stringContaining(repoRoot)]),
		);
	});

	it("downgrades to warn when required local orientation evidence is missing", () => {
		const repoRoot = makeSessionRepo(tempDirs);

		const report = collectSessionContext({ repoRoot });

		expect(report.status).toBe("warn");
		expect(report.staleState).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "runtime_card",
					freshness: "missing",
				}),
				expect.objectContaining({
					surface: "session_evidence",
					freshness: "missing",
				}),
			]),
		);
	});

	it("downgrades to warn when review artifacts are missing", () => {
		const repoRoot = makeSessionRepo(tempDirs);
		writeRepoFile(repoRoot, ".harness/runtime/runtime-card.json", "{}\n");
		writeRepoFile(
			repoRoot,
			"docs/goals/codex-runtime-evidence-verifier-cockpit/receipts.jsonl",
			'{"id":"R001"}\n',
		);
		initializeGitRepo(repoRoot);

		const report = collectSessionContext({ repoRoot });

		expect(report.status).toBe("warn");
		expect(report.staleState).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					surface: "review_artifacts",
					freshness: "missing",
				}),
			]),
		);
	});

	it("binds traversal hints to the requested repo root when cwd differs", () => {
		const repoRoot = makeSessionRepo(tempDirs);
		const otherRoot = mkdtempSync(join(tmpdir(), "session-context-cwd-"));
		tempDirs.push(otherRoot);
		const originalCwd = process.cwd();
		process.chdir(otherRoot);
		try {
			const report = collectSessionContext({ repoRoot });
			const commands = report.nextTraversalHints.map((hint) => hint.command);
			const canonicalRepoRoot = report.repoRoot;

			expect(commands).toEqual(
				expect.arrayContaining([
					expect.stringContaining(`--repo '${canonicalRepoRoot}'`),
					expect.stringContaining(`--repo-root '${canonicalRepoRoot}'`),
					expect.stringContaining(`cd '${canonicalRepoRoot}' &&`),
				]),
			);
			expect(commands).not.toContain(
				"node --import tsx src/cli.ts runtime-card --json --repo .",
			);
		} finally {
			process.chdir(originalCwd);
		}
	});

	it("preserves the first character of modified tracked paths", () => {
		const repoRoot = makeSessionRepo(tempDirs);
		initializeGitRepo(repoRoot);
		writeRepoFile(
			repoRoot,
			"docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md",
			"# Goal\n\nUpdated\n",
		);

		const report = collectSessionContext({ repoRoot });

		expect(report.changedFiles).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					path: "docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md",
					status: "M",
				}),
			]),
		);
		expect(report.changedFiles.map((file) => file.path)).not.toContain(
			"ocs/goals/codex-runtime-evidence-verifier-cockpit/goal.md",
		);
	});

	it("does not follow active-artifact symlinks that escape the repo root", () => {
		const repoRoot = makeSessionRepo(tempDirs);
		const outsideRoot = mkdtempSync(join(tmpdir(), "session-context-outside-"));
		tempDirs.push(outsideRoot);
		writeFileSync(join(outsideRoot, "secret.md"), "outside\n");
		symlinkSync(
			join(outsideRoot, "secret.md"),
			join(repoRoot, ".harness", "escaped.md"),
		);
		writeRepoFile(
			repoRoot,
			".harness/active-artifacts.md",
			activeRouteWithRef(".harness/escaped.md"),
		);

		const report = collectSessionContext({ repoRoot });

		expect(report.activeArtifacts.map((artifact) => artifact.path)).toEqual([
			".harness/active-artifacts.md",
		]);
	});

	it("keeps sessionEvidence bounded to repo-owned artifact metadata", () => {
		const repoRoot = makeSessionRepo(tempDirs);
		writeRepoFile(repoRoot, ".codex/sessions/raw.jsonl", '{"prompt":true}\n');
		writeRepoFile(repoRoot, ".env", "SECRET=value\n");
		writeRepoFile(repoRoot, "artifacts/runtime/run.json", "{}\n");

		const report = collectSessionContext({ repoRoot });
		const evidencePaths = report.sessionEvidence.map(
			(artifact) => artifact.path,
		);

		expect(evidencePaths).toContain("artifacts/runtime");
		expect(evidencePaths).not.toContain(".codex/sessions/raw.jsonl");
		expect(evidencePaths).not.toContain(".env");
	});

	it("prints JSON and returns success for warning-only orientation packets", () => {
		const repoRoot = makeSessionRepo(tempDirs);
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		const exitCode = runSessionContextCLI(["--repo-root", repoRoot, "--json"]);

		expect(exitCode).toBe(0);
		const output = String(infoSpy.mock.calls[0]?.[0]);
		expect(output).toContain('"schemaVersion": "session-context/v1"');
		expect(output).toContain('"status": "warn"');
	});

	it("returns a usage error when --repo-root is missing a value", () => {
		const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

		const exitCode = runSessionContextCLI(["--repo-root", "--json"]);

		expect(exitCode).toBe(2);
		const payload = JSON.parse(String(infoSpy.mock.calls[0]?.[0])) as {
			schemaVersion: string;
			error: { code: string };
		};
		expect(payload.schemaVersion).toBe("session-context-error/v1");
		expect(payload.error.code).toBe("session-context.flag_value_required");
	});
});

function makeSessionRepo(tempDirs: string[]): string {
	const repoRoot = mkdtempSync(join(tmpdir(), "session-context-repo-"));
	tempDirs.push(repoRoot);
	writeRepoFile(
		repoRoot,
		".harness/active-artifacts.md",
		activeRouteWithRef(
			"docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md",
		),
	);
	writeRepoFile(
		repoRoot,
		"docs/goals/codex-runtime-evidence-verifier-cockpit/goal.md",
		"# Goal\n",
	);
	return repoRoot;
}

function activeRouteWithRef(path: string): string {
	const tick = String.fromCharCode(96);
	return [
		"# Active",
		"",
		"## Current Active Route",
		"",
		"| Work | Refs |",
		"|---|---|",
		`| JSC-363 | ${tick}${path}${tick} |`,
	].join("\n");
}

function writeRepoFile(repoRoot: string, path: string, contents: string): void {
	const fullPath = join(repoRoot, path);
	mkdirSync(dirname(fullPath), { recursive: true });
	writeFileSync(fullPath, contents);
}

function initializeGitRepo(repoRoot: string): void {
	execFileSync("git", ["init", "-b", "codex/JSC-363-session-context"], {
		cwd: repoRoot,
		stdio: "ignore",
	});
	execFileSync("git", ["config", "user.email", "codex@example.invalid"], {
		cwd: repoRoot,
		stdio: "ignore",
	});
	execFileSync("git", ["config", "user.name", "Codex Test"], {
		cwd: repoRoot,
		stdio: "ignore",
	});
	execFileSync("git", ["add", "."], { cwd: repoRoot, stdio: "ignore" });
	execFileSync("git", ["commit", "-m", "initial"], {
		cwd: repoRoot,
		stdio: "ignore",
	});
}
