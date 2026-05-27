import { resolve } from "node:path";
import { cwd } from "node:process";
import { parseRuntimeCardTraceOutPath } from "../lib/runtime-trace/runtime-card-trace.js";
import {
	isRuntimeCardContext,
	printRuntimeCardUsage,
	type RuntimeCardCLIOptions,
} from "./runtime-card-options.js";

export type {
	RuntimeCardCLIOptions,
	RuntimeCardContext,
} from "./runtime-card-options.js";

/** Result of parsing runtime-card CLI arguments. */
export type RuntimeCardParseResult =
	| { options: RuntimeCardCLIOptions }
	| { exitCode: number };

function readFlagValue(
	args: readonly string[],
	index: number,
): string | undefined {
	const value = args[index + 1];
	if (value === undefined || value.startsWith("--")) return undefined;
	return value;
}

function setPathOption(
	options: RuntimeCardCLIOptions,
	args: readonly string[],
	index: number,
	flag:
		| "--phase-exit"
		| "--evidence"
		| "--out"
		| "--evidence-out"
		| "--handoff-out",
): RuntimeCardParseResult | null {
	const value = readFlagValue(args, index);
	if (!value) {
		const valueName =
			flag === "--phase-exit" || flag === "--evidence"
				? "an artifact path"
				: "a file path";
		console.error(`runtime-card: ${flag} requires ${valueName}`);
		return { exitCode: 2 };
	}
	if (flag === "--phase-exit") options.phaseExitPath = value;
	if (flag === "--evidence") options.evidencePath = value;
	if (flag === "--out") options.outPath = value;
	if (flag === "--evidence-out") options.evidenceOutPath = value;
	if (flag === "--handoff-out") options.handoffOutPath = value;
	return null;
}

function setTraceOutOption(
	options: RuntimeCardCLIOptions,
	args: readonly string[],
	index: number,
): RuntimeCardParseResult | null {
	const value = readFlagValue(args, index);
	if (!value) {
		console.error(
			"runtime-card: --trace-out requires artifacts/agent-runs/<runId>/events.jsonl",
		);
		return { exitCode: 2 };
	}
	if (!parseRuntimeCardTraceOutPath(value)) {
		console.error(
			"runtime-card: --trace-out must be artifacts/agent-runs/<runId>/events.jsonl",
		);
		return { exitCode: 2 };
	}
	options.traceOutPath = value;
	return null;
}

/** Parse CLI arguments for the `harness runtime-card` command. */
export function parseRuntimeCardArgs(
	args: readonly string[],
): RuntimeCardParseResult {
	if (args.includes("--help") || args.includes("-h")) {
		printRuntimeCardUsage();
		return { exitCode: 0 };
	}
	const options: RuntimeCardCLIOptions = {
		json: args.includes("--json"),
		repoRoot: cwd(),
		context: "local",
		live: args.includes("--live"),
	};
	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === "--json" || arg === "--live") continue;
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
		if (arg === "--context") {
			const value = readFlagValue(args, index);
			if (!value || !isRuntimeCardContext(value)) {
				const suffix = value
					? `invalid context ${value}`
					: "--context requires local, pr, ci, or closeout";
				console.error(`runtime-card: ${suffix}`);
				return { exitCode: 2 };
			}
			options.context = value;
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
		if (
			[
				"--phase-exit",
				"--evidence",
				"--out",
				"--evidence-out",
				"--handoff-out",
			].includes(arg ?? "")
		) {
			const parseResult = setPathOption(
				options,
				args,
				index,
				arg as
					| "--phase-exit"
					| "--evidence"
					| "--out"
					| "--evidence-out"
					| "--handoff-out",
			);
			if (parseResult) return parseResult;
			index += 1;
			continue;
		}
		if (arg === "--trace-out") {
			const parseResult = setTraceOutOption(options, args, index);
			if (parseResult) return parseResult;
			index += 1;
			continue;
		}
		console.error(`runtime-card: unknown argument ${String(arg)}`);
		return { exitCode: 2 };
	}
	return { options };
}
