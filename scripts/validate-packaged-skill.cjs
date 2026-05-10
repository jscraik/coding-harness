#!/usr/bin/env node

const { existsSync, readFileSync, readdirSync } = require("node:fs");
const { resolve, join, relative } = require("node:path");
const { spawnSync } = require("node:child_process");

const REPO_ROOT = resolve(__dirname, "..");
const SKILL_ROOT = resolve(REPO_ROOT, ".agents/skills/coding-harness");

const REQUIRED_FILES = {
	skill: ".agents/skills/coding-harness/SKILL.md",
	installGuide:
		".agents/skills/coding-harness/references/agent-install-guide.md",
	installJson: ".agents/skills/coding-harness/references/agent-install.json",
	evals: ".agents/skills/coding-harness/references/evals.yaml",
	setup: ".agents/skills/coding-harness/references/setup-and-commands.md",
};

const MARKDOWN_FILES = [
	REQUIRED_FILES.skill,
	REQUIRED_FILES.installGuide,
	REQUIRED_FILES.setup,
];

const REQUIRED_BOOTSTRAP_COMMANDS = ["harness init --dry-run", "harness init"];

const REQUIRED_MIGRATION_COMMANDS = [
	"harness ci-migrate prepare --provider circleci --dry-run",
	"harness ci-migrate prepare --provider circleci --apply",
	"harness ci-migrate verify --snapshot <snapshot-id>",
	"harness ci-migrate commit --snapshot <snapshot-id>",
	"harness ci-migrate abort --snapshot <snapshot-id>",
];

const FORBIDDEN_PATTERNS = [
	{
		pattern: "harness init --ci circleci",
		message:
			"stale bootstrap guidance found; current CLI treats `circleci` as a target directory in this flow",
	},
	{
		pattern: "GitHub Actions workflow env",
		message:
			"stale CI secret guidance found; packaged skill should point to CircleCI environment variables",
	},
];

function fail(message) {
	console.error(message);
	process.exit(1);
}

function runCommand(command, args) {
	const result = spawnSync(command, args, {
		cwd: REPO_ROOT,
		stdio: "inherit",
	});

	if (result.status !== 0) {
		fail(`packaged-skill: command failed: ${command} ${args.join(" ")}`);
	}
}

function assert(condition, message) {
	if (!condition) {
		fail(`packaged-skill: ${message}`);
	}
}

function readRepoFile(repoRelativePath) {
	const absolutePath = resolve(REPO_ROOT, repoRelativePath);
	assert(
		existsSync(absolutePath),
		`missing required file: ${repoRelativePath}`,
	);
	return readFileSync(absolutePath, "utf8");
}

function walkFiles(rootPath) {
	const entries = readdirSync(rootPath, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const entryPath = join(rootPath, entry.name);
		if (entry.isDirectory()) {
			files.push(...walkFiles(entryPath));
			continue;
		}
		if (entry.isFile()) {
			files.push(entryPath);
		}
	}

	return files;
}

function validateRequiredFiles() {
	for (const repoRelativePath of Object.values(REQUIRED_FILES)) {
		assert(
			existsSync(resolve(REPO_ROOT, repoRelativePath)),
			`missing required file: ${repoRelativePath}`,
		);
	}
}

function validateLintSurfaces() {
	runCommand("pnpm", ["exec", "markdownlint-cli2", ...MARKDOWN_FILES]);
	runCommand("pnpm", ["exec", "biome", "check", REQUIRED_FILES.installJson]);
}

function validateSkillMarkdown() {
	const skillContent = readRepoFile(REQUIRED_FILES.skill);
	const installGuideContent = readRepoFile(REQUIRED_FILES.installGuide);
	const setupContent = readRepoFile(REQUIRED_FILES.setup);

	for (const command of REQUIRED_BOOTSTRAP_COMMANDS) {
		assert(
			skillContent.includes(command),
			`SKILL.md is missing bootstrap command: ${command}`,
		);
		assert(
			installGuideContent.includes(command),
			`agent-install-guide.md is missing bootstrap command: ${command}`,
		);
	}

	for (const command of REQUIRED_MIGRATION_COMMANDS) {
		assert(
			skillContent.includes(command.replace("harness ", "")) ||
				skillContent.includes(command),
			`SKILL.md is missing migration command: ${command}`,
		);
		assert(
			installGuideContent.includes(command),
			`agent-install-guide.md is missing migration command: ${command}`,
		);
	}

	assert(
		setupContent.includes(
			"CircleCI project settings -> Environment Variables:",
		),
		"setup-and-commands.md must document CircleCI environment variable setup",
	);
	assert(
		setupContent.includes("NPM_TOKEN"),
		"setup-and-commands.md must mention NPM_TOKEN",
	);
}

function validateInstallJson() {
	const content = readRepoFile(REQUIRED_FILES.installJson);
	const parsed = JSON.parse(content);

	assert(
		parsed.ci_provider === "circleci",
		"agent-install.json must keep ci_provider=circleci",
	);
	assert(
		parsed.init_command === "harness init",
		"agent-install.json init_command must be `harness init`",
	);
	assert(
		parsed.verify_command === "harness check-environment --json",
		"agent-install.json verify_command must stay aligned with harness environment checks",
	);

	const initPhase = Array.isArray(parsed.phases)
		? parsed.phases.find((phase) => phase && phase.id === "init")
		: null;

	assert(initPhase, "agent-install.json must define an init phase");
	assert(
		Array.isArray(initPhase.steps),
		"agent-install.json init phase must include steps",
	);

	for (const expectedStep of [
		"harness init --dry-run",
		"harness init",
		"harness init --check-updates",
	]) {
		assert(
			initPhase.steps.includes(expectedStep),
			`agent-install.json init phase is missing step: ${expectedStep}`,
		);
	}

	assert(
		parsed.migration_commands,
		"agent-install.json must define migration_commands",
	);
	for (const [key, expectedValue] of Object.entries({
		preview: "harness ci-migrate prepare --provider circleci --dry-run",
		apply: "harness ci-migrate prepare --provider circleci --apply",
		verify: "harness ci-migrate verify --snapshot <snapshot-id>",
		commit: "harness ci-migrate commit --snapshot <snapshot-id>",
		abort: "harness ci-migrate abort --snapshot <snapshot-id>",
	})) {
		assert(
			parsed.migration_commands[key] === expectedValue,
			`agent-install.json migration_commands.${key} must equal \`${expectedValue}\``,
		);
	}
}

/**
 * Validate that evals.yaml declares the expected schema, contains required eval case IDs, and includes a set of expected coverage markers.
 *
 * Verifies presence of:
 * - `schema_version: "2.0"`
 * - eval case IDs: `happy-bootstrap-command-audit`, `happy-ci-migration-sequence`, `happy-existing-repo-upgrade-dry-run`, and `edge-current-repo-needs-upgrading`
 * - coverage/output strings related to init and upgrade dry-runs, update/skip outcomes, compatibility aliasing, adoption/preview/tracked-update indicators, prepare/apply/verify/commit/abort snapshot commands, and the `last_updated: "2026-04-29"` entry.
 *
 * On any missing requirement, the script will fail and exit with a non-zero status.
 */
function validateEvals() {
	const content = readRepoFile(REQUIRED_FILES.evals);

	assert(
		content.includes('schema_version: "2.0"'),
		"evals.yaml must declare schema_version 2.0",
	);
	assert(
		content.includes("- id: happy-bootstrap-command-audit"),
		"evals.yaml must include the bootstrap audit case",
	);
	assert(
		content.includes("- id: happy-ci-migration-sequence"),
		"evals.yaml must include the CI migration sequence case",
	);
	assert(
		content.includes("- id: happy-existing-repo-upgrade-dry-run"),
		"evals.yaml must include the existing repo upgrade dry-run case",
	);
	assert(
		content.includes("- id: edge-current-repo-needs-upgrading"),
		"evals.yaml must include the current repo upgrade edge case",
	);

	for (const expectedText of [
		"harness init --dry-run",
		"--update --dry-run --json",
		"updated",
		"skipped",
		"created-to-updated compatibility alias",
		"adoption-preview",
		"tracked-update",
		"safe in-repo symlinked directories",
		"harness upgrade --dry-run --json",
		"current repo that needs upgrading",
		"prepare --provider circleci --dry-run",
		"prepare --provider circleci --apply",
		"verify --snapshot",
		"commit --snapshot",
		"abort --snapshot",
		'last_updated: "2026-04-29"',
	]) {
		assert(
			content.includes(expectedText),
			`evals.yaml is missing expected coverage text: ${expectedText}`,
		);
	}
}

function validateForbiddenPatterns() {
	const files = walkFiles(SKILL_ROOT).filter((filePath) => {
		const extension = filePath.split(".").pop();
		return ["md", "json", "yaml"].includes(extension);
	});

	for (const filePath of files) {
		const content = readFileSync(filePath, "utf8");
		for (const rule of FORBIDDEN_PATTERNS) {
			assert(
				!content.includes(rule.pattern),
				`${relative(REPO_ROOT, filePath)}: ${rule.message}`,
			);
		}
	}
}

function validateReferenceContracts() {
	runCommand("python3", [
		join(SKILL_ROOT, "scripts/validate_reference_contracts.py"),
		"--skill-root",
		SKILL_ROOT,
		"--package-form",
		"source-skill-root",
		"--truth-source",
		"JSC-282 source-command truth",
	]);
}

function main() {
	validateRequiredFiles();
	validateLintSurfaces();
	validateSkillMarkdown();
	validateInstallJson();
	validateEvals();
	validateForbiddenPatterns();
	validateReferenceContracts();
	console.info("packaged-skill: pass");
}

main();
