import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		include: ["e2e/tests/**/*.e2e.test.ts", "e2e/**/*.test.ts"],
		exclude: ["**/node_modules/**", "**/dist/**"],
		testTimeout: 300000, // 5 minutes for E2E tests (real API calls)
		hookTimeout: 60000, // 1 minute for hooks
		// Memory-efficient configuration for E2E tests
		pool: "forks", // Use process isolation instead of worker threads (better memory)
		maxConcurrency: 1, // Sequential execution to prevent memory overload
		fileParallelism: false, // Run test files sequentially
		sequence: {
			shuffle: false, // Run tests in order for E2E
		},
		reporters: ["verbose"],
		// Disable coverage in E2E config - run separately if needed
		// Coverage adds significant memory overhead
		// E2E-specific environment
		env: {
			E2E_MODE: "true",
			E2E_RECORDING_DIR: "./e2e/recordings",
		},
	},
});
