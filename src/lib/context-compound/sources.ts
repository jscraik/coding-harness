import { createHash } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import type { DocumentMetadata } from "./types.js";

/** Context Source Authority. */
export type ContextSourceAuthority = "canonical" | "governed" | "supporting";
/** Context Source Kind. */
export type ContextSourceKind = "file" | "directory";
/** Context Staleness State. */
export type ContextStalenessState = "fresh" | "unknown" | "stale";

/** Context Source Definition. */
export interface ContextSourceDefinition {
	id: string;
	path: string;
	kind: ContextSourceKind;
	authority: ContextSourceAuthority;
	documentType: DocumentMetadata["type"];
}

/** Context Source Document. */
export interface ContextSourceDocument {
	filepath: string;
	relativePath: string;
	type: DocumentMetadata["type"];
	authority: ContextSourceAuthority;
	family: string;
	stalenessState: ContextStalenessState;
}

/** Context Source Inventory Entry. */
export interface ContextSourceInventoryEntry {
	id: string;
	path: string;
	kind: ContextSourceKind;
	authority: ContextSourceAuthority;
	exists: boolean;
	documentCount: number;
	indexedDocumentCount: number;
	stalenessState: ContextStalenessState;
	documentPaths: string[];
}

/** Context Source Inventory. */
export interface ContextSourceInventory {
	schemaVersion: "context-source-inventory/v1";
	generatedAt: string;
	summary: {
		sourceCount: number;
		authoritativeSourceCount: number;
		supportingSourceCount: number;
		documentCount: number;
		indexedDocumentCount: number;
	};
	sources: ContextSourceInventoryEntry[];
}

const STALE_DAYS = 180;

export const CONTEXT_SOURCE_DEFINITIONS: ContextSourceDefinition[] = [
	{
		id: "readme",
		path: "README.md",
		kind: "file",
		authority: "canonical",
		documentType: "reference",
	},
	{
		id: "agents",
		path: "AGENTS.md",
		kind: "file",
		authority: "canonical",
		documentType: "reference",
	},
	{
		id: "contributing",
		path: "CONTRIBUTING.md",
		kind: "file",
		authority: "canonical",
		documentType: "reference",
	},
	{
		id: "diagram_context",
		path: "AI/context/diagram-context.md",
		kind: "file",
		authority: "canonical",
		documentType: "reference",
	},
	{
		id: "docs_agents",
		path: "docs/agents",
		kind: "directory",
		authority: "governed",
		documentType: "reference",
	},
	{
		id: "docs_adr",
		path: "docs/adr",
		kind: "directory",
		authority: "governed",
		documentType: "reference",
	},
	{
		id: "docs_specs",
		path: "docs/specs",
		kind: "directory",
		authority: "governed",
		documentType: "reference",
	},
	{
		id: "docs_brainstorms",
		path: "docs/brainstorms",
		kind: "directory",
		authority: "supporting",
		documentType: "brainstorm",
	},
	{
		id: "docs_plans",
		path: "docs/plans",
		kind: "directory",
		authority: "supporting",
		documentType: "plan",
	},
	{
		id: "docs_solutions",
		path: "docs/solutions",
		kind: "directory",
		authority: "supporting",
		documentType: "solution",
	},
];

function parseFrontmatterDate(content: string): string | null {
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n[\s\S]*)?$/);
	if (!match?.[1]) {
		return null;
	}
	for (const line of match[1].split(/\r?\n/)) {
		const [key, ...rest] = line.split(":");
		if (key?.trim() !== "date") {
			continue;
		}
		const value = rest
			.join(":")
			.trim()
			.replace(/^["']|["']$/g, "");
		return value.length > 0 ? value : null;
	}
	return null;
}

function toStalenessState(
	filepath: string,
	content?: string,
): ContextStalenessState {
	const fileContent = content ?? readFileSync(filepath, "utf-8");
	const dateValue = parseFrontmatterDate(fileContent);
	if (!dateValue) {
		return "unknown";
	}
	const parsed = new Date(dateValue);
	if (Number.isNaN(parsed.valueOf())) {
		return "unknown";
	}
	const ageMs = Date.now() - parsed.valueOf();
	const ageDays = ageMs / (1000 * 60 * 60 * 24);
	return ageDays > STALE_DAYS ? "stale" : "fresh";
}

function aggregateStaleness(
	values: ContextStalenessState[],
): ContextStalenessState {
	if (values.length === 0) {
		return "unknown";
	}
	if (values.includes("fresh")) {
		return "fresh";
	}
	if (values.includes("stale")) {
		return "stale";
	}
	return "unknown";
}

function discoverMarkdownFiles(dir: string): string[] {
	if (!existsSync(dir)) {
		return [];
	}
	const entries = readdirSync(dir, { withFileTypes: true });
	const files: string[] = [];
	for (const entry of entries) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...discoverMarkdownFiles(fullPath));
			continue;
		}
		if (entry.isFile() && entry.name.endsWith(".md")) {
			files.push(fullPath);
		}
	}
	return files.sort();
}

/** Discover Context Source Documents. */
export function discoverContextSourceDocuments(
	baseDir: string,
): ContextSourceDocument[] {
	return CONTEXT_SOURCE_DEFINITIONS.flatMap((definition) => {
		const absolutePath = join(baseDir, definition.path);
		const files =
			definition.kind === "file"
				? existsSync(absolutePath)
					? [absolutePath]
					: []
				: discoverMarkdownFiles(absolutePath);
		return files.map((filepath) => ({
			filepath,
			relativePath: relative(baseDir, filepath).split("\\").join("/"),
			type: definition.documentType,
			authority: definition.authority,
			family: definition.id,
			stalenessState: toStalenessState(filepath),
		}));
	});
}

/** Build Context Source Inventory. */
export function buildContextSourceInventory(
	baseDir: string,
	indexedRelativePaths?: Iterable<string>,
): ContextSourceInventory {
	const indexedSet = new Set(
		Array.from(indexedRelativePaths ?? []).map((value) =>
			value.replace(/\\/g, "/"),
		),
	);

	const sources = CONTEXT_SOURCE_DEFINITIONS.map((definition) => {
		const absolutePath = join(baseDir, definition.path);
		const exists = existsSync(absolutePath);
		const documentPaths =
			definition.kind === "file"
				? exists
					? [definition.path]
					: []
				: discoverMarkdownFiles(absolutePath).map((filepath) =>
						relative(baseDir, filepath).split("\\").join("/"),
					);
		const stalenessValues = documentPaths.map((relativePath) =>
			toStalenessState(join(baseDir, relativePath)),
		);
		return {
			id: definition.id,
			path: definition.path,
			kind: definition.kind,
			authority: definition.authority,
			exists,
			documentCount: documentPaths.length,
			indexedDocumentCount: documentPaths.filter((relativePath) =>
				indexedSet.has(relativePath),
			).length,
			stalenessState: aggregateStaleness(stalenessValues),
			documentPaths,
		} satisfies ContextSourceInventoryEntry;
	});

	return {
		schemaVersion: "context-source-inventory/v1",
		generatedAt: new Date().toISOString(),
		summary: {
			sourceCount: sources.length,
			authoritativeSourceCount: sources.filter(
				(source) => source.authority !== "supporting",
			).length,
			supportingSourceCount: sources.filter(
				(source) => source.authority === "supporting",
			).length,
			documentCount: sources.reduce(
				(total, source) => total + source.documentCount,
				0,
			),
			indexedDocumentCount: sources.reduce(
				(total, source) => total + source.indexedDocumentCount,
				0,
			),
		},
		sources,
	};
}

export const CONTEXT_SOURCE_INVENTORY_PATH =
	"artifacts/context-integrity/index-source-inventory.json";

/** Write Context Source Inventory. */
export function writeContextSourceInventory(
	baseDir: string,
	indexedRelativePaths?: Iterable<string>,
): {
	path: string;
	report: ContextSourceInventory;
	checksum: string;
} {
	const report = buildContextSourceInventory(baseDir, indexedRelativePaths);
	const outputPath = join(baseDir, CONTEXT_SOURCE_INVENTORY_PATH);
	mkdirSync(dirname(outputPath), { recursive: true });
	const serialized = `${JSON.stringify(report, null, 2)}\n`;
	writeFileSync(outputPath, serialized, "utf-8");
	return {
		path: outputPath,
		report,
		checksum: createHash("sha256").update(serialized).digest("hex"),
	};
}

/** Read Context Source Inventory. */
export function readContextSourceInventory(
	baseDir: string,
): ContextSourceInventory | null {
	const outputPath = join(baseDir, CONTEXT_SOURCE_INVENTORY_PATH);
	if (!existsSync(outputPath)) {
		return null;
	}
	try {
		const parsed = JSON.parse(
			readFileSync(outputPath, "utf-8"),
		) as ContextSourceInventory;
		if (
			parsed?.schemaVersion === "context-source-inventory/v1" &&
			Array.isArray(parsed.sources)
		) {
			return parsed;
		}
	} catch {
		return null;
	}
	return null;
}

/** Compute Artifact Checksum. */
export function computeArtifactChecksum(path: string): string {
	const content = readFileSync(path, "utf-8");
	return createHash("sha256").update(content).digest("hex");
}

/** Summarize Artifact Window. */
export function summarizeArtifactWindow(paths: string[]): {
	latestMtimeMs: number | null;
	oldestMtimeMs: number | null;
} {
	const mtimes = paths
		.filter((path) => existsSync(path))
		.map((path) => statSync(path).mtimeMs);
	if (mtimes.length === 0) {
		return { latestMtimeMs: null, oldestMtimeMs: null };
	}
	return {
		latestMtimeMs: Math.max(...mtimes),
		oldestMtimeMs: Math.min(...mtimes),
	};
}
