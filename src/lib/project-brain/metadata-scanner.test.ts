import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	rankDomainsByTrust,
	scanBrainMetadata,
	scanKnowledgeMetadata,
} from "./metadata-scanner.js";

function createBrainDir(
	domains: Record<string, { verified?: string; confidence?: string }>,
) {
	const dir = mkdtempSync(join("/tmp", "meta-test-"));
	const harnessDir = join(dir, ".harness");
	mkdirSync(join(harnessDir, "knowledge"), { recursive: true });

	for (const [domain, opts] of Object.entries(domains)) {
		mkdirSync(join(harnessDir, "knowledge", domain), { recursive: true });
		writeFileSync(
			join(harnessDir, "knowledge", domain, "knowledge.md"),
			`# ${domain} Knowledge\n\n**Last verified:** ${opts.verified ?? "(not yet)"}\n**Verification source:** manual\n**Confidence:** ${opts.confidence ?? "medium"}\n**Owner:** test\n\n## Confirmed facts\n\n- Test fact\n`,
		);
	}

	return dir;
}

describe("scanKnowledgeMetadata", () => {
	it("parses fresh metadata correctly", () => {
		const dir = createBrainDir({
			api: { verified: "2026-04-15", confidence: "high" },
		});
		try {
			const result = scanKnowledgeMetadata(
				join(dir, ".harness"),
				"api",
				"knowledge/api/knowledge.md",
				{ now: new Date("2026-04-16") },
			);
			expect(result.domain).toBe("api");
			expect(result.lastVerified).toBe("2026-04-15");
			expect(result.confidence).toBe("high");
			expect(result.needsReview).toBe(false);
			expect(result.stalenessScore).toBeLessThan(0.1);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("flags never-verified entries as stale", () => {
		const dir = createBrainDir({ api: { verified: "(not yet)" } });
		try {
			const result = scanKnowledgeMetadata(
				join(dir, ".harness"),
				"api",
				"knowledge/api/knowledge.md",
			);
			expect(result.lastVerified).toBe("(not yet)");
			expect(result.needsReview).toBe(true);
			expect(result.stalenessScore).toBeGreaterThanOrEqual(0.9);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("flags low confidence even when fresh", () => {
		const dir = createBrainDir({
			api: { verified: "2026-04-15", confidence: "low" },
		});
		try {
			const result = scanKnowledgeMetadata(
				join(dir, ".harness"),
				"api",
				"knowledge/api/knowledge.md",
				{ now: new Date("2026-04-16") },
			);
			expect(result.confidence).toBe("low");
			expect(result.needsReview).toBe(true);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("flags entries exceeding threshold", () => {
		const dir = createBrainDir({
			api: { verified: "2026-01-01", confidence: "high" },
		});
		try {
			const result = scanKnowledgeMetadata(
				join(dir, ".harness"),
				"api",
				"knowledge/api/knowledge.md",
				{ now: new Date("2026-04-16"), thresholdDays: 30 },
			);
			expect(result.needsReview).toBe(true);
			expect(result.stalenessScore).toBeGreaterThan(0.5);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it("handles missing files gracefully", () => {
		const result = scanKnowledgeMetadata(
			"/nonexistent",
			"missing",
			"knowledge/missing/knowledge.md",
		);
		expect(result.lastVerified).toBeNull();
		expect(result.needsReview).toBe(true);
	});
});

describe("scanBrainMetadata", () => {
	it("scans multiple domains and produces report", () => {
		const dir = createBrainDir({
			api: { verified: "2026-04-15", confidence: "high" },
			testing: { verified: "2026-03-01", confidence: "low" },
		});
		try {
			const report = scanBrainMetadata(join(dir, ".harness"), {
				now: new Date("2026-04-16"),
			});
			expect(report.totalDomains).toBe(2);
			expect(report.totalFiles).toBe(2);
			expect(report.freshFiles.length).toBeGreaterThanOrEqual(1);
			expect(report.staleFiles.length).toBeGreaterThanOrEqual(1);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("rankDomainsByTrust", () => {
	it("ranks fresh high-confidence above stale low-confidence", () => {
		const metadata = [
			{
				path: "a",
				domain: "stale",
				lastVerified: "2026-01-01",
				verificationSource: "manual",
				confidence: "low",
				owner: "test",
				fileModifiedAt: null,
				stalenessScore: 0.8,
				needsReview: true,
				stalenessReason: "old",
			},
			{
				path: "b",
				domain: "fresh",
				lastVerified: "2026-04-15",
				verificationSource: "manual",
				confidence: "high",
				owner: "test",
				fileModifiedAt: null,
				stalenessScore: 0.03,
				needsReview: false,
				stalenessReason: "fresh",
			},
		];
		const ranked = rankDomainsByTrust(metadata);
		expect(ranked[0]?.domain).toBe("fresh");
		expect(ranked[1]?.domain).toBe("stale");
	});
});
