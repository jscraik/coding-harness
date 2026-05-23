#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const DEFAULT_ROOT = path.resolve(__dirname, "..");
const SCHEMA_VERSION = "audit-reference-report/v1";
const ALLOWED_PREFIXES = [
	".github/",
	".circleci/",
	".harness/",
	"AI/",
	"codex/",
	"docs/",
	"fixtures/",
	"scripts/",
	"src/",
	"test/",
	"tests/",
];
const ALLOWED_FILES = new Set([
	"AGENTS.md",
	"CHANGELOG.md",
	"CODESTYLE.md",
	"CONTRIBUTING.md",
	"Makefile",
	"README.md",
	"UBIQUITOUS_LANGUAGE.md",
	"harness.contract.json",
	"package.json",
	"pnpm-lock.yaml",
	"tsconfig.json",
]);
const ALLOWED_FILE_PATTERN = [...ALLOWED_FILES].map(escapeRegExp).join("|");
const PATH_TOKEN_PATTERN_SOURCE = String.raw`(?:^|[\s(:])((?:\.\/|\.\.\/|\/|(?:[A-Za-z0-9_.-]+\/)|${ALLOWED_FILE_PATTERN})[^\s),;:\]]*)`;

function hasText(value) {
	return typeof value === "string" && value.trim().length > 0;
}

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function parseArgs(argv) {
	const options = {
		root: DEFAULT_ROOT,
		sourceArtifact: null,
		usageErrors: [],
	};
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--json") continue;
		if (arg === "--root") {
			index += 1;
			if (!hasText(argv[index])) {
				options.usageErrors.push({
					code: "usage_missing_value",
					message: "--root requires a path value",
				});
			} else {
				options.root = path.resolve(argv[index]);
			}
		} else if (arg.startsWith("--")) {
			options.usageErrors.push({
				code: "usage_unknown_option",
				message: `unknown option: ${arg}`,
			});
		} else if (options.sourceArtifact === null) {
			options.sourceArtifact = arg;
		} else {
			options.usageErrors.push({
				code: "usage_extra_argument",
				message: `unexpected positional argument: ${arg}`,
			});
		}
	}
	if (!hasText(options.sourceArtifact)) {
		options.usageErrors.push({
			code: "usage_missing_source",
			message: "source artifact path is required",
		});
	}
	return options;
}

function baseReport(options) {
	return {
		schemaVersion: SCHEMA_VERSION,
		status: "blocked",
		checkedAt: new Date().toISOString(),
		sourceArtifact: normalizeDisplayPath(options.sourceArtifact || ""),
		referencedArtifacts: [],
		missingRefs: [],
		ignoredOrUntrackedRefs: [],
		blockerClass: "not_checked",
		reason: "audit references were not checked",
	};
}

function normalizeDisplayPath(value) {
	return String(value || "").replaceAll("\\", "/");
}

function writeReport(report, exitCode) {
	process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
	process.exit(exitCode);
}

function git(repoRoot, args) {
	return spawnSync("git", args, {
		cwd: repoRoot,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "pipe"],
	});
}

function findGitRoot(root) {
	const result = git(root, ["rev-parse", "--show-toplevel"]);
	if (result.status !== 0 || !hasText(result.stdout)) {
		return null;
	}
	return path.resolve(result.stdout.trim());
}

function toRepoRelative(repoRoot, value) {
	const rawValue = String(value || "").trim();
	const resolved = path.isAbsolute(rawValue)
		? path.resolve(rawValue)
		: path.resolve(repoRoot, rawValue);
	const relative = path.relative(repoRoot, resolved).replaceAll("\\", "/");
	if (relative === "") {
		return { outsideRepo: false, path: "." };
	}
	if (relative.startsWith("../") || path.isAbsolute(relative)) {
		return { outsideRepo: true, path: normalizeDisplayPath(rawValue) };
	}
	return { outsideRepo: false, path: relative };
}

function isAllowedPath(repoRelativePath) {
	return (
		ALLOWED_FILES.has(repoRelativePath) ||
		ALLOWED_PREFIXES.some((prefix) => repoRelativePath.startsWith(prefix))
	);
}

function cleanCandidate(candidate) {
	let value = String(candidate || "").trim();
	value = value.replace(/^["'(<]+/, "");
	value = value.replace(/[)"'>,;:.]+$/u, "");
	value = value.replace(/#.*$/u, "");
	value = value.replace(/\?.*$/u, "");
	return normalizeDisplayPath(value.trim());
}

function hasFileExtension(value) {
	return /\.[A-Za-z0-9][A-Za-z0-9_-]*$/u.test(path.posix.basename(value));
}

function isProbablyPath(value) {
	if (!hasText(value)) return false;
	if (value === "/" || value === ".") return false;
	if (/^[a-z][a-z0-9+.-]*:/iu.test(value)) return false;
	if (value.startsWith("#")) return false;
	if (/\s/u.test(value)) return false;
	if (value.includes("*")) return false;
	if (value.includes("{") || value.includes("}")) return false;
	if (value.includes("$")) return false;
	if (
		value.startsWith("./") ||
		value.startsWith("../") ||
		value.startsWith("/")
	) {
		return hasFileExtension(value);
	}
	if (ALLOWED_FILES.has(value)) return true;
	if (ALLOWED_PREFIXES.some((prefix) => value.startsWith(prefix))) return true;
	return value.includes("/") && hasFileExtension(value);
}

function pushCandidate(set, value, options = {}) {
	let candidate = cleanCandidate(value);
	if (options.sourceRelative === true) {
		candidate = resolveSourceRelativeReference(
			options.sourceArtifactPath,
			candidate,
		);
	}
	if (!isProbablyPath(candidate)) {
		return;
	}
	const current = set.get(candidate);
	set.set(candidate, {
		explicit: Boolean(current?.explicit || options.explicit),
		path: candidate,
	});
}

function resolveSourceRelativeReference(sourceArtifactPath, candidate) {
	const target = cleanCandidate(candidate);
	if (target.startsWith("./") || target.startsWith("../")) {
		const sourceDirectory = path.posix.dirname(sourceArtifactPath);
		return path.posix.normalize(path.posix.join(sourceDirectory, target));
	}
	return target;
}

function resolveMarkdownLinkTarget(sourceArtifactPath, candidate) {
	return resolveSourceRelativeReference(sourceArtifactPath, candidate);
}

function matchPathTokens(value) {
	return String(value || "").matchAll(
		new RegExp(PATH_TOKEN_PATTERN_SOURCE, "gmu"),
	);
}

function extractReferences(markdown, sourceArtifactPath) {
	const candidates = new Map();
	const backtick = String.fromCharCode(96);
	const codeFence = new RegExp(
		backtick +
			backtick +
			backtick +
			"[\\s\\S]*?" +
			backtick +
			backtick +
			backtick,
		"gu",
	);
	const withoutFences = markdown.replace(codeFence, (block) => {
		for (const match of matchPathTokens(block)) {
			pushCandidate(candidates, match[1], { explicit: true });
		}
		return "\n";
	});
	const codeSpan = new RegExp(`${backtick}([^${backtick}]+)${backtick}`, "gu");
	for (const match of withoutFences.matchAll(codeSpan)) {
		pushCandidate(candidates, match[1], {
			explicit: true,
			sourceArtifactPath,
			sourceRelative: true,
		});
	}
	const withoutLinks = withoutFences.replace(
		/\[[^\]]*\]\(([^)]+)\)/gu,
		(_match, target) => {
			pushCandidate(
				candidates,
				resolveMarkdownLinkTarget(sourceArtifactPath, target),
				{ explicit: true },
			);
			return "\n";
		},
	);
	for (const match of matchPathTokens(withoutLinks)) {
		pushCandidate(candidates, match[1]);
	}
	return [...candidates.values()].sort((left, right) =>
		left.path.localeCompare(right.path),
	);
}

function isTracked(repoRoot, repoRelativePath) {
	const result = git(repoRoot, [
		"ls-files",
		"--error-unmatch",
		"--",
		repoRelativePath,
	]);
	return result.status === 0;
}

function isIgnored(repoRoot, repoRelativePath) {
	const result = git(repoRoot, ["check-ignore", "-q", "--", repoRelativePath]);
	return result.status === 0;
}

function classifyReferences(repoRoot, references, sourceArtifactPath) {
	const referencedArtifacts = [];
	const missingRefs = [];
	const ignoredOrUntrackedRefs = [];
	const blockedRefs = [];

	for (const reference of references) {
		const normalized = toRepoRelative(repoRoot, reference.path);
		if (!normalized.outsideRepo && normalized.path === sourceArtifactPath) {
			continue;
		}
		if (normalized.outsideRepo) {
			blockedRefs.push({
				path: reference.path,
				classification: "outside_repo",
				reason: "reference resolves outside the repository root",
			});
			continue;
		}
		if (!isAllowedPath(normalized.path)) {
			blockedRefs.push({
				path: normalized.path,
				classification: "outside_allowed_paths",
				reason:
					"reference is not inside an allowed artifact or source boundary",
			});
			continue;
		}

		const absolutePath = path.join(repoRoot, normalized.path);
		const exists = fs.existsSync(absolutePath);
		const isFile = exists && fs.statSync(absolutePath).isFile();
		if (exists && !isFile) {
			blockedRefs.push({
				path: normalized.path,
				classification: "not_file",
				reason: "reference exists but is not a file artifact",
			});
			continue;
		}
		const tracked = isFile && isTracked(repoRoot, normalized.path);
		const ignored = isFile && !tracked && isIgnored(repoRoot, normalized.path);
		if (
			!reference.explicit &&
			!exists &&
			!tracked &&
			!hasFileExtension(normalized.path)
		) {
			continue;
		}

		const artifact = {
			path: normalized.path,
			exists,
			tracked,
			ignored,
			classification: tracked
				? "tracked"
				: ignored
					? "ignored"
					: exists
						? "untracked"
						: "missing",
		};
		referencedArtifacts.push(artifact);

		if (!exists) {
			missingRefs.push(normalized.path);
		} else if (!tracked) {
			ignoredOrUntrackedRefs.push({
				path: normalized.path,
				classification: ignored ? "ignored" : "untracked",
				reason: ignored
					? "referenced artifact exists but is ignored by git"
					: "referenced artifact exists but is not tracked by git",
			});
		}
	}

	return {
		blockedRefs,
		ignoredOrUntrackedRefs: ignoredOrUntrackedRefs.sort((left, right) =>
			left.path.localeCompare(right.path),
		),
		missingRefs: missingRefs.sort(),
		referencedArtifacts: referencedArtifacts.sort((left, right) =>
			left.path.localeCompare(right.path),
		),
	};
}

function finalizeReport(report, classified) {
	report.referencedArtifacts = classified.referencedArtifacts;
	report.missingRefs = classified.missingRefs;
	report.ignoredOrUntrackedRefs = classified.ignoredOrUntrackedRefs;
	if (classified.blockedRefs.length > 0) {
		report.status = "blocked";
		report.blockerClass = "reference_outside_allowed_boundary";
		report.reason =
			"one or more references are outside the repository or allowed artifact boundaries";
		report.blockedRefs = classified.blockedRefs;
		return 1;
	}
	if (report.missingRefs.length > 0) {
		report.status = "missing";
		report.blockerClass = "missing_references";
		report.reason = "one or more referenced artifacts do not exist";
		return 1;
	}
	if (report.ignoredOrUntrackedRefs.length > 0) {
		report.status = "partial";
		report.blockerClass = "ignored_or_untracked_references";
		report.reason =
			"one or more referenced artifacts exist but are ignored or untracked";
		return 1;
	}
	report.status = "pass";
	report.blockerClass = null;
	report.reason =
		"all extracted audit references are allowed, loadable, and tracked";
	return 0;
}

function main() {
	const options = parseArgs(process.argv.slice(2));
	const report = baseReport(options);
	if (options.usageErrors.length > 0) {
		report.status = "usage";
		report.blockerClass = "usage";
		report.reason = "invalid arguments";
		report.usageErrors = options.usageErrors;
		writeReport(report, 2);
	}

	const requestedRoot = path.resolve(options.root);
	const gitRoot = findGitRoot(requestedRoot);
	if (gitRoot === null) {
		report.status = "blocked";
		report.blockerClass = "repo_root_unavailable";
		report.reason = "unable to resolve a git repository root";
		writeReport(report, 1);
	}

	const source = toRepoRelative(gitRoot, options.sourceArtifact);
	if (source.outsideRepo) {
		report.status = "blocked";
		report.blockerClass = "source_outside_repo";
		report.reason = "source artifact resolves outside the repository root";
		writeReport(report, 1);
	}
	report.sourceArtifact = source.path;
	if (!isAllowedPath(source.path)) {
		report.status = "blocked";
		report.blockerClass = "source_outside_allowed_boundary";
		report.reason =
			"source artifact is outside the allowed artifact boundaries";
		writeReport(report, 1);
	}

	const sourcePath = path.join(gitRoot, source.path);
	if (!fs.existsSync(sourcePath)) {
		report.status = "missing";
		report.blockerClass = "source_missing";
		report.reason = "source artifact does not exist";
		report.missingRefs = [source.path];
		writeReport(report, 1);
	}
	if (!fs.statSync(sourcePath).isFile()) {
		report.status = "blocked";
		report.blockerClass = "source_not_file";
		report.reason = "source artifact is not a file";
		writeReport(report, 1);
	}

	const references = extractReferences(
		fs.readFileSync(sourcePath, "utf8"),
		source.path,
	);
	const classified = classifyReferences(gitRoot, references, source.path);
	const exitCode = finalizeReport(report, classified);
	writeReport(report, exitCode);
}

main();
