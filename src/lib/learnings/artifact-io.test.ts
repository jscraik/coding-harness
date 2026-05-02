import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	utimesSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	DEFAULT_CODERABBIT_LOCAL_ARTIFACT,
	buildCodeRabbitLearningArtifact,
	writeLearningArtifact,
} from "./artifact-io.js";
import { runLearningsGate } from "./gate.js";

const csv = `Repository,File,Pull Request,URL,Usage,Learning,Created By,Last Used,Created At,Updated At
coding-harness,docs/ai-assistant-security-policy.md,148,,516,"YAML frontmatter fields are machine-readable metadata.",jscraik,Never,created,updated
`;

const sensitiveCsv = `Repository,File,Pull Request,URL,Usage,Learning,Created By,Last Used,Created At,Updated At
coding-harness,/Users/jamiecraik/Downloads/private.md,148,https://github.com/jscraik/coding-harness/pull/148,516,"Use token=github_pat_abcdefghijklmnopqrstuvwxyz123456 from /Users/jamiecraik/.config.",jscraik,Never,created,updated
`;

describe("learning artifact IO", () => {
	const cleanup: string[] = [];
	afterEach(() => {
		for (const path of cleanup.splice(0))
			rmSync(path, { recursive: true, force: true });
	});

	it("builds a local artifact with source fingerprint and nullable lastUsed", () => {
		const dir = mkdtempSync(join(tmpdir(), "learning-artifact-"));
		cleanup.push(dir);
		const sourcePath = join(dir, "learnings.csv");
		writeFileSync(sourcePath, csv, "utf-8");

		const result = buildCodeRabbitLearningArtifact({
			sourcePath,
			repository: "coding-harness",
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.artifact.schemaVersion).toBe("harness-learnings/v1");
		expect(result.artifact.source.live).toBe(false);
		expect(result.artifact.inputFingerprint).toMatch(/^[a-f0-9]{64}$/);
		expect(result.artifact.items[0]?.lastUsed).toBeNull();
	});

	it("returns a structured failure when the source CSV cannot be read", () => {
		const dir = mkdtempSync(join(tmpdir(), "learning-artifact-unreadable-"));
		cleanup.push(dir);

		const result = buildCodeRabbitLearningArtifact({
			sourcePath: dir,
			repository: "coding-harness",
		});

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.errorCode).toBe("learnings.source_unreadable");
		expect(result.message).toContain("Unable to read source CSV");
		expect(result.warnings).toEqual([]);
	});

	it("writes the default local artifact atomically", () => {
		const dir = mkdtempSync(join(tmpdir(), "learning-artifact-write-"));
		cleanup.push(dir);
		const sourcePath = join(dir, "learnings.csv");
		writeFileSync(sourcePath, csv, "utf-8");
		const result = buildCodeRabbitLearningArtifact({
			sourcePath,
			repository: "coding-harness",
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const writeResult = writeLearningArtifact({
			artifact: result.artifact,
			repoRoot: dir,
		});

		expect(writeResult.ok).toBe(true);
		const targetPath = join(dir, DEFAULT_CODERABBIT_LOCAL_ARTIFACT);
		expect(existsSync(targetPath)).toBe(true);
		expect(JSON.parse(readFileSync(targetPath, "utf-8")).summary.imported).toBe(
			1,
		);
	});

	it("writes sanitized snapshot output without local paths or sensitive values", () => {
		const dir = mkdtempSync(join(tmpdir(), "learning-artifact-snapshot-"));
		cleanup.push(dir);
		const sourcePath = join(dir, "learnings.csv");
		writeFileSync(sourcePath, sensitiveCsv, "utf-8");
		const result = buildCodeRabbitLearningArtifact({
			sourcePath,
			repository: "coding-harness",
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const writeResult = writeLearningArtifact({
			artifact: result.artifact,
			repoRoot: dir,
			outputPath: "./.harness/learnings/coderabbit.snapshot.json",
		});

		expect(writeResult.ok).toBe(true);
		const snapshotPath = join(
			dir,
			".harness/learnings/coderabbit.snapshot.json",
		);
		expect(existsSync(snapshotPath)).toBe(true);
		const snapshotText = readFileSync(snapshotPath, "utf-8");
		const snapshot = JSON.parse(snapshotText);
		expect(snapshot.schemaVersion).toBe("harness-learnings-snapshot/v1");
		expect(snapshot.source).toMatchObject({
			kind: "coderabbit_csv",
			sourceLabel: "CodeRabbit CSV export",
			live: false,
		});
		expect(snapshot.source.uri).toBeUndefined();
		expect(snapshot.items[0].source.uri).toBeUndefined();
		expect(snapshot.items[0].githubUrl).toBe(
			"https://github.com/jscraik/coding-harness/pull/148",
		);
		expect(snapshotText).not.toContain("/Users/jamiecraik");
		expect(snapshotText).not.toContain(
			"github_pat_abcdefghijklmnopqrstuvwxyz123456",
		);
		expect(snapshotText).toContain("[REDACTED]");
	});

	it("warns when a fresh import sharply drops from an existing local artifact", () => {
		const dir = mkdtempSync(join(tmpdir(), "learning-artifact-stale-"));
		cleanup.push(dir);
		mkdirSync(join(dir, ".harness/learnings"), { recursive: true });
		const previousPath = join(dir, DEFAULT_CODERABBIT_LOCAL_ARTIFACT);
		writeFileSync(
			previousPath,
			JSON.stringify({ summary: { imported: 20 } }),
			"utf-8",
		);
		const sourcePath = join(dir, "learnings.csv");
		writeFileSync(sourcePath, csv, "utf-8");

		const result = buildCodeRabbitLearningArtifact({
			sourcePath,
			repository: "coding-harness",
			previousArtifactPath: previousPath,
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(
			result.artifact.warnings.some(
				(warning) => warning.code === "learnings.imported_count_drop",
			),
		).toBe(true);
	});

	it("warns when the source CSV is newer than the local artifact", () => {
		const dir = mkdtempSync(join(tmpdir(), "learning-artifact-stale-source-"));
		cleanup.push(dir);
		const sourcePath = join(dir, "learnings.csv");
		const artifactPath = join(dir, DEFAULT_CODERABBIT_LOCAL_ARTIFACT);
		writeFileSync(sourcePath, csv, "utf-8");
		const result = buildCodeRabbitLearningArtifact({
			sourcePath,
			repository: "coding-harness",
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const writeResult = writeLearningArtifact({
			artifact: result.artifact,
			repoRoot: dir,
		});
		expect(writeResult.ok).toBe(true);
		writeFileSync(sourcePath, `${csv}\n`, "utf-8");
		const future = new Date(Date.now() + 60_000);
		utimesSync(sourcePath, future, future);

		const gateResult = runLearningsGate({
			repoRoot: dir,
			files: ["unmatched.md"],
		});

		expect(gateResult.status).toBe("warn");
		expect(gateResult.findings[0]?.id).toBe("learnings-gate.source.stale");
		expect(existsSync(artifactPath)).toBe(true);
	});
});
