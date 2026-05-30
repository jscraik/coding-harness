import { describe, expect, it } from "vitest";
import { sanitizeGitEnvironment } from "./safe-env.js";

describe("sanitizeGitEnvironment", () => {
	it("drops every git variable in strict mode", () => {
		const env = sanitizeGitEnvironment({
			env: {
				GIT_AUTHOR_NAME: "Jamie",
				GIT_DIR: "/tmp/repo/.git",
				GIT_INDEX_FILE: "/tmp/repo/.git/index",
				GIT_WORK_TREE: "/tmp/repo",
				PATH: "/usr/bin",
			},
			policy: "strict",
		});

		expect(env).toEqual({ PATH: "/usr/bin" });
	});

	it("drops only caller-scoped repository variables in minimal mode", () => {
		const env = sanitizeGitEnvironment({
			env: {
				GIT_AUTHOR_NAME: "Jamie",
				GIT_COMMON_DIR: "/tmp/repo/.git/worktrees/task",
				GIT_DIR: "/tmp/repo/.git",
				GIT_INDEX_FILE: "/tmp/repo/.git/index",
				GIT_WORK_TREE: "/tmp/repo",
				PATH: "/usr/bin",
			},
			policy: "minimal",
		});

		expect(env).toEqual({
			GIT_AUTHOR_NAME: "Jamie",
			PATH: "/usr/bin",
		});
	});

	it("omits undefined values from sanitized environments", () => {
		const env = sanitizeGitEnvironment({
			env: {
				EMPTY_VALUE: undefined,
				PATH: "/usr/bin",
			},
		});

		expect(env).toEqual({ PATH: "/usr/bin" });
	});
});
