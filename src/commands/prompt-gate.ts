import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Exit codes for programmatic consumption
export const EXIT_CODES = {
	SUCCESS: 0,
	TEMPLATE_MISSING: 1,
	VALIDATION_ERROR: 2,
	SYSTEM_ERROR: 10,
} as const;

export type PromptType = "feature" | "bugfix" | "refactor" | "release";

export interface PromptGateOptions {
	/** Type of prompt template to validate against */
	type: PromptType;
	/** Path to the prompt/document file to validate */
	file: string;
	/** Output as JSON */
	json?: boolean;
	/** Base directory for path resolution */
	baseDir?: string;
}

export interface PromptValidationResult {
	/** Whether validation passed */
	passed: boolean;
	/** Template type validated against */
	templateType: PromptType;
	/** Checked sections and their status */
	checks: {
		/** Section name */
		section: string;
		/** Whether section was found */
		found: boolean;
		/** Optional: count of checked items found */
		itemsFound?: number;
	}[];
	/** Missing required sections */
	missing: string[];
	/** Validation errors */
	errors: string[];
}

export type PromptGateOutput =
	| { ok: true; result: PromptValidationResult }
	| { ok: false; error: { code: string; message: string } };

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

/**
 * Check if a section exists in document content.
 */
function hasSection(content: string, sectionName: string): boolean {
	const patterns = [
		new RegExp(`^##\\s+${sectionName}$`, "im"),
		new RegExp(`^###\\s+${sectionName}$`, "im"),
	];
	return patterns.some((pattern) => pattern.test(content));
}

/**
 * Count checked items in a section (markdown checkboxes).
 */
function countCheckedItems(content: string, sectionName: string): number {
	const sectionPattern = new RegExp(
		`(?:^##\\s+${sectionName}$|^###\\s+${sectionName}$)([\\s\\S]*?)(?=^##|^###|$)`,
		"im",
	);
	const match = content.match(sectionPattern);
	if (!match) return 0;

	const checkedPattern = /- \[x\]/gi;
	const sectionContent = match[1] ?? "";
	const checked = sectionContent.match(checkedPattern);
	return checked?.length ?? 0;
}

/**
 * Validate a prompt file against its template requirements.
 */
export function validatePrompt(
	options: PromptGateOptions,
): PromptValidationResult {
	const baseDir = options.baseDir ?? process.cwd();
	const filePath = resolve(baseDir, options.file);

	// Check file exists
	if (!existsSync(filePath)) {
		return {
			passed: false,
			templateType: options.type,
			checks: [],
			missing: ["File not found"],
			errors: [`File not found: ${options.file}`],
		};
	}

	// Read file content
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

	const required = REQUIRED_SECTIONS[options.type];
	const checks: PromptValidationResult["checks"] = [];
	const missing: string[] = [];

	for (const section of required) {
		const found = hasSection(content, section);
		checks.push({
			section,
			found,
			itemsFound: found ? countCheckedItems(content, section) : 0,
		});

		if (!found) {
			missing.push(section);
		}
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

/**
 * Run prompt gate validation.
 */
export function runPromptGate(options: PromptGateOptions): PromptGateOutput {
	try {
		const result = validatePrompt(options);

		if (result.errors.length > 0 && result.errors[0]?.includes("not found")) {
			return {
				ok: false,
				error: {
					code: "FILE_NOT_FOUND",
					message: result.errors[0],
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

/**
 * CLI entry point with output formatting and exit codes.
 */
export function runPromptGateCLI(options: PromptGateOptions): number {
	const result = runPromptGate(options);

	if (!result.ok) {
		if (options.json) {
			console.error(JSON.stringify({ error: result.error }, null, 2));
		} else {
			console.error(`Error: ${result.error.message}`);
		}
		return result.error.code === "FILE_NOT_FOUND"
			? EXIT_CODES.TEMPLATE_MISSING
			: EXIT_CODES.SYSTEM_ERROR;
	}

	const { result: validation } = result;

	if (options.json) {
		console.info(JSON.stringify(validation, null, 2));
	} else {
		console.info(`Prompt Gate: ${validation.templateType}`);
		console.info("");

		for (const check of validation.checks) {
			const status = check.found ? "✓" : "✗";
			let line = `  ${status} ${check.section}`;
			if (check.itemsFound !== undefined && check.found) {
				line += ` (${check.itemsFound} items checked)`;
			}
			console.info(line);
		}

		if (validation.passed) {
			console.info("");
			console.info("All required sections present.");
		} else {
			console.error("");
			console.error(`Missing sections: ${validation.missing.join(", ")}`);
		}
	}

	return validation.passed ? EXIT_CODES.SUCCESS : EXIT_CODES.VALIDATION_ERROR;
}
