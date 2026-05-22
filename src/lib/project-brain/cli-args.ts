import { join, resolve } from "node:path";
import { inspectFlagList } from "../cli/parse-utils.js";

/** Resolve the Project Brain harness directory from an optional repo root. */
export function resolveBrainHarnessDir(explicitDir?: string): string {
	const dir = resolve(explicitDir ?? process.cwd());
	return join(dir, ".harness");
}

/** Return whether the Project Brain CLI should render JSON output. */
export function shouldRenderBrainJson(args: readonly string[]): boolean {
	return args.includes("--json");
}

/** Read the value immediately following a Project Brain CLI flag. */
export function getBrainFlagValue(
	args: readonly string[],
	index: number,
): string | undefined {
	if (index < 0 || index >= args.length - 1) return undefined;
	const val = args[index + 1];
	if (!val || val.startsWith("--")) return undefined;
	return val;
}

/** Inspect the multi-value --files flag for brain preflight. */
export function inspectBrainFilesFlag(args: readonly string[]) {
	return inspectFlagList(args, "--files");
}
