import { describe, expect, it } from "vitest";
import { withGitFixtureSigningDisabled } from "./git-fixture-environment.js";

describe("withGitFixtureSigningDisabled", () => {
	it("preserves the supplied environment and disables fixture commit and tag signing", () => {
		const environment = withGitFixtureSigningDisabled({ PATH: "/test/bin" });

		expect(environment.PATH).toBe("/test/bin");
		expect(environment.GIT_CONFIG_COUNT).toBe("2");
		expect(environment.GIT_CONFIG_KEY_0).toBe("commit.gpgsign");
		expect(environment.GIT_CONFIG_VALUE_0).toBe("false");
		expect(environment.GIT_CONFIG_KEY_1).toBe("tag.gpgSign");
		expect(environment.GIT_CONFIG_VALUE_1).toBe("false");
	});

	it("appends signing overrides after inherited Git config entries", () => {
		const environment = withGitFixtureSigningDisabled({
			GIT_CONFIG_COUNT: "2",
			GIT_CONFIG_KEY_0: "safe.directory",
			GIT_CONFIG_VALUE_0: "/workspace",
			GIT_CONFIG_KEY_1: "protocol.file.allow",
			GIT_CONFIG_VALUE_1: "always",
		});

		expect(environment.GIT_CONFIG_COUNT).toBe("4");
		expect(environment.GIT_CONFIG_KEY_0).toBe("safe.directory");
		expect(environment.GIT_CONFIG_VALUE_0).toBe("/workspace");
		expect(environment.GIT_CONFIG_KEY_1).toBe("protocol.file.allow");
		expect(environment.GIT_CONFIG_VALUE_1).toBe("always");
		expect(environment.GIT_CONFIG_KEY_2).toBe("commit.gpgsign");
		expect(environment.GIT_CONFIG_VALUE_2).toBe("false");
		expect(environment.GIT_CONFIG_KEY_3).toBe("tag.gpgSign");
		expect(environment.GIT_CONFIG_VALUE_3).toBe("false");
	});
});
