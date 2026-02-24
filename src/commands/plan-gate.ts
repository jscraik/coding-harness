/**
 * Plan gate command
 *
 * Validates plan artifacts exist and are properly structured.
 */

import {
	EXIT_CODES,
	type PlanGateOptions,
	runPlanGate,
} from "../lib/plan-gate/detector.js";

export { runPlanGate, EXIT_CODES };
export type { PlanGateOptions };

/**
 * CLI entry point for plan gate
 */
export function runPlanGateCLI(options: PlanGateOptions): number {
	const result = runPlanGate(options);

	if (options.json) {
		console.info(JSON.stringify(result, null, 2));
	} else {
		// Print summary
		const statusIcon = result.passed ? "✓" : "✗";
		const statusText = result.passed ? "PASSED" : "FAILED";
		console.info(`${statusIcon} Plan gate ${statusText}`);
		console.info();

		if (result.artifacts.length > 0) {
			console.info(`Found ${result.artifacts.length} plan document(s):`);
			for (const artifact of result.artifacts) {
				console.info(`  📄 ${artifact.path}`);
				console.info(`     Title: ${artifact.title}`);
				console.info(`     Type: ${artifact.type}`);
				console.info(`     Status: ${artifact.status}`);
				console.info(`     Date: ${artifact.date}`);
				if (options.strict) {
					const sections = [];
					if (artifact.hasImplementationSteps)
						sections.push("Implementation Steps");
					if (artifact.hasAcceptanceCriteria)
						sections.push("Acceptance Criteria");
					console.info(`     Sections: ${sections.join(", ") || "None"}`);
					console.info(`     Origin: ${artifact.hasOrigin ? "Yes" : "No"}`);
				}
			}
			console.info();
		}

		if (result.errors.length > 0) {
			console.info("Errors:");
			for (const error of result.errors) {
				const icon =
					error.code === "STALE" || error.code === "ORIGIN_MISSING" ? "⚠" : "✗";
				console.info(`  ${icon} ${error.code}: ${error.message}`);
				if (error.path) {
					console.info(`     Path: ${error.path}`);
				}
			}
			console.info();
		}

		if (result.daysSincePlan !== undefined) {
			console.info(`Days since plan: ${result.daysSincePlan}`);
		}
	}

	// Return appropriate exit code
	if (result.passed) {
		return EXIT_CODES.SUCCESS;
	}

	// Check for specific error types
	const hasStale = result.errors.some((e) => e.code === "STALE");
	const hasMissing = result.errors.some((e) => e.code === "MISSING");
	const hasOriginMissing = result.errors.some(
		(e) => e.code === "ORIGIN_MISSING",
	);

	if (hasOriginMissing) {
		return EXIT_CODES.ORIGIN_MISSING;
	}
	if (hasStale) {
		return EXIT_CODES.PLAN_STALE;
	}
	if (hasMissing) {
		return EXIT_CODES.PLAN_MISSING;
	}

	return EXIT_CODES.VALIDATION_ERROR;
}
