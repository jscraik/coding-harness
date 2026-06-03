import { spawnSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT_PATH = fileURLToPath(
	new URL("../../scripts/validate-reviewer-coverage.cjs", import.meta.url),
);

const roots: string[] = [];
const HEAD_SHA = "33e99c695c6cb6f67301948e1b9013deb5ed2037";
const STALE_HEAD_SHA = "ab27286b6658440c49d7de8ee1aac7f3371c36d9";

function makeRoot() {
	const root = mkdtempSync(join(tmpdir(), "reviewer-coverage-"));
	roots.push(root);
	mkdirSync(join(root, "artifacts", "reviews"), { recursive: true });
	return root;
}

function write(root: string, repoPath: string, content: string) {
	writeFileSync(join(root, repoPath), content);
}

function writeManifest(root: string, manifest: unknown) {
	write(root, "reviewers.json", `${JSON.stringify(manifest, null, 2)}\n`);
}

function runValidator(root: string, ...args: string[]) {
	return spawnSync(
		process.execPath,
		[
			SCRIPT_PATH,
			"--root",
			root,
			"--manifest",
			"reviewers.json",
			"--reviews-dir",
			"artifacts/reviews",
			"--json",
			...args,
		],
		{
			encoding: "utf8",
		},
	);
}

function parseSingleJsonReport(result: ReturnType<typeof runValidator>) {
	const stdout = result.stdout.trim();
	expect(stdout).toMatch(/^\{[\s\S]*\}$/u);
	return JSON.parse(stdout);
}

afterEach(() => {
	for (const root of roots.splice(0)) {
		rmSync(root, { force: true, recursive: true });
	}
});

describe("validate-reviewer-coverage script", () => {
	it("passes when every required reviewer artifact has a WROTE marker", () => {
		const root = makeRoot();
		write(
			root,
			"artifacts/reviews/architecture.md",
			"Findings clear.\n\nWROTE: artifacts/reviews/architecture.md\n",
		);
		write(
			root,
			"artifacts/reviews/testing.md",
			"Testing clear.\n\nWROTE: artifacts/reviews/testing.md\n",
		);
		writeManifest(root, {
			requiredReviewers: [
				{ artifact: "architecture.md", role: "architecture" },
				{ artifact: "testing.md", role: "testing" },
			],
			retryCount: 1,
			synthesisStatus: "complete",
		});

		const result = runValidator(root);
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(0);
		expect(report).toMatchObject({
			blockerClass: null,
			retryCount: 1,
			schemaVersion: "reviewer-coverage-receipt/v1",
			status: "pass",
			synthesisStatus: "complete",
		});
		expect(report.completedRoles).toEqual(["architecture", "testing"]);
		expect(report.missingArtifacts).toEqual([]);
	});

	it("passes when required reviewer artifacts match the expected head SHA", () => {
		const root = makeRoot();
		write(
			root,
			"artifacts/reviews/architecture.md",
			`head_sha: ${HEAD_SHA}\n\nWROTE: artifacts/reviews/architecture.md\n`,
		);
		writeManifest(root, {
			expectedHeadSha: HEAD_SHA,
			requiredReviewers: [
				{ artifact: "architecture.md", role: "architecture" },
			],
			synthesisStatus: "complete",
		});

		const result = runValidator(root);
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(0);
		expect(report).toMatchObject({
			blockerClass: null,
			status: "pass",
		});
		expect(report.completedRoles).toEqual(["architecture"]);
	});

	it("fails closed when a required reviewer artifact reports a stale head SHA", () => {
		const root = makeRoot();
		write(
			root,
			"artifacts/reviews/architecture.md",
			`head_sha: ${STALE_HEAD_SHA}\n\nWROTE: artifacts/reviews/architecture.md\n`,
		);
		writeManifest(root, {
			expectedHeadSha: HEAD_SHA,
			requiredReviewers: [
				{ artifact: "architecture.md", role: "architecture" },
			],
			synthesisStatus: "complete",
		});

		const result = runValidator(root);
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(1);
		expect(report).toMatchObject({
			blockerClass: "missing_artifacts",
			status: "blocked",
		});
		expect(report.missingArtifacts).toEqual([
			expect.objectContaining({
				actualHeadSha: STALE_HEAD_SHA,
				expectedHeadSha: HEAD_SHA,
				reason: "artifact_head_sha_mismatch",
				role: "architecture",
			}),
		]);
	});

	it("fails closed when an artifact contains conflicting head SHA fields", () => {
		const root = makeRoot();
		write(
			root,
			"artifacts/reviews/architecture.md",
			[
				`head_sha: ${HEAD_SHA}`,
				"status: findings",
				`- headRefOid: ${STALE_HEAD_SHA}`,
				"WROTE: artifacts/reviews/architecture.md",
			].join("\n"),
		);
		writeManifest(root, {
			expectedHeadSha: HEAD_SHA,
			requiredReviewers: [
				{ artifact: "architecture.md", role: "architecture" },
			],
			synthesisStatus: "complete",
		});

		const result = runValidator(root);
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(1);
		expect(report.missingArtifacts).toEqual([
			expect.objectContaining({
				actualHeadSha: HEAD_SHA,
				candidateHeadShas: [HEAD_SHA, STALE_HEAD_SHA],
				expectedHeadSha: HEAD_SHA,
				reason: "artifact_ambiguous_head_sha",
				role: "architecture",
			}),
		]);
	});

	it("fails closed when expected head SHA is required but absent from the artifact", () => {
		const root = makeRoot();
		write(
			root,
			"artifacts/reviews/architecture.md",
			"Findings clear.\n\nWROTE: artifacts/reviews/architecture.md\n",
		);
		writeManifest(root, {
			expectedHeadSha: HEAD_SHA,
			requiredReviewers: [
				{ artifact: "architecture.md", role: "architecture" },
			],
			synthesisStatus: "complete",
		});

		const result = runValidator(root);
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(1);
		expect(report).toMatchObject({
			blockerClass: "missing_artifacts",
			status: "blocked",
		});
		expect(report.missingArtifacts).toEqual([
			expect.objectContaining({
				expectedHeadSha: HEAD_SHA,
				reason: "artifact_missing_head_sha",
				role: "architecture",
			}),
		]);
	});

	it("rejects malformed expected head SHA values instead of disabling the freshness guard", () => {
		const root = makeRoot();
		write(
			root,
			"artifacts/reviews/architecture.md",
			`head_sha: ${HEAD_SHA}\n\nWROTE: artifacts/reviews/architecture.md\n`,
		);
		writeManifest(root, {
			expectedHeadSha: "not-a-git-sha",
			requiredReviewers: [
				{ artifact: "architecture.md", role: "architecture" },
			],
			synthesisStatus: "complete",
		});

		const result = runValidator(root);
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(1);
		expect(report).toMatchObject({
			blockerClass: "invalid_manifest",
			reason: "manifest expectedHeadSha must be a 40-character git SHA",
			status: "blocked",
		});
	});

	it("fails closed when a required reviewer artifact is missing", () => {
		const root = makeRoot();
		writeManifest(root, {
			requiredReviewers: [
				{ artifact: "architecture.md", role: "architecture" },
			],
			synthesisStatus: "complete",
		});

		const result = runValidator(root);
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(1);
		expect(report).toMatchObject({
			blockerClass: "missing_artifacts",
			status: "blocked",
		});
		expect(report.missingArtifacts).toEqual([
			expect.objectContaining({
				artifact: "artifacts/reviews/architecture.md",
				reason: "artifact_not_found",
				role: "architecture",
			}),
		]);
	});

	it("fails closed when a reviewer artifact resolves outside the repository", () => {
		const root = makeRoot();
		const outsideRoot = mkdtempSync(
			join(tmpdir(), "reviewer-coverage-outside-"),
		);
		roots.push(outsideRoot);
		writeFileSync(
			join(outsideRoot, "outside-review.md"),
			"WROTE: ../outside-review.md\n",
		);
		writeManifest(root, {
			requiredReviewers: [
				{ artifact: join(outsideRoot, "outside-review.md"), role: "security" },
			],
			synthesisStatus: "complete",
		});

		const result = runValidator(root);
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(1);
		expect(report).toMatchObject({
			blockerClass: "missing_artifacts",
			status: "blocked",
		});
		expect(report.missingArtifacts).toEqual([
			expect.objectContaining({
				reason: "artifact_outside_repo",
				role: "security",
			}),
		]);
	});

	it("fails closed when a reviewer artifact symlink targets outside the repository", () => {
		const root = makeRoot();
		const outsideRoot = mkdtempSync(
			join(tmpdir(), "reviewer-coverage-symlink-outside-"),
		);
		roots.push(outsideRoot);
		writeFileSync(
			join(outsideRoot, "architecture.md"),
			"WROTE: artifacts/reviews/architecture.md\n",
		);
		symlinkSync(
			join(outsideRoot, "architecture.md"),
			join(root, "artifacts", "reviews", "architecture.md"),
		);
		writeManifest(root, {
			requiredReviewers: [
				{ artifact: "architecture.md", role: "architecture" },
			],
			synthesisStatus: "complete",
		});

		const result = runValidator(root);
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(1);
		expect(report).toMatchObject({
			blockerClass: "missing_artifacts",
			status: "blocked",
		});
		expect(report.missingArtifacts).toEqual([
			expect.objectContaining({
				artifact: "artifacts/reviews/architecture.md",
				reason: "artifact_outside_repo",
				role: "architecture",
			}),
		]);
	});

	it("reports partial coverage when one reviewer completed and another is missing", () => {
		const root = makeRoot();
		write(
			root,
			"artifacts/reviews/architecture.md",
			"WROTE: artifacts/reviews/architecture.md\n",
		);
		writeManifest(root, {
			requiredReviewers: [
				{ artifact: "architecture.md", role: "architecture" },
				{ artifact: "testing.md", role: "testing" },
			],
			synthesisStatus: "complete",
		});

		const result = runValidator(root);
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(1);
		expect(report.status).toBe("partial");
		expect(report.completedRoles).toEqual(["architecture"]);
		expect(report.missingArtifacts).toEqual([
			expect.objectContaining({ role: "testing" }),
		]);
	});

	it("fails closed when an artifact carries a blocked status", () => {
		const root = makeRoot();
		write(
			root,
			"artifacts/reviews/testing.md",
			"STATUS: blocked_runtime\nExact failure text here.\n",
		);
		writeManifest(root, {
			requiredReviewers: [{ artifact: "testing.md", role: "testing" }],
			synthesisStatus: "complete",
		});

		const result = runValidator(root);
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(1);
		expect(report).toMatchObject({
			blockerClass: "blocked_reviewers",
			status: "blocked",
		});
		expect(report.blockedRoles).toEqual([
			expect.objectContaining({
				role: "testing",
				statusLine: "STATUS: blocked_runtime",
			}),
		]);
	});

	it("fails closed when an artifact carries lowercase blocked metadata", () => {
		const root = makeRoot();
		write(
			root,
			"artifacts/reviews/testing.md",
			[
				"status: blocked",
				"Validation could not run.",
				"WROTE: artifacts/reviews/testing.md",
			].join("\n"),
		);
		writeManifest(root, {
			requiredReviewers: [{ artifact: "testing.md", role: "testing" }],
			synthesisStatus: "complete",
		});

		const result = runValidator(root);
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(1);
		expect(report).toMatchObject({
			blockerClass: "blocked_reviewers",
			status: "blocked",
		});
		expect(report.blockedRoles).toEqual([
			expect.objectContaining({
				role: "testing",
				statusLine: "status: blocked",
			}),
		]);
	});

	it("fails closed when an artifact carries lowercase blocked reason metadata", () => {
		const root = makeRoot();
		write(
			root,
			"artifacts/reviews/testing.md",
			[
				"- status: blocked_validation",
				"Validation could not run.",
				"WROTE: artifacts/reviews/testing.md",
			].join("\n"),
		);
		writeManifest(root, {
			requiredReviewers: [{ artifact: "testing.md", role: "testing" }],
			synthesisStatus: "complete",
		});

		const result = runValidator(root);
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(1);
		expect(report).toMatchObject({
			blockerClass: "blocked_reviewers",
			status: "blocked",
		});
		expect(report.blockedRoles).toEqual([
			expect.objectContaining({
				role: "testing",
				statusLine: "- status: blocked_validation",
			}),
		]);
	});

	it("classifies unreadable reviewer artifacts without throwing", () => {
		const root = makeRoot();
		mkdirSync(join(root, "artifacts", "reviews", "architecture.md"), {
			recursive: true,
		});
		writeManifest(root, {
			requiredReviewers: [
				{ artifact: "architecture.md", role: "architecture" },
			],
			synthesisStatus: "complete",
		});

		const result = runValidator(root);
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(1);
		expect(report).toMatchObject({
			blockerClass: "missing_artifacts",
			status: "blocked",
		});
		expect(report.missingArtifacts).toEqual([
			expect.objectContaining({
				reason: "artifact_unreadable",
				role: "architecture",
			}),
		]);
		expect(report.missingArtifacts[0].error).toEqual(expect.any(String));
	});

	it("treats mailbox-only reviewer text as non-proof", () => {
		const root = makeRoot();
		writeManifest(root, {
			requiredReviewers: [{ mailboxOnly: true, role: "architecture" }],
			synthesisStatus: "complete",
		});

		const result = runValidator(root);
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(1);
		expect(report).toMatchObject({
			blockerClass: "mailbox_only",
			status: "blocked",
		});
		expect(report.missingArtifacts).toEqual([
			expect.objectContaining({
				reason: "mailbox_only_non_proof",
				role: "architecture",
			}),
		]);
	});

	it("does not pass when synthesis is not complete", () => {
		const root = makeRoot();
		write(
			root,
			"artifacts/reviews/architecture.md",
			"WROTE: artifacts/reviews/architecture.md\n",
		);
		writeManifest(root, {
			requiredReviewers: [
				{ artifact: "architecture.md", role: "architecture" },
			],
			synthesisStatus: "pending",
		});

		const result = runValidator(root);
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(1);
		expect(report).toMatchObject({
			blockerClass: "synthesis_incomplete",
			status: "partial",
		});
	});

	it("returns usage errors as exit code 2", () => {
		const result = spawnSync(process.execPath, [SCRIPT_PATH, "--bogus"], {
			encoding: "utf8",
		});
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(2);
		expect(report).toMatchObject({
			blockerClass: "usage",
			status: "blocked",
		});
		expect(report.usageErrors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: "usage_unknown_option" }),
			]),
		);
	});

	it("rejects flag-shaped values for path options", () => {
		const result = spawnSync(
			process.execPath,
			[
				SCRIPT_PATH,
				"--root",
				"--json",
				"--manifest",
				"reviewers.json",
				"--json",
			],
			{
				encoding: "utf8",
			},
		);
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(2);
		expect(report).toMatchObject({
			blockerClass: "usage",
			status: "blocked",
		});
		expect(report.usageErrors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "usage_missing_value",
					message: "--root requires a path value",
				}),
			]),
		);
	});

	it("rejects reviewer manifests outside the repository root", () => {
		const root = makeRoot();
		const outsideRoot = mkdtempSync(
			join(tmpdir(), "reviewer-coverage-manifest-outside-"),
		);
		roots.push(outsideRoot);
		writeFileSync(
			join(outsideRoot, "reviewers.json"),
			JSON.stringify({
				requiredReviewers: [],
				synthesisStatus: "complete",
			}),
		);

		const result = spawnSync(
			process.execPath,
			[
				SCRIPT_PATH,
				"--root",
				root,
				"--manifest",
				join(outsideRoot, "reviewers.json"),
				"--json",
			],
			{
				encoding: "utf8",
			},
		);
		const report = parseSingleJsonReport(result);

		expect(result.status).toBe(2);
		expect(report).toMatchObject({
			blockerClass: "usage",
			reason: "--manifest must resolve inside --root",
			status: "blocked",
		});
		expect(report.usageErrors).toEqual([
			expect.objectContaining({
				code: "usage_path_outside_root",
			}),
		]);
	});
});
