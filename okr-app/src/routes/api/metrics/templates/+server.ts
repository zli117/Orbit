import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/client';
import { metricsTemplates } from '$lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// GET /api/metrics/templates - List all templates for the user
export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const templates = await db.query.metricsTemplates.findMany({
		where: eq(metricsTemplates.userId, locals.user.id),
		orderBy: [desc(metricsTemplates.effectiveFrom)]
	});

	return json({ templates });
};

// POST /api/metrics/templates - Create a new template
export const POST: RequestHandler = async ({ locals, request }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await request.json();
		const { name, effectiveFrom, metricsDefinition } = body;

		if (!effectiveFrom) {
			return json({ error: 'effectiveFrom date is required' }, { status: 400 });
		}

		if (!metricsDefinition || !Array.isArray(metricsDefinition)) {
			return json({ error: 'metricsDefinition must be an array' }, { status: 400 });
		}

		const id = randomUUID();

		await db.insert(metricsTemplates).values({
			id,
			userId: locals.user.id,
			name: name || 'default',
			effectiveFrom,
			metricsDefinition: JSON.stringify(metricsDefinition)
		});

		const template = await db.query.metricsTemplates.findFirst({
			where: eq(metricsTemplates.id, id)
		});

		return json({ template }, { status: 201 });
	} catch (error) {
		console.error('Error creating template:', error);
		return json({ error: 'Failed to create template' }, { status: 500 });
	}
};
