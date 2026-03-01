import { describe, expect, it } from "vitest";
import {
	RALPH_FALLBACK_ENV_FLAG,
	RALPH_FALLBACK_WARNING_ARTIFACT_PATH,
	RALPH_PACKAGE_NAME,
	RALPH_VERSION_PIN,
	extractVersionFromRalphVersionOutput,
	getPinnedRalphGitSpec,
	getRalphPackageSpec,
} from "./ralph-runtime.js";

describe("ralph-runtime contract", () => {
	it("builds canonical PyPI package spec", () => {
		expect(getRalphPackageSpec()).toBe(
			`${RALPH_PACKAGE_NAME}==${RALPH_VERSION_PIN}`,
		);
	});

	it("builds pinned git spec", () => {
		expect(
			getPinnedRalphGitSpec(
				"https://github.com/example/ralph-gold.git",
				"abc1234",
			),
		).toBe("git+https://github.com/example/ralph-gold.git@abc1234");
	});

	it("extracts version from CLI output", () => {
		expect(extractVersionFromRalphVersionOutput("ralph-gold 0.8.1")).toBe(
			"0.8.1",
		);
		expect(extractVersionFromRalphVersionOutput("ralph 0.8.1+build.1")).toBe(
			"0.8.1+build.1",
		);
		expect(extractVersionFromRalphVersionOutput("unexpected output")).toBe(
			undefined,
		);
	});

	it("exposes fallback policy contract constants", () => {
		expect(RALPH_FALLBACK_ENV_FLAG).toBe("HARNESS_ALLOW_RALPH_PIPX_FALLBACK");
		expect(RALPH_FALLBACK_WARNING_ARTIFACT_PATH).toBe(
			"artifacts/policy/ralph-fallback-warning.json",
		);
	});
});
