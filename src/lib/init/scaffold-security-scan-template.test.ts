// biome-ignore-all lint/suspicious/noTemplateCurlyInString: tests assert literal GitHub Actions expressions.
import { describe, expect, it } from "vitest";
import { renderSecurityScanWorkflow } from "./scaffold-security-scan-template.js";

describe("scaffold security scan template", () => {
	it("renders the GitHub Actions security scan workflow", () => {
		const workflow = renderSecurityScanWorkflow();

		expect(workflow).toContain("name: security-scan");
		expect(workflow).toContain("gitleaks/gitleaks-action@");
		expect(workflow).toContain("aquasecurity/trivy-action@");
		expect(workflow).toContain("semgrep==1.153.1");
		expect(workflow).toContain("--config p/security-audit");
		expect(workflow).toContain("GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}");
	});
});
