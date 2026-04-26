import { describe, expect, it } from "vitest";
import { renderTransitionStatusArtifact } from "./scaffold-ci-transition-status-template.js";

describe("scaffold CI transition status template", () => {
	it("renders deterministic transition status", () => {
		expect(JSON.parse(renderTransitionStatusArtifact())).toEqual({
			schemaVersion: "ci-provider-transition-status/v1",
			nextGateComplete: false,
			updatedAt: "2026-03-14T00:00:00.000Z",
		});
	});
});
