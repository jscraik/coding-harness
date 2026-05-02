import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	buildCodeRabbitLearningArtifact,
	writeLearningArtifact,
} from "./artifact-io.js";
import { runLearningsGate } from "./gate.js";
import { LEARNING_OVERRIDE_SCHEMA_VERSION } from "./overrides.js";

const csv = `Repository,File,Pull Request,URL,Usage,Learning,Created By,Last Used,Created At,Updated At
coding-harness,docs/policy.md,148,,516,"YAML frontmatter fields are machine-readable metadata.",jscraik,Never,created,updated
`;

const keywordCsv = `Repository,File,Pull Request,URL,Usage,Learning,Created By,Last Used,Created At,Updated At
coding-harness,,149,,516,"Generated runtime mirror files should be fixed at the generator.",jscraik,Never,created,updated
`;

describe("learnings gate overrides", () => {
	const cleanup: string[] = [];
	afterEach(() => {
		for (const path of cleanup.splice(0))
			rmSync(path, { recursive: true, force: true });
	});

	it("suppresses matching learning findings with audit metadata", () => {
		const dir = setupArtifact();
		const learningId = readLearningId(dir);
		writeOverrides(dir, {
			learningId,
			pathPattern: "docs/**",
			expiresAt: "2026-12-31",
		});

		const result = runLearningsGate({
			repoRoot: dir,
			files: ["docs/policy.md"],
			overrides: ".harness/learnings/overrides.json",
			now: new Date("2026-04-30T00:00:00Z"),
		});

		expect(result.status).toBe("pass");
		expect(result.findings).toHaveLength(1);
		expect(result.findings[0]).toMatchObject({
			id: `learnings-gate.override.suppressed.${learningId}.docs__policy.md`,
			severity: "info",
			overrideSupport: {
				suppressed: true,
				override: {
					owner: "docs-owner",
					replacementAction: "Track the replacement action.",
				},
			},
		});
		expect(result.evidence_ref).toEqual(
			expect.arrayContaining([
				expect.stringContaining("coderabbit_csv:"),
				expect.stringContaining("#row=2"),
			]),
		);
	});

	it("fails closed for expired strict suppressions", () => {
		const dir = setupArtifact();
		const learningId = readLearningId(dir);
		writeOverrides(dir, {
			learningId,
			pathPattern: "docs/**",
			expiresAt: "2026-01-01",
		});

		const result = runLearningsGate({
			repoRoot: dir,
			files: ["docs/policy.md"],
			overrides: ".harness/learnings/overrides.json",
			now: new Date("2026-04-30T00:00:00Z"),
		});

		expect(result.status).toBe("fail");
		expect(result.findings.map((finding) => finding.id)).toContain(
			`learnings-gate.override.expired.${learningId}`,
		);
		expect(result.findings.map((finding) => finding.id)).toContain(
			`learnings-gate.learning.${learningId}`,
		);
	});

	it("does not suppress non-suppressible artifact findings", () => {
		const dir = mkdtempSync(join(tmpdir(), "learnings-gate-missing-"));
		cleanup.push(dir);
		writeOverrides(dir, {
			learningId: "learnings-gate.artifact.missing",
			pathPattern: "docs/**",
			expiresAt: "2026-12-31",
		});

		const result = runLearningsGate({
			repoRoot: dir,
			files: ["docs/policy.md"],
			overrides: ".harness/learnings/overrides.json",
			now: new Date("2026-04-30T00:00:00Z"),
		});

		expect(result.status).toBe("fail");
		expect(result.findings[0]).toMatchObject({
			id: "learnings-gate.artifact.missing",
			fix: { suppressible: false },
		});
	});

	it("fails closed for malformed learning artifacts before source checks", () => {
		const dir = mkdtempSync(join(tmpdir(), "learnings-gate-invalid-"));
		cleanup.push(dir);
		mkdirSync(join(dir, ".harness/learnings"), { recursive: true });
		writeFileSync(
			join(dir, ".harness/learnings/coderabbit.local.json"),
			JSON.stringify({
				schemaVersion: "harness-learnings/v1",
				provider: "coderabbit-csv",
				repository: "coding-harness",
				source: {
					kind: "coderabbit_csv",
					uri: "file:///tmp/learnings.csv",
					live: false,
				},
				items: [],
			}),
			"utf-8",
		);

		const result = runLearningsGate({
			repoRoot: dir,
			files: ["docs/policy.md"],
		});

		expect(result.status).toBe("fail");
		expect(result.findings[0]).toMatchObject({
			id: "learnings-gate.artifact.invalid",
			severity: "error",
			message:
				"Learning artifact at .harness/learnings/coderabbit.local.json must use schemaVersion harness-learnings/v1 with inputFingerprint, source.uri, repository, and items.",
		});
	});

	it("rejects learning items with malformed source evidence", () => {
		const dir = mkdtempSync(join(tmpdir(), "learnings-gate-bad-source-"));
		cleanup.push(dir);
		mkdirSync(join(dir, ".harness/learnings"), { recursive: true });
		writeFileSync(
			join(dir, ".harness/learnings/coderabbit.local.json"),
			JSON.stringify({
				schemaVersion: "harness-learnings/v1",
				provider: "coderabbit-csv",
				repository: "coding-harness",
				source: {
					kind: "coderabbit_csv",
					uri: "file:///tmp/learnings.csv",
					live: false,
				},
				inputFingerprint: "fingerprint",
				items: [
					{
						id: "coderabbit.coding-harness.bad-source",
						provider: "coderabbit",
						source: {
							kind: "unknown",
							uri: "file:///tmp/learnings.csv",
							row: 2,
							live: false,
						},
						repository: "coding-harness",
						usage: 100,
						learning: "Bad source should fail.",
						classification: "guardrail",
						enforcement: "error",
						promotionStatus: "candidate",
					},
				],
				warnings: [],
				summary: {
					totalRows: 1,
					imported: 1,
					skipped: 0,
					invalid: 0,
					warnings: 0,
					byClassification: { guardrail: 1 },
					byEnforcement: { error: 1 },
				},
			}),
			"utf-8",
		);

		const result = runLearningsGate({
			repoRoot: dir,
			files: ["docs/policy.md"],
		});

		expect(result.status).toBe("fail");
		expect(result.findings[0]?.id).toBe("learnings-gate.artifact.invalid");
	});

	function setupArtifact(): string {
		const dir = mkdtempSync(join(tmpdir(), "learnings-gate-overrides-"));
		cleanup.push(dir);
		const sourcePath = join(dir, "learnings.csv");
		writeFileSync(sourcePath, csv, "utf-8");
		const artifact = buildCodeRabbitLearningArtifact({
			sourcePath,
			repository: "coding-harness",
		});
		expect(artifact.ok).toBe(true);
		if (!artifact.ok) return dir;
		const writeResult = writeLearningArtifact({
			artifact: artifact.artifact,
			repoRoot: dir,
		});
		expect(writeResult.ok).toBe(true);
		return dir;
	}

	function readLearningId(dir: string): string {
		const artifact = JSON.parse(
			readFileSync(
				join(dir, ".harness/learnings/coderabbit.local.json"),
				"utf-8",
			),
		);
		return artifact.items[0].id;
	}

	function writeOverrides(
		dir: string,
		options: {
			learningId: string;
			pathPattern: string;
			expiresAt: string;
		},
	): void {
		mkdirSync(join(dir, ".harness/learnings"), { recursive: true });
		writeFileSync(
			join(dir, ".harness/learnings/overrides.json"),
			JSON.stringify({
				schemaVersion: LEARNING_OVERRIDE_SCHEMA_VERSION,
				suppressions: [
					{
						learningId: options.learningId,
						pathPattern: options.pathPattern,
						reason: "False positive during migration.",
						owner: "docs-owner",
						expiresAt: options.expiresAt,
						replacementAction: "Track the replacement action.",
					},
				],
			}),
			"utf-8",
		);
	}
});

describe("learnings gate fuzzy matching", () => {
	const cleanup: string[] = [];
	afterEach(() => {
		for (const path of cleanup.splice(0))
			rmSync(path, { recursive: true, force: true });
	});

	it("keeps keyword-only matches advisory even for high-usage error learnings", () => {
		const dir = setupArtifact(keywordCsv);

		const result = runLearningsGate({
			repoRoot: dir,
			files: ["scripts/generated-runtime-mirror.ts"],
		});

		expect(result.status).toBe("warn");
		expect(result.findings[0]).toMatchObject({
			severity: "warning",
			path: "scripts/generated-runtime-mirror.ts",
			match: {
				kind: "keyword",
				advisoryOnly: true,
				falsePositiveCandidate: false,
			},
		});
	});

	it("emits confidence metadata for low-confidence keyword-only matches", () => {
		const dir =
			setupArtifact(`Repository,File,Pull Request,URL,Usage,Learning,Created By,Last Used,Created At,Updated At
coding-harness,,150,,516,"Frontmatter fields are machine-readable metadata.",jscraik,Never,created,updated
`);

		const result = runLearningsGate({
			repoRoot: dir,
			files: ["docs/frontmatter.md"],
		});

		expect(result.status).toBe("warn");
		expect(result.findings[0]).toMatchObject({
			severity: "warning",
			match: {
				kind: "keyword",
				confidence: 0.5,
				advisoryOnly: true,
				falsePositiveCandidate: true,
			},
		});
	});

	function setupArtifact(sourceCsv: string): string {
		const dir = mkdtempSync(join(tmpdir(), "learnings-gate-fuzzy-"));
		cleanup.push(dir);
		const sourcePath = join(dir, "learnings.csv");
		writeFileSync(sourcePath, sourceCsv, "utf-8");
		const artifact = buildCodeRabbitLearningArtifact({
			sourcePath,
			repository: "coding-harness",
		});
		expect(artifact.ok).toBe(true);
		if (!artifact.ok) return dir;
		const writeResult = writeLearningArtifact({
			artifact: artifact.artifact,
			repoRoot: dir,
		});
		expect(writeResult.ok).toBe(true);
		return dir;
	}
});
