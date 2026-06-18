import { spawnSync } from "node:child_process";
import {
	chmodSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const SOURCE_SCRIPT_PATH = join(process.cwd(), "scripts/check-node-engine.mjs");

const tempRoots: string[] = [];

function createTempRoot(engineRequirement: string) {
	const root = mkdtempSync(join(tmpdir(), "node-engine-check-"));
	tempRoots.push(root);
	mkdirSync(join(root, "scripts"), { recursive: true });
	mkdirSync(join(root, "bin"), { recursive: true });
	writeFileSync(
		join(root, "package.json"),
		JSON.stringify({ engines: { node: engineRequirement } }, null, 2),
	);
	writeFileSync(
		join(root, "scripts/check-node-engine.mjs"),
		readFileSync(SOURCE_SCRIPT_PATH, "utf8"),
	);
	return root;
}

function writeExecutable(root: string, path: string, content: string) {
	const filePath = join(root, path);
	mkdirSync(join(filePath, ".."), { recursive: true });
	writeFileSync(filePath, content);
	chmodSync(filePath, 0o755);
}

function runScript(root: string) {
	const env = { ...process.env };
	delete env.HARNESS_NODE_ENGINE_REEXECED;
	return spawnSync(
		process.execPath,
		[join(root, "scripts/check-node-engine.mjs")],
		{
			cwd: root,
			encoding: "utf8",
			env: {
				...env,
				PATH: `${join(root, "bin")}${delimiter}${process.env.PATH ?? ""}`,
			},
		},
	);
}

describe("check-node-engine.mjs", () => {
	afterEach(() => {
		for (const root of tempRoots.splice(0)) {
			rmSync(root, { force: true, recursive: true });
		}
	});

	it("re-executes through the repo-pinned Node when ambient Node is below engines.node", () => {
		const root = createTempRoot(">=999.0.0");
		const pinnedNode = join(root, "bin/pinned-node");
		writeExecutable(
			root,
			"bin/mise",
			[
				"#!/usr/bin/env bash",
				"set -euo pipefail",
				'[[ "$1" == "--cd" && "$3" == "which" && "$4" == "node" ]] || exit 2',
				`printf '%s\\n' ${JSON.stringify(pinnedNode)}`,
			].join("\n"),
		);
		writeExecutable(
			root,
			"bin/pinned-node",
			[
				"#!/usr/bin/env bash",
				"set -euo pipefail",
				'printf "fake pinned node invoked: %s\\n" "$1"',
			].join("\n"),
		);

		const result = runScript(root);

		expect(result.status).toBe(0);
		expect(result.stderr).toContain(
			"Retrying engine check with repo-pinned Node",
		);
		expect(result.stdout).toContain("fake pinned node invoked:");
	});

	it("fails closed with remediation when mise cannot resolve the pinned Node", () => {
		const root = createTempRoot(">=999.0.0");
		writeExecutable(
			root,
			"bin/mise",
			[
				"#!/usr/bin/env bash",
				"set -euo pipefail",
				'echo "fixture mise cannot resolve node" >&2',
				"exit 1",
			].join("\n"),
		);

		const result = runScript(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"Could not resolve repo-pinned Node through mise",
		);
		expect(result.stderr).toContain(
			"does not satisfy package.json engines.node",
		);
		expect(result.stderr).toContain("Fix: run the whole gate");
	});
});
