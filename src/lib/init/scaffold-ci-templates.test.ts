import { describe, expect, it } from "vitest";
import { DEFAULT_CI_PROVIDER } from "./scaffold-ci-templates.js";

describe("scaffold CI templates", () => {
	it("uses CircleCI as the default scaffold provider", () => {
		expect(DEFAULT_CI_PROVIDER).toBe("circleci");
	});
});
