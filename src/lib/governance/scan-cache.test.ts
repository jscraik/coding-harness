import { describe, expect, it } from "vitest";
import {
	type ScanCache,
	getCachedEntry,
	loadScanCache,
	pruneCache,
	setCachedEntry,
} from "./scan-cache.js";

describe("scan-cache", () => {
	describe("loadScanCache", () => {
		it("returns empty cache for non-existent file", () => {
			const cache = loadScanCache("/nonexistent/cache.json");
			expect(cache.version).toBe(1);
			expect(cache.entries).toEqual([]);
		});

		it("returns empty cache for invalid JSON", () => {
			const cache = loadScanCache("/etc/passwd"); // Not JSON
			expect(cache.version).toBe(1);
			expect(cache.entries).toEqual([]);
		});
	});

	describe("getCachedEntry", () => {
		it("returns undefined for missing entry", () => {
			const cache: ScanCache = { version: 1, entries: [] };
			const entry = getCachedEntry(
				cache,
				"/repo",
				"/repo/harness.contract.json",
			);
			expect(entry).toBeUndefined();
		});

		it("returns undefined for expired entry", () => {
			const cache: ScanCache = {
				version: 1,
				entries: [
					{
						path: "/repo",
						contractHash: "abc123",
						mtimeMs: Date.now(),
						result: { status: "success" },
						cachedAt: Date.now() - 10 * 60 * 1000, // 10 minutes ago
					},
				],
			};
			const entry = getCachedEntry(
				cache,
				"/repo",
				"/repo/harness.contract.json",
				5 * 60 * 1000, // 5 minute TTL
			);
			expect(entry).toBeUndefined();
		});
	});

	describe("setCachedEntry", () => {
		it("adds entry to cache", () => {
			const cache: ScanCache = { version: 1, entries: [] };

			// Create a temp file for testing
			const fs = require("node:fs");
			const os = require("node:os");
			const path = require("node:path");
			const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "scan-cache-test-"));
			const contractPath = path.join(tmpDir, "harness.contract.json");
			fs.writeFileSync(contractPath, '{"version": "1.0"}');

			setCachedEntry(cache, "/repo", contractPath, { status: "success" });

			expect(cache.entries).toHaveLength(1);
			expect(cache.entries[0]?.path).toBe("/repo");
			expect(cache.entries[0]?.result).toEqual({ status: "success" });

			// Cleanup
			fs.unlinkSync(contractPath);
			fs.rmdirSync(tmpDir);
		});

		it("replaces existing entry for same path", () => {
			const fs = require("node:fs");
			const os = require("node:os");
			const path = require("node:path");
			const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "scan-cache-test-"));
			const contractPath = path.join(tmpDir, "harness.contract.json");
			fs.writeFileSync(contractPath, '{"version": "1.0"}');

			const cache: ScanCache = { version: 1, entries: [] };
			setCachedEntry(cache, "/repo", contractPath, { status: "success" });
			setCachedEntry(cache, "/repo", contractPath, { status: "error" });

			expect(cache.entries).toHaveLength(1);
			expect(cache.entries[0]?.result).toEqual({ status: "error" });

			// Cleanup
			fs.unlinkSync(contractPath);
			fs.rmdirSync(tmpDir);
		});
	});

	describe("pruneCache", () => {
		it("removes expired entries", () => {
			const cache: ScanCache = {
				version: 1,
				entries: [
					{
						path: "/repo1",
						contractHash: "abc",
						mtimeMs: Date.now(),
						result: {},
						cachedAt: Date.now() - 10 * 60 * 1000, // Expired
					},
					{
						path: "/repo2",
						contractHash: "def",
						mtimeMs: Date.now(),
						result: {},
						cachedAt: Date.now(), // Fresh
					},
				],
			};

			pruneCache(cache, 5 * 60 * 1000);

			expect(cache.entries).toHaveLength(1);
			expect(cache.entries[0]?.path).toBe("/repo2");
		});
	});
});
