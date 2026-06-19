import {
	spawnSync,
	type SpawnSyncOptionsWithStringEncoding,
	type SpawnSyncReturns,
} from "node:child_process";

/** Default maximum runtime for process-level script tests. */
export const DEFAULT_SCRIPT_TEST_TIMEOUT_MS = 10_000;

/** Options shared by process-level script test helpers. */
export interface ScriptProcessOptions {
	/** Working directory for the spawned command. */
	cwd?: string;
	/** Environment to pass to the spawned command. */
	env?: NodeJS.ProcessEnv;
	/** Command timeout in milliseconds. Defaults to DEFAULT_SCRIPT_TEST_TIMEOUT_MS. */
	timeoutMs?: number;
}

/** Run a command with UTF-8 output and a default timeout for script tests. */
export function runScriptProcess(
	command: string,
	args: readonly string[],
	options: ScriptProcessOptions = {},
): SpawnSyncReturns<string> {
	const spawnOptions: SpawnSyncOptionsWithStringEncoding = {
		encoding: "utf8",
		timeout: options.timeoutMs ?? DEFAULT_SCRIPT_TEST_TIMEOUT_MS,
	};
	if (options.cwd !== undefined) {
		spawnOptions.cwd = options.cwd;
	}
	if (options.env !== undefined) {
		spawnOptions.env = { ...process.env, ...options.env };
	}
	return spawnSync(command, [...args], spawnOptions);
}

/** Run a Node.js script with the current test runner's Node executable. */
export function runNodeScript(
	scriptPath: string,
	args: readonly string[] = [],
	options: ScriptProcessOptions = {},
): SpawnSyncReturns<string> {
	return runScriptProcess(process.execPath, [scriptPath, ...args], options);
}
