import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Codestyle pack files emitted by `harness init` alongside the root CODESTYLE.md.
 */
export const CODESTYLE_PACK_TEMPLATE_FILES = [
	"codestyle/README.md",
	"codestyle/01-foundations.md",
	"codestyle/02-javascript-ui.md",
	"codestyle/03-rust-tauri.md",
	"codestyle/04-docs-config-and-release.md",
	"codestyle/05-quality-security-ops.md",
	"codestyle/06-appendices-and-project-overrides.md",
	"codestyle/07-python.md",
	"codestyle/08-typescript.md",
	"codestyle/09-web.md",
	"codestyle/10-shell-bash-zsh.md",
	"codestyle/11-package-managers-pnpm-npm.md",
	"codestyle/12-swift.md",
	"codestyle/13-git-workflow.md",
	"codestyle/14-patterns.md",
	"codestyle/15-performance.md",
	"codestyle/16-security.md",
	"codestyle/17-testing.md",
	"codestyle/18-code-review.md",
	"codestyle/19-development-workflow.md",
	"codestyle/20-go.md",
	"codestyle/CHECKSUMS.sha256",
] as const;

/**
 * Machine-readable coding policy files emitted by `harness init`.
 */
export const CODING_POLICY_TEMPLATE_FILES = [
	"coding-policy.json",
	"contracts/coding-policy.schema.json",
	"scripts/validate-coding-policy.cjs",
] as const;

/**
 * Load a repository-root scaffold file that is packaged verbatim into downstream projects.
 *
 * @param path - Repository-root-relative file path to load.
 * @returns The UTF-8 contents of the packaged root file.
 */
export function renderPackagedRootFile(path: string): string {
	const templatePath = fileURLToPath(
		new URL(`../../../${path}`, import.meta.url),
	);
	return readFileSync(templatePath, "utf-8");
}

/**
 * Load the CODESTYLE.md scaffold used for repository codestyle guidance.
 *
 * Prefers the packaged template bundled with published builds and falls back to
 * the repository-root CODESTYLE.md when the packaged file is not present.
 *
 * @returns The UTF-8 contents of the selected CODESTYLE.md template.
 */
export function renderCodestyleTemplate(): string {
	const packagedTemplatePath = fileURLToPath(
		new URL("../../templates/CODESTYLE.md", import.meta.url),
	);
	if (existsSync(packagedTemplatePath)) {
		return readFileSync(packagedTemplatePath, "utf-8");
	}
	return renderPackagedRootFile("CODESTYLE.md");
}

/**
 * Load a codestyle pack template for downstream scaffold output.
 *
 * @param relativePath - Path relative to the templates directory or repository root.
 * @returns The UTF-8 contents of the selected codestyle pack file.
 */
export function renderCodestylePackTemplate(relativePath: string): string {
	const packagedTemplatePath = fileURLToPath(
		new URL(`../../templates/${relativePath}`, import.meta.url),
	);
	if (existsSync(packagedTemplatePath)) {
		return readFileSync(packagedTemplatePath, "utf-8");
	}
	return renderPackagedRootFile(relativePath);
}

/**
 * Load the packaged staged-document Vale checker.
 *
 * @returns The UTF-8 text contents of the packaged `scripts/check-doc-style.sh` file.
 */
export function renderCheckDocStyleScript(): string {
	return renderPackagedRootFile("scripts/check-doc-style.sh");
}

/**
 * Load the packaged shell script that validates repository codestyle parity.
 *
 * @returns The UTF-8 text contents of the packaged `scripts/validate-codestyle.sh` file.
 */
export function renderValidateCodestyleScript(): string {
	return renderPackagedRootFile("scripts/validate-codestyle.sh");
}

/**
 * Load the packaged `scripts/check-codestyle-parity.sh` template.
 *
 * @returns The UTF-8 contents of the packaged codestyle parity script.
 */
export function renderCheckCodestyleParityScript(): string {
	return renderPackagedRootFile("scripts/check-codestyle-parity.sh");
}
