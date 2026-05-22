import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
	PromptGateOptions,
	PromptGateOutput,
	PromptType,
	PromptValidationResult,
} from "./types.js";
import { countCheckedItems, hasSection } from "./sections.js";

const REQUIRED_SECTIONS: Record<PromptType, string[]> = {
	feature: [
		"Required Inputs",
		"Constraints",
		"Acceptance Criteria",
		"Expected Outputs",
		"Do Not Do",
	],
	bugfix: [
		"Required Inputs",
		"Constraints",
		"Acceptance Criteria",
		"Investigation Framework",
		"Do Not Do",
	],
	refactor: [
		"Required Inputs",
		"Constraints",
		"Acceptance Criteria",
		"Safety Rules",
		"Do Not Do",
	],
	release: [
		"Required Inputs",
		"Constraints",
		"Acceptance Criteria",
		"Release Steps",
		"Do Not Do",
	],
};

/** Validate a prompt file against its template requirements. */
export function validatePrompt(
	options: PromptGateOptions,
): PromptValidationResult {
	const baseDir = options.baseDir ?? process.cwd();
	const filePath = resolve(baseDir, options.file);

	if (!existsSync(filePath)) {
		return {
			passed: false,
			templateType: options.type,
			checks: [],
			missing: ["File not found"],
			errors: [`File not found: ${options.file}`],
		};
	}

	let content: string;
	try {
		content = readFileSync(filePath, "utf-8");
	} catch {
		return {
			passed: false,
			templateType: options.type,
			checks: [],
			missing: ["Read error"],
			errors: [`Failed to read file: ${options.file}`],
		};
	}

	const checks: PromptValidationResult["checks"] = [];
	const missing: string[] = [];

	for (const section of REQUIRED_SECTIONS[options.type]) {
		const found = hasSection(content, section);
		checks.push({
			section,
			found,
			itemsFound: found ? countCheckedItems(content, section) : 0,
		});

		if (!found) missing.push(section);
	}

	const passed = missing.length === 0;

	return {
		passed,
		templateType: options.type,
		checks,
		missing,
		errors: passed ? [] : [`Missing required sections: ${missing.join(", ")}`],
	};
}

/** Run prompt gate validation. */
export function runPromptGate(options: PromptGateOptions): PromptGateOutput {
	try {
		const result = validatePrompt(options);

		if (result.missing.includes("File not found")) {
			return {
				ok: false,
				error: {
					code: "FILE_NOT_FOUND",
					message: result.errors[0] ?? `File not found: ${options.file}`,
				},
			};
		}

		if (result.missing.includes("Read error")) {
			return {
				ok: false,
				error: {
					code: "SYSTEM_ERROR",
					message: result.errors[0] ?? `Failed to read file: ${options.file}`,
				},
			};
		}

		return { ok: true, result };
	} catch (error) {
		return {
			ok: false,
			error: {
				code: "SYSTEM_ERROR",
				message: error instanceof Error ? error.message : "Unknown error",
			},
		};
	}
}
