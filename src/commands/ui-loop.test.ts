import { existsSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EXIT_CODES, runUIExplore, runUIFast, runUIVerify } from "./ui-loop.js";

// Mock fs
vi.mock("node:fs", () => ({
	existsSync: vi.fn(),
}));

describe("ui-loop commands", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});
	describe("runUIFast", () => {
		it("returns NOT_FOUND when Storybook is not configured", () => {
			vi.mocked(existsSync).mockReturnValue(false);

			const result = runUIFast();

			expect(result.exitCode).toBe(EXIT_CODES.NOT_FOUND);
			expect(result.message).toContain("Storybook not found");
		});

		it("returns SUCCESS with pnpm command when Storybook exists", () => {
			vi.mocked(existsSync).mockImplementation((path) => {
				const p = String(path);
				return p.includes("pnpm-lock.yaml") || p.includes(".storybook");
			});

			const result = runUIFast();

			expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
			expect(result.message).toContain("pnpm storybook");
		});

		it("returns JSON output when json option is true", () => {
			vi.mocked(existsSync).mockImplementation((path) => {
				const p = String(path);
				return p.includes("pnpm-lock.yaml") || p.includes(".storybook");
			});

			const result = runUIFast({ json: true, port: 6007 });

			expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
			const parsed = JSON.parse(result.message);
			expect(parsed.command).toContain("storybook");
			expect(parsed.port).toBe(6007);
			expect(parsed.ci).toBe(false);
			expect(parsed.packageManager).toBe("pnpm");
		});

		it("includes --ci in command when CI mode is enabled", () => {
			vi.mocked(existsSync).mockImplementation((path) => {
				const p = String(path);
				return p.includes("pnpm-lock.yaml") || p.includes(".storybook");
			});

			const result = runUIFast({ ci: true });

			expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
			expect(result.message).toContain("pnpm storybook --ci");
			expect(result.message).toContain("CI mode: enabled");
		});

		it("detects npm package manager", () => {
			vi.mocked(existsSync).mockImplementation((path) => {
				// Only storybook exists, no lockfiles
				const p = String(path);
				return p.includes(".storybook");
			});

			const result = runUIFast();

			expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
			expect(result.message).toContain("npm run storybook");
		});

		it("passes ci flag correctly for npm scripts", () => {
			vi.mocked(existsSync).mockImplementation((path) => {
				const p = String(path);
				return p.includes(".storybook");
			});

			const result = runUIFast({ ci: true });

			expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
			expect(result.message).toContain("npm run storybook -- --ci");
		});
	});

	describe("runUIVerify", () => {
		it("returns NOT_FOUND when Playwright is not configured", () => {
			vi.mocked(existsSync).mockReturnValue(false);

			const result = runUIVerify();

			expect(result.exitCode).toBe(EXIT_CODES.NOT_FOUND);
			expect(result.message).toContain("Playwright not found");
		});

		it("returns SUCCESS with playwright command when configured", () => {
			vi.mocked(existsSync).mockImplementation((path) => {
				const p = String(path);
				return (
					p.includes("pnpm-lock.yaml") || p.includes("playwright.config.ts")
				);
			});

			const result = runUIVerify();

			expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
			expect(result.message).toContain("playwright test");
			expect(result.evidence).toBeDefined();
			expect(result.evidence?.command).toContain("playwright");
			expect(result.evidence?.passed).toBe(true);
			expect(result.evidence?.timestamp).toBeDefined();
		});

		it("includes shard option in command when provided", () => {
			vi.mocked(existsSync).mockImplementation((path) => {
				const p = String(path);
				return (
					p.includes("pnpm-lock.yaml") || p.includes("playwright.config.ts")
				);
			});

			const result = runUIVerify({ shard: "1/3" });

			expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
			expect(result.evidence?.command).toContain("--shard=1/3");
		});

		it("includes output directory in command when provided", () => {
			vi.mocked(existsSync).mockImplementation((path) => {
				const p = String(path);
				return (
					p.includes("pnpm-lock.yaml") || p.includes("playwright.config.ts")
				);
			});

			const result = runUIVerify({ outputDir: "./test-results" });

			expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
			expect(result.evidence?.command).toContain("--output=./test-results");
		});

		it("includes timeout option in command when provided", () => {
			vi.mocked(existsSync).mockImplementation((path) => {
				const p = String(path);
				return (
					p.includes("pnpm-lock.yaml") || p.includes("playwright.config.ts")
				);
			});

			const result = runUIVerify({ timeout: 45000 });

			expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
			expect(result.evidence?.command).toContain("--timeout=45000");
		});

		it("ignores timeout option when value is NaN", () => {
			vi.mocked(existsSync).mockImplementation((path) => {
				const p = String(path);
				return (
					p.includes("pnpm-lock.yaml") || p.includes("playwright.config.ts")
				);
			});

			const result = runUIVerify({ timeout: Number.NaN });

			expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
			expect(result.evidence?.command).not.toContain("--timeout=");
		});

		it("returns JSON evidence when json option is true", () => {
			vi.mocked(existsSync).mockImplementation((path) => {
				const p = String(path);
				return (
					p.includes("pnpm-lock.yaml") || p.includes("playwright.config.ts")
				);
			});

			const result = runUIVerify({ json: true });

			expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
			const parsed = JSON.parse(result.message);
			expect(parsed.command).toContain("playwright");
			expect(parsed.passed).toBe(true);
			expect(parsed.timestamp).toBeDefined();
			expect(parsed.durationMs).toBeGreaterThanOrEqual(0);
		});

		it("builds npm command without duplicated run token", () => {
			vi.mocked(existsSync).mockImplementation((path) => {
				const p = String(path);
				return p.includes("playwright.config.ts");
			});

			const result = runUIVerify({
				shard: "1/2",
				timeout: 30000,
				outputDir: "./out",
			});

			expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
			expect(result.evidence?.command).toContain("npm run playwright -- test");
			expect(result.evidence?.command).toContain("--shard=1/2");
			expect(result.evidence?.command).toContain("--timeout=30000");
			expect(result.evidence?.command).toContain("--output=./out");
			expect(result.evidence?.command).not.toContain("npm run run");
		});
	});

	describe("runUIExplore", () => {
		it("returns SUCCESS with default URL", () => {
			const result = runUIExplore();

			expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
			expect(result.message).toContain("http://localhost:3000");
			expect(result.message).toContain("@agent-browser/cli");
		});

		it("uses custom URL when provided", () => {
			const result = runUIExplore({ url: "http://localhost:8080" });

			expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
			expect(result.message).toContain("http://localhost:8080");
		});

		it("uses custom output directory when provided", () => {
			const result = runUIExplore({ outputDir: "./explore-results" });

			expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
			expect(result.message).toContain("./explore-results");
		});

		it("includes interactions flag when enabled", () => {
			const result = runUIExplore({ interactions: true });

			expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
			expect(result.message).toContain("--interactions");
			expect(result.message).toContain("Interactions: enabled");
		});

		it("returns JSON output when json option is true", () => {
			const result = runUIExplore({
				json: true,
				url: "http://example.com",
				outputDir: "./out",
				interactions: true,
			});

			expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
			const parsed = JSON.parse(result.message);
			expect(parsed.url).toBe("http://example.com");
			expect(parsed.outputDir).toBe("./out");
			expect(parsed.interactions).toBe(true);
			expect(parsed.command).toContain("--interactions");
		});
	});
});
