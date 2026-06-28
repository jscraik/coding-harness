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
	"../../scripts/read-circleci-pr-metadata.sh",
);

const tempRoots: string[] = [];
const scrubbedCircleCiPrEnv: NodeJS.ProcessEnv = {
	CIRCLE_PROJECT_REPONAME: undefined,
	CIRCLE_PROJECT_USERNAME: undefined,
	CIRCLE_REPOSITORY_URL: undefined,
	GH_BIN: undefined,
	GH_TOKEN: undefined,
	GITHUB_PERSONAL_ACCESS_TOKEN: undefined,
	GITHUB_TOKEN: undefined,
};

function createTempRoot() {
	const root = mkdtempSync(join(tmpdir(), "circleci-pr-metadata-"));
	tempRoots.push(root);
	mkdirSync(join(root, "bin"), { recursive: true });
	return root;
}

function writeExecutable(root: string, path: string, content: string) {
	const filePath = join(root, path);
	mkdirSync(dirname(filePath), { recursive: true });
	writeFileSync(filePath, content);
	chmodSync(filePath, 0o755);
}

function runScript(
	root: string,
	args: readonly string[],
	extraEnv: NodeJS.ProcessEnv = {},
) {
	return spawnSync("bash", [SCRIPT_PATH, ...args], {
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

describe("read-circleci-pr-metadata.sh", () => {
	afterEach(() => {
		for (const root of tempRoots.splice(0)) {
			rmSync(root, { force: true, recursive: true });
		}
	});

	it("uses GitHub CLI metadata when gh succeeds", () => {
		const root = createTempRoot();
		writeExecutable(
			root,
			"bin/gh",
			[
				"#!/usr/bin/env bash",
				"set -euo pipefail",
				'if [[ "$1 $2" != "pr view" ]]; then',
				"  exit 9",
				"fi",
				'printf "%s" \'{"body":"from gh","title":"GH title","headRefName":"codex/gh"}\'',
			].join("\n"),
		);

		const result = runScript(root, ["https://github.com/acme/demo/pull/12"]);

		expect(result.status).toBe(0);
		expect(JSON.parse(result.stdout)).toEqual({
			body: "from gh",
			headRefName: "codex/gh",
			title: "GH title",
		});
		expect(result.stderr).toBe("");
	});

	it("falls back to public REST metadata when gh reports bad credentials", () => {
		const root = createTempRoot();
		writeExecutable(
			root,
			"bin/gh",
			[
				"#!/usr/bin/env bash",
				'echo "HTTP 401: Bad credentials" >&2',
				"exit 1",
			].join("\n"),
		);
		writeExecutable(
			root,
			"bin/curl",
			[
				"#!/usr/bin/env bash",
				"set -euo pipefail",
				'if [[ "$*" != *"https://api.github.com/repos/acme/demo/pulls/34"* ]]; then',
				'  echo "unexpected curl args: $*" >&2',
				"  exit 8",
				"fi",
				'printf "%s" \'{"body":"from rest","title":"REST title","head":{"ref":"codex/rest"}}\'',
			].join("\n"),
		);

		const result = runScript(root, ["https://github.com/acme/demo/pull/34"]);

		expect(result.status).toBe(0);
		expect(JSON.parse(result.stdout)).toEqual({
			body: "from rest",
			headRefName: "codex/rest",
			title: "REST title",
		});
		expect(result.stderr).toContain(
			"falling back to public GitHub REST pull endpoint",
		);
	});

	it("uses CircleCI owner and repo for a bare PR number fallback", () => {
		const root = createTempRoot();
		writeExecutable(
			root,
			"bin/curl",
			[
				"#!/usr/bin/env bash",
				"set -euo pipefail",
				'if [[ "$*" != *"https://api.github.com/repos/acme/demo/pulls/56"* ]]; then',
				'  echo "unexpected curl args: $*" >&2',
				"  exit 8",
				"fi",
				'printf "%s" \'{"body":null,"title":"Bare PR","head":{"ref":"codex/bare"}}\'',
			].join("\n"),
		);

		const result = runScript(root, ["56"], {
			CIRCLE_PROJECT_REPONAME: "demo",
			CIRCLE_PROJECT_USERNAME: "acme",
			GH_BIN: "missing-gh",
		});

		expect(result.status).toBe(0);
		expect(JSON.parse(result.stdout)).toEqual({
			body: "",
			headRefName: "codex/bare",
			title: "Bare PR",
		});
		expect(result.stderr).toContain(
			"falling back to public GitHub REST pull endpoint",
		);
	});

	it("fails closed when a PR number cannot be derived", () => {
		const root = createTempRoot();

		const result = runScript(root, ["not-a-pr-ref"], {
			CIRCLE_PROJECT_REPONAME: "demo",
			CIRCLE_PROJECT_USERNAME: "acme",
			GH_BIN: "missing-gh",
		});

		expect(result.status).toBe(1);
		expect(result.stdout).toBe("");
		expect(result.stderr).toContain(
			"unable to derive pull request number from 'not-a-pr-ref'",
		);
	});
});
