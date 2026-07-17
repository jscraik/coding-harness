import { existsSync, realpathSync } from "node:fs";
import {
	basename,
	dirname,
	isAbsolute,
	join,
	relative,
	resolve,
} from "node:path";

export function resolveCliPath(cli) {
	return resolve(cli);
}

function isPathInside(root, candidate) {
	const relativePath = relative(root, candidate);
	return (
		relativePath === "" ||
		(!relativePath.startsWith("..") && !isAbsolute(relativePath))
	);
}

function canonicalizePath(value) {
	const unresolved = resolve(value);
	const suffix = [];
	let existing = unresolved;
	while (!existsSync(existing)) {
		suffix.unshift(basename(existing));
		const parent = dirname(existing);
		if (parent === existing) return unresolved;
		existing = parent;
	}
	try {
		return join(realpathSync(existing), ...suffix);
	} catch {
		return unresolved;
	}
}

export function validateOutputPath(output, repos) {
	if (!output) return { ok: true };

	const outputPath = canonicalizePath(output);
	const owner = repos
		.map((repo) => canonicalizePath(repo))
		.find((repo) => isPathInside(repo, outputPath));
	if (owner) {
		return {
			ok: false,
			error: `--output must not be inside audited repository: ${owner}`,
		};
	}

	return { ok: true, path: outputPath };
}

export function outputPathFailureReport(repoCount, error) {
	return {
		schemaVersion: "harness-canary-audit/v1",
		status: "fail",
		generatedAt: new Date().toISOString(),
		readOnly: true,
		repositories: [],
		errors: [error],
		outputPathAllowed: false,
		summary: {
			total: repoCount,
			passed: 0,
			warned: 0,
			failed: repoCount,
		},
	};
}
