import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	writeFileSync,
} from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { findRecentBrainstorms, loadBrainstorm } from "./brainstorm.js";

export interface PlanFrontmatter {
	title: string;
	date: string;
	type: "feature" | "refactor" | "bugfix" | "docs" | "architecture";
	status: "draft" | "approved" | "implemented" | "superseded";
	origin?: string; // Reference to originating brainstorm (path or topic)
	brainstormDate?: string;
	decisions?: string[]; // Carried forward from brainstorm
}

export interface PlanMetadata {
	path: string;
	frontmatter: PlanFrontmatter;
	content: string;
}

export interface CreatePlanOptions {
	title: string;
	type: PlanFrontmatter["type"];
	content: string;
	originBrainstorm?: string; // Path or topic of originating brainstorm
	basePath?: string;
	date?: Date;
}

const PLANS_DIR = "docs/plans";
const FORBIDDEN_CHARS = /[<>:""/\\|?*!.,]/g;

function parsePlanType(type: unknown): PlanFrontmatter["type"] | null {
	return type === "feature" ||
		type === "refactor" ||
		type === "bugfix" ||
		type === "docs" ||
		type === "architecture"
		? type
		: null;
}

function parsePlanStatus(status: unknown): PlanFrontmatter["status"] | null {
	return status === "draft" ||
		status === "approved" ||
		status === "implemented" ||
		status === "superseded"
		? status
		: null;
}

function toStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.filter((item): item is string => typeof item === "string");
}

function normalizePlanFrontmatter(
	frontmatter: Record<string, unknown>,
): PlanFrontmatter | null {
	const title = frontmatter.title;
	const date = frontmatter.date;
	const type = parsePlanType(frontmatter.type);
	const status = parsePlanStatus(frontmatter.status);
	if (typeof title !== "string" || title.trim().length === 0) {
		return null;
	}
	if (typeof date !== "string" || date.trim().length === 0) {
		return null;
	}
	if (!type || !status) {
		return null;
	}
	const origin =
		typeof frontmatter.origin === "string" ? frontmatter.origin : undefined;
	const brainstormDate =
		typeof frontmatter.brainstormDate === "string"
			? frontmatter.brainstormDate
			: undefined;
	const decisions = toStringArray(frontmatter.decisions);
	return {
		title: title.trim(),
		date: date.trim(),
		type,
		status,
		...(origin ? { origin } : {}),
		...(brainstormDate ? { brainstormDate } : {}),
		...(decisions.length > 0 ? { decisions } : {}),
	};
}

/**
 * Sanitize a string for use in a filename.
 */
function sanitizeFilename(name: string): string {
	return name
		.toLowerCase()
		.replace(FORBIDDEN_CHARS, "-")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

/**
 * Generate a filename for a plan artifact.
 */
export function generatePlanFilename(
	type: string,
	title: string,
	date = new Date(),
): string {
	const sanitized = sanitizeFilename(title);
	const dateStr = date.toISOString().split("T")[0];
	return `${dateStr}-${type}-${sanitized}-plan.md`;
}

/**
 * Serialize frontmatter to YAML format.
 */
function serializeFrontmatter(frontmatter: Record<string, unknown>): string {
	const lines = ["---"];

	for (const [key, value] of Object.entries(frontmatter)) {
		if (Array.isArray(value)) {
			lines.push(`${key}:`);
			for (const item of value) {
				lines.push(`  - ${item}`);
			}
		} else if (value !== undefined) {
			lines.push(`${key}: ${value}`);
		}
	}

	lines.push("---");
	return lines.join("\n");
}

/**
 * Parse frontmatter from markdown content.
 */
function parseFrontmatter(content: string): {
	frontmatter: Record<string, unknown>;
	body: string;
} {
	const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
	if (!match) {
		return { frontmatter: {}, body: content };
	}

	const frontmatter: Record<string, unknown> = {};
	const contentCapture = match[1];
	if (!contentCapture) {
		return { frontmatter: {}, body: content };
	}
	const lines = contentCapture.split("\n");
	let currentKey: string | null = null;
	let currentArray: string[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (!line) continue;
		const trimmed = line.trim();

		// Check if this is a list item
		if (trimmed.startsWith("- ") && currentKey) {
			currentArray.push(trimmed.slice(2).replace(/^["']|["']$/g, ""));
			continue;
		}

		// Save previous array if any
		if (currentKey && currentArray.length > 0) {
			frontmatter[currentKey] = currentArray;
			currentArray = [];
		}

		// Parse key-value pair
		const colonIndex = line.indexOf(":");
		if (colonIndex > 0) {
			currentKey = line.slice(0, colonIndex).trim();
			const value = line.slice(colonIndex + 1).trim();

			if (value === "") {
				// Could be start of array, check next line
				const nextLine = lines[i + 1]?.trim();
				if (nextLine?.startsWith("- ")) {
					currentArray = [];
				} else {
					frontmatter[currentKey] = "";
					currentKey = null;
				}
			} else {
				frontmatter[currentKey] = value.replace(/^["']|["']$/g, "");
				currentKey = null;
			}
		}
	}

	// Don't forget the last array
	if (currentKey && currentArray.length > 0) {
		frontmatter[currentKey] = currentArray;
	}

	const bodyContent = match[2];
	return { frontmatter, body: bodyContent ? bodyContent.trim() : "" };
}

/**
 * Find and link to a recent brainstorm if it exists.
 */
function findOriginBrainstorm(
	topic: string,
	basePath: string,
): { origin: string; brainstormDate: string; decisions: string[] } | undefined {
	const recent = findRecentBrainstorms(14, basePath);

	for (const brainstorm of recent) {
		if (brainstorm.frontmatter.topic.toLowerCase() === topic.toLowerCase()) {
			return {
				origin: `docs/brainstorms/${brainstorm.path.split("/").pop() || ""}`,
				brainstormDate: brainstorm.frontmatter.date,
				decisions: brainstorm.frontmatter.decisions,
			};
		}
	}

	return undefined;
}

/**
 * Create a new plan artifact.
 */
export function createPlan(options: CreatePlanOptions): string {
	const basePath = options.basePath ?? process.cwd();
	const date = options.date ?? new Date();

	// Ensure plans directory exists
	const plansPath = join(basePath, PLANS_DIR);
	if (!existsSync(plansPath)) {
		mkdirSync(plansPath, { recursive: true });
	}

	// Generate filename
	const filename = generatePlanFilename(options.type, options.title, date);
	const filepath = join(plansPath, filename);

	// Find origin brainstorm if not explicitly provided
	let originData:
		| { origin: string; brainstormDate: string; decisions: string[] }
		| undefined;
	if (options.originBrainstorm) {
		// Try to load the specified brainstorm
		try {
			const brainstormPath = options.originBrainstorm.startsWith("docs/")
				? join(basePath, options.originBrainstorm)
				: join(basePath, "docs/brainstorms", options.originBrainstorm);
			const brainstorm = loadBrainstorm(brainstormPath);
			originData = {
				origin: options.originBrainstorm,
				brainstormDate: brainstorm.frontmatter.date,
				decisions: brainstorm.frontmatter.decisions,
			};
		} catch {
			// Brainstorm not found, will proceed without origin
		}
	} else {
		// Try to find matching brainstorm
		originData = findOriginBrainstorm(options.title, basePath);
	}

	// Create frontmatter
	const frontmatter: PlanFrontmatter = {
		title: options.title,
		date: date.toISOString().split("T")[0] ?? "",
		type: options.type,
		status: "draft",
		...(originData
			? {
					origin: originData.origin,
					brainstormDate: originData.brainstormDate,
					decisions: originData.decisions,
				}
			: {}),
	};

	// Write file
	const fullContent = `${serializeFrontmatter(frontmatter as unknown as Record<string, unknown>)}

# Plan: ${options.title}

${options.content}

${originData?.decisions?.length ? `## Decisions from Brainstorm\n\n${originData.decisions.map((d) => `- ${d}`).join("\n")}\n` : ""}
`;

	writeFileSync(filepath, fullContent, "utf-8");
	return filepath;
}

/**
 * Load a plan artifact by path.
 */
export function loadPlan(filepath: string): PlanMetadata {
	const content = readFileSync(filepath, "utf-8");
	const { frontmatter, body } = parseFrontmatter(content);
	const normalized = normalizePlanFrontmatter(frontmatter);
	if (!normalized) {
		throw new Error(`Invalid plan frontmatter: ${filepath}`);
	}

	return {
		path: filepath,
		frontmatter: normalized,
		content: body,
	};
}

/**
 * Load a plan artifact by path (async version).
 * Isomorphic: same behavior as loadPlan, but async for parallel batching.
 */
export async function loadPlanAsync(filepath: string): Promise<PlanMetadata> {
	const content = await readFile(filepath, "utf-8");
	const { frontmatter, body } = parseFrontmatter(content);
	const normalized = normalizePlanFrontmatter(frontmatter);
	if (!normalized) {
		throw new Error(`Invalid plan frontmatter: ${filepath}`);
	}

	return {
		path: filepath,
		frontmatter: normalized,
		content: body,
	};
}

/**
 * Find all plans in the docs/plans directory.
 */
export function findPlans(basePath = process.cwd()): PlanMetadata[] {
	const plansPath = join(basePath, PLANS_DIR);

	if (!existsSync(plansPath)) {
		return [];
	}

	const files = readdirSync(plansPath).filter((f) => f.endsWith("-plan.md"));

	return files
		.map((f) => {
			try {
				return loadPlan(join(plansPath, f));
			} catch {
				return null;
			}
		})
		.filter((p): p is PlanMetadata => p !== null);
}

/**
 * Find all plans in the docs/plans directory (async parallel version).
 * Isomorphic: same behavior as findPlans, but loads files in parallel.
 * Expected improvement: N sequential file reads → 1 batch of parallel reads.
 */
export async function findPlansAsync(
	basePath = process.cwd(),
): Promise<PlanMetadata[]> {
	const plansPath = join(basePath, PLANS_DIR);

	if (!existsSync(plansPath)) {
		return [];
	}

	const files = readdirSync(plansPath).filter((f) => f.endsWith("-plan.md"));

	// Load all files in parallel for I/O throughput
	const results = await Promise.all(
		files.map(async (f): Promise<PlanMetadata | null> => {
			try {
				return await loadPlanAsync(join(plansPath, f));
			} catch {
				return null;
			}
		}),
	);

	return results.filter((p): p is PlanMetadata => p !== null);
}

/**
 * Check if a plan is missing required origin reference.
 * Returns true if there are recent brainstorms but plan doesn't reference any.
 */
export function checkMissingOrigin(
	planPath: string,
	basePath = process.cwd(),
): { missing: boolean; recentBrainstorms: string[] } {
	const plan = loadPlan(planPath);
	const recent = findRecentBrainstorms(14, basePath);

	if (plan.frontmatter.origin) {
		return { missing: false, recentBrainstorms: [] };
	}

	// Check if any recent brainstorm might be related
	const relatedBrainstorms = recent.filter((b) =>
		plan.frontmatter.title
			.toLowerCase()
			.includes(b.frontmatter.topic.toLowerCase()),
	);

	return {
		missing: relatedBrainstorms.length > 0,
		recentBrainstorms: relatedBrainstorms.map(
			(b) => `docs/brainstorms/${b.path.split("/").pop() || ""}`,
		),
	};
}

/**
 * Update plan status.
 */
export function updatePlanStatus(
	filepath: string,
	status: PlanFrontmatter["status"],
): void {
	const content = readFileSync(filepath, "utf-8");
	const { frontmatter, body } = parseFrontmatter(content);

	frontmatter.status = status;

	const newContent = `${serializeFrontmatter(frontmatter)}\n\n${body}`;
	writeFileSync(filepath, newContent, "utf-8");
}
