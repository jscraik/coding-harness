import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		pool: "forks",
		// Run test files sequentially to prevent birpc IPC overload.
		// When files run in parallel, multiple forks race to send onTaskUpdate
		// to the main process simultaneously. Under Docker's constrained CPUs,
		// this causes the 60s birpc timeout to fire for ci-migrate tests.
		fileParallelism: false,
		testTimeout: 180000,
		hookTimeout: 180000,
		teardownTimeout: 60000,
		include: ["src/**/*.test.ts"],
		exclude: ["**/node_modules/**", "**/dist/**"],
		coverage: {
			provider: "v8",
			reporter: ["text", "text-summary", "html"],
			reportsDirectory: "./coverage",
			include: ["src/**/*.ts"],
			exclude: ["src/**/*.test.ts", "src/cli.ts"],
		},
	},
});

