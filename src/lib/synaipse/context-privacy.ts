/** Return whether a ref carries private content regardless of classification. */
function isPrivateContext(kind: string, classification: string): boolean {
	return (
		kind === "private_context" ||
		classification === "confidential" ||
		classification === "restricted"
	);
}

/** Return whether a consumer/destination crosses a hosted context boundary. */
function crossesHostedBoundary(consumer: string, destination: string): boolean {
	return (
		consumer === "remote_agent" ||
		consumer === "hosted_ci" ||
		destination === "hosted_ci"
	);
}

/** Return whether context privacy forbids this consumer or destination. */
export function synaipsePrivacyBlocks(
	kind: string,
	classification: string,
	allowedConsumers: readonly string[],
	prohibitedDestinations: readonly string[],
	taskPrivacy: string,
	consumer: string,
	destination: string,
): boolean {
	if (!allowedConsumers.includes(consumer)) return true;
	if (prohibitedDestinations.includes(destination)) return true;
	if (destination === "public_pr" && taskPrivacy !== "public") return true;
	if (
		destination === "public_pr" &&
		(kind === "private_context" || classification !== "public")
	)
		return true;
	return (
		isPrivateContext(kind, classification) &&
		crossesHostedBoundary(consumer, destination)
	);
}
