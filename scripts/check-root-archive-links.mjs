import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const archiveRoot = path.join(repoRoot, "docs", "archive", "root-cleanup");

function walkMarkdownFiles(dir) {
	if (!existsSync(dir)) {
		return [];
	}

	const entries = readdirSync(dir, { withFileTypes: true });
	return entries.flatMap((entry) => {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			return walkMarkdownFiles(fullPath);
		}
		return entry.isFile() && entry.name.endsWith(".md") ? [fullPath] : [];
	});
}

function stripAnchor(target) {
	return target.split("#", 1)[0];
}

function isExternalTarget(target) {
	return (
		target === "" ||
		target.startsWith("#") ||
		/^[a-z][a-z0-9+.-]*:/i.test(target)
	);
}

function candidateFor(sourceFile, target) {
	const cleanTarget = stripAnchor(target.trim());
	if (isExternalTarget(cleanTarget)) {
		return null;
	}

	if (cleanTarget.startsWith("/")) {
		return path.join(repoRoot, cleanTarget.slice(1));
	}

	if (cleanTarget.startsWith("docs/archive/root-cleanup/")) {
		return path.join(repoRoot, cleanTarget);
	}

	if (cleanTarget.endsWith(".md") && !cleanTarget.includes("/")) {
		return path.join(path.dirname(sourceFile), cleanTarget);
	}

	return path.resolve(path.dirname(sourceFile), cleanTarget);
}

function extractTargets(markdown) {
	const targets = [];
	const markdownLinkPattern = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
	const codePathPattern = /`([^`]*\.md)`/g;

	for (const match of markdown.matchAll(markdownLinkPattern)) {
		const target = match[1].trim();
		if (
			target.startsWith("docs/archive/root-cleanup/") ||
			target.startsWith("./")
		) {
			targets.push(target);
		}
	}

	for (const match of markdown.matchAll(codePathPattern)) {
		const target = match[1].trim();
		if (
			target.startsWith("docs/archive/root-cleanup/") ||
			(!target.includes("/") &&
				/^\d{3}-(complete|pending)-.*\.md$/.test(target))
		) {
			targets.push(target);
		}
	}

	return targets;
}

const failures = [];

for (const file of walkMarkdownFiles(archiveRoot)) {
	const markdown = readFileSync(file, "utf8");
	for (const target of extractTargets(markdown)) {
		const candidate = candidateFor(file, target);
		if (!candidate) {
			continue;
		}

		if (!candidate.startsWith(repoRoot + path.sep)) {
			failures.push({ file, target, reason: "target escapes repository" });
			continue;
		}

		if (!existsSync(candidate)) {
			failures.push({ file, target, reason: "target is missing" });
		}
	}
}

if (failures.length > 0) {
	console.error("[check-root-archive-links] broken archive references:");
	for (const failure of failures) {
		console.error(
			"- " +
				path.relative(repoRoot, failure.file) +
				" -> " +
				failure.target +
				" (" +
				failure.reason +
				")",
		);
	}
	process.exit(1);
}

console.log("[check-root-archive-links] pass");
