import type {
	RootHygieneClassificationClass,
	RootHygieneEntryKind,
	RootHygienePolicy,
	RootHygienePolicyEntry,
	RootSurfaceEntry,
} from "./types.js";
import { rootHygienePolicyDigest } from "./policy-digest.js";

export const ROOT_SURFACE_POLICY_SOURCE_REF =
	"docs/architecture/root-surface-classification.md" as const;

const CANONICAL_ROOT_FILES = [
	".architecture.yml",
	".coderabbit.yaml",
	".diagramrc",
	".editorconfig",
	".gitattributes",
	".gitignore",
	".gitleaks.toml",
	".lychee.toml",
	".markdownlint-cli2.yaml",
	".mise.toml",
	".npmrc",
	".nvmrc",
	".trufflehog-exclude.txt",
	".vale.ini",
	".versionrc",
	"AGENTS.md",
	"ARCHITECTURE.md",
	"CHANGELOG.md",
	"CITATION.cff",
	"CODESTYLE.md",
	"CODE_OF_CONDUCT.md",
	"CONTRIBUTING.md",
	"CONTRIBUTORS.md",
	"LICENSE",
	"Makefile",
	"README.md",
	"SECURITY.md",
	"SUPPORT.md",
	"UBIQUITOUS_LANGUAGE.md",
	"WORKFLOW.md",
	"biome.json",
	"package.json",
	"pnpm-lock.yaml",
	"pnpm-workspace.yaml",
	"prek.toml",
	"renovate.json",
	"tsconfig.json",
	"vitest.config.ts",
] as const;

const GENERATED_TRACKED_ROOT_FILES = [
	".architecture-baseline.txt",
	".memory-metrics.json",
	"harness.contract.json",
	"memory.json",
] as const;
const SHOULD_MOVE_ROOT_FILES = ["FORJAMIE.md"] as const;

const CANONICAL_ROOT_DIRECTORIES = [
	".agents",
	".circleci",
	".codex",
	".github",
	".harness",
	".vale",
	"codestyle",
	"contracts",
	"docs",
	"e2e",
	"evals",
	"ops",
	"rules",
	"scripts",
	"security",
	"src",
	"templates",
	"test-fixtures",
	"tests",
] as const;

const GENERATED_TRACKED_ROOT_DIRECTORIES = [
	".diagram",
	"AI",
	"artifacts",
] as const;
const SHOULD_MOVE_ROOT_DIRECTORIES = ["instructions"] as const;

export const ROOT_SURFACE_POLICY: RootHygienePolicy = {
	sourceRef: ROOT_SURFACE_POLICY_SOURCE_REF,
	entries: [
		...policyEntries(
			CANONICAL_ROOT_FILES,
			"file",
			"canonical_root",
			"standard repository root contract",
		),
		...policyEntries(
			GENERATED_TRACKED_ROOT_FILES,
			"file",
			"generated_tracked_intentionally",
			"tracked because gates, docs, or release workflows consume it",
		),
		...policyEntries(
			SHOULD_MOVE_ROOT_FILES,
			"file",
			"should_move",
			"deferred handoff-surface cleanup decision",
		),
		...policyEntries(
			CANONICAL_ROOT_DIRECTORIES,
			"directory",
			"canonical_root",
			"standard repository root contract",
		),
		...policyEntries(
			GENERATED_TRACKED_ROOT_DIRECTORIES,
			"directory",
			"generated_tracked_intentionally",
			"tracked because gates, docs, or artifact workflows consume it",
		),
		...policyEntries(
			SHOULD_MOVE_ROOT_DIRECTORIES,
			"directory",
			"should_move",
			"deferred instruction-routing cleanup decision",
		),
	],
} as const;

export const ROOT_SURFACE_POLICY_DIGEST =
	rootHygienePolicyDigest(ROOT_SURFACE_POLICY);

/** Return classifier fixture entries from the active root-hygiene policy. */
export function policyRootSurfaceEntries(
	policy: RootHygienePolicy = ROOT_SURFACE_POLICY,
): RootSurfaceEntry[] {
	return policy.entries.map(({ path, kind }) => ({ path, kind }));
}

function policyEntries(
	paths: readonly string[],
	kind: RootHygieneEntryKind,
	classification: Exclude<RootHygieneClassificationClass, "unclassified">,
	reason: string,
): RootHygienePolicyEntry[] {
	return paths.map((path) => ({ path, kind, classification, reason }));
}
