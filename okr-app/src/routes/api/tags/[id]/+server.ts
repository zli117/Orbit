import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db/client';
import { tags } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

// PUT /api/tags/[id] - Update a tag
export const PUT: RequestHandler = async ({ locals, params, request }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { id } = params;
		const body = await request.json();
		const { name, color, category } = body;

		// Verify tag belongs to user
		const existing = await db.query.tags.findFirst({
			where: and(eq(tags.id, id), eq(tags.userId, locals.user.id))
		});

		if (!existing) {
			return json({ error: 'Tag not found' }, { status: 404 });
		}

		// Check for duplicate name (excluding current tag)
		if (name && name.trim() !== existing.name) {
			const duplicate = await db.query.tags.findFirst({
				where: and(eq(tags.userId, locals.user.id), eq(tags.name, name.trim()))
			});

			if (duplicate) {
				return json({ error: 'Tag with this name already exists' }, { status: 409 });
			}
		}

		await db
			.update(tags)
			.set({
				name: name?.trim() ?? existing.name,
				color: color !== undefined ? color : existing.color,
				category: category !== undefined ? category : existing.category
			})
			.where(eq(tags.id, id));

		const tag = await db.query.tags.findFirst({
			where: eq(tags.id, id)
		});

		return json({ tag });
	} catch (error) {
		console.error('Error updating tag:', error);
		return json({ error: 'Failed to update tag' }, { status: 500 });
	}
};

// DELETE /api/tags/[id] - Delete a tag
export const DELETE: RequestHandler = async ({ locals, params }) => {
	if (!locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { id } = params;

		// Verify tag belongs to user
		const existing = await db.query.tags.findFirst({
			where: and(eq(tags.id, id), eq(tags.userId, locals.user.id))
		});

		if (!existing) {
			return json({ error: 'Tag not found' }, { status: 404 });
		}

		await db.delete(tags).where(eq(tags.id, id));

		return json({ success: true });
	} catch (error) {
		console.error('Error deleting tag:', error);
		return json({ error: 'Failed to delete tag' }, { status: 500 });
	}
};
