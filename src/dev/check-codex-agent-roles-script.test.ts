import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve } from "node:path";
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
	it("accepts Direct Work instructions without mandatory role-promotion prose", () => {
		const result = spawnSync(
			process.execPath,
			[resolve(process.cwd(), "scripts/check-codex-agent-roles.cjs")],
			{ encoding: "utf8" },
		);

		expect(result.status).toBe(0);
		expect(result.stderr).toBe("");
		expect(result.stdout).toContain("codex-agent-roles: pass");
	});

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
