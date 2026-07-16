#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SCHEMA_VERSION = "documentation-layer-budgets/v1";
const SURFACES = [
	{ layer: 0, path: "AGENTS.md", maxLines: 130 },
	{ layer: 1, path: "docs/agents/quickstart.md", maxLines: 80 },
];

function parseArgs(argv) {
	const options = { json: false, repoRoot: process.cwd() };
	const errors = [];
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--json") {
			options.json = true;
			continue;
		}
		if (arg === "--repo-root") {
			const value = argv[index + 1];
			if (!value || value.startsWith("--"))
				errors.push("--repo-root requires a path");
			else {
				options.repoRoot = resolve(value);
				index += 1;
			}
			continue;
		}
		errors.push(`unknown argument: ${arg}`);
	}
	return { options, errors };
}

function lineCount(text) {
	if (text.length === 0) return 0;
	const lines = text.split("\n");
	return lines.at(-1) === "" ? lines.length - 1 : lines.length;
}

function checkSurface(repoRoot, surface) {
	try {
		const lines = lineCount(
			readFileSync(resolve(repoRoot, surface.path), "utf8"),
		);
		return {
			...surface,
			lineCount: lines,
			status: lines <= surface.maxLines ? "pass" : "fail",
			...(lines <= surface.maxLines
				? {}
				: {
						diagnostic: `Layer ${surface.layer} surface exceeds its ${surface.maxLines}-line budget by ${lines - surface.maxLines} line(s).`,
					}),
		};
	} catch (error) {
		return {
			...surface,
			lineCount: null,
			status: "blocked",
			diagnostic: `Could not read ${surface.path}: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}

function buildReport(repoRoot) {
	const surfaces = SURFACES.map((surface) => checkSurface(repoRoot, surface));
	const status = surfaces.some((surface) => surface.status === "fail")
		? "fail"
		: surfaces.some((surface) => surface.status === "blocked")
			? "blocked"
			: "pass";
	return {
		schemaVersion: SCHEMA_VERSION,
		status,
		repoRoot,
		surfaces,
		claimBoundary:
			"Documentation layer budgets prove only line-count and read-availability constraints; they do not prove documentation quality, policy correctness, or delivery readiness.",
	};
}

const { options, errors } = parseArgs(process.argv.slice(2));
if (errors.length > 0) {
	const report = {
		schemaVersion: SCHEMA_VERSION,
		status: "fail",
		errors,
		claimBoundary:
			"Invalid arguments prevent documentation layer budget evaluation.",
	};
	console.error(
		options.json ? JSON.stringify(report, null, 2) : errors.join("\n"),
	);
	process.exitCode = 2;
} else {
	const report = buildReport(resolve(options.repoRoot));
	if (options.json) console.log(JSON.stringify(report, null, 2));
	else {
		for (const surface of report.surfaces) {
			console.log(
				`${surface.status} ${surface.path} ${surface.lineCount ?? "n.a."}/${surface.maxLines}`,
			);
		}
	}
	process.exitCode = report.status === "pass" ? 0 : 1;
}
