import { describe, expect, it } from "vitest";
import {
	DEFAULT_CI_MIGRATE_PROVIDER,
	VALID_CI_MIGRATE_ACTIONS,
	VALID_CI_MIGRATE_PROVIDERS,
} from "./ci-migrate-command-contract.js";

describe("ci-migrate command contract", () => {
	it("keeps circleci as the default provider", () => {
		expect(DEFAULT_CI_MIGRATE_PROVIDER).toBe("circleci");
	});

	it("documents the supported providers", () => {
		expect(VALID_CI_MIGRATE_PROVIDERS).toEqual(["github-actions", "circleci"]);
	});

	it("documents the supported actions", () => {
		expect(VALID_CI_MIGRATE_ACTIONS).toEqual([
			"prepare",
			"commit",
			"abort",
			"verify",
			"bootstrap",
		]);
	});
});
