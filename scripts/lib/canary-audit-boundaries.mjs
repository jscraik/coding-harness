import { isAbsolute, relative, resolve } from "node:path";

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

export function validateOutputPath(output, repos) {
	if (!output) return { ok: true };

	const outputPath = resolve(output);
	const owner = repos
		.map((repo) => resolve(repo))
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
