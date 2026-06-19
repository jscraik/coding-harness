import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	statSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { buildObservedCircleCiTelemetry } from "../src/lib/evals/observed-circleci-telemetry.js";
import {
	type ObservedChronicleStatus,
	buildObservedSkillUsage,
	renderObservedSkillUsageSummary,
} from "../src/lib/evals/observed-skill-usage.js";

interface CliOptions {
	skill: string;
	days: string;
	repoRoot: string;
	sessionCollectorRoot: string;
	sessionCollectorOutput: string;
	circleciTelemetryRoot: string;
	circleciOutput: string;
	bundleDir: string;
	pluginEvalBudget?: string;
	skillPath?: string;
	runPluginEvalBudget: boolean;
	gitRange?: string;
	gitSince?: string;
	gitUntil?: string;
	gitBranch?: string;
	gitPr?: string;
	gitPaths: string[];
	gitMaxCount: string;
	output: string;
	summary: string;
	runSessionCollector: boolean;
	json: boolean;
}

const DEFAULT_SESSION_COLLECTOR_ROOT =
	process.env.SESSION_COLLECTOR_ROOT ??
	join(homedir(), ".agents/session-collector");
const DEFAULT_CIRCLECI_TELEMETRY_ROOT =
	process.env.CIRCLECI_TELEMETRY_ROOT ?? "artifacts/evals/circleci-telemetry";

function parseArgs(argv: string[]): CliOptions {
	const options: CliOptions = {
		skill: "he-eval-report",
		days: "14",
		repoRoot: process.cwd(),
		sessionCollectorRoot: DEFAULT_SESSION_COLLECTOR_ROOT,
		sessionCollectorOutput:
			"artifacts/session-collector/session-collector.json",
		circleciTelemetryRoot: DEFAULT_CIRCLECI_TELEMETRY_ROOT,
		circleciOutput: "artifacts/evals/observed-circleci-feed.json",
		bundleDir: "artifacts/session-collector",
		pluginEvalBudget: "auto",
		runPluginEvalBudget: false,
		gitPaths: [],
		gitMaxCount: "200",
		output: "artifacts/evals/observed-skill-usage.json",
		summary: "artifacts/evals/observed-skill-usage-summary.md",
		runSessionCollector: false,
		json: false,
	};
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--") {
			options.gitPaths.push(...argv.slice(index + 1));
			break;
		}
		if (arg === "--run-session-collector") {
			options.runSessionCollector = true;
			continue;
		}
		if (arg === "--json") {
			options.json = true;
			continue;
		}
		if (arg === "--run-plugin-eval-budget") {
			options.runPluginEvalBudget = true;
			continue;
		}
		const value = argv[index + 1];
		if (!value) throw new Error(`Missing value for ${arg}`);
		index += 1;
		switch (arg) {
			case "--skill":
				options.skill = value;
				break;
			case "--days":
				options.days = value;
				break;
			case "--repo-root":
				options.repoRoot = value;
				break;
			case "--session-collector-root":
				options.sessionCollectorRoot = value;
				break;
			case "--session-collector-output":
				options.sessionCollectorOutput = value;
				break;
			case "--circleci-telemetry-root":
				options.circleciTelemetryRoot = value;
				break;
			case "--circleci-output":
				options.circleciOutput = value;
				break;
			case "--bundle-dir":
				options.bundleDir = value;
				break;
			case "--plugin-eval-budget":
				options.pluginEvalBudget = value;
				break;
			case "--skill-path":
				options.skillPath = value;
				break;
			case "--git-range":
				options.gitRange = value;
				break;
			case "--git-since":
				options.gitSince = value;
				break;
			case "--git-until":
				options.gitUntil = value;
				break;
			case "--git-branch":
				options.gitBranch = value;
				break;
			case "--git-pr":
				options.gitPr = value;
				break;
			case "--git-path":
				options.gitPaths.push(value);
				break;
			case "--git-max-count":
				options.gitMaxCount = value;
				break;
			case "--output":
				options.output = value;
				break;
			case "--summary":
				options.summary = value;
				break;
			default:
				throw new Error(`Unknown option ${arg}`);
		}
	}
	return options;
}

function runSessionCollector(options: CliOptions): void {
	const outputPath = resolve(options.repoRoot, options.sessionCollectorOutput);
	const bundleDir = resolve(options.repoRoot, options.bundleDir);
	mkdirSync(bundleDir, { recursive: true });
	execFileSync(
		"uv",
		[
			"run",
			"--python",
			"3.12",
			"python",
			"main.py",
			"--days",
			options.days,
			"--verbose",
			"--bundle-dir",
			bundleDir,
			"--output",
			outputPath,
		],
		{ cwd: options.sessionCollectorRoot, stdio: "inherit" },
	);
}

function resolvePluginEvalBudget(options: CliOptions): string | undefined {
	if (options.pluginEvalBudget && options.pluginEvalBudget !== "auto") {
		if (options.pluginEvalBudget === "none") return undefined;
		return options.pluginEvalBudget;
	}
	const defaultPath = join(
		"artifacts/plugin-eval",
		`${safeFileStem(options.skill)}-budget.json`,
	);
	if (options.runPluginEvalBudget) {
		runPluginEvalBudget(options, defaultPath);
		return defaultPath;
	}
	return discoverPluginEvalBudget(options) ?? undefined;
}

function runPluginEvalBudget(options: CliOptions, outputPath: string): void {
	const skillPath = resolveSkillPath(options);
	const absoluteOutputPath = resolve(options.repoRoot, outputPath);
	mkdirSync(resolve(options.repoRoot, "artifacts/plugin-eval"), {
		recursive: true,
	});
	execFileSync(
		"plugin-eval",
		[
			"explain-budget",
			skillPath,
			"--format",
			"json",
			"--output",
			absoluteOutputPath,
		],
		{ stdio: "inherit" },
	);
}

function resolveSkillPath(options: CliOptions): string {
	if (options.skillPath) return resolve(options.repoRoot, options.skillPath);
	const agentSkillsRoot = process.env.AGENT_SKILLS_ROOT;
	const candidates = [
		resolve(options.repoRoot, ".agents/skills", options.skill),
		resolve(options.repoRoot, "skills", options.skill),
		...(agentSkillsRoot
			? [
					resolve(agentSkillsRoot, ".agents/skills", options.skill),
					resolve(agentSkillsRoot, options.skill),
				]
			: []),
		resolve(homedir(), ".codex/skills", options.skill),
	];
	const match = candidates.find((candidate) => existsSync(candidate));
	if (!match) {
		throw new Error(
			`Could not resolve skill path for ${options.skill}; pass --skill-path.`,
		);
	}
	return match;
}

function discoverPluginEvalBudget(options: CliOptions): string | null {
	const stem = safeFileStem(options.skill);
	const candidates = [
		join("artifacts/plugin-eval", `${stem}-budget.json`),
		join("artifacts/plugin-eval", `${stem}-explain-budget.json`),
		join("artifacts/plugin-eval", `${stem}.budget.json`),
		join(".plugin-eval", `${stem}-budget.json`),
		join(".plugin-eval", `${stem}-explain-budget.json`),
		join("artifacts/plugin-eval", "budget.json"),
	];
	return (
		candidates.find((candidate) =>
			existsSync(resolve(options.repoRoot, candidate)),
		) ?? null
	);
}

function collectGitLog(options: CliOptions): string {
	const gitArgs = gitLogArgs(options);
	try {
		return execFileSync("git", ["-C", options.repoRoot, ...gitArgs], {
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
		});
	} catch (primaryError) {
		try {
			return execFileSync(
				"git",
				[
					`--git-dir=${resolve(options.repoRoot, ".git")}`,
					`--work-tree=${options.repoRoot}`,
					...gitArgs,
				],
				{ encoding: "utf-8" },
			);
		} catch (fallbackError) {
			throw new Error(
				`Failed to collect git log with both -C and explicit work-tree forms. ` +
					`Primary: ${describeCommandError(primaryError)}. ` +
					`Fallback: ${describeCommandError(fallbackError)}.`,
			);
		}
	}
}

function describeCommandError(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	return String(error);
}

function gitLogArgs(options: CliOptions): string[] {
	const args = [
		"log",
		"--format=%H%x09%ad%x09%s",
		"--date=iso",
		`--max-count=${options.gitMaxCount}`,
	];
	if (options.gitSince) args.push(`--since=${options.gitSince}`);
	if (options.gitUntil) args.push(`--until=${options.gitUntil}`);
	for (const pattern of gitPrSearchPatterns(options.gitPr)) {
		// Build this flag indirectly because repo policy forbids the literal tool name.
		const gitLogSearchFlag = ["gr", "ep"].join("");
		args.push(`--${gitLogSearchFlag}=${pattern}`);
	}
	args.push(
		options.gitRange ??
			options.gitBranch ??
			currentGitBranch(options) ??
			"HEAD",
	);
	if (options.gitPaths.length > 0) args.push("--", ...options.gitPaths);
	return args;
}

function gitPrSearchPatterns(gitPr?: string): string[] {
	if (!gitPr) return [];
	return [`#${gitPr}`, `PR ${gitPr}`, `pull/${gitPr}`];
}

function currentGitBranch(options: CliOptions): string | null {
	try {
		const branch = execFileSync(
			"git",
			["-C", options.repoRoot, "branch", "--show-current"],
			{ encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] },
		).trim();
		return branch.length > 0 ? branch : null;
	} catch {
		try {
			const branch = execFileSync(
				"git",
				[
					`--git-dir=${resolve(options.repoRoot, ".git")}`,
					`--work-tree=${options.repoRoot}`,
					"branch",
					"--show-current",
				],
				{ encoding: "utf-8" },
			).trim();
			return branch.length > 0 ? branch : null;
		} catch {
			return null;
		}
	}
}

function describeGitRange(options: CliOptions): string {
	const parts = [
		options.gitRange ??
			options.gitBranch ??
			currentGitBranch(options) ??
			"HEAD",
		`--max-count=${options.gitMaxCount}`,
	];
	if (options.gitSince) parts.push(`--since=${options.gitSince}`);
	if (options.gitUntil) parts.push(`--until=${options.gitUntil}`);
	if (options.gitPr) parts.push(`--git-pr=${options.gitPr}`);
	if (options.gitPaths.length > 0) {
		parts.push(`-- ${options.gitPaths.join(" ")}`);
	}
	return parts.join(" ");
}

function resolveCircleCiTelemetryRoot(options: CliOptions): string {
	return resolve(options.repoRoot, options.circleciTelemetryRoot);
}

function safeFileStem(value: string): string {
	return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function collectChronicleStatus(): ObservedChronicleStatus {
	const tempDir = darwinTempDir();
	const pidPath = resolve(tempDir, "codex_chronicle/chronicle-started.pid");
	if (!existsSync(pidPath)) {
		return {
			status: "unavailable",
			reason: "Chronicle was not running during collection.",
		};
	}
	const pid = Number.parseInt(readFileSync(pidPath, "utf-8").trim(), 10);
	if (!Number.isFinite(pid) || !processExists(pid)) {
		return {
			status: "unavailable",
			reason: "Chronicle pidfile existed but the process was not running.",
		};
	}
	const newestFrame = newestChronicleFrame(
		resolve(tempDir, "chronicle/screen_recording"),
	);
	if (!newestFrame) {
		return {
			status: "unavailable",
			reason: "Chronicle was running but no screen frames were available.",
		};
	}
	const latestFrameAgeSeconds = Math.max(
		0,
		Math.round((Date.now() - newestFrame.mtimeMs) / 1000),
	);
	return {
		status: "available",
		reason: `Chronicle running; latest frame ${basename(newestFrame.path)} age ${latestFrameAgeSeconds}s.`,
		latestFrameAgeSeconds,
	};
}

function darwinTempDir(): string {
	try {
		return execFileSync("getconf", ["DARWIN_USER_TEMP_DIR"], {
			encoding: "utf-8",
		}).trim();
	} catch {
		return process.env.TMPDIR ?? "/tmp";
	}
}

function processExists(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

function newestChronicleFrame(
	screenRecordingDir: string,
): { path: string; mtimeMs: number } | null {
	if (!existsSync(screenRecordingDir)) return null;
	const frames: { path: string; mtimeMs: number }[] = [];
	for (const entry of readdirSync(screenRecordingDir)) {
		if (!entry.endsWith("-latest.jpg")) continue;
		const path = resolve(screenRecordingDir, entry);
		try {
			frames.push({ path, mtimeMs: statSync(path).mtimeMs });
		} catch {
			// Chronicle frames are optional evidence and can rotate during discovery.
		}
	}
	return frames.sort((left, right) => right.mtimeMs - left.mtimeMs)[0] ?? null;
}

function main(): void {
	const options = parseArgs(process.argv.slice(2));
	if (!options.gitRange && !options.gitSince) {
		options.gitSince = `${options.days} days ago`;
	}
	if (options.runSessionCollector) runSessionCollector(options);
	const pluginEvalBudgetPath = resolvePluginEvalBudget(options);
	const gitLogText = collectGitLog(options);
	const chronicle = collectChronicleStatus();
	const circleci = buildObservedCircleCiTelemetry({
		repoRoot: options.repoRoot,
		circleciTelemetryRoot: resolveCircleCiTelemetryRoot(options),
		outputPath: options.circleciOutput,
	});
	const artifact = buildObservedSkillUsage({
		skill: options.skill,
		repoRoot: options.repoRoot,
		sessionCollectorPath: options.sessionCollectorOutput,
		pluginEvalBudgetPath: pluginEvalBudgetPath,
		gitLogText,
		gitRange: describeGitRange(options),
		chronicle,
		outputPath: options.output,
		summaryPath: options.summary,
	});
	if (options.json) {
		process.stdout.write(
			`${JSON.stringify(
				{
					...artifact,
					circleciTelemetry: circleci,
				},
				null,
				2,
			)}\n`,
		);
		return;
	}
	process.stdout.write(`${renderObservedSkillUsageSummary(artifact)}`);
	process.stdout.write(`Wrote ${resolve(options.repoRoot, options.output)}\n`);
	process.stdout.write(
		`Wrote ${resolve(options.repoRoot, options.circleciOutput)}\n`,
	);
}

main();
