import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateEvidenceReceipt } from "../evidence/evidence-receipt.js";
import {
	classifyGitTrackedRoot,
	classifyRootSurface,
	isVerifierOwnedRootHygieneReport,
} from "./classifier.js";
import { rootHygieneGitEnv } from "./git-env.js";
import {
	readGitTrackedPathEntries,
	readGitTrackedPaths,
} from "./git-tracked-paths.js";
import { rootHygieneRepositoryTopLevel } from "./index.js";
import { completeRootHygieneInventory } from "./inventory.js";
import {
	ROOT_SURFACE_POLICY_SOURCE_REF,
	policyRootSurfaceEntries,
} from "./policy.js";
import { rootSurfaceEntriesFromTrackedPaths } from "./tracked-paths.js";
import {
	type ClassifiedRootHygieneEntry,
	ROOT_HYGIENE_CLASSIFICATION_SCHEMA_VERSION,
	ROOT_HYGIENE_RECEIPT_PRODUCER,
} from "./types.js";
import { rootHygieneReceiptRef } from "./receipt.js";

const GENERATED_AT = "2026-05-25T20:45:00Z";
const HEAD_SHA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("root-hygiene classification", () => {
	it("classifies documented policy entries as claim-support evidence", () => {
		const repoRoot = makeGitRepo(trackedPathsForPolicyEntries());
		const report = classifyGitTrackedRoot({
			repoRoot,
			generatedAt: GENERATED_AT,
			headSha: HEAD_SHA,
		});
		rmSync(repoRoot, { force: true, recursive: true });

		expect(report).toMatchObject({
			schemaVersion: ROOT_HYGIENE_CLASSIFICATION_SCHEMA_VERSION,
			sourceRef: ROOT_SURFACE_POLICY_SOURCE_REF,
			status: "pass",
			summary: {
				blocking: 0,
				legacyDrift: 0,
				unclassified: 0,
			},
			coverage: {
				completeness: "complete",
				source: "git_tracked_paths",
				valid: true,
			},
			receipt: {
				ref: rootHygieneReceiptRef(),
				producer: ROOT_HYGIENE_RECEIPT_PRODUCER,
				status: "pass",
				freshness: "current",
				evidenceUse: "claim_support",
				checksum: report.coverage.digest,
				headSha: HEAD_SHA,
			},
		});
		expect(validateEvidenceReceipt(report.receipt)).toEqual({
			valid: true,
			errors: [],
		});
	});

	it("freezes verifier-produced reports before they can support claims", () => {
		const repoRoot = makeGitRepo(trackedPathsForPolicyEntries());
		const report = classifyGitTrackedRoot({
			repoRoot,
			generatedAt: GENERATED_AT,
			headSha: HEAD_SHA,
		});
		rmSync(repoRoot, { force: true, recursive: true });

		expect(Object.isFrozen(report)).toBe(true);
		expect(Object.isFrozen(report.entries)).toBe(true);
		expect(Object.isFrozen(report.summary)).toBe(true);
		expect(Object.isFrozen(report.coverage)).toBe(true);
		expect(Object.isFrozen(report.repository)).toBe(true);
		expect(Object.isFrozen(report.receipt)).toBe(true);
		expect(isVerifierOwnedRootHygieneReport(report)).toBe(true);
		expect(() => {
			(report.summary as { total: number }).total = 0;
		}).toThrow(TypeError);
		expect(() => {
			(report.repository as { digest: string }).digest = "b".repeat(64);
		}).toThrow(TypeError);
		expect(() => {
			(report.entries as ClassifiedRootHygieneEntry[]).push({
				path: "forged.md",
				kind: "file",
				classification: "canonical_root",
				reason: "attempted mutation after verifier classification",
				blocking: false,
			});
		}).toThrow(TypeError);
	});

	it("does not mark caller-supplied reports as verifier-owned", () => {
		const entries = policyRootSurfaceEntries();
		const report = classifyRootSurface({
			entries,
			generatedAt: GENERATED_AT,
			inventory: completeRootHygieneInventory(entries, "git_tracked_paths"),
		});

		expect(Object.isFrozen(report)).toBe(true);
		expect(isVerifierOwnedRootHygieneReport(report)).toBe(false);
	});

	it("records explicitly deferred should-move entries without blocking", () => {
		const repoRoot = makeGitRepo(trackedPathsForPolicyEntries());
		const report = classifyGitTrackedRoot({
			repoRoot,
			generatedAt: GENERATED_AT,
		});
		rmSync(repoRoot, { force: true, recursive: true });
		const deferredPaths = report.deferredEntries.map((entry) => entry.path);

		expect(deferredPaths).toEqual(["FORJAMIE.md", "instructions"]);
		expect(report.deferredEntries.every((entry) => !entry.blocking)).toBe(true);
		expect(report.summary.shouldMove).toBe(2);
		expect(report.status).toBe("pass");
	});

	it("fails closed for unclassified root entries", () => {
		const repoRoot = makeGitRepo([
			...trackedPathsForPolicyEntries(),
			"scratch-report.md",
		]);
		const report = classifyGitTrackedRoot({
			repoRoot,
			generatedAt: GENERATED_AT,
		});
		rmSync(repoRoot, { force: true, recursive: true });

		expect(report.status).toBe("fail");
		expect(report.receipt).toMatchObject({
			status: "fail",
			blockerClass: "root_surface_drift",
		});
		expect(report.blockers).toEqual([
			expect.objectContaining({
				path: "scratch-report.md",
				classification: "unclassified",
				blocking: true,
			}),
		]);
	});

	it("fails closed when the supplied root inventory is not tracked-root evidence", () => {
		const entries = policyRootSurfaceEntries();
		const report = classifyRootSurface({
			entries,
			generatedAt: GENERATED_AT,
			inventory: completeRootHygieneInventory(entries, "policy_fixture"),
		});

		expect(report.status).toBe("fail");
		expect(report.coverage).toMatchObject({
			source: "policy_fixture",
			completeness: "complete",
			valid: false,
		});
		expect(report.receipt).toMatchObject({
			status: "fail",
			blockerClass: "root_surface_drift",
		});
	});

	it("fails closed when policy entries are caller-labeled as tracked evidence", () => {
		const entries = policyRootSurfaceEntries();
		const report = classifyRootSurface({
			entries,
			generatedAt: GENERATED_AT,
			inventory: completeRootHygieneInventory(entries, "git_tracked_paths"),
		});

		expect(report.status).toBe("fail");
		expect(report.coverage).toMatchObject({
			source: "git_tracked_paths",
			completeness: "complete",
			valid: false,
		});
		expect(report.receipt).toMatchObject({
			status: "fail",
			blockerClass: "root_surface_drift",
		});
	});

	it("classifies the live git index instead of arbitrary filesystem paths", () => {
		const repoRoot = makeGitRepo(trackedPathsForPolicyEntries());
		try {
			writeFileSync(join(repoRoot, "UNTRACKED.md"), "not tracked\n");
			const beforeAdd = classifyGitTrackedRoot({
				repoRoot,
				generatedAt: GENERATED_AT,
				headSha: HEAD_SHA,
			});
			expect(beforeAdd.status).toBe("pass");
			expect(
				beforeAdd.entries.some((entry) => entry.path === "UNTRACKED.md"),
			).toBe(false);

			execFileSync("git", ["add", "UNTRACKED.md"], {
				cwd: repoRoot,
				env: rootHygieneGitEnv(),
				stdio: "ignore",
			});
			const afterAdd = classifyGitTrackedRoot({
				repoRoot,
				generatedAt: GENERATED_AT,
				headSha: HEAD_SHA,
			});
			expect(afterAdd.status).toBe("fail");
			expect(afterAdd.blockers.map((entry) => entry.path)).toContain(
				"UNTRACKED.md",
			);
		} finally {
			rmSync(repoRoot, { force: true, recursive: true });
		}
	});

	it("uses the same repository identity and root inventory from nested paths", () => {
		const repoRoot = makeGitRepo(trackedPathsForPolicyEntries());
		try {
			const nestedPath = join(repoRoot, "src", "lib");
			mkdirSync(nestedPath, { recursive: true });

			const fromRoot = classifyGitTrackedRoot({
				repoRoot,
				generatedAt: GENERATED_AT,
				headSha: HEAD_SHA,
			});
			const fromNestedPath = classifyGitTrackedRoot({
				repoRoot: nestedPath,
				generatedAt: GENERATED_AT,
				headSha: HEAD_SHA,
			});

			expect(fromNestedPath.status).toBe("pass");
			expect(fromNestedPath.repository).toEqual(fromRoot.repository);
			expect(fromNestedPath.coverage.digest).toBe(fromRoot.coverage.digest);
			expect(fromNestedPath.entries).toEqual(fromRoot.entries);
		} finally {
			rmSync(repoRoot, { force: true, recursive: true });
		}
	});

	it("throws contextual errors when git root resolution fails", () => {
		const missingRepo = mkdtempSync(join(tmpdir(), "root-hygiene-missing-repo-"));
		rmSync(missingRepo, { force: true, recursive: true });

		expect(() => rootHygieneRepositoryTopLevel(missingRepo)).toThrow(
			/Failed to resolve root-hygiene git toplevel/,
		);
		expect(() => readGitTrackedPaths(missingRepo)).toThrow(
			/Failed to read git tracked paths/,
		);
		expect(() =>
			classifyGitTrackedRoot({
				repoRoot: missingRepo,
				generatedAt: GENERATED_AT,
			}),
		).toThrow(/Failed to classify git-tracked root/);
	});

	it("lets callers raise the git tracked-path buffer for large repositories", () => {
		const repoRoot = makeGitRepo(trackedPathsForPolicyEntries());
		try {
			expect(() =>
				readGitTrackedPaths(repoRoot, { maxBufferBytes: 1 }),
			).toThrow(/Failed to read git tracked paths/);
			expect(
				readGitTrackedPaths(repoRoot, { maxBufferBytes: 10 * 1024 * 1024 }),
			).toEqual(expect.arrayContaining(trackedPathsForPolicyEntries()));
		} finally {
			rmSync(repoRoot, { force: true, recursive: true });
		}
	});

	it("fails closed when the supplied root inventory is not complete", () => {
		const entries = [{ path: "README.md", kind: "file" as const }];
		const completeInventory = completeRootHygieneInventory(
			entries,
			"test_fixture",
		);
		const report = classifyRootSurface({
			entries,
			generatedAt: GENERATED_AT,
			inventory: {
				...completeInventory,
				completeness: "partial",
			},
		});

		expect(report.status).toBe("fail");
		expect(report.coverage).toMatchObject({
			completeness: "partial",
			valid: false,
		});
		expect(report.receipt).toMatchObject({
			status: "fail",
			blockerClass: "root_surface_drift",
			checksum: completeInventory.digest,
		});
	});

	it("fails closed when inventory digest does not match classified entries", () => {
		const entries = policyRootSurfaceEntries();
		const staleInventory = completeRootHygieneInventory(
			entries.map((entry) =>
				entry.path === "README.md"
					? { ...entry, path: "stale-readme.md" }
					: entry,
			),
			"git_tracked_paths",
		);
		const report = classifyRootSurface({
			entries,
			generatedAt: GENERATED_AT,
			inventory: staleInventory,
		});

		expect(report.status).toBe("fail");
		expect(report.coverage).toMatchObject({
			source: "git_tracked_paths",
			completeness: "complete",
			entryCount: entries.length,
			valid: false,
		});
		expect(report.coverage.digest).not.toBe(staleInventory.digest);
		expect(report.receipt).toMatchObject({
			status: "fail",
			blockerClass: "root_surface_drift",
			checksum: report.coverage.digest,
		});
	});

	it("projects tracked file paths into unique root-surface entries", () => {
		expect(
			rootSurfaceEntriesFromTrackedPaths([
				"README.md",
				"./src/lib/root-hygiene/classifier.ts",
				"src/lib/root-hygiene/policy.ts",
				"docs/architecture/root-surface-classification.md",
				"docs/",
			]),
		).toEqual([
			{ path: "docs", kind: "directory" },
			{ path: "README.md", kind: "file" },
			{ path: "src", kind: "directory" },
		]);
	});

	it("projects root-level gitlinks as directory entries", () => {
		expect(
			rootSurfaceEntriesFromTrackedPaths([
				{ mode: "160000", path: "vendor" },
				"README.md",
			]),
		).toEqual([
			{ path: "README.md", kind: "file" },
			{ path: "vendor", kind: "directory" },
		]);
	});

	it("preserves git index mode metadata for tracked path projection", () => {
		const repoRoot = makeGitRepo(["README.md"]);
		try {
			execFileSync(
				"git",
				[
					"update-index",
					"--add",
					"--cacheinfo",
					"160000,aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa,vendor",
				],
				{
					cwd: repoRoot,
					env: rootHygieneGitEnv(),
					stdio: "ignore",
				},
			);

			expect(readGitTrackedPathEntries(repoRoot)).toEqual(
				expect.arrayContaining([{ mode: "160000", path: "vendor" }]),
			);
			expect(
				rootSurfaceEntriesFromTrackedPaths(readGitTrackedPathEntries(repoRoot)),
			).toEqual(
				expect.arrayContaining([{ path: "vendor", kind: "directory" }]),
			);
			expect(readGitTrackedPaths(repoRoot)).toEqual(
				expect.arrayContaining(["vendor"]),
			);
		} finally {
			rmSync(repoRoot, { force: true, recursive: true });
		}
	});
});

function trackedPathsForPolicyEntries(): string[] {
	return policyRootSurfaceEntries().map((entry) =>
		entry.kind === "directory"
			? `${entry.path}/.tracked-root-placeholder`
			: entry.path,
	);
}

function makeGitRepo(trackedPaths: readonly string[]): string {
	const repoRoot = mkdtempSync(join(tmpdir(), "root-hygiene-"));
	execFileSync("git", ["init"], {
		cwd: repoRoot,
		env: rootHygieneGitEnv(),
		stdio: "ignore",
	});
	for (const trackedPath of trackedPaths) {
		const absolutePath = join(repoRoot, trackedPath);
		mkdirSync(dirname(absolutePath), { recursive: true });
		writeFileSync(absolutePath, "tracked\n");
	}
	execFileSync("git", ["add", "-A"], {
		cwd: repoRoot,
		env: rootHygieneGitEnv(),
		stdio: "ignore",
	});
	return repoRoot;
}
