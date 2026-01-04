import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/client';
import { savedQueries } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// GET /api/queries - List all saved queries
// Query params: type=progress|widget|general (optional)
export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const queryType = url.searchParams.get('type');
	const validTypes = ['progress', 'widget', 'general'];

	let queries;
	if (queryType && validTypes.includes(queryType)) {
		queries = await db.query.savedQueries.findMany({
			where: and(
				eq(savedQueries.userId, locals.user.id),
				eq(savedQueries.queryType, queryType as 'progress' | 'widget' | 'general')
			)
		});
	} else {
		queries = await db.query.savedQueries.findMany({
			where: eq(savedQueries.userId, locals.user.id)
		});
	}

	return json({ queries });
};

// POST /api/queries - Create a new saved query
export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await request.json();
		const { name, description, code, queryType } = body;

		if (!name || typeof name !== 'string') {
			return json({ error: 'Name is required' }, { status: 400 });
		}

		if (!code || typeof code !== 'string') {
			return json({ error: 'Code is required' }, { status: 400 });
		}

		const validTypes = ['progress', 'widget', 'general'];
		const type = validTypes.includes(queryType) ? queryType : 'general';

		const id = uuidv4();
		const now = new Date();

		await db.insert(savedQueries).values({
			id,
			userId: locals.user.id,
			name: name.trim(),
			description: description?.trim() || null,
			queryType: type,
			code,
			createdAt: now,
			updatedAt: now
		});

		const query = await db.query.savedQueries.findFirst({
			where: eq(savedQueries.id, id)
		});

		return json({ query }, { status: 201 });
	} catch (error) {
		console.error('Error creating query:', error);
		return json({ error: 'Failed to create query' }, { status: 500 });
	}
};
