export const REQUIRED_SECTIONS = [
	"## Summary",
	"## Release boundary",
	"## Behavior proof",
	"## Change details",
	"## Checklist",
	"## Validation",
	"## Review and closeout",
] as const;

export const MAX_BODY_LENGTH = 100_000; // 100KB limit to prevent ReDoS

export const PLACEHOLDERS = [
	"pass/fail",
	"<link / artifact path / comment ID>",
	"<reviewer + link>",
	"Add one-paragraph merge rationale here.",
] as const;

export const STEERING_SIGNAL_PATTERN =
	/(admitted repeated steering|repeated steering (showed|exposed|drove|required|was)|same correction across sessions|user had to restate correction|never give the same feedback twice|same feedback(?:\s+\w+){0,4}\s+twice[\s\S]{0,120}across independent (tasks|work)|across independent (tasks|work)[\s\S]{0,120}same feedback(?:\s+\w+){0,4}\s+twice|feedback recurs across independent (tasks|work)|not permitted to proceed|current-session steering admission|stop-the-line|high-signal (user )?(steering|feedback|correction)|every bit of steering|failing to operate effectively|steering feedback (showed|exposed|drove|required|was|into))/i;
const REPEATED_ERROR_OCCURRENCE_SOURCE =
	"(?:same error (?:happened|occurred)?\\s*twice|same failure twice|same command failed twice|failed again with the same (?:error|failure|command|stack trace|exception)|same (?:stack trace|exception) (?:appeared|happened|occurred|recurred|repeated).*twice|same error repeated|don\\u2019t fight (?:the )?(same )?error|don't fight (?:the )?(same )?error)";
const REPEATED_ERROR_THRESHOLD_SOURCE =
	"(?:across independent (?:tasks|work)|(?:current|existing) contract (?:is contradictory|conflicts with|contradicts)|contract is contradictory|contradictory contract|(?:crossed|requires|implicates|implicated|violates) (?:a )?safety boundary|safety boundary is (?:crossed|required|implicated|violated))";
export const REPEATED_ERROR_RESEARCH_SIGNAL_PATTERN = new RegExp(
	`(?:${REPEATED_ERROR_OCCURRENCE_SOURCE}[\\s\\S]{0,240}${REPEATED_ERROR_THRESHOLD_SOURCE}|${REPEATED_ERROR_THRESHOLD_SOURCE}[\\s\\S]{0,240}${REPEATED_ERROR_OCCURRENCE_SOURCE}|${REPEATED_ERROR_THRESHOLD_SOURCE}|(?:failure|error|command|test) recurs? across independent (?:tasks|work)|recurrence across independent (?:tasks|work))`,
	"i",
);
export const PATTERN_SCOPE_SIGNAL_PATTERN =
	/(?:(?:line[- ]level correction)[\s\S]{0,500}(?:(?:current|existing) contract (?:is contradictory|conflicts with|contradicts)|(?:crossed|requires|implicates|implicated|violates) (?:a )?safety boundary|safety boundary is (?:crossed|required|implicated|violated)|recurrence across independent (?:tasks|work)|failure recurs across independent (?:tasks|work)|named current consumer)|(?:pattern-generalization|shared pattern|sibling implementations|sibling pattern|shared abstraction)[\s\S]{0,500}(?:threshold|principle|search|inventory|changed|unchanged|local|systemic|generaliz|contradictory|(?:crossed|requires|implicates|implicated|violates) (?:a )?safety boundary|safety boundary is (?:crossed|required|implicated|violated)|recurrence across independent (?:tasks|work)|failure recurs across independent (?:tasks|work)|named current consumer)|(?:threshold|contradictory (?:current |shared )?contract|(?:current|existing) contract (?:is contradictory|conflicts with|contradicts)|recurrence across independent (?:tasks|work)|failure recurs across independent (?:tasks|work)|(?:crossed|requires|implicates|implicated|violates) (?:a )?safety boundary|safety boundary is (?:crossed|required|implicated|violated)|named current consumer)[\s\S]{0,500}(?:pattern|sibling|shared abstraction|design|consumer|line[- ]level correction))/i;
const NO_SYSTEM_CHANGE_VALUE_PATTERN = String.raw`(?=\S)(?!(?:[-–—]|(?:n\.\s*a\.?|n/a|none|not applicable)\b)\s*(?:;|$))[^;\n]+`;
export const NO_SYSTEM_CHANGE_EVIDENCE_PATTERN = new RegExp(
	String.raw`(?=.*\breason\s*:\s*${NO_SYSTEM_CHANGE_VALUE_PATTERN})` +
		String.raw`(?=.*\bchecked scope\s*:\s*${NO_SYSTEM_CHANGE_VALUE_PATTERN})` +
		String.raw`(?=.*\bno-durable-destination decision\s*:\s*${NO_SYSTEM_CHANGE_VALUE_PATTERN})`,
	"i",
);
export const DURABLE_META_DESTINATION_PATTERN =
	/(gate|validator|schema|scaffold|template field|validation rule|Project Brain|Linear|tracked issue|memory update|solution record|codestyle|docs-gate|guard|explicit exception)/i;
export const CONCRETE_DURABLE_REFERENCE_PATTERN =
	/(\b[A-Z]+-\d+\b|(?:^|[\s`"'([<])(?:\.\/)?(?:AI|artifacts|codestyle|fixtures|scripts|src|test|tests|docs|\.harness|\.github)\/[\w./-]+|(?:^|[\s`"'([<])(?:\.\/)?(?:AGENTS\.md|README\.md|CONTRIBUTING\.md|UBIQUITOUS_LANGUAGE\.md|CODESTYLE\.md|harness\.contract\.json)|pnpm\s+[\w:-]+|bash\s+(?:\.\/)?scripts\/[\w./-]+)/i;
export const PATTERN_SCOPE_EVIDENCE_PATTERNS = [
	/(principle|design principle|API design|contract)/i,
	/(sibling|similar|related|pattern|inventory|searched|misbehavior class)/i,
	/\b(changed|updated|applied|propagated)\b/i,
	/(left unchanged|unchanged|deferred|not applicable|n\.a\.|tracked issue|exception).*(reason|because|tracked issue|exception|not applicable)|reason.*(left unchanged|unchanged|deferred|not applicable|n\.a\.|tracked issue|exception)/i,
] as const;
export const REPEATED_ERROR_RESEARCH_EVIDENCE_PATTERNS = [
	/(source|research|official docs|web research|upstream docs|research checked|source checked):\s*\S.{8,}/i,
	/(chosen|selected|most efficient)\s*(fix|option|candidate|way)?:\s*\S.{8,}/i,
	/(implemented|applied)\s*(fix|change|remediation|patch)?:\s*\S.{8,}/i,
] as const;
export const CANDIDATE_FIX_PATTERN =
	/(?:^|[;|]\s*|\s)(?:candidate|option|fix)\s*(?:#?\d+|\d+[).:]|\b(?:one|two|three|four|five)\b)\s*[:=-]\s*\S.{7,}?(?=\s+(?:candidate|option|fix)\s*(?:#?\d+|\d+[).:]|\b(?:one|two|three|four|five)\b)\s*[:=-]|\s+(?:chosen|selected|implemented|applied)\b|[;|]|$)/gi;
export const LINKED_ISSUE_REFERENCE_PATTERN = /\bJSC-\d+\b/i;
export const ACCEPTANCE_TRACE_ID_PATTERN =
	/\b(?:SA|AC|FR|NFR|IU|PU)-\d+(?:-\d+)?\b/i;
export const PREPARATORY_LINKED_ISSUE_TRACE_PATTERN =
	/\b(?:preparatory|enabling|supporting|governance)\b[\s\S]{0,160}\b(?:relationship|slice|work|change|guard|evidence|contract)\b|\bdoes not complete\b[\s\S]{0,120}\b(?:acceptance criteria|issue|JSC-\d+)\b/i;
export const PREPARATORY_NO_ACCEPTANCE_COMPLETION_PATTERN =
	/(?:completed\s+(?:JSC-\d+\s+)?(?:acceptance\s+)?(?:IDs|criteria|items)\s*:\s*(?:none|n\.a\.|n\/a)|no\s+(?:JSC-\d+\s+)?(?:SA|AC|acceptance)[\w\s-]{0,80}\s+(?:IDs?|criteria|items)\s+(?:completed|claimed))/i;

export const REQUIRED_VALIDATION_FIELDS = [
	{
		label: "Regression coverage",
		placeholder:
			"describe unit, integration, contract, operator, or n.a. regression coverage",
	},
	{
		label: "Untested or blocked paths",
		placeholder: "list untested or blocked paths, or none with reason",
	},
] as const;

export const REQUIRED_SUMMARY_FIELDS = [
	{
		label: "Problem",
		placeholder: "state the problem or need",
	},
	{
		label: "Change",
		placeholder: "summarize the change",
	},
	{
		label: "Why this approach",
		placeholder: "explain why this approach was selected",
	},
] as const;

export const REQUIRED_RELEASE_BOUNDARY_FIELDS = [
	{
		label: "Release mode",
		placeholder:
			"Prototype / Portfolio / Product / Harness / n.a. because reason",
	},
	{
		label: "Completion condition",
		placeholder:
			"state the bounded shipping condition for the selected release mode",
	},
	{
		label: "Deferred work",
		placeholder: "list intentionally deferred work, or none with reason",
	},
	{
		label: "Stronger-proof condition",
		placeholder:
			"name what would require a more serious release mode or additional proof",
	},
] as const;

export const REQUIRED_BEHAVIOR_PROOF_FIELDS = [
	{
		label: "Before",
		placeholder: "describe the previous behavior, baseline, or n.a. reason",
	},
	{
		label: "After",
		placeholder:
			"describe the observed behavior after the change, or n.a. reason",
	},
	{
		label: "Environment or operator path",
		placeholder: "list the real environment, production path, or n.a. reason",
	},
	{
		label: "Verification steps",
		placeholder: "list exact steps, command, or n.a. reason",
	},
	{
		label: "Evidence after fix",
		placeholder:
			"link artifact, copied output, screenshot, redacted log, runtime-card ref, or n.a. reason",
	},
	{
		label: "Untested paths and limitations",
		placeholder: "state untested paths, limitations, blockers, or none",
	},
] as const;

export const REQUIRED_CHANGE_FIELDS = [
	{
		label: "Plan IDs",
		placeholder:
			"list Linear keys, spec paths, plan paths, or `n.a.` with reason",
	},
	{
		label: "Linear reference",
		placeholder:
			"list `Refs JSC-N`, `Fixes JSC-N`, `Closes JSC-N`, or `n.a.` with reason",
	},
	{
		label: "Linked issue relationship",
		placeholder:
			"classify the linked issue relationship as implementation closure, preparatory/enabling work, standalone/untracked work, or `n.a.` with reason; for parent-goal references, state completed acceptance IDs or `none`",
	},
	{
		label: "Session IDs",
		placeholder:
			"list Codex, session-collector, or Harness Engineering session IDs, or `n.a.` with reason",
	},
	{
		label: "Trace IDs",
		placeholder:
			"list CI, harness, eval, review, or runtime trace IDs, or `n.a.` with reason",
	},
	{
		label: "AI session / traceability",
		placeholder:
			"link the AI session or give a durable traceability reference, or `n.a.` with reason",
	},
	{
		label: "Completed work",
		placeholder:
			"list implementation units, docs/config changes, or evidence-only work completed in this PR",
	},
	{
		label: "Affected surfaces",
		placeholder:
			"list code, tests, docs, PR template, CLI reference, workflow config, generated artifacts, examples, or `n.a.` with reason",
	},
	{
		label: "Documentation impact",
		placeholder:
			"classify required docs as updated or `n.a.` with reason, including README.md, SECURITY.md, CONTRIBUTING.md, AGENTS.md, ARCHITECTURE.md, governance docs, and existing deep-module READMEs; list docs-expert or reviewer evidence for high-impact documentation changes",
	},
	{
		label: "SemVer impact",
		placeholder:
			"classify none, patch, minor, major, or `n.a.` with reason; explain downstream-template or packaged-skill impact when present",
	},
	{
		label: "Acceptance trace",
		placeholder:
			"map completed acceptance items to evidence refs, or `n.a.` with reason",
	},
	{
		label: "Runtime impact",
		placeholder:
			"state direct, transitive, dev-only, CI-only, runtime-facing, or `n.a.` with reason",
	},
	{
		label: "Closeout state",
		placeholder:
			"state PR state, merge or auto-merge state, branch/worktree state, Linear state, next-lane routing, and remaining blockers",
	},
] as const;

export const REQUIRED_REVIEW_FIELDS = [
	{
		label: "CodeRabbit",
		placeholder: "link the CodeRabbit review artifact or state a policy waiver",
	},
	{
		label: "Independent reviewer evidence",
		placeholder: "link independent review evidence or state a policy waiver",
	},
	{
		label: "Codex",
		placeholder: "link the Codex review artifact or state a policy waiver",
	},
] as const;

export const CONDITIONAL_EVIDENCE_FIELDS = [
	{
		label: "Expected outcome alignment",
		placeholder:
			"explain how the change advances the expected outcome, or `n.a.` with reason",
	},
	{
		label: "Validation evidence",
		placeholder:
			"list command outcomes, CI jobs, repo-relative artifact paths, or `n.a.` with reason; do not paste local absolute paths",
	},
	{
		label: "Review artifacts",
		placeholder:
			"list CodeRabbit, Codex, reviewer, or harness review artifacts, or `n.a.` with reason",
	},
	{
		label: "Pattern scope inventory",
		placeholder:
			"when the shared threshold or a named current consumer requires a pattern pass, name the principle, list sibling implementations or similar misbehavior classes searched, and state which siblings were changed, intentionally left unchanged, or deferred with tracker/evidence; otherwise `n.a.` with reason, checked scope, and no-durable-destination decision",
	},
	{
		label: "Meta-behavior proof",
		placeholder:
			"for repeated steering or high-signal corrections, name the durable repo/system change plus concrete repo path, command, or issue ID that prevents recurrence, or `n.a.` with tracked exception reason",
	},
	{
		label: "Repeated-error research",
		placeholder:
			"when recurrence across independent work, a contradictory contract, or a safety boundary triggers research, use `Source: ...; Candidate 1: ...; Candidate 2: ...; Candidate 3: ...; Chosen: ...; Implemented: ...`; otherwise `n.a.` with reason",
	},
	{
		label: "Durable evidence map",
		placeholder:
			"for evidence-heavy PRs, index each artifact in the compact table with a durable reference, schema/version, producer command, digest, replay command, and authority (`source-of-truth` or `retained context`); use `n.a.` with reason when no evidence map is needed; use repo-relative paths only",
	},
	{
		label: "Learning / reinforcement",
		placeholder:
			"list promoted learnings, memory updates, or `none` with reason",
	},
] as const;
