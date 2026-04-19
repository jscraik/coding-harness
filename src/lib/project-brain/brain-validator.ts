/**
 * Project Brain v1 contract validator (JSC-183).
 *
 * Validates Project Brain artifacts against the v1 contract schema.
 * Reports missing files, incomplete metadata, placeholder content,
 * and coverage gaps.
 *
 * @module lib/project-brain/brain-validator
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BrainValidationSeverity = "error" | "warning" | "info";

export interface BrainValidationFinding {
	/** File path relative to .harness/ */
	path: string;
	/** Validation severity */
	severity: BrainValidationSeverity;
	/** Field or section that failed validation */
	field: string;
	/** Human-readable description */
	message: string;
}

export interface BrainValidationResult {
	/** Whether the brain passes all required validations */
	valid: boolean;
	/** Total files found */
	filesScanned: number;
	/** All findings */
	findings: BrainValidationFinding[];
	/** Summary counts */
	summary: {
		errors: number;
		warnings: number;
		info: number;
		missingFiles: number;
		placeholderCount: number;
		missingMetadata: number;
	};
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REQUIRED_DOMAIN_FILES = [
	"knowledge.md",
	"hypotheses.md",
	"rules.md",
] as const;

const REQUIRED_METADATA_FIELDS = [
	"Last verified",
	"Verification source",
	"Confidence",
	"Owner",
] as const;

const PLACEHOLDER_PATTERNS = [
	/\{describe\s+focus\}/i,
	/\(none\s+yet\)/i,
	/\{specify\}/i,
	/\{describe\s+\w+\}/i,
] as const;

const VALID_CONFIDENCE_LEVELS = new Set(["high", "medium", "low"]);
const VALID_VERIFICATION_SOURCES = new Set([
	"manual",
	"automated",
	"codex-learn",
]);

const REQUIRED_ROOT_FILES = [
	"knowledge/INDEX.md",
	"quality/criteria.md",
	"review-log.md",
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function matchesPlaceholder(text: string): boolean {
	return PLACEHOLDER_PATTERNS.some((p) => p.test(text));
}

function extractMetadataValue(content: string, field: string): string | null {
	const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const regex = new RegExp(`\\*\\*${escaped}:\\*\\*\\s*(.+)`, "i");
	const match = regex.exec(content);
	return match?.[1]?.trim() ?? null;
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

function validateIndexMd(
	harnessDir: string,
	findings: BrainValidationFinding[],
): void {
	const indexPath = join(harnessDir, "knowledge", "INDEX.md");
	if (!existsSync(indexPath)) {
		findings.push({
			path: "knowledge/INDEX.md",
			severity: "error",
			field: "file",
			message: "Required INDEX.md file is missing",
		});
		return;
	}

	const content = readFileSync(indexPath, "utf-8");

	// Check for placeholder domain focus (handles [name](./link/) markdown format)
	const domainRowRegex = /\|\s*\[([^\]]+)\]\([^)]*\)\s*\|\s*([^|]+)\s*\|/g;
	for (const rowMatch of content.matchAll(domainRowRegex)) {
		const domain = rowMatch[1];
		const focus = rowMatch[2];
		if (domain && focus && matchesPlaceholder(focus)) {
			findings.push({
				path: "knowledge/INDEX.md",
				severity: "warning",
				field: `domain:${domain}:focus`,
				message: `Domain "${domain}" has placeholder focus: "${focus.trim()}"`,
			});
		}
	}

	// Check last updated date
	const dateMatch = /\*\*Last updated:\*\*\s*(\d{4}-\d{2}-\d{2})/.exec(content);
	if (!dateMatch) {
		findings.push({
			path: "knowledge/INDEX.md",
			severity: "error",
			field: "Last updated",
			message: "Missing or invalid Last updated date",
		});
	}
}

function validateDomainFile(
	harnessDir: string,
	domain: string,
	fileName: string,
	findings: BrainValidationFinding[],
): void {
	const filePath = join("knowledge", domain, fileName);
	const fullPath = join(harnessDir, filePath);

	if (!existsSync(fullPath)) {
		findings.push({
			path: filePath,
			severity: "error",
			field: "file",
			message: `Required domain file missing: ${filePath}`,
		});
		return;
	}

	const content = readFileSync(fullPath, "utf-8");

	// Check for placeholder content
	if (matchesPlaceholder(content)) {
		findings.push({
			path: filePath,
			severity: "warning",
			field: "content",
			message: "File contains placeholder content",
		});
	}

	// Only validate metadata on knowledge.md
	if (fileName === "knowledge.md") {
		for (const field of REQUIRED_METADATA_FIELDS) {
			const value = extractMetadataValue(content, field);
			if (!value || matchesPlaceholder(value)) {
				findings.push({
					path: filePath,
					severity: "warning",
					field,
					message: `Missing or placeholder metadata: ${field}`,
				});
			} else if (field === "Confidence") {
				const normalized = value.toLowerCase();
				if (!VALID_CONFIDENCE_LEVELS.has(normalized)) {
					findings.push({
						path: filePath,
						severity: "error",
						field: "Confidence",
						message: `Invalid confidence level: "${value}". Must be high, medium, or low.`,
					});
				}
			} else if (field === "Verification source") {
				const normalized = value.toLowerCase();
				if (!VALID_VERIFICATION_SOURCES.has(normalized)) {
					findings.push({
						path: filePath,
						severity: "warning",
						field: "Verification source",
						message: `Unknown verification source: "${value}". Expected: manual, automated, or codex-learn.`,
					});
				}
			}
		}
	}
}

function validateQualityCriteria(
	harnessDir: string,
	findings: BrainValidationFinding[],
): void {
	const filePath = join(harnessDir, "quality", "criteria.md");
	if (!existsSync(filePath)) {
		findings.push({
			path: "quality/criteria.md",
			severity: "error",
			field: "file",
			message: "Required quality criteria file is missing",
		});
		return;
	}

	const content = readFileSync(filePath, "utf-8");

	if (matchesPlaceholder(content)) {
		findings.push({
			path: "quality/criteria.md",
			severity: "warning",
			field: "content",
			message: "Quality criteria contains placeholder content",
		});
	}

	// Check for at least one gate
	if (!content.includes("Q-") && !content.includes("Gate")) {
		findings.push({
			path: "quality/criteria.md",
			severity: "warning",
			field: "gates",
			message: "No quality gates defined",
		});
	}
}

function validateReviewLog(
	harnessDir: string,
	findings: BrainValidationFinding[],
): void {
	const filePath = join(harnessDir, "review-log.md");
	if (!existsSync(filePath)) {
		findings.push({
			path: "review-log.md",
			severity: "error",
			field: "file",
			message: "Required review log file is missing",
		});
		return;
	}

	const content = readFileSync(filePath, "utf-8");

	// Check for at least one review entry (date pattern)
	if (!/\d{4}-\d{2}-\d{2}/.test(content)) {
		findings.push({
			path: "review-log.md",
			severity: "info",
			field: "entries",
			message: "No review entries recorded yet",
		});
	}
}

// ---------------------------------------------------------------------------
// Main validator
// ---------------------------------------------------------------------------

/**
 * Validate all Project Brain artifacts against the v1 contract.
 *
 * @param harnessDir - Path to the .harness directory
 * @returns Validation result with findings and summary
 */
export function validateProjectBrain(
	harnessDir: string,
): BrainValidationResult {
	const findings: BrainValidationFinding[] = [];
	let filesScanned = 0;

	// Check harness directory exists
	if (!existsSync(harnessDir)) {
		findings.push({
			path: ".harness",
			severity: "error",
			field: "directory",
			message: "No .harness directory found",
		});
		return {
			valid: false,
			filesScanned: 0,
			findings,
			summary: {
				errors: 1,
				warnings: 0,
				info: 0,
				missingFiles: 1,
				placeholderCount: 0,
				missingMetadata: 0,
			},
		};
	}

	// Validate root files
	for (const requiredFile of REQUIRED_ROOT_FILES) {
		if (existsSync(join(harnessDir, requiredFile))) {
			filesScanned++;
		}
	}

	validateIndexMd(harnessDir, findings);
	validateQualityCriteria(harnessDir, findings);
	validateReviewLog(harnessDir, findings);

	// Validate domain files
	const knowledgeDir = join(harnessDir, "knowledge");
	if (existsSync(knowledgeDir)) {
		for (const entry of readdirSync(knowledgeDir)) {
			const entryPath = join(knowledgeDir, entry);
			if (statSync(entryPath).isDirectory()) {
				for (const domainFile of REQUIRED_DOMAIN_FILES) {
					validateDomainFile(harnessDir, entry, domainFile, findings);
					filesScanned++;
				}
			}
		}
	}

	// Compute summary
	const errors = findings.filter((f) => f.severity === "error").length;
	const warnings = findings.filter((f) => f.severity === "warning").length;
	const info = findings.filter((f) => f.severity === "info").length;
	const missingFiles = findings.filter((f) => f.field === "file").length;
	const placeholderCount = findings.filter(
		(f) => f.field === "content" || f.field?.includes("focus"),
	).length;
	const missingMetadata = findings.filter((f) =>
		(REQUIRED_METADATA_FIELDS as readonly string[]).includes(f.field),
	).length;

	return {
		valid: errors === 0,
		filesScanned,
		findings,
		summary: {
			errors,
			warnings,
			info,
			missingFiles,
			placeholderCount,
			missingMetadata,
		},
	};
}
