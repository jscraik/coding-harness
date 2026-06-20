import { describe, expect, it } from "vitest";
import {
	CODING_POLICY_TEMPLATE_FILES,
	CODESTYLE_PACK_TEMPLATE_FILES,
	renderCheckDocStyleScript,
	renderCodestylePackTemplate,
	renderCodestyleTemplate,
	renderPackagedRootFile,
} from "./scaffold-root-templates.js";

describe("scaffold root templates", () => {
	it("declares the codestyle pack files emitted by init", () => {
		expect(CODESTYLE_PACK_TEMPLATE_FILES).toContain("codestyle/README.md");
		expect(CODESTYLE_PACK_TEMPLATE_FILES).toContain(
			"codestyle/CHECKSUMS.sha256",
		);
	});

	it("declares machine-readable coding policy files emitted by init", () => {
		expect(CODING_POLICY_TEMPLATE_FILES).toEqual([
			"coding-policy.json",
			"contracts/coding-policy.schema.json",
			"scripts/validate-coding-policy.cjs",
		]);
	});

	it("loads root scripts packaged into downstream repositories", () => {
		const content = renderPackagedRootFile("scripts/check-code-size.mjs");
		expect(content).toContain("[check-code-size]");
	});

	it("loads the root CODESTYLE scaffold", () => {
		const content = renderCodestyleTemplate();
		expect(content).toContain("# CODESTYLE.md");
	});

	it("loads codestyle pack files", () => {
		const content = renderCodestylePackTemplate("codestyle/README.md");
		expect(content).toContain("# Codestyle Instruction Set");
	});

	it("loads coding policy files", () => {
		const policy = renderCodestylePackTemplate("coding-policy.json");
		const schema = renderCodestylePackTemplate(
			"contracts/coding-policy.schema.json",
		);
		const validator = renderCodestylePackTemplate(
			"scripts/validate-coding-policy.cjs",
		);

		expect(policy).toContain("harness-coding-policy/v1");
		expect(schema).toContain("Coding Policy Index");
		expect(validator).toContain("coding-policy: pass");
	});

	it("scaffolds source-outline as the TypeScript source-inspection default", () => {
		const content = renderCodestylePackTemplate(
			"codestyle/05-quality-security-ops.md",
		);
		expect(content).toContain("harness source-outline <path>");
		expect(content).toContain("--symbol <name>");
	});

	it("loads the actual staged-document Vale wrapper", () => {
		const content = renderCheckDocStyleScript();
		expect(content).toContain("vale --config .vale.ini");
		expect(content).not.toContain("validate-vale.sh");
	});
});
