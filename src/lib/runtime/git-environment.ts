/** Return a git command environment scoped to an explicit repository root. */
export function gitEnvironmentForRepoRoot(): NodeJS.ProcessEnv {
	const env = { ...process.env };
	delete env.GIT_COMMON_DIR;
	delete env.GIT_DIR;
	delete env.GIT_INDEX_FILE;
	delete env.GIT_WORK_TREE;
	return env;
}
