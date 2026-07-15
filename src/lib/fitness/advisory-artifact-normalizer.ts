import { readFileSync } from "node:fs";
import type { FitnessFinding, FitnessLane } from "./types.js";
import {
	malformedArtifactFinding,
	requiredRecordArray,
} from "./artifact-evidence.js";
import { firstString } from "./gate-artifact-findings.js";
import { FITNESS_COMMANDS } from "./commands.js";

/** Reclassify malformed advisory-artifact evidence as a non-blocking warning. */
function advisoryMalformedFinding(finding: FitnessFinding): FitnessFinding {
	return {
		...finding,
		id: `ai-review-advisory:${finding.id}`,
		title: "AI review advisory artifact is malformed",
		severity: "warning",
		lane: "ai-review-advisory",
		enforcement: "advisory",
		claimBoundary:
			"AI review artifact-shape evidence is advisory only; deterministic gates remain the blocking authority.",
	};
}

/** Convert advisory review artifacts into non-blocking fitness findings. */
function advisoryReviewFindings(path: string): FitnessFinding[] {
	let report: unknown;
	try {
		report = JSON.parse(readFileSync(path, "utf8"));
	} catch (error) {
		return [
			advisoryMalformedFinding(
				malformedArtifactFinding({
					path,
					lane: "ai-review-advisory",
					command: FITNESS_COMMANDS.AUTOREVIEW,
					principle: "compound_feedback_to_harness",
					enforcement: "advisory",
					message:
						error instanceof Error
							? `Failed to read or parse JSON artifact: ${error.message}`
							: "Failed to read or parse JSON artifact.",
				}),
			),
		];
	}
	const result = requiredRecordArray(
		report,
		"findings",
		path,
		"ai-review-advisory",
		FITNESS_COMMANDS.AUTOREVIEW,
		"compound_feedback_to_harness",
		"advisory",
	);
	if ("malformed" in result) {
		return result.malformed.map(advisoryMalformedFinding);
	}
	return result.records.map((finding, index) => ({
		id: `ai-review-advisory:${firstString(finding, ["title"]) ?? index}`,
		title: firstString(finding, ["title"]) ?? "AI review advisory finding",
		severity: "warning" as const,
		lane: "ai-review-advisory",
		principle: "compound_feedback_to_harness" as const,
		enforcement: "advisory" as const,
		evidence: {
			message:
				firstString(finding, ["message", "title"]) ??
				"AI-assisted review reported an advisory finding.",
		},
		risk: "Advisory review feedback may improve the patch but does not independently block deterministic local gates.",
		recommendedCommand: FITNESS_COMMANDS.AUTOREVIEW,
		claimBoundary:
			"AI review is advisory evidence only; deterministic gates remain the blocking authority.",
	}));
}

/** Add or refresh the optional advisory review lane when a report is supplied. */
export function maybeAddAdvisoryLane(
	lanes: FitnessLane[],
	path: string | undefined,
): void {
	if (!path) return;
	const findings = advisoryReviewFindings(path);
	const advisoryLane: FitnessLane = {
		id: "ai-review-advisory",
		label: "AI review advisory",
		command: FITNESS_COMMANDS.AUTOREVIEW,
		principle: "compound_feedback_to_harness",
		enforcement: "advisory",
		status: findings.length > 0 ? "warn" : "pass",
		evidenceSource: path,
		findings,
	};
	const existing = lanes.find((lane) => lane.id === advisoryLane.id);
	if (existing) {
		existing.status = advisoryLane.status;
		existing.evidenceSource = advisoryLane.evidenceSource;
		existing.findings = advisoryLane.findings;
		return;
	}
	lanes.push(advisoryLane);
}
