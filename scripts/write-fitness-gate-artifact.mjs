#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const GATES = {
	typecheck: {
		command: ["pnpm", "typecheck"],
		detailsField: "failures",
		filename: "typecheck.json",
		schemaVersion: "typecheck/v1",
	},
	lint: {
		command: ["pnpm", "lint"],
		detailsField: "findings",
		filename: "lint.json",
		schemaVersion: "lint/v1",
	},
};

const gateName = process.argv[2];
const outputPath = process.argv[3];
const gate = GATES[gateName];

if (!gate) {
	console.error(
		"Usage: node scripts/write-fitness-gate-artifact.mjs <typecheck|lint> [output-path]",
	);
	process.exit(2);
}

const [command, ...args] = gate.command;
const result = spawnSync(command, args, {
	cwd: process.cwd(),
	encoding: "utf8",
	stdio: ["ignore", "pipe", "pipe"],
});
const status = result.status === 0 ? "pass" : "fail";
const message = [result.stdout, result.stderr, result.error?.message]
	.filter(Boolean)
	.join("\n")
	.trim();
const details =
	status === "pass"
		? []
		: [
				{
					message:
						message.length > 0
							? message
							: `${gate.command.join(" ")} exited without diagnostic output.`,
				},
			];
const exitCode = result.status ?? (result.error ? 127 : 1);
const artifact = {
	schemaVersion: gate.schemaVersion,
	status,
	command: gate.command.join(" "),
	exitCode,
	[gate.detailsField]: details,
};
const resolvedOutputPath =
	outputPath ?? join("artifacts", "fitness", gate.filename);

mkdirSync(dirname(resolvedOutputPath), { recursive: true });
writeFileSync(resolvedOutputPath, `${JSON.stringify(artifact, null, 2)}\n`);

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(exitCode);
