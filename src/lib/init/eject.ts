import * as fs from "node:fs";
import { join, resolve } from "node:path";
import * as readline from "node:readline/promises";
import { loadManifest, sanitizePath } from "./rollback.js";
import { HARNESS_DIR, MANIFEST_FILE } from "./types.js";

export interface EjectOptions {
	force?: boolean;
	dryRun?: boolean;
	json?: boolean;
	confirmPrompt?: (question: string) => Promise<string>;
	rmSyncImpl?: typeof fs.rmSync;
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
	const removePath = options.rmSyncImpl ?? fs.rmSync;
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
	const hasContract = fs.existsSync(join(repoRoot, "harness.contract.json"));
	const manifestPath = join(repoRoot, HARNESS_DIR, MANIFEST_FILE);
	const hasManifest = fs.existsSync(manifestPath);

	// Ensure we only eject if we actually detect our footprint.
	if (!hasContract && !hasManifest) {
		throw new Error(`No harness integration found in ${repoRoot}.`);
	}

	if (!options.force && !options.dryRun && !options.json) {
		const answer = options.confirmPrompt
			? await options.confirmPrompt(
					"Are you sure you want to remove the coding-harness integration? [y/N] ",
				)
			: await promptForConfirmation();
		const normalizedAnswer = (answer ?? "").trim().toLowerCase();
		if (normalizedAnswer !== "y") {
			throw new EjectCancelledError();
		}
	}

	const workflowPaths = new Set<string>();
	const pathsToRemove = new Map<string, string>([
		[".harness", join(repoRoot, ".harness")],
		[".greptile", join(repoRoot, ".greptile")],
		[
			".agents/skills/coding-harness",
			join(repoRoot, ".agents/skills/coding-harness"),
		],
		["harness.contract.json", join(repoRoot, "harness.contract.json")],
	]);

	if (hasManifest) {
		const manifest = loadManifest(repoRoot, { operation: "eject" });
		if (!manifest.ok) {
			throw new Error(manifest.error.message);
		}

		for (const entry of manifest.value.files) {
			if (entry.action !== "created") {
				continue;
			}

			if (entry.path.startsWith(".github/workflows/")) {
				workflowPaths.add(entry.path);
				continue;
			}

			const pathResult = sanitizePath(repoRoot, entry.path);
			if (!pathResult.ok) {
				throw new Error(pathResult.error.message);
			}

			pathsToRemove.set(entry.path, pathResult.value);
		}
	}
	const deletionFailedPaths: string[] = [];

	for (const workflowPath of workflowPaths) {
		if (fs.existsSync(join(repoRoot, workflowPath))) {
			warn(
				`Left workflow for manual review: ${workflowPath}. Harness eject does not delete CI workflows automatically.`,
			);
		}
	}

	for (const [relativePath, validatedPath] of pathsToRemove) {
		if (fs.existsSync(validatedPath)) {
			if (options.dryRun) {
				deleted.push(relativePath);
				info(`Would delete: ${relativePath}`);
				continue;
			}
			try {
				removePath(validatedPath, { recursive: true, force: true });
				deleted.push(relativePath);
				info(`Deleted: ${relativePath}`);
			} catch (err) {
				deletionFailedPaths.push(relativePath);
				warn(
					`deletionFailed: ${relativePath}: ${err instanceof Error ? err.message : String(err)}`,
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

	if (deletionFailedPaths.length > 0) {
		throw new Error(
			`Harness eject completed with deletion failures: ${deletionFailedPaths.join(", ")}`,
		);
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
