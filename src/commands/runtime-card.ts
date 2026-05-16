import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
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
	outPath?: string;
	live: boolean;
}

type RuntimeCardParseResult =
	| { options: RuntimeCardCLIOptions }
	| { exitCode: number };

function printRuntimeCardUsage(): void {
	console.info(
		"Usage: harness runtime-card [--json] [--live] [--repo <path>] [--issue <key>] [--phase-exit <path>] [--out <path>]",
	);
	console.info("");
	console.info(
		"Build a runtime-card/v1 artifact from git, .harness evidence, and optional live provider state.",
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

/** Build and optionally persist a local runtime-card/v1 artifact. */
export async function runRuntimeCardCLI(args: string[]): Promise<number> {
	const parsed = parseRuntimeCardArgs(args);
	if ("exitCode" in parsed) return parsed.exitCode;
	try {
		const buildOptions = {
			repoRoot: parsed.options.repoRoot,
			...(parsed.options.issueKey ? { issueKey: parsed.options.issueKey } : {}),
			...(parsed.options.phaseExitPath
				? { phaseExitPath: parsed.options.phaseExitPath }
				: {}),
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
			const rel = relative(parsed.options.repoRoot, outputPath);
			if (isAbsolute(parsed.options.outPath) || rel.startsWith("..")) {
				throw new Error("--out must stay within --repo");
			}
			mkdirSync(dirname(outputPath), { recursive: true });
			writeFileSync(outputPath, `${json}\n`, "utf8");
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
