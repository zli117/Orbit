import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { executeQuery } from '$lib/server/query/executor';
import { checkRateLimit, logQueryExecution } from '$lib/server/query/security';

// Security limits
const MAX_CODE_SIZE_BYTES = 100 * 1024; // 100KB max code size

// POST /api/queries/execute - Execute a query
export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const userId = locals.user.id;

	try {
		const body = await request.json();
		const { code, params } = body;

		if (!code || typeof code !== 'string') {
			return json({ error: 'Code is required' }, { status: 400 });
		}

		// Security: Check code size limit
		const codeSize = new TextEncoder().encode(code).length;
		if (codeSize > MAX_CODE_SIZE_BYTES) {
			await logQueryExecution(userId, code.slice(0, 500), false, 'Code size exceeds limit');
			return json({ error: `Code size (${Math.round(codeSize / 1024)}KB) exceeds maximum allowed (${MAX_CODE_SIZE_BYTES / 1024}KB)` }, { status: 400 });
		}

		// Security: Check rate limit
		const rateLimitResult = checkRateLimit(userId);
		if (!rateLimitResult.allowed) {
			await logQueryExecution(userId, code.slice(0, 500), false, 'Rate limit exceeded');
			return json({ error: `Rate limit exceeded. Try again in ${rateLimitResult.retryAfterSeconds} seconds.` }, { status: 429 });
		}

		const startTime = Date.now();
		const result = await executeQuery(code, userId, params || {});
		const executionTimeMs = Date.now() - startTime;

		// Log execution for audit trail
		await logQueryExecution(userId, code.slice(0, 1000), !result.error, result.error, executionTimeMs);

		if (result.error) {
			return json({ error: result.error }, { status: 400 });
		}

		return json({
			result: result.result,
			renders: result.renders,
			progressValue: result.progressValue
		});
	} catch (error) {
		console.error('Error executing query:', error);
		return json({ error: 'Failed to execute query' }, { status: 500 });
	}
};
