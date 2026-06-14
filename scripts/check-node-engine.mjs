#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(fileURLToPath(new URL("..", import.meta.url)));
const packageJsonPath = join(repoRoot, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
const requirement = packageJson.engines?.node;

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
