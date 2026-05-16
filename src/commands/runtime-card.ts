import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { cwd } from "node:process";
import {
	buildLiveRuntimeCard,
	buildLocalRuntimeCard,
} from "../lib/runtime/local-runtime-card.js";
import { sanitizeError } from "../lib/input/sanitize.js";
import type { RuntimeCard } from "../lib/runtime/runtime-card.js";

interface RuntimeCardCLIOptions {
	json: boolean;
	repoRoot: string;
	issueKey?: string;
	phaseExitPath?: string;
	evidencePath?: string;
	outPath?: string;
	live: boolean;
}

type RuntimeCardParseResult =
	| { options: RuntimeCardCLIOptions }
	| { exitCode: number };

/**
 * Prints the CLI usage syntax and a brief description for the `harness runtime-card` command.
 *
 * Outputs a usage line showing supported flags and a short one-line summary of the command's purpose to console.info.
 */
function printRuntimeCardUsage(): void {
	console.info(
		"Usage: harness runtime-card [--json] [--live] [--repo <path>] [--issue <key>] [--phase-exit <path>] [--evidence <path>] [--out <path>]",
	);
	console.info("");
	console.info(
		"Build a runtime-card/v1 artifact from git, .harness evidence, normalized evidence bundles, and optional live provider state.",
	);
}

function readFlagValue(
	args: readonly string[],
	index: number,
): string | undefined {
	const value = args[index + 1];
	if (value === undefined || value.startsWith("--")) return undefined;
	return value;
}

/**
 * Parse CLI arguments for the `harness runtime-card` command and produce runtime options or an exit code.
 *
 * @param args - Command-line arguments to parse.
 * @returns An object with `options` containing parsed `RuntimeCardCLIOptions` on success, or an object with `exitCode` when parsing requests early exit or encounters invalid arguments. `exitCode` values: `0` for help/usage, `2` for missing flag values or unknown arguments.
 */
function parseRuntimeCardArgs(args: readonly string[]): RuntimeCardParseResult {
	if (args.includes("--help") || args.includes("-h")) {
		printRuntimeCardUsage();
		return { exitCode: 0 };
	}
	const options: RuntimeCardCLIOptions = {
		json: args.includes("--json"),
		repoRoot: cwd(),
		live: args.includes("--live"),
	};
	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === "--json") continue;
		if (arg === "--live") continue;
		if (arg === "--repo") {
			const value = readFlagValue(args, index);
			if (!value) {
				console.error("runtime-card: --repo requires a path");
				return { exitCode: 2 };
			}
			options.repoRoot = resolve(value);
			index += 1;
			continue;
		}
		if (arg === "--issue") {
			const value = readFlagValue(args, index);
			if (!value) {
				console.error("runtime-card: --issue requires a tracker key");
				return { exitCode: 2 };
			}
			options.issueKey = value;
			index += 1;
			continue;
		}
		if (arg === "--phase-exit") {
			const value = readFlagValue(args, index);
			if (!value) {
				console.error("runtime-card: --phase-exit requires an artifact path");
				return { exitCode: 2 };
			}
			options.phaseExitPath = value;
			index += 1;
			continue;
		}
		if (arg === "--evidence") {
			const value = readFlagValue(args, index);
			if (!value) {
				console.error("runtime-card: --evidence requires an artifact path");
				return { exitCode: 2 };
			}
			options.evidencePath = value;
			index += 1;
			continue;
		}
		if (arg === "--out") {
			const value = readFlagValue(args, index);
			if (!value) {
				console.error("runtime-card: --out requires a file path");
				return { exitCode: 2 };
			}
			options.outPath = value;
			index += 1;
			continue;
		}
		console.error(`runtime-card: unknown argument ${String(arg)}`);
		return { exitCode: 2 };
	}
	return { options };
}

/**
 * Loads and parses a JSON evidence bundle file referenced by `artifactPath`, constrained to stay within `repoRoot`.
 *
 * @param repoRoot - The repository root used to resolve relative `artifactPath` values.
 * @param artifactPath - Path to the evidence JSON file (absolute or relative to `repoRoot`).
 * @returns The parsed JSON value from the evidence file.
 * @throws Error if `artifactPath` is absolute or resolves outside `repoRoot` with the message "--evidence must stay within --repo".
 */
function loadEvidenceBundle(repoRoot: string, artifactPath: string): unknown {
	const resolvedPath = isAbsolute(artifactPath)
		? artifactPath
		: resolve(repoRoot, artifactPath);
	const canonicalRepo = realpathSync(repoRoot);
	const canonicalEvidence = realpathSync(resolvedPath);
	const rel = relative(canonicalRepo, canonicalEvidence);
	if (isAbsolute(artifactPath) || rel.startsWith("..") || rel === "..") {
		throw new Error("--evidence must stay within --repo");
	}
	return JSON.parse(readFileSync(canonicalEvidence, "utf8"));
}

/**
 * Render a human-readable summary of a runtime card to the console.
 *
 * Prints key runtime-card/v1 fields (issue, lifecycle, branch, pull request, linear status/freshness,
 * artifacts status, phase-exit status, next safe action) and any blockers to console.info.
 *
 * @param card - The RuntimeCard to render
 */
function renderRuntimeCardHuman(card: RuntimeCard): void {
	console.info("runtime-card/v1");
	console.info(`issue: ${card.issueKey ?? "unknown"}`);
	console.info(`lifecycle: ${card.lifecycle}`);
	console.info(`branch: ${card.branch.name ?? "unknown"}`);
	console.info(
		`pull-request: ${card.pullRequest.number ? `#${card.pullRequest.number}` : "unknown"}`,
	);
	console.info(`linear: ${card.linear.status ?? card.linear.freshness}`);
	console.info(`artifacts: ${card.artifacts.status}`);
	console.info(`phase-exit: ${card.phaseExit.status}`);
	console.info(`next: ${card.nextSafeAction}`);
	if (card.blockers.length > 0) {
		console.info("blockers:");
		for (const blocker of card.blockers) {
			console.info(`- ${blocker}`);
		}
	}
}

/**
 * Execute the `harness runtime-card` CLI: parse flags, build a `runtime-card/v1`, and emit or persist its output.
 *
 * Performs argument parsing and validation, optionally loads an evidence bundle constrained to `--repo`, builds the card using local or live providers based on flags, writes the JSON artifact to `--out` when specified, and prints either pretty JSON or a human-readable view. On failure, prints a sanitized error in the selected output format.
 *
 * @param args - Command-line arguments (typically `process.argv.slice(2)`)
 * @returns Exit code: `0` on success, `1` on runtime error, or another code returned by the argument parser (e.g., help or invalid arguments)
 */
export async function runRuntimeCardCLI(args: string[]): Promise<number> {
	const parsed = parseRuntimeCardArgs(args);
	if ("exitCode" in parsed) return parsed.exitCode;
	try {
		const evidenceBundle = parsed.options.evidencePath
			? loadEvidenceBundle(parsed.options.repoRoot, parsed.options.evidencePath)
			: undefined;
		const buildOptions = {
			repoRoot: parsed.options.repoRoot,
			...(parsed.options.issueKey ? { issueKey: parsed.options.issueKey } : {}),
			...(parsed.options.phaseExitPath
				? { phaseExitPath: parsed.options.phaseExitPath }
				: {}),
			...(evidenceBundle !== undefined ? { evidenceBundle } : {}),
		};
		const card = parsed.options.live
			? await buildLiveRuntimeCard(buildOptions)
			: buildLocalRuntimeCard(buildOptions);
		const json = JSON.stringify(card, null, 2);
		if (parsed.options.outPath) {
			const outputPath = resolve(
				parsed.options.repoRoot,
				parsed.options.outPath,
			);
			mkdirSync(dirname(outputPath), { recursive: true });
			const canonicalRepo = realpathSync(parsed.options.repoRoot);
			const canonicalDir = realpathSync(dirname(outputPath));
			const canonicalOutput = join(canonicalDir, basename(outputPath));
			const rel = relative(canonicalRepo, canonicalOutput);
			if (isAbsolute(parsed.options.outPath) || rel.startsWith("..") || rel === "..") {
				throw new Error("--out must stay within --repo");
			}
			writeFileSync(canonicalOutput, `${json}\n`, "utf8");
		}
		if (parsed.options.json) {
			console.info(json);
		} else {
			renderRuntimeCardHuman(card);
		}
		return 0;
	} catch (error) {
		const message = sanitizeError(error);
		if (parsed.options.json) {
			console.info(
				JSON.stringify(
					{
						schemaVersion: "runtime-card-error/v1",
						status: "fail",
						error: message,
					},
					null,
					2,
				),
			);
		} else {
			console.error(`runtime-card: ${message}`);
		}
		return 1;
	}
}
