#!/usr/bin/env node

const { existsSync, readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const REQUIRED_FILES = {
	agents: "AGENTS.md",
	validation: "docs/agents/04-validation.md",
	glossary: "UBIQUITOUS_LANGUAGE.md",
	prTemplate: ".github/PULL_REQUEST_TEMPLATE.md",
	solution:
		"docs/solutions/integration-issues/2026-05-17-steering-feedback-admission.md",
};

const DURABLE_DESTINATION_PATTERN =
	/(gate|validator|schema|scaffold|validation rule|project brain|linear|tracked issue|explicit exception)/i;
const EXPECTED_OUTCOME_PATTERN =
	/(expected outcome|portable agent operating system|software engineer|code generator|zero customer integration ceremony|greenfield and brownfield)/i;
const REPEAT_FEEDBACK_ADMISSION_PATTERN =
	/(repeat-feedback admission|repeated steering|same steering twice|same feedback twice|stop-the-line environment defect|ordinary feature work)/i;
const PATTERN_GENERALIZATION_PATTERN =
	/(pattern-generalization|pattern generalization|sibling implementations|shared abstraction|intentionally local|design principle)/i;
const PATTERN_SCOPE_INVENTORY_PATTERN =
	/(pattern scope inventory|siblings changed|siblings left unchanged|sibling implementations searched|deferred follow-ups|deferred followup)/i;
const OODA_HORIZON_PATTERN =
	/(ooda horizon|horizontal horizon|vertical horizon|single-turn|stacked trajectories|adjacent pr|adjacent organizational activity)/i;
const REFLECTED_CONTEXT_PATTERN =
	/(reflected context|resumed target context|session-collector|agent reflection|unobserved horizon|compaction|environment boundaries)/i;
const ENGINEERING_PROOF_PATTERN =
	/(software engineering proof|code production|benchmark-style|swe bench|program bench|terminal bench|maintainability|traceability|handoff quality)/i;
const WORKFLOW_SKILL_PROOF_PATTERN =
	/(workflow skill|capture-the-flag|capture the flag|win condition|flag is captured|skill workout|self-reflection|reflect on failures)/i;
const CLOSEOUT_COMPLETION_PATTERN =
	/(closeout completion|green checks.*not.*complete|green checks.*validation evidence|not equivalent to green checks|PR state.*merge.*Linear.*next-lane|heartbeat.*lane.*complete)/i;
const CLOSEOUT_STATE_FIELDS_PATTERN =
	/(PR state[\s\S]*merge[\s\S]*(branch\/worktree|branch and worktree)[\s\S]*Linear[\s\S]*next-lane|merge or auto-merge state[\s\S]*(branch\/worktree|branch and worktree) state[\s\S]*Linear state[\s\S]*next-lane routing)/i;
const AGENT_ENGINEERING_LOOP_PATTERN = /agent engineering proof loop/i;
const LOOP_MOVE_PATTERNS = [
	/observe/i,
	/orient/i,
	/decide/i,
	/act/i,
	/close out|closeout/i,
];

function readRequiredFile(label, path) {
	const absPath = resolve(path);
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
		/Durable destination/i,
		"durable destination evidence requirement",
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
	requirePattern(
		errors,
		REQUIRED_FILES.validation,
		content,
		CLOSEOUT_STATE_FIELDS_PATTERN,
		"closeout state classification fields",
	);
	return errors;
}

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
	return errors;
}

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
		/Closeout state:/,
		"closeout state field",
	);
	requirePattern(
		errors,
		REQUIRED_FILES.prTemplate,
		content,
		CLOSEOUT_STATE_FIELDS_PATTERN,
		"closeout state evidence requirements",
	);
	return errors;
}

const validations = [
	["agents", validateAgents],
	["validation", validateValidationDoc],
	["glossary", validateGlossary],
	["prTemplate", validatePrTemplate],
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
