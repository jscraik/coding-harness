#!/usr/bin/env node

const { existsSync, readFileSync, readdirSync } = require("node:fs");
const { join, resolve, sep } = require("node:path");

const REPO_ROOT = resolve(__dirname, "..");

const REQUIRED_FILES = {
	agents: "AGENTS.md",
	validation: "docs/agents/04-validation.md",
	agentGovernance: "docs/agents/07b-agent-governance.md",
	glossary: "UBIQUITOUS_LANGUAGE.md",
	memory: ".harness/memory/LEARNINGS.md",
	prTemplate: ".github/PULL_REQUEST_TEMPLATE.md",
	prValidator: "src/lib/pr-template-validator.ts",
	prValidatorEvidence: "src/lib/pr-template-behavior-evidence.ts",
	solution:
		"docs/solutions/integration-issues/2026-05-17-steering-feedback-admission.md",
	envSolution:
		"docs/solutions/integration-issues/2026-05-19-env-backed-validation-admission.md",
};
const ADMISSION_RECORD_DIR = ".harness/implementation-notes";
const REQUIRED_ADMISSION_RECORD =
	".harness/implementation-notes/2026-05-20-steering-admission.md";
const FULL_IMPLEMENTATION_DOWNSCOPE_AUDIT =
	".harness/research/audits/2026-05-21-plan-and-research-code-tree-gap-audit.md";
const FULL_IMPLEMENTATION_DOWNSCOPE_STATE =
	"docs/goals/jsc-331-goal-governed-evidence-led-implementation/state.yaml";
const ACTIVE_ENV_BACKED_VALIDATION_SURFACES = [
	"docs/goals/coding-harness-deep-module-migration/state.yaml",
	".harness/implementation-notes/2026-05-19-module-layout.html",
	"artifacts/architecture/module-layout.html",
];
const ACTIVE_ENV_BACKED_RECEIPTS =
	"docs/goals/coding-harness-deep-module-migration/receipts.jsonl";

const DURABLE_DESTINATION_PATTERN =
	/(gate|validator|schema|scaffold|template field|validation rule|project brain|linear|tracked issue|memory update|solution record|codestyle|docs-gate|guard|explicit exception)/i;
const EXPECTED_OUTCOME_PATTERN =
	/(expected outcome|portable agent operating system|software engineer|code generator|zero customer integration ceremony|greenfield and brownfield)/i;
const REPEAT_FEEDBACK_ADMISSION_PATTERN =
	/(repeat-feedback admission|repeated steering|same steering twice|same feedback twice|stop-the-line environment defect|ordinary feature work)/i;
const PATTERN_GENERALIZATION_PATTERN =
	/(pattern-generalization|pattern generalization|sibling implementations|similar classes of misbehavior|shared abstraction|intentionally local|design principle|design\/API principle)/i;
const PATTERN_SCOPE_INVENTORY_PATTERN =
	/(pattern scope inventory|siblings changed|siblings left unchanged|sibling implementations searched|similar misbehavior classes searched|deferred follow-ups|deferred followup)/i;
const OBSERVED_FIXABLE_BLOCKER_PATTERN =
	/(observed fixable blockers|fixable blocker|fix it in the same pass|rerun the narrowest proving command|tracked exception with the exact reason)/i;
const PATTERN_SCOPE_VALIDATOR_PATTERN =
	/(PATTERN_SCOPE_SIGNAL_PATTERN|collectPatternScopeInventoryErrors|Pattern scope inventory must name the inferred principle)/i;
const PRINCIPLE_SIGNAL_PATTERN =
	/(\bPrinciple Signal\b|example-based feedback|named-function feedback|single-line corrections|across everything|design model)/i;
const META_BEHAVIOR_PROOF_PATTERN =
	/(Meta-behavior proof|durable repo\/system change.*concrete repo path|prevents recurrence|same feedback twice)/i;
const OODA_HORIZON_PATTERN =
	/(ooda horizon|horizontal horizon|vertical horizon|single-turn|stacked trajectories|adjacent pr|adjacent organizational activity)/i;
const REFLECTED_CONTEXT_PATTERN =
	/(reflected context|resumed target context|session-collector|agent reflection|unobserved horizon|compaction|environment boundaries)/i;
const ENGINEERING_PROOF_PATTERN =
	/(software engineering proof|code production|benchmark-style|swe bench|program bench|terminal bench|maintainability|traceability|handoff quality)/i;
const WORKFLOW_SKILL_PROOF_PATTERN =
	/(workflow skill|capture-the-flag|capture the flag|win condition|flag is captured|skill workout|self-reflection|reflect on failures)/i;
const TOOL_PROMOTION_THRESHOLD_PATTERN =
	/(same judgment[\s\S]{0,160}twice|failure mode[\s\S]{0,160}recur across slices)[\s\S]{0,900}(smallest durable|small operating primitive|validator|guard script|CLI helper|workflow hook|fixture|scoped skill)[\s\S]{0,900}(one-off implementation|implementation notes|plan evidence|PR closeout evidence)[\s\S]{0,900}(skill|reusable routed workflow|inputs[\s\S]{0,120}artifacts[\s\S]{0,120}validation[\s\S]{0,120}ownership)/i;
const CURRENT_SESSION_ADMISSION_PATTERN =
	/(current-session steering admission record|not permitted to proceed|feedback class.*inferred principle.*searched surfaces.*durable destination|forbidden recurrence behavior)/i;
const PLANNING_ONLY_STOP_PATTERN =
	/(planning-only|planning conversation|not making (the )?changes yet|before implementation|implementation cue|do not implement|no file edits)/i;
const REPEATED_ERROR_RESEARCH_PATTERN =
	/(Repeated-error research|Repeated-Error Research Pass|same-error-twice|same error happens twice|same error happened twice|same command.*test.*runtime error happens twice|Source:.*Candidate 1:.*Candidate 2:.*Candidate 3:.*Chosen:.*Implemented:|3-5 numbered Candidate\/Fix\/Option|don.t fight errors)/i;
const CLOSEOUT_COMPLETION_PATTERN =
	/(closeout completion|green checks.*not.*complete|green checks.*validation evidence|not equivalent to green checks|PR state.*merge.*Linear.*next-lane|heartbeat.*lane.*complete)/i;
const ENV_BACKED_VALIDATION_PATTERN =
	/(Env-Backed Validation Recovery|env-backed validation recovery|~\/\.codex\/\.env|set -a; source ~\/\.codex\/\.env; set \+a|inspect.*required.*variable names.*without printing values|missing credential.*env-loaded rerun)/i;
const CIRCLECI_ENV_API_TRIAGE_PATTERN =
	/(CircleCI API|CircleCI log|CircleCI job)[\s\S]{0,260}(~\/\.codex\/\.env|set -a; source ~\/\.codex\/\.env; set \+a|CIRCLECI_TOKEN|CIRCLE_TOKEN|CIRCLE_API_TOKEN|Circle-Token|bounded network call|--max-time)/i;
const SAFE_PR_BODY_FILE_HANDOFF_PATTERN =
	/(PR body|pull request body)[\s\S]{0,260}(--body-file|body file|non-interpreting file|shell interpolation|command substitution|backticks|pr-template-gate --pr-body-file)/i;
const STALE_ENV_BACKED_BLOCKER_PATTERN =
	/(current process lacks GitHub and Linear credentials|GitHub and Linear credentials are unavailable|credentials are unavailable|missing_credentials|(?:~\/?\.?codex\/\.env|\.codex\/\.env)[\s\S]{0,220}\bFIFO\b[\s\S]{0,220}(?:block|blocked|hang|hung|cannot|unavailable|unsafe|not safely|cannot be safely)|\bFIFO\b[\s\S]{0,220}(?:~\/?\.?codex\/\.env|\.codex\/\.env)[\s\S]{0,220}(?:block|blocked|hang|hung|cannot|unavailable|unsafe|not safely|cannot be safely))/i;
const CLOSEOUT_STATE_FIELD_PATTERNS = [
	[/PR state/i, "PR state"],
	[/merge or auto-merge state/i, "merge or auto-merge state"],
	[/(branch\/worktree|branch and worktree) state/i, "branch/worktree state"],
	[/Linear state/i, "Linear state"],
	[/next-lane routing/i, "next-lane routing"],
];
const REVIEW_THREAD_TRUTH_PATTERN =
	/(GitHub GraphQL[\s\S]*reviewThreads[\s\S]*isResolved[\s\S]*isOutdated|reviewThreads[\s\S]*flat comments[\s\S]*not sufficient)/i;
const AGENT_ENGINEERING_LOOP_PATTERN = /agent engineering proof loop/i;
const LOOP_MOVE_PATTERNS = [
	/observe/i,
	/orient/i,
	/decide/i,
	/act/i,
	/close out|closeout/i,
];

function readRequiredFile(label, path) {
	const absPath = resolve(REPO_ROOT, path);
	if (!existsSync(absPath)) {
		return {
			content: "",
			errors: [`${label}: missing required file ${path}`],
		};
	}

	return { content: readFileSync(absPath, "utf8"), errors: [] };
}

function requirePattern(errors, label, content, pattern, description) {
	if (!pattern.test(content)) {
		errors.push(`${label}: missing ${description}`);
	}
}

function collectAdmissionRecordPaths() {
	const admissionDir = resolve(REPO_ROOT, ADMISSION_RECORD_DIR);
	if (!existsSync(admissionDir)) {
		return [];
	}

	return readdirSync(admissionDir)
		.filter((name) => /steering-admission.*\.md$/i.test(name))
		.map((name) => join(ADMISSION_RECORD_DIR, name))
		.map((admissionPath) => admissionPath.split(sep).join("/"))
		.sort();
}

function validateAdmissionRecord(path, content) {
	const errors = [];
	requirePattern(
		errors,
		path,
		content,
		/^# Current-Session Steering Admission$/m,
		"current-session steering admission title",
	);
	requirePattern(
		errors,
		path,
		content,
		CURRENT_SESSION_ADMISSION_PATTERN,
		"current-session steering admission record language",
	);
	requirePattern(
		errors,
		path,
		content,
		/^## Feedback Signal$/m,
		"feedback signal section",
	);
	requirePattern(
		errors,
		path,
		content,
		/^## Root Operational Failure$/m,
		"root operational failure section",
	);
	requirePattern(
		errors,
		path,
		content,
		/^## Failure Category$/m,
		"failure category section",
	);
	requirePattern(
		errors,
		path,
		content,
		/^## Searched Surfaces$/m,
		"searched surfaces section",
	);
	requirePattern(
		errors,
		path,
		content,
		/^## Durable System Improvement$/m,
		"durable system improvement section",
	);
	requirePattern(
		errors,
		path,
		content,
		DURABLE_DESTINATION_PATTERN,
		"durable destination evidence",
	);
	requirePattern(
		errors,
		path,
		content,
		/^## Executable Guard$/m,
		"executable guard section",
	);
	requirePattern(
		errors,
		path,
		content,
		/pnpm run docs:steering:guard/i,
		"focused steering guard validation command",
	);
	requirePattern(
		errors,
		path,
		content,
		/^## Forbidden Recurrence Behavior$/m,
		"forbidden recurrence behavior section",
	);
	requirePattern(
		errors,
		path,
		content,
		/^## Validation$/m,
		"validation section",
	);
	requirePattern(
		errors,
		path,
		content,
		/Command: .* -> (pending|pass|fail|blocked)/i,
		"explicit validation command outcome",
	);
	requirePattern(
		errors,
		path,
		content,
		/^## Review Condition$/m,
		"review condition section",
	);
	return errors;
}

function validateAdmissionRecords() {
	const paths = collectAdmissionRecordPaths();
	const errors = [];
	if (!paths.includes(REQUIRED_ADMISSION_RECORD)) {
		errors.push(
			`admission records: missing required current-session record ${REQUIRED_ADMISSION_RECORD}`,
		);
	}
	for (const path of paths) {
		const result = readRequiredFile(path, path);
		errors.push(...result.errors);
		if (result.errors.length === 0) {
			errors.push(...validateAdmissionRecord(path, result.content));
		}
	}
	return errors;
}

/**
 * Validate that AGENTS.md contains all required steering-feedback contract patterns.
 *
 * @param {string} content - The full text of AGENTS.md to be checked.
 * @returns {string[]} An array of error messages for each missing required pattern; empty if all checks pass.
 */
function validateAgents(content) {
	const errors = [];
	requirePattern(
		errors,
		REQUIRED_FILES.agents,
		content,
		/Agent engineering proof:/i,
		"agent engineering proof operating rule",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.agents,
		content,
		EXPECTED_OUTCOME_PATTERN,
		"expected outcome contract",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.agents,
		content,
		REPEAT_FEEDBACK_ADMISSION_PATTERN,
		"repeat-feedback admission stop condition",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.agents,
		content,
		CURRENT_SESSION_ADMISSION_PATTERN,
		"current-session steering admission record stop condition",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.agents,
		content,
		PLANNING_ONLY_STOP_PATTERN,
		"planning-only stop condition",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.agents,
		content,
		REPEATED_ERROR_RESEARCH_PATTERN,
		"repeated-error research stop condition",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.agents,
		content,
		DURABLE_DESTINATION_PATTERN,
		"durable destination list",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.agents,
		content,
		/principle.*sibling patterns.*OODA horizons.*durable destination/is,
		"synthesized principle-pattern-horizon-destination flow",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.agents,
		content,
		PATTERN_GENERALIZATION_PATTERN,
		"line-level feedback pattern-generalization rule",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.agents,
		content,
		PATTERN_SCOPE_INVENTORY_PATTERN,
		"pattern scope inventory requirement",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.agents,
		content,
		OBSERVED_FIXABLE_BLOCKER_PATTERN,
		"observed fixable blocker fix-first rule",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.agents,
		content,
		TOOL_PROMOTION_THRESHOLD_PATTERN,
		"tool promotion threshold for repeated judgments",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.agents,
		content,
		ENV_BACKED_VALIDATION_PATTERN,
		"env-backed validation recovery before missing-credential blockers",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.agents,
		content,
		PRINCIPLE_SIGNAL_PATTERN,
		"semantic principle signal trigger requirement",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.agents,
		content,
		OODA_HORIZON_PATTERN,
		"OODA horizon rule for broader context",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.agents,
		content,
		REFLECTED_CONTEXT_PATTERN,
		"reflected-context rule for boundary-crossing horizons",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.agents,
		content,
		ENGINEERING_PROOF_PATTERN,
		"software-engineering proof rule beyond benchmark code production",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.agents,
		content,
		WORKFLOW_SKILL_PROOF_PATTERN,
		"workflow skill capture-the-flag proof rule",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.agents,
		content,
		TOOL_PROMOTION_THRESHOLD_PATTERN,
		"tool/validator/skill promotion threshold",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.agents,
		content,
		CLOSEOUT_COMPLETION_PATTERN,
		"closeout completion is not green checks rule",
	);
	return errors;
}

/**
 * Validate that the agent-governance guide preserves the tool-promotion threshold.
 *
 * @param {string} content - Markdown content of the agent-governance guide.
 * @returns {string[]} Contract errors, empty when the threshold remains encoded.
 */
function validateAgentGovernance(content) {
	const errors = [];
	requirePattern(
		errors,
		REQUIRED_FILES.agentGovernance,
		content,
		TOOL_PROMOTION_THRESHOLD_PATTERN,
		"tool/validator/skill promotion threshold",
	);
	return errors;
}

/**
 * Validate that a validation-document markdown contains the steering-feedback closeout section and all required contract evidence.
 *
 * @param {string} content - Markdown content of the validation document.
 * @returns {string[]} An array of error messages for each missing required heading or pattern; empty if all checks pass.
 */
function validateValidationDoc(content) {
	const errors = [];
	requirePattern(
		errors,
		REQUIRED_FILES.validation,
		content,
		/- \[Steering feedback closeout\]\(#steering-feedback-closeout\)/,
		"table-of-contents entry for steering feedback closeout",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.validation,
		content,
		/^### Steering feedback closeout$/m,
		"steering feedback closeout section",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.validation,
		content,
		AGENT_ENGINEERING_LOOP_PATTERN,
		"agent engineering proof loop",
	);
	for (const pattern of LOOP_MOVE_PATTERNS) {
		requirePattern(
			errors,
			REQUIRED_FILES.validation,
			content,
			pattern,
			`loop move ${pattern}`,
		);
	}
	requirePattern(
		errors,
		REQUIRED_FILES.validation,
		content,
		EXPECTED_OUTCOME_PATTERN,
		"expected outcome closeout frame",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.validation,
		content,
		REPEAT_FEEDBACK_ADMISSION_PATTERN,
		"repeat-feedback admission closeout requirement",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.validation,
		content,
		CURRENT_SESSION_ADMISSION_PATTERN,
		"current-session steering admission record requirement",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.validation,
		content,
		PLANNING_ONLY_STOP_PATTERN,
		"planning-only stop requirement",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.validation,
		content,
		REPEATED_ERROR_RESEARCH_PATTERN,
		"repeated-error research requirement",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.validation,
		content,
		/Durable destination/i,
		"durable destination evidence requirement",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.validation,
		content,
		/Meta-behavior proof/i,
		"meta-behavior proof closeout requirement",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.validation,
		content,
		/validation surface/i,
		"validation surface evidence requirement",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.validation,
		content,
		/review or deletion condition/i,
		"review or deletion condition requirement",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.validation,
		content,
		/standalone prose/i,
		"standalone prose rejection",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.validation,
		content,
		PATTERN_GENERALIZATION_PATTERN,
		"pattern-generalization closeout requirement",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.validation,
		content,
		PATTERN_SCOPE_INVENTORY_PATTERN,
		"pattern scope inventory closeout requirement",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.validation,
		content,
		OBSERVED_FIXABLE_BLOCKER_PATTERN,
		"observed fixable blocker validation rule",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.validation,
		content,
		TOOL_PROMOTION_THRESHOLD_PATTERN,
		"tool promotion threshold validation rule",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.validation,
		content,
		ENV_BACKED_VALIDATION_PATTERN,
		"env-backed validation recovery rule",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.validation,
		content,
		CIRCLECI_ENV_API_TRIAGE_PATTERN,
		"CircleCI env-backed API triage rule",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.validation,
		content,
		SAFE_PR_BODY_FILE_HANDOFF_PATTERN,
		"safe PR body file handoff rule",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.validation,
		content,
		PRINCIPLE_SIGNAL_PATTERN,
		"semantic principle signal trigger requirement",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.validation,
		content,
		/return a named sentinel error instead of a success\/failure boolean/i,
		"API design example for pattern feedback",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.validation,
		content,
		OODA_HORIZON_PATTERN,
		"OODA horizon closeout requirement",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.validation,
		content,
		/stack-aware.*organization-aware/i,
		"decision horizon classification",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.validation,
		content,
		REFLECTED_CONTEXT_PATTERN,
		"reflected-context closeout requirement",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.validation,
		content,
		/reflected-context-backed.*unobserved/i,
		"reflected-context horizon classification",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.validation,
		content,
		ENGINEERING_PROOF_PATTERN,
		"software-engineering proof requirement",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.validation,
		content,
		WORKFLOW_SKILL_PROOF_PATTERN,
		"workflow skill capture-the-flag proof requirement",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.validation,
		content,
		TOOL_PROMOTION_THRESHOLD_PATTERN,
		"tool/validator/skill promotion threshold requirement",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.validation,
		content,
		CLOSEOUT_COMPLETION_PATTERN,
		"closeout completion is not validation-only requirement",
	);
	for (const [pattern, fieldName] of CLOSEOUT_STATE_FIELD_PATTERNS) {
		requirePattern(
			errors,
			REQUIRED_FILES.validation,
			content,
			pattern,
			`closeout state classification field: ${fieldName}`,
		);
	}
	requirePattern(
		errors,
		REQUIRED_FILES.validation,
		content,
		REVIEW_THREAD_TRUTH_PATTERN,
		"GraphQL reviewThreads source-of-truth requirement",
	);
	return errors;
}

/**
 * Validates that the glossary content contains required steering-feedback contract terms and patterns.
 *
 * @param {string} content - The full text of the glossary file to validate.
 * @returns {string[]} An array of error messages describing missing terms or patterns; empty if all checks pass.
 */
function validateGlossary(content) {
	const errors = [];
	requirePattern(
		errors,
		REQUIRED_FILES.glossary,
		content,
		/^\| Steering Feedback \|/m,
		"canonical Steering Feedback term",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.glossary,
		content,
		DURABLE_DESTINATION_PATTERN,
		"durable destination language for Steering Feedback",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.glossary,
		content,
		/feature work continues/i,
		"feature-work stop condition",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.glossary,
		content,
		/^\| Agent Engineering Proof Loop \|/m,
		"canonical Agent Engineering Proof Loop term",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.glossary,
		content,
		AGENT_ENGINEERING_LOOP_PATTERN,
		"agent engineering proof loop language",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.glossary,
		content,
		/^\| Pattern-Generalization Pass \|/m,
		"canonical Pattern-Generalization Pass term",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.glossary,
		content,
		PATTERN_GENERALIZATION_PATTERN,
		"pattern-generalization language",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.glossary,
		content,
		PATTERN_SCOPE_INVENTORY_PATTERN,
		"pattern scope inventory language",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.glossary,
		content,
		PRINCIPLE_SIGNAL_PATTERN,
		"principle signal language",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.glossary,
		content,
		/^\| Tool Promotion Threshold \|/m,
		"canonical Tool Promotion Threshold term",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.glossary,
		content,
		TOOL_PROMOTION_THRESHOLD_PATTERN,
		"tool/validator/skill promotion threshold language",
	);
	for (const term of [
		"Repeat-Feedback Admission",
		"Tool Promotion Threshold",
		"Env-Backed Validation Recovery",
		"Workflow Skill",
		"Capture-The-Flag Eval",
		"Skill Workout",
		"Win Condition",
		"Pattern Scope Inventory",
		"OODA Horizon",
		"Horizontal Horizon",
		"Vertical Horizon",
		"Reflected Context",
		"Unobserved Horizon",
		"Code Production",
		"Software Engineering Proof",
	]) {
		requirePattern(
			errors,
			REQUIRED_FILES.glossary,
			content,
			new RegExp(`^\\| ${term} \\|`, "m"),
			`canonical ${term} term`,
		);
	}
	requirePattern(
		errors,
		REQUIRED_FILES.glossary,
		content,
		EXPECTED_OUTCOME_PATTERN,
		"expected outcome contract language",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.glossary,
		content,
		REPEAT_FEEDBACK_ADMISSION_PATTERN,
		"repeat-feedback admission language",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.glossary,
		content,
		TOOL_PROMOTION_THRESHOLD_PATTERN,
		"tool promotion threshold language",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.glossary,
		content,
		CURRENT_SESSION_ADMISSION_PATTERN,
		"current-session steering admission record language",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.glossary,
		content,
		REPEATED_ERROR_RESEARCH_PATTERN,
		"repeated-error research language",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.glossary,
		content,
		ENV_BACKED_VALIDATION_PATTERN,
		"env-backed validation recovery language",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.glossary,
		content,
		CIRCLECI_ENV_API_TRIAGE_PATTERN,
		"CircleCI env-backed API triage language",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.glossary,
		content,
		SAFE_PR_BODY_FILE_HANDOFF_PATTERN,
		"safe PR body file handoff language",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.glossary,
		content,
		OODA_HORIZON_PATTERN,
		"OODA horizon language",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.glossary,
		content,
		REFLECTED_CONTEXT_PATTERN,
		"reflected-context language",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.glossary,
		content,
		ENGINEERING_PROOF_PATTERN,
		"software-engineering proof language",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.glossary,
		content,
		WORKFLOW_SKILL_PROOF_PATTERN,
		"workflow skill capture-the-flag proof language",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.glossary,
		content,
		/^\| Closeout Completion \|/m,
		"canonical Closeout Completion term",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.glossary,
		content,
		CLOSEOUT_COMPLETION_PATTERN,
		"closeout completion language",
	);
	return errors;
}

/**
 * Validates a dated solution markdown file for required steering-feedback contract sections and evidence.
 *
 * @param {string} content - The markdown file contents to validate.
 * @returns {string[]} An array of error messages describing missing required sections or patterns; empty if the document satisfies all checks.
 */
function validateSolution(content) {
	const errors = [];
	requirePattern(
		errors,
		REQUIRED_FILES.solution,
		content,
		/# Steering Feedback Admission/,
		"solution title",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.solution,
		content,
		/- \[Enforcement Surface\]\(#enforcement-surface\)/,
		"table-of-contents enforcement surface entry",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.solution,
		content,
		/^## Enforcement Surface$/m,
		"enforcement surface section",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.solution,
		content,
		/^## Review Condition$/m,
		"review condition section",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.solution,
		content,
		AGENT_ENGINEERING_LOOP_PATTERN,
		"agent engineering proof loop evidence",
	);
	for (const pattern of LOOP_MOVE_PATTERNS) {
		requirePattern(
			errors,
			REQUIRED_FILES.solution,
			content,
			pattern,
			`loop move ${pattern}`,
		);
	}
	requirePattern(
		errors,
		REQUIRED_FILES.solution,
		content,
		EXPECTED_OUTCOME_PATTERN,
		"expected outcome evidence",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.solution,
		content,
		REPEAT_FEEDBACK_ADMISSION_PATTERN,
		"repeat-feedback admission evidence",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.solution,
		content,
		CURRENT_SESSION_ADMISSION_PATTERN,
		"current-session steering admission evidence",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.solution,
		content,
		PLANNING_ONLY_STOP_PATTERN,
		"planning-only stop evidence",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.solution,
		content,
		DURABLE_DESTINATION_PATTERN,
		"durable destination language",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.solution,
		content,
		TOOL_PROMOTION_THRESHOLD_PATTERN,
		"tool promotion threshold evidence",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.solution,
		content,
		/Standalone prose is not enough/i,
		"standalone prose rejection",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.solution,
		content,
		PATTERN_GENERALIZATION_PATTERN,
		"pattern-generalization evidence",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.solution,
		content,
		PATTERN_SCOPE_INVENTORY_PATTERN,
		"pattern scope inventory evidence",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.solution,
		content,
		PRINCIPLE_SIGNAL_PATTERN,
		"semantic principle signal trigger evidence",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.solution,
		content,
		/`?pr-template-gate`? rejects PR bodies/i,
		"pr-template-gate repeated-steering rejection evidence",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.solution,
		content,
		CIRCLECI_ENV_API_TRIAGE_PATTERN,
		"CircleCI env-backed API triage evidence",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.solution,
		content,
		SAFE_PR_BODY_FILE_HANDOFF_PATTERN,
		"safe PR body file handoff evidence",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.solution,
		content,
		/pr-template-gate rejects line-level or design-pattern correction admissions/i,
		"pr-template-gate pattern-scope rejection evidence",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.solution,
		content,
		OODA_HORIZON_PATTERN,
		"OODA horizon evidence",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.solution,
		content,
		REFLECTED_CONTEXT_PATTERN,
		"reflected-context evidence",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.solution,
		content,
		ENGINEERING_PROOF_PATTERN,
		"software-engineering proof evidence",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.solution,
		content,
		WORKFLOW_SKILL_PROOF_PATTERN,
		"workflow skill capture-the-flag proof evidence",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.solution,
		content,
		TOOL_PROMOTION_THRESHOLD_PATTERN,
		"tool/validator/skill promotion threshold evidence",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.solution,
		content,
		CLOSEOUT_COMPLETION_PATTERN,
		"closeout completion evidence",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.solution,
		content,
		META_BEHAVIOR_PROOF_PATTERN,
		"meta-behavior proof evidence",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.solution,
		content,
		REPEATED_ERROR_RESEARCH_PATTERN,
		"repeated-error research evidence",
	);
	return errors;
}

/**
 * Validate that a pull request template contains the required steering-feedback contract fields and evidence.
 *
 * Checks for presence and required evidence for expected outcome alignment, pattern scope inventory,
 * meta-behavior proof, repeated-error research, the closeout state field, and each required closeout-state
 * classification field.
 *
 * @param {string} content - The full text content of the pull request template file.
 * @returns {string[]} Array of error messages describing missing fields or evidence; empty if all checks pass.
 */
function validatePrTemplate(content) {
	const errors = [];
	requirePattern(
		errors,
		REQUIRED_FILES.prTemplate,
		content,
		/Expected outcome alignment:/,
		"expected outcome alignment field",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.prTemplate,
		content,
		EXPECTED_OUTCOME_PATTERN,
		"expected outcome alignment requirements",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.prTemplate,
		content,
		/Pattern scope inventory:/,
		"pattern scope inventory field",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.prTemplate,
		content,
		PATTERN_SCOPE_INVENTORY_PATTERN,
		"pattern scope inventory evidence requirements",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.prTemplate,
		content,
		/Meta-behavior proof:/,
		"meta-behavior proof field",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.prTemplate,
		content,
		META_BEHAVIOR_PROOF_PATTERN,
		"meta-behavior proof requirements",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.prTemplate,
		content,
		/Repeated-error research:/,
		"repeated-error research field",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.prTemplate,
		content,
		REPEATED_ERROR_RESEARCH_PATTERN,
		"repeated-error research requirements",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.prTemplate,
		content,
		/Closeout state:/,
		"closeout state field",
	);
	for (const [pattern, fieldName] of CLOSEOUT_STATE_FIELD_PATTERNS) {
		requirePattern(
			errors,
			REQUIRED_FILES.prTemplate,
			content,
			pattern,
			`closeout state evidence requirement: ${fieldName}`,
		);
	}
	return errors;
}

/**
 * Validate a PR-validator source file for required steering-feedback contract symbols, validator rules, and validation messages.
 * @param {string} content - Text content of the PR-validator source file to inspect.
 * @returns {string[]} An array of error messages for each missing required pattern; empty if all checks pass.
 */
function validatePrValidator(content) {
	const errors = [];
	requirePattern(
		errors,
		REQUIRED_FILES.prValidator,
		content,
		/STEERING_SIGNAL_PATTERN/,
		"steering signal detection",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.prValidator,
		content,
		/collectMetaBehaviorErrors/,
		"meta-behavior validator rule",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.prValidator,
		content,
		PATTERN_SCOPE_VALIDATOR_PATTERN,
		"pattern scope inventory validator rule",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.prValidator,
		content,
		/REPEATED_ERROR_RESEARCH_SIGNAL_PATTERN/,
		"repeated-error research signal detection",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.prValidator,
		content,
		/collectRepeatedErrorResearchErrors/,
		"repeated-error research validator rule",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.prValidator,
		content,
		/Repeated-error research must include Source, 3-5 numbered Candidate\/Fix\/Option entries, Chosen, and Implemented evidence/,
		"repeated-error research validation error",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.prValidator,
		content,
		/Meta-behavior proof must name a durable destination/,
		"meta-behavior durable destination error",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.prValidator,
		content,
		/Learning \/ reinforcement must name the promoted learning/,
		"learning reinforcement durable destination error",
	);
	return errors;
}

function readPrValidatorContractSource() {
	const validatorResult = readRequiredFile(
		"prValidator",
		REQUIRED_FILES.prValidator,
	);
	const evidenceResult = readRequiredFile(
		"prValidatorEvidence",
		REQUIRED_FILES.prValidatorEvidence,
	);
	return {
		content: [validatorResult.content, evidenceResult.content].join("\n"),
		errors: [...validatorResult.errors, ...evidenceResult.errors],
	};
}

/**
 * Validate the memory learnings document for presence of required steering-feedback learning signals.
 * @param {string} content - Contents of the memory learnings file to check.
 * @returns {string[]} Array of error messages for each missing learning signal; empty if all required patterns are present.
 */
function validateMemory(content) {
	const errors = [];
	requirePattern(
		errors,
		REQUIRED_FILES.memory,
		content,
		/current-session steering admission/i,
		"current-session steering admission learning",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.memory,
		content,
		/not permitted to proceed/i,
		"not permitted to proceed trigger learning",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.memory,
		content,
		PLANNING_ONLY_STOP_PATTERN,
		"planning-only stop learning",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.memory,
		content,
		/docs:steering:guard/i,
		"steering guard validation learning",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.memory,
		content,
		/repeated-error research/i,
		"repeated-error research learning",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.memory,
		content,
		/3-5 candidate fixes/i,
		"candidate fix inventory learning",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.memory,
		content,
		/similar misbehavior classes/i,
		"pattern-generalization similar-misbehavior learning",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.memory,
		content,
		PRINCIPLE_SIGNAL_PATTERN,
		"principle signal learning",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.memory,
		content,
		ENV_BACKED_VALIDATION_PATTERN,
		"env-backed validation recovery learning",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.memory,
		content,
		TOOL_PROMOTION_THRESHOLD_PATTERN,
		"tool/validator/skill promotion threshold learning",
	);
	return errors;
}

/**
 * Validate the current-session env-backed validation admission record.
 *
 * @param {string} content - The env-backed validation admission markdown.
 * @returns {string[]} Array of missing-contract errors; empty if all required patterns are present.
 */
function validateEnvSolution(content) {
	const errors = [];
	requirePattern(
		errors,
		REQUIRED_FILES.envSolution,
		content,
		/# Env-Backed Validation Admission/,
		"env-backed validation admission title",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.envSolution,
		content,
		CURRENT_SESSION_ADMISSION_PATTERN,
		"current-session admission evidence",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.envSolution,
		content,
		ENV_BACKED_VALIDATION_PATTERN,
		"env-backed validation recovery evidence",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.envSolution,
		content,
		DURABLE_DESTINATION_PATTERN,
		"durable destination evidence",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.envSolution,
		content,
		/forbidden recurrence behavior/i,
		"forbidden recurrence behavior",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.envSolution,
		content,
		/pnpm run docs:steering:guard/i,
		"focused validation command",
	);
	return errors;
}

function validateFullImplementationDownscopeContract() {
	const errors = [];
	const stateResult = readRequiredFile(
		"full implementation goal state",
		FULL_IMPLEMENTATION_DOWNSCOPE_STATE,
	);
	errors.push(...stateResult.errors);
	if (stateResult.errors.length > 0) {
		return errors;
	}

	const downscopeSignalPresent =
		/S001 only/i.test(stateResult.content) &&
		/smallest independently mergeable audit-backed slice/i.test(
			stateResult.content,
		);
	if (!downscopeSignalPresent) {
		return errors;
	}

	const auditResult = readRequiredFile(
		"full implementation downscope audit",
		FULL_IMPLEMENTATION_DOWNSCOPE_AUDIT,
	);
	errors.push(...auditResult.errors);
	if (auditResult.errors.length > 0) {
		return errors;
	}

	requirePattern(
		errors,
		FULL_IMPLEMENTATION_DOWNSCOPE_AUDIT,
		auditResult.content,
		/^## Scope Correction$/m,
		"scope correction section for full-implementation downscope",
	);
	requirePattern(
		errors,
		FULL_IMPLEMENTATION_DOWNSCOPE_AUDIT,
		auditResult.content,
		/unfinished full-implementation scope/i,
		"unfinished full-implementation scope classification",
	);
	requirePattern(
		errors,
		FULL_IMPLEMENTATION_DOWNSCOPE_AUDIT,
		auditResult.content,
		/prior execution downscoped full implementation to S001/i,
		"S001 full-implementation downscope gap row",
	);
	requirePattern(
		errors,
		FULL_IMPLEMENTATION_DOWNSCOPE_AUDIT,
		auditResult.content,
		/^## Full-Implementation Slices$/m,
		"full-implementation slice heading",
	);
	requirePattern(
		errors,
		FULL_IMPLEMENTATION_DOWNSCOPE_AUDIT,
		auditResult.content,
		/^## Implemented Status$/m,
		"implemented status section for full-feature closure",
	);

	if (/^## Recommended Next Slices$/m.test(auditResult.content)) {
		errors.push(
			`${FULL_IMPLEMENTATION_DOWNSCOPE_AUDIT}: replace advisory Recommended Next Slices heading with Full-Implementation Slices while the goal state records S001 downscope`,
		);
	}
	if (/^## Current Gap Register$/m.test(auditResult.content)) {
		errors.push(
			`${FULL_IMPLEMENTATION_DOWNSCOPE_AUDIT}: replace Current Gap Register with implemented evidence while the user requested full implementation`,
		);
	}
	if (/^### Pending Closeout Validation$/m.test(auditResult.content)) {
		errors.push(
			`${FULL_IMPLEMENTATION_DOWNSCOPE_AUDIT}: replace Pending Closeout Validation with concrete command outcomes before closeout`,
		);
	}

	return errors;
}

function latestJsonlRecord(content) {
	const lines = content
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
	if (lines.length === 0) {
		return "";
	}
	return lines[lines.length - 1];
}

function collectActiveEnvBackedValidationEvidenceErrors() {
	const errors = [];
	for (const path of ACTIVE_ENV_BACKED_VALIDATION_SURFACES) {
		const result = readRequiredFile(
			"active env-backed validation surface",
			path,
		);
		errors.push(...result.errors);
		if (
			result.errors.length === 0 &&
			STALE_ENV_BACKED_BLOCKER_PATTERN.test(result.content)
		) {
			errors.push(
				path +
					": current evidence must not classify ~/.codex/.env FIFO metadata as missing or unavailable credentials; record the env-loaded rerun outcome instead",
			);
		}
	}

	const receiptResult = readRequiredFile(
		"active env-backed validation latest receipt",
		ACTIVE_ENV_BACKED_RECEIPTS,
	);
	errors.push(...receiptResult.errors);
	if (receiptResult.errors.length === 0) {
		const latestReceipt = latestJsonlRecord(receiptResult.content);
		if (STALE_ENV_BACKED_BLOCKER_PATTERN.test(latestReceipt)) {
			errors.push(
				ACTIVE_ENV_BACKED_RECEIPTS +
					": latest receipt must not revive the stale missing-credential/FIFO blocker classification; record env-loaded rerun status",
			);
		}
	}

	return errors;
}

const validations = [
	["agents", validateAgents],
	["validation", validateValidationDoc],
	["agentGovernance", validateAgentGovernance],
	["glossary", validateGlossary],
	["memory", validateMemory],
	["prTemplate", validatePrTemplate],
	["prValidator", validatePrValidator],
	["solution", validateSolution],
	["envSolution", validateEnvSolution],
];

const errors = [];
for (const [label, validate] of validations) {
	const path = REQUIRED_FILES[label];
	const result =
		label === "prValidator"
			? readPrValidatorContractSource()
			: readRequiredFile(label, path);
	errors.push(...result.errors);
	if (result.errors.length === 0) {
		errors.push(...validate(result.content));
	}
}
errors.push(...validateAdmissionRecords());
errors.push(...validateFullImplementationDownscopeContract());
errors.push(...collectActiveEnvBackedValidationEvidenceErrors());

if (errors.length > 0) {
	console.error("steering-feedback-contract: failed");
	for (const error of errors) {
		console.error(`- ${error}`);
	}
	process.exit(1);
}

console.log("steering-feedback-contract: pass");
