import {
	closeSync,
	constants,
	fstatSync,
	lstatSync,
	mkdirSync,
	openSync,
	readFileSync,
	realpathSync,
	writeFileSync,
} from "node:fs";
import {
	basename,
	dirname,
	isAbsolute,
	join,
	relative,
	resolve,
	sep,
} from "node:path";

function isOutsideRepo(repoRoot: string, pathToCheck: string): boolean {
	const rel = relative(repoRoot, pathToCheck);
	return rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel);
}

/**
 * Reads a runtime artifact as text after resolving the selected path inside
 * the repository root and opening it without following symlinks.
 */
export function readRepoRuntimeArtifactText(
	repoRoot: string,
	artifactPath: string,
	flagName: string,
): string {
	if (isAbsolute(artifactPath)) {
		throw new Error(`${flagName} must stay within --repo`);
	}
	const canonicalRepo = realpathSync(repoRoot);
	const resolvedPath = resolve(canonicalRepo, artifactPath);
	if (isOutsideRepo(canonicalRepo, resolvedPath)) {
		throw new Error(`${flagName} must stay within --repo`);
	}
	const canonicalArtifact = realpathSync(resolvedPath);
	if (isOutsideRepo(canonicalRepo, canonicalArtifact)) {
		throw new Error(`${flagName} must stay within --repo`);
	}
	const descriptor = openSync(
		canonicalArtifact,
		constants.O_RDONLY | constants.O_NOFOLLOW,
	);
	try {
		if (!fstatSync(descriptor).isFile()) {
			throw new Error(`${flagName} must point to a file`);
		}
		return readFileSync(descriptor, "utf8");
	} finally {
		closeSync(descriptor);
	}
}

/**
 * Reads a runtime artifact as JSON after enforcing the repo-contained artifact boundary.
 */
export function readRepoRuntimeJsonArtifact(
	repoRoot: string,
	artifactPath: string,
	flagName: string,
): unknown {
	return JSON.parse(
		readRepoRuntimeArtifactText(repoRoot, artifactPath, flagName),
	);
}

function nearestExistingPath(pathToCheck: string): string {
	let current = pathToCheck;
	while (true) {
		try {
			lstatSync(current);
			return current;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
				throw error;
			}
			const parent = dirname(current);
			if (parent === current) return current;
			current = parent;
		}
	}
}

/**
 * Resolves a runtime artifact output path without allowing absolute paths,
 * traversal, or symlink escapes outside the selected repository root.
 */
export function resolveRepoRuntimeOutputArtifactPath(
	repoRoot: string,
	artifactPath: string,
	flagName: string,
): string {
	if (isAbsolute(artifactPath)) {
		throw new Error(`${flagName} must stay within --repo`);
	}
	const canonicalRepo = realpathSync(repoRoot);
	const outputPath = resolve(canonicalRepo, artifactPath);
	if (isOutsideRepo(canonicalRepo, outputPath)) {
		throw new Error(`${flagName} must stay within --repo`);
	}
	const nearestExisting = nearestExistingPath(outputPath);
	let canonicalNearestExisting: string;
	try {
		canonicalNearestExisting = realpathSync(nearestExisting);
	} catch (error) {
		if (lstatSync(nearestExisting).isSymbolicLink()) {
			throw new Error(`${flagName} must stay within --repo`);
		}
		throw error;
	}
	if (isOutsideRepo(canonicalRepo, canonicalNearestExisting)) {
		throw new Error(`${flagName} must stay within --repo`);
	}
	const relativeFromNearest = relative(nearestExisting, outputPath);
	return relativeFromNearest === ""
		? canonicalNearestExisting
		: resolve(canonicalNearestExisting, relativeFromNearest);
}

/**
 * Writes a runtime JSON artifact only after validating the destination remains
 * inside the selected repository root.
 */
export function writeRepoRuntimeJsonArtifact(
	repoRoot: string,
	artifactPath: string,
	flagName: string,
	value: unknown,
): void {
	const canonicalRepo = realpathSync(repoRoot);
	const outputPath = resolveRepoRuntimeOutputArtifactPath(
		repoRoot,
		artifactPath,
		flagName,
	);
	mkdirSync(dirname(outputPath), { recursive: true });
	const canonicalDir = realpathSync(dirname(outputPath));
	const canonicalOutput = join(canonicalDir, basename(outputPath));
	if (isOutsideRepo(canonicalRepo, canonicalOutput)) {
		throw new Error(`${flagName} must stay within --repo`);
	}
	let outputEntryExists = false;
	try {
		lstatSync(canonicalOutput);
		outputEntryExists = true;
		const canonicalExistingOutput = realpathSync(canonicalOutput);
		if (isOutsideRepo(canonicalRepo, canonicalExistingOutput)) {
			throw new Error(`${flagName} must stay within --repo`);
		}
	} catch (error) {
		if (outputEntryExists) {
			throw new Error(`${flagName} must stay within --repo`);
		}
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
			throw error;
		}
	}
	writeFileSync(canonicalOutput, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
