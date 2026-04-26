import { describe, expect, it } from "vitest";
import { renderCiTemplate } from "./scaffold-ci-template-utils.js";

describe("scaffold CI template utilities", () => {
	it("rejects template path traversal", () => {
		expect(() => renderCiTemplate("../package.json")).toThrow(
			"Invalid CI template path",
		);
		expect(() => renderCiTemplate("/tmp/template.yml")).toThrow(
			"Invalid CI template path",
		);
	});
});
