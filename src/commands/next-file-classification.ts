/** Categories used to keep operator-local state separate from validation inputs. */
export type ChangedFileCategory =
	| "operator_local"
	| "private_memory"
	| "generated"
	| "test"
	| "source"
	| "governed_documentation"
	| "other";

/** Deterministic classification summary attached to harness-next evidence. */
export type ChangedFileClassification = {
	byCategory: Record<ChangedFileCategory, string[]>;
	validationFiles: string[];
	excludedFiles: string[];
	exclusionReasons: Record<
		string,
		"operator_local" | "private_memory" | "generated"
	>;
};

/** Create an empty category map for a changed-file classification pass. */
function emptyByCategory(): Record<ChangedFileCategory, string[]> {
	return {
		operator_local: [],
		private_memory: [],
		generated: [],
		test: [],
		source: [],
		governed_documentation: [],
		other: [],
	};
}

type FileCategoryMatcher = {
	category: ChangedFileCategory;
	matches: (path: string) => boolean;
};

const FILE_CATEGORY_MATCHERS: readonly FileCategoryMatcher[] = [
	{
		category: "operator_local",
		matches: (path) => /^\.pr\d+[^/]*\.tmp(?:\.[^/]*)?$/.test(path),
	},
	{
		category: "operator_local",
		matches: (path) => /^(?:\.tmp|tmp|scratch)(?:\/|$)/.test(path),
	},
	{
		category: "operator_local",
		matches: (path) =>
			/(?:^|\/)(?:scratch|local-only|backup)(?:\/|\.|$)/i.test(path),
	},
	{
		category: "operator_local",
		matches: (path) => /(?:\.local|\.bak|\.backup)(?:\.|$)/i.test(path),
	},
	{
		category: "private_memory",
		matches: (path) => /^(?:\.tessl|\.local-memory|\.codex)(?:\/|$)/.test(path),
	},
	{
		category: "private_memory",
		matches: (path) => /^codex\/FORJAMIE\.md$/.test(path),
	},
	{
		category: "private_memory",
		matches: (path) => /^\.harness\/memory(?:\/|$)/.test(path),
	},
	{
		category: "generated",
		matches: (path) =>
			/^(?:artifacts|coverage|dist|build|out|tmp\/generated)(?:\/|$)/.test(
				path,
			),
	},
	{
		category: "generated",
		matches: (path) => /(?:^|\/)(?:generated|__generated__)(?:\/|$)/.test(path),
	},
	{
		category: "generated",
		matches: (path) => /\.(?:generated|map)$/i.test(path),
	},
	{
		category: "test",
		matches: (path) => /(?:^|\/)(?:test|tests|__tests__)(?:\/|$)/.test(path),
	},
	{
		category: "test",
		matches: (path) => /\.(?:test|spec)\.[^.]+$/.test(path),
	},
	{
		category: "source",
		matches: (path) =>
			/^(?:src|scripts|contracts|templates|evals|e2e|\.github\/workflows)(?:\/|$)/.test(
				path,
			),
	},
	{
		category: "source",
		matches: (path) =>
			/^(?:package\.json|pnpm-lock\.yaml|harness\.contract\.json|\.mise\.toml)$/.test(
				path,
			),
	},
	{
		category: "governed_documentation",
		matches: (path) => /^(?:docs|instructions)(?:\/|$)/.test(path),
	},
	{
		category: "governed_documentation",
		matches: (path) =>
			/(?:^|\/)(?:AGENTS|CODESTYLE|README|CONTRIBUTING)(?:\.[^.]+)?$/.test(
				path,
			),
	},
	{
		category: "governed_documentation",
		matches: (path) => /\.md$/.test(path),
	},
];

/** Classify one repository-relative path using conservative, deterministic rules. */
export function classifyChangedFile(file: string): ChangedFileCategory {
	const path = file.replaceAll("\\", "/");
	return (
		FILE_CATEGORY_MATCHERS.find((matcher) => matcher.matches(path))?.category ??
		"other"
	);
}

/** Classify and filter changed files while retaining all observed paths. */
export function classifyChangedFiles(
	files: readonly string[],
	options: { explicitInclude?: boolean } = {},
): ChangedFileClassification {
	const byCategory = emptyByCategory();
	const excludedFiles: string[] = [];
	const exclusionReasons: ChangedFileClassification["exclusionReasons"] = {};
	const validationFiles: string[] = [];
	for (const file of [...new Set(files)].sort()) {
		const category = classifyChangedFile(file);
		byCategory[category].push(file);
		if (
			!options.explicitInclude &&
			(category === "operator_local" ||
				category === "private_memory" ||
				category === "generated")
		) {
			excludedFiles.push(file);
			exclusionReasons[file] = category;
			continue;
		}
		validationFiles.push(file);
	}
	return {
		byCategory,
		validationFiles,
		excludedFiles,
		exclusionReasons,
	};
}

/** Project changed-file classification into compact decision metadata. */
export function changedFileClassificationMeta(
	classification: ChangedFileClassification | undefined,
): Record<string, unknown> {
	if (!classification) return {};
	return {
		changedFileClassification: classification.byCategory,
		validationFileCount: classification.validationFiles.length,
		excludedChangedFiles: classification.excludedFiles,
		exclusionReasons: classification.exclusionReasons,
	};
}
