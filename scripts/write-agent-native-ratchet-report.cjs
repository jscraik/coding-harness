#!/usr/bin/env node
"use strict";

const { execFileSync, spawnSync } = require("node:child_process");
const { existsSync, readdirSync, readFileSync, statSync } = require("node:fs");
const { isAbsolute, join, relative, resolve } = require("node:path");

const SCHEMA_VERSION = "agent-native-ratchets/v1";
const SESSION_DISTILL_SCHEMA_VERSION = "session-distill/v1";
const AGENT_REWORK_SCHEMA_VERSION = "agent-rework/v1";
const REVIEWER_DECISION_SCHEMA_VERSION = "reviewer-decision/v1";
const GOVERNANCE_DECISION_SCHEMA_VERSION = "governance-decision-surface/v1";

const repoRoot = process.cwd();

const ratchetDefinitions = [
	{
		id: "orientation_packet",
		purpose:
			"Give cold agents a compact route from changed files to policy modules and gates.",
		command: "pnpm run coding-policy:route -- <path...>",
		packageScripts: ["coding-policy:route", "coding-policy:route:changed"],
		evidencePaths: [
			"coding-policy.json",
			"contracts/coding-policy.schema.json",
			"scripts/validate-coding-policy.cjs",
		],
		claimBoundary:
			"Orientation only; gate execution, CI state, review state, and merge readiness remain separate lanes.",
		nextMove:
			"Use this route before loading broad codestyle or governance context.",
	},
	{
		id: "session_distillation",
		purpose:
			"Turn a run into a compact resumed-agent handoff instead of a transcript dump.",
		command: "pnpm run session:distill",
		packageScripts: ["session:distill"],
		evidencePaths: [
			"scripts/write-agent-native-ratchet-report.cjs",
			"src/commands/runtime-card.ts",
			"AGENTS.md",
		],
		claimBoundary:
			"Distillation summarizes local orientation and does not prove CI, review, tracker, or merge readiness.",
		nextMove:
			"Attach session-distill/v1 to PR closeout and resumed-agent handoff flows.",
	},
	{
		id: "agent_rework_loop",
		purpose:
			"Expose retry, stop, ownership, and next-action state as data instead of repeating human steering.",
		command: "pnpm run agent-rework:report",
		packageScripts: ["agent-rework:report"],
		evidencePaths: [
			"scripts/verify-work.sh",
			"scripts/write-agent-native-ratchet-report.cjs",
		],
		claimBoundary:
			"Rework evidence explains local recovery state and does not make delivery or merge claims.",
		nextMove:
			"Promote repeated recovery patterns into validators, tests, or tracked exceptions.",
	},
	{
		id: "reviewer_decision_contract",
		purpose:
			"Make reviewer outcomes explicit enough for coordinators to route accept, object, defer, and blocked states.",
		command: "pnpm run reviewer:decision",
		packageScripts: ["reviewer:decision"],
		evidencePaths: [
			"scripts/validate-reviewer-coverage.cjs",
			"scripts/write-agent-native-ratchet-report.cjs",
		],
		claimBoundary:
			"Reviewer decisions are review evidence only; PR closeout still owns merge-readiness synthesis.",
		nextMove:
			"Require typed reviewer outcomes before treating review coverage as satisfied.",
	},
	{
		id: "governance_decision_surface",
		purpose:
			"Classify governance docs by whether they feed runtime decisions, operator policy, history, or archive candidates.",
		command: "pnpm run governance:decision-surface",
		packageScripts: ["governance:decision-surface"],
		evidencePaths: [
			"docs/doc-lifecycle-manifest.json",
			"scripts/write-agent-native-ratchet-report.cjs",
		],
		claimBoundary:
			"Governance classification is routing metadata; it cannot override source docs or validation results.",
		nextMove:
			"Use this surface to prune governance that does not feed a decision or durable policy.",
	},
];

function parseArgs(argv) {
	const options = {
		mode: "ratchets",
		json: false,
		manifest: null,
		reviewsDir: "artifacts/reviews",
		validate: false,
	};
	const errors = [];
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--") {
			continue;
		}
		if (arg === "--json") {
			options.json = true;
			continue;
		}
		if (arg === "--validate") {
			options.validate = true;
			continue;
		}
		if (arg === "--session-distill") {
			options.mode = "session-distill";
			continue;
		}
		if (arg === "--rework") {
			options.mode = "rework";
			continue;
		}
		if (arg === "--reviewer-decision") {
			options.mode = "reviewer-decision";
			continue;
		}
		if (arg === "--manifest") {
			index += 1;
			if (typeof argv[index] === "string" && !argv[index].startsWith("--")) {
				options.manifest = argv[index];
			} else {
				errors.push("missing manifest value");
				index -= 1;
			}
			continue;
		}
		if (arg === "--reviews-dir") {
			index += 1;
			if (typeof argv[index] === "string" && !argv[index].startsWith("--")) {
				options.reviewsDir = argv[index];
			} else {
				errors.push("missing reviews-dir value");
				index -= 1;
			}
			continue;
		}
		if (arg === "--governance") {
			options.mode = "governance";
			continue;
		}
		errors.push("unknown argument");
	}
	return { options, errors };
}

function packageScripts() {
	const parsed = JSON.parse(readFileSync(repoPath("package.json"), "utf8"));
	return parsed.scripts && typeof parsed.scripts === "object"
		? parsed.scripts
		: {};
}

function validateContainedPath(basePath, ...segments) {
	const base = path.resolve(basePath);
	const target = resolve(base, ...segments);
	const relativeTarget = relative(base, target);
	if (
		relativeTarget === "" ||
		(!relativeTarget.startsWith("..") && !isAbsolute(relativeTarget))
	) {
		return target;
	}
	throw new Error("Invalid path");
}

function repoPath(...segments) {
	return validateContainedPath(repoRoot, join(...segments));
}

function childPath(basePath, ...segments) {
	return validateContainedPath(basePath, join(...segments));
}

function repoContainedPath(targetPath) {
	return validateContainedPath(repoRoot, targetPath);
}

function pathExists(relativePath) {
	try {
		const target = resolve(repoRoot, relativePath);
		const relativeTarget = relative(repoRoot, target);
		if (relativeTarget.startsWith("..") || isAbsolute(relativeTarget)) {
			return false;
		}
		return existsSync(target);
	} catch {
		return false;
	}
}

function buildRatchetReport() {
	const scripts = packageScripts();
	const ratchets = ratchetDefinitions.map((ratchet) => {
		const missingScripts = ratchet.packageScripts.filter(
			(scriptName) => typeof scripts[scriptName] !== "string",
		);
		const missingEvidence = ratchet.evidencePaths.filter(
			(evidencePath) => !pathExists(evidencePath),
		);
		const status =
			missingScripts.length === 0 && missingEvidence.length === 0
				? "pass"
				: "needs_attention";
		return {
			id: ratchet.id,
			status,
			purpose: ratchet.purpose,
			command: ratchet.command,
			evidencePaths: ratchet.evidencePaths,
			claimBoundary: ratchet.claimBoundary,
			nextMove:
				status === "pass"
					? ratchet.nextMove
					: [
							...missingScripts.map((script) => `add package script ${script}`),
							...missingEvidence.map((path) => `restore evidence path ${path}`),
						].join("; "),
		};
	});
	return {
		schemaVersion: SCHEMA_VERSION,
		status: ratchets.every((ratchet) => ratchet.status === "pass")
			? "pass"
			: "needs_attention",
		ratchets,
	};
}

function gitOutput(args) {
	try {
		return execFileSync("git", args, {
			cwd: repoRoot,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
	} catch {
		return "";
	}
}

function gitLines(args) {
	const output = gitOutput(args);
	return output.length === 0 ? [] : output.split(/\r?\n/u).filter(Boolean);
}

function changedFiles() {
	return [
		...new Set([
			...gitLines(["diff", "--name-only", "--diff-filter=ACDMRTUXB"]),
			...gitLines([
				"diff",
				"--cached",
				"--name-only",
				"--diff-filter=ACDMRTUXB",
			]),
			...gitLines(["ls-files", "--others", "--exclude-standard"]),
		]),
	].sort();
}

function worktreeStatus() {
	const porcelain = gitLines(["status", "--short"]);
	if (porcelain.length === 0) return "clean";
	return "dirty";
}

function currentBranch() {
	return gitOutput(["branch", "--show-current"]) || "detached";
}

function sessionEvidenceLanes(files) {
	return [
		{
			id: "worktree",
			status: worktreeStatus(),
			evidenceRefs: ["git status --short", "git diff --name-only"],
		},
		{
			id: "policy_route",
			status: files.length > 0 ? "available" : "needs_changed_files",
			evidenceRefs: ["coding-policy.json", "pnpm run coding-policy:route"],
		},
		{
			id: "context_freshness",
			status: "refresh_recommended",
			evidenceRefs: [
				"pnpm run prompt-context-drift:write",
				"pnpm run prompt-context-drift:validate",
			],
		},
		{
			id: "validation",
			status: "not_run_by_distillation",
			evidenceRefs: ["pnpm run agent-native:ratchets"],
		},
		{
			id: "external_readiness",
			status: "not_claimed",
			evidenceRefs: ["ci", "review", "tracker", "merge"],
		},
	];
}

function buildSessionDistillReport() {
	const files = changedFiles();
	return {
		schemaVersion: SESSION_DISTILL_SCHEMA_VERSION,
		status: "pass",
		branch: currentBranch(),
		headSha: gitOutput(["rev-parse", "--short", "HEAD"]) || "unknown",
		worktreeStatus: worktreeStatus(),
		changedFiles: files,
		changedFileCount: files.length,
		evidenceLanes: sessionEvidenceLanes(files),
		nextCommands: [
			files.length > 0
				? `pnpm run coding-policy:route -- ${files.map(shellQuote).join(" ")}`
				: "pnpm run coding-policy:route:changed",
			"pnpm run prompt-context-drift:write",
			"pnpm run prompt-context-drift:validate",
		],
		nonClaims: [
			"ci_passed",
			"review_resolved",
			"tracker_closed",
			"merge_ready",
			"validation_passed",
		],
		claimBoundary:
			"session-distill/v1 orients resumed agents; it is not validation, CI, review, tracker, or merge readiness proof.",
	};
}

function buildReworkReport() {
	const latestRun = latestVerifyWorkRun();
	const runPassed =
		latestRun.status === "available" &&
		(latestRun.overallStatus === "passed" ||
			latestRun.overallStatus === "pass");
	return {
		schemaVersion: AGENT_REWORK_SCHEMA_VERSION,
		status:
			latestRun.status === "unavailable"
				? "needs_evidence"
				: runPassed
					? "pass"
					: "needs_attention",
		attemptSource: "scripts/verify-work.sh attempt-ledger/v1 gate artifacts",
		command: "bash scripts/verify-work.sh --fast",
		latestRun,
		retryDecisions: ["retry", "stop", "fix_contract", "fix_infra"],
		claimBoundary:
			"agent-rework/v1 routes local recovery and cannot prove delivery readiness by itself.",
	};
}
}

function latestVerifyWorkRun() {
	const runsRoot = repoPath(".harness", "runs");
	if (!existsSync(runsRoot)) {
		return {
			status: "unavailable",
			reason: "no verify-work runs directory exists",
		};
	}
	const runs = safeRunDirectories(runsRoot);
	const latest = runs[0];
	if (!latest) {
		return {
			status: "unavailable",
			reason: "no verify-work run artifacts exist",
		};
	}
	const summary = readJsonUnder(latest.path, "summary.json");
	const gates = readGateLedgers(childPath(latest.path, "gates"));
	return {
		status: "available",
		runId: summary?.runId ?? latest.name,
		overallStatus: summary?.overallStatus ?? "unknown",
		failedGateId: summary?.failedGateId ?? null,
		freshVsResumed: summary?.freshVsResumed ?? "unknown",
		gateCount: gates.length,
		failedGates: gates
			.filter((gate) => gate.status !== "passed")
			.map((gate) => ({
				gateId: gate.gateId,
				status: gate.status,
				failureClass: gate.failureClass,
				nextAction: gate.nextAction,
			})),
	};
}

function safeRunDirectories(runsRoot) {
	try {
		const base = repoContainedPath(runsRoot);
		return readdirSync(base)
			.map((name) => {
				const safePath = childPath(base, name);
				return { name, path: safePath, stat: statSync(safePath) };
			})
			.filter((entry) => entry.stat.isDirectory())
			.sort((left, right) => right.stat.mtimeMs - left.stat.mtimeMs);
	} catch {
		return [];
	}
}

function readJsonUnder(basePath, ...segments) {
	try {
		const target = childPath(basePath, ...segments);
		return JSON.parse(readFileSync(target, "utf8"));
	} catch {
		return null;
	}
}

function readGateLedgers(gatesRoot) {
	try {
		const base = repoContainedPath(gatesRoot);
		return readdirSync(base)
			.filter((name) => name.endsWith(".json"))
			.flatMap((name) => {
				const gate = readJsonUnder(base, name);
				return gate && typeof gate === "object" ? [gate] : [];
			});
	} catch {
		return [];
	}
}

function shellQuote(value) {
	return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function buildReviewerDecisionReport(options) {
	const receipt = options.manifest
		? reviewerCoverageReceipt(options.manifest, options.reviewsDir)
		: null;
	const decision = reviewerDecision(receipt);
	return {
		schemaVersion: REVIEWER_DECISION_SCHEMA_VERSION,
		status: decision.status,
		command:
			"node scripts/validate-reviewer-coverage.cjs --manifest <manifest> --reviews-dir artifacts/reviews",
		decision: decision.outcome,
		outcomes: [
			"accept",
			"object",
			"needs_evidence",
			"defer",
			"blocked_external",
			"accepted_risk",
		],
		coverageReceipt: receipt
			? {
					schemaVersion: receipt.schemaVersion,
					status: receipt.status,
					blockerClass: receipt.blockerClass,
					reason: receipt.reason,
					requestedRoles: receipt.requestedRoles?.length ?? 0,
					completedRoles: receipt.completedRoles?.length ?? 0,
					blockedRoles: receipt.blockedRoles?.length ?? 0,
					missingArtifacts: receipt.missingArtifacts?.length ?? 0,
					synthesisStatus: receipt.synthesisStatus,
					evidenceRefs: receipt.evidenceRefs ?? [],
				}
			: null,
		nextMove: decision.nextMove,
		claimBoundary:
			"reviewer-decision/v1 is review-lane evidence and must be composed by PR closeout before merge claims.",
	};
}

function reviewerCoverageReceipt(manifest, reviewsDir) {
	const result = spawnSync(
		process.execPath,
		[
			"scripts/validate-reviewer-coverage.cjs",
			"--manifest",
			manifest,
			"--reviews-dir",
			reviewsDir,
		],
		{
			cwd: repoRoot,
			encoding: "utf8",
		},
	);
	const stdout = result.stdout?.trim() ?? "";
	if (stdout.length > 0) {
		try {
			return JSON.parse(stdout);
		} catch {
			return {
				schemaVersion: "reviewer-coverage-receipt/v1",
				status: "blocked",
				blockerClass: "invalid_receipt",
				reason: "reviewer coverage output was not parseable JSON",
				evidenceRefs: [],
			};
		}
	}
	return {
		schemaVersion: "reviewer-coverage-receipt/v1",
		status: "blocked",
		blockerClass: "validator_runtime",
		reason:
			result.error instanceof Error
				? result.error.message
				: "reviewer coverage validator produced no receipt",
		evidenceRefs: [],
	};
}

function reviewerDecision(receipt) {
	if (!receipt) {
		return {
			status: "needs_evidence",
			outcome: "needs_evidence",
			nextMove:
				"Provide --manifest and --reviews-dir so reviewer coverage can be classified.",
		};
	}
	if (receipt.status === "pass") {
		return {
			status: "pass",
			outcome: "accept",
			nextMove:
				"Compose this review-lane acceptance with PR closeout before merge claims.",
		};
	}
	if (receipt.blockerClass === "blocked_reviewers") {
		return {
			status: "blocked",
			outcome: "blocked_external",
			nextMove:
				"Resolve blocked reviewer artifacts or reroute reviewer ownership.",
		};
	}
	if (receipt.blockerClass === "synthesis_incomplete") {
		return {
			status: "defer",
			outcome: "defer",
			nextMove: "Complete reviewer synthesis before treating coverage as done.",
		};
	}
	if (
		receipt.blockerClass === "invalid_manifest" ||
		receipt.blockerClass === "usage" ||
		receipt.blockerClass === "empty_manifest"
	) {
		return {
			status: "blocked",
			outcome: "object",
			nextMove: "Repair the reviewer manifest contract and rerun coverage.",
		};
	}
	return {
		status: "needs_evidence",
		outcome: "needs_evidence",
		nextMove:
			"Collect artifact-backed reviewer evidence; mailbox text alone is not proof.",
	};
}

function buildGovernanceDecisionReport() {
	const manifestPath = "docs/doc-lifecycle-manifest.json";
	const manifest = readJsonUnder(repoRoot, manifestPath);
	const documents = Array.isArray(manifest?.documents)
		? manifest.documents
		: [];
	const classified = documents.map(classifyGovernanceDocument);
	const classCounts = {
		feeds_runtime_decision: classified.filter((doc) =>
			doc.classes.includes("feeds_runtime_decision"),
		).length,
		operator_policy: classified.filter((doc) =>
			doc.classes.includes("operator_policy"),
		).length,
		historical_context: classified.filter((doc) =>
			doc.classes.includes("historical_context"),
		).length,
		archive_candidate: classified.filter((doc) =>
			doc.classes.includes("archive_candidate"),
		).length,
	};
	return {
		schemaVersion: GOVERNANCE_DECISION_SCHEMA_VERSION,
		status: documents.length > 0 ? "pass" : "needs_evidence",
		classes: [
			"feeds_runtime_decision",
			"operator_policy",
			"historical_context",
			"archive_candidate",
		],
		documentsAnalyzed: documents.length,
		classCounts,
		decisionInputs: classified
			.filter((doc) => doc.classes.includes("feeds_runtime_decision"))
			.slice(0, 12),
		archiveCandidates: classified
			.filter((doc) => doc.classes.includes("archive_candidate"))
			.slice(0, 12),
		evidencePaths: [manifestPath, "docs/agents/07b-agent-governance.md"],
		nextMove:
			classCounts.archive_candidate > 0
				? "Review archive candidates before pruning; do not delete source authority from class metadata alone."
				: "Use decisionInputs to route governance context before loading broad docs.",
		claimBoundary:
			"governance-decision-surface/v1 classifies docs for routing and pruning; source docs remain authoritative.",
	};
}

function classifyGovernanceDocument(document) {
	const path = typeof document.path === "string" ? document.path : "unknown";
	const lifecycleStage =
		typeof document.lifecycleStage === "string" ? document.lifecycleStage : "";
	const knowledgeCategory =
		typeof document.knowledgeCategory === "string"
			? document.knowledgeCategory
			: "";
	const docType = typeof document.docType === "string" ? document.docType : "";
	const lifecycleState =
		typeof document.lifecycleState === "string" ? document.lifecycleState : "";
	const canonicality =
		typeof document.canonicality === "string" ? document.canonicality : "";
	const classes = [];
	if (
		["execute", "contribute", "report-and-review"].includes(lifecycleStage) ||
		knowledgeCategory.includes("control-plane") ||
		knowledgeCategory.includes("workflow")
	) {
		classes.push("feeds_runtime_decision");
	}
	if (
		knowledgeCategory.includes("policy") ||
		knowledgeCategory.includes("governance") ||
		docType === "operator-instructions" ||
		docType === "security"
	) {
		classes.push("operator_policy");
	}
	if (canonicality !== "canon" || lifecycleState !== "active") {
		classes.push("archive_candidate");
	}
	if (classes.length === 0) {
		classes.push("historical_context");
	}
	return {
		path,
		classes,
		lifecycleStage,
		knowledgeCategory,
		lifecycleState,
	};
}

function selectedReport(options) {
	switch (options.mode) {
		case "ratchets":
			return buildRatchetReport();
		case "session-distill":
			return buildSessionDistillReport();
		case "rework":
			return buildReworkReport();
		case "reviewer-decision":
			return buildReviewerDecisionReport(options);
		case "governance":
			return buildGovernanceDecisionReport();
		default:
			throw new Error("unknown mode");
	}
}

function main() {
	const parsed = parseArgs(process.argv.slice(2));
	if (parsed.errors.length > 0) {
		process.stderr.write("agent-native-ratchets: failed\n");
		process.stderr.write("- invalid command line arguments\n");
		process.exit(2);
	}
	const report = selectedReport(parsed.options);
	const output = JSON.stringify(report, null, 2);
	if (parsed.options.json || parsed.options.mode !== "ratchets") {
		process.stdout.write(`${output}\n`);
	} else {
		process.stdout.write(
			"agent-native-ratchets: " +
				report.status +
				" (" +
				report.ratchets.length +
				" ratchets)\n",
		);
	}
	if (parsed.options.validate && report.status !== "pass") {
		process.exit(1);
	}
}

main();
