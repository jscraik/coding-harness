import { DEFAULT_CODERABBIT_LOCAL_ARTIFACT } from "./artifact-io.js";
import { learningMatchesFile, loadLearningArtifact } from "./gate.js";
import type { LearningItem } from "./types.js";

/** Command recommendation emitted by `harness validation-plan`. */
export interface ValidationPlanCommand {
	/** Repo-canonical command to run. */
	command: string;
	/** Why this command is relevant to the changed files. */
	reason: string;
	/** Files that triggered this recommendation. */
	files: string[];
	/** Optional learning IDs that reinforce the command selection. */
	learningIds?: string[];
}

/** Validation command that requires network or external credentials. */
export interface NetworkRequiredCommand {
	/** Repo-canonical command to run when network is available. */
	command: string;
	/** Why this command cannot be assumed available in a restricted sandbox. */
	reason: string;
	/** Optional learning IDs that reinforce the command selection. */
	learningIds?: string[];
}

/** Result emitted by `harness validation-plan --json`. */
export interface ValidationPlanResult {
	schemaVersion: "validation-plan/v1";
	status: "success" | "error";
	source: string;
	changedFiles: string[];
	commands: ValidationPlanCommand[];
	networkRequired: NetworkRequiredCommand[];
	summary: {
		commands: number;
		networkRequired: number;
		matchedLearnings: number;
	};
	error?: {
		code: string;
		message: string;
		fix?: string;
	};
}

/** Options for building validation guidance from changed files and learnings. */
export interface ValidationPlanOptions {
	/** Imported learning artifact path. */
	source?: string;
	/** Changed files to classify. */
	files: string[];
	/** Repository root used for relative artifact resolution. */
	repoRoot?: string;
}

/**
 * Build a deterministic validation plan (commands and network-required checks) for a set of changed files.
 *
 * Normalizes input files, loads a learning artifact (from `options.source` or the default), matches learnings to
 * changed files, and produces deduplicated, sorted `commands` and `networkRequired` recommendations.
 *
 * @param options - Validation plan options. `options.files` are the changed files; `options.source` overrides the artifact path.
 * @returns A `ValidationPlanResult` describing the schema version, source, normalized changed files, generated commands,
 *          network-required commands, and a summary. If loading the learning artifact fails, returns a result with
 *          `status: "error"`, empty command lists, and an `error` object populated from the loader.
export function buildValidationPlan(
	options: ValidationPlanOptions,
): ValidationPlanResult {
	const source = options.source ?? DEFAULT_CODERABBIT_LOCAL_ARTIFACT;
	const changedFiles = normalizeFiles(options.files);
	const loaded = loadLearningArtifact(source, options.repoRoot);

	if (!loaded.ok) {
		return {
			schemaVersion: "validation-plan/v1",
			status: "error",
			source,
			changedFiles,
			commands: [],
			networkRequired: [],
			summary: {
				commands: 0,
				networkRequired: 0,
				matchedLearnings: 0,
			},
			error: {
				code: loaded.code,
				message: loaded.message,
				...(loaded.fix ? { fix: loaded.fix } : {}),
			},
		};
	}

	const matchedLearnings = loaded.artifact.items.filter((item) =>
		changedFiles.some((file) => learningMatchesFile(item, file)),
	);
	const commands = buildCommands(changedFiles, matchedLearnings);
	const networkRequired = buildNetworkRequired(changedFiles, matchedLearnings);

	return {
		schemaVersion: "validation-plan/v1",
		status: "success",
		source,
		changedFiles,
		commands,
		networkRequired,
		summary: {
			commands: commands.length,
			networkRequired: networkRequired.length,
			matchedLearnings: matchedLearnings.length,
		},
	};
}

/**
 * Builds a deduplicated, lexicographically sorted list of validation commands based on changed files and matched learnings.
 *
 * @param files - Normalized list of changed file paths
 * @param matchedLearnings - Learning artifact items that match the changed files and may produce learning-based commands
 * @returns An array of unique ValidationPlanCommand objects sorted by `command`
 */
function buildCommands(
	files: string[],
	matchedLearnings: LearningItem[],
): ValidationPlanCommand[] {
	const commands = new Map<string, ValidationPlanCommand>();
	addPathBasedCommands(commands, files);
	addLearningBasedCommands(commands, files, matchedLearnings);
	return [...commands.values()].sort((a, b) =>
		a.command.localeCompare(b.command),
	);
}

/**
 * Add deterministic validation commands to the provided map based on changed file path classifiers.
 *
 * Processes the changed files and mutates `commands` by adding appropriate validation entries for:
 * - docs/governance/spec/plan surfaces (docs-gate command),
 * - TypeScript source files under `src/` (codestyle, quality, tests, and typecheck commands),
 * - runtime/artifact/package/script/template/lib surfaces (aggregate quality and deep tests).
 * Each added command's `files` field is set to the subset of `files` that match the relevant classifier.
 *
 * @param commands - A Map keyed by command string that will be mutated with added/merged ValidationPlanCommand entries.
 * @param files - Normalized list of changed file paths to evaluate against path classifiers.
 */
function addPathBasedCommands(
	commands: Map<string, ValidationPlanCommand>,
	files: string[],
): void {
	if (files.some(isDocsGateFile)) {
		addCommand(commands, {
			command:
				"bash scripts/run-harness-gate.sh docs-gate --mode required --json",
			reason: "Docs, governance, spec, or plan surfaces changed.",
			files: files.filter(isDocsGateFile),
		});
	}
	if (files.some(isSourceFile)) {
		addCommand(commands, {
			command: "bash scripts/validate-codestyle.sh --fast",
			reason: "Source files changed and must satisfy the repo codestyle gate.",
			files: files.filter(isSourceFile),
		});
		addCommand(commands, {
			command: "bash scripts/validate-codestyle.sh",
			reason:
				"Source files changed and must satisfy the full repo codestyle gate before handoff.",
			files: files.filter(isSourceFile),
		});
		addCommand(commands, {
			command: "pnpm check",
			reason:
				"Behavior-changing source files require the aggregate quality gate.",
			files: files.filter(isSourceFile),
		});
		addCommand(commands, {
			command: "pnpm run quality:docstrings",
			reason:
				"Changed production source must satisfy public API docstring ratchets.",
			files: files.filter(isSourceFile),
		});
		addCommand(commands, {
			command: "pnpm run quality:size",
			reason: "Changed production source must satisfy size ratchets.",
			files: files.filter(isSourceFile),
		});
		addCommand(commands, {
			command: "pnpm run test:related",
			reason:
				"Changed production source must run related tests without no-test pass-through.",
			files: files.filter(isSourceFile),
		});
		addCommand(commands, {
			command: "pnpm typecheck",
			reason: "TypeScript source files changed.",
			files: files.filter(isSourceFile),
		});
	}
	if (files.some(isRuntimeOrArtifactFile)) {
		addCommand(commands, {
			command: "pnpm check",
			reason:
				"Runtime, artifact, package, or script behavior changed and requires the aggregate quality gate.",
			files: files.filter(isRuntimeOrArtifactFile),
		});
		addCommand(commands, {
			command: "pnpm test:deep",
			reason: "Runtime, artifact, package, or script behavior changed.",
			files: files.filter(isRuntimeOrArtifactFile),
		});
	}
}

/**
 * Adds validation commands derived from matched learning items into the provided map.
 *
 * Processes each learning item with classification "validation_contract", derives one or more command strings for that learning, and merges a corresponding ValidationPlanCommand into `commands` for each derived command. Each added command's `reason` is the learning text, its `files` are the subset of `files` that the learning matches, and its `learningIds` contains the learning item's id.
 *
 * @param commands - Map keyed by command string that will be mutated to include merged ValidationPlanCommand entries
 * @param files - Normalized list of changed files to use when selecting files relevant to a learning
 * @param matchedLearnings - Learning items to evaluate for producing commands
 */
function addLearningBasedCommands(
	commands: Map<string, ValidationPlanCommand>,
	files: string[],
	matchedLearnings: LearningItem[],
): void {
	for (const item of matchedLearnings) {
		if (item.classification !== "validation_contract") continue;
		for (const command of commandsForLearning(item)) {
			addCommand(commands, {
				command,
				reason: item.learning,
				files: files.filter((file) => learningMatchesFile(item, file)),
				learningIds: [item.id],
			});
		}
	}
}

/**
 * Builds network-dependent validation commands inferred from changed files and matched learnings.
 *
 * @param files - List of changed file paths (normalized).
 * @param matchedLearnings - Learning artifact items matched against the changed files.
 * @returns A lexicographically sorted list of network-required commands. Each entry describes the command, why network access is required, and optional supporting `learningIds`.
 */
function buildNetworkRequired(
	files: string[],
	matchedLearnings: LearningItem[],
): NetworkRequiredCommand[] {
	const commands = new Map<string, NetworkRequiredCommand>();
	if (files.some(isPackageSurfaceFile)) {
		commands.set("pnpm audit", {
			command: "pnpm audit",
			reason:
				"Dependencies or lockfile changed; run security audit with registry/network access.",
		});
	}
	for (const item of matchedLearnings) {
		const lower = item.learning.toLowerCase();
		if (!lower.includes("audit")) continue;
		const command = lower.includes("pnpm audit") ? "pnpm audit" : "pnpm audit";
		const existing = commands.get(command);
		if (existing) {
			existing.learningIds = uniqueStrings([
				...(existing.learningIds ?? []),
				item.id,
			]);
			continue;
		}
		commands.set(command, {
			command,
			reason: "Package audit requires npm registry/network access.",
			learningIds: [item.id],
		});
	}
	return [...commands.values()].sort((a, b) =>
		a.command.localeCompare(b.command),
	);
}

/**
 * Selects canonical validation commands suggested by a learning item based on keywords in its `learning` text.
 *
 * @param item - The learning item whose `learning` field is inspected for command-triggering keywords
 * @returns The list of repo-canonical command strings suggested by the learning; empty if none match
 */
function commandsForLearning(item: LearningItem): string[] {
	const lower = item.learning.toLowerCase();
	const commands: string[] = [];
	if (lower.includes("pnpm test:ci")) commands.push("pnpm test:ci");
	if (lower.includes("pnpm test:deep")) commands.push("pnpm test:deep");
	if (lower.includes("validate-codestyle")) {
		commands.push("bash scripts/validate-codestyle.sh --fast");
	}
	if (lower.includes("verify-work"))
		commands.push("bash scripts/verify-work.sh");
	return commands;
}

/**
 * Adds or merges a ValidationPlanCommand into the map, normalizing and deduplicating its files and learningIds.
 *
 * @param commands - Map keyed by command string; the entry will be created or updated in place.
 * @param command - The command entry to add; when inserted or merged, its `files` are normalized and its `learningIds` are deduplicated.
 */
function addCommand(
	commands: Map<string, ValidationPlanCommand>,
	command: ValidationPlanCommand,
): void {
	const existing = commands.get(command.command);
	if (!existing) {
		commands.set(command.command, {
			...command,
			files: normalizeFiles(command.files),
			...(command.learningIds
				? { learningIds: uniqueStrings(command.learningIds) }
				: {}),
		});
		return;
	}
	existing.files = normalizeFiles([...existing.files, ...command.files]);
	existing.learningIds = uniqueStrings([
		...(existing.learningIds ?? []),
		...(command.learningIds ?? []),
	]);
}

/**
 * Determines whether a file path matches the project's docs-gate files.
 *
 * @param file - Repository-relative file path or filename to test
 * @returns `true` if the path is a docs-gate file (`README.md`, `AGENTS.md`, `CONTRIBUTING.md`, or any file under `docs/`), `false` otherwise.
 */
function isDocsGateFile(file: string): boolean {
	return (
		file.endsWith(".md") &&
		(file === "README.md" ||
			file === "AGENTS.md" ||
			file === "CONTRIBUTING.md" ||
			file.startsWith("docs/"))
	);
}

/**
 * Determines whether a file path refers to a TypeScript source file under the `src/` directory.
 *
 * @param file - Normalized repository-relative file path (e.g., `src/foo/bar.ts`)
 * @returns `true` if `file` starts with `src/` and ends with `.ts` or `.tsx`, `false` otherwise.
 */
function isSourceFile(file: string): boolean {
	return file.startsWith("src/") && /\.(ts|tsx)$/.test(file);
}

/**
 * Determines whether a file path corresponds to runtime or artifact-related repository files.
 *
 * Matches paths for `package.json`, `pnpm-lock.yaml`, or files under `scripts/`, `src/templates/`, `src/commands/`, or `src/lib/`.
 *
 * @returns `true` if the path matches any of the runtime/artifact patterns, `false` otherwise.
 */
function isRuntimeOrArtifactFile(file: string): boolean {
	return (
		file === "package.json" ||
		file === "pnpm-lock.yaml" ||
		file.startsWith("scripts/") ||
		file.startsWith("src/templates/") ||
		file.startsWith("src/commands/") ||
		file.startsWith("src/lib/")
	);
}

/**
 * Determine whether a normalized repo-relative file path is a package surface file.
 *
 * @param file - Normalized repo-relative file path to check (e.g., "package.json" or "path/to/file")
 * @returns `true` if `file` equals `package.json` or `pnpm-lock.yaml`, `false` otherwise.
 */
function isPackageSurfaceFile(file: string): boolean {
	return file === "package.json" || file === "pnpm-lock.yaml";
}

/**
 * Normalizes, filters, and deduplicates a list of file paths.
 *
 * Applies path normalization to each entry (trim whitespace, normalize separators, remove leading "./"),
 * removes falsy results, and deduplicates while preserving the first occurrence order.
 *
 * @param files - The input list of file path strings to normalize
 * @returns An array of unique, truthy normalized file paths preserving the order of first occurrence
 */
function normalizeFiles(files: string[]): string[] {
	return [...new Set(files.map((file) => normalizeFile(file)).filter(Boolean))];
}

/**
 * Normalize a file path string for repository processing.
 *
 * @param file - The input file path, possibly containing backslashes, leading `./`, or surrounding whitespace
 * @returns The normalized path with trimmed whitespace, Windows backslashes converted to `/`, and a leading `./` removed
 */
function normalizeFile(file: string): string {
	return file.trim().replace(/\\/g, "/").replace(/^\.\//, "");
}

/**
 * Produce a sorted, deduplicated list of non-empty strings.
 *
 * @param values - Array of strings that may include falsy values or duplicates
 * @returns The input strings with falsy entries removed, duplicates removed, and remaining values sorted lexicographically
 */
function uniqueStrings(values: string[]): string[] {
	return [...new Set(values.filter(Boolean))].sort();
}
