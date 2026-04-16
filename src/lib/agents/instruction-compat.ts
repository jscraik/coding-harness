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
	/** Required header markers */
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readFileContent(repoRoot: string, filePath: string): string | null {
	const fullPath = join(repoRoot, filePath);
	if (!existsSync(fullPath)) return null;
	try {
		return readFileSync(fullPath, "utf-8");
	} catch {
		return null;
	}
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Get agent surfaces that exist in the repository.
 */
export function detectPresentSurfaces(
	repoRoot: string,
): AgentInstructionSurface[] {
	return AGENT_SURFACES.filter((surface) =>
		existsSync(join(repoRoot, surface.filePath)),
	);
}

/**
 * Validate instruction consistency across agent surfaces.
 *
 * Checks that:
 * 1. The canonical source (AGENTS.md) exists
 * 2. Derived files reference the canonical source
 * 3. No derived file duplicates canonical content verbatim
 */
export function validateInstructionConsistency(
	repoRoot: string,
): InstructionConsistencyReport {
	const findings: InstructionConsistencyFinding[] = [];
	const presentSurfaces = detectPresentSurfaces(repoRoot);

	const canonicalSurface = AGENT_SURFACES.find((s) => s.role === "canonical");
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
				},
			],
		};
	}

	const canonicalContent = readFileContent(repoRoot, canonicalSurface.filePath);
	if (canonicalContent === null) {
		findings.push({
			severity: "error",
			file: canonicalSurface.filePath,
			message: "Canonical instruction source (AGENTS.md) does not exist",
			fix: "Create AGENTS.md with project instructions",
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
		if (content === null) continue;

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

		const canonicalLines = canonicalContent
			.split("\n")
			.filter((l) => l.trim().length > 0);
		const derivedLines = content.split("\n").filter((l) => l.trim().length > 0);

		let overlapCount = 0;
		const canonicalSet = new Set(canonicalLines);
		for (const line of derivedLines) {
			if (canonicalSet.has(line)) overlapCount++;
		}

		const overlapRatio =
			derivedLines.length > 0 ? overlapCount / derivedLines.length : 0;
		if (overlapRatio > 0.8) {
			findings.push({
				severity: "warning",
				file: surface.filePath,
				message: `Derived file has ${Math.round(overlapRatio * 100)}% line overlap with canonical source — should be derived, not duplicated`,
				fix: "Replace duplicated content with an import/reference to AGENTS.md",
			});
		}
	}

	const missingSurfaceLabels: string[] = [];
	for (const surface of AGENT_SURFACES) {
		if (
			surface.role === "derived" &&
			!existsSync(join(repoRoot, surface.filePath))
		) {
			missingSurfaceLabels.push(`${surface.agent}: ${surface.filePath}`);
		}
	}

	if (missingSurfaceLabels.length > 0) {
		findings.push({
			severity: "info",
			file: "(multiple)",
			message: `Derived instruction surfaces not present: ${missingSurfaceLabels.join(", ")}`,
			fix: "Run `harness init` or create these files with references to AGENTS.md",
		});
	}

	return {
		consistent: !findings.some((f) => f.severity === "error"),
		surfacesChecked: presentSurfaces.length,
		findings,
	};
}

/**
 * Generate a derived instruction file header for a given agent ecosystem.
 */
export function generateDerivedHeader(agent: AgentEcosystem): string {
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
