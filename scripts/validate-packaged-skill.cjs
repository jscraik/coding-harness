#!/usr/bin/env node

const { existsSync, readFileSync, readdirSync } = require("node:fs");
const { resolve, join, relative } = require("node:path");
const { spawnSync } = require("node:child_process");

const REPO_ROOT = resolve(__dirname, "..");
const SKILL_ROOT = resolve(REPO_ROOT, ".agents/skills/coding-harness");
const REPO_SKILLS_ROOT = resolve(REPO_ROOT, ".agents/skills");

const REQUIRED_FILES = {
	skill: ".agents/skills/coding-harness/SKILL.md",
	setup: ".agents/skills/coding-harness/references/setup-and-commands.md",
};

const MARKDOWN_FILES = [REQUIRED_FILES.skill, REQUIRED_FILES.setup];

const REQUIRED_ROUTINE_COMMANDS = [
	"harness next --json",
	"harness init --minimal --dry-run --json",
	"harness check --json",
	"harness verify-work --fast",
	"harness pr-closeout --pr <number> --json",
];

const FORBIDDEN_PATTERNS = [
	{
		pattern: "harness orient",
		message:
			"stale orientation guidance found; `harness next --json` is the supported entrypoint",
	},
	{
		pattern: "harness upgrade",
		message:
			"stale upgrade guidance found; it is not part of the routine product",
	},
	{
		pattern: "harness ci-migrate",
		message:
			"stale CI migration guidance found; it is not part of the routine product",
	},
	{
		pattern: "harness commands --json --all",
		message:
			"hidden command catalogue guidance found; routine users should use the five supported commands",
	},
];

const SKILL_KIND_VALUES = new Set(["executable", "advisory"]);

const SKILL_OVERLAP_THRESHOLD = {
	minimumSharedTokens: 5,
	minimumJaccard: 0.45,
};

const TRIGGER_STOPWORDS = new Set([
	"about",
	"across",
	"after",
	"also",
	"and",
	"any",
	"are",
	"ask",
	"asks",
	"but",
	"can",
	"do",
	"does",
	"for",
	"from",
	"has",
	"have",
	"how",
	"inside",
	"into",
	"its",
	"not",
	"or",
	"over",
	"that",
	"the",
	"their",
	"this",
	"to",
	"use",
	"used",
	"users",
	"using",
	"when",
	"while",
	"with",
	"without",
]);

/**
 * Print an error message to stderr and terminate the process with exit code 1.
 *
 * @param {string} message - The error message to write to stderr before exiting.
 */
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
}

/**
 * Validate the packaged skill and its single command reference against the
 * supported routine product.
 */
function validateSkillMarkdown() {
	const skillContent = readRepoFile(REQUIRED_FILES.skill);
	const setupContent = readRepoFile(REQUIRED_FILES.setup);

	for (const command of REQUIRED_ROUTINE_COMMANDS) {
		assert(
			skillContent.includes(command),
			`SKILL.md is missing routine command: ${command}`,
		);
		assert(
			setupContent.includes(command),
			`setup-and-commands.md is missing routine command: ${command}`,
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

function parseFrontmatterScalar(value) {
	const trimmedValue = value.trim();
	if (
		(trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) ||
		(trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))
	) {
		return trimmedValue.slice(1, -1);
	}
	return trimmedValue;
}

function parseSkillFrontmatter(content) {
	if (!content.startsWith("---\n")) {
		return { body: content, metadata: {} };
	}

	const endIndex = content.indexOf("\n---\n", 4);
	if (endIndex === -1) {
		return { body: content, metadata: {} };
	}

	const frontmatter = content.slice(4, endIndex);
	const body = content.slice(endIndex + "\n---\n".length);
	const metadata = {};
	let currentListKey = null;

	for (const rawLine of frontmatter.split("\n")) {
		const line = rawLine.trim();
		if (!line) {
			continue;
		}

		if (currentListKey && line.startsWith("- ")) {
			metadata[currentListKey].push(parseFrontmatterScalar(line.slice(2)));
			continue;
		}

		currentListKey = null;
		const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/u);
		if (!match) {
			continue;
		}

		const [, key, rawValue] = match;
		const value = rawValue.trim();
		if (!value) {
			metadata[key] = [];
			currentListKey = key;
			continue;
		}

		if (value.startsWith("[") && value.endsWith("]")) {
			metadata[key] = value
				.slice(1, -1)
				.split(",")
				.map((entry) => parseFrontmatterScalar(entry))
				.filter(Boolean);
			continue;
		}

		metadata[key] = parseFrontmatterScalar(value);
	}

	return { body, metadata };
}

function listRepoSkillFiles(skillsRoot = REPO_SKILLS_ROOT) {
	if (!existsSync(skillsRoot)) {
		return [];
	}

	return readdirSync(skillsRoot, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => join(skillsRoot, entry.name, "SKILL.md"))
		.filter((skillPath) => existsSync(skillPath));
}

function extractUseBullets(body) {
	const lines = body.split("\n");
	const useSectionStart = lines.findIndex((line) => line.trim() === "## Use");
	if (useSectionStart === -1) {
		return [];
	}

	const useSectionLines = [];
	for (let index = useSectionStart + 1; index < lines.length; index += 1) {
		const line = lines[index];
		if (line.trim().startsWith("## ")) {
			break;
		}
		useSectionLines.push(line);
	}

	return useSectionLines
		.map((line) => line.trim())
		.filter((line) => line.startsWith("- "))
		.map((line) => line.slice(2));
}

function normalizeTriggerTokens(text) {
	return [
		...new Set(
			text
				.toLowerCase()
				.replace(/[^a-z0-9]+/gu, " ")
				.split(/\s+/u)
				.map((token) => token.trim())
				.filter((token) => token.length > 2)
				.filter((token) => !TRIGGER_STOPWORDS.has(token)),
		),
	].sort();
}

function hasHeading(body, heading) {
	return new RegExp(`^## ${heading}$`, "mu").test(body);
}

function hasDirectoryWithFiles(directoryPath) {
	if (!existsSync(directoryPath)) {
		return false;
	}
	return readdirSync(directoryPath, { withFileTypes: true }).some((entry) =>
		entry.isFile(),
	);
}

function hasExecutableProofAsset(skillRoot) {
	return hasDirectoryWithFiles(join(skillRoot, "scripts"));
}

function hasAdvisoryReferences(skillRoot) {
	return hasDirectoryWithFiles(join(skillRoot, "references"));
}

function addFinding(findings, finding) {
	findings.push({
		severity: finding.severity,
		code: finding.code,
		skill: finding.skill,
		path: finding.path,
		message: finding.message,
		remediation: finding.remediation,
	});
}

function buildSkillInventory(repoRoot, skillsRoot) {
	return listRepoSkillFiles(skillsRoot).map((skillFile) => {
		const content = readFileSync(skillFile, "utf8");
		const { body, metadata } = parseSkillFrontmatter(content);
		const skillRoot = resolve(skillFile, "..");
		const skillName = metadata.name || relative(skillsRoot, skillRoot);
		const triggerText = [
			metadata.description || "",
			...(Array.isArray(metadata.triggers) ? metadata.triggers : []),
			...extractUseBullets(body),
		].join("\n");

		return {
			body,
			metadata,
			path: relative(repoRoot, skillFile),
			skillName,
			skillRoot,
			triggerTokens: normalizeTriggerTokens(triggerText),
		};
	});
}

function validateSkillMetadata(skill, findings) {
	const { body, metadata } = skill;
	const kind = metadata.skill_kind;
	const ownedWorkflow = metadata.owned_workflow;
	const validationCommand = metadata.validation_command;
	const validationCommandInBody =
		typeof validationCommand === "string" && body.includes(validationCommand);

	if (!kind) {
		addFinding(findings, {
			code: "skill_missing_classification",
			severity: "error",
			skill: skill.skillName,
			path: skill.path,
			message: "Skill must declare skill_kind frontmatter.",
			remediation:
				"Add skill_kind: executable or skill_kind: advisory to the skill frontmatter.",
		});
	} else if (!SKILL_KIND_VALUES.has(kind)) {
		addFinding(findings, {
			code: "skill_invalid_classification",
			severity: "error",
			skill: skill.skillName,
			path: skill.path,
			message: `Skill declares unsupported skill_kind: ${kind}.`,
			remediation: "Use skill_kind: executable or skill_kind: advisory.",
		});
	}

	if (!ownedWorkflow) {
		addFinding(findings, {
			code: "skill_missing_owned_workflow",
			severity: "error",
			skill: skill.skillName,
			path: skill.path,
			message: "Skill must declare owned_workflow frontmatter.",
			remediation:
				"Add owned_workflow with the concrete workflow this skill owns.",
		});
	}

	if (!validationCommand) {
		addFinding(findings, {
			code: "skill_missing_validation_command",
			severity: "error",
			skill: skill.skillName,
			path: skill.path,
			message: "Skill must declare validation_command frontmatter.",
			remediation:
				"Add validation_command and document the same command in the skill body.",
		});
	} else if (!validationCommandInBody) {
		addFinding(findings, {
			code: "skill_validation_command_unreferenced",
			severity: "error",
			skill: skill.skillName,
			path: skill.path,
			message:
				"Skill validation_command frontmatter is not documented in the skill body.",
			remediation:
				"Add the validation command to the skill workflow, validation, or references section.",
		});
	}

	const proofAsset = hasExecutableProofAsset(skill.skillRoot);
	const advisoryReferences = hasAdvisoryReferences(skill.skillRoot);
	const workflowSection = hasHeading(body, "Workflow");

	if (kind === "executable" && !proofAsset) {
		addFinding(findings, {
			code: "skill_missing_executable_proof",
			severity: "error",
			skill: skill.skillName,
			path: skill.path,
			message:
				"Executable skill must include a scripts directory, eval fixture, install JSON, or equivalent proof asset.",
			remediation:
				"Add an executable proof asset or reclassify the skill as advisory if it only guides review.",
		});
	}

	if (kind === "advisory" && (!workflowSection || !advisoryReferences)) {
		addFinding(findings, {
			code: "skill_missing_advisory_references",
			severity: "error",
			skill: skill.skillName,
			path: skill.path,
			message:
				"Advisory skill must include a Workflow section and reference material.",
			remediation:
				"Add a Workflow section plus references, or reclassify with executable proof assets.",
		});
	}

	if (
		!proofAsset &&
		!advisoryReferences &&
		!workflowSection &&
		!validationCommandInBody
	) {
		addFinding(findings, {
			code: "skill_prompt_only_risk",
			severity: "error",
			skill: skill.skillName,
			path: skill.path,
			message:
				"Skill appears to be prompt prose without executable proof, structured references, workflow ownership, or body-documented validation.",
			remediation:
				"Add deterministic proof assets or advisory workflow/reference evidence before relying on the skill.",
		});
	}
}

function loadOverlapAllowlist(repoRoot) {
	const allowlistPath = join(
		repoRoot,
		".agents",
		"skills",
		"skill-overlap-allowlist.json",
	);
	if (!existsSync(allowlistPath)) {
		return [];
	}
	const parsed = JSON.parse(readFileSync(allowlistPath, "utf8"));
	return Array.isArray(parsed.allowlist) ? parsed.allowlist : [];
}

function isOverlapAllowlisted(allowlist, leftSkill, rightSkill, sharedTokens) {
	return allowlist.some((entry) => {
		const skills = Array.isArray(entry.skills) ? entry.skills : [];
		const tokens = Array.isArray(entry.sharedTokens) ? entry.sharedTokens : [];
		return (
			skills.includes(leftSkill) &&
			skills.includes(rightSkill) &&
			sharedTokens.every((token) => tokens.includes(token)) &&
			typeof entry.reason === "string" &&
			entry.reason.trim().length > 0
		);
	});
}

function validateSkillOverlap(skills, findings, allowlist) {
	for (let leftIndex = 0; leftIndex < skills.length; leftIndex += 1) {
		for (
			let rightIndex = leftIndex + 1;
			rightIndex < skills.length;
			rightIndex += 1
		) {
			const left = skills[leftIndex];
			const right = skills[rightIndex];
			const leftTokens = new Set(left.triggerTokens);
			const rightTokens = new Set(right.triggerTokens);
			const sharedTokens = [...leftTokens]
				.filter((token) => rightTokens.has(token))
				.sort();
			const unionSize = new Set([...leftTokens, ...rightTokens]).size;
			const jaccard = unionSize === 0 ? 0 : sharedTokens.length / unionSize;

			if (
				sharedTokens.length >= SKILL_OVERLAP_THRESHOLD.minimumSharedTokens &&
				jaccard >= SKILL_OVERLAP_THRESHOLD.minimumJaccard &&
				!isOverlapAllowlisted(
					allowlist,
					left.skillName,
					right.skillName,
					sharedTokens,
				)
			) {
				addFinding(findings, {
					code: "skill_overlap_blocking",
					severity: "error",
					skill: `${left.skillName}, ${right.skillName}`,
					path: `${left.path}, ${right.path}`,
					message:
						"Skills share " +
						sharedTokens.length +
						" trigger tokens with Jaccard " +
						jaccard.toFixed(2) +
						": " +
						sharedTokens.join(", ") +
						".",
					remediation:
						"Tighten trigger language or add a deterministic overlap allowlist entry naming both skills, tokens, and reason.",
				});
			}
		}
	}
}

function collectSkillDensityReport(options = {}) {
	const repoRoot = options.repoRoot || REPO_ROOT;
	const skillsRoot = options.skillsRoot || resolve(repoRoot, ".agents/skills");
	const findings = [];
	const skills = buildSkillInventory(repoRoot, skillsRoot);
	const allowlist = loadOverlapAllowlist(repoRoot);

	for (const skill of skills) {
		validateSkillMetadata(skill, findings);
	}
	validateSkillOverlap(skills, findings, allowlist);

	return {
		findingCount: findings.length,
		findings,
		schemaVersion: "skill-density-report/v1",
		skills: skills.map((skill) => ({
			kind: skill.metadata.skill_kind || null,
			name: skill.skillName,
			ownedWorkflow: skill.metadata.owned_workflow || null,
			path: skill.path,
			triggerTokens: skill.triggerTokens,
			validationCommand: skill.metadata.validation_command || null,
		})),
		status: findings.some((finding) => finding.severity === "error")
			? "fail"
			: "pass",
	};
}

function validateSkillDensity() {
	const report = collectSkillDensityReport();
	const errors = report.findings.filter(
		(finding) => finding.severity === "error",
	);
	const warnings = report.findings.filter(
		(finding) => finding.severity !== "error",
	);
	for (const warning of warnings) {
		console.warn(
			"packaged-skill: " +
				warning.code +
				": " +
				warning.skill +
				": " +
				warning.message +
				" Remediation: " +
				warning.remediation,
		);
	}
	if (errors.length > 0) {
		fail(
			[
				"skill-density: failed",
				...errors.map(
					(error) =>
						error.code +
						": " +
						error.skill +
						": " +
						error.message +
						" Remediation: " +
						error.remediation +
						" (" +
						error.path +
						")",
				),
			].join("\n"),
		);
	}
	console.info(`skill-density: pass (${report.skills.length} skills)`);
}

function main() {
	validateRequiredFiles();
	validateLintSurfaces();
	validateSkillMarkdown();
	validateForbiddenPatterns();
	validateSkillDensity();
	console.info("packaged-skill: pass");
}

if (require.main === module) {
	main();
}

module.exports = {
	collectSkillDensityReport,
	normalizeTriggerTokens,
	parseSkillFrontmatter,
};
