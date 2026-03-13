/**
 * SPDX License definitions and utilities
 *
 * Provides a database of common open-source licenses with their
 * SPDX identifiers, aliases, and metadata (OSI approval, copyleft status).
 */

export interface SpdxLicense {
	/** SPDX short identifier (e.g., "MIT", "Apache-2.0") */
	spdxId: string;
	/** Full human-readable name */
	name: string;
	/** Alternative names/abbreviations */
	aliases: string[];
	/** Regex patterns for detecting license in text */
	patterns: string[];
	/** Whether OSI has approved this license */
	osiApproved: boolean;
	/** Whether this is a copyleft license */
	copyleft: boolean;
}

/** Permissive licenses (non-copyleft) */
export const PERMISSIVE_LICENSES: SpdxLicense[] = [
	{
		spdxId: "MIT",
		name: "MIT License",
		aliases: ["MIT", "MIT License", "Expat"],
		patterns: [
			"MIT License",
			"Permission is hereby granted, free of charge",
			"The above copyright notice and this permission notice",
		],
		osiApproved: true,
		copyleft: false,
	},
	{
		spdxId: "Apache-2.0",
		name: "Apache License 2.0",
		aliases: ["Apache-2.0", "Apache 2.0", "Apache License 2.0", "ASL-2.0"],
		patterns: [
			"Apache License",
			"Version 2.0",
			"www.apache.org/licenses/LICENSE-2.0",
			"Licensed under the Apache License, Version 2.0",
		],
		osiApproved: true,
		copyleft: false,
	},
	{
		spdxId: "BSD-2-Clause",
		name: 'BSD 2-Clause "Simplified" License',
		aliases: ["BSD-2-Clause", "BSD 2-Clause", "Simplified BSD", "FreeBSD"],
		patterns: [
			"BSD 2-Clause",
			"Redistribution and use in source and binary forms",
			"with or without modification",
		],
		osiApproved: true,
		copyleft: false,
	},
	{
		spdxId: "BSD-3-Clause",
		name: 'BSD 3-Clause "New" or "Revised" License',
		aliases: ["BSD-3-Clause", "BSD 3-Clause", "New BSD", "Revised BSD", "BSD"],
		patterns: [
			"BSD 3-Clause",
			"Redistribution and use in source and binary forms",
			"neither the name of",
		],
		osiApproved: true,
		copyleft: false,
	},
	{
		spdxId: "ISC",
		name: "ISC License",
		aliases: ["ISC", "ISC License"],
		patterns: [
			"ISC License",
			"Permission to use, copy, modify, and/or distribute",
			"for any purpose with or without fee",
		],
		osiApproved: true,
		copyleft: false,
	},
];

/** Copyleft licenses */
export const COPYLEFT_LICENSES: SpdxLicense[] = [
	{
		spdxId: "GPL-3.0",
		name: "GNU General Public License v3.0",
		aliases: ["GPL-3.0", "GPLv3", "GPL v3", "GNU GPL v3"],
		patterns: [
			"GNU GENERAL PUBLIC LICENSE",
			"Version 3",
			"GNU GPLv3",
			"www.gnu.org/licenses/gpl-3.0",
		],
		osiApproved: true,
		copyleft: true,
	},
	{
		spdxId: "GPL-2.0",
		name: "GNU General Public License v2.0",
		aliases: ["GPL-2.0", "GPLv2", "GPL v2", "GNU GPL v2"],
		patterns: [
			"GNU GENERAL PUBLIC LICENSE",
			"Version 2",
			"GNU GPLv2",
			"www.gnu.org/licenses/gpl-2.0",
		],
		osiApproved: true,
		copyleft: true,
	},
	{
		spdxId: "LGPL-3.0",
		name: "GNU Lesser General Public License v3.0",
		aliases: ["LGPL-3.0", "LGPLv3", "LGPL v3", "GNU LGPL v3"],
		patterns: [
			"GNU LESSER GENERAL PUBLIC LICENSE",
			"Version 3",
			"www.gnu.org/licenses/lgpl-3.0",
		],
		osiApproved: true,
		copyleft: true,
	},
	{
		spdxId: "LGPL-2.1",
		name: "GNU Lesser General Public License v2.1",
		aliases: ["LGPL-2.1", "LGPLv2.1", "LGPL v2.1"],
		patterns: [
			"GNU LESSER GENERAL PUBLIC LICENSE",
			"Version 2.1",
			"www.gnu.org/licenses/lgpl-2.1",
		],
		osiApproved: true,
		copyleft: true,
	},
	{
		spdxId: "AGPL-3.0",
		name: "GNU Affero General Public License v3.0",
		aliases: ["AGPL-3.0", "AGPLv3", "AGPL v3"],
		patterns: [
			"GNU AFFERO GENERAL PUBLIC LICENSE",
			"Version 3",
			"www.gnu.org/licenses/agpl-3.0",
		],
		osiApproved: true,
		copyleft: true,
	},
	{
		spdxId: "MPL-2.0",
		name: "Mozilla Public License 2.0",
		aliases: ["MPL-2.0", "MPL 2.0", "Mozilla Public License"],
		patterns: ["Mozilla Public License", "Version 2.0", "mozilla.org/MPL/2.0"],
		osiApproved: true,
		copyleft: true,
	},
];

/** All known licenses */
export const ALL_LICENSES: SpdxLicense[] = [
	...PERMISSIVE_LICENSES,
	...COPYLEFT_LICENSES,
];

/** SPDX IDs of all OSI-approved licenses */
export const OSI_APPROVED_IDS: string[] = ALL_LICENSES.filter(
	(l) => l.osiApproved,
).map((l) => l.spdxId);

/**
 * Look up a license by its SPDX ID
 * @param spdxId - The SPDX identifier (case-insensitive)
 * @returns The license definition or undefined
 */
export function getLicenseBySpdxId(spdxId: string): SpdxLicense | undefined {
	const normalized = spdxId.trim().toLowerCase();
	return ALL_LICENSES.find(
		(l) =>
			l.spdxId.toLowerCase() === normalized ||
			l.aliases.some((a) => a.toLowerCase() === normalized),
	);
}

/**
 * Check if a license SPDX ID is in the allowed list
 * @param spdxId - The SPDX identifier to check
 * @param allowedIds - List of allowed SPDX IDs
 * @returns true if the license is allowed
 */
export function isLicenseAllowed(
	spdxId: string,
	allowedIds: string[],
): boolean {
	const normalized = spdxId.trim().toLowerCase();
	return allowedIds.some(
		(allowed) =>
			allowed.toLowerCase() === normalized ||
			allowed.toLowerCase().replace(/-/g, "") === normalized.replace(/-/g, ""),
	);
}

/**
 * Check if a license is OSI-approved
 * @param spdxId - The SPDX identifier
 * @returns true if OSI-approved
 */
export function isOsiApproved(spdxId: string): boolean {
	const license = getLicenseBySpdxId(spdxId);
	return license?.osiApproved ?? false;
}

/**
 * Check if a license is copyleft
 * @param spdxId - The SPDX identifier
 * @returns true if copyleft
 */
export function isCopyleft(spdxId: string): boolean {
	const license = getLicenseBySpdxId(spdxId);
	return license?.copyleft ?? false;
}
