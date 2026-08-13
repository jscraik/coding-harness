import { describe, expect, it } from "vitest";
import { withGitFixtureSigningDisabled } from "./git-fixture-environment.js";

describe("withGitFixtureSigningDisabled", () => {
	it("preserves the supplied environment and overrides only fixture signing", () => {
		const environment = withGitFixtureSigningDisabled({ PATH: "/test/bin" });

		expect(environment.PATH).toBe("/test/bin");
		expect(environment.GIT_CONFIG_COUNT).toBe("1");
		expect(environment.GIT_CONFIG_KEY_0).toBe("commit.gpgsign");
		expect(environment.GIT_CONFIG_VALUE_0).toBe("false");
	});
});
