#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { spawnSync } = require("node:child_process");

function parseArgs(argv) {
	const args = { packetPath: null, repoRoot: process.cwd(), errors: [] };
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--repo-root") {
			const value = argv[index + 1];
			if (!value) {
				args.errors.push("--repo-root requires a value");
				continue;
			}
			args.repoRoot = value;
			index += 1;
			continue;
		}
		if (arg.startsWith("--")) {
			args.errors.push(`Unknown argument: ${arg}`);
			continue;
		}
		if (args.packetPath) {
			args.errors.push("Only one packet path may be provided");
			continue;
		}
		args.packetPath = arg;
	}
	return args;
}

function printResult(status, errors, exitCode) {
	console.log(
		JSON.stringify(
			{
				schemaVersion: "intermediary-receipt-coverage-validation/v1",
				status,
				errors,
			},
			null,
			2,
		),
	);
	process.exit(exitCode);
}

function resolvePacketPath(repoRoot, packetPath) {
	const resolved = path.resolve(repoRoot, packetPath);
	const relative = path.relative(repoRoot, resolved);
	if (
		relative === "" ||
		relative.startsWith("..") ||
		path.isAbsolute(relative)
	) {
		printResult("fail", ["packetPath: must resolve within --repo-root"], 1);
	}
	return resolved;
}

function isValidationEnvelope(stdout) {
	if (!stdout.trim()) return false;
	try {
		const parsed = JSON.parse(stdout);
		return (
			parsed &&
			parsed.schemaVersion === "intermediary-receipt-coverage-validation/v1" &&
			(parsed.status === "pass" || parsed.status === "fail") &&
			Array.isArray(parsed.errors)
		);
	} catch (_error) {
		return false;
	}
}

function summarizeText(value) {
	const normalized = String(value || "")
		.replace(/\s+/g, " ")
		.trim();
	if (normalized.length <= 800) return normalized;
	return `${normalized.slice(0, 800)}...`;
}

function main() {
	const args = parseArgs(process.argv.slice(2));
	if (args.errors.length > 0) {
		printResult("fail", args.errors, 2);
	}
	if (!args.packetPath) {
		printResult("fail", ["packetPath: is required"], 2);
	}
	const repoRoot = path.resolve(args.repoRoot);
	const packetPath = resolvePacketPath(repoRoot, args.packetPath);
	if (!fs.existsSync(packetPath)) {
		printResult("fail", ["packetPath: file does not exist"], 1);
	}

	const moduleUrl = pathToFileURL(
		path.join(repoRoot, "src/lib/intermediary-receipts/index.ts"),
	).href;
	const runner = [
		"import { readFileSync } from 'node:fs';",
		"const moduleUrl = process.env.INTERMEDIARY_RECEIPT_COVERAGE_MODULE_URL;",
		"const packetPath = process.env.INTERMEDIARY_RECEIPT_COVERAGE_PACKET_PATH;",
		"const { validateIntermediaryReceiptCoverage } = await import(moduleUrl);",
		"const packet = JSON.parse(readFileSync(packetPath, 'utf8'));",
		"const result = validateIntermediaryReceiptCoverage(packet);",
		"console.log(JSON.stringify({ schemaVersion: 'intermediary-receipt-coverage-validation/v1', status: result.valid ? 'pass' : 'fail', errors: result.errors }, null, 2));",
		"process.exit(result.valid ? 0 : 1);",
	].join("\n");

	const child = spawnSync(
		process.execPath,
		["--import", "tsx", "--eval", runner],
		{
			cwd: repoRoot,
			env: {
				...process.env,
				INTERMEDIARY_RECEIPT_COVERAGE_MODULE_URL: moduleUrl,
				INTERMEDIARY_RECEIPT_COVERAGE_PACKET_PATH: packetPath,
			},
			encoding: "utf8",
		},
	);
	if (child.error) {
		printResult("fail", [`runner: ${child.error.message}`], 1);
	}
	if (isValidationEnvelope(child.stdout)) {
		process.stdout.write(child.stdout);
		process.exit(child.status === null ? 1 : child.status);
	}
	if (child.status === 0) {
		const errors = [
			"runner: exited with status 0 but did not emit intermediary-receipt-coverage-validation/v1 JSON",
		];
		const stderr = summarizeText(child.stderr);
		const stdout = summarizeText(child.stdout);
		if (stderr) errors.push(`runner.stderr: ${stderr}`);
		if (stdout) errors.push(`runner.stdout: ${stdout}`);
		printResult("fail", errors, 1);
	}
	const childExit = child.signal
		? `signal ${child.signal}`
		: `status ${child.status ?? "unknown"}`;
	const errors = [`runner: exited with ${childExit}`];
	const stderr = summarizeText(child.stderr);
	const stdout = summarizeText(child.stdout);
	if (stderr) errors.push(`runner.stderr: ${stderr}`);
	if (stdout) errors.push(`runner.stdout: ${stdout}`);
	printResult("fail", errors, child.status === null ? 1 : child.status || 1);
}

main();
