import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/db/client';
import { tags } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const userTags = await db.query.tags.findMany({
		where: eq(tags.userId, locals.user.id),
		orderBy: (tag, { asc }) => [asc(tag.category), asc(tag.name)]
	});

	return {
		tags: userTags
	};
};
