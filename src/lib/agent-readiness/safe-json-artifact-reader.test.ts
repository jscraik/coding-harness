import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	jsonArtifactEvidence,
	readJsonArtifact,
} from "./safe-json-artifact-reader.js";

describe("jsonArtifactEvidence", () => {
	const tempDirs: string[] = [];

	afterEach(() => {
		for (const tempDir of tempDirs.splice(0)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("keeps report evidence out of symlinked parent directories", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "safe-json-artifact-"));
		const outsideRoot = mkdtempSync(join(tmpdir(), "safe-json-outside-"));
		tempDirs.push(repoRoot, outsideRoot);
		const canonical = "artifacts/context-integrity/report.json";
		const alternate = "artifacts/report.json";
		mkdirSync(join(outsideRoot, "context-integrity"), { recursive: true });
		writeFileSync(join(outsideRoot, "context-integrity", "report.json"), "{}");
		symlinkSync(outsideRoot, join(repoRoot, "artifacts"), "dir");

		expect(jsonArtifactEvidence(repoRoot, [canonical])).toEqual([]);

		rmSync(join(repoRoot, "artifacts"));
		mkdirSync(join(repoRoot, "artifacts"), { recursive: true });
		symlinkSync(
			join(outsideRoot, "context-integrity", "report.json"),
			join(repoRoot, alternate),
		);

		expect(jsonArtifactEvidence(repoRoot, [alternate])).toEqual([alternate]);
	});

	it("reads an allowlisted repo-local JSON artifact", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "safe-json-artifact-"));
		tempDirs.push(repoRoot);
		const reportPath = "artifacts/context-integrity/report.json";
		mkdirSync(join(repoRoot, "artifacts", "context-integrity"), {
			recursive: true,
		});
		writeFileSync(
			join(repoRoot, "artifacts", "context-integrity", "report.json"),
			'{"status":"pass"}',
		);

		expect(readJsonArtifact(repoRoot, reportPath, [reportPath])).toBe(
			'{"status":"pass"}',
		);
	});

	it("does not read allowlisted JSON through a symlinked parent", () => {
		const repoRoot = mkdtempSync(join(tmpdir(), "safe-json-artifact-"));
		const outsideRoot = mkdtempSync(join(tmpdir(), "safe-json-outside-"));
		tempDirs.push(repoRoot, outsideRoot);
		const reportPath = "artifacts/context-integrity/report.json";
		mkdirSync(join(outsideRoot, "context-integrity"), { recursive: true });
		writeFileSync(
			join(outsideRoot, "context-integrity", "report.json"),
			'{"status":"pass"}',
		);
		symlinkSync(outsideRoot, join(repoRoot, "artifacts"), "dir");

		expect(readJsonArtifact(repoRoot, reportPath, [reportPath])).toBe("");
	});
});
