/**
 * Synchronous command runner used by live pr-closeout evidence collectors.
 *
 * This function executes external commands synchronously and returns their output
 * as a string. It is used by pr-closeout evidence collectors that invoke CLI tools
 * like `gh`, `circleci`, or `snyk` to gather PR state.
 *
 * @param command - The command name (e.g., `"gh"`, `"circleci"`, `"snyk"`).
 * @param args - Command arguments (e.g., `["pr", "view", "--json", "..."]`).
 * @param options - Execution options including `cwd` (working directory) and optional `env`.
 * @returns The command's stdout as a UTF-8 string. Stderr may be included depending on implementation.
 *
 * Failure semantics: Throws an error if the command fails (non-zero exit) or is not found.
 * The implementation should propagate spawn errors so evidence collectors can detect missing tools.
 *
 * Synchronous execution is required because pr-closeout evidence collection runs in a
 * sequential, blocking pipeline where each collector must complete before the next runs.
 */
export type CommandRunner = (
	command: string,
	args: readonly string[],
	options: { cwd: string; env?: NodeJS.ProcessEnv },
) => string;
