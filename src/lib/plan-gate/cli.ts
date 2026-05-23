import { normalisePlanGateResult } from "../output/normalise-plan-gate.js";
import { buildPlanGateOptionsFromCliArgs } from "./cli-args.js";
import { runPlanGate } from "./detector.js";
import { EXIT_CODES, type PlanGateOptions } from "./types.js";

/** Execute plan-gate with typed CLI options and formatted output. */
export function runPlanGateCLI(options: PlanGateOptions): number {
	const result = runPlanGate(options);
	const exitCode = getExitCode(result.errors, result.passed);

	if (options.json) {
		const recoveryHints: Record<string, string | undefined> = {};
		for (const error of result.errors) {
			recoveryHints[error.code] = getRecoveryHint(error.code);
		}
		const gateResult = normalisePlanGateResult(result, recoveryHints);
		process.stdout.write(`${JSON.stringify(gateResult, null, 2)}\n`);
		return exitCode;
	}

	printPlanGateResult(result, options.strict);
	return exitCode;
}

/** Run plan-gate from raw command-line arguments. */
export function runPlanGateFromCliArgs(args: string[]): number {
	const parsed = buildPlanGateOptionsFromCliArgs(args);
	return runPlanGateCLI(parsed.options);
}

function getExitCode(
	errors: ReturnType<typeof runPlanGate>["errors"],
	passed: boolean,
): number {
	if (passed) return EXIT_CODES.SUCCESS;
	if (errors.some((error) => error.code === "ORIGIN_MISSING")) {
		return EXIT_CODES.ORIGIN_MISSING;
	}
	if (errors.some((error) => error.code === "TRACEABILITY_MISSING")) {
		return EXIT_CODES.TRACEABILITY_ERROR;
	}
	if (errors.some((error) => error.code === "ACCEPTANCE_EVIDENCE_MISSING")) {
		return EXIT_CODES.ACCEPTANCE_EVIDENCE_ERROR;
	}
	if (
		errors.some(
			(error) =>
				error.code === "PLAN_ID_MISSING" || error.code === "PLAN_ID_NOT_FOUND",
		)
	) {
		return EXIT_CODES.PLAN_ID_ERROR;
	}
	if (errors.some((error) => error.code === "STALE")) {
		return EXIT_CODES.PLAN_STALE;
	}
	if (errors.some((error) => error.code === "MISSING")) {
		return EXIT_CODES.PLAN_MISSING;
	}
	return EXIT_CODES.VALIDATION_ERROR;
}

function printPlanGateResult(
	result: ReturnType<typeof runPlanGate>,
	strict: boolean | undefined,
): void {
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
			if (artifact.planId) console.info(`     Plan ID: ${artifact.planId}`);
			if (strict) {
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
			if (error.path) console.info(`     Path: ${error.path}`);
			const recoveryHint = getRecoveryHint(error.code);
			if (recoveryHint) console.info(`     Recovery: ${recoveryHint}`);
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
		console.info(`  Changed files: ${result.traceability.changedFiles.length}`);
		console.info();
	}

	if (result.daysSincePlan !== undefined) {
		console.info(`Days since plan: ${result.daysSincePlan}`);
	}
}

function getRecoveryHint(code: string): string | undefined {
	switch (code) {
		case "MISSING":
			return "Create a plan document in docs/plans/ or .harness/plan/ with required sections";
		case "STALE":
			return "Update the plan document or extend maxAge days in the gate options";
		case "ORIGIN_MISSING":
			return "Add an Origin section to the plan document linking to the source request";
		case "PLAN_ID_MISSING":
			return "Add a plan_id field to the plan document frontmatter";
		case "PLAN_ID_NOT_FOUND":
			return "Ensure the plan_id references an existing plan in docs/plans/ or .harness/plan/";
		case "ACCEPTANCE_EVIDENCE_MISSING":
			return "Add acceptance evidence linking checklist items to completed work";
		case "TRACEABILITY_MISSING":
			return "Ensure plan IDs in the PR body match plan documents";
		default:
			return undefined;
	}
}
