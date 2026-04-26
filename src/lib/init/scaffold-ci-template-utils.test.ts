import { describe, expect, it } from "vitest";
import {
	renderCiTemplate,
	replaceTemplateTokens,
} from "./scaffold-ci-template-utils.js";

describe("scaffold CI template utilities", () => {
	it("rejects template path traversal", () => {
		expect(() => renderCiTemplate("../package.json")).toThrow(
			"Invalid CI template path",
		);
		expect(() => renderCiTemplate("/tmp/template.yml")).toThrow(
			"Invalid CI template path",
		);
		expect(() => renderCiTemplate("")).toThrow("Invalid CI template path");
		expect(() => renderCiTemplate("..")).toThrow("Invalid CI template path");
		expect(() => renderCiTemplate("foo\\bar.yml")).toThrow(
			"Invalid CI template path",
		);
		expect(() => renderCiTemplate("foo/../..")).toThrow(
			"Invalid CI template path",
		);
	});

	it("loads valid templates", () => {
		expect(renderCiTemplate("release-private-npm.yml")).toContain("name:");
	});

	it("fails closed when template tokens are left unreplaced", () => {
		expect(() =>
			replaceTemplateTokens("name: {{name}}\nmissing: {{missing_token}}\n", {
				name: "demo",
			}),
		).toThrow("Unreplaced template tokens: {{missing_token}}");
	});

	it("keeps GitHub Actions expressions while rejecting harness template drift", () => {
		expect(
			replaceTemplateTokens(
				"name: {{name}}\ncondition: ${{ github.event_name == 'push' }}\n",
				{
					name: "demo",
				},
			),
		).toContain("${{ github.event_name == 'push' }}");
	});

	it("keeps CircleCI template expressions while rejecting harness template drift", () => {
		expect(
			replaceTemplateTokens(
				'name: {{name}}\ncache: {{ arch }}-{{ checksum "pnpm-lock.yaml" }}\n',
				{
					name: "demo",
				},
			),
		).toContain('{{ arch }}-{{ checksum "pnpm-lock.yaml" }}');
	});
});
