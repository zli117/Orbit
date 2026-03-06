import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getTodayInTimezone } from '$lib/utils/week';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	// Redirect to today's date (respecting user's timezone)
	const timezone = locals.user.timezone || 'UTC';
	const today = getTodayInTimezone(timezone);

	throw redirect(302, `/daily/${today}`);
};
