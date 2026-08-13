/**
 * Add the single Git override that disposable test repositories need.
 *
 * Test fixtures make local commits as setup data. They must not depend on a
 * developer workstation's signing-agent availability or commit.gpgsign policy.
 */
export function withGitFixtureSigningDisabled(
	environment: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
	return {
		...environment,
		GIT_CONFIG_COUNT: "1",
		GIT_CONFIG_KEY_0: "commit.gpgsign",
		GIT_CONFIG_VALUE_0: "false",
	};
}
