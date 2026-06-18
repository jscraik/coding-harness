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

const SCRIPT_PATH = join(process.cwd(), "scripts/check-node-engine.mjs");

const tempRoots: string[] = [];

function createTempRoot(engineRequirement: string) {
	const root = mkdtempSync(join(tmpdir(), "check-node-engine-"));
	tempRoots.push(root);
	mkdirSync(join(root, "bin"), { recursive: true });
	mkdirSync(join(root, "scripts"), { recursive: true });
	writeFileSync(
		join(root, "package.json"),
		JSON.stringify({ engines: { node: engineRequirement } }, null, 2),
	);
	writeFileSync(
		join(root, "scripts/check-node-engine.mjs"),
		readFileSync(SCRIPT_PATH, "utf8"),
	);
	return root;
}

function writeExecutable(path: string, content: string) {
	writeFileSync(path, content);
	chmodSync(path, 0o755);
}

function runScript(root: string) {
	return spawnSync(
		process.execPath,
		[join(root, "scripts/check-node-engine.mjs")],
		{
			cwd: root,
			encoding: "utf8",
			env: {
				...process.env,
				HARNESS_NODE_ENGINE_REEXECED: undefined,
				PATH: join(root, "bin") + delimiter + (process.env.PATH ?? ""),
			},
		},
	);
}

afterEach(() => {
	for (const root of tempRoots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe("check-node-engine.mjs", () => {
	it("re-executes through mise-pinned Node when the ambient Node is below the engine floor", () => {
		const root = createTempRoot(">=99.0.0");
		writeExecutable(
			join(root, "bin", "mise"),
			[
				"#!/usr/bin/env bash",
				'if [[ "$1" == "--cd" && "$3" == "which" && "$4" == "node" ]]; then',
				`\tprintf '%s\\n' '${join(root, "bin", "pinned-node")}'`,
				"\texit 0",
				"fi",
				"exit 1",
				"",
			].join("\n"),
		);
		writeExecutable(
			join(root, "bin", "pinned-node"),
			[
				"#!/usr/bin/env bash",
				'printf "fake pinned node invoked: %s\\n" "$*"',
				"exit 0",
				"",
			].join("\n"),
		);

		const result = runScript(root);

		expect(result.status).toBe(0);
		expect(result.stderr).toContain("retrying with repo-pinned Node from mise");
		expect(result.stdout).toContain("fake pinned node invoked:");
		expect(result.stdout).toContain("scripts/check-node-engine.mjs");
	});

	it("fails closed when ambient Node is below the engine floor and pinned Node cannot be resolved", () => {
		const root = createTempRoot(">=99.0.0");
		writeExecutable(
			join(root, "bin", "mise"),
			[
				"#!/usr/bin/env bash",
				'printf "fixture mise cannot resolve %s\n" "$*" >&2',
				"exit 1",
				"",
			].join("\n"),
		);

		const result = runScript(root);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain(
			"could not resolve repo-pinned Node through mise",
		);
		expect(result.stderr).toContain(
			"does not satisfy package.json engines.node >=99.0.0",
		);
		expect(result.stderr).toContain("Fix: run the whole gate");
	});
});
