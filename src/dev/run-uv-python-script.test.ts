import { spawnSync } from "node:child_process";
import {
	chmodSync,
	copyFileSync,
	mkdirSync,
	mkdtempSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT_PATH = join(process.cwd(), "scripts/run-uv-python.sh");
const tempRoots: string[] = [];

function createFixture() {
	const root = mkdtempSync(join(tmpdir(), "run-uv-python-"));
	tempRoots.push(root);
	mkdirSync(join(root, "scripts"), { recursive: true });
	mkdirSync(join(root, "bin"), { recursive: true });
	copyFileSync(SCRIPT_PATH, join(root, "scripts/run-uv-python.sh"));
	writeFileSync(
		join(root, "bin/uv"),
		[
			"#!/usr/bin/env bash",
			'printf "%s\\n" "$UV_CACHE_DIR" "$UV_PROJECT_ENVIRONMENT" "$UV_MALWARE_CHECK"',
			"",
		].join("\n"),
	);
	chmodSync(join(root, "bin/uv"), 0o755);
	return root;
}

afterEach(() => {
	for (const root of tempRoots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

describe("run-uv-python.sh", () => {
	it("isolates uv state from inherited user-global paths", () => {
		const root = createFixture();
		const physicalRoot = realpathSync(root);
		const result = spawnSync("bash", ["scripts/run-uv-python.sh", "python"], {
			cwd: root,
			encoding: "utf8",
			env: {
				...process.env,
				PATH: `${join(root, "bin")}${delimiter}${process.env.PATH ?? ""}`,
				UV_CACHE_DIR: "/user-global/uv-cache",
				UV_PROJECT_ENVIRONMENT: "/user-global/uv-environment",
			},
		});

		expect(result.status).toBe(0);
		expect(result.stdout.trim().split("\n")).toEqual([
			join(physicalRoot, ".cache/uv-python-types-cache"),
			join(physicalRoot, ".cache/uv-python-types"),
			"1",
		]);
	});
});
