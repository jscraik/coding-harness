#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const routePath = path.join(
	root,
	"docs/goals/codex-runtime-evidence-verifier-cockpit/current-route.json",
);
const hotPathRefs = [
	".harness/active-artifacts.md",
	"docs/goals/codex-runtime-evidence-verifier-cockpit/state.yaml",
	"docs/goals/codex-runtime-evidence-verifier-cockpit/notes/execution-tracker.md",
];

function readText(relativePath) {
	return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function fail(violations, file, message) {
	violations.push({ file, message });
}

function parseJson(file, violations) {
	try {
		return JSON.parse(fs.readFileSync(file, "utf8"));
	} catch (error) {
		fail(
			violations,
			path.relative(root, file),
			`invalid JSON: ${error.message}`,
		);
		return null;
	}
}

function countMatches(text, pattern) {
	return Array.from(text.matchAll(pattern)).length;
}

const violations = [];
const route = parseJson(routePath, violations);

if (route) {
	if (route.schemaVersion !== "goal-current-route/v1") {
		fail(
			violations,
			"current-route.json",
			"schemaVersion must be goal-current-route/v1",
		);
	}
	for (const key of [
		"goalSlug",
		"issueKey",
		"status",
		"activeRoute",
		"currentSlice",
		"currentHeadSha",
		"nextSafeAction",
		"updatedAt",
	]) {
		if (typeof route[key] !== "string" || route[key].trim() === "") {
			fail(
				violations,
				"current-route.json",
				`${key} must be a non-empty string`,
			);
		}
	}
	if (!Array.isArray(route.blockers) || route.blockers.length === 0) {
		fail(
			violations,
			"current-route.json",
			"blockers must include at least one current blocker",
		);
	}
	if (
		!Array.isArray(route.claimBoundaries) ||
		route.claimBoundaries.length === 0
	) {
		fail(
			violations,
			"current-route.json",
			"claimBoundaries must name what the route does not prove",
		);
	}
	if (!Array.isArray(route.canonicalRefs) || route.canonicalRefs.length === 0) {
		fail(
			violations,
			"current-route.json",
			"canonicalRefs must list route evidence surfaces",
		);
	} else {
		for (const ref of route.canonicalRefs) {
			if (typeof ref !== "string" || !fs.existsSync(path.join(root, ref))) {
				fail(
					violations,
					"current-route.json",
					`canonical ref is missing: ${ref}`,
				);
			}
		}
	}
}

for (const relativePath of hotPathRefs) {
	const text = readText(relativePath);
	if (!text.includes("current-route.json")) {
		fail(
			violations,
			relativePath,
			"hot route surface must point to current-route.json",
		);
	}
}

const activeArtifacts = readText(".harness/active-artifacts.md");
const routeTableLine =
	activeArtifacts
		.split("\n")
		.find((line) =>
			line.startsWith("| Codex runtime evidence verifier cockpit |"),
		) ?? "";
if (routeTableLine.length > 1600) {
	fail(
		violations,
		".harness/active-artifacts.md",
		"current active route table row must stay compact and point to canonical route refs",
	);
}
if (countMatches(routeTableLine, /PR #\d+/g) > 2) {
	fail(
		violations,
		".harness/active-artifacts.md",
		"current active route table row must not duplicate historical PR chronology",
	);
}

const trackerHead = readText(
	"docs/goals/codex-runtime-evidence-verifier-cockpit/notes/execution-tracker.md",
)
	.split("\n")
	.slice(0, 120)
	.join("\n");
if (countMatches(trackerHead, /PR #\d+/g) > 8) {
	fail(
		violations,
		"docs/goals/codex-runtime-evidence-verifier-cockpit/notes/execution-tracker.md",
		"tracker restart window must keep PR chronology in receipts/current-route pointers",
	);
}

const result = {
	schemaVersion: "active-route-surface-validation/v1",
	status: violations.length === 0 ? "pass" : "fail",
	routePath: path.relative(root, routePath),
	violations,
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.exit(violations.length === 0 ? 0 : 1);
