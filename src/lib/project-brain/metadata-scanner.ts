/**
 * Metadata scanner for Project Brain trust/freshness tracking (JSC-188).
 *
 * Reads metadata from knowledge files and computes staleness scores.
 * Supports metadata-aware ranking for brain query and preflight.
 *
 * @module lib/project-brain/metadata-scanner
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface KnowledgeMetadata {
	/** File path relative to .harness/ */
	path: string;
	/** Domain this file belongs to */
	domain: string;
	/** Last verified date (ISO format) or null if missing */
	lastVerified: string | null;
	/** Verification source: manual, automated, codex-learn, or null */
	verificationSource: string | null;
	/** Confidence: high, medium, low, or null */
	confidence: string | null;
	/** Owner or null */
	owner: string | null;
	/** File modification time */
	fileModifiedAt: string | null;
	/** Computed staleness score (0 = fresh, 1 = very stale) */
	stalenessScore: number;
	/** Whether this entry needs review */
	needsReview: boolean;
	/** Human-readable staleness reason */
	stalenessReason: string;
}

export interface StalenessReport {
	/** Total domains scanned */
	totalDomains: number;
	/** Total files scanned */
	totalFiles: number;
	/** Files needing review */
	staleFiles: KnowledgeMetadata[];
	/** Fresh files */
	freshFiles: KnowledgeMetadata[];
	/** Average staleness score */
	averageStaleness: number;
	/** Staleness threshold in days */
	thresholdDays: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** Default staleness threshold: entries not verified in 30+ days are stale */
const DEFAULT_STALENESS_THRESHOLD_DAYS = 30;

const VALID_CONFIDENCE = new Set(["high", "medium", "low"]);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractMetadataField(content: string, field: string): string | null {
	const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const regex = new RegExp(`\\*\\*${escaped}:\\*\\*\\s*(.+)`, "i");
	const match = regex.exec(content);
	return match?.[1]?.trim() ?? null;
}

function computeStalenessScore(
	lastVerified: string | null,
	confidence: string | null,
	now: Date,
	thresholdDays: number,
): { score: number; reason: string; needsReview: boolean } {
	// Never verified → maximum staleness
	if (!lastVerified) {
		return {
			score: 1.0,
			reason: "Never verified — no Last verified date found",
			needsReview: true,
		};
	}

	const verifiedDate = new Date(lastVerified);
	if (Number.isNaN(verifiedDate.getTime())) {
		return {
			score: 0.9,
			reason: `Invalid Last verified date: "${lastVerified}"`,
			needsReview: true,
		};
	}

	const ageMs = now.getTime() - verifiedDate.getTime();
	const ageDays = ageMs / (1000 * 60 * 60 * 24);

	if (ageDays > thresholdDays) {
		return {
			score: Math.min(1.0, 0.5 + (ageDays - thresholdDays) / thresholdDays),
			reason: `Last verified ${Math.round(ageDays)} days ago (threshold: ${thresholdDays} days)`,
			needsReview: true,
		};
	}

	// Fresh, but low confidence might need review
	if (confidence === "low") {
		return {
			score: 0.2,
			reason: "Low confidence — consider re-verification",
			needsReview: true,
		};
	}

	return {
		score: Math.max(0, ageDays / thresholdDays) * 0.3,
		reason: `Fresh (${Math.round(ageDays)} days old)`,
		needsReview: false,
	};
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Scan a single knowledge.md file for metadata.
 */
export function scanKnowledgeMetadata(
	harnessDir: string,
	domain: string,
	filePath: string,
	options?: { thresholdDays?: number; now?: Date },
): KnowledgeMetadata {
	const fullPath = join(harnessDir, filePath);
	const now = options?.now ?? new Date();
	const thresholdDays =
		options?.thresholdDays ?? DEFAULT_STALENESS_THRESHOLD_DAYS;

	let content = "";
	let fileModifiedAt: string | null = null;

	if (existsSync(fullPath)) {
		content = readFileSync(fullPath, "utf-8");
		const stat = statSync(fullPath);
		fileModifiedAt = stat.mtime.toISOString();
	}

	const lastVerified = extractMetadataField(content, "Last verified");
	const verificationSource = extractMetadataField(
		content,
		"Verification source",
	);
	const rawConfidence = extractMetadataField(content, "Confidence");
	const confidence =
		rawConfidence && VALID_CONFIDENCE.has(rawConfidence.toLowerCase())
			? rawConfidence.toLowerCase()
			: null;
	const owner = extractMetadataField(content, "Owner");

	const { score, reason, needsReview } = computeStalenessScore(
		lastVerified,
		confidence,
		now,
		thresholdDays,
	);

	return {
		path: filePath,
		domain,
		lastVerified,
		verificationSource,
		confidence,
		owner,
		fileModifiedAt,
		stalenessScore: Math.round(score * 100) / 100,
		needsReview,
		stalenessReason: reason,
	};
}

/**
 * Scan all Project Brain knowledge files and produce a staleness report.
 */
export function scanBrainMetadata(
	harnessDir: string,
	options?: { thresholdDays?: number; now?: Date },
): StalenessReport {
	const now = options?.now ?? new Date();
	const thresholdDays =
		options?.thresholdDays ?? DEFAULT_STALENESS_THRESHOLD_DAYS;
	const knowledgeDir = join(harnessDir, "knowledge");

	const allMetadata: KnowledgeMetadata[] = [];
	let totalDomains = 0;

	if (existsSync(knowledgeDir)) {
		for (const entry of readdirSync(knowledgeDir)) {
			const entryPath = join(knowledgeDir, entry);
			if (statSync(entryPath).isDirectory()) {
				totalDomains++;
				const knowledgeFile = join("knowledge", entry, "knowledge.md");
				allMetadata.push(
					scanKnowledgeMetadata(harnessDir, entry, knowledgeFile, {
						thresholdDays,
						now,
					}),
				);
			}
		}
	}

	const staleFiles = allMetadata.filter((m) => m.needsReview);
	const freshFiles = allMetadata.filter((m) => !m.needsReview);
	const averageStaleness =
		allMetadata.length > 0
			? allMetadata.reduce((sum, m) => sum + m.stalenessScore, 0) /
				allMetadata.length
			: 0;

	return {
		totalDomains,
		totalFiles: allMetadata.length,
		staleFiles,
		freshFiles,
		averageStaleness: Math.round(averageStaleness * 100) / 100,
		thresholdDays,
	};
}

/**
 * Rank domains by trust score (higher = more trustworthy).
 *
 * Trust is the inverse of staleness, weighted by confidence.
 */
export function rankDomainsByTrust(
	metadata: KnowledgeMetadata[],
): KnowledgeMetadata[] {
	const confidenceWeight: Record<string, number> = {
		high: 1.0,
		medium: 0.7,
		low: 0.4,
	};

	return [...metadata].sort((a, b) => {
		const trustA =
			(1 - a.stalenessScore) * (confidenceWeight[a.confidence ?? "low"] ?? 0.3);
		const trustB =
			(1 - b.stalenessScore) * (confidenceWeight[b.confidence ?? "low"] ?? 0.3);
		return trustB - trustA;
	});
}
