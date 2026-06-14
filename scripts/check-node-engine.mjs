#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = join(fileURLToPath(new URL("..", import.meta.url)));
const packageJsonPath = join(repoRoot, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const requirement = packageJson.engines?.node;
const reexecEnvName = "HARNESS_NODE_ENGINE_REEXEC";

function parseVersion(value) {
	const match = /^(?:v)?(\d+)\.(\d+)\.(\d+)$/.exec(value.trim());
	if (!match) {
		throw new Error(`unsupported Node version format: ${value}`);
	}
	return match.slice(1).map((part) => Number.parseInt(part, 10));
}

function isAtLeast(current, floor) {
	for (let index = 0; index < floor.length; index += 1) {
		if (current[index] > floor[index]) return true;
		if (current[index] < floor[index]) return false;
	}
	return true;
}

if (typeof requirement !== "string") {
	console.error("[toolchain] package.json is missing engines.node");
	process.exit(1);
}

const floorMatch = /^>=(\d+\.\d+\.\d+)$/.exec(requirement.trim());
if (!floorMatch) {
	console.error(
		`[toolchain] unsupported engines.node requirement: ${requirement}`,
	);
	process.exit(1);
}

const current = parseVersion(process.versions.node);
const floor = parseVersion(floorMatch[1]);

if (!isAtLeast(current, floor)) {
	if (process.env[reexecEnvName] !== "1") {
		const resolved = spawnSync("mise", ["--cd", repoRoot, "which", "node"], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "pipe"],
		});
		const pinnedNode = resolved.stdout.trim();
		if (
			resolved.status === 0 &&
			pinnedNode &&
			pinnedNode !== process.execPath
		) {
			const rerun = spawnSync(pinnedNode, [fileURLToPath(import.meta.url)], {
				env: {
					...process.env,
					[reexecEnvName]: "1",
				},
				stdio: "inherit",
			});
			process.exit(rerun.status ?? 1);
		}
	}

	console.error(
		`[toolchain] Node v${process.versions.node} does not satisfy package.json engines.node ${requirement}`,
	);
	console.error(
		"[toolchain] Fix: run through the repo-pinned runtime, for example `mise exec -- node scripts/check-node-engine.mjs`, or install/trust the .mise.toml toolchain.",
	);
	process.exit(1);
}

console.log(
	`[toolchain] Node v${process.versions.node} satisfies package.json engines.node ${requirement}`,
);
