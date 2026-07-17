import { spawnSync } from "node:child_process";
import {
	chmodSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(import.meta.dirname, "../..");
const scriptPath = join(repoRoot, "scripts/pr-queue-admission.sh");
type ReviewMode = "missing" | "rate_limited" | "substantive";

function makeFakeGh(
	binDir: string,
	openPr: boolean,
	draft = false,
	checksFail = true,
	reviewMode: ReviewMode = "missing",
	unresolvedThread = !draft,
	reviewDecision = "",
	checksExitNonzero = false,
): void {
	const ghPath = join(binDir, "gh");
	const prNodes = openPr
		? JSON.stringify([
				{
					number: 501,
					title: "follow-up",
					url: "https://github.com/jscraik/coding-harness/pull/501",
					headRefName: "codex/follow-up",
					headRefOid: "abc123",
					baseRefName: "main",
					state: "OPEN",
					isDraft: draft,
					mergeable: "MERGEABLE",
					mergeStateStatus: "CLEAN",
					reviewDecision,
					updatedAt: "2026-07-17T00:00:00Z",
				},
			])
		: "[]";
	const reviewThreads = unresolvedThread
		? '[{"isResolved":false,"isOutdated":false}]'
		: "[]";
	const reviewComments =
		reviewMode === "rate_limited"
			? '[{"author":{"login":"coderabbitai"},"body":"Review limit reached under provider rate limits","createdAt":"2026-07-17T20:00:00Z","url":"https://circleci.example/rate-limit"}]'
			: reviewMode === "substantive"
				? '[{"author":{"login":"coderabbitai"},"body":"## Summary\\nNo actionable findings.","createdAt":"2026-07-17T20:00:00Z","url":"https://circleci.example/review"}]'
				: "[]";
	const checks = checksFail
		? '[{"name":"pr-pipeline","state":"FAILURE","bucket":"fail","link":"https://circleci.example/501"}]'
		: '[{"name":"pr-pipeline","state":"SUCCESS","bucket":"pass","link":"https://circleci.example/501"}]';
	writeFileSync(
		ghPath,
		`#!/usr/bin/env bash
set -euo pipefail
if [[ "$1 $2" == "repo view" ]]; then
  printf '%s\\n' "jscraik/coding-harness"
  exit 0
fi
if [[ "$1 $2" == "pr list" ]]; then
  ${
		openPr
			? `cat <<'JSON'
[{"number":501,"title":"follow-up","url":"https://github.com/jscraik/coding-harness/pull/501","headRefName":"codex/follow-up","headRefOid":"abc123","baseRefName":"main","state":"OPEN","isDraft":${draft},"mergeable":"MERGEABLE","mergeStateStatus":"CLEAN","reviewDecision":"","updatedAt":"2026-07-17T00:00:00Z"}]
JSON`
			: `printf '%s\\n' '[]'`
	}
  exit 0
fi
if [[ "$1 $2" == "pr checks" ]]; then
  printf '%s\\n' '${checks}'
  ${checksExitNonzero ? "exit 1" : ""}
  exit 0
fi
if [[ "$1" == "api" && "$2" == "graphql" ]]; then
  if [[ "$*" == *"pullRequests"* ]]; then
    printf '%s\\n' '[{"data":{"repository":{"pullRequests":{"nodes":${prNodes},"pageInfo":{"hasNextPage":false,"endCursor":null}}}}}]'
    exit 0
  fi
fi
if [[ "$1" == "api" ]]; then
  printf '%s\\n' '[{"data":{"repository":{"pullRequest":{"reviewThreads":{"nodes":${reviewThreads},"pageInfo":{"hasNextPage":false,"endCursor":null}},"comments":{"nodes":${reviewComments}},"reviews":{"nodes":[]}}}}}]'
  exit 0
fi
echo "unexpected gh call: $*" >&2
exit 1
`,
	);
	chmodSync(ghPath, 0o755);
}

describe("pr-queue-admission.sh", () => {
	it("reports an empty queue as a clean admission surface", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "pr-queue-admission-"));
		try {
			const binDir = join(tempDir, "bin");
			mkdirSync(binDir);
			makeFakeGh(binDir, false);
			const result = spawnSync(
				"bash",
				[scriptPath, "--", "--json", "--require-ready"],
				{
					cwd: repoRoot,
					encoding: "utf-8",
					env: { ...process.env, PATH: `${binDir}:${process.env.PATH ?? ""}` },
				},
			);
			expect(result.status).toBe(0);
			expect(JSON.parse(result.stdout)).toMatchObject({
				overall: "empty",
				prCount: 0,
			});
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("classifies checks, review threads, and merge state before mutation", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "pr-queue-admission-"));
		try {
			const binDir = join(tempDir, "bin");
			mkdirSync(binDir);
			makeFakeGh(binDir, true);
			const result = spawnSync(
				"bash",
				[scriptPath, "--json", "--require-ready"],
				{
					cwd: repoRoot,
					encoding: "utf-8",
					env: { ...process.env, PATH: `${binDir}:${process.env.PATH ?? ""}` },
				},
			);
			expect(result.status).toBe(1);
			const report = JSON.parse(result.stdout) as {
				overall: string;
				prs: Array<{ nextAction: string; checks: { failureCount: number } }>;
			};
			expect(report.overall).toBe("blocked");
			expect(report.prs[0]).toMatchObject({
				nextAction: "fix_failing_checks_first",
				checks: { failureCount: 1 },
			});
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("keeps a clean draft blocked until ready authorization", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "pr-queue-admission-"));
		try {
			const binDir = join(tempDir, "bin");
			mkdirSync(binDir);
			makeFakeGh(binDir, true, true, false);
			const result = spawnSync(
				"bash",
				[scriptPath, "--json", "--require-ready"],
				{
					cwd: repoRoot,
					encoding: "utf-8",
					env: { ...process.env, PATH: `${binDir}:${process.env.PATH ?? ""}` },
				},
			);
			expect(result.status).toBe(1);
			expect(JSON.parse(result.stdout)).toMatchObject({
				overall: "blocked",
				prs: [{ nextAction: "await_ready_authorization" }],
			});
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("keeps the default path permissive while exposing a rate-limited provider", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "pr-queue-admission-"));
		try {
			const binDir = join(tempDir, "bin");
			mkdirSync(binDir);
			makeFakeGh(binDir, true, false, false, "rate_limited", false);
			const result = spawnSync(
				"bash",
				[scriptPath, "--json", "--require-ready"],
				{
					cwd: repoRoot,
					encoding: "utf-8",
					env: { ...process.env, PATH: `${binDir}:${process.env.PATH ?? ""}` },
				},
			);
			expect(result.status).toBe(0);
			expect(JSON.parse(result.stdout)).toMatchObject({
				overall: "ready",
				prs: [
					{
						nextAction: "ready_for_owner_merge_review",
						reviewArtifacts: {
							status: "rate_limited",
							coderabbit: "rate_limited",
							substantiveCount: 0,
						},
					},
				],
			});
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("blocks an opt-in requirement when review evidence is missing", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "pr-queue-admission-"));
		try {
			const binDir = join(tempDir, "bin");
			mkdirSync(binDir);
			makeFakeGh(binDir, true, false, false, "missing", false);
			const result = spawnSync(
				"bash",
				[scriptPath, "--json", "--require-ready", "--require-review-artifact"],
				{
					cwd: repoRoot,
					encoding: "utf-8",
					env: { ...process.env, PATH: `${binDir}:${process.env.PATH ?? ""}` },
				},
			);
			expect(result.status).toBe(1);
			expect(JSON.parse(result.stdout)).toMatchObject({
				overall: "blocked",
				prs: [{ nextAction: "obtain_review_artifact" }],
			});
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("accepts substantive provider evidence under the opt-in requirement", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "pr-queue-admission-"));
		try {
			const binDir = join(tempDir, "bin");
			mkdirSync(binDir);
			makeFakeGh(binDir, true, false, false, "substantive", false);
			const result = spawnSync(
				"bash",
				[scriptPath, "--json", "--require-ready", "--require-review-artifact"],
				{
					cwd: repoRoot,
					encoding: "utf-8",
					env: { ...process.env, PATH: `${binDir}:${process.env.PATH ?? ""}` },
				},
			);
			expect(result.status).toBe(0);
			expect(JSON.parse(result.stdout)).toMatchObject({
				overall: "ready",
				prs: [
					{
						nextAction: "ready_for_owner_merge_review",
						reviewArtifacts: {
							status: "observed",
							coderabbit: "substantive",
							substantiveCount: 1,
						},
					},
				],
			});
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("blocks a required-review decision before declaring queue readiness", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "pr-queue-admission-"));
		try {
			const binDir = join(tempDir, "bin");
			mkdirSync(binDir);
			makeFakeGh(
				binDir,
				true,
				false,
				false,
				"substantive",
				false,
				"REVIEW_REQUIRED",
			);
			const result = spawnSync(
				"bash",
				[scriptPath, "--json", "--require-ready", "--require-review-artifact"],
				{
					cwd: repoRoot,
					encoding: "utf-8",
					env: { ...process.env, PATH: `${binDir}:${process.env.PATH ?? ""}` },
				},
			);
			expect(result.status).toBe(1);
			expect(JSON.parse(result.stdout)).toMatchObject({
				overall: "blocked",
				prs: [{ nextAction: "obtain_required_review" }],
			});
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("uses valid check rows even when gh reports a nonzero status", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "pr-queue-admission-"));
		try {
			const binDir = join(tempDir, "bin");
			mkdirSync(binDir);
			makeFakeGh(binDir, true, false, false, "substantive", false, "", true);
			const result = spawnSync(
				"bash",
				[scriptPath, "--json", "--require-ready"],
				{
					cwd: repoRoot,
					encoding: "utf-8",
					env: { ...process.env, PATH: `${binDir}:${process.env.PATH ?? ""}` },
				},
			);
			expect(result.status).toBe(0);
			expect(JSON.parse(result.stdout)).toMatchObject({
				overall: "ready",
				prs: [
					{
						checks: { status: "observed", error: null },
						nextAction: "ready_for_owner_merge_review",
					},
				],
			});
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});
});
