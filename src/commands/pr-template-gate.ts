import { existsSync, readFileSync } from "node:fs";
import {
	sanitizeError,
	sanitizePathForDisplay,
} from "../lib/input/sanitize.js";
import { PathTraversalError, validatePath } from "../lib/input/validator.js";
import { validatePrTemplateBody } from "../lib/pr-template-validator.js";


export const EXIT_CODES = {
	SUCCESS: 0,
	POLICY_VIOLATION: 1,
	VALIDATION_ERROR: 2,
} as const;

export interface PrTemplateGateOptions {
	prBody?: string;
	prBodyFile?: string;
	json?: boolean;
}

export interface PrTemplateGateOutput {
	passed: boolean;
	errorCount: number;
	errors: string[];
	source: "flag" | "file" | "env";
	bodyLength: number;
}

export type PrTemplateGateResult =
	| { ok: true; output: PrTemplateGateOutput }
	| { ok: false; error: { code: string; message: string } };

const MAX_BODY_LENGTH = 100_000; // 100KB limit to prevent ReDoS

function readBodyFromFile(pathArg: string): string {
	if (pathArg === "-") {
		const content = readFileSync(0, "utf-8");
		if (content.length > MAX_BODY_LENGTH) {
			throw new Error(
				`PR body exceeds maximum length of ${MAX_BODY_LENGTH} characters.`,
			);
		}
		return content;
	}
	let safePath: string;
	try {
		safePath = validatePath(process.cwd(), pathArg);
	} catch (error) {
		if (error instanceof PathTraversalError) {
			throw new Error(
				`PR body file must be within the current directory: ${sanitizePathForDisplay(pathArg)}`,
			);
		}
		throw error;
	}

	if (!existsSync(safePath)) {
		throw new Error(
			`PR body file not found: ${sanitizePathForDisplay(pathArg)}`,
		);
	}
	const content = readFileSync(safePath, "utf-8");
	if (content.length > MAX_BODY_LENGTH) {
		throw new Error(
			`PR body exceeds maximum length of ${MAX_BODY_LENGTH} characters.`,
		);
	}
	return content;
}

function resolvePrBody(
	options: PrTemplateGateOptions,
): { body: string; source: "flag" | "file" | "env" } | null {
	if (options.prBody && options.prBodyFile) {
		return null;
	}

	if (options.prBody !== undefined) {
		const body = options.prBody;
		if (body.length > MAX_BODY_LENGTH) {
			throw new Error(
				`PR body exceeds maximum length of ${MAX_BODY_LENGTH} characters.`,
			);
		}
		return { body, source: "flag" };
	}

	if (options.prBodyFile !== undefined) {
		return { body: readBodyFromFile(options.prBodyFile), source: "file" };
	}

	if (process.env.PR_TEMPLATE_BODY !== undefined) {
		const body = process.env.PR_TEMPLATE_BODY;
		if (body.length > MAX_BODY_LENGTH) {
			throw new Error(
				`PR_TEMPLATE_BODY exceeds maximum length of ${MAX_BODY_LENGTH} characters.`,
			);
		}
		return { body, source: "env" };
	}

	return null;
}

export function runPrTemplateGate(
	options: PrTemplateGateOptions,
): PrTemplateGateResult {
	let resolved: { body: string; source: "flag" | "file" | "env" } | null;
	try {
		resolved = resolvePrBody(options);
	} catch (error) {
		return {
			ok: false,
			error: {
				code: "VALIDATION_ERROR",
				message: sanitizeError(error),
			},
		};
	}

	if (!resolved) {
		return {
			ok: false,
			error: {
				code: "VALIDATION_ERROR",
				message:
					"Provide either --pr-body, --pr-body-file, or PR_TEMPLATE_BODY (but not both flags).",
			},
		};
	}

	const errors = validatePrTemplateBody(resolved.body);

	return {
		ok: true,
		output: {
			passed: errors.length === 0,
			errorCount: errors.length,
			errors,
			source: resolved.source,
			bodyLength: resolved.body.length,
		},
	};
}

export function runPrTemplateGateCLI(options: PrTemplateGateOptions): number {
	const result = runPrTemplateGate(options);

	if (!result.ok) {
		if (options.json) {
			console.info(JSON.stringify(result, null, 2));
		} else {
			console.error(`Error: ${result.error.message}`);
		}
		return EXIT_CODES.VALIDATION_ERROR;
	}

	if (options.json) {
		console.info(JSON.stringify(result.output, null, 2));
	} else if (result.output.passed) {
		console.info("PR template gate passed.");
	} else {
		console.error("PR template gate failed:");
		for (const error of result.output.errors) {
			console.error(`- ${error}`);
		}
	}

	return result.output.passed
		? EXIT_CODES.SUCCESS
		: EXIT_CODES.POLICY_VIOLATION;
}
