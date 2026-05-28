#!/usr/bin/env node
const { spawnSync } = require("node:child_process");
const { existsSync, readFileSync, realpathSync } = require("node:fs");
const { dirname, isAbsolute, relative, resolve } = require("node:path");

const REPO_ROOT = process.cwd();
const REPO_ROOT_REAL = realpathSync(REPO_ROOT);
const DEFAULT_MANIFEST = "contracts/runtime-packet-schemas.manifest.json";
const DRAFT_2020_12 = "https://json-schema.org/draft/2020-12/schema";
const VALID_RUNTIME_STATUSES = new Set(["emitted", "not_yet_emitted"]);
const VALID_PARITY_VALIDATORS = new Set([
	"evidence-receipt",
	"runtime-card",
	"runtime-card-handoff",
	"harness-decision",
	"review-state",
	"external-state-snapshot",
	"delivery-truth",
	"decision-request",
	"session-context",
	"none",
]);
const SUPPORTED_SCHEMA_KEYWORDS = new Set([
	"$id",
	"$ref",
	"$schema",
	"$defs",
	"additionalProperties",
	"anyOf",
	"const",
	"description",
	"enum",
	"format",
	"items",
	"maxLength",
	"minItems",
	"minLength",
	"minimum",
	"pattern",
	"properties",
	"required",
	"title",
	"type",
]);

function parseArgs(argv) {
	const args = { manifest: DEFAULT_MANIFEST };
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "--all") continue;
		if (arg === "--manifest") {
			const value = argv[index + 1];
			if (!value) throw new Error("--manifest requires a value");
			args.manifest = value;
			index += 1;
			continue;
		}
		throw new Error(`Unknown argument: ${arg}`);
	}
	return args;
}

function loadJson(relativePath) {
	const absolutePath = resolveRepoContainedPath(relativePath, relativePath);
	return JSON.parse(readFileSync(absolutePath, "utf8"));
}

function resolveRepoContainedPath(inputPath, label) {
	const resolvedPath = resolve(REPO_ROOT_REAL, inputPath);
	const targetPath = existsSync(resolvedPath)
		? realpathSync(resolvedPath)
		: resolvedPath;
	const relativePath = relative(REPO_ROOT_REAL, targetPath);
	if (relativePath.startsWith("..") || isAbsolute(relativePath)) {
		throw new Error(`${label} must resolve inside repository root`);
	}
	return targetPath;
}

function isObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonType(value) {
	if (value === null) return "null";
	if (Array.isArray(value)) return "array";
	if (Number.isInteger(value)) return "integer";
	if (typeof value === "number") return "number";
	if (typeof value === "object") return "object";
	return typeof value;
}

function valuesEqual(left, right) {
	return JSON.stringify(left) === JSON.stringify(right);
}

function valueMatchesType(value, expectedType) {
	const actualType = jsonType(value);
	if (expectedType === "number") {
		return actualType === "number" || actualType === "integer";
	}
	return actualType === expectedType;
}

function schemaTypeMatches(value, type) {
	if (Array.isArray(type)) {
		return type.some((expectedType) => valueMatchesType(value, expectedType));
	}
	if (typeof type === "string") return valueMatchesType(value, type);
	return true;
}

function decodeJsonPointerSegment(segment) {
	return segment.replace(/~1/g, "/").replace(/~0/g, "~");
}

function resolveJsonPointer(document, fragment) {
	if (!fragment) return document;
	if (!fragment.startsWith("/")) return undefined;
	let current = document;
	for (const rawSegment of fragment.slice(1).split("/")) {
		if (!isObject(current) && !Array.isArray(current)) return undefined;
		const segment = decodeJsonPointerSegment(rawSegment);
		if (!Object.hasOwn(current, segment)) return undefined;
		current = current[segment];
	}
	return current;
}

function decodeRefFragment(fragment, ref, errors, contextPath) {
	try {
		return decodeURIComponent(fragment);
	} catch {
		errors.push(`${contextPath} references invalid URI fragment ${ref}`);
		return null;
	}
}

function resolveReferencedSchema(ref, baseSchemaPath, errors, contextPath) {
	if (typeof ref !== "string" || ref.trim() === "") return null;
	const [filePart, fragment = ""] = ref.split("#", 2);
	const referencedSchemaCandidate = filePart
		? resolve(dirname(baseSchemaPath), filePart)
		: baseSchemaPath;
	let referencedSchemaPath;
	try {
		referencedSchemaPath = resolveRepoContainedPath(
			referencedSchemaCandidate,
			`${contextPath} ref ${ref}`,
		);
	} catch (error) {
		errors.push(error.message);
		return null;
	}
	if (!existsSync(referencedSchemaPath)) {
		errors.push(`${contextPath} references missing schema ${ref}`);
		return null;
	}
	const document = loadJson(referencedSchemaPath);
	const decodedFragment = decodeRefFragment(fragment, ref, errors, contextPath);
	if (decodedFragment === null) return null;
	const schema = resolveJsonPointer(document, decodedFragment);
	if (schema === undefined) {
		errors.push(`${contextPath} references unresolved schema pointer ${ref}`);
		return null;
	}
	return { path: referencedSchemaPath, schema };
}

function validateSupportedSchemaKeywords(
	schema,
	schemaPath,
	errors,
	schemaNodePath,
	visitedRefs = new Set(),
) {
	if (!isObject(schema)) return;
	for (const key of Object.keys(schema)) {
		if (!SUPPORTED_SCHEMA_KEYWORDS.has(key)) {
			errors.push(
				`${schemaPath}${schemaNodePath} uses unsupported JSON Schema keyword ${key}`,
			);
		}
	}
	if (typeof schema.$ref === "string") {
		const referenced = resolveReferencedSchema(
			schema.$ref,
			schemaPath,
			errors,
			schemaPath + schemaNodePath,
		);
		const visitedRef = referenced
			? `${referenced.path}#${schema.$ref.split("#", 2)[1] ?? ""}`
			: null;
		if (referenced && visitedRef && !visitedRefs.has(visitedRef)) {
			visitedRefs.add(visitedRef);
			validateSupportedSchemaKeywords(
				referenced.schema,
				referenced.path,
				errors,
				"",
				visitedRefs,
			);
		}
	}
	if (isObject(schema.additionalProperties)) {
		errors.push(
			`${schemaPath}${schemaNodePath}.additionalProperties uses schema-valued additionalProperties, which this validator does not support`,
		);
	}
	if (isObject(schema.properties)) {
		for (const [propertyName, propertySchema] of Object.entries(
			schema.properties,
		)) {
			validateSupportedSchemaKeywords(
				propertySchema,
				schemaPath,
				errors,
				`${schemaNodePath}.properties.${propertyName}`,
				visitedRefs,
			);
		}
	}
	if (isObject(schema.$defs)) {
		for (const [definitionName, definitionSchema] of Object.entries(
			schema.$defs,
		)) {
			validateSupportedSchemaKeywords(
				definitionSchema,
				schemaPath,
				errors,
				`${schemaNodePath}.$defs.${definitionName}`,
				visitedRefs,
			);
		}
	}
	if (isObject(schema.items)) {
		validateSupportedSchemaKeywords(
			schema.items,
			schemaPath,
			errors,
			`${schemaNodePath}.items`,
			visitedRefs,
		);
	}
	if (Array.isArray(schema.anyOf)) {
		for (const [index, candidate] of schema.anyOf.entries()) {
			validateSupportedSchemaKeywords(
				candidate,
				schemaPath,
				errors,
				`${schemaNodePath}.anyOf[${index}]`,
				visitedRefs,
			);
		}
	}
}

function validateExampleValue(schema, value, valuePath, errors, schemaPath) {
	if (!isObject(schema)) return;
	if (schema.$ref) {
		const referenced = resolveReferencedSchema(
			schema.$ref,
			schemaPath,
			errors,
			valuePath,
		);
		if (referenced) {
			validateExampleValue(
				referenced.schema,
				value,
				valuePath,
				errors,
				referenced.path,
			);
		}
		return;
	}
	if (Array.isArray(schema.anyOf)) {
		const anyOfPassed = schema.anyOf.some((candidate) => {
			const candidateErrors = [];
			validateExampleValue(
				candidate,
				value,
				valuePath,
				candidateErrors,
				schemaPath,
			);
			return candidateErrors.length === 0;
		});
		if (!anyOfPassed) {
			errors.push(`${valuePath} must match at least one anyOf schema`);
		}
	}
	if (Object.hasOwn(schema, "const") && !valuesEqual(value, schema.const)) {
		errors.push(`${valuePath} must equal schema const`);
	}
	if (
		Array.isArray(schema.enum) &&
		!schema.enum.some((allowed) => valuesEqual(value, allowed))
	) {
		errors.push(`${valuePath} must be one of schema enum values`);
	}
	if (!schemaTypeMatches(value, schema.type)) {
		const expected = Array.isArray(schema.type)
			? schema.type.join("|")
			: schema.type;
		errors.push(`${valuePath} must be type ${expected}`);
		return;
	}
	if (typeof value === "string") {
		if (
			typeof schema.minLength === "number" &&
			value.length < schema.minLength
		) {
			errors.push(`${valuePath} must have minLength ${schema.minLength}`);
		}
		if (
			typeof schema.maxLength === "number" &&
			value.length > schema.maxLength
		) {
			errors.push(`${valuePath} must have maxLength ${schema.maxLength}`);
		}
		if (typeof schema.pattern === "string") {
			let pattern;
			try {
				pattern = new RegExp(schema.pattern);
			} catch (error) {
				errors.push(
					`${valuePath} has invalid schema pattern ${schema.pattern}: ${error.message}`,
				);
				pattern = null;
			}
			if (pattern && !pattern.test(value)) {
				errors.push(`${valuePath} must match pattern ${schema.pattern}`);
			}
		}
		if (schema.format === "date-time" && Number.isNaN(Date.parse(value))) {
			errors.push(`${valuePath} must be a date-time string`);
		}
	}
	if (
		typeof value === "number" &&
		typeof schema.minimum === "number" &&
		value < schema.minimum
	) {
		errors.push(`${valuePath} must be >= ${schema.minimum}`);
	}
	if (Array.isArray(value)) {
		if (typeof schema.minItems === "number" && value.length < schema.minItems) {
			errors.push(`${valuePath} must have at least ${schema.minItems} items`);
		}
		if (isObject(schema.items)) {
			for (const [index, item] of value.entries()) {
				validateExampleValue(
					schema.items,
					item,
					`${valuePath}[${index}]`,
					errors,
					schemaPath,
				);
			}
		}
	}
	if (isObject(value)) {
		if (Array.isArray(schema.required)) {
			for (const requiredKey of schema.required) {
				if (!Object.hasOwn(value, requiredKey)) {
					errors.push(`${valuePath}.${requiredKey} is required`);
				}
			}
		}
		const properties = isObject(schema.properties) ? schema.properties : {};
		for (const [key, propertySchema] of Object.entries(properties)) {
			if (Object.hasOwn(value, key)) {
				validateExampleValue(
					propertySchema,
					value[key],
					`${valuePath}.${key}`,
					errors,
					schemaPath,
				);
			}
		}
		if (schema.additionalProperties === false) {
			for (const key of Object.keys(value)) {
				if (!Object.hasOwn(properties, key)) {
					errors.push(`${valuePath}.${key} is not allowed`);
				}
			}
		}
	}
}

function requireString(value, path, errors) {
	if (typeof value !== "string" || value.trim() === "") {
		errors.push(`${path} must be a non-empty string`);
	}
}

function validateManifestShape(manifest, errors) {
	if (!isObject(manifest)) {
		errors.push("manifest must be an object");
		return;
	}
	if (manifest.schemaVersion !== "runtime-packet-schemas-manifest/v1") {
		errors.push(
			"manifest.schemaVersion must be runtime-packet-schemas-manifest/v1",
		);
	}
	if (!Array.isArray(manifest.packets) || manifest.packets.length === 0) {
		errors.push("manifest.packets must be a non-empty array");
	}
}

function validatePacketEntry(entry, index, seen, errors) {
	const prefix = `manifest.packets[${index}]`;
	if (!isObject(entry)) {
		errors.push(`${prefix} must be an object`);
		return;
	}
	requireString(entry.schemaVersion, `${prefix}.schemaVersion`, errors);
	requireString(entry.schemaPath, `${prefix}.schemaPath`, errors);
	requireString(entry.examplePath, `${prefix}.examplePath`, errors);
	requireString(entry.ownerGap, `${prefix}.ownerGap`, errors);
	if (seen.has(entry.schemaVersion)) {
		errors.push(`${prefix}.schemaVersion duplicates ${entry.schemaVersion}`);
	}
	seen.add(entry.schemaVersion);
	if (!VALID_RUNTIME_STATUSES.has(entry.runtimeStatus)) {
		errors.push(`${prefix}.runtimeStatus must be emitted or not_yet_emitted`);
	}
	if (!VALID_PARITY_VALIDATORS.has(entry.parityValidator)) {
		errors.push(`${prefix}.parityValidator is not recognized`);
	}
	if (
		Object.hasOwn(entry, "semanticValidatorPath") &&
		typeof entry.semanticValidatorPath !== "string"
	) {
		errors.push(
			`${prefix}.semanticValidatorPath must be a string when present`,
		);
	}
	if (entry.runtimeStatus === "emitted") {
		requireString(entry.typeSourcePath, `${prefix}.typeSourcePath`, errors);
		if (entry.parityValidator === "none") {
			errors.push(
				`${prefix}.parityValidator must not be none for emitted packets`,
			);
		}
	}
	if (entry.runtimeStatus === "not_yet_emitted") {
		if (entry.typeSourcePath !== null) {
			errors.push(
				`${prefix}.typeSourcePath must be null for not_yet_emitted packets`,
			);
		}
		if (entry.parityValidator !== "none") {
			errors.push(
				`${prefix}.parityValidator must be none for not_yet_emitted packets`,
			);
		}
		requireString(entry.blockedBy, `${prefix}.blockedBy`, errors);
	}
}

function validateSchemaAndExample(entry, errors) {
	const resolvedPaths = {};
	let resolvedSemanticValidatorPath = null;
	for (const field of ["schemaPath", "examplePath"]) {
		try {
			resolvedPaths[field] = resolveRepoContainedPath(
				entry[field],
				`${entry.schemaVersion} ${field}`,
			);
		} catch (error) {
			errors.push(error.message);
			continue;
		}
		if (!existsSync(resolvedPaths[field])) {
			errors.push(
				`${entry.schemaVersion} ${field} does not exist: ${entry[field]}`,
			);
		}
	}
	if (entry.typeSourcePath) {
		let resolvedTypeSourcePath = null;
		try {
			resolvedTypeSourcePath = resolveRepoContainedPath(
				entry.typeSourcePath,
				`${entry.schemaVersion} typeSourcePath`,
			);
		} catch (error) {
			errors.push(error.message);
		}
		if (resolvedTypeSourcePath && !existsSync(resolvedTypeSourcePath)) {
			errors.push(
				`${entry.schemaVersion} typeSourcePath does not exist: ${entry.typeSourcePath}`,
			);
		}
	}
	if (entry.semanticValidatorPath) {
		try {
			resolvedSemanticValidatorPath = resolveRepoContainedPath(
				entry.semanticValidatorPath,
				`${entry.schemaVersion} semanticValidatorPath`,
			);
		} catch (error) {
			errors.push(error.message);
		}
		if (
			resolvedSemanticValidatorPath &&
			!existsSync(resolvedSemanticValidatorPath)
		) {
			errors.push(
				`${entry.schemaVersion} semanticValidatorPath does not exist: ${entry.semanticValidatorPath}`,
			);
		}
	}
	if (
		!existsSync(resolvedPaths.schemaPath) ||
		!existsSync(resolvedPaths.examplePath)
	) {
		return;
	}
	const schema = loadJson(resolvedPaths.schemaPath);
	const example = loadJson(resolvedPaths.examplePath);
	validateSupportedSchemaKeywords(schema, entry.schemaPath, errors, "");
	if (schema.$schema !== DRAFT_2020_12) {
		errors.push(`${entry.schemaPath} must use JSON Schema Draft 2020-12`);
	}
	const schemaConst = schema?.properties?.schemaVersion?.const;
	if (schemaConst !== entry.schemaVersion) {
		errors.push(
			`${entry.schemaPath} schemaVersion const must be ${entry.schemaVersion}`,
		);
	}
	if (
		!Array.isArray(schema.required) ||
		!schema.required.includes("schemaVersion")
	) {
		errors.push(`${entry.schemaPath} must require schemaVersion`);
	}
	if (example.schemaVersion !== entry.schemaVersion) {
		errors.push(
			`${entry.examplePath} schemaVersion must be ${entry.schemaVersion}`,
		);
	}
	if (
		entry.runtimeStatus === "not_yet_emitted" &&
		example.runtimeStatus !== "not_yet_emitted"
	) {
		errors.push(
			`${entry.examplePath} must declare runtimeStatus not_yet_emitted`,
		);
	}
	validateExampleValue(
		schema,
		example,
		entry.examplePath,
		errors,
		entry.schemaPath,
	);
	if (resolvedSemanticValidatorPath) {
		validateExampleWithSemanticValidator(
			entry,
			resolvedSemanticValidatorPath,
			resolvedPaths.examplePath,
			errors,
		);
	}
}

function validateExampleWithSemanticValidator(
	entry,
	semanticValidatorPath,
	examplePath,
	errors,
) {
	const result = spawnSync(
		process.execPath,
		[semanticValidatorPath, examplePath],
		{
			cwd: REPO_ROOT_REAL,
			encoding: "utf8",
		},
	);
	if (result.error) {
		errors.push(
			`${entry.schemaVersion} semanticValidatorPath ${entry.semanticValidatorPath} failed to run: ${result.error.message}`,
		);
		return;
	}
	if (result.status !== 0) {
		const diagnostic = (
			result.stdout ||
			result.stderr ||
			"semantic validator returned failure"
		)
			.trim()
			.split("\n")
			.slice(0, 8)
			.join(" ");
		errors.push(
			`${entry.schemaVersion} semanticValidatorPath ${entry.semanticValidatorPath} failed for ${entry.examplePath}: ${diagnostic}`,
		);
	}
}

function validate(manifestPath) {
	const errors = [];
	const manifest = loadJson(manifestPath);
	validateManifestShape(manifest, errors);
	if (Array.isArray(manifest.packets)) {
		const seen = new Set();
		for (const [index, entry] of manifest.packets.entries()) {
			validatePacketEntry(entry, index, seen, errors);
			if (isObject(entry)) validateSchemaAndExample(entry, errors);
		}
	}
	return {
		schemaVersion: "runtime-packet-schema-validation/v1",
		status: errors.length === 0 ? "pass" : "fail",
		manifestPath,
		packetCount: Array.isArray(manifest.packets) ? manifest.packets.length : 0,
		errors,
	};
}

function main() {
	try {
		const args = parseArgs(process.argv.slice(2));
		const result = validate(args.manifest);
		process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
		process.exitCode = result.status === "pass" ? 0 : 1;
	} catch (error) {
		process.stderr.write(
			`${error instanceof Error ? error.message : String(error)}\n`,
		);
		process.exitCode = 2;
	}
}

if (require.main === module) {
	main();
}

module.exports = { validate };
