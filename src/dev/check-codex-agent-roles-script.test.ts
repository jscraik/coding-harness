import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const requireScript = createRequire(import.meta.url);

const { extractStringArrayValue, validateNicknameCandidates } = requireScript(
	"../../scripts/check-codex-agent-roles.cjs",
) as {
	extractStringArrayValue(
		content: string,
		key: string,
	): Array<string | null> | null;
	validateNicknameCandidates(
		errors: string[],
		rolePath: string,
		actualCandidates: Array<string | null> | null,
	): void;
};

describe("check-codex-agent-roles", () => {
	it("keeps malformed nickname candidate entries visible to validation", () => {
		const candidates = extractStringArrayValue(
			'nickname_candidates = ["Harness Good", "Harness Bad" trailing]',
			"nickname_candidates",
		);

		expect(candidates).toEqual(["Harness Good", null]);

		const errors: string[] = [];
		validateNicknameCandidates(
			errors,
			".codex/agents/example/example.toml",
			candidates,
		);

		expect(errors).toContain(
			".codex/agents/example/example.toml: nickname_candidates must be string literals",
		);
	});
});
