/**
 * Ecosystem Detection - Auto-detect project type for smart init
 *
 * Detects the project's programming language/ecosystem based on:
 * - Presence of lockfiles and manifest files
 * - File extensions and directory structure
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

export type Ecosystem =
	| "typescript"
	| "python"
	| "rust"
	| "go"
	| "swift"
	| undefined;

export interface EcosystemMarker {
	/** Required manifest files (any match) */
	files: string[];
	/** Optional lockfiles (any match strengthens confidence) */
	lockfiles?: string[];
	/** Ecosystem name */
	name: Ecosystem;
	/** Human-readable description */
	description: string;
}

const ECOSYSTEM_MARKERS: EcosystemMarker[] = [
	{
		files: ["package.json"],
		lockfiles: [
			"pnpm-lock.yaml",
			"package-lock.json",
			"yarn.lock",
			"bun.lockb",
		],
		name: "typescript",
		description: "TypeScript/JavaScript (Node.js)",
	},
	{
		files: ["pyproject.toml", "setup.py", "requirements.txt"],
		lockfiles: ["uv.lock", "poetry.lock", "Pipfile.lock"],
		name: "python",
		description: "Python",
	},
	{
		files: ["Cargo.toml"],
		lockfiles: ["Cargo.lock"],
		name: "rust",
		description: "Rust",
	},
	{
		files: ["go.mod"],
		lockfiles: ["go.sum"],
		name: "go",
		description: "Go",
	},
	{
		files: ["Package.swift", "project.pbxproj"],
		lockfiles: ["Package.resolved"],
		name: "swift",
		description: "Swift",
	},
];

/**
 * Detect the ecosystem of a project based on file markers.
 *
 * @param cwd - Directory to check (defaults to process.cwd())
 * @returns The detected ecosystem or undefined if none detected
 */
export function detectEcosystem(cwd: string = process.cwd()): Ecosystem {
	for (const marker of ECOSYSTEM_MARKERS) {
		// Check for manifest files
		if (marker.files.some((file) => existsSync(join(cwd, file)))) {
			return marker.name;
		}
	}
	return undefined;
}

/**
 * Get detailed ecosystem detection results.
 *
 * Returns all matching ecosystems with confidence scores based on:
 * - Manifest file presence (required)
 * - Lockfile presence (strengthens confidence)
 */
export function detectEcosystemDetailed(
	cwd: string = process.cwd(),
): Array<{ ecosystem: Ecosystem; confidence: number; description: string }> {
	const results: Array<{
		ecosystem: Ecosystem;
		confidence: number;
		description: string;
	}> = [];

	for (const marker of ECOSYSTEM_MARKERS) {
		const hasManifest = marker.files.some((file) =>
			existsSync(join(cwd, file)),
		);

		if (hasManifest) {
			const hasLockfile = marker.lockfiles?.some((file) =>
				existsSync(join(cwd, file)),
			);
			// Base confidence: 0.7 for manifest, +0.3 for lockfile
			const confidence = hasLockfile ? 1.0 : 0.7;
			results.push({
				ecosystem: marker.name,
				confidence,
				description: marker.description,
			});
		}
	}

	// Sort by confidence descending
	return results.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Get the default preset name for an ecosystem.
 */
export function getDefaultPresetForEcosystem(
	ecosystem: Ecosystem,
): string | undefined {
	const presetMap: Record<string, string> = {
		typescript: "typescript-base",
		python: "python-base",
		rust: "rust-base",
		go: "go-base",
		swift: "swift-base",
	};
	return ecosystem ? presetMap[ecosystem] : undefined;
}

/**
 * Get human-readable description of an ecosystem.
 */
export function getEcosystemDescription(ecosystem: Ecosystem): string {
	const marker = ECOSYSTEM_MARKERS.find((m) => m.name === ecosystem);
	return marker?.description ?? "Unknown";
}

/**
 * Check if an ecosystem supports type checking.
 */
export function ecosystemSupportsTypeCheck(ecosystem: Ecosystem): boolean {
	const typecheckEcosystems: Ecosystem[] = ["typescript"];
	return ecosystem !== undefined && typecheckEcosystems.includes(ecosystem);
}

/**
 * Get suggested package manager commands for an ecosystem.
 */
export function getEcosystemCommands(ecosystem: Ecosystem): {
	install: string;
	lint: string;
	test: string;
	typecheck?: string;
} {
	const commandMap: Record<
		string,
		{ install: string; lint: string; test: string; typecheck?: string }
	> = {
		typescript: {
			install: "npm install",
			lint: "npm run lint",
			test: "npm test",
			typecheck: "npm run typecheck",
		},
		python: {
			install: "pip install -e .",
			lint: "ruff check .",
			test: "pytest",
		},
		rust: {
			install: "cargo build",
			lint: "cargo clippy",
			test: "cargo test",
		},
		go: {
			install: "go mod download",
			lint: "golangci-lint run",
			test: "go test ./...",
		},
		swift: {
			install: "swift build",
			lint: "swiftlint",
			test: "swift test",
		},
	};

	return (
		commandMap[ecosystem ?? ""] ?? {
			install: "npm install",
			lint: "npm run lint",
			test: "npm test",
		}
	);
}
