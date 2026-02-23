import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/client';
import { timePeriods } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { broadcastDataChange } from '$lib/server/events';

// PUT /api/periods/[id]/journal - Save journal entry for a period
export const PUT: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { notes } = await request.json();

		if (typeof notes !== 'string') {
			return json({ error: 'Notes must be a string' }, { status: 400 });
		}

		// Verify the period belongs to the user
		const period = await db.query.timePeriods.findFirst({
			where: and(
				eq(timePeriods.id, params.id),
				eq(timePeriods.userId, locals.user.id)
			)
		});

		if (!period) {
			return json({ error: 'Period not found' }, { status: 404 });
		}

		await db
			.update(timePeriods)
			.set({ notes, updatedAt: new Date() })
			.where(eq(timePeriods.id, params.id));

		broadcastDataChange(locals.user.id, 'data:daily');

		return json({ success: true });
	} catch (error) {
		console.error('Error saving journal entry:', error);
		return json({ error: 'Failed to save journal entry' }, { status: 500 });
	}
};
