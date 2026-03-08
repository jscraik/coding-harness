import { describe, expect, it } from "vitest";
import {
	getDefaultAllowedHosts,
	isPrivateIp,
	isRemoteUrl,
	redactUrlCredentials,
} from "./url-validator.js";

describe("url-validator", () => {
	describe("isPrivateIp", () => {
		it("identifies private IPv4 addresses", () => {
			expect(isPrivateIp("10.0.0.1")).toBe(true);
			expect(isPrivateIp("10.255.255.255")).toBe(true);
			expect(isPrivateIp("172.16.0.1")).toBe(true);
			expect(isPrivateIp("172.31.255.255")).toBe(true);
			expect(isPrivateIp("192.168.1.1")).toBe(true);
			expect(isPrivateIp("192.168.255.255")).toBe(true);
			expect(isPrivateIp("127.0.0.1")).toBe(true);
			expect(isPrivateIp("169.254.1.1")).toBe(true);
		});

		it("identifies private IPv6 addresses", () => {
			expect(isPrivateIp("::1")).toBe(true); // Loopback
			expect(isPrivateIp("fe80::1")).toBe(true); // Link-local
			expect(isPrivateIp("fc00::1")).toBe(true); // Unique local
			expect(isPrivateIp("fd00::1")).toBe(true); // Unique local
			expect(isPrivateIp("::")).toBe(true); // Unspecified
		});

		it("identifies IPv4-mapped IPv6 addresses", () => {
			expect(isPrivateIp("::ffff:192.168.1.1")).toBe(true);
			expect(isPrivateIp("::ffff:10.0.0.1")).toBe(true);
			expect(isPrivateIp("::ffff:127.0.0.1")).toBe(true);
		});

		it("identifies IPv4-mapped IPv6 addresses in hex format", () => {
			// Hex representation of 192.168.1.1 = c0a8:0101
			expect(isPrivateIp("::ffff:c0a8:0101")).toBe(true);
			// Hex representation of 10.0.0.1 = 0a00:0001
			expect(isPrivateIp("::ffff:0a00:0001")).toBe(true);
			// Hex representation of 127.0.0.1 = 7f00:0001
			expect(isPrivateIp("::ffff:7f00:0001")).toBe(true);
		});

		it("identifies carrier-grade NAT range", () => {
			expect(isPrivateIp("100.64.0.1")).toBe(true);
			expect(isPrivateIp("100.127.255.255")).toBe(true);
			expect(isPrivateIp("100.63.255.255")).toBe(false); // Just outside
			expect(isPrivateIp("100.128.0.1")).toBe(false); // Just outside
		});

		it("identifies TEST-NET ranges", () => {
			expect(isPrivateIp("192.0.2.1")).toBe(true); // TEST-NET-1
			expect(isPrivateIp("198.51.100.1")).toBe(true); // TEST-NET-2
			expect(isPrivateIp("203.0.113.1")).toBe(true); // TEST-NET-3
		});

		it("identifies benchmark testing range", () => {
			expect(isPrivateIp("198.18.0.1")).toBe(true);
			expect(isPrivateIp("198.19.255.255")).toBe(true);
		});

		it("returns false for public IPs", () => {
			expect(isPrivateIp("8.8.8.8")).toBe(false);
			expect(isPrivateIp("1.1.1.1")).toBe(false);
			expect(isPrivateIp("172.15.0.1")).toBe(false); // Just outside 172.16/12
			expect(isPrivateIp("192.167.1.1")).toBe(false);
		});
	});

	describe("isRemoteUrl", () => {
		it("identifies HTTPS URLs", () => {
			expect(isRemoteUrl("https://example.com/preset.json")).toBe(true);
			expect(isRemoteUrl("https://github.com/org/repo/file.json")).toBe(true);
		});

		it("rejects HTTP URLs (insecure)", () => {
			expect(isRemoteUrl("http://example.com/preset.json")).toBe(false);
		});

		it("returns false for non-URLs", () => {
			expect(isRemoteUrl("typescript-base")).toBe(false);
			expect(isRemoteUrl("./presets/base.json")).toBe(false);
			expect(isRemoteUrl("/absolute/path.json")).toBe(false);
		});
	});

	describe("redactUrlCredentials", () => {
		it("redacts username in URL", () => {
			const result = redactUrlCredentials("https://user@example.com/path");
			// URL encodes the brackets
			expect(result).toContain("REDACTED");
			expect(result).not.toContain("user");
			expect(result).toContain("example.com/path");
		});

		it("redacts username and password", () => {
			const result = redactUrlCredentials("https://user:pass@example.com/path");
			expect(result).toContain("REDACTED");
			expect(result).not.toContain("user");
			expect(result).not.toContain("pass");
			expect(result).toContain("example.com/path");
		});

		it("does not modify URLs without credentials", () => {
			const url = "https://example.com/path";
			expect(redactUrlCredentials(url)).toBe(url);
		});

		it("handles invalid URLs gracefully", () => {
			expect(redactUrlCredentials("not a valid url")).toBe(
				"[INVALID_URL_REDACTED]",
			);
		});
	});

	describe("getDefaultAllowedHosts", () => {
		it("returns expected default hosts", () => {
			const hosts = getDefaultAllowedHosts();
			expect(hosts).toContain("github.com");
			expect(hosts).toContain("raw.githubusercontent.com");
			expect(hosts).toContain("gitlab.com");
		});

		it("returns a copy of the array", () => {
			const hosts1 = getDefaultAllowedHosts();
			const hosts2 = getDefaultAllowedHosts();
			expect(hosts1).not.toBe(hosts2);
			expect(hosts1).toEqual(hosts2);
		});
	});
});
