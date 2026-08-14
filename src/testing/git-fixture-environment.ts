/**
 * Add Git signing overrides that disposable test repositories need.
 *
 * Test fixtures make local commits as setup data. They must not depend on a
 * developer workstation's signing-agent availability or signing policies.
 */
export function withGitFixtureSigningDisabled(
	environment: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
	const configuredCount = environment.GIT_CONFIG_COUNT;
	const configuredEntries =
		configuredCount !== undefined && /^\d+$/.test(configuredCount)
			? Number(configuredCount)
			: 0;
	const existingConfigCount =
		Number.isSafeInteger(configuredEntries) && configuredEntries >= 0
			? configuredEntries
			: 0;

	return {
		...environment,
		GIT_CONFIG_COUNT: String(existingConfigCount + 2),
		[`GIT_CONFIG_KEY_${existingConfigCount}`]: "commit.gpgsign",
		[`GIT_CONFIG_VALUE_${existingConfigCount}`]: "false",
		[`GIT_CONFIG_KEY_${existingConfigCount + 1}`]: "tag.gpgSign",
		[`GIT_CONFIG_VALUE_${existingConfigCount + 1}`]: "false",
	};
}
