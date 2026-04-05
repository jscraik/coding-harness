import { describe, expect, it } from "vitest";
import { parseUILoopCommandSpec } from "./ui-loop-command.js";

describe("parseUILoopCommandSpec", () => {
	it("parses argv-safe commands", () => {
		const result = parseUILoopCommandSpec("npm run ui:verify -- --ci");
		expect(result.ok).toBe(true);
		if (!result.ok) {
			return;
		}
		expect(result.value.command).toBe("npm");
		expect(result.value.args).toEqual(["run", "ui:verify", "--", "--ci"]);
	});

	it("rejects leading environment assignment prefixes", () => {
		const result = parseUILoopCommandSpec("NODE_ENV=test npm run ui:verify");
		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}
		expect(result.error).toContain("leading environment variable assignments");
	});
});
