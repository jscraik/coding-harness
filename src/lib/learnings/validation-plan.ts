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

/** Build deterministic validation guidance for changed files. */
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

function isDocsGateFile(file: string): boolean {
	return (
		file.endsWith(".md") &&
		(file === "README.md" ||
			file === "AGENTS.md" ||
			file === "CONTRIBUTING.md" ||
			file.startsWith("docs/"))
	);
}

function isSourceFile(file: string): boolean {
	return file.startsWith("src/") && /\.(ts|tsx)$/.test(file);
}

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

function isPackageSurfaceFile(file: string): boolean {
	return file === "package.json" || file === "pnpm-lock.yaml";
}

function normalizeFiles(files: string[]): string[] {
	return [...new Set(files.map((file) => normalizeFile(file)).filter(Boolean))];
}

function normalizeFile(file: string): string {
	return file.trim().replace(/\\/g, "/").replace(/^\.\//, "");
}

function uniqueStrings(values: string[]): string[] {
	return [...new Set(values.filter(Boolean))].sort();
}
