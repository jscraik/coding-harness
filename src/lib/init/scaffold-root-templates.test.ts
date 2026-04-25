import { describe, expect, it } from "vitest";
import {
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

	it("loads the actual staged-document Vale wrapper", () => {
		const content = renderCheckDocStyleScript();
		expect(content).toContain("vale --config .vale.ini");
		expect(content).not.toContain("validate-vale.sh");
	});
});
