import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";

export interface BrainstormFrontmatter {
	topic: string;
	date: string; // ISO date YYYY-MM-DD
	status: "draft" | "decided" | "superseded";
	decisions: string[];
	supersededBy?: string; // Path to newer brainstorm
}

export interface BrainstormMetadata {
	path: string;
	frontmatter: BrainstormFrontmatter;
	content: string;
}

const BRAINSTORMS_DIR = "docs/brainstorms";
const FORBIDDEN_CHARS = /[<>:"/\\|?*\!.,]/g;

/**
 * Sanitize a topic string for use in a filename.
 */
function sanitizeTopic(topic: string): string {
	return topic
		.toLowerCase()
		.replace(FORBIDDEN_CHARS, "-")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

/**
 * Generate a filename for a brainstorm artifact.
 */
export function generateBrainstormFilename(
	topic: string,
	date = new Date(),
): string {
	const sanitized = sanitizeTopic(topic);
	const dateStr = date.toISOString().split("T")[0];
	return `${dateStr}-${sanitized}-brainstorm.md`;
}

/**
 * Parse frontmatter from markdown content.
 * Supports YAML list format (key:\n  - item1\n  - item2).
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
	const lines = match![1]!.split("\n");
	let currentKey: string | null = null;
	let currentArray: string[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]!;
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
					// This is an array, continue to collect items
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

	return { frontmatter, body: match![2]!.trim() };
}

/**
 * Serialize frontmatter to YAML-like format.
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
 * Create a new brainstorm artifact.
 */
export function createBrainstorm(
	topic: string,
	content: string,
	options: {
		decisions?: string[];
		date?: Date;
		basePath?: string;
	} = {},
): string {
	const basePath = options.basePath ?? process.cwd();
	const date = options.date ?? new Date();

	// Ensure brainstorms directory exists
	const brainstormsPath = join(basePath, BRAINSTORMS_DIR);
	if (!existsSync(brainstormsPath)) {
		mkdirSync(brainstormsPath, { recursive: true });
	}

	// Generate filename
	const filename = generateBrainstormFilename(topic, date);
	const filepath = join(brainstormsPath, filename);

	// Validate path
	const validatedPath = filepath;

	// Create frontmatter
	const frontmatter: BrainstormFrontmatter = {
		topic,
		date: date.toISOString().split("T")[0] ?? "",
		status: "draft",
		decisions: options.decisions ?? [],
	};

	// Write file
	const fullContent = `${serializeFrontmatter(frontmatter as unknown as Record<string, unknown>)}

# Brainstorm: ${topic}

${content}
`;

	writeFileSync(validatedPath, fullContent, "utf-8");
	return validatedPath;
}

/**
 * Load a brainstorm artifact by path.
 */
export function loadBrainstorm(filepath: string): BrainstormMetadata {
	const content = readFileSync(filepath, "utf-8");
	const { frontmatter, body } = parseFrontmatter(content);

	return {
		path: filepath,
		frontmatter: frontmatter as unknown as BrainstormFrontmatter,
		content: body,
	};
}

/**
 * Find all brainstorms in the docs/brainstorms directory.
 */
export function findBrainstorms(
	basePath = process.cwd(),
): BrainstormMetadata[] {
	const brainstormsPath = join(basePath, BRAINSTORMS_DIR);

	if (!existsSync(brainstormsPath)) {
		return [];
	}

	const files = readdirSync(brainstormsPath).filter((f) =>
		f.endsWith("-brainstorm.md"),
	);

	return files
		.map((f) => {
			try {
				return loadBrainstorm(join(brainstormsPath, f));
			} catch {
				return null;
			}
		})
		.filter((b): b is BrainstormMetadata => b !== null);
}

/**
 * Find recent brainstorms within a date range.
 */
export function findRecentBrainstorms(
	days = 14,
	basePath = process.cwd(),
): BrainstormMetadata[] {
	const brainstorms = findBrainstorms(basePath);
	const cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - days);

	return brainstorms.filter((b) => {
		const brainstormDate = new Date(b.frontmatter.date);
		return brainstormDate >= cutoff && b.frontmatter.status !== "superseded";
	});
}

/**
 * Update brainstorm status.
 */
export function updateBrainstormStatus(
	filepath: string,
	status: BrainstormFrontmatter["status"],
	supersededBy?: string,
): void {
	const content = readFileSync(filepath, "utf-8");
	const { frontmatter, body } = parseFrontmatter(content);

	frontmatter.status = status;
	if (supersededBy) {
		frontmatter.supersededBy = supersededBy;
	}

	const newContent = `${serializeFrontmatter(frontmatter)}\n\n${body}`;
	writeFileSync(filepath, newContent, "utf-8");
}

/**
 * Check if a plan requires a brainstorm (ambiguous feature work).
 * Returns true if no recent brainstorm exists.
 */
export function requiresBrainstorm(
	topic: string,
	basePath = process.cwd(),
): boolean {
	const recent = findRecentBrainstorms(14, basePath);

	// Check if any recent brainstorm covers this topic
	const sanitizedTopic = sanitizeTopic(topic);
	return !recent.some((b) => {
		const brainstormTopic = sanitizeTopic(b.frontmatter.topic);
		return (
			brainstormTopic === sanitizedTopic ||
			brainstormTopic.includes(sanitizedTopic) ||
			sanitizedTopic.includes(brainstormTopic)
		);
	});
}
