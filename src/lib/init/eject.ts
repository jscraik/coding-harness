import { existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import * as readline from "node:readline/promises";
import { TEMPLATES } from "./scaffold.js";

export interface EjectOptions {
	force?: boolean;
	dryRun?: boolean;
	json?: boolean;
	confirmPrompt?: (question: string) => Promise<string>;
}

export interface EjectResult {
	deleted: string[];
	warnings: string[];
	dryRun: boolean;
}

export class EjectCancelledError extends Error {
	constructor() {
		super("Ejection aborted.");
		this.name = "EjectCancelledError";
	}
}

export async function ejectHarness(
	targetDir: string,
	options: EjectOptions = {},
): Promise<EjectResult> {
	const repoRoot = resolve(targetDir);
	const deleted: string[] = [];
	const warnings: string[] = [];
	const info = (message: string): void => {
		if (!options.json) {
			console.info(message);
		}
	};
	const warn = (message: string): void => {
		warnings.push(message);
		if (!options.json) {
			console.warn(message);
		}
	};

	// Execution Context Check: prevent deleting things in ~ or places where it wasn't initialized
	const hasContract = existsSync(join(repoRoot, "harness.contract.json"));
	const hasHarnessDir = existsSync(join(repoRoot, ".harness"));

	// Ensure we only eject if we actually detect our footprint.
	if (!hasContract && !hasHarnessDir) {
		throw new Error(`No harness integration found in ${repoRoot}.`);
	}

	if (!options.force && !options.dryRun) {
		const answer = options.confirmPrompt
			? await options.confirmPrompt(
					"Are you sure you want to remove the coding-harness integration? [y/N] ",
				)
			: await promptForConfirmation();
		if (answer.toLowerCase() !== "y") {
			throw new EjectCancelledError();
		}
	}

	const workflowPaths = TEMPLATES.map((template) => template.path).filter(
		(path) => path.startsWith(".github/workflows/"),
	);
	const pathsToRemove = Array.from(
		new Set([
			...TEMPLATES.map((template) => template.path).filter(
				(path) => !path.startsWith(".github/workflows/"),
			),
			".harness",
			".greptile",
			".agents/skills/coding-harness",
			"harness.contract.json",
		]),
	);
	let deletionFailed = false;

	for (const workflowPath of workflowPaths) {
		if (existsSync(join(repoRoot, workflowPath))) {
			warn(
				`Left workflow for manual review: ${workflowPath}. Harness eject does not delete CI workflows automatically.`,
			);
		}
	}

	for (const p of pathsToRemove) {
		const fullPath = join(repoRoot, p);
		if (existsSync(fullPath)) {
			if (options.dryRun) {
				info(`Would delete: ${p}`);
				continue;
			}
			try {
				rmSync(fullPath, { recursive: true, force: true });
				deleted.push(p);
				info(`Deleted: ${p}`);
			} catch (err) {
				deletionFailed = true;
				warn(
					`Failed to delete ${p}: ${err instanceof Error ? err.message : String(err)}`,
				);
			}
		}
	}

	if (options.dryRun) {
		info(
			"\nDry-run complete. No files were deleted. Run without --dry-run to execute.",
		);
		return {
			deleted,
			warnings,
			dryRun: true,
		};
	}

	if (deletionFailed) {
		throw new Error("Harness eject completed with deletion failures.");
	}

	info(
		"\nHarness configuration ejected. Custom CI action files were left in .github/workflows for your review.",
	);
	info(
		"You may want to manually remove the 'check', 'audit', and 'harness' scripts from your package.json.",
	);
	return {
		deleted,
		warnings,
		dryRun: false,
	};
}

async function promptForConfirmation(): Promise<string> {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});
	const answer = await rl.question(
		"Are you sure you want to remove the coding-harness integration? [y/N] ",
	);
	rl.close();
	return answer;
}
