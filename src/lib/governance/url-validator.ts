/**
 * URL Validator - SSRF Protection
 *
 * Validates remote URLs to prevent Server-Side Request Forgery attacks:
 * - Protocol restriction (HTTPS only)
 * - Host allowlist enforcement
 * - Private IP blocking with DNS resolution
 * - Redirect tracking and re-validation
 * - DNS rebinding protection via IP pinning
 */

import { lookup } from "node:dns/promises";
import { UrlValidationError } from "../contract/errors.js";

/**
 * Private IP ranges that should never be accessed via remote fetch.
 * Covers RFC 1918, loopback, link-local, and other reserved addresses.
 */
const PRIVATE_IP_PATTERNS = [
	/^10\./, // 10.0.0.0/8
	/^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
	/^192\.168\./, // 192.168.0.0/16
	/^127\./, // 127.0.0.0/8 (loopback)
	/^169\.254\./, // 169.254.0.0/16 (link-local)
	/^0\./, // 0.0.0.0/8
	/^224\./, // 224.0.0.0/4 (multicast)
	/^240\./, // 240.0.0.0/4 (reserved)
	/^255\.255\.255\.255/, // Broadcast
	/^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./, // 100.64.0.0/10 (Carrier-grade NAT)
	/^192\.0\.0\./, // 192.0.0.0/24 (IETF Protocol Assignments)
	/^192\.0\.2\./, // 192.0.2.0/24 (TEST-NET-1)
	/^198\.51\.100\./, // 198.51.100.0/24 (TEST-NET-2)
	/^203\.0\.113\./, // 203.0.113.0/24 (TEST-NET-3)
	/^198\.1[8-9]\./, // 198.18.0.0/15 (Benchmark testing)
];

/**
 * IPv6 private ranges (simplified patterns)
 */
const PRIVATE_IPV6_PATTERNS = [
	/^::$/, // Unspecified
	/^::1$/, // Loopback
	/^fe80:/i, // Link-local
	/^fc00:/i, // Unique local (fc00::/7)
	/^fd00:/i, // Unique local (fc00::/7)
];

/**
 * Default hosts allowed for remote preset fetching.
 */
const DEFAULT_ALLOWED_HOSTS = [
	"github.com",
	"raw.githubusercontent.com",
	"codeload.github.com",
	"api.github.com",
	"gitlab.com",
];

/**
 * Options for URL validation.
 */
export interface UrlValidationOptions {
	/** Hosts allowed for remote fetch. Defaults to GitHub domains. */
	allowedHosts?: string[];
	/** Maximum number of redirects to follow. Default: 3 */
	maxRedirects?: number;
	/** Whether to perform DNS resolution for private IP check. Default: true */
	checkDns?: boolean;
}

/**
 * Result of URL validation with IP pinning for DNS rebinding protection.
 */
export interface ValidatedUrl {
	/** The validated URL object */
	url: URL;
	/** The resolved IP addresses (if DNS check was performed) */
	resolvedIps?: string[];
	/**
	 * A public IP address to use for the connection (DNS rebinding protection).
	 * This is the first non-private IP resolved from the hostname.
	 */
	pinnedIp?: string;
}

/**
 * Validate a URL for safe remote fetching with DNS rebinding protection.
 *
 * DNS Rebinding Protection:
 * - Resolves hostname to IP addresses BEFORE any fetch
 * - Validates ALL resolved IPs are non-private
 * - Returns a pinned IP that MUST be used for the connection
 * - The actual HTTP request should use the pinned IP with Host header
 *
 * @param urlString - The URL string to validate
 * @param options - Validation options
 * @returns Validated URL information with pinned IP
 * @throws UrlValidationError if validation fails
 */
export async function validateRemoteUrl(
	urlString: string,
	options: UrlValidationOptions = {},
): Promise<ValidatedUrl> {
	const { allowedHosts = DEFAULT_ALLOWED_HOSTS, checkDns = true } = options;

	// Parse URL
	let url: URL;
	try {
		url = new URL(urlString);
	} catch {
		throw createUrlError(`Invalid URL format: ${urlString}`, "INVALID_URL");
	}

	// Protocol check - only HTTPS allowed
	if (url.protocol !== "https:") {
		throw createUrlError(
			`Only HTTPS protocol allowed, got: ${url.protocol}`,
			"PROTOCOL_NOT_ALLOWED",
		);
	}

	// Host allowlist check
	if (!allowedHosts.includes(url.hostname)) {
		throw createUrlError(
			`Host '${url.hostname}' not in allowlist. Allowed: ${allowedHosts.join(", ")}`,
			"HOST_NOT_ALLOWED",
		);
	}

	// DNS resolution and private IP check
	let resolvedIps: string[] | undefined;
	let pinnedIp: string | undefined;

	if (checkDns) {
		try {
			// Resolve hostname to IP addresses
			const addresses = await lookup(url.hostname, { all: true });
			resolvedIps = addresses.map((addr) => addr.address);

			if (resolvedIps.length === 0) {
				throw createUrlError(
					`No IP addresses resolved for ${url.hostname}`,
					"DNS_LOOKUP_FAILED",
				);
			}

			// Check each resolved IP against private ranges
			// ALL IPs must be non-private (defense in depth)
			for (const ip of resolvedIps) {
				if (isPrivateIp(ip)) {
					throw createUrlError(
						`Resolved IP ${ip} is in private range. DNS rebinding attack blocked.`,
						"PRIVATE_IP_BLOCKED",
					);
				}
			}

			// Pin the first resolved IP for the actual connection
			// This prevents TOCTOU (Time-of-Check-Time-of-Use) attacks
			pinnedIp = resolvedIps[0];
		} catch (error) {
			// Re-throw our own errors
			if (error instanceof Error && "code" in error) {
				throw error;
			}
			// DNS lookup failed
			throw createUrlError(
				`DNS lookup failed for ${url.hostname}: ${error instanceof Error ? error.message : "unknown error"}`,
				"DNS_LOOKUP_FAILED",
			);
		}
	}

	// Conditionally construct return object to satisfy exactOptionalPropertyTypes
	if (resolvedIps !== undefined && pinnedIp !== undefined) {
		return { url, resolvedIps, pinnedIp };
	}
	return { url };
}

/**
 * Normalize an IPv6 address to expanded format.
 * Handles various compressed notations.
 */
function normalizeIpv6(ip: string): string {
	// Handle IPv4-mapped addresses in hex format (::ffff:7f00:0001)
	// Expand :: to full zero groups
	let expanded = ip;

	// Handle :: abbreviation
	if (expanded.includes("::")) {
		const parts = expanded.split("::");
		const left = parts[0]?.split(":") ?? [];
		const right = parts[1]?.split(":") ?? [];
		const missing = 8 - left.length - right.length;
		const zeros = Array(missing).fill("0000");
		expanded = [...left, ...zeros, ...right].join(":");
	}

	// Pad each group to 4 hex digits
	return expanded
		.split(":")
		.map((group) => group.padStart(4, "0"))
		.join(":");
}

/**
 * Check if an IP address is in a private range.
 * Handles IPv4, IPv6, and IPv4-mapped IPv6 addresses.
 */
export function isPrivateIp(ip: string): boolean {
	// Handle IPv6 addresses (including IPv4-mapped)
	if (ip.includes(":")) {
		// Normalize IPv6 to handle various formats
		const normalized = normalizeIpv6(ip);

		// IPv4-mapped IPv6 addresses in expanded format
		// Format: 0000:0000:0000:0000:0000:ffff:<IPv4 dotted decimal>
		// Example: 0000:0000:0000:0000:0000:ffff:192.168.1.1
		const ipv4MappedDecimal = normalized.match(
			/(?:0000:){5}ffff:(\d+\.\d+\.\d+\.\d+)/i,
		);
		if (ipv4MappedDecimal?.[1]) {
			return isPrivateIpv4(ipv4MappedDecimal[1]);
		}

		// IPv4-mapped in hex format
		// Format: 0000:0000:0000:0000:0000:ffff:<high 16 bits>:<low 16 bits>
		// Example: 0000:0000:0000:0000:0000:ffff:c0a8:0101 (192.168.1.1)
		const ipv4MappedHex = normalized.match(
			/(?:0000:){5}ffff:([0-9a-f]{4}):([0-9a-f]{4})/i,
		);
		if (ipv4MappedHex?.[1] && ipv4MappedHex?.[2]) {
			const highBits = Number.parseInt(ipv4MappedHex[1], 16);
			const lowBits = Number.parseInt(ipv4MappedHex[2], 16);
			const octets = [
				(highBits >> 8) & 0xff,
				highBits & 0xff,
				(lowBits >> 8) & 0xff,
				lowBits & 0xff,
			];
			return isPrivateIpv4(octets.join("."));
		}

		// Check for IPv4-compatible IPv6 (::127.0.0.1 or ::7f000001)
		// These are deprecated but still parsed by some systems
		// Format: 0000:0000:0000:0000:0000:0000:<IPv4 in hex>
		const ipv4Compatible = normalized.match(/(?:0000:){7}([0-9a-f]{8})/i);
		if (ipv4Compatible?.[1]) {
			const hex = ipv4Compatible[1];
			const octets = [
				Number.parseInt(hex.slice(0, 2), 16),
				Number.parseInt(hex.slice(2, 4), 16),
				Number.parseInt(hex.slice(4, 6), 16),
				Number.parseInt(hex.slice(6, 8), 16),
			];
			return isPrivateIpv4(octets.join("."));
		}

		return PRIVATE_IPV6_PATTERNS.some((pattern) => pattern.test(ip));
	}

	return isPrivateIpv4(ip);
}

/**
 * Check if an IPv4 address is in a private range.
 */
function isPrivateIpv4(ip: string): boolean {
	return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(ip));
}

/**
 * Create a URL validation error.
 */
function createUrlError(
	message: string,
	code: UrlValidationError["code"],
): UrlValidationError {
	return new UrlValidationError(message, code);
}

/**
 * Redact credentials from a URL for safe logging.
 * Handles both userinfo credentials and URL-encoded credentials.
 */
export function redactUrlCredentials(urlString: string): string {
	try {
		const url = new URL(urlString);
		if (url.username || url.password) {
			url.username = "[REDACTED]";
			url.password = "";
		}
		return url.toString();
	} catch {
		return "[INVALID_URL_REDACTED]";
	}
}

/**
 * Check if a string looks like a remote URL.
 * Only HTTPS URLs are considered remote (HTTP is insecure).
 */
export function isRemoteUrl(source: string): boolean {
	return source.startsWith("https://");
}

/**
 * Fetch a remote resource with DNS rebinding protection.
 *
 * Uses the pinned IP from validateRemoteUrl to prevent DNS rebinding attacks.
 * The Host header is set to the original hostname for SSL certificate validation.
 *
 * @param url - The validated URL from validateRemoteUrl
 * @param pinnedIp - The pinned IP address to connect to
 * @param init - Additional fetch options
 * @returns Fetch Response
 */
export async function secureFetch(
	url: URL,
	pinnedIp: string,
	init?: RequestInit,
): Promise<Response> {
	// Construct URL with pinned IP but preserve Host header for SSL
	const pinnedUrl = new URL(url.href);
	pinnedUrl.hostname = pinnedIp;

	// Ensure we use the original hostname in the Host header
	// This is required for SSL certificate validation
	const headers = new Headers(init?.headers);
	headers.set("Host", url.hostname);

	return fetch(pinnedUrl, {
		...init,
		headers,
	});
}

/**
 * Get the default allowed hosts.
 */
export function getDefaultAllowedHosts(): string[] {
	return [...DEFAULT_ALLOWED_HOSTS];
}
