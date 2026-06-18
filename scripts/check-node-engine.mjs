#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = dirname(dirname(scriptPath));
const packageJsonPath = join(repoRoot, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const requirement = packageJson.engines?.node;
const reexecGuard = "HARNESS_NODE_ENGINE_REEXECED";

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

function resolvePinnedNode() {
	const result = spawnSync("mise", ["--cd", repoRoot, "which", "node"], {
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});
	if (result.error) {
		return { ok: false, reason: result.error.message };
	}
	if (result.status !== 0) {
		return {
			ok: false,
			reason:
				result.stderr.trim() || `mise exited with status ${result.status}`,
		};
	}
	const nodePath = result.stdout.trim();
	if (nodePath.length === 0) {
		return { ok: false, reason: "mise did not return a Node executable path" };
	}
	return { ok: true, nodePath };
}

function reexecuteWithPinnedNode(nodePath) {
	console.error(
		`[toolchain] Retrying engine check with repo-pinned Node at ${nodePath}`,
	);
	const result = spawnSync(nodePath, [scriptPath, ...process.argv.slice(2)], {
		env: { ...process.env, [reexecGuard]: "1" },
		stdio: "inherit",
	});
	if (result.error) {
		console.error(
			`[toolchain] Failed to run repo-pinned Node at ${nodePath}: ${result.error.message}`,
		);
		process.exit(1);
	}
	process.exit(result.status ?? 1);
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
	if (process.env[reexecGuard] !== "1") {
		const pinnedNode = resolvePinnedNode();
		if (pinnedNode.ok) {
			if (pinnedNode.nodePath !== process.execPath) {
				reexecuteWithPinnedNode(pinnedNode.nodePath);
			}
		} else {
			console.error(
				`[toolchain] Could not resolve repo-pinned Node through mise: ${pinnedNode.reason}`,
			);
		}
	}
	console.error(
		`[toolchain] Node v${process.versions.node} does not satisfy package.json engines.node ${requirement}`,
	);
	console.error(
		"[toolchain] Fix: run the whole gate through the repo-pinned runtime, for example `bash scripts/run-package-command.sh pnpm check`, or enter the trusted mise environment before running package scripts.",
	);
	process.exit(1);
}

console.log(
	`[toolchain] Node v${process.versions.node} satisfies package.json engines.node ${requirement}`,
);
