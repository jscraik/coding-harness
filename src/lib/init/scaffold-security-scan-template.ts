import { renderCiTemplate } from "./scaffold-ci-template-utils.js";

/**
 * Render the scaffolded GitHub Actions security scan workflow.
 *
 * @returns The YAML contents for `.github/workflows/secret-scan.yml`.
 */
export function renderSecurityScanWorkflow(): string {
	return renderCiTemplate("secret-scan.yml");
}
