import { describe, expect, it } from "vitest";

import {
	ISSUE_LOOP_ARTIFACT_SPINE_SCHEMA_VERSION,
	normalizeIssueLoopArtifactKind,
	validateIssueLoopArtifactSpine,
	type IssueLoopArtifactSpine,
} from "./artifact-spine.js";

describe("issue-loop artifact spine", () => {
	it("accepts all required issue-loop artifacts with evidence", () => {
		const result = validateIssueLoopArtifactSpine(validSpine());

		expect(result).toEqual({ valid: true, findings: [] });
	});

	it("normalizes common artifact labels into canonical kinds", () => {
		expect(normalizeIssueLoopArtifactKind("review-thread")).toBe(
			"review_disagreement",
		);
		expect(normalizeIssueLoopArtifactKind("Screenshots")).toBe(
			"visual_evidence",
		);
	});

	it("requires missing semantic artifacts to be classified", () => {
		const spine = validSpine();
		spine.artifacts = spine.artifacts.filter(
			(artifact) => artifact.kind !== "merge_decision",
		);

		const result = validateIssueLoopArtifactSpine(spine);

		expect(result.valid).toBe(false);
		expect(result.findings).toContainEqual(
			expect.objectContaining({
				code: "required_artifact_missing",
				kind: "merge_decision",
			}),
		);
	});
});

function validSpine(): IssueLoopArtifactSpine {
	return {
		schemaVersion: ISSUE_LOOP_ARTIFACT_SPINE_SCHEMA_VERSION,
		issue: "JSC-331",
		artifacts: [
			artifact("issue_loop"),
			artifact("product_driver"),
			artifact("bugfix_record"),
			artifact("visual_evidence"),
			artifact("review_disagreement"),
			artifact("merge_decision"),
			artifact("linear_tracker"),
		],
	};
}

function artifact(kind: IssueLoopArtifactSpine["artifacts"][number]["kind"]) {
	return {
		kind,
		path: `.harness/issue-loop/${kind}.md`,
		status: "present" as const,
		evidenceRefs: [`evidence:${kind}`],
	};
}
