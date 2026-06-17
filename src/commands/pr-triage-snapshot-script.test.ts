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
const scriptPath = join(repoRoot, "scripts/pr-triage-snapshot.sh");

function makeFakeGh(binDir: string): void {
	const ghPath = join(binDir, "gh");
	writeFileSync(
		ghPath,
		`#!/usr/bin/env bash
set -euo pipefail

if [[ "$1 $2" == "repo view" ]]; then
  printf '%s\\n' "jscraik/coding-harness"
  exit 0
fi

if [[ "$1 $2" == "pr view" ]]; then
  cat <<'JSON'
{"number":428,"title":"fix: improve PR throughput flow","url":"https://github.com/jscraik/coding-harness/pull/428","headRefName":"codex/improve-pr-throughput-flow","headRefOid":"abc123","baseRefName":"main","state":"OPEN","isDraft":false,"mergeable":"MERGEABLE","mergeStateStatus":"CLEAN","reviewDecision":""}
JSON
  exit 0
fi

if [[ "$1 $2" == "pr checks" ]]; then
  cat <<'JSON'
[{"name":"ci/circleci: test","state":"SUCCESS","bucket":"pass","link":"https://circleci.example/test"}]
JSON
  exit 0
fi

if [[ "$1" == "api" ]]; then
  shift
  endpoint=""
  for arg in "$@"; do
    if [[ "$arg" != -* ]]; then
      endpoint="$arg"
      break
    fi
  done
  if [[ " $* " != *" --paginate "* || " $* " != *" --slurp "* ]]; then
    echo "expected gh api pagination reads to pass --paginate --slurp" >&2
    exit 42
  fi
  case "$endpoint" in
    repos/jscraik/coding-harness/pulls/428/comments)
      cat <<'JSON'
[[{"id":1,"path":"scripts/pr-triage-snapshot.sh","line":67,"original_line":67,"position":1,"user":{"login":"reviewer"},"body":"first page","created_at":"2026-06-17T00:00:00Z","updated_at":"2026-06-17T00:00:00Z"}],[{"id":2,"path":"scripts/pr-triage-snapshot.sh","line":68,"original_line":68,"position":2,"user":{"login":"reviewer"},"body":"second page","created_at":"2026-06-17T00:01:00Z","updated_at":"2026-06-17T00:01:00Z"}]]
JSON
      exit 0
      ;;
    repos/jscraik/coding-harness/pulls/428/reviews)
      cat <<'JSON'
[[{"id":10,"state":"COMMENTED","user":{"login":"reviewer"},"submitted_at":"2026-06-17T00:02:00Z","body":"first review page"}],[{"id":11,"state":"APPROVED","user":{"login":"maintainer"},"submitted_at":"2026-06-17T00:03:00Z","body":"second review page"}]]
JSON
      exit 0
      ;;
  esac
fi

echo "unexpected gh call: $*" >&2
exit 1
		`,
	);
	chmodSync(ghPath, 0o755);
}

describe("pr-triage-snapshot.sh", () => {
	it("slurps and flattens paginated PR comments and reviews", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "pr-triage-snapshot-"));
		try {
			const binDir = join(tempDir, "bin");
			mkdirSync(binDir);
			makeFakeGh(binDir);

			const result = spawnSync("bash", [scriptPath, "428"], {
				cwd: repoRoot,
				encoding: "utf-8",
				env: {
					...process.env,
					PATH: `${binDir}:${process.env.PATH ?? ""}`,
				},
			});

			expect(result.stderr).toBe("");
			expect(result.status).toBe(0);
			const snapshot = JSON.parse(result.stdout) as {
				reviewComments: Array<{ id: number; body: string }>;
				openReviewThreads: Array<{ id: number; body: string }>;
				reviews: Array<{ id: number; state: string }>;
				nextAction: string;
			};
			expect(snapshot.reviewComments).toEqual([
				expect.objectContaining({ id: 1, body: "first page" }),
				expect.objectContaining({ id: 2, body: "second page" }),
			]);
			expect(snapshot.openReviewThreads).toEqual([
				expect.objectContaining({ id: 1, body: "first page" }),
				expect.objectContaining({ id: 2, body: "second page" }),
			]);
			expect(snapshot.reviews).toEqual([
				expect.objectContaining({ id: 10, state: "COMMENTED" }),
				expect.objectContaining({ id: 11, state: "APPROVED" }),
			]);
			expect(snapshot.nextAction).toBe("ready_for_owner_merge_review");
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	it("accepts the documented package-manager argument separator form", () => {
		const tempDir = mkdtempSync(join(tmpdir(), "pr-triage-snapshot-"));
		try {
			const binDir = join(tempDir, "bin");
			mkdirSync(binDir);
			makeFakeGh(binDir);

			const result = spawnSync("bash", [scriptPath, "--", "428"], {
				cwd: repoRoot,
				encoding: "utf-8",
				env: {
					...process.env,
					PATH: `${binDir}:${process.env.PATH ?? ""}`,
				},
			});

			expect(result.stderr).toBe("");
			expect(result.status).toBe(0);
			const snapshot = JSON.parse(result.stdout) as {
				pr: { number: number };
				nextAction: string;
			};
			expect(snapshot.pr.number).toBe(428);
			expect(snapshot.nextAction).toBe("ready_for_owner_merge_review");
		} finally {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});
});
