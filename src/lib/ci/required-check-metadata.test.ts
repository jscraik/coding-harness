import { describe, expect, it } from "vitest";
import { SEMGREP_CLOUD_CHECK_NAME } from "../policy/required-checks.js";
import { deriveRequiredCheckMetadata } from "./required-check-metadata.js";

describe("deriveRequiredCheckMetadata", () => {
	it("normalizes whitespace before assigning external check ownership", () => {
		expect(
			deriveRequiredCheckMetadata("github-actions", " CodeRabbit "),
		).toMatchObject({
			sourceAppSlug: "coderabbit",
			githubCheckName: "CodeRabbit",
		});
		expect(
			deriveRequiredCheckMetadata(
				"github-actions",
				` ${SEMGREP_CLOUD_CHECK_NAME} `,
			),
		).toMatchObject({
			sourceAppSlug: "semgrep-cloud-platform",
			githubCheckName: SEMGREP_CLOUD_CHECK_NAME,
		});
		expect(
			deriveRequiredCheckMetadata("github-actions", " security-scan "),
		).toMatchObject({
			sourceAppSlug: "github-actions",
			githubCheckName: "security-scan",
		});
	});
});
