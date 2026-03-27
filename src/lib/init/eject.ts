import { existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import * as readline from "node:readline/promises";

export interface EjectOptions {
	force?: boolean;
}

export async function ejectHarness(
	targetDir: string,
	options: EjectOptions = {},
): Promise<void> {
	const cwd = resolve(targetDir);

	// Execution Context Check: prevent deleting things in ~ or places where it wasn't initialized
	const hasContract = existsSync(join(cwd, "harness.contract.json"));
	const hasHarnessDir = existsSync(join(cwd, ".harness"));

	// Ensure we only eject if we actually detect our footprint.
	if (!hasContract && !hasHarnessDir) {
		console.error(`Error: No harness integration found in ${cwd}.`);
		process.exit(1);
	}

	if (!options.force) {
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		});
		const answer = await rl.question(
			"Are you sure you want to remove the coding-harness integration? [y/N] ",
		);
		rl.close();
		if (answer.toLowerCase() !== "y") {
			console.info("Ejection aborted.");
			return;
		}
	}

	const pathsToRemove = [
		".harness",
		".greptile",
		".agents/skills/coding-harness",
		"harness.contract.json",
	];

	for (const p of pathsToRemove) {
		const fullPath = join(cwd, p);
		if (existsSync(fullPath)) {
			try {
				rmSync(fullPath, { recursive: true, force: true });
				console.info(`Deleted: ${p}`);
			} catch (err) {
				console.error(
					`Warning: Failed to delete ${p}: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		}
	}

	console.info(
		"\nHarness configuration ejected. Custom CI action files were left in .github/workflows for your review.",
	);
	console.info(
		"You may want to manually remove the 'check', 'audit', and 'harness' scripts from your package.json.",
	);
}
