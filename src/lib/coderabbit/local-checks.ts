import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { verifyNpmrc } from "./npmrc-check.js";

export const CODERABBIT_CHECK_NAME = "CodeRabbit";
const CODERABBIT_CONFIG_FILE = ".coderabbit.yaml";
const CODERABBIT_TEMPLATE_FILE = "src/templates/coderabbit.yaml";

/** One verification check outcome within a CodeRabbit verification run. */
export interface CodeRabbitCheck {
	name: string;
	status: "pass" | "fail" | "warn";
	message: string;
	details?: Record<string, unknown>;
}

interface CostControlRule {
	feature: string;
	issue: string;
	passes: (content: string) => boolean;
}

const COST_CONTROL_RULES: readonly CostControlRule[] = [
	{
		feature: "draft PR auto-review disabled",
		issue: "set reviews.auto_review.drafts: false to skip draft churn",
		passes: (content) => /^\s*drafts:\s*false\b/m.test(content),
	},
	{
		feature: "sequence diagrams disabled by default",
		issue:
			"set reviews.sequence_diagrams: false unless architecture diagrams are needed for the PR",
		passes: (content) => /^\s*sequence_diagrams:\s*false\b/m.test(content),
	},
	{
		feature: "web search disabled by default",
		issue:
			"set knowledge_base.web_search.enabled: false by default and request external research only for dependency/API changes",
		passes: (content) => /web_search:\s*\n\s+enabled:\s*false\b/m.test(content),
	},
];

const GENERATED_FILTERS = [
	"!artifacts/**",
	"!build/**",
	"!coverage/**",
	"!dist/**",
	"!node_modules/**",
	"!**/*.min.js",
];

/** Run local CodeRabbit repository checks in stable report order. */
export function verifyLocalCodeRabbitSetup(
	repoPath: string,
): CodeRabbitCheck[] {
	const configPath = resolve(repoPath, CODERABBIT_CONFIG_FILE);
	const checks = [
		verifyCodeRabbitConfig(repoPath),
		verifyCodeRabbitTemplateParity(repoPath),
	];
	if (existsSync(configPath))
		checks.push(verifyCodeRabbitCostControls(repoPath));
	checks.push(verifyNpmrc(repoPath));
	return checks;
}

/**
 * Validate the repository's CodeRabbit config and required review status setup.
 *
 * @param repoPath - Repository root where `.coderabbit.yaml` is inspected
 * @returns A check describing required config presence and critical settings
 */
function verifyCodeRabbitConfig(repoPath: string): CodeRabbitCheck {
	const configPath = resolve(repoPath, CODERABBIT_CONFIG_FILE);
	if (!existsSync(configPath)) {
		return {
			name: `${CODERABBIT_CONFIG_FILE} config`,
			status: "fail",
			message: `${CODERABBIT_CONFIG_FILE} not found. Run \`harness init\` to scaffold a baseline configuration.`,
			details: { path: configPath },
		};
	}

	try {
		return codeRabbitConfigCheck(configPath, readFileSync(configPath, "utf-8"));
	} catch (e) {
		return readFailureCheck(`${CODERABBIT_CONFIG_FILE} config`, configPath, e);
	}
}

/** Build the CodeRabbit config check from already-read file content. */
function codeRabbitConfigCheck(
	configPath: string,
	content: string,
): CodeRabbitCheck {
	const issues: string[] = [];
	const features: string[] = [];

	if (!/^reviews:/m.test(content))
		issues.push("missing top-level 'reviews:' section");
	else features.push("reviews section present");
	if (/^\s*commit_status:\s*false\b/m.test(content)) {
		issues.push(
			"'commit_status: false' disables the CodeRabbit check — branch protection will not work",
		);
	} else if (/^\s*commit_status:\s*true\b/m.test(content)) {
		features.push("commit_status enabled");
	}
	if (/auto_review:\s*\n\s+enabled:\s*false/m.test(content)) {
		issues.push(
			"auto_review is disabled — CodeRabbit will not review PRs automatically",
		);
	}

	if (issues.length > 0) {
		return {
			name: `${CODERABBIT_CONFIG_FILE} config`,
			status: issues.some((issue) => issue.includes("missing"))
				? "fail"
				: "warn",
			message: `${CODERABBIT_CONFIG_FILE} has issues: ${issues.join(", ")}`,
			details: { path: configPath, issues, features },
		};
	}
	return {
		name: `${CODERABBIT_CONFIG_FILE} config`,
		status: "pass",
		message: `Valid ${CODERABBIT_CONFIG_FILE}: ${features.join(", ")}`,
		details: { path: configPath, features },
	};
}

/**
 * Compare repository CodeRabbit config with the harness scaffold template.
 *
 * @param repoPath - Repository root containing the config and template paths
 * @returns A check describing whether the local config matches the template
 */
function verifyCodeRabbitTemplateParity(repoPath: string): CodeRabbitCheck {
	const configPath = resolve(repoPath, CODERABBIT_CONFIG_FILE);
	const templatePath = resolve(repoPath, CODERABBIT_TEMPLATE_FILE);
	if (!existsSync(templatePath)) return missingTemplateCheck(templatePath);
	if (!existsSync(configPath))
		return missingConfigParityCheck(configPath, templatePath);

	try {
		const configContent = readFileSync(configPath, "utf-8");
		const templateContent = readFileSync(templatePath, "utf-8");
		if (configContent !== templateContent)
			return templateMismatchCheck(configPath, templatePath);
		return {
			name: "CodeRabbit template parity",
			status: "pass",
			message: `${CODERABBIT_CONFIG_FILE} matches ${CODERABBIT_TEMPLATE_FILE}.`,
			details: { configPath, templatePath },
		};
	} catch (e) {
		return {
			name: "CodeRabbit template parity",
			status: "fail",
			message:
				"Failed to compare CodeRabbit config/template parity: " +
				(e instanceof Error ? e.message : "Unknown error"),
			details: { configPath, templatePath },
		};
	}
}

/**
 * Inspect CodeRabbit settings for review-cost and noise-control defaults.
 *
 * @param repoPath - Repository root where `.coderabbit.yaml` exists
 * @returns A check describing whether cost-control defaults pass or warn
 */
function verifyCodeRabbitCostControls(repoPath: string): CodeRabbitCheck {
	const configPath = resolve(repoPath, CODERABBIT_CONFIG_FILE);
	try {
		const { features, issues } = collectCostControlFindings(
			readFileSync(configPath, "utf-8"),
		);
		if (issues.length > 0) {
			return {
				name: "CodeRabbit cost controls",
				status: "warn",
				message: `${CODERABBIT_CONFIG_FILE} has cost-control recommendations: ${issues.join(", ")}`,
				details: { path: configPath, features, issues },
			};
		}
		return {
			name: "CodeRabbit cost controls",
			status: "pass",
			message: `CodeRabbit cost controls enabled: ${features.join(", ")}`,
			details: { path: configPath, features },
		};
	} catch (e) {
		return readFailureCheck("CodeRabbit cost controls", configPath, e);
	}
}

/** Collect enabled CodeRabbit cost controls and missing recommendations. */
function collectCostControlFindings(content: string): {
	features: string[];
	issues: string[];
} {
	const features = COST_CONTROL_RULES.filter((rule) =>
		rule.passes(content),
	).map((rule) => rule.feature);
	const issues = COST_CONTROL_RULES.filter((rule) => !rule.passes(content)).map(
		(rule) => rule.issue,
	);
	const pauseAfterReviewedCommits = parsePauseAfterReviewedCommits(content);
	if (pauseAfterReviewedCommits > 0) {
		features.push(
			`incremental auto-review pauses after ${pauseAfterReviewedCommits} reviewed commits`,
		);
	} else {
		issues.push(
			"set reviews.auto_review.auto_pause_after_reviewed_commits above 0 to cap incremental-review loops",
		);
	}
	const missingFilters = GENERATED_FILTERS.filter(
		(filter) => !content.includes(`- "${filter}"`),
	);
	if (missingFilters.length === 0)
		features.push("generated/heavy path filters present");
	else
		issues.push(
			`add generated/heavy path filters: ${missingFilters.join(", ")}`,
		);
	return { features, issues };
}

/**
 * Parse the configured incremental review pause count.
 *
 * @param content - Raw `.coderabbit.yaml` content
 * @returns The configured count, or `0` when absent or invalid
 */
function parsePauseAfterReviewedCommits(content: string): number {
	const match = content.match(
		/^\s*auto_pause_after_reviewed_commits:\s*(\d+)\b/m,
	);
	if (!match) return 0;
	return Number.parseInt(match[1] ?? "0", 10);
}

/** Return the template-missing parity check. */
function missingTemplateCheck(templatePath: string): CodeRabbitCheck {
	return {
		name: "CodeRabbit template parity",
		status: "warn",
		message:
			CODERABBIT_TEMPLATE_FILE +
			" not found; skipping harness template parity check.",
		details: { path: templatePath },
	};
}

/** Return the config-missing parity check. */
function missingConfigParityCheck(
	configPath: string,
	templatePath: string,
): CodeRabbitCheck {
	return {
		name: "CodeRabbit template parity",
		status: "fail",
		message: `${CODERABBIT_CONFIG_FILE} not found, so template parity cannot be verified.`,
		details: { configPath, templatePath },
	};
}

/** Return the config/template mismatch check. */
function templateMismatchCheck(
	configPath: string,
	templatePath: string,
): CodeRabbitCheck {
	return {
		name: "CodeRabbit template parity",
		status: "fail",
		message:
			CODERABBIT_CONFIG_FILE +
			" and " +
			CODERABBIT_TEMPLATE_FILE +
			" differ; update both or regenerate the template.",
		details: { configPath, templatePath },
	};
}

/** Return a read-failure check with a sanitized unknown-error fallback. */
function readFailureCheck(
	name: string,
	path: string,
	error: unknown,
): CodeRabbitCheck {
	return {
		name,
		status: "fail",
		message: `Failed to read ${path}: ${error instanceof Error ? error.message : "Unknown error"}`,
		details: { path },
	};
}
