import { lstatSync, realpathSync } from "node:fs";
import { resolve } from "node:path";

/** Split one repository-relative path without decoding non-UTF-8 bytes. */
function pathComponents(path: string | Buffer): Buffer[] {
	const bytes = Buffer.isBuffer(path) ? path : Buffer.from(path);
	const components: Buffer[] = [];
	let start = 0;
	for (let index = 0; index <= bytes.length; index += 1) {
		if (index !== bytes.length && bytes[index] !== 0x2f) continue;
		components.push(bytes.subarray(start, index));
		start = index + 1;
	}
	return components;
}

/**
 * Reject symlinked, missing, or non-directory ancestors below a trusted root.
 *
 * This is a pathname preflight for a trusted local checkout, paired by callers
 * with `O_NOFOLLOW` on the final component. Node has no portable descriptor-
 * relative `openat`, so this helper does not claim atomic containment against
 * concurrent adversarial directory replacement.
 */
export function hasUnsafeFileAncestor(
	rootPath: string,
	relativePath: string | Buffer,
): boolean {
	const components = pathComponents(relativePath);
	let current = Buffer.from(realpathSync(resolve(rootPath)));
	for (const component of components.slice(0, -1)) {
		if (
			component.length === 0 ||
			component.equals(Buffer.from(".")) ||
			component.equals(Buffer.from(".."))
		)
			return true;
		current = Buffer.concat([current, Buffer.from("/"), component]);
		try {
			const stats = lstatSync(current);
			if (stats.isSymbolicLink() || !stats.isDirectory()) return true;
		} catch {
			return true;
		}
	}
	return false;
}
