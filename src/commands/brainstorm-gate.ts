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

	if (options.json) {
		console.info(JSON.stringify(result, null, 2));
	} else {
		// Print summary
		const statusIcon = result.passed ? "✓" : "✗";
		const statusText = result.passed ? "PASSED" : "FAILED";
		console.info(`${statusIcon} Brainstorm gate ${statusText}`);
		console.info();

		if (result.artifacts.length > 0) {
			console.info(`Found ${result.artifacts.length} brainstorm document(s):`);
			for (const artifact of result.artifacts) {
				console.info(`  📄 ${artifact.path}`);
				console.info(`     Topic: ${artifact.topic}`);
				console.info(`     Date: ${artifact.date}`);
				if (options.strict) {
					const sections = [];
					if (artifact.hasWhat) sections.push("What");
					if (artifact.hasWhy) sections.push("Why");
					if (artifact.hasDecisions) sections.push("Decisions");
					console.info(`     Sections: ${sections.join(", ") || "None"}`);
				}
			}
			console.info();
		}

		if (result.errors.length > 0) {
			console.info("Errors:");
			for (const error of result.errors) {
				const icon = error.code === "STALE" ? "⚠" : "✗";
				console.info(`  ${icon} ${error.code}: ${error.message}`);
				if (error.path) {
					console.info(`     Path: ${error.path}`);
				}
			}
			console.info();
		}

		if (result.daysSinceBrainstorm !== undefined) {
			console.info(`Days since brainstorm: ${result.daysSinceBrainstorm}`);
		}
	}

	// Return appropriate exit code
	if (result.passed) {
		return EXIT_CODES.SUCCESS;
	}

	// Check for specific error types
	const hasStale = result.errors.some((e) => e.code === "STALE");
	const hasMissing = result.errors.some((e) => e.code === "MISSING");

	if (hasStale) {
		return EXIT_CODES.BRAINSTORM_STALE;
	}
	if (hasMissing) {
		return EXIT_CODES.BRAINSTORM_MISSING;
	}

	return EXIT_CODES.VALIDATION_ERROR;
}
