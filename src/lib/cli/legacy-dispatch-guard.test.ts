import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MIGRATED_COMMAND_AND_ALIAS_NAMES } from "./command-registry.js";

describe("legacy dispatch guard", () => {
	it("does not define migrated command branches in legacy if-chain", () => {
		const cliPath = join(process.cwd(), "src/cli.ts");
		const content = readFileSync(cliPath, "utf-8");

		const offenders = MIGRATED_COMMAND_AND_ALIAS_NAMES.filter((name) =>
			new RegExp(`^\\s*if \\(command === \"${name}\"`, "m").test(content),
		);

		expect(offenders).toEqual([]);
	});
});
