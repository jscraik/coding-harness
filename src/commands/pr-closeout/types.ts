/** Synchronous command runner used by live pr-closeout evidence collectors. */
export type CommandRunner = (
	command: string,
	args: readonly string[],
	options: { cwd: string; env?: NodeJS.ProcessEnv },
) => string;
