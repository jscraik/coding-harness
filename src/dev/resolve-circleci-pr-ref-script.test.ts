import { spawnSync } from "node:child_process";
import {
	chmodSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const TEST_FILE_DIR = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = resolve(
	TEST_FILE_DIR,
	"../../scripts/resolve-circleci-pr-ref.sh",
);

const tempRoots: string[] = [];
const scrubbedCircleCiPrEnv: NodeJS.ProcessEnv = {
	CIRCLE_BRANCH: undefined,
	CIRCLE_PROJECT_REPONAME: undefined,
	CIRCLE_PROJECT_USERNAME: undefined,
	CIRCLE_PULL_REQUEST: undefined,
	CIRCLE_PULL_REQUESTS: undefined,
	CIRCLE_REPOSITORY_URL: undefined,
	CIRCLE_SHA1: undefined,
	GH_BIN: undefined,
};

function createTempRoot() {
	const root = mkdtempSync(join(tmpdir(), "circleci-pr-ref-"));
	tempRoots.push(root);
	mkdirSync(join(root, "bin"), { recursive: true });
	return root;
}

function writeExecutable(root: string, path: string, content: string) {
	const filePath = join(root, path);
	mkdirSync(join(filePath, ".."), { recursive: true });
	writeFileSync(filePath, content);
	chmodSync(filePath, 0o755);
}

function runScript(root: string, extraEnv: NodeJS.ProcessEnv = {}) {
	return spawnSync("bash", [SCRIPT_PATH], {
		cwd: root,
		encoding: "utf8",
		timeout: 10_000,
		env: {
			...process.env,
			...scrubbedCircleCiPrEnv,
			...extraEnv,
			PATH: `${join(root, "bin")}${delimiter}${process.env.PATH ?? ""}`,
		},
	});
}

describe("resolve-circleci-pr-ref.sh", () => {
	afterEach(() => {
		for (const root of tempRoots.splice(0)) {
			rmSync(root, { force: true, recursive: true });
		}
	});

	it("uses CircleCI-provided pull request context without calling GitHub", () => {
		const root = createTempRoot();
		writeExecutable(
			root,
			"bin/gh",
			["#!/usr/bin/env bash", "exit 99"].join("\n"),
		);

		const result = runScript(root, {
			CIRCLE_PULL_REQUEST: "https://github.com/acme/demo/pull/12",
		});

		expect(result.status).toBe(0);
		expect(result.stdout).toBe("https://github.com/acme/demo/pull/12");
		expect(result.stderr).toBe("");
	});

	it("retries until GitHub exposes the PR for the CircleCI branch", () => {
		const root = createTempRoot();
		writeExecutable(
			root,
			"bin/gh",
			[
				"#!/usr/bin/env bash",
				"set -euo pipefail",
				"count_file=gh-count.txt",
				'count="$(cat "$count_file" 2>/dev/null || printf 0)"',
				"count=$(( count + 1 ))",
				'printf "%s" "$count" > "$count_file"',
				'if [[ "$1 $2" == "pr list" && "$count" -ge 3 ]]; then',
				'  printf "%s" "https://github.com/acme/demo/pull/34"',
				"fi",
			].join("\n"),
		);

		const result = runScript(root, {
			CIRCLE_BRANCH: "codex/fix-pr-race",
			CIRCLE_PROJECT_REPONAME: "demo",
			CIRCLE_PROJECT_USERNAME: "acme",
			HARNESS_CIRCLECI_PR_REF_CHECK_NAME: "pr-template",
			HARNESS_CIRCLECI_PR_REF_MAX_ATTEMPTS: "2",
			HARNESS_CIRCLECI_PR_REF_SLEEP_SECONDS: "0",
		});

		expect(result.status).toBe(0);
		expect(result.stdout).toBe("https://github.com/acme/demo/pull/34");
		expect(result.stderr).toContain(
			"PR context not available yet for pr-template; retrying (1/2).",
		);
	});

	it("normalizes GitHub repository URLs before querying PRs", () => {
		const root = createTempRoot();
		writeExecutable(
			root,
			"bin/gh",
			[
				"#!/usr/bin/env bash",
				"set -euo pipefail",
				'if [[ "$*" == *"--repo acme/demo"* ]]; then',
				'  printf "%s" "https://github.com/acme/demo/pull/56"',
				"fi",
			].join("\n"),
		);

		const result = runScript(root, {
			CIRCLE_BRANCH: "codex/url-normalizer",
			CIRCLE_REPOSITORY_URL: "git@github.com:acme/demo.git",
			HARNESS_CIRCLECI_PR_REF_MAX_ATTEMPTS: "1",
			HARNESS_CIRCLECI_PR_REF_SLEEP_SECONDS: "0",
		});

		expect(result.status).toBe(0);
		expect(result.stdout).toBe("https://github.com/acme/demo/pull/56");
		expect(result.stderr).toBe("");
	});

	it("does not accept closed pull requests from commit lookup fallback", () => {
		const root = createTempRoot();
		writeExecutable(
			root,
			"bin/gh",
			[
				"#!/usr/bin/env bash",
				"set -euo pipefail",
				'if [[ "$1" == "api" ]]; then',
				'  for arg in "$@"; do',
				'    if [[ "$arg" == *"// .[0].html_url"* ]]; then',
				'      printf "%s" "https://github.com/acme/demo/pull/13"',
				"    fi",
				"  done",
				"fi",
			].join("\n"),
		);

		const result = runScript(root, {
			CIRCLE_BRANCH: "codex/stale-commit",
			CIRCLE_PROJECT_REPONAME: "demo",
			CIRCLE_PROJECT_USERNAME: "acme",
			CIRCLE_SHA1: "abc123",
			HARNESS_CIRCLECI_PR_REF_MAX_ATTEMPTS: "1",
			HARNESS_CIRCLECI_PR_REF_SLEEP_SECONDS: "0",
		});

		expect(result.status).toBe(1);
		expect(result.stdout).toBe("");
		expect(result.stderr).toContain("unable to resolve pull request context");
	});

	it("falls back to public PR lookup when GitHub emits a JSON auth error", () => {
		const root = createTempRoot();
		writeExecutable(
			root,
			"bin/gh",
			[
				"#!/usr/bin/env bash",
				"set -euo pipefail",
				'if [[ "$1" == "api" ]]; then',
				'  printf "%s" \'{"message":"Bad credentials","status":"401"}\'',
				"fi",
			].join("\n"),
		);
		writeExecutable(
			root,
			"bin/curl",
			[
				"#!/usr/bin/env bash",
				"set -euo pipefail",
				'if [[ "$*" != *"/repos/acme/demo/pulls?state=open&head=acme:codex/bad-token"* ]]; then',
				'  echo "unexpected curl args: $*" >&2',
				"  exit 8",
				"fi",
				'printf "%s" \'[{"html_url":"https://github.com/acme/demo/pull/78"}]\'',
			].join("\n"),
		);

		const result = runScript(root, {
			CIRCLE_BRANCH: "codex/bad-token",
			CIRCLE_PROJECT_REPONAME: "demo",
			CIRCLE_PROJECT_USERNAME: "acme",
			CIRCLE_SHA1: "abc123",
			HARNESS_CIRCLECI_PR_REF_MAX_ATTEMPTS: "1",
			HARNESS_CIRCLECI_PR_REF_SLEEP_SECONDS: "0",
		});

		expect(result.status).toBe(0);
		expect(result.stdout).toBe("https://github.com/acme/demo/pull/78");
		expect(result.stderr).toBe("");
	});

	it("fails closed with a branch-only diagnostic when no PR can be resolved", () => {
		const root = createTempRoot();
		writeExecutable(
			root,
			"bin/gh",
			["#!/usr/bin/env bash", "exit 0"].join("\n"),
		);

		const result = runScript(root, {
			CIRCLE_BRANCH: "main",
			CIRCLE_PROJECT_REPONAME: "demo",
			CIRCLE_PROJECT_USERNAME: "acme",
			HARNESS_CIRCLECI_PR_REF_CHECK_NAME: "linear-gate",
			HARNESS_CIRCLECI_PR_REF_MAX_ATTEMPTS: "1",
			HARNESS_CIRCLECI_PR_REF_SLEEP_SECONDS: "0",
		});

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"unable to resolve pull request context for linear-gate",
		);
		expect(result.stderr).toContain("branch-only pipelines");
	});
});
