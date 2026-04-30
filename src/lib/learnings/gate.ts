import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildGateResult } from "../output/normalise-core.js";
import type { GateFinding, GateResult } from "../output/types.js";
import { DEFAULT_CODERABBIT_LOCAL_ARTIFACT } from "./artifact-io.js";
import { matchLearningToFile } from "./fuzzy-match.js";
import {
	type LearningOverrideMode,
	type OverrideAwareGateFinding,
	applyLearningOverrides,
	loadLearningOverrides,
} from "./overrides.js";
import type {
	LearningArtifactLoadResult,
	LearningImportArtifact,
	LearningImportWarning,
	LearningItem,
} from "./types.js";

const GATE_NAME = "learnings-gate";

/** Options for the exact-file learning gate. */
export interface LearningsGateOptions {
	/** Imported learning artifact path. */
	source?: string;
	/** Changed files or explicit files to match. */
	files: string[];
	/** Repository root used for relative artifact resolution. */
	repoRoot?: string;
	/** Optional learning override file. */
	overrides?: string;
	/** Expired override handling mode. */
	overrideMode?: LearningOverrideMode;
	/** Clock override for deterministic tests. */
	now?: Date;
}

/** Load a local learning artifact and emit stale-source warnings when detectable. */
export function loadLearningArtifact(
	sourcePath = DEFAULT_CODERABBIT_LOCAL_ARTIFACT,
	repoRoot = process.cwd(),
): LearningArtifactLoadResult {
	const resolvedSource = resolve(repoRoot, sourcePath);
	if (!existsSync(resolvedSource)) {
		return {
			ok: false,
			code: "learnings.artifact_missing",
			message: `Learning artifact not found: ${sourcePath}`,
			fix: "Run harness learnings import --provider coderabbit-csv --source <learnings.csv> --repo <repo> --json.",
		};
	}
	let artifact: LearningImportArtifact;
	try {
		artifact = JSON.parse(
			readFileSync(resolvedSource, "utf-8"),
		) as LearningImportArtifact;
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		return {
			ok: false,
			code: "learnings.artifact_invalid",
			message: `Failed to read learning artifact at ${sourcePath}: ${detail}`,
			fix: "Re-run harness learnings import --provider coderabbit-csv --source <learnings.csv> --repo <repo> --json.",
		};
	}
	return {
		ok: true,
		artifact,
		warnings: detectSourceWarnings(artifact, resolvedSource),
	};
}

/** Run the Phase 1B exact-file learnings gate. */
export function runLearningsGate(options: LearningsGateOptions): GateResult {
	const files = normalizeFiles(options.files);
	const loaded = loadLearningArtifact(options.source, options.repoRoot);
	if (!loaded.ok) {
		const finding: GateFinding = {
			id:
				loaded.code === "learnings.artifact_missing"
					? "learnings-gate.artifact.missing"
					: "learnings-gate.artifact.invalid",
			severity: "error",
			gate: GATE_NAME,
			message: loaded.message,
			baseline: false,
			fix: {
				manual:
					loaded.fix ??
					"Run harness learnings import before relying on learnings gate results.",
				suppressible: false,
			},
		};
		return buildGateResult({
			gate: GATE_NAME,
			status: "fail",
			findings: [finding],
			decision: {
				evidenceRef: [
					`artifact:${options.source ?? DEFAULT_CODERABBIT_LOCAL_ARTIFACT}`,
				],
			},
		});
	}

	const overrides = loadLearningOverrides({
		...(options.overrides ? { path: options.overrides } : {}),
		...(options.repoRoot ? { repoRoot: options.repoRoot } : {}),
		...(options.overrideMode ? { mode: options.overrideMode } : {}),
		...(options.now ? { now: options.now } : {}),
	});
	if (!overrides.ok) {
		return buildGateResult({
			gate: GATE_NAME,
			status: "fail",
			findings: overrides.findings,
			decision: {
				evidenceRef: [`overrides:${options.overrides ?? "not-configured"}`],
			},
		});
	}

	const learningFindings = applyLearningOverrides({
		findings: buildLearningFindings(loaded.artifact.items, files),
		overrides: overrides.overrides,
		...(options.now ? { now: options.now } : {}),
	});
	const sourceFindings = loaded.warnings.map(sourceWarningToFinding);
	const findings = [
		...learningFindings,
		...sourceFindings,
		...overrides.warnings,
	].sort(sortFindings);
	const status = findings.some((finding) => finding.severity === "error")
		? "fail"
		: findings.some((finding) => finding.severity === "warning")
			? "warn"
			: "pass";

	return buildGateResult({
		gate: GATE_NAME,
		status,
		findings,
		decision: {
			evidenceRef: buildEvidenceRefs(loaded.artifact, findings),
		},
		meta: {
			source: options.source ?? DEFAULT_CODERABBIT_LOCAL_ARTIFACT,
			matchedFiles: files,
			repository: loaded.artifact.repository,
			overrideSource: options.overrides ?? null,
			overrideMode: options.overrideMode ?? "strict",
		},
	});
}

function buildLearningFindings(
	items: LearningItem[],
	files: string[],
): OverrideAwareGateFinding[] {
	const findings: OverrideAwareGateFinding[] = [];
	for (const item of items) {
		for (const file of files) {
			const match = matchLearningToFile(item, file);
			if (!match) continue;
			findings.push({
				id: `learnings-gate.learning.${item.id}`,
				severity: deriveFindingSeverity(item, match.advisoryOnly),
				gate: GATE_NAME,
				message: `${item.learning} (usage: ${item.usage})`,
				path: file,
				baseline: false,
				fix: {
					manual: buildManualFix(item),
					suppressible: true,
				},
				overrideSupport: {
					suppressible: true,
				},
				match: {
					kind: match.kind,
					confidence: match.confidence,
					reason: match.reason,
					advisoryOnly: match.advisoryOnly,
					falsePositiveCandidate: match.falsePositiveCandidate,
				},
			});
		}
	}
	return findings;
}

/** Return true when a normalized learning applies to a changed file. */
export function learningMatchesFile(item: LearningItem, file: string): boolean {
	return matchLearningToFile(item, normalizeFile(file)) !== undefined;
}

function deriveFindingSeverity(
	item: LearningItem,
	advisoryOnly: boolean,
): GateFinding["severity"] {
	const severity = item.enforcement === "none" ? "info" : item.enforcement;
	if (!advisoryOnly) return severity;
	return severity === "error" ? "warning" : severity;
}

function sourceWarningToFinding(warning: LearningImportWarning): GateFinding {
	const sourceCode = warning.code
		.replace(/^learnings\.source_?/, "")
		.replace(/_/g, ".");

	return {
		id: `learnings-gate.source.${sourceCode}`,
		severity: "warning",
		gate: GATE_NAME,
		message: warning.message,
		baseline: false,
		fix: {
			manual:
				"Re-run harness learnings import from the latest CodeRabbit CSV export.",
			suppressible: false,
		},
	};
}

function detectSourceWarnings(
	artifact: LearningImportArtifact,
	artifactPath: string,
): LearningImportWarning[] {
	if (!artifact.source.uri.startsWith("file:")) return [];
	let sourcePath: string;
	try {
		sourcePath = fileURLToPath(artifact.source.uri);
	} catch {
		return [];
	}
	if (!existsSync(sourcePath)) {
		return [
			{
				code: "learnings.source_unavailable",
				message:
					"Imported CodeRabbit CSV source is no longer available locally; gate results use the existing local artifact.",
			},
		];
	}
	const sourceMtime = statSync(sourcePath).mtimeMs;
	const artifactMtime = statSync(artifactPath).mtimeMs;
	if (sourceMtime > artifactMtime) {
		return [
			{
				code: "learnings.source_stale",
				message:
					"Imported CodeRabbit CSV source is newer than the local learning artifact; re-import before relying on gate results.",
			},
		];
	}
	return [];
}

function buildManualFix(item: LearningItem): string {
	if (item.classification === "guardrail" && item.file?.includes("docs/")) {
		return "Apply the learned docs guardrail before review; keep machine-readable metadata in frontmatter or source data instead of duplicating it in prose.";
	}
	return "Review the matched learning and update the changed file or record an explicit exception before review.";
}

function buildEvidenceRefs(
	artifact: LearningImportArtifact,
	findings: GateFinding[],
): string[] {
	const refs: string[] = [];
	for (const finding of findings) {
		const item = artifact.items.find((candidate) =>
			finding.id.endsWith(candidate.id),
		);
		if (!item) continue;
		refs.push(`${item.source.kind}:${item.source.uri}#row=${item.source.row}`);
		if (item.githubUrl) refs.push(`github_pr:${item.githubUrl}`);
	}
	return refs.length > 0 ? [...new Set(refs)] : ["gate:learnings-gate"];
}

function normalizeFiles(files: string[]): string[] {
	return [...new Set(files.map(normalizeFile).filter(Boolean))].sort();
}

function normalizeFile(file: string): string {
	return file.trim().replace(/\\/g, "/").replace(/^\.\//, "");
}

function sortFindings(a: GateFinding, b: GateFinding): number {
	return (
		(a.path ?? "").localeCompare(b.path ?? "") ||
		severityRank(a.severity) - severityRank(b.severity) ||
		a.id.localeCompare(b.id)
	);
}

function severityRank(severity: GateFinding["severity"]): number {
	return severity === "error" ? 0 : severity === "warning" ? 1 : 2;
}
