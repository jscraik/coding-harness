/**
 * Resource Tracker for E2E Tests
 *
 * Tracks all resources created during E2E tests for automatic cleanup.
 * Ensures test isolation and prevents resource leaks.
 */

import { writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { maskSensitiveData } from "./env.js";

export type ResourceType =
	| "github-repo"
	| "github-pr"
	| "github-branch"
	| "github-issue"
	| "github-comment"
	| "github-ruleset"
	| "github-check-run"
	| "linear-issue"
	| "linear-comment"
	| "linear-attachment"
	| "linear-state"
	| "file"
	| "directory";

export interface TrackedResource {
	id: string;
	type: ResourceType;
	name: string;
	metadata: Record<string, unknown>;
	createdAt: Date;
	cleanupFunction?: () => Promise<void>;
}

export interface ResourceRecording {
	testName: string;
	startedAt: string;
	completedAt?: string;
	resources: TrackedResource[];
	apiCalls: APICall[];
	errors: ErrorRecord[];
}

export interface APICall {
	timestamp: string;
	provider: "github" | "linear" | "filesystem";
	method: string;
	endpoint?: string;
	request?: unknown;
	response?: unknown;
	durationMs: number;
	error?: string;
}

export interface ErrorRecord {
	timestamp: string;
	phase: "setup" | "test" | "cleanup";
	message: string;
	stack?: string;
}

export class ResourceTracker {
	private resources: Map<string, TrackedResource> = new Map();
	private apiCalls: APICall[] = [];
	private errors: ErrorRecord[] = [];
	private testName: string;
	private startedAt: Date;
	private recordingsDir: string;
	private cleanupEnabled: boolean;

	constructor(
		testName: string,
		recordingsDir = "./e2e/recordings",
		cleanupEnabled = true,
	) {
		this.testName = testName;
		this.recordingsDir = recordingsDir;
		this.startedAt = new Date();
		this.cleanupEnabled = cleanupEnabled;
	}

	/**
	 * Track a resource for later cleanup
	 */
	track(
		type: ResourceType,
		id: string,
		name: string,
		metadata: Record<string, unknown> = {},
		cleanupFunction?: () => Promise<void>,
	): TrackedResource {
		const resource: TrackedResource = {
			id,
			type,
			name,
			metadata,
			createdAt: new Date(),
			cleanupFunction,
		};
		this.resources.set(id, resource);
		return resource;
	}

	/**
	 * Record an API call for audit trail
	 */
	recordAPICall(call: Omit<APICall, "timestamp">): void {
		this.apiCalls.push({
			...call,
			timestamp: new Date().toISOString(),
		});
	}

	/**
	 * Record an error
	 */
	recordError(error: Error, phase: "setup" | "test" | "cleanup"): void {
		this.errors.push({
			timestamp: new Date().toISOString(),
			phase,
			message: error.message,
			stack: error.stack,
		});
	}

	/**
	 * Get all tracked resources
	 */
	getResources(): TrackedResource[] {
		return Array.from(this.resources.values());
	}

	/**
	 * Get resources by type
	 */
	getResourcesByType(type: ResourceType): TrackedResource[] {
		return this.getResources().filter((r) => r.type === type);
	}

	/**
	 * Remove a resource from tracking (if already cleaned up manually)
	 */
	untrack(id: string): void {
		this.resources.delete(id);
	}

	/**
	 * Clean up all tracked resources in reverse order of creation
	 */
	async cleanup(): Promise<void> {
		if (!this.cleanupEnabled) {
			console.log(`[ResourceTracker] Cleanup disabled for: ${this.testName}`);
			return;
		}

		const resources = this.getResources().reverse();
		console.log(
			`[ResourceTracker] Cleaning up ${resources.length} resources for: ${this.testName}`,
		);

		for (const resource of resources) {
			try {
				if (resource.cleanupFunction) {
					await resource.cleanupFunction();
					console.log(
						`[ResourceTracker] Cleaned up: ${resource.type} - ${resource.name}`,
					);
				}
			} catch (error) {
				console.error(
					`[ResourceTracker] Failed to clean up ${resource.type} - ${resource.name}:`,
					error,
				);
				this.recordError(
					error instanceof Error ? error : new Error(String(error)),
					"cleanup",
				);
			}
		}

		// Save recording
		await this.saveRecording();
	}

	/**
	 * Save the complete test recording to disk
	 */
	async saveRecording(): Promise<void> {
		try {
			await mkdir(this.recordingsDir, { recursive: true });

			const recording: ResourceRecording = {
				testName: this.testName,
				startedAt: this.startedAt.toISOString(),
				completedAt: new Date().toISOString(),
				resources: maskSensitiveData(this.getResources()) as TrackedResource[],
				apiCalls: maskSensitiveData(this.apiCalls) as APICall[],
				errors: this.errors,
			};

			const filename = `${this.testName.replace(/[^a-z0-9]/gi, "_")}_${this.startedAt.getTime()}.json`;
			const filepath = join(this.recordingsDir, filename);

			writeFileSync(filepath, JSON.stringify(recording, null, 2), "utf-8");
			console.log(`[ResourceTracker] Recording saved: ${filepath}`);
		} catch (error) {
			console.error("[ResourceTracker] Failed to save recording:", error);
		}
	}

	/**
	 * Generate a unique test resource name
	 */
	static generateName(prefix: string, testId: string): string {
		const timestamp = Date.now();
		const random = Math.random().toString(36).substring(2, 8);
		return `${prefix}-e2e-${testId}-${timestamp}-${random}`;
	}

	/**
	 * Generate a unique test branch name
	 */
	static generateBranchName(testId: string): string {
		const timestamp = Date.now();
		const random = Math.random().toString(36).substring(2, 8);
		return `e2e/${testId}/${timestamp}-${random}`;
	}
}

/**
 * Global test context for sharing state within a test suite
 */
export interface E2ETestContext {
	tracker: ResourceTracker;
	testId: string;
	startTime: Date;
}

export function createTestContext(
	testName: string,
	recordingsDir?: string,
): E2ETestContext {
	const testId = `test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
	return {
		tracker: new ResourceTracker(testName, recordingsDir),
		testId,
		startTime: new Date(),
	};
}
