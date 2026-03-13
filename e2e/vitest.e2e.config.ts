import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["e2e/tests/**/*.e2e.test.ts"],
		exclude: ["**/node_modules/**", "**/dist/**"],
		testTimeout: 300000, // 5 minutes for E2E tests (real API calls)
		hookTimeout: 60000, // 1 minute for hooks
		maxConcurrency: 3, // Limit concurrent tests to avoid rate limits
		sequence: {
			shuffle: false, // Run tests in order for E2E
		},
		reporters: ["verbose", "html"],
		outputFile: {
			html: "e2e/reports/report.html",
		},
		coverage: {
			provider: "v8",
			reporter: ["text", "text-summary", "html"],
			reportsDirectory: "./e2e/coverage",
			include: ["src/**/*.ts"],
			exclude: ["src/**/*.test.ts", "src/cli.ts"],
		},
		// E2E-specific environment
		env: {
			E2E_MODE: "true",
			E2E_RECORDING_DIR: "./e2e/recordings",
		},
	},
});
