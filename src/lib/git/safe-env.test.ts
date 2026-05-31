import { describe, expect, it } from "vitest";
import { sanitizeGitEnvironment } from "./safe-env.js";

describe("sanitizeGitEnvironment", () => {
	it("strict policy drops every GIT-prefixed key", () => {
		const sanitized = sanitizeGitEnvironment(
			{
				GIT_DIR: "/tmp/repo/.git",
				GIT_AUTHOR_NAME: "Jamie",
				PATH: "/usr/bin",
			},
			{ policy: "strict" },
		);

		expect(sanitized).toEqual({ PATH: "/usr/bin" });
	});

	it("minimal policy drops caller-scoped repository keys and keeps identity config", () => {
		const sanitized = sanitizeGitEnvironment(
			{
				GIT_DIR: "/tmp/repo/.git",
				GIT_WORK_TREE: "/tmp/repo",
				GIT_AUTHOR_NAME: "Jamie",
				PATH: "/usr/bin",
			},
			{ policy: "minimal" },
		);

		expect(sanitized).toEqual({
			GIT_AUTHOR_NAME: "Jamie",
			PATH: "/usr/bin",
		});
	});
});
