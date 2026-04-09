#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function usage() {
	console.error(
		"Usage: node scripts/check-scorecard-regressions.mjs --results <path> --policy <path> --mode <warn|fail>",
	);
}

function readFlagValue(argv, index, flag) {
	const value = argv[index + 1];
	if (value === undefined || value.startsWith("--")) {
		throw new Error(`Missing value for ${flag}`);
	}
	return value;
}

function parseArgs(argv) {
	const parsed = {
		resultsPath: null,
		policyPath: null,
		mode: null,
	};

	for (let i = 2; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === "--results") {
			parsed.resultsPath = readFlagValue(argv, i, "--results");
			i += 1;
			continue;
		}
		if (arg === "--policy") {
			parsed.policyPath = readFlagValue(argv, i, "--policy");
			i += 1;
			continue;
		}
		if (arg === "--mode") {
			parsed.mode = readFlagValue(argv, i, "--mode");
			i += 1;
		}
	}

	return parsed;
}

function readJson(path, label) {
	const resolvedPath = resolve(path);
	try {
		const raw = readFileSync(resolvedPath, "utf8");
		return JSON.parse(raw);
	} catch (error) {
		const details = error instanceof Error ? error.message : String(error);
		throw new Error(
			`Failed to read ${label} JSON at ${resolvedPath}: ${details}`,
		);
	}
}

function isRecord(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parsePolicy(policyInput) {
	if (!isRecord(policyInput)) {
		throw new Error("Policy must be a JSON object");
	}

	const minimumAggregateScore = policyInput.minimumAggregateScore;
	if (
		minimumAggregateScore !== undefined &&
		!(
			typeof minimumAggregateScore === "number" &&
			Number.isFinite(minimumAggregateScore)
		)
	) {
		throw new Error(
			"policy.minimumAggregateScore must be a finite number when provided",
		);
	}

	const keyChecks = policyInput.keyChecks;
	if (!Array.isArray(keyChecks) || keyChecks.length === 0) {
		throw new Error("policy.keyChecks must be a non-empty array");
	}

	const normalizedChecks = keyChecks.map((entry, index) => {
		if (!isRecord(entry)) {
			throw new Error(`policy.keyChecks[${index}] must be an object`);
		}
		const name = entry.name;
		const minimumScore = entry.minimumScore;
		if (typeof name !== "string" || name.trim().length === 0) {
			throw new Error(
				`policy.keyChecks[${index}].name must be a non-empty string`,
			);
		}
		if (!(typeof minimumScore === "number" && Number.isFinite(minimumScore))) {
			throw new Error(
				`policy.keyChecks[${index}].minimumScore must be a finite number`,
			);
		}
		return {
			name,
			minimumScore,
		};
	});

	return {
		minimumAggregateScore,
		keyChecks: normalizedChecks,
	};
}

function parseScorecardResults(resultsInput) {
	if (!isRecord(resultsInput)) {
		throw new Error("Scorecard results must be a JSON object");
	}

	const aggregateScore =
		typeof resultsInput.score === "number" &&
		Number.isFinite(resultsInput.score)
			? resultsInput.score
			: null;

	const checks = resultsInput.checks;
	if (!Array.isArray(checks)) {
		throw new Error("Scorecard results must include checks[]");
	}

	const byName = new Map();
	for (const check of checks) {
		if (!isRecord(check)) {
			continue;
		}
		const name = check.name;
		const score = check.score;
		if (typeof name !== "string" || name.trim().length === 0) {
			continue;
		}
		if (typeof score !== "number" || !Number.isFinite(score)) {
			continue;
		}
		byName.set(name, score);
	}

	return {
		aggregateScore,
		byName,
	};
}

function evaluate(policy, results) {
	const violations = [];

	if (policy.minimumAggregateScore !== undefined) {
		if (results.aggregateScore === null) {
			violations.push({
				type: "missing-aggregate",
				description: "Aggregate score is missing from scorecard output",
			});
		} else if (results.aggregateScore < policy.minimumAggregateScore) {
			violations.push({
				type: "aggregate-threshold",
				description: `Aggregate score ${results.aggregateScore.toFixed(1)} < required ${policy.minimumAggregateScore.toFixed(1)}`,
			});
		}
	}

	for (const target of policy.keyChecks) {
		const score = results.byName.get(target.name);
		if (score === undefined) {
			violations.push({
				type: "missing-check",
				description: `Missing scorecard check '${target.name}'`,
			});
			continue;
		}
		if (score < target.minimumScore) {
			violations.push({
				type: "check-threshold",
				description: `${target.name} score ${score.toFixed(1)} < required ${target.minimumScore.toFixed(1)}`,
			});
		}
	}

	return violations;
}

function main() {
	let args;
	try {
		args = parseArgs(process.argv);
	} catch (error) {
		const details = error instanceof Error ? error.message : String(error);
		console.error(details);
		usage();
		process.exit(2);
	}

	if (!args.resultsPath || !args.policyPath || !args.mode) {
		if (!args.mode) {
			console.error("Missing required --mode <warn|fail>.");
		}
		usage();
		process.exit(2);
	}

	if (args.mode !== "warn" && args.mode !== "fail") {
		console.error(`Invalid --mode '${args.mode}'. Expected warn or fail.`);
		process.exit(2);
	}

	const policy = parsePolicy(readJson(args.policyPath, "policy"));
	const results = parseScorecardResults(
		readJson(args.resultsPath, "scorecard results"),
	);
	const violations = evaluate(policy, results);

	const header = `OpenSSF Scorecard policy evaluation (${args.mode} mode)`;
	console.info(header);
	console.info("-".repeat(header.length));
	console.info(
		`aggregate_score=${results.aggregateScore === null ? "missing" : results.aggregateScore.toFixed(1)}`,
	);
	console.info(`key_checks_evaluated=${policy.keyChecks.length}`);

	if (violations.length === 0) {
		console.info("result=pass");
		return;
	}

	for (const violation of violations) {
		console.info(`violation: ${violation.description}`);
	}

	if (args.mode === "warn") {
		console.info("result=warn");
		return;
	}

	console.info("result=fail");
	process.exit(1);
}

main();
