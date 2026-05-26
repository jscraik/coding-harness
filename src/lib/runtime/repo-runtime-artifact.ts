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

/** Read a repository-contained artifact as UTF-8 text after symlink-aware boundary checks. */
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
	let fd: number;
	try {
		fd = openSync(resolvedPath, constants.O_RDONLY | constants.O_NOFOLLOW);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ELOOP") {
			throw new Error(`${flagName} must stay within --repo`);
		}
		throw error;
	}
	try {
		if (!fstatSync(fd).isFile()) {
			throw new Error(`${flagName} must be a file`);
		}
		return readFileSync(fd, "utf8");
	} finally {
		closeSync(fd);
	}
}

/** Read and parse a repository-contained JSON artifact. */
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

/** Resolve a repository-contained output artifact path after symlink-aware boundary checks. */
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

/** Write a repository-contained JSON artifact after symlink-aware boundary checks. */
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
	const fd = openSync(
		canonicalOutput,
		constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW,
		0o644,
	);
	try {
		writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`, "utf8");
	} finally {
		closeSync(fd);
	}
}
