import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Load a packaged scaffold CI template from `src/templates`.
 *
 * @param relativePath - Template path relative to `src/templates`.
 * @returns Raw template contents.
 */
export function renderCiTemplate(relativePath: string): string {
	const templatePath = fileURLToPath(
		new URL(`../../templates/${relativePath}`, import.meta.url),
	);
	return readFileSync(templatePath, "utf-8");
}

/**
 * Replace double-brace template tokens in a scaffold template.
 *
 * @param template - Raw template contents containing `{{token}}` placeholders.
 * @param tokens - Mapping of token names to rendered replacement text.
 * @returns Template contents with each provided token replaced.
 */
export function replaceTemplateTokens(
	template: string,
	tokens: Record<string, string>,
): string {
	let rendered = template;
	for (const [name, value] of Object.entries(tokens)) {
		rendered = rendered.replaceAll(`{{${name}}}`, value);
	}
	return rendered;
}
