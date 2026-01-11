import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/client';
import { queryExecutionLogs, users } from '$lib/db/schema';
import { desc, eq, and, gte, lte } from 'drizzle-orm';

// GET /api/admin/logs - Get query execution logs with pagination and filters
export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (!locals.user.isAdmin) {
		return json({ error: 'Admin access required' }, { status: 403 });
	}

	try {
		// Pagination
		const page = parseInt(url.searchParams.get('page') || '1');
		const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
		const offset = (page - 1) * limit;

		// Filters
		const userIdFilter = url.searchParams.get('userId');
		const successFilter = url.searchParams.get('success');
		const fromDate = url.searchParams.get('from');
		const toDate = url.searchParams.get('to');

		// Build conditions
		const conditions = [];

		if (userIdFilter) {
			conditions.push(eq(queryExecutionLogs.userId, userIdFilter));
		}

		if (successFilter !== null && successFilter !== '') {
			conditions.push(eq(queryExecutionLogs.success, successFilter === 'true'));
		}

		if (fromDate) {
			conditions.push(gte(queryExecutionLogs.createdAt, new Date(fromDate)));
		}

		if (toDate) {
			conditions.push(lte(queryExecutionLogs.createdAt, new Date(toDate)));
		}

		// Fetch logs
		const logs = await db.query.queryExecutionLogs.findMany({
			where: conditions.length > 0 ? and(...conditions) : undefined,
			orderBy: [desc(queryExecutionLogs.createdAt)],
			limit,
			offset
		});

		// Get usernames for logs
		const userIds = [...new Set(logs.map((log) => log.userId))];
		const usersData = await Promise.all(
			userIds.map((id) =>
				db.query.users.findFirst({
					where: eq(users.id, id)
				})
			)
		);

		const usernameMap = new Map(
			usersData.filter(Boolean).map((u) => [u!.id, u!.username])
		);

		// Enrich logs with username
		const enrichedLogs = logs.map((log) => ({
			id: log.id,
			userId: log.userId,
			username: usernameMap.get(log.userId) || 'Unknown',
			codeSnippet: log.codeSnippet,
			success: log.success,
			errorMessage: log.errorMessage,
			executionTimeMs: log.executionTimeMs,
			createdAt: log.createdAt
		}));

		// Get total count for pagination
		const allLogs = await db.query.queryExecutionLogs.findMany({
			where: conditions.length > 0 ? and(...conditions) : undefined
		});
		const totalCount = allLogs.length;

		return json({
			logs: enrichedLogs,
			pagination: {
				page,
				limit,
				totalCount,
				totalPages: Math.ceil(totalCount / limit)
			}
		});
	} catch (error) {
		console.error('Error fetching logs:', error);
		return json({ error: 'Failed to fetch logs' }, { status: 500 });
	}
};
