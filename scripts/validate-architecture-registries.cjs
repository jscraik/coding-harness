#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const registries = [
	{
		path: "docs/architecture/architecture-adjacent-boundary-registry.json",
		schemaVersion: "architecture-adjacent-boundary-registry/v1",
		arrayKey: "entries",
		requiredKeys: [
			"id",
			"commandFacade",
			"registryAdapter",
			"ownerModule",
			"rule",
			"validation",
		],
	},
	{
		path: "docs/architecture/deep-module-boundary-cards.json",
		schemaVersion: "deep-module-boundary-cards/v1",
		arrayKey: "modules",
		requiredKeys: ["path", "publicSurface", "owns", "mustNotOwn"],
	},
	{
		path: "docs/architecture/validation-gate-graph.json",
		schemaVersion: "validation-gate-graph/v1",
		arrayKey: "nodes",
		requiredKeys: ["command", "lane", "owner", "proves"],
	},
];

function parseJson(relativePath, violations) {
	try {
		return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
	} catch (error) {
		violations.push({
			file: relativePath,
			message: `invalid JSON: ${error.message}`,
		});
		return null;
	}
}

function hasText(value) {
	return typeof value === "string" && value.trim() !== "";
}

function aggregatePnpmCommands(commandText) {
	const commands = new Set();
	for (const command of String(commandText)
		.split(/\s+&&\s+/)
		.map((item) => item.trim())
		.filter((item) => /^pnpm\s+[^\s]+$/.test(item))) {
		commands.add(command);
	}
	return commands;
}

function aggregatePnpmCommandsWithOneLevel(commandText, packageScripts = {}) {
	const commands = aggregatePnpmCommands(commandText);
	for (const command of [...commands]) {
		const scriptName = scriptNameForPnpmCommand(command);
		const nestedScript = scriptName ? packageScripts[scriptName] : "";
		if (!hasText(nestedScript)) {
			continue;
		}
		for (const nestedCommand of aggregatePnpmCommands(nestedScript)) {
			commands.add(nestedCommand);
		}
	}
	return commands;
}

function scriptNameForPnpmCommand(command) {
	const match = /^pnpm\s+([^\s]+)$/.exec(String(command));
	return match?.[1] ?? null;
}

function sameStringSet(left, right) {
	if (left.size !== right.size) return false;
	for (const value of left) {
		if (!right.has(value)) return false;
	}
	return true;
}

const violations = [];
for (const registry of registries) {
	const parsed = parseJson(registry.path, violations);
	if (!parsed) continue;
	if (parsed.schemaVersion !== registry.schemaVersion) {
		violations.push({
			file: registry.path,
			message: `schemaVersion must be ${registry.schemaVersion}`,
		});
	}
	const entries = parsed[registry.arrayKey];
	if (!Array.isArray(entries) || entries.length === 0) {
		violations.push({
			file: registry.path,
			message: `${registry.arrayKey} must be a non-empty array`,
		});
		continue;
	}
	for (const [index, entry] of entries.entries()) {
		for (const key of registry.requiredKeys) {
			const value = entry[key];
			const valid = Array.isArray(value) ? value.length > 0 : hasText(value);
			if (!valid) {
				violations.push({
					file: registry.path,
					message: `${registry.arrayKey}[${index}].${key} must be populated`,
				});
			}
		}
		for (const key of [
			"commandFacade",
			"registryAdapter",
			"ownerModule",
			"path",
			"validation",
		]) {
			if (hasText(entry[key]) && !fs.existsSync(path.join(root, entry[key]))) {
				violations.push({
					file: registry.path,
					message: `${registry.arrayKey}[${index}].${key} is missing: ${entry[key]}`,
				});
			}
		}
	}
}

const packageJson = parseJson("package.json", violations);
const gateGraph = parseJson(
	"docs/architecture/validation-gate-graph.json",
	violations,
);
if (packageJson && gateGraph) {
	const aggregate = packageJson.scripts?.check ?? "";
	const aggregateCommands = aggregatePnpmCommandsWithOneLevel(
		aggregate,
		packageJson.scripts ?? {},
	);
	const graphAggregate = gateGraph.aggregateCommand;
	if (graphAggregate !== "pnpm check") {
		violations.push({
			file: "docs/architecture/validation-gate-graph.json",
			message: "aggregateCommand must stay pnpm check",
		});
	}
	const graphCommands = new Set();
	for (const node of gateGraph.nodes ?? []) {
		if (hasText(node.command)) {
			graphCommands.add(node.command);
		}
		if (!hasText(node.command) || !aggregateCommands.has(node.command)) {
			violations.push({
				file: "docs/architecture/validation-gate-graph.json",
				message: `pnpm check does not include graph node: ${node.command}`,
			});
		}
		if (Array.isArray(node.subcommands)) {
			const scriptName = scriptNameForPnpmCommand(node.command);
			const scriptText = scriptName ? packageJson.scripts?.[scriptName] : "";
			const expectedSubcommands = aggregatePnpmCommands(scriptText);
			const graphSubcommands = new Set(node.subcommands);
			if (
				node.subcommands.some((command) => !hasText(command)) ||
				!sameStringSet(graphSubcommands, expectedSubcommands)
			) {
				violations.push({
					file: "docs/architecture/validation-gate-graph.json",
					message: `${node.command} subcommands must match package.json script: ${[
						...expectedSubcommands,
					].join(", ")}`,
				});
			}
		}
	}
	for (const aggregateCommand of aggregateCommands) {
		if (!graphCommands.has(aggregateCommand)) {
			violations.push({
				file: "docs/architecture/validation-gate-graph.json",
				message: `validation graph is missing pnpm check node: ${aggregateCommand}`,
			});
		}
	}
}

const result = {
	schemaVersion: "architecture-registries-validation/v1",
	status: violations.length === 0 ? "pass" : "fail",
	violations,
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.exit(violations.length === 0 ? 0 : 1);
