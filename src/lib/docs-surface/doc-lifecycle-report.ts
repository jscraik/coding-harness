import type {
	DocLifecycleReport,
	DocLifecycleViolation,
} from "./doc-lifecycle-types.js";

/** Build the stable report shape emitted by documentation lifecycle validation. */
export function buildDocLifecycleReport(
	checkedDocuments: string[],
	violations: DocLifecycleViolation[],
	checkedHarnessArtifacts: string[] = [],
	advisoryFindings: DocLifecycleViolation[] = [],
): DocLifecycleReport {
	const requiredFindings = violations.filter(
		(violation) => violation.classification !== "advisory",
	);
	return {
		schema: "doc-lifecycle-report/v1",
		status: requiredFindings.some((violation) => violation.severity === "error")
			? "fail"
			: "pass",
		checkedDocuments,
		checkedHarnessArtifacts: [...checkedHarnessArtifacts].sort(),
		requiredFindings: requiredFindings.sort((left, right) =>
			(left.path + left.message).localeCompare(right.path + right.message),
		),
		advisoryFindings: advisoryFindings.sort((left, right) =>
			(left.path + left.message).localeCompare(right.path + right.message),
		),
		violations: violations.sort((left, right) =>
			(left.path + left.message).localeCompare(right.path + right.message),
		),
	};
}
