import { spawnSync } from "node:child_process";
import {
	chmodSync,
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT_PATH = join(process.cwd(), "scripts/validate-codestyle.sh");

const tempRoots: string[] = [];

function createTempRoot(packageName: string, scripts: Record<string, string>) {
	const root = mkdtempSync(join(tmpdir(), "validate-codestyle-"));
	tempRoots.push(root);
	mkdirSync(join(root, "scripts"), { recursive: true });
	mkdirSync(join(root, "bin"), { recursive: true });
	copyFileSync(SCRIPT_PATH, join(root, "scripts/validate-codestyle.sh"));
	writeFileSync(join(root, "CODESTYLE.md"), "# CODESTYLE\n");
	writeFileSync(
		join(root, "scripts/check-codestyle-parity.sh"),
		"#!/usr/bin/env bash\nexit 0\n",
	);
	chmodSync(join(root, "scripts/check-codestyle-parity.sh"), 0o755);
	writeFileSync(
		join(root, "package.json"),
		JSON.stringify({ name: packageName, scripts }, null, 2),
	);
	writeFileSync(
		join(root, "bin/pnpm"),
		[
			"#!/usr/bin/env bash",
			'if [[ "$1" == "run" ]]; then',
			"  exit 0",
			"fi",
			"exit 1",
			"",
		].join("\n"),
	);
	chmodSync(join(root, "bin/pnpm"), 0o755);
	return root;
}

function runValidateCodestyle(root: string) {
	return spawnSync(
		"bash",
		["scripts/validate-codestyle.sh", "--fast", "--repo-root", root],
		{
			cwd: root,
			encoding: "utf8",
			env: {
				...process.env,
				PATH: `${join(root, "bin")}${delimiter}${process.env.PATH ?? ""}`,
			},
		},
	);
}

const baselineScripts = {
	lint: "true",
	"types:check": "true",
	typecheck: "true",
	"quality:docstrings": "true",
	"quality:size": "true",
	test: "true",
};

afterEach(() => {
	for (const root of tempRoots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe("validate-codestyle.sh source-repo gates", () => {
	it("fails closed when the source repo omits source-only quality scripts", () => {
		const root = createTempRoot("@brainwav/coding-harness", baselineScripts);

		const result = runValidateCodestyle(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"missing source repo package script: quality:behavior-tests",
		);
	});

	it("keeps scaffold repos compatible when source-only quality scripts are absent", () => {
		const root = createTempRoot("fixture-harness-consumer", baselineScripts);

		const result = runValidateCodestyle(root);

		expect(result.status).toBe(0);
		expect(result.stdout).toContain(
			"skip quality:behavior-tests: source-repo script not defined",
		);
		expect(result.stdout).toContain(
			"skip quality:git-env-sanitizer: source-repo script not defined",
		);
		expect(result.stdout).toContain(
			"skip harness:audit-tracking: source-repo script not defined",
		);
	});

	it("fails closed for scaffold repos in strict mode when source-only scripts are absent", () => {
		const root = createTempRoot("fixture-harness-consumer", {
			...baselineScripts,
			"docs:lint": "true",
			"skill:validate": "true",
			"workflow:validate": "true",
		});

		const result = spawnSync(
			"bash",
			[
				"scripts/validate-codestyle.sh",
				"--fast",
				"--strict",
				"--repo-root",
				root,
			],
			{
				cwd: root,
				encoding: "utf8",
				env: {
					...process.env,
					PATH: `${join(root, "bin")}${delimiter}${process.env.PATH ?? ""}`,
				},
			},
		);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"missing source repo package script: quality:behavior-tests",
		);
	});
});
