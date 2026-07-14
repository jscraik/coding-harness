import {
	PROVIDERS,
	SynaipseContextContractError,
	contractEnum,
	contractObject,
	contractString,
	rejectUnknown,
} from "./context-contract.js";

/** Return whether provider metadata exposes a machine-local absolute path. */
function exposesLocalPath(reference: string): boolean {
	const lower = reference.toLowerCase();
	const first = reference.charAt(0);
	const startsWithDrive =
		reference.length >= 2 &&
		((first >= "A" && first <= "Z") || (first >= "a" && first <= "z")) &&
		reference[1] === ":";
	return (
		reference.startsWith("/") ||
		reference.startsWith("\\") ||
		reference.startsWith("~") ||
		lower.startsWith("file:") ||
		startsWithDrive
	);
}

/** Parsed provider metadata carried by a context reference. */
export type SynaipseContextProvider = {
	kind: (typeof PROVIDERS)[number];
	reference: string;
};

/** Parse repository-relative or logical provider metadata without reading it. */
export function parseSynaipseContextProvider(
	value: unknown,
	path: string,
): SynaipseContextProvider {
	const provider = contractObject(value, path);
	rejectUnknown(provider, ["kind", "reference"], path);
	const kind = contractEnum(provider.kind, PROVIDERS, `${path}.kind`);
	const reference = contractString(provider.reference, `${path}.reference`);
	if (exposesLocalPath(reference))
		throw new SynaipseContextContractError(
			`${path}.reference`,
			"must not expose an absolute local path",
		);
	if (reference.includes("\\"))
		throw new SynaipseContextContractError(
			`${path}.reference`,
			"must not use backslashes; use portable forward-slash or opaque logical syntax",
		);
	if (reference.includes("\n") || reference.includes("\r"))
		throw new SynaipseContextContractError(
			`${path}.reference`,
			"must not contain line breaks",
		);
	if (reference.split("/").some((segment) => segment === ".."))
		throw new SynaipseContextContractError(
			`${path}.reference`,
			"must not traverse outside its declared context root",
		);
	return { kind, reference };
}
