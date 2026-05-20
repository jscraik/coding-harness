#!/usr/bin/env node

const { existsSync, readFileSync, readdirSync, statSync } = require("node:fs");
const { join, relative, resolve } = require("node:path");

const REPO_ROOT = resolve(__dirname, "..");
const AGENTS_ROOT = resolve(REPO_ROOT, ".codex/agents");
const README_PATH = resolve(AGENTS_ROOT, "README.md");
const ROOT_AGENTS_PATH = resolve(REPO_ROOT, "AGENTS.md");
const TOOLING_POLICY_PATH = resolve(
	REPO_ROOT,
	"docs/agents/02-tooling-policy.md",
);
const VALIDATION_GUIDE_PATH = resolve(
	REPO_ROOT,
	"docs/agents/04-validation.md",
);
const UNSUPPORTED_ROLES_PATH = resolve(REPO_ROOT, ".agents/roles");

const EXPECTED_ROLES = [
	{
		name: "harness-product-code-reviewer",
		category: "product_code_and_tests",
		nicknameCandidates: ["Harness Product", "Harness Tests", "Harness Code"],
		sandboxMode: "read-only",
		statusLine: "verdict = pass | findings | blocked",
	},
	{
		name: "harness-ci-release-reviewer",
		category: "ci_configuration_and_release_tooling",
		nicknameCandidates: ["Harness CI", "Harness Release", "Harness Gates"],
		sandboxMode: "read-only",
		statusLine: "verdict = pass | findings | blocked",
	},
	{
		name: "harness-dev-tools-reviewer",
		category: "internal_developer_tools",
		nicknameCandidates: ["Harness Tools", "Harness CLI", "Harness DevEx"],
		sandboxMode: "read-only",
		statusLine: "verdict = pass | findings | blocked",
	},
	{
		name: "harness-doc-history-reviewer",
		category: "documentation_and_design_history",
		nicknameCandidates: ["Harness Docs", "Harness History", "Harness Design"],
		sandboxMode: "read-only",
		statusLine: "verdict = pass | findings | blocked",
	},
	{
		name: "harness-evaluation-reviewer",
		category: "evaluation_harnesses",
		nicknameCandidates: ["Harness Evals", "Harness Metrics", "Harness Score"],
		sandboxMode: "read-only",
		statusLine: "verdict = pass | findings | blocked",
	},
	{
		name: "harness-review-response-auditor",
		category: "review_comments_and_responses",
		nicknameCandidates: [
			"Harness Review",
			"Harness Replies",
			"Harness Comments",
		],
		sandboxMode: "read-only",
		statusLine: "verdict = pass | findings | blocked",
	},
	{
		name: "harness-repository-automation-reviewer",
		category: "repository_management_scripts",
		nicknameCandidates: [
			"Harness Repo",
			"Harness Scripts",
			"Harness Automation",
		],
		sandboxMode: "read-only",
		statusLine: "verdict = pass | findings | blocked",
	},
	{
		name: "harness-dashboard-definition-reviewer",
		category: "production_dashboard_definition_files",
		nicknameCandidates: [
			"Harness Dashboard",
			"Harness Panels",
			"Harness Telemetry",
		],
		sandboxMode: "read-only",
		statusLine: "verdict = pass | findings | blocked",
	},
	{
		name: "harness-toolsmith",
		category: "harness_toolsmith",
		nicknameCandidates: ["Harness Toolsmith", "Harness Forge", "Harness Maker"],
		sandboxMode: "workspace-write",
		statusLine: "status = implemented | proposed | blocked",
		extraInstructionText: [
			"capability_gap",
			"tool_or_primitive_changed",
			"created_or_changed_surfaces",
			"validation_evidence",
		],
	},
];

const REQUIRED_PRINCIPLE_TEXT = [
	{
		path: README_PATH,
		description: "Codex agent roles README",
		snippets: [
			"Harness Roles First",
			"Harness Toolsmith",
			"Runtime Freshness",
			"first-choice subagents",
			"unknown agent_type",
			'spawn_agent(agent_type="harness-product-code-reviewer")',
			'spawn_agent(agent_type="harness-toolsmith")',
		],
	},
	{
		path: ROOT_AGENTS_PATH,
		description: "root agent instructions",
		snippets: [
			"Harness Reviewer Roles First",
			"Harness Tool Builder",
			"first-choice subagents",
			"unknown agent_type",
			'spawn_agent(agent_type="harness-product-code-reviewer")',
			'spawn_agent(agent_type="harness-toolsmith")',
		],
	},
	{
		path: TOOLING_POLICY_PATH,
		description: "tooling policy",
		snippets: [
			"project-local harness reviewer roles are",
			"harness-toolsmith",
			"the first-choice subagents",
			"unknown agent_type",
			'spawn_agent(agent_type="harness-product-code-reviewer")',
			'spawn_agent(agent_type="harness-toolsmith")',
		],
	},
	{
		path: VALIDATION_GUIDE_PATH,
		description: "validation guide",
		snippets: [
			"harness roles first principle",
			"harness-toolsmith",
			"unknown agent_type",
			'spawn_agent(agent_type="<role>")',
			"before generic/default/global reviewers",
		],
	},
];

function repoRelative(path) {
	return relative(REPO_ROOT, path).split(/[\\/]/).join("/");
}

function fail(errors) {
	for (const error of errors) {
		console.error(`codex-agent-roles: ${error}`);
	}
	process.exit(1);
}

function assertExists(errors, path, description) {
	if (!existsSync(path)) {
		errors.push(`missing ${description}: ${repoRelative(path)}`);
		return false;
	}
	return true;
}

function readText(errors, path, description) {
	if (!assertExists(errors, path, description)) {
		return "";
	}
	return readFileSync(path, "utf8");
}

function collectTomlFiles(rootPath) {
	const files = [];
	for (const entry of readdirSync(rootPath, { withFileTypes: true })) {
		const entryPath = join(rootPath, entry.name);
		if (entry.isDirectory()) {
			files.push(...collectTomlFiles(entryPath));
			continue;
		}
		if (entry.isFile() && entry.name.endsWith(".toml")) {
			files.push(entryPath);
		}
	}
	return files.sort((left, right) => left.localeCompare(right));
}

function extractStringValue(content, key) {
	const match = content.match(
		new RegExp(`^\\s*${key}\\s*=\\s*"([^"\\n]*)"`, "m"),
	);
	return match ? match[1] : null;
}

function extractBooleanValue(content, key) {
	const match = content.match(
		new RegExp(`^\\s*${key}\\s*=\\s*(true|false)\\s*$`, "m"),
	);
	if (!match) {
		return null;
	}
	return match[1] === "true";
}

function extractStringArrayValue(content, key) {
	const match = content.match(
		new RegExp(`^\\s*${key}\\s*=\\s*\\[([^\\n]*)\\]\\s*$`, "m"),
	);
	if (!match) {
		return null;
	}
	const rawItems = match[1].trim();
	if (rawItems.length === 0) {
		return [];
	}
	return rawItems.split(",").map((item) => {
		const trimmed = item.trim();
		const stringMatch = trimmed.match(/^"([^"\n]*)"$/);
		return stringMatch ? stringMatch[1] : null;
	});
}

function hasNonEmptyTripleQuotedBlock(content, key) {
	const match = content.match(
		new RegExp(`^\\s*${key}\\s*=\\s*'''\\n([\\s\\S]*?)\\n'''\\s*$`, "m"),
	);
	return Boolean(match && match[1].trim().length > 0);
}

function validateNicknameCandidates(errors, rolePath, actualCandidates) {
	if (!actualCandidates) {
		errors.push(
			`${repoRelative(rolePath)}: expected non-empty nickname_candidates array`,
		);
		return;
	}
	if (actualCandidates.length === 0) {
		errors.push(
			`${repoRelative(rolePath)}: nickname_candidates must contain at least one name`,
		);
		return;
	}
	const seen = new Set();
	for (const candidate of actualCandidates) {
		if (candidate === null) {
			errors.push(
				`${repoRelative(rolePath)}: nickname_candidates must be string literals`,
			);
			continue;
		}
		const trimmedCandidate = candidate.trim();
		if (trimmedCandidate.length === 0) {
			errors.push(
				`${repoRelative(rolePath)}: nickname_candidates cannot contain blank names`,
			);
		}
		if (trimmedCandidate !== candidate) {
			errors.push(
				`${repoRelative(rolePath)}: nickname_candidates must already be trimmed`,
			);
		}
		if (seen.has(trimmedCandidate)) {
			errors.push(
				`${repoRelative(rolePath)}: nickname_candidates cannot contain duplicates`,
			);
		}
		seen.add(trimmedCandidate);
		if (!/^[A-Za-z0-9 _-]+$/.test(trimmedCandidate)) {
			errors.push(
				`${repoRelative(rolePath)}: nickname_candidates may only contain ASCII letters, digits, spaces, hyphens, and underscores`,
			);
		}
		if (!trimmedCandidate.startsWith("Harness ")) {
			errors.push(
				`${repoRelative(rolePath)}: nickname candidate \`${trimmedCandidate}\` must be harness-themed`,
			);
		}
	}
}

function validateReadme(errors) {
	const content = readText(errors, README_PATH, "Codex agent roles README");
	if (!content) {
		return;
	}

	for (const expectedText of [
		".codex/agents/<role>/<role>.toml",
		"spawn_agent(agent_type=...)",
		"does not prove the active session runtime registry",
		".agents/skills/**/agents/openai.yaml",
		".agents/roles",
		"pnpm codex:agents:guard",
	]) {
		if (!content.includes(expectedText)) {
			errors.push(`${repoRelative(README_PATH)}: missing \`${expectedText}\``);
		}
	}

	for (const { name } of EXPECTED_ROLES) {
		if (!content.includes(`\`${name}\``)) {
			errors.push(
				`${repoRelative(README_PATH)}: missing role inventory entry for ${name}`,
			);
		}
	}
}

function validatePrincipleDocs(errors) {
	for (const { path, description, snippets } of REQUIRED_PRINCIPLE_TEXT) {
		const content = readText(errors, path, description);
		if (!content) {
			continue;
		}
		for (const snippet of snippets) {
			if (!content.includes(snippet)) {
				errors.push(`${repoRelative(path)}: missing \`${snippet}\``);
			}
		}
	}
}

function validateNoUnsupportedRoleSurface(errors) {
	if (existsSync(UNSUPPORTED_ROLES_PATH)) {
		const type = statSync(UNSUPPORTED_ROLES_PATH).isDirectory()
			? "directory"
			: "path";
		errors.push(
			`${repoRelative(UNSUPPORTED_ROLES_PATH)}: unsupported Codex role discovery ${type}; keep runtime roles under .codex/agents until Codex source supports this surface`,
		);
	}
}

function validateRoleFiles(errors) {
	if (!assertExists(errors, AGENTS_ROOT, "Codex agent roles directory")) {
		return;
	}

	const expectedNames = EXPECTED_ROLES.map((role) => role.name).sort();
	const files = collectTomlFiles(AGENTS_ROOT);
	const actualNames = files.map((file) => {
		const basename = file.split(/[\\/]/).pop() || "";
		return basename.replace(/\.toml$/, "");
	});

	for (const expectedName of expectedNames) {
		const expectedPath = join(
			AGENTS_ROOT,
			expectedName,
			`${expectedName}.toml`,
		);
		assertExists(errors, expectedPath, `role file for ${expectedName}`);
	}

	for (const actualName of actualNames) {
		if (!expectedNames.includes(actualName)) {
			errors.push(`.codex/agents: unexpected role TOML: ${actualName}`);
		}
	}

	for (const expectedName of expectedNames) {
		if (!actualNames.includes(expectedName)) {
			errors.push(`.codex/agents: missing role TOML: ${expectedName}`);
		}
	}

	for (const role of EXPECTED_ROLES) {
		const rolePath = join(AGENTS_ROOT, role.name, `${role.name}.toml`);
		const content = readText(errors, rolePath, `role file for ${role.name}`);
		if (!content) {
			continue;
		}

		const checks = [
			["name", role.name],
			["model", "gpt-5.4-mini"],
			["model_reasoning_effort", "medium"],
			["sandbox_mode", role.sandboxMode],
		];

		for (const [key, expectedValue] of checks) {
			const actualValue = extractStringValue(content, key);
			if (actualValue !== expectedValue) {
				errors.push(
					`${repoRelative(rolePath)}: expected ${key} = \`${expectedValue}\`, got \`${actualValue ?? "missing"}\``,
				);
			}
		}

		if (extractBooleanValue(content, "allow_login_shell") !== false) {
			errors.push(
				`${repoRelative(rolePath)}: expected allow_login_shell = false`,
			);
		}
		const actualNicknameCandidates = extractStringArrayValue(
			content,
			"nickname_candidates",
		);
		if (
			JSON.stringify(actualNicknameCandidates) !==
			JSON.stringify(role.nicknameCandidates)
		) {
			errors.push(
				`${repoRelative(rolePath)}: expected nickname_candidates = ${JSON.stringify(role.nicknameCandidates)}, got ${JSON.stringify(actualNicknameCandidates)}`,
			);
		}
		validateNicknameCandidates(errors, rolePath, actualNicknameCandidates);

		if (!hasNonEmptyTripleQuotedBlock(content, "developer_instructions")) {
			errors.push(
				`${repoRelative(rolePath)}: missing non-empty developer_instructions block`,
			);
		}

		for (const expectedText of [
			`category = "${role.category}"`,
			role.statusLine,
			"useful_skill_routes",
			...(role.extraInstructionText ?? []),
		]) {
			if (!content.includes(expectedText)) {
				errors.push(
					`${repoRelative(rolePath)}: missing required instruction text \`${expectedText}\``,
				);
			}
		}
	}
}

function main() {
	const errors = [];
	validateNoUnsupportedRoleSurface(errors);
	validatePrincipleDocs(errors);
	validateReadme(errors);
	validateRoleFiles(errors);

	if (errors.length > 0) {
		fail(errors);
	}
	console.info(`codex-agent-roles: pass (${EXPECTED_ROLES.length} roles)`);
}

main();
