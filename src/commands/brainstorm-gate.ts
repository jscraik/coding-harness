/**
 * Brainstorm gate command
 *
 * Validates brainstorm artifacts exist and are recent.
 */

import {
	type BrainstormGateOptions,
	EXIT_CODES,
	runBrainstormGate,
} from "../lib/brainstorm/detector.js";

export { runBrainstormGate, EXIT_CODES };
export type { BrainstormGateOptions };

// Re-export brainstorm CRUD utilities for automation and CLI consumers
export {
	createBrainstorm,
	loadBrainstorm,
	findBrainstorms,
	findRecentBrainstorms,
	updateBrainstormStatus,
	requiresBrainstorm,
	generateBrainstormFilename,
	type BrainstormFrontmatter,
	type BrainstormMetadata,
} from "../lib/workflow/brainstorm.js";

/**
 * CLI entry point for brainstorm gate
 */
export function runBrainstormGateCLI(options: BrainstormGateOptions): number {
	const result = runBrainstormGate(options);

	renderBrainstormGateResult(result, options);
	return brainstormGateExitCode(result);
}

type BrainstormGateResult = ReturnType<typeof runBrainstormGate>;

function renderBrainstormGateResult(
	result: BrainstormGateResult,
	options: BrainstormGateOptions,
): void {
	if (options.json) {
		console.info(JSON.stringify(result, null, 2));
		return;
	}
	renderBrainstormSummary(result);
	renderBrainstormArtifacts(result, Boolean(options.strict));
	renderBrainstormErrors(result);
	if (result.daysSinceBrainstorm !== undefined) {
		console.info(`Days since brainstorm: ${result.daysSinceBrainstorm}`);
	}
}

function renderBrainstormSummary(result: BrainstormGateResult): void {
	const statusIcon = result.passed ? "✓" : "✗";
	const statusText = result.passed ? "PASSED" : "FAILED";
	console.info(`${statusIcon} Brainstorm gate ${statusText}`);
	console.info();
}

function renderBrainstormArtifacts(
	result: BrainstormGateResult,
	strict: boolean,
): void {
	if (result.artifacts.length === 0) return;
	console.info(`Found ${result.artifacts.length} brainstorm document(s):`);
	for (const artifact of result.artifacts) {
		console.info(`  📄 ${artifact.path}`);
		console.info(`     Topic: ${artifact.topic}`);
		console.info(`     Date: ${artifact.date}`);
		if (strict) console.info(`     Sections: ${brainstormSections(artifact)}`);
	}
	console.info();
}

function brainstormSections(
	artifact: BrainstormGateResult["artifacts"][number],
): string {
	const sections = [];
	if (artifact.hasWhat) sections.push("What");
	if (artifact.hasWhy) sections.push("Why");
	if (artifact.hasDecisions) sections.push("Decisions");
	return sections.join(", ") || "None";
}

function renderBrainstormErrors(result: BrainstormGateResult): void {
	if (result.errors.length === 0) return;
	console.info("Errors:");
	for (const error of result.errors) {
		const icon = error.code === "STALE" ? "⚠" : "✗";
		console.info(`  ${icon} ${error.code}: ${error.message}`);
		if (error.path) console.info(`     Path: ${error.path}`);
	}
	console.info();
}

function brainstormGateExitCode(result: BrainstormGateResult): number {
	if (result.passed) return EXIT_CODES.SUCCESS;
	if (result.errors.some((e) => e.code === "STALE")) {
		return EXIT_CODES.BRAINSTORM_STALE;
	}
	if (result.errors.some((e) => e.code === "MISSING")) {
		return EXIT_CODES.BRAINSTORM_MISSING;
	}
	return EXIT_CODES.VALIDATION_ERROR;
}
