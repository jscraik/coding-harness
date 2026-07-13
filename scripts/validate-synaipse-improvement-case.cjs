#!/usr/bin/env node
const { pathToFileURL } = require("node:url");
const { spawnSync } = require("node:child_process");
const { resolve, dirname } = require("node:path");

const examplePath = process.argv[2];
if (!examplePath) {
	console.error("usage: validate-synaipse-improvement-case.cjs <example>");
	process.exit(2);
}
const moduleUrl = pathToFileURL(
	resolve(dirname(__dirname), "src/lib/synaipse/improvement-case.ts"),
).href;
const runner = [
	"import { readFileSync } from 'node:fs';",
	"const packet = JSON.parse(readFileSync(process.env.SYNAIPSE_PACKET_PATH, 'utf8'));",
	"const { validateSynaipseImprovementCase } = await import(process.env.SYNAIPSE_MODULE_URL);",
	"const result = validateSynaipseImprovementCase(packet);",
	"console.log(JSON.stringify(result));",
	"process.exit(result.valid ? 0 : 1);",
].join("\n");
const child = spawnSync(
	process.execPath,
	["--import", "tsx", "--eval", runner],
	{
		cwd: process.cwd(),
		env: {
			...process.env,
			SYNAIPSE_MODULE_URL: moduleUrl,
			SYNAIPSE_PACKET_PATH: resolve(examplePath),
		},
		encoding: "utf8",
	},
);
if (child.stdout) process.stdout.write(child.stdout);
if (child.stderr) process.stderr.write(child.stderr);
process.exit(child.status ?? 1);
