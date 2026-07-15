import { existsSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import {
	EXECUTION_RESOURCE_LANES,
	type ExecutionResourceLane,
} from "./execution-result.js";

/** Public option shape shared by synchronous and durable local execution. */
export interface ExecutionRunOptions {
	command: string[];
	cwd: string;
	artifactsDir: string;
	requestKey?: string;
	resourceLanes: ExecutionResourceLane[];
	parallelSafe: boolean;
	timeoutSeconds: number;
	json: boolean;
}

const DEFAULT_LANE: ExecutionResourceLane = "repo-read";

/** Return the value immediately following a command option. */
function valueAfter(args: readonly string[], flag: string): string | undefined {
	const index = args.indexOf(flag);
	const value = args[index + 1];
	return index === -1 || value === undefined || value.startsWith("-")
		? undefined
		: value;
}

/** Collect repeated comma-separated option values. */
function repeatedValues(args: readonly string[], flag: string): string[] {
	const values: string[] = [];
	for (let index = 0; index < args.length; index += 1) {
		if (args[index] !== flag) continue;
		const value = args[index + 1];
		if (value && !value.startsWith("-")) values.push(...value.split(","));
	}
	return values.map((value) => value.trim()).filter(Boolean);
}

/** Convert a user-provided lane to the versioned lane union. */
function parseLane(value: string): ExecutionResourceLane | undefined {
	return (EXECUTION_RESOURCE_LANES as readonly string[]).includes(value)
		? (value as ExecutionResourceLane)
		: undefined;
}

/** Keep execution paths inside the current repository root. */
function withinRoot(root: string, candidate: string): boolean {
	const rel = relative(root, candidate);
	return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

/** Parse and validate repeated resource-lane options. */
function parseLanes(
	args: readonly string[],
):
	| { ok: true; lanes: ExecutionResourceLane[] }
	| { ok: false; message: string } {
	const lanes = repeatedValues(args, "--lane").map(parseLane);
	if (lanes.some((lane) => lane === undefined)) {
		return {
			ok: false,
			message: `--lane must be one of: ${EXECUTION_RESOURCE_LANES.join(", ")}.`,
		};
	}
	return {
		ok: true,
		lanes: lanes.filter(
			(lane): lane is ExecutionResourceLane => lane !== undefined,
		),
	};
}

/** Parse the bounded local process timeout. */
function parseTimeout(
	args: readonly string[],
): { ok: true; timeoutSeconds: number } | { ok: false; message: string } {
	const timeoutValue = valueAfter(args, "--timeout-seconds");
	const timeoutSeconds = timeoutValue ? Number(timeoutValue) : 300;
	if (
		!Number.isInteger(timeoutSeconds) ||
		timeoutSeconds < 1 ||
		timeoutSeconds > 86_400
	) {
		return {
			ok: false,
			message: "--timeout-seconds must be an integer from 1 to 86400.",
		};
	}
	return { ok: true, timeoutSeconds };
}

/** Resolve and constrain local execution paths. */
function resolveRunPaths(
	args: readonly string[],
):
	| { ok: true; cwd: string; artifactsDir: string; requestKey?: string }
	| { ok: false; message: string } {
	const repoRoot = resolve(process.cwd());
	const cwd = resolve(valueAfter(args, "--cwd") ?? repoRoot);
	const artifactsDir = resolve(
		valueAfter(args, "--artifacts-dir") ?? "artifacts/agent-runs",
	);
	const requestKey = valueAfter(args, "--request-key");
	if (!withinRoot(repoRoot, cwd) || !withinRoot(repoRoot, artifactsDir)) {
		return {
			ok: false,
			message:
				"--cwd and --artifacts-dir must remain inside the repository root.",
		};
	}
	if (!existsSync(cwd) || !statSync(cwd).isDirectory()) {
		return { ok: false, message: `--cwd is not a directory: ${cwd}` };
	}
	return { ok: true, cwd, artifactsDir, ...(requestKey ? { requestKey } : {}) };
}

/** Parse and validate the shared local execution option surface. */
export function parseExecutionRunOptions(
	args: readonly string[],
): { ok: true; options: ExecutionRunOptions } | { ok: false; message: string } {
	const separator = args.indexOf("--");
	if (separator === -1) {
		return { ok: false, message: "run requires -- before command arguments." };
	}
	const optionArgs = args.slice(0, separator);
	const executable = valueAfter(optionArgs, "--command");
	if (!executable) {
		return { ok: false, message: "run requires --command <executable>." };
	}
	const command = [executable, ...args.slice(separator + 1)];
	const lanes = parseLanes(optionArgs);
	if (!lanes.ok) return lanes;
	const timeout = parseTimeout(optionArgs);
	if (!timeout.ok) return timeout;
	const paths = resolveRunPaths(optionArgs);
	if (!paths.ok) return paths;
	return {
		ok: true,
		options: {
			command,
			cwd: paths.cwd,
			artifactsDir: paths.artifactsDir,
			...(paths.requestKey ? { requestKey: paths.requestKey } : {}),
			resourceLanes: lanes.lanes.length > 0 ? lanes.lanes : [DEFAULT_LANE],
			parallelSafe: optionArgs.includes("--parallel-safe"),
			timeoutSeconds: timeout.timeoutSeconds,
			json: optionArgs.includes("--json"),
		},
	};
}
