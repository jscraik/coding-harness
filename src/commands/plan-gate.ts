/**
 * Plan gate command
 *
 * Validates plan artifacts exist and are properly structured.
 */

import { normalisePlanGateResult } from "../lib/output/normalise.js";
import {
	EXIT_CODES,
	type PlanGateOptions,
	runPlanGate,
} from "../lib/plan-gate/detector.js";

// Re-export workflow plan utilities for plan management
export {
	createPlan,
	findPlans,
	loadPlan,
	updatePlanStatus,
	checkMissingOrigin,
	generatePlanFilename,
	type PlanFrontmatter,
	type PlanMetadata,
	type CreatePlanOptions,
} from "../lib/workflow/plan.js";

export { runPlanGate, EXIT_CODES };
export type { PlanGateOptions };

/**
 * Get recovery hint for common error codes.
 */
function getRecoveryHint(code: string): string | undefined {
	switch (code) {
		case "MISSING":
			return "Create a plan document in docs/plans/ with required sections";
		case "STALE":
			return "Update the plan document or extend maxAge days in the gate options";
		case "ORIGIN_MISSING":
			return "Add an Origin section to the plan document linking to the source request";
		case "PLAN_ID_MISSING":
			return "Add a plan_id field to the plan document frontmatter";
		case "PLAN_ID_NOT_FOUND":
			return "Ensure the plan_id references an existing plan in docs/plans/";
		case "ACCEPTANCE_EVIDENCE_MISSING":
			return "Add acceptance evidence linking checklist items to completed work";
		case "TRACEABILITY_MISSING":
			return "Ensure plan IDs in the PR body match plan documents";
		default:
			return undefined;
	}
}

/**
 * CLI entry point for plan gate
 */
export function runPlanGateCLI(options: PlanGateOptions): number {
	const result = runPlanGate(options);

	// Determine exit code based on result
	let exitCode: number;
	if (result.passed) {
		exitCode = EXIT_CODES.SUCCESS;
	} else {
		// Check for specific error types
		const hasStale = result.errors.some((e) => e.code === "STALE");
		const hasMissing = result.errors.some((e) => e.code === "MISSING");
		const hasOriginMissing = result.errors.some(
			(e) => e.code === "ORIGIN_MISSING",
		);
		const hasPlanIdError = result.errors.some(
			(e) => e.code === "PLAN_ID_MISSING" || e.code === "PLAN_ID_NOT_FOUND",
		);
		const hasEvidenceError = result.errors.some(
			(e) => e.code === "ACCEPTANCE_EVIDENCE_MISSING",
		);
		const hasTraceabilityError = result.errors.some(
			(e) => e.code === "TRACEABILITY_MISSING",
		);

		if (hasOriginMissing) {
			exitCode = EXIT_CODES.ORIGIN_MISSING;
		} else if (hasTraceabilityError) {
			exitCode = EXIT_CODES.TRACEABILITY_ERROR;
		} else if (hasEvidenceError) {
			exitCode = EXIT_CODES.ACCEPTANCE_EVIDENCE_ERROR;
		} else if (hasPlanIdError) {
			exitCode = EXIT_CODES.PLAN_ID_ERROR;
		} else if (hasStale) {
			exitCode = EXIT_CODES.PLAN_STALE;
		} else if (hasMissing) {
			exitCode = EXIT_CODES.PLAN_MISSING;
		} else {
			exitCode = EXIT_CODES.VALIDATION_ERROR;
		}
	}

	if (options.json) {
		// Build recovery hints map from private getRecoveryHint (avoids lib→commands import)
		const recoveryHints: Record<string, string | undefined> = {};
		for (const e of result.errors) {
			recoveryHints[e.code] = getRecoveryHint(e.code);
		}
		const gateResult = normalisePlanGateResult(result, recoveryHints);
		process.stdout.write(`${JSON.stringify(gateResult, null, 2)}\n`);
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
				if (artifact.planId) {
					console.info(`     Plan ID: ${artifact.planId}`);
				}
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
				const recoveryHint = getRecoveryHint(error.code);
				if (recoveryHint) {
					console.info(`     Recovery: ${recoveryHint}`);
				}
			}
			console.info();
		}

		if (result.traceability) {
			console.info("Traceability:");
			console.info(
				`  Plan IDs: ${result.traceability.planIds.join(", ") || "None"}`,
			);
			console.info(
				`  Matched plan IDs: ${result.traceability.matchedPlanIds.join(", ") || "None"}`,
			);
			console.info(
				`  Changed files: ${result.traceability.changedFiles.length}`,
			);
			console.info();
		}

		if (result.daysSincePlan !== undefined) {
			console.info(`Days since plan: ${result.daysSincePlan}`);
		}
	}

	return exitCode;
}
