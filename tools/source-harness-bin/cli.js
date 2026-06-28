#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(packageDirectory, "../..");
const builtCliPath = resolve(repositoryRoot, "dist/cli.js");

if (!existsSync(builtCliPath)) {
	console.error("Error: source checkout harness binary requires dist/cli.js.");
	console.error(
		"Run pnpm build, or use node --import tsx src/cli.ts ... for current-tree development probes.",
	);
	process.exit(1);
}

const child = spawn(
	process.execPath,
	[builtCliPath, ...process.argv.slice(2)],
	{
		cwd: process.cwd(),
		env: process.env,
		stdio: "inherit",
	},
);

child.on("error", (error) => {
	console.error(error.message);
	process.exit(1);
});

child.on("exit", (code, signal) => {
	if (signal) {
		console.error(`harness terminated by signal ${signal}`);
		process.exit(1);
	}
	process.exit(code ?? 1);
});
