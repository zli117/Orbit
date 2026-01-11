import { db } from '$lib/db/client';
import { queryExecutionLogs } from '$lib/db/schema';
import { nanoid } from 'nanoid';

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 queries per minute per user

// In-memory rate limit store (for single-instance deployments)
// For multi-instance, consider Redis or database-backed solution
interface RateLimitEntry {
	count: number;
	windowStart: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries periodically
setInterval(() => {
	const now = Date.now();
	for (const [key, entry] of rateLimitStore.entries()) {
		if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
			rateLimitStore.delete(key);
		}
	}
}, RATE_LIMIT_WINDOW_MS);

/**
 * Check if a user is within their rate limit
 * Returns whether the request is allowed and retry info if not
 */
export function checkRateLimit(userId: string): { allowed: boolean; retryAfterSeconds?: number } {
	const now = Date.now();
	const entry = rateLimitStore.get(userId);

	if (!entry) {
		// First request in window
		rateLimitStore.set(userId, { count: 1, windowStart: now });
		return { allowed: true };
	}

	// Check if window has expired
	if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
		// Start new window
		rateLimitStore.set(userId, { count: 1, windowStart: now });
		return { allowed: true };
	}

	// Within window - check count
	if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
		const retryAfterMs = RATE_LIMIT_WINDOW_MS - (now - entry.windowStart);
		return { allowed: false, retryAfterSeconds: Math.ceil(retryAfterMs / 1000) };
	}

	// Increment count
	entry.count++;
	return { allowed: true };
}

/**
 * Log query execution for audit trail
 * Stores truncated code, success/failure status, and execution time
 */
export async function logQueryExecution(
	userId: string,
	codeSnippet: string,
	success: boolean,
	errorMessage?: string,
	executionTimeMs?: number
): Promise<void> {
	try {
		await db.insert(queryExecutionLogs).values({
			id: nanoid(),
			userId,
			codeSnippet: codeSnippet.slice(0, 1000), // Limit stored code size
			success,
			errorMessage: errorMessage?.slice(0, 500),
			executionTimeMs,
			createdAt: new Date()
		});
	} catch (err) {
		// Don't fail the request if logging fails
		console.error('Failed to log query execution:', err);
	}
}

/**
 * Get recent query executions for a user (for admin/debugging)
 */
export async function getRecentExecutions(userId: string, limit = 50) {
	return db.query.queryExecutionLogs.findMany({
		where: (logs, { eq }) => eq(logs.userId, userId),
		orderBy: (logs, { desc }) => [desc(logs.createdAt)],
		limit
	});
}
