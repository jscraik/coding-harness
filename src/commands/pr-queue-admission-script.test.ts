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

function makeFakeGh(
	binDir: string,
	openPr: boolean,
	draft = false,
	checksFail = true,
): void {
	const ghPath = join(binDir, "gh");
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
  ${
		checksFail
			? `cat <<'JSON'
[{"name":"pr-pipeline","state":"FAILURE","bucket":"fail","link":"https://circleci.example/501"}]
JSON`
			: `cat <<'JSON'
[{"name":"pr-pipeline","state":"SUCCESS","bucket":"pass","link":"https://circleci.example/501"}]
JSON`
	}
  exit 0
fi
if [[ "$1" == "api" ]]; then
  ${
		draft
			? `cat <<'JSON'
{"data":{"repository":{"pullRequest":{"reviewThreads":{"nodes":[]}}}}}
JSON`
			: `cat <<'JSON'
{"data":{"repository":{"pullRequest":{"reviewThreads":{"nodes":[{"isResolved":false,"isOutdated":false}]}}}}}
JSON`
	}
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
});
