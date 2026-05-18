#!/usr/bin/env node

const { existsSync, readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const REPO_ROOT = resolve(__dirname, "..");

const REQUIRED_FILES = {
	agents: "AGENTS.md",
	validation: "docs/agents/04-validation.md",
	glossary: "UBIQUITOUS_LANGUAGE.md",
	memory: ".harness/memory/LEARNINGS.md",
	prTemplate: ".github/PULL_REQUEST_TEMPLATE.md",
	prValidator: "src/lib/pr-template-validator.ts",
	solution:
		"docs/solutions/integration-issues/2026-05-17-steering-feedback-admission.md",
};

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
const CURRENT_SESSION_ADMISSION_PATTERN =
	/(current-session steering admission record|not permitted to proceed|feedback class.*inferred principle.*searched surfaces.*durable destination|forbidden recurrence behavior)/i;
const REPEATED_ERROR_RESEARCH_PATTERN =
	/(Repeated-error research|Repeated-Error Research Pass|same-error-twice|same error happens twice|same error happened twice|same command.*test.*runtime error happens twice|Source:.*Candidate 1:.*Candidate 2:.*Candidate 3:.*Chosen:.*Implemented:|3-5 numbered Candidate\/Fix\/Option|don.t fight errors)/i;
const CLOSEOUT_COMPLETION_PATTERN =
	/(closeout completion|green checks.*not.*complete|green checks.*validation evidence|not equivalent to green checks|PR state.*merge.*Linear.*next-lane|heartbeat.*lane.*complete)/i;
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
		CLOSEOUT_COMPLETION_PATTERN,
		"closeout completion is not green checks rule",
	);
	return errors;
}

/**
 * Validate that the validation document includes required steering-feedback closeout headings, signals, and contract evidence.
 *
 * Checks for the steering feedback closeout section, agent engineering proof loop and loop moves, expected-outcome framing, admission and research signals (repeat-feedback, current-session admission, repeated-error research), durable destination and meta-behavior proof, validation-surface and review/deletion conditions, rejection of standalone prose, pattern-generalization and pattern-scope inventory requirements, principle-signal and OODA horizon classifications, reflected-context evidence, engineering and workflow-skill proofs, closeout completion expectations, required closeout state classification fields, and a GraphQL reviewThreads source-of-truth pattern.
 *
 * @param {string} content - The markdown content of the validation document to validate.
 * @returns {string[]} An array of error messages describing missing required headings or patterns; empty if all checks pass.
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
	for (const term of [
		"Repeat-Feedback Admission",
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
		DURABLE_DESTINATION_PATTERN,
		"durable destination language",
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
		/Meta-behavior proof/i,
		"meta-behavior proof evidence",
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
 * Validate a PR-validator source file for required steering-feedback contract symbols, validator rules, and specific validation messages.
 *
 * Checks the provided file content for required identifiers (e.g., steering signal detection, meta-behavior and repeated-error validator rules),
 * pattern-scope validator presence, semantic trigger coverage, and specific validation error/message strings.
 * @param {string} content - The text content of the PR-validator source file to validate.
 * @returns {string[]} An array of error messages describing each missing required pattern; empty if all checks pass.
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
		/(example-based feedback|concrete correction|single function|not just that line|across everything we do)/i,
		"semantic pattern-scope trigger coverage",
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
	return errors;
}

const validations = [
	["agents", validateAgents],
	["validation", validateValidationDoc],
	["glossary", validateGlossary],
	["memory", validateMemory],
	["prTemplate", validatePrTemplate],
	["prValidator", validatePrValidator],
	["solution", validateSolution],
];

const errors = [];
for (const [label, validate] of validations) {
	const path = REQUIRED_FILES[label];
	const result = readRequiredFile(label, path);
	errors.push(...result.errors);
	if (result.errors.length === 0) {
		errors.push(...validate(result.content));
	}
}

if (errors.length > 0) {
	console.error("steering-feedback-contract: failed");
	for (const error of errors) {
		console.error(`- ${error}`);
	}
	process.exit(1);
}

console.log("steering-feedback-contract: pass");
