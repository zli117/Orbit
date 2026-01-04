import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/client';
import { users } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

// GET /api/user/preferences - Get user preferences
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const user = await db.query.users.findFirst({
		where: eq(users.id, locals.user.id)
	});

	if (!user) {
		return json({ error: 'User not found' }, { status: 404 });
	}

	return json({
		weekStartDay: user.weekStartDay || 'monday'
	});
};

// PUT /api/user/preferences - Update user preferences
export const PUT: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await request.json();
		const { weekStartDay } = body;

		// Validate weekStartDay
		if (weekStartDay && !['sunday', 'monday'].includes(weekStartDay)) {
			return json({ error: 'Invalid weekStartDay value' }, { status: 400 });
		}

		const updates: Record<string, unknown> = {};
		if (weekStartDay) {
			updates.weekStartDay = weekStartDay;
		}

		if (Object.keys(updates).length === 0) {
			return json({ error: 'No valid preferences to update' }, { status: 400 });
		}

		await db.update(users)
			.set(updates)
			.where(eq(users.id, locals.user.id));

		return json({ success: true, weekStartDay });
	} catch (error) {
		console.error('Error updating preferences:', error);
		return json({ error: 'Failed to update preferences' }, { status: 500 });
	}
};
