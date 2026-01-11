import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/client';
import { queryExecutionLogs, users } from '$lib/db/schema';
import { gte, eq } from 'drizzle-orm';

// GET /api/admin/logs/stats - Get aggregated log statistics
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (!locals.user.isAdmin) {
		return json({ error: 'Admin access required' }, { status: 403 });
	}

	try {
		const now = new Date();
		const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
		const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

		// Get all users count
		const allUsers = await db.query.users.findMany();
		const totalUsers = allUsers.length;
		const disabledUsers = allUsers.filter((u) => u.isDisabled).length;
		const adminUsers = allUsers.filter((u) => u.isAdmin).length;

		// Get logs for last 24h
		const logs24h = await db.query.queryExecutionLogs.findMany({
			where: gte(queryExecutionLogs.createdAt, last24h)
		});

		// Get logs for last 7 days
		const logs7d = await db.query.queryExecutionLogs.findMany({
			where: gte(queryExecutionLogs.createdAt, last7d)
		});

		// Calculate stats
		const executions24h = logs24h.length;
		const errors24h = logs24h.filter((l) => !l.success).length;
		const avgExecutionTime24h =
			logs24h.length > 0
				? Math.round(
						logs24h.reduce((sum, l) => sum + (l.executionTimeMs || 0), 0) / logs24h.length
					)
				: 0;

		const executions7d = logs7d.length;
		const errors7d = logs7d.filter((l) => !l.success).length;

		// Get top users by query count (last 7 days)
		const userQueryCounts = new Map<string, number>();
		for (const log of logs7d) {
			userQueryCounts.set(log.userId, (userQueryCounts.get(log.userId) || 0) + 1);
		}

		const topUsersById = [...userQueryCounts.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5);

		// Get usernames for top users
		const topUsers = await Promise.all(
			topUsersById.map(async ([userId, count]) => {
				const user = await db.query.users.findFirst({
					where: eq(users.id, userId)
				});
				return {
					userId,
					username: user?.username || 'Unknown',
					queryCount: count
				};
			})
		);

		return json({
			users: {
				total: totalUsers,
				disabled: disabledUsers,
				admins: adminUsers
			},
			queries: {
				last24h: {
					total: executions24h,
					errors: errors24h,
					avgExecutionTimeMs: avgExecutionTime24h
				},
				last7d: {
					total: executions7d,
					errors: errors7d
				}
			},
			topUsers
		});
	} catch (error) {
		console.error('Error fetching stats:', error);
		return json({ error: 'Failed to fetch stats' }, { status: 500 });
	}
};
