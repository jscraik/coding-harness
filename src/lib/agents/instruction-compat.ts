/**
 * Cross-agent instruction compatibility (JSC-125).
 *
 * Defines the canonical instruction source model, validates consistency
 * between agent-specific instruction files, and generates derived file
 * headers from the canonical source.
 *
 * Model:
 * - AGENTS.md is the canonical cross-agent instruction source
 * - Agent-specific files (CLAUDE.md, GEMINI.md, .cursorrules) are derived
 * - Each derived file declares its canonical source and import strategy
 * - Inconsistencies between canonical and derived files are detectable
 *
 * @module lib/agents/instruction-compat
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ─── Types ───────────────────────────────────────────────────────────────────

export type AgentEcosystem =
	| "codex"
	| "claude"
	| "gemini"
	| "cursor"
	| "windsurf"
	| "copilot";

export interface AgentInstructionSurface {
	/** Agent ecosystem */
	agent: AgentEcosystem;
	/** File path relative to repo root */
	filePath: string;
	/** How this agent discovers the file */
	discovery: "auto" | "configured";
	/** Whether this file should be canonical or derived */
	role: "canonical" | "derived";
	/** Header marker expected at the start of this surface (for format validation/parity checks). */
	headerMarker: string;
}

export interface InstructionConsistencyFinding {
	/** Finding severity */
	severity: "error" | "warning" | "info";
	/** File with the issue */
	file: string;
	/** Description */
	message: string;
	/** Suggested fix */
	fix?: string;
}

export interface InstructionConsistencyReport {
	/** Whether all instruction surfaces are consistent */
	consistent: boolean;
	/** Total surfaces checked */
	surfacesChecked: number;
	/** Findings */
	findings: InstructionConsistencyFinding[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Known agent instruction surfaces and their compatibility rules.
 */
export const AGENT_SURFACES: AgentInstructionSurface[] = [
	{
		agent: "codex",
		filePath: "AGENTS.md",
		discovery: "auto",
		role: "canonical",
		headerMarker: "#",
	},
	{
		agent: "claude",
		filePath: "CLAUDE.md",
		discovery: "auto",
		role: "derived",
		headerMarker: "#",
	},
	{
		agent: "gemini",
		filePath: "GEMINI.md",
		discovery: "auto",
		role: "derived",
		headerMarker: "#",
	},
	{
		agent: "cursor",
		filePath: ".cursorrules",
		discovery: "auto",
		role: "derived",
		headerMarker: "#",
	},
	{
		agent: "windsurf",
		filePath: ".windsurfrules",
		discovery: "auto",
		role: "derived",
		headerMarker: "#",
	},
	{
		agent: "copilot",
		filePath: ".github/copilot-instructions.md",
		discovery: "configured",
		role: "derived",
		headerMarker: "#",
	},
];

/**
 * Required markers that indicate a derived file references its canonical source.
 */
const CANONICAL_REF_MARKERS = [
	"canonical source",
	"agents.md",
	"@./agents.md",
	"@agents.md",
];

/**
 * Read a file under a repository root and return its UTF-8 text content.
 *
 * @param repoRoot - Repository root directory used as the base path
 * @param filePath - Repository-relative path to the file
 * @returns The file contents decoded as UTF-8, or `null` if the file does not exist or cannot be read
 */

function readFileContent(repoRoot: string, filePath: string): string | null {
	const fullPath = join(repoRoot, filePath);
	if (!existsSync(fullPath)) return null;
	try {
		return readFileSync(fullPath, "utf-8");
	} catch (error: unknown) {
		throw new Error(
			`Failed to read instruction surface: repoRoot=${repoRoot} filePath=${filePath} fullPath=${fullPath}`,
			{ cause: error },
		);
	}
}

function checkDerivedReferences(
	content: string,
	surface: AgentInstructionSurface,
	findings: InstructionConsistencyFinding[],
): void {
	const contentLower = content.toLowerCase();
	const hasCanonicalRef = CANONICAL_REF_MARKERS.some((marker) =>
		contentLower.includes(marker),
	);
	if (!hasCanonicalRef) {
		findings.push({
			severity: "warning",
			file: surface.filePath,
			message:
				"Derived instruction file does not reference canonical source (AGENTS.md)",
			fix: 'Add a "Canonical source: AGENTS.md" or "@./AGENTS.md" import directive',
		});
	}
}

function computeLineOverlap(
	canonicalContent: string,
	derivedContent: string,
): number {
	const canonicalLines = canonicalContent
		.split("\n")
		.filter((line) => line.trim().length > 0);
	const derivedLines = derivedContent
		.split("\n")
		.filter((line) => line.trim().length > 0);
	if (derivedLines.length === 0) return 0;
	const canonicalSet = new Set(canonicalLines);
	let overlapCount = 0;
	for (const line of derivedLines) {
		if (canonicalSet.has(line)) overlapCount++;
	}
	return overlapCount / derivedLines.length;
}

function collectMissingSurfaces(repoRoot: string): string[] {
	const missingSurfaceLabels: string[] = [];
	for (const surface of AGENT_SURFACES) {
		if (
			surface.role === "derived" &&
			!existsSync(join(repoRoot, surface.filePath))
		) {
			missingSurfaceLabels.push(`${surface.agent}: ${surface.filePath}`);
		}
	}
	return missingSurfaceLabels;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * List agent instruction surfaces present in the given repository.
 *
 * @param repoRoot - Filesystem root of the repository used to resolve surface file paths
 * @returns The subset of `AGENT_SURFACES` whose `filePath` exists under `repoRoot`
 */
export function detectPresentSurfaces(
	repoRoot: string,
): AgentInstructionSurface[] {
	return AGENT_SURFACES.filter((surface) =>
		existsSync(join(repoRoot, surface.filePath)),
	);
}

/**
 * Validate that repository instruction files for supported agent ecosystems exist,
 * reference the canonical source (AGENTS.md), and are not verbatim duplicates of it.
 *
 * @param repoRoot - Repository root directory used to locate instruction files
 * @returns A validation report containing:
 *  - `consistent`: `true` if there are no findings with severity `error`, `false` otherwise
 *  - `surfacesChecked`: number of detected surfaces that were examined
 *  - `findings`: list of detected issues (errors, warnings, info) with optional suggested fixes
 */
export function validateInstructionConsistency(
	repoRoot: string,
): InstructionConsistencyReport {
	const findings: InstructionConsistencyFinding[] = [];
	const presentSurfaces = detectPresentSurfaces(repoRoot);

	const canonicalSurfaces = AGENT_SURFACES.filter(
		(surface) => surface.role === "canonical",
	);
	if (canonicalSurfaces.length !== 1) {
		return {
			consistent: false,
			surfacesChecked: 0,
			findings: [
				{
					severity: "error",
					file: "AGENTS.md",
					message:
						canonicalSurfaces.length === 0
							? "Canonical instruction source (AGENTS.md) is not defined in surface map"
							: "Multiple canonical instruction sources are defined in surface map; exactly one is required",
					fix: "Keep only AGENTS.md as the single canonical surface",
				},
			],
		};
	}
	const canonicalSurface = canonicalSurfaces[0];
	if (!canonicalSurface) {
		return {
			consistent: false,
			surfacesChecked: 0,
			findings: [
				{
					severity: "error",
					file: "AGENTS.md",
					message:
						"Canonical instruction source (AGENTS.md) is not defined in surface map",
					fix: "Keep only AGENTS.md as the single canonical surface",
				},
			],
		};
	}

	const canonicalContent = readFileContent(repoRoot, canonicalSurface.filePath);
	if (canonicalContent === null) {
		findings.push({
			severity: "error",
			file: canonicalSurface.filePath,
			message:
				"Canonical instruction source (AGENTS.md) is missing or unreadable",
			fix: "Ensure AGENTS.md exists and is readable",
		});
		return {
			consistent: false,
			surfacesChecked: 0,
			findings,
		};
	}

	const derivedSurfaces = presentSurfaces.filter((s) => s.role === "derived");

	for (const surface of derivedSurfaces) {
		const content = readFileContent(repoRoot, surface.filePath);
		if (content === null) {
			findings.push({
				severity: "error",
				file: surface.filePath,
				message: "Derived instruction surface exists but could not be read",
				fix: "Check file permissions/encoding and retry consistency validation",
			});
			continue;
		}
		checkDerivedReferences(content, surface, findings);
		const overlapRatio = computeLineOverlap(canonicalContent, content);
		if (overlapRatio > 0.8) {
			findings.push({
				severity: "warning",
				file: surface.filePath,
				message: `Derived file has ${Math.round(overlapRatio * 100)}% line overlap with canonical source — should be derived, not duplicated`,
				fix: "Replace duplicated content with an import/reference to AGENTS.md",
			});
		}
	}

	const missingSurfaceLabels = collectMissingSurfaces(repoRoot);

	if (missingSurfaceLabels.length > 0) {
		findings.push({
			severity: "info",
			file: "(multiple)",
			message: `Derived instruction surfaces not present: ${missingSurfaceLabels.join(", ")}`,
			fix: "Run `harness init` or create these files with references to AGENTS.md",
		});
	}

	return {
		consistent: !findings.some(
			(f) => f.severity === "error" || f.severity === "warning",
		),
		surfacesChecked: presentSurfaces.length,
		findings,
	};
}

/**
 * Builds a standardized Markdown header for a derived instruction file for the specified agent ecosystem.
 *
 * @returns The Markdown header text to place at the top of the agent's derived instruction file.
 */
export function generateDerivedHeader(agent: AgentEcosystem): string {
	const surface = AGENT_SURFACES.find((entry) => entry.agent === agent);
	if (!surface || surface.role !== "derived") {
		throw new Error(
			`generateDerivedHeader only supports derived surfaces. Received: ${agent}`,
		);
	}
	const label = agent.charAt(0).toUpperCase() + agent.slice(1);
	return [
		`# ${label} Instructions`,
		"",
		"## Canonical source",
		"- This file is derived from `AGENTS.md` — the canonical cross-agent instruction source.",
		"- Do not edit this file directly; changes should be made to `AGENTS.md` first.",
		"- If guidance conflicts, `AGENTS.md` wins.",
		"",
		"## Imports",
		"@./AGENTS.md",
		"",
	].join("\n");
}
