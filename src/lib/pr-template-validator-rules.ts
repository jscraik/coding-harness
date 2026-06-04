export const REQUIRED_SECTIONS = [
	"## Summary",
	"## Behavior Proof",
	"## Work performed",
	"## Checklist",
	"## Testing",
	"## Review artifacts",
	"## Notes",
] as const;

export const MAX_BODY_LENGTH = 100_000; // 100KB limit to prevent ReDoS

export const PLACEHOLDERS = [
	"pass/fail",
	"<link / artifact path / comment ID>",
	"<reviewer + link>",
	"Add one-paragraph merge rationale here.",
] as const;

export const STEERING_SIGNAL_PATTERN =
	/(admitted repeated steering|repeated steering (showed|exposed|drove|required|was)|same steering twice|same feedback twice|same correction across sessions|same feedback again|user had to restate correction|never give the same feedback twice|not permitted to proceed|current-session steering admission|stop-the-line|high-signal (user )?(steering|feedback|correction)|every bit of steering|failing to operate effectively|steering feedback (showed|exposed|drove|required|was|into))/i;
export const REPEATED_ERROR_RESEARCH_SIGNAL_PATTERN =
	/(same error (happened|occurred)?\s*twice|same failure twice|same command failed twice|failed again with the same (error|failure|command|stack trace|exception)|same (stack trace|exception) (appeared|happened|occurred|recurred|repeated).*twice|same error repeated|don\u2019t fight (?:the )?(same )?error|don't fight (?:the )?(same )?error)/i;
export const PATTERN_SCOPE_SIGNAL_PATTERN =
	/(line-level correction|line-level design feedback|example-based feedback|concrete correction|single line|single function|single class|just fix that line|do not just fix that line|not just that line|similar classes of misbehavior|similar misbehavior|class of misbehavior|same pattern|same things in multiple places|larger perspective|larger-system judgment|broader perspective|apply this everywhere relevant|sibling implementations|sibling pattern|broader design principle|design model|API design generally|across everything we do|named sentinel error|success and failure as a bool|success\/failure boolean|boolean result)/i;
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

export const REQUIRED_TESTING_FIELDS = [
	{
		label: "verification_commands",
		placeholder: "list exact commands run here",
	},
	{
		label: "verification_outcomes",
		placeholder: "record pass/fail/blocked for each command here",
	},
	{
		label: "blocked_steps_reason",
		placeholder: "none if all planned steps ran",
	},
] as const;

export const REQUIRED_BEHAVIOR_PROOF_FIELDS = [
	{
		label: "Behavior or issue addressed",
		placeholder: "describe the observable behavior, issue, or n.a. reason",
	},
	{
		label: "Real environment tested",
		placeholder: "list the real environment, production path, or n.a. reason",
	},
	{
		label: "Exact steps or command run after this patch",
		placeholder: "list exact steps, command, or n.a. reason",
	},
	{
		label: "Evidence after fix",
		placeholder:
			"link artifact, copied output, screenshot, redacted log, runtime-card ref, or n.a. reason",
	},
	{
		label: "Observed result after fix",
		placeholder: "state the observed result, or n.a. reason",
	},
	{
		label: "What was not tested",
		placeholder: "list untested paths, or `none` with reason",
	},
	{
		label: "Proof limitations or environment constraints",
		placeholder: "state limitations, blockers, or `none`",
	},
	{
		label: "Before evidence, if available",
		placeholder:
			"link before evidence, summarize baseline, or `n.a.` with reason",
	},
] as const;

export const REQUIRED_WORK_FIELDS = [
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
		label: "Phase / slice",
		placeholder:
			"list completed phase, implementation slice, or `n.a.` with reason",
	},
	{
		label: "Session IDs",
		placeholder:
			"list Codex thread/session IDs, session-collector artifact IDs or paths, harness run IDs, or `n.a.` with reason. For AI-assisted work, include at least one session reference or explain why no session artifact was captured.",
	},
	{
		label: "Trace IDs",
		placeholder:
			"list CI workflow/job URLs, harness/eval/runtime trace IDs, runtime-card/evidence bundle artifact paths, review trace IDs, or `n.a.` with reason. For traced or evaluated work, include the trace or artifact reference used to verify the claim.",
	},
	{
		label: "AI session / traceability",
		placeholder:
			"map the AI session or trace reference to the work it supports; do not paste raw transcripts, prompts, secrets, or bulky telemetry into the PR body.",
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
		label: "Documentation lifecycle impact",
		placeholder:
			"classify created, updated, deprecated, superseded, archived, removed, or `n.a.` with reason; include canon class and distribution impact when docs changed",
	},
	{
		label: "SemVer impact",
		placeholder:
			"classify none, patch, minor, major, or `n.a.` with reason; explain downstream-template or packaged-skill impact when present",
	},
	{
		label: "Expected outcome alignment",
		placeholder:
			"state how this change preserves Coding Harness as a portable agent operating system for greenfield and brownfield repos, or mark `n.a.` with reason",
	},
	{
		label: "Pattern scope inventory",
		placeholder:
			"for any steering feedback, review comment, or line-level correction that implies a broader design/API principle, name the principle, list sibling implementations or similar misbehavior classes searched, and state which siblings were changed, intentionally left unchanged, or deferred with tracker/evidence",
	},
	{
		label: "Meta-behavior proof",
		placeholder:
			"for repeated steering or high-signal corrections, name the durable repo/system change plus concrete repo path, command, or issue ID that prevents recurrence, or `n.a.` with tracked exception reason",
	},
	{
		label: "Repeated-error research",
		placeholder:
			"when the same error occurs twice, use `Source: ...; Candidate 1: ...; Candidate 2: ...; Candidate 3: ...; Chosen: ...; Implemented: ...`; otherwise `n.a.` with reason",
	},
	{
		label: "Acceptance trace",
		placeholder:
			"map completed acceptance items to evidence refs, or `n.a.` with reason",
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
		label: "Durable evidence map",
		placeholder:
			"classify every local-only artifact reference as tracked receipt, PR comment, CI artifact URL, runtime-card/evidence-bundle ref, or `n.a.` with reason; use repo-relative paths only",
	},
	{
		label: "Runtime impact",
		placeholder:
			"state direct, transitive, dev-only, CI-only, runtime-facing, or `n.a.` with reason",
	},
	{
		label: "CodeRabbit mode coverage",
		placeholder:
			"list analysis, validation, gate, closeout, promotion, or `n.a.` with reason",
	},
	{
		label: "Closeout state",
		placeholder:
			"classify PR state, merge or auto-merge state, branch/worktree state, Linear state, next-lane routing, and any remaining blocker or waiting owner",
	},
	{
		label: "Learning / reinforcement",
		placeholder:
			"list promoted learnings, memory updates, or `none` with reason",
	},
	{
		label: "Deferred work",
		placeholder: "list follow-up work intentionally left out, or `none`",
	},
] as const;
